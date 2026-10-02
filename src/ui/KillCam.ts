import * as THREE from 'three';
import type { HitReplay } from '../game/Game';
import { applyGunPose, buildVehicleModel } from '../game/models';
import { buildShellModel } from '../game/models/shell';
import type { Segment } from '../game/damage/penetration';
import { turretRingOffset } from '../game/damage/geometry';
import { isCasemate } from '../game/casemate';
import type { VehicleSpec } from '../data/types';
import { KillCamOverlay } from './killcamOverlay';

/** 回放窗口尺寸与位置(右上角) */
export const KILLCAM = { width: 440, height: 270, margin: 16 };
export const KILLCAM_FULL_MARGIN = 24;

export type KillCamLayout = 'corner' | 'full';

export interface KillCamOptions {
  /** corner = 右上角小窗(击毁敌人,现状);full = 自己被击毁,铺满或接近铺满画面 */
  layout?: KillCamLayout;
  /** 标题,不传时用现在的「击毁回放 · <车名>」 */
  title?: string;
}

/** 回放视口(CSS 像素,左上角原点),render() 和 main.ts 的瞄准镜挖洞共用 */
export function killcamRect(layout: KillCamLayout, viewW: number, viewH: number): { x: number; y: number; w: number; h: number } {
  if (layout === 'full') {
    const margin = KILLCAM_FULL_MARGIN;
    const w = Math.max(0, viewW - margin * 2);
    const h = Math.max(0, viewH - margin * 2);
    return {
      x: Math.round((viewW - w) / 2),
      y: Math.round((viewH - h) / 2),
      w,
      h,
    };
  }
  return {
    x: viewW - KILLCAM.width - KILLCAM.margin,
    y: KILLCAM.margin,
    w: KILLCAM.width,
    h: KILLCAM.height,
  };
}

/**
 * 环绕方向与角度说明:
 * - 炮弹飞行方向规范化为回放坐标系中的 +X 轴正方向(从 -X 飞向 +X)。
 * - 相机仰角约 15°，注视点为载具几何中心或弹着点。
 * - 相机起点位于炮弹来向一侧(-X 侧，顺着 +X 方向看)。
 * - 从上往下看(游戏坐标 +Y 轴俯视 X-Z 平面)：
 *   逆时针转 90° 会使相机从 -X 侧转到 +Z 侧(即终点位于炮弹右手侧，朝向车体/炮弹左手侧看)。
 *   若录屏或负责人微调需要转到炮弹左手侧(-Z 侧)，将 KILLCAM_ORBIT_DIRECTION 改为 -1 即可。
 */
export const KILLCAM_ORBIT_DEGREES = 90;
export const KILLCAM_ORBIT_DIRECTION: 1 | -1 = 1;

/** 炮弹从画面外飞到击穿点的时长,秒 */
export const APPROACH = 0.8;
/** 内构淡入时长,秒 */
export const FADE_IN = 0.25;
/** 后效结束后内构淡出时长,秒 */
export const FADE_OUT = 0.4;
/** 后效尾巴时长,秒 */
export const EFFECT_TAIL = 0.4;
/** 回放收尾时长,秒 */
export const FINISH_DELAY = 0.5;

const SEGMENT_COLORS: Record<Segment['kind'], number> = { shell: 0xff3b30, spall: 0xffe066, fragment: 0xff9a2e };

/** 模块种类轮廓颜色(参考 InternalsView.ts) */
export const MODULE_TYPE_COLORS: Record<string, number> = {
  ammo: 0xffaa00, // 弹药架: 橙黄
  engine: 0x33b5e5, // 发动机: 亮蓝
  transmission: 0xab47bc, // 变速箱: 紫色
  fuel: 0xff4081, // 油箱: 玫红
  breech: 0xe0e0e0, // 炮闩: 银灰
  traverse: 0x00e676, // 方向机: 翠绿
  elevation: 0x00e5ff, // 高低机: 青色
  barrel: 0x78909c, // 炮管: 蓝灰
  track: 0x8d6e63, // 履带: 棕褐
};

/** 血量比例 → 颜色(与 WT 的 X 光视图习惯一致:绿 → 黄 → 橙 → 黑,InternalsView 兼容导出) */
export function healthColor(ratio: number): number {
  if (ratio <= 0) return 0x1a1a1a;
  if (ratio < 0.5) return 0xf07b1e;
  if (ratio < 1) return 0xf0d23a;
  return 0x3ecf5a;
}

/**
 * 模块颜色:完好 = 类型色,血量比例 < 1 时按 (1 - 比例) 向红色 0xff3b30 插值,<= 0 = 0x1a1a1a
 */
export function killcamModuleColor(type: string, ratio: number): number {
  if (ratio <= 0) return 0x1a1a1a;
  const baseHex = MODULE_TYPE_COLORS[type] ?? 0xffffff;
  if (ratio >= 1) return baseHex;
  const c = new THREE.Color(baseHex);
  const red = new THREE.Color(0xff3b30);
  c.lerp(red, 1 - ratio);
  return c.getHex();
}

/**
 * 乘员颜色:完好 0x9fb6c7,血量比例 < 1 时向红色 0xff3b30 插值,<= 0 = 0x1a1a1a
 */
export function killcamCrewColor(ratio: number): number {
  if (ratio <= 0) return 0x1a1a1a;
  if (ratio >= 1) return 0x9fb6c7;
  const c = new THREE.Color(0x9fb6c7);
  const red = new THREE.Color(0xff3b30);
  c.lerp(red, 1 - ratio);
  return c.getHex();
}

/**
 * 使 dir 的水平分量转到 +X 所需的绕 y 轴角度(弧度)。
 * 只转水平方向，俯仰保持(车体不倾斜)。
 * 炮弹竖直向下(水平分量接近 0)时取旋转角 0。
 */
export function killcamNormalizeYaw(dir: { x: number; y: number; z: number }): number {
  const len = Math.hypot(dir.x, dir.z);
  if (len < 1e-6) return 0;
  return Math.atan2(dir.z, dir.x);
}

/**
 * 相机环绕角度(弧度,smoothstep 从 0 走到 targetRad)。
 * @param t 当前时间(秒)
 * @param tImpact 接触时刻(秒)
 * @param tEnd 后效播完时刻(秒)
 * @param orbitDeg 目标环绕度数,默认 KILLCAM_ORBIT_DEGREES (90 度)
 */
export function killcamOrbitAngle(
  t: number,
  tImpact: number,
  tEnd: number,
  orbitDeg: number = KILLCAM_ORBIT_DEGREES,
): number {
  const targetRad = THREE.MathUtils.degToRad(orbitDeg);
  if (tEnd <= tImpact) {
    return t >= tImpact ? targetRad : 0;
  }
  if (t <= tImpact) return 0;
  if (t >= tEnd) return targetRad;
  const u = (t - tImpact) / (tEnd - tImpact);
  const s = u * u * (3 - 2 * u);
  return s * targetRad;
}

/**
 * 内构模型透明度包络函数(0..1)。
 * 接触前为 0; 从 tContact 起 fadeIn 秒淡入到 1; 后效结束时刻 tEnd 起 fadeOut 秒淡出到 0。
 */
export function killcamInternalsOpacity(
  t: number,
  tContact: number,
  tEnd: number,
  fadeIn = FADE_IN,
  fadeOut = FADE_OUT,
): number {
  if (t < tContact) return 0;
  if (fadeOut <= 0 ? t >= tEnd : t >= tEnd + fadeOut) return 0;
  if (fadeIn <= 0 ? t >= tContact : t >= tContact + fadeIn) {
    if (t <= tEnd) return 1;
    return fadeOut <= 0 ? 0 : Math.max(0, Math.min(1, 1 - (t - tEnd) / fadeOut));
  }
  const inFactor = fadeIn <= 0 ? 1 : Math.max(0, Math.min(1, (t - tContact) / fadeIn));
  const outFactor = fadeOut <= 0 ? (t >= tEnd ? 0 : 1) : Math.max(0, Math.min(1, 1 - (t - tEnd) / fadeOut));
  return Math.min(inFactor, outFactor);
}

/**
 * 命中回放时长:
 * - 击穿类: tContact = APPROACH, tEffectEnd = APPROACH + duration + EFFECT_TAIL, total = tEffectEnd + FINISH_DELAY
 * - 跳弹 / 未击穿: tContact = APPROACH, tEffectEnd = APPROACH + 1.0, total = tEffectEnd + FINISH_DELAY
 */
export function killcamDuration(replay: HitReplay): { tContact: number; tEffectEnd: number; total: number } {
  const tContact = APPROACH;
  let tEffectEnd: number;
  if (replay.penetration) {
    tEffectEnd = APPROACH + (replay.penetration.duration ?? 0.3) + EFFECT_TAIL;
  } else {
    tEffectEnd = APPROACH + 1.0;
  }
  const total = tEffectEnd + FINISH_DELAY;
  return { tContact, tEffectEnd, total };
}

/**
 * 相机计划:
 * - 击穿类: target = center, distanceScale = 1, orbitDeg = KILLCAM_ORBIT_DEGREES
 * - 跳弹 / 未击穿: target = entry(场景坐标系中的弹着点), distanceScale = 0.75, orbitDeg = KILLCAM_ORBIT_DEGREES / 2
 */
export function killcamCameraRig(
  replay: HitReplay,
  center: THREE.Vector3,
  _radius: number,
  entry: THREE.Vector3,
): { target: THREE.Vector3; distanceScale: number; orbitDeg: number } {
  if (replay.penetration) {
    return {
      target: center.clone(),
      distanceScale: 1,
      orbitDeg: KILLCAM_ORBIT_DEGREES,
    };
  }
  return {
    target: entry.clone(),
    distanceScale: 0.75,
    orbitDeg: KILLCAM_ORBIT_DEGREES / 2,
  };
}

/**
 * 跳弹反射方向: r = d - 2 (d·n) n, 单位化。
 * n 要朝着来弹一侧(d·n > 0 时先取反); 掠射角大时 r 几乎沿原方向, 垂直命中时几乎反向。
 */
export function killcamBounceDir(dir: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 {
  const d = dir.clone().normalize();
  const n = normal.clone().normalize();
  if (d.dot(n) > 0) {
    n.negate();
  }
  const dot = d.dot(n);
  const r = d.sub(n.multiplyScalar(2 * dot));
  return r.normalize();
}

/**
 * 坐姿人形乘员模型(纯几何,无 WebGL 依赖),总高约 1.0 m(坐姿):
 * 头 SphereGeometry(0.11)、躯干 BoxGeometry(0.34, 0.5, 0.22)、
 * 两条大腿 BoxGeometry(0.14, 0.14, 0.45) 向前(-Z)、两条小腿 BoxGeometry(0.12, 0.45, 0.12) 向下;
 * 每个部件一层半透明材质(共用一个材质方便改色) + EdgesGeometry 轮廓线;
 * 颜色:完好 0x9fb6c7(轮廓橙 0xff9a2e), ratio < 1 向红色插值, <= 0 近黑。
 */
export function buildCrewFigure(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'crew-figure';

  const bodyMat = new THREE.MeshBasicMaterial({
    color: 0x9fb6c7,
    transparent: true,
    opacity: 0.9,
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xff9a2e,
    transparent: true,
    opacity: 0.85,
  });

  function addPart(geom: THREE.BufferGeometry, pos: THREE.Vector3, name: string): THREE.Mesh {
    const mesh = new THREE.Mesh(geom, bodyMat);
    mesh.name = name;
    mesh.position.copy(pos);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat);
    mesh.add(edges);
    group.add(mesh);
    return mesh;
  }

  // 躯干 BoxGeometry(0.34, 0.5, 0.22)
  const torsoGeom = new THREE.BoxGeometry(0.34, 0.5, 0.22);
  addPart(torsoGeom, new THREE.Vector3(0, 0, 0), 'torso');

  // 头 SphereGeometry(0.11)
  const headGeom = new THREE.SphereGeometry(0.11, 12, 8);
  addPart(headGeom, new THREE.Vector3(0, 0.36, 0), 'head');

  // 两条大腿 BoxGeometry(0.14, 0.14, 0.45) 向前(-Z)
  const thighGeom = new THREE.BoxGeometry(0.14, 0.14, 0.45);
  addPart(thighGeom, new THREE.Vector3(-0.09, -0.18, -0.335), 'thigh_l');
  addPart(thighGeom, new THREE.Vector3(0.09, -0.18, -0.335), 'thigh_r');

  // 两条小腿 BoxGeometry(0.12, 0.45, 0.12) 向下
  const calfGeom = new THREE.BoxGeometry(0.12, 0.45, 0.12);
  addPart(calfGeom, new THREE.Vector3(-0.09, -0.305, -0.5), 'calf_l');
  addPart(calfGeom, new THREE.Vector3(0.09, -0.305, -0.5), 'calf_r');

  group.userData = { bodyMat, edgeMat };
  return group;
}

/**
 * 命中结果优先级(1..5):
 * ricochet 1 < nopen 2 < penetrated 3 < crew-out 4 < ammo-exploded 5
 */
export function killcamPriority(replay: HitReplay): number {
  if (!replay.armor) {
    return 2; // nopen
  }
  if (replay.armor.ricochet) {
    return 1; // ricochet
  }
  if (!replay.armor.penetrated) {
    return 2; // nopen
  }
  if (replay.detonated) {
    return 5; // ammo-exploded
  }
  const hasCrewKilled =
    replay.layout.crew.some((c) => {
      const b = replay.before[c.id] ?? 1;
      const a = replay.after[c.id] ?? 1;
      return a <= 0 && b > 0;
    }) ||
    (replay.penetration?.hits ?? []).some((h) => h.kind === 'crew' && h.destroyed);
  if (hasCrewKilled) {
    return 4; // crew-out
  }
  return 3; // penetrated
}

/**
 * 按优先级入队:
 * 小窗(corner)队列最多 max 个等待项; 满了就丢掉优先级最低的(同级丢最旧的; 新来的如果是最低就丢新来的)。
 */
export function enqueueByPriority<T extends { replay: HitReplay }>(
  queue: T[],
  item: T,
  max: number,
): T[] {
  if (max <= 0) return queue;
  if (queue.length < max) {
    queue.push(item);
    return queue;
  }
  let minIdx = -1;
  let minPri = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const pri = killcamPriority(queue[i].replay);
    if (pri < minPri) {
      minPri = pri;
      minIdx = i;
    }
  }
  const newPri = killcamPriority(item.replay);
  if (newPri <= minPri) {
    return queue;
  }
  queue.splice(minIdx, 1);
  queue.push(item);
  return queue;
}

/** 计算载具包围盒几何中心(车体 + 炮塔 + 炮管)与包围球半径(车体本地坐标系内) */
export function computeVehicleBounds(
  spec: VehicleSpec,
  turretYaw: number,
  gunPitch: number,
  rootGroup?: THREE.Group,
): { center: THREE.Vector3; radius: number } {
  const box = new THREE.Box3();

  // 1. 车体盒子
  const hw = spec.hull.width / 2;
  const hh = spec.hull.height / 2;
  const hl = spec.hull.length / 2;
  box.expandByPoint(new THREE.Vector3(-hw, -hh, -hl));
  box.expandByPoint(new THREE.Vector3(hw, hh, hl));

  // 2. 炮塔盒子
  const turretOffset = turretRingOffset(spec);
  const th = spec.turret.height;
  const tw = spec.turret.width / 2;
  const tl = spec.turret.length / 2;
  const casemate = isCasemate(spec);
  const yawAngle = casemate ? 0 : turretYaw;
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);

  for (const dx of [-tw, tw]) {
    for (const dy of [0, th]) {
      for (const dz of [-tl, tl]) {
        const pt = new THREE.Vector3(dx, dy, dz).applyQuaternion(yawQuat).add(turretOffset);
        box.expandByPoint(pt);
      }
    }
  }

  // 3. 炮管
  const gunTrunnionLocal = new THREE.Vector3(0, th / 2, -tl);
  const gunTrunnion = gunTrunnionLocal.clone().applyQuaternion(yawQuat).add(turretOffset);
  box.expandByPoint(gunTrunnion);

  const gunQuat = new THREE.Quaternion();
  if (casemate) {
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turretYaw);
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), gunPitch);
    gunQuat.copy(yawQ).multiply(pitchQ);
  } else {
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), gunPitch);
    gunQuat.copy(yawQuat).multiply(pitchQ);
  }
  const barrelDir = new THREE.Vector3(0, 0, -1).applyQuaternion(gunQuat);
  const barrelTip = gunTrunnion.clone().addScaledVector(barrelDir, spec.turret.barrelLength);
  box.expandByPoint(barrelTip);

  // 4. 网格合并
  if (rootGroup) {
    rootGroup.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && o.geometry) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (o.geometry.boundingBox) {
          const meshBox = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
          box.union(meshBox);
        }
      }
    });
  }

  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() * 0.5;
  return { center, radius: Math.max(radius, 1) };
}

interface Part {
  kind: 'module' | 'crew';
  id: string;
  type?: string;
  mesh: THREE.Mesh;
  group?: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  edgeMat?: THREE.LineBasicMaterial;
  /** [回放时刻, 血量比例] 按时间排序 */
  timeline: Array<[number, number]>;
  baseOpacity: number;
  isExternal?: boolean;
}

interface SegmentView {
  seg: Segment;
  line: THREE.Line;
}

interface PlayItem {
  replay: HitReplay;
  opts?: KillCamOptions;
}

/**
 * 命中/击毁回放:
 * - 炮弹飞来向车外真实材质模型飞行
 * - 接触点出现弹着标记(贴装甲面、朝向法线,带两圈扩散圆环)
 * - 跳弹:沿反射方向飞出 0.7s,车身保持真实材质,镜头跟随弹着点
 * - 未击穿:被挡下缩小消失,带闪光球,车身保持真实材质,外挂模块淡入
 * - 击穿:车体 0.2s 褪成半透明灰壳+轮廓线,内构/乘员人形淡入并按受损变色,车内弹道/破片/殉爆呈现
 */
export class KillCam {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, KILLCAM.width / KILLCAM.height, 0.05, 100);
  private root: THREE.Group | null = null;
  private replay: HitReplay | null = null;
  private currentOpts?: KillCamOptions;
  private startMs = 0;
  private duration = 0;
  private tContact = APPROACH;
  private tEffectEnd = 0;
  private worldCenter = new THREE.Vector3();
  private worldEntry = new THREE.Vector3();
  private boundingRadius = 1;
  private parts: Part[] = [];
  private segments: SegmentView[] = [];
  private shell: THREE.Group | null = null;
  private trail: THREE.Line | null = null;
  private flash: THREE.Mesh | null = null;
  private blast: THREE.Mesh | null = null;
  private markDisc: THREE.Mesh | null = null;
  private markRing1: THREE.Mesh | null = null;
  private markRing2: THREE.Mesh | null = null;
  private hullMaterials: THREE.Material[] = [];
  private shellMaterials: THREE.Material[] = [];
  private edgeMaterial: THREE.LineBasicMaterial | null = null;
  private readonly queue: PlayItem[] = [];
  private readonly frame: HTMLDivElement;
  private readonly caption: HTMLDivElement;
  private readonly overlay: KillCamOverlay;

  constructor(private readonly parent: HTMLElement) {
    this.scene.background = new THREE.Color(0x0d1116);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(-2, 4, -3);
    this.scene.add(dirLight);

    this.frame = document.createElement('div');
    Object.assign(this.frame.style, {
      position: 'fixed',
      border: '1px solid rgba(255,255,255,.35)',
      borderRadius: '4px',
      pointerEvents: 'none',
      display: 'none',
      color: '#f2f2f2',
      textShadow: '0 1px 2px #000',
      zIndex: '6',
    });
    this.caption = document.createElement('div');
    Object.assign(this.caption.style, { position: 'absolute', pointerEvents: 'none' });
    this.frame.appendChild(this.caption);
    this.overlay = new KillCamOverlay(this.frame);
    parent.appendChild(this.frame);
  }

  get active(): boolean {
    return this.replay !== null;
  }

  get layout(): KillCamLayout {
    return this.currentOpts?.layout ?? 'corner';
  }

  /** 排队播放一段回放 */
  play(replay: HitReplay, opts?: KillCamOptions): void {
    const item: PlayItem = { replay, opts };
    if (opts?.layout === 'full') {
      this.queue.length = 0;
      this.startItem(item, performance.now());
      return;
    }
    if (!this.replay) {
      this.startItem(item, performance.now());
    } else {
      enqueueByPriority(this.queue, item, 2);
    }
  }

  /** 清空队列并停止当前回放(离开战斗时) */
  stop(): void {
    this.queue.length = 0;
    this.clear();
    this.replay = null;
    this.currentOpts = undefined;
    this.updateFrame();
  }

  update(nowMs: number): void {
    if (!this.replay) return;
    const t = (nowMs - this.startMs) / 1000;
    if (t > this.duration) {
      this.next(nowMs);
      return;
    }
    this.animate(t);
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (!this.replay) return;
    try {
      const size = renderer.getSize(new THREE.Vector2());
      if (!size || size.x <= 0 || size.y <= 0) return;
      const rect = killcamRect(this.layout, size.x, size.y);
      const x = rect.x;
      const y = size.y - rect.h - rect.y;
      renderer.setScissorTest(true);
      renderer.setScissor(x, y, rect.w, rect.h);
      renderer.setViewport(x, y, rect.w, rect.h);
      this.camera.aspect = rect.w / rect.h;
      this.camera.updateProjectionMatrix();
      renderer.render(this.scene, this.camera);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, size.x, size.y);
    } catch {
      // jsdom 或上下文缺失保护
    }
  }

  private startItem(item: PlayItem, nowMs: number): void {
    this.clear();
    this.replay = item.replay;
    this.currentOpts = item.opts;
    const timing = killcamDuration(item.replay);
    this.tContact = timing.tContact;
    this.tEffectEnd = timing.tEffectEnd;
    this.duration = timing.total;
    this.updateFrame();
    this.build(item.replay);
    this.startMs = nowMs;
    this.caption.innerHTML = describe(item.replay, item.opts?.title);
    this.overlay.show(item.replay);
  }

  private next(nowMs: number): void {
    const item = this.queue.shift() ?? null;
    if (!item) {
      this.clear();
      this.replay = null;
      this.currentOpts = undefined;
      this.updateFrame();
      return;
    }
    this.startItem(item, nowMs);
  }

  private updateFrame(): void {
    const active = this.active;
    this.frame.style.display = active ? 'block' : 'none';
    if (this.parent) {
      this.parent.classList.toggle('killcam-full', active && this.layout === 'full');
    }
    if (!active) return;
    const isFull = this.layout === 'full';
    const rect = killcamRect(this.layout, window.innerWidth, window.innerHeight);
    this.frame.style.left = `${rect.x}px`;
    this.frame.style.top = `${rect.y}px`;
    this.frame.style.width = `${rect.w}px`;
    this.frame.style.height = `${rect.h}px`;
    this.frame.style.right = 'auto';
    this.frame.style.font = isFull
      ? '14px/1.5 system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'
      : '12px/1.4 system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
    this.caption.style.position = 'absolute';
    this.caption.style.left = isFull ? '12px' : '8px';
    this.caption.style.top = isFull ? '10px' : '6px';
    this.caption.style.right = 'auto';
    this.caption.style.maxWidth = '60%';
    this.caption.style.fontSize = '12px';
    this.caption.style.lineHeight = '1.4';
    this.caption.style.opacity = '0.85';
    if (rect.w > 0 && rect.h > 0) {
      this.camera.aspect = rect.w / rect.h;
      this.camera.updateProjectionMatrix();
    }
  }

  private clear(): void {
    if (this.root) {
      this.scene.remove(this.root);
      const mats = new Set<THREE.Material>();
      this.root.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) {
            m.forEach((mat) => mats.add(mat));
          } else if (m) {
            mats.add(m);
          }
        }
      });
      mats.forEach((m) => m.dispose());
    }
    for (const m of this.hullMaterials) m.dispose();
    this.hullMaterials = [];
    for (const m of this.shellMaterials) m.dispose();
    this.shellMaterials = [];
    if (this.edgeMaterial) {
      this.edgeMaterial.dispose();
      this.edgeMaterial = null;
    }
    this.overlay?.hide();
    this.root = null;
    this.parts = [];
    this.segments = [];
    this.shell = null;
    this.trail = null;
    this.flash = null;
    this.blast = null;
    this.markDisc = null;
    this.markRing1 = null;
    this.markRing2 = null;
  }

  private build(r: HitReplay): void {
    const root = new THREE.Group();
    const { turret } = r.spec;
    const turretPivot = new THREE.Group();
    const gunPivot = new THREE.Group();
    turretPivot.position.copy(turretRingOffset(r.spec));
    gunPivot.position.set(0, turret.height / 2, -turret.length / 2);
    root.add(turretPivot);
    turretPivot.add(gunPivot);
    applyGunPose(r.spec, { turretPivot, gunPivot }, r.turretYaw, r.gunPitch);

    // 真实外壳材质克隆 + 轮廓线 (EDGE 同步淡入)
    this.edgeMaterial = new THREE.LineBasicMaterial({ color: 0xb7c4cf, transparent: true, opacity: 0 });
    const temp = buildVehicleModel(r.spec, { root, turretPivot, gunPivot });
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const origMat = o.material as THREE.Material;
        const cloned = origMat.clone();
        cloned.transparent = true;
        cloned.opacity = 1.0;
        o.material = cloned;
        o.castShadow = false;
        this.hullMaterials.push(cloned);
        if (!(o instanceof THREE.InstancedMesh)) {
          o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), this.edgeMaterial!));
        }
      }
    });
    temp.materials.forEach((m) => m.dispose());

    // 计算车体在本地坐标系下的几何中心和包围球半径
    root.updateWorldMatrix(true, true);
    const bounds = computeVehicleBounds(r.spec, r.turretYaw, r.gunPitch, root);
    this.boundingRadius = bounds.radius;

    // 弹道水平分量规范化为 +X：计算绕 Y 轴旋转角并赋给 root
    const yaw = killcamNormalizeYaw(r.dir);
    root.rotation.y = yaw;

    // 场景坐标系中的几何中心与弹着点
    this.worldCenter.copy(bounds.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.worldEntry.copy(r.entry).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const frameOf = (part: string) => (part === 'turret' ? turretPivot : part === 'gun' ? gunPivot : root);
    const timelineFor = (id: string): Array<[number, number]> => {
      const tl: Array<[number, number]> = [[-1, r.before[id] ?? 1]];
      for (const e of r.external) if (e.id === id) tl.push([APPROACH, e.hpAfter / e.maxHp]);
      for (const h of r.penetration?.hits ?? []) if (h.id === id) tl.push([APPROACH + h.time, h.hpAfter / h.maxHp]);
      tl.push([APPROACH + (r.penetration?.duration ?? 0) + 0.05, r.after[id] ?? 1]);
      return tl.sort((a, b) => a[0] - b[0]);
    };

    const externalIds = new Set(r.external.map((e) => e.id));

    // 内构模块盒子
    for (const m of r.layout.modules) {
      const baseOpacity = m.type === 'track' || m.type === 'barrel' ? 0.35 : 0.8;
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(m.size[0], m.size[1], m.size[2]), mat);
      mesh.position.set(m.center[0], m.center[1], m.center[2]);
      frameOf(m.part).add(mesh);
      this.parts.push({
        kind: 'module',
        id: m.id,
        type: m.type,
        mesh,
        mat,
        timeline: timelineFor(m.id),
        baseOpacity,
        isExternal: externalIds.has(m.id),
      });
    }

    // 乘员坐姿人形
    for (const c of r.layout.crew) {
      const baseOpacity = 0.9;
      const fig = buildCrewFigure();
      fig.position.set(c.center[0], c.center[1], c.center[2]);
      frameOf(c.part).add(fig);
      const torsoMesh = (fig.getObjectByName('torso') as THREE.Mesh) ?? (fig.children[0] as THREE.Mesh);
      const { bodyMat, edgeMat } = fig.userData as {
        bodyMat: THREE.MeshBasicMaterial;
        edgeMat: THREE.LineBasicMaterial;
      };
      bodyMat.opacity = 0;
      edgeMat.opacity = 0;
      fig.visible = false;
      this.parts.push({
        kind: 'crew',
        id: c.id,
        mesh: torsoMesh,
        group: fig,
        mat: bodyMat,
        edgeMat,
        timeline: timelineFor(c.id),
        baseOpacity,
      });
    }

    // 车内轨迹(车体本地坐标)
    for (const seg of r.penetration?.segments ?? []) {
      const geo = new THREE.BufferGeometry().setFromPoints([seg.from, seg.from.clone()]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: SEGMENT_COLORS[seg.kind], transparent: true, opacity: 0 }));
      line.visible = false;
      root.add(line);
      this.segments.push({ seg, line });
    }

    // 弹着标记: CircleGeometry + 两个 RingGeometry, 橙色 0xffa000
    const caliber = r.shell?.caliber ?? 75;
    const markRadius = Math.max(0.2, (caliber / 1000) * 3);
    const markGroup = new THREE.Group();
    markGroup.name = 'impact-mark';
    const normal = r.normal ? r.normal.clone().normalize() : new THREE.Vector3(0, 0, 1);
    if (normal.lengthSq() < 1e-4) normal.set(0, 0, 1);
    const markPos = r.entry.clone().addScaledVector(normal, 0.03);
    markGroup.position.copy(markPos);
    markGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    const discGeo = new THREE.CircleGeometry(markRadius, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xffa000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.markDisc = new THREE.Mesh(discGeo, discMat);
    this.markDisc.visible = false;
    markGroup.add(this.markDisc);

    const ringGeo1 = new THREE.RingGeometry(markRadius * 0.88, markRadius, 32);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0xffa000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.markRing1 = new THREE.Mesh(ringGeo1, ringMat1);
    this.markRing1.visible = false;
    markGroup.add(this.markRing1);

    const ringGeo2 = new THREE.RingGeometry(markRadius * 0.88, markRadius, 32);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xffa000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.markRing2 = new THREE.Mesh(ringGeo2, ringMat2);
    this.markRing2.visible = false;
    markGroup.add(this.markRing2);

    root.add(markGroup);

    // 炮弹实体模型:放大系数 boundingRadius * 0.12, 最小 2.5
    const shellScale = Math.max(2.5, this.boundingRadius * 0.12);
    this.shell = buildShellModel(r.shell);
    this.shell.scale.setScalar(shellScale);
    this.shell.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.dir);
    this.shell.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const sm = (o.material as THREE.Material).clone();
        sm.transparent = true;
        o.material = sm;
        this.shellMaterials.push(sm);
      }
    });
    root.add(this.shell);

    // 细线拖尾 (THREE.Line, 最近 0.4s, 颜色 0xffd9a0)
    const trailPoints = 16;
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(trailPoints * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trailMat = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.8 });
    this.trail = new THREE.Line(trailGeo, trailMat);
    this.trail.visible = false;
    root.add(this.trail);

    // 闪光球
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }),
    );
    this.flash.position.copy(r.entry);
    this.flash.visible = false;
    root.add(this.flash);

    // 爆炸球(仅击穿爆炸)
    if (r.penetration?.explosion) {
      this.blast = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, depthWrite: false }),
      );
      this.blast.position.copy(r.penetration.explosion.center);
      this.blast.visible = false;
      root.add(this.blast);
    }

    this.root = root;
    this.scene.add(root);
    this.animate(0);
  }

  private getShellPosition(
    tau: number,
    r: HitReplay,
    isRicochet: boolean,
    bounceDir: THREE.Vector3,
    bounceSpeed: number,
    isNopen: boolean,
  ): THREE.Vector3 | null {
    if (tau < APPROACH) {
      return r.entry.clone().addScaledVector(r.dir, -6 * (1 - tau / APPROACH));
    }
    if (isRicochet) {
      const dt = tau - APPROACH;
      if (dt <= 0.7) {
        return r.entry.clone().addScaledVector(bounceDir, bounceSpeed * dt);
      }
      return null;
    }
    if (isNopen) {
      const dt = tau - APPROACH;
      if (dt <= 0.25) {
        return r.entry.clone();
      }
      return null;
    }
    // Penetration
    const shellSeg = r.penetration?.segments.find((s) => s.kind === 'shell');
    if (shellSeg && tau <= APPROACH + shellSeg.t1) {
      const k = THREE.MathUtils.clamp((tau - APPROACH - shellSeg.t0) / Math.max(1e-3, shellSeg.t1 - shellSeg.t0), 0, 1);
      return shellSeg.from.clone().lerp(shellSeg.to, k);
    }
    return null;
  }

  private animate(t: number): void {
    const r = this.replay!;
    const opacityEnv = killcamInternalsOpacity(t, this.tContact, this.tEffectEnd);
    const isPenetrated = Boolean(r.penetration);
    const isRicochet = Boolean(r.armor?.ricochet);
    const isNopen = !isPenetrated && !isRicochet;

    const baseShellScale = Math.max(2.5, this.boundingRadius * 0.12);
    const bounceDir = isRicochet ? killcamBounceDir(r.dir, r.normal) : new THREE.Vector3();
    const bounceSpeed = this.boundingRadius * 1.5;

    // 1. 真实外壳 → 灰壳 (仅击穿类在接触后 0.2s 内褪成 0.08 并淡入轮廓线; 跳弹/未击穿保持真实外壳)
    let hullOpacity = 1.0;
    let edgeOpacity = 0.0;
    if (isPenetrated) {
      if (t < APPROACH) {
        hullOpacity = 1.0;
        edgeOpacity = 0.0;
      } else if (t < APPROACH + 0.2) {
        const k = (t - APPROACH) / 0.2;
        hullOpacity = THREE.MathUtils.lerp(1.0, 0.08, k);
        edgeOpacity = THREE.MathUtils.lerp(0.0, 0.35, k);
      } else {
        hullOpacity = 0.08;
        edgeOpacity = 0.35;
      }
    }
    for (const m of this.hullMaterials) {
      m.opacity = hullOpacity;
    }
    if (this.edgeMaterial) {
      this.edgeMaterial.opacity = edgeOpacity;
    }

    // 2. 弹着标记: 接触起 0.6 s 内圆盘不透明度 0.55 → 0、圆环半径 1 → 2.2 倍并淡出
    if (this.markDisc && this.markRing1 && this.markRing2) {
      const dt = t - APPROACH;
      if (dt >= 0 && dt <= 0.6) {
        const kDisc = dt / 0.6;
        this.markDisc.visible = true;
        (this.markDisc.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - kDisc);

        const kRing1 = Math.min(1, dt / 0.5);
        this.markRing1.visible = true;
        const s1 = 1 + 1.2 * kRing1;
        this.markRing1.scale.set(s1, s1, 1);
        (this.markRing1.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - kRing1);

        if (dt >= 0.12) {
          const kRing2 = Math.min(1, (dt - 0.12) / 0.48);
          this.markRing2.visible = true;
          const s2 = 1 + 1.2 * kRing2;
          this.markRing2.scale.set(s2, s2, 1);
          (this.markRing2.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - kRing2);
        } else {
          this.markRing2.visible = false;
        }
      } else {
        this.markDisc.visible = false;
        this.markRing1.visible = false;
        this.markRing2.visible = false;
      }
    }

    // 3. 炮弹飞行轨迹与模型
    let shellVisible = false;
    let shellOpacity = 1.0;
    if (this.shell) {
      if (t < APPROACH) {
        shellVisible = true;
        this.shell.position.copy(r.entry).addScaledVector(r.dir, -6 * (1 - t / APPROACH));
        this.shell.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.dir);
        this.shell.scale.setScalar(baseShellScale);
      } else if (isRicochet) {
        const dt = t - APPROACH;
        if (dt <= 0.7) {
          shellVisible = true;
          this.shell.position.copy(r.entry).addScaledVector(bounceDir, bounceSpeed * dt);
          this.shell.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bounceDir);
          this.shell.scale.setScalar(baseShellScale);
          if (dt > 0.4) {
            shellOpacity = Math.max(0, 1 - (dt - 0.4) / 0.3);
          }
        }
      } else if (isNopen) {
        const dt = t - APPROACH;
        if (dt <= 0.25) {
          shellVisible = true;
          this.shell.position.copy(r.entry);
          this.shell.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.dir);
          const sc = baseShellScale * Math.max(0, 1 - dt / 0.25);
          this.shell.scale.setScalar(sc);
        }
      } else {
        // 击穿类
        const shellSeg = r.penetration?.segments.find((s) => s.kind === 'shell');
        if (shellSeg && t < APPROACH + shellSeg.t1) {
          const k = (t - APPROACH - shellSeg.t0) / Math.max(1e-3, shellSeg.t1 - shellSeg.t0);
          this.shell.position.lerpVectors(shellSeg.from, shellSeg.to, THREE.MathUtils.clamp(k, 0, 1));
          this.shell.scale.setScalar(baseShellScale);
          shellVisible = true;
        }
      }

      this.shell.visible = shellVisible;
      for (const mat of this.shellMaterials) {
        mat.opacity = shellOpacity;
      }
    }

    // 4. 细线拖尾 (最近 0.4 s)
    if (this.trail) {
      if (shellVisible) {
        const t0 = Math.max(0, t - 0.4);
        const t1 = t;
        const numPoints = 16;
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i < numPoints; i++) {
          const tau = t0 + (t1 - t0) * (i / (numPoints - 1));
          const pos = this.getShellPosition(tau, r, isRicochet, bounceDir, bounceSpeed, isNopen);
          if (pos) pts.push(pos);
        }
        if (pts.length >= 2) {
          const posAttr = this.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < numPoints; i++) {
            const pIdx = Math.min(pts.length - 1, Math.floor((i * (pts.length - 1)) / (numPoints - 1)));
            const pt = pts[pIdx];
            posAttr.setXYZ(i, pt.x, pt.y, pt.z);
          }
          posAttr.needsUpdate = true;
          this.trail.visible = true;
          (this.trail.material as THREE.LineBasicMaterial).opacity = shellOpacity * 0.8;
        } else {
          this.trail.visible = false;
        }
      } else {
        this.trail.visible = false;
      }
    }

    // 5. 闪光球
    if (this.flash) {
      if (isNopen) {
        const dt = t - APPROACH;
        if (dt >= 0 && dt <= 0.25) {
          const k = dt / 0.25;
          this.flash.visible = true;
          const mat = this.flash.material as THREE.MeshBasicMaterial;
          mat.opacity = 1 - k;
          this.flash.scale.setScalar(1 + k * 1.5);
        } else {
          this.flash.visible = false;
        }
      } else if (isPenetrated) {
        const k = (t - APPROACH) / 0.35;
        const flashBase = k >= 0 && k <= 1 ? 1 - k : 0;
        const mat = this.flash.material as THREE.MeshBasicMaterial;
        mat.opacity = flashBase * opacityEnv;
        this.flash.visible = mat.opacity > 0;
        this.flash.scale.setScalar(1 + Math.max(0, k) * 2);
      } else {
        this.flash.visible = false;
      }
    }

    // 6. 破片/破甲线
    for (const { seg, line } of this.segments) {
      const k = THREE.MathUtils.clamp((t - APPROACH - seg.t0) / Math.max(1e-3, seg.t1 - seg.t0), 0, 1);
      const end = seg.from.clone().lerp(seg.to, k);
      const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(1, end.x, end.y, end.z);
      pos.needsUpdate = true;
      const active = t >= APPROACH + seg.t0;
      line.visible = active && opacityEnv > 0;
      (line.material as THREE.LineBasicMaterial).opacity = opacityEnv;
    }

    // 7. 爆炸球
    if (this.blast && r.penetration?.explosion) {
      const e = r.penetration.explosion;
      const k = (t - APPROACH - e.time) / 0.4;
      const blastBase = k >= 0 && k <= 1 ? 0.55 * (1 - k) : 0;
      const mat = this.blast.material as THREE.MeshBasicMaterial;
      mat.opacity = blastBase * opacityEnv;
      this.blast.visible = mat.opacity > 0;
      this.blast.scale.setScalar(e.radius * THREE.MathUtils.clamp(0.2 + k, 0.2, 1));
    }

    // 8. 模块与乘员: 跳弹/未击穿只显示受损的外挂模块; 击穿显示全部内构与坐姿乘员
    for (const p of this.parts) {
      let ratio = p.timeline[0][1];
      for (const [time, value] of p.timeline) if (t >= time) ratio = value;

      if (p.kind === 'crew') {
        p.mat.color.setHex(killcamCrewColor(ratio));
        const show = Boolean(isPenetrated && opacityEnv > 0);
        p.mat.opacity = show ? p.baseOpacity * opacityEnv : 0;
        if (p.edgeMat) p.edgeMat.opacity = show ? 0.85 * opacityEnv : 0;
        if (p.group) p.group.visible = show;
        p.mesh.visible = show;
      } else {
        p.mat.color.setHex(killcamModuleColor(p.type ?? '', ratio));
        const show = Boolean((isPenetrated || p.isExternal) && opacityEnv > 0);
        p.mat.opacity = show ? p.baseOpacity * opacityEnv : 0;
        p.mesh.visible = show;
      }
    }

    // 9. 相机环绕
    const rig = killcamCameraRig(r, this.worldCenter, this.boundingRadius, this.worldEntry);
    const aspect = this.camera.aspect || (KILLCAM.width / KILLCAM.height);
    const halfFovY = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfFovX = Math.atan(Math.tan(halfFovY) * aspect);
    const minSinFov = Math.min(Math.sin(halfFovY), Math.sin(halfFovX));
    const distance = ((this.boundingRadius * 1.15) / minSinFov) * rig.distanceScale;
    const ELEVATION_RAD = THREE.MathUtils.degToRad(15);
    const startCamOffset = new THREE.Vector3(-Math.cos(ELEVATION_RAD) * distance, Math.sin(ELEVATION_RAD) * distance, 0);

    const angle = killcamOrbitAngle(t, this.tContact, this.tEffectEnd, rig.orbitDeg);
    const offset = startCamOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle * KILLCAM_ORBIT_DIRECTION);
    this.camera.position.copy(rig.target).add(offset);
    this.camera.lookAt(rig.target);

    // 10. 文字与图标覆盖层
    this.overlay.update(t, this.tContact);
  }
}

/** 回放标题与结果摘要 */
function describe(r: HitReplay, titleOverride?: string): string {
  const title = titleOverride ?? `击毁回放 · ${r.spec.name}`;
  const lines: string[] = [`<b>${title}</b>`];
  if (r.armor) {
    const eff = Math.round(r.armor.effectiveArmor);
    const pen = Math.round(r.armor.penetration);
    const angle = Math.round(r.armor.angleDeg);
    lines.push(`等效装甲 ${eff} mm / 穿深 ${pen} mm / 入射角 ${angle}°`);
  }
  const killed = (r.penetration?.hits ?? []).filter((h) => h.kind === 'crew' && h.destroyed).map((h) => h.name);
  const broken = (r.penetration?.hits ?? []).filter((h) => h.kind === 'module' && h.destroyed).map((h) => h.name);
  if (killed.length) lines.push(`阵亡:${killed.join('、')}`);
  if (broken.length) lines.push(`损坏:${[...new Set(broken)].join('、')}`);
  if (r.detonated) lines.push('<span style="color:#ff8a2a">弹药殉爆</span>');
  return lines.join('<br>');
}
