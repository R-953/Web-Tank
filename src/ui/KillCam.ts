import * as THREE from 'three';
import type { HitReplay } from '../game/Game';
import { applyGunPose, buildVehicleModel } from '../game/models';
import { buildShellModel } from '../game/models/shell';
import type { Segment } from '../game/damage/penetration';
import { turretRingOffset } from '../game/damage/geometry';
import { isCasemate } from '../game/casemate';
import type { VehicleSpec } from '../data/types';

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
 * - 相机仰角约 15°，注视点为载具几何中心。
 * - 相机起点位于炮弹来向一侧(-X 侧，顺着 +X 方向看)。
 * - 从上往下看(游戏坐标 +Y 轴俯视 X-Z 平面)：
 *   逆时针转 90° 会使相机从 -X 侧转到 +Z 侧(即终点位于炮弹右手侧，朝向车体/炮弹左手侧看)。
 *   若录屏或负责人微调需要转到炮弹左手侧(-Z 侧)，将 KILLCAM_ORBIT_DIRECTION 改为 -1 即可。
 */
export const KILLCAM_ORBIT_DEGREES = 90;
export const KILLCAM_ORBIT_DIRECTION: 1 | -1 = 1;

/** 炮弹从画面外飞到击穿点的时长,秒 */
const APPROACH = 0.8;
/** 内构淡入时长,秒 */
const FADE_IN = 0.25;
/** 后效结束后内构淡出时长,秒 */
const FADE_OUT = 0.4;
/** 后效尾巴时长,秒 */
const EFFECT_TAIL = 0.4;
/** 回放收尾时长,秒 */
const FINISH_DELAY = 0.5;

const GHOST = new THREE.MeshBasicMaterial({ color: 0x8fa0ae, transparent: true, opacity: 0.08, depthWrite: false });
const EDGE = new THREE.LineBasicMaterial({ color: 0xb7c4cf, transparent: true, opacity: 0.35 });
const SEGMENT_COLORS: Record<Segment['kind'], number> = { shell: 0xff3b30, spall: 0xffe066, fragment: 0xff9a2e };

/** 血量比例 → 颜色(与 WT 的 X 光视图习惯一致:绿 → 黄 → 橙 → 黑) */
export function healthColor(ratio: number): number {
  if (ratio <= 0) return 0x1a1a1a;
  if (ratio < 0.5) return 0xf07b1e;
  if (ratio < 1) return 0xf0d23a;
  return 0x3ecf5a;
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
 * @param t 当前时间(秒)
 * @param tContact 接触时刻(秒)
 * @param tEnd 后效播完时刻(秒)
 * @param fadeIn 淡入时长(秒),默认 0.25
 * @param fadeOut 淡出时长(秒),默认 0.4
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

/** 计算载具包围盒几何中心(车体 + 炮塔 + 炮管)与包围球半径(车体本地坐标系内) */
function computeVehicleBounds(
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
  mesh: THREE.Mesh;
  /** [回放时刻, 血量比例] 按时间排序 */
  timeline: Array<[number, number]>;
  baseOpacity: number;
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
 * 命中/击毁回放:X 光视角「炮弹飞来 → 击穿 → 车内破片/爆炸 → 模块与乘员变色」。
 * 炮弹方向规范化为 +X，相机仰角 15° 逆时针环绕 90°，内构接触淡入、后效衰减淡出。
 */
export class KillCam {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, KILLCAM.width / KILLCAM.height, 0.05, 100);
  private root: THREE.Group | null = null;
  private replay: HitReplay | null = null;
  private currentOpts?: KillCamOptions;
  private startMs = 0;
  private duration = 0;
  private tEffectEnd = 0;
  private worldCenter = new THREE.Vector3();
  private boundingRadius = 1;
  private parts: Part[] = [];
  private segments: SegmentView[] = [];
  private shell: THREE.Group | null = null;
  private flash: THREE.Mesh | null = null;
  private blast: THREE.Mesh | null = null;
  private readonly queue: PlayItem[] = [];
  private readonly frame: HTMLDivElement;
  private readonly caption: HTMLDivElement;

  constructor(private readonly parent: HTMLElement) {
    this.scene.background = new THREE.Color(0x0d1116);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
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
    Object.assign(this.caption.style, { position: 'absolute' });
    this.frame.appendChild(this.caption);
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
      this.queue.push(item);
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
    const size = renderer.getSize(new THREE.Vector2());
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
  }

  private startItem(item: PlayItem, nowMs: number): void {
    this.clear();
    this.replay = item.replay;
    this.currentOpts = item.opts;
    const effectDuration = item.replay.penetration?.duration ?? 0.3;
    this.tEffectEnd = APPROACH + effectDuration + EFFECT_TAIL;
    this.duration = this.tEffectEnd + FINISH_DELAY;
    this.updateFrame();
    this.build(item.replay);
    this.startMs = nowMs;
    this.caption.innerHTML = describe(item.replay, item.opts?.title);
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
    this.caption.style.left = isFull ? '14px' : '8px';
    this.caption.style.right = isFull ? '14px' : '8px';
    this.caption.style.top = isFull ? '10px' : '6px';
    if (rect.w > 0 && rect.h > 0) {
      this.camera.aspect = rect.w / rect.h;
      this.camera.updateProjectionMatrix();
    }
  }

  private clear(): void {
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const m = o.material as THREE.Material;
          if (m !== GHOST && m !== EDGE) m.dispose();
        }
      });
    }
    this.root = null;
    this.parts = [];
    this.segments = [];
    this.shell = null;
    this.flash = null;
    this.blast = null;
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

    // 半透明外壳 + 轮廓线
    const temp = buildVehicleModel(r.spec, { root, turretPivot, gunPivot });
    temp.materials.forEach((m) => m.dispose());
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = GHOST;
        o.castShadow = false;
        // 车轮 / 履带板是 InstancedMesh,轮廓线画不到实例的位置上,跳过
        if (!(o instanceof THREE.InstancedMesh)) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), EDGE));
      }
    });

    // 计算车体在本地坐标系下的几何中心和包围球半径
    root.updateWorldMatrix(true, true);
    const bounds = computeVehicleBounds(r.spec, r.turretYaw, r.gunPitch, root);
    this.boundingRadius = bounds.radius;

    // 弹道水平分量规范化为 +X：计算绕 Y 轴旋转角并赋给 root
    const yaw = killcamNormalizeYaw(r.dir);
    root.rotation.y = yaw;

    // 场景坐标系中的几何中心
    this.worldCenter.copy(bounds.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const frameOf = (part: string) => (part === 'turret' ? turretPivot : part === 'gun' ? gunPivot : root);
    const timelineFor = (id: string): Array<[number, number]> => {
      const tl: Array<[number, number]> = [[-1, r.before[id] ?? 1]];
      for (const e of r.external) if (e.id === id) tl.push([APPROACH, e.hpAfter / e.maxHp]);
      for (const h of r.penetration?.hits ?? []) if (h.id === id) tl.push([APPROACH + h.time, h.hpAfter / h.maxHp]);
      tl.push([APPROACH + (r.penetration?.duration ?? 0) + 0.05, r.after[id] ?? 1]);
      return tl.sort((a, b) => a[0] - b[0]);
    };

    for (const m of r.layout.modules) {
      const baseOpacity = m.type === 'track' || m.type === 'barrel' ? 0.35 : 0.8;
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(m.size[0], m.size[1], m.size[2]), mat);
      mesh.position.set(m.center[0], m.center[1], m.center[2]);
      frameOf(m.part).add(mesh);
      this.parts.push({ mesh, timeline: timelineFor(m.id), baseOpacity });
    }
    for (const c of r.layout.crew) {
      const baseOpacity = 0.9;
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 4, 8), mat);
      mesh.position.set(c.center[0], c.center[1], c.center[2]);
      frameOf(c.part).add(mesh);
      this.parts.push({ mesh, timeline: timelineFor(c.id), baseOpacity });
    }

    // 车内轨迹(车体坐标)
    for (const seg of r.penetration?.segments ?? []) {
      const geo = new THREE.BufferGeometry().setFromPoints([seg.from, seg.from.clone()]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: SEGMENT_COLORS[seg.kind], transparent: true, opacity: 0 }));
      line.visible = false;
      root.add(line);
      this.segments.push({ seg, line });
    }

    // 炮弹实体模型
    this.shell = buildShellModel(r.shell);
    this.shell.scale.setScalar(2.5); // 小窗口里放大一点才看得清
    this.shell.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.dir);
    root.add(this.shell);

    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }),
    );
    this.flash.position.copy(r.entry);
    this.flash.visible = false;
    root.add(this.flash);

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

  private animate(t: number): void {
    const r = this.replay!;
    const opacityEnv = killcamInternalsOpacity(t, APPROACH, this.tEffectEnd);

    // 炮弹:接近阶段在车外飞行,之后沿车内弹道慢速前进
    const shellSeg = r.penetration?.segments.find((s) => s.kind === 'shell');
    if (this.shell) {
      if (t < APPROACH) {
        this.shell.visible = true;
        this.shell.position.copy(r.entry).addScaledVector(r.dir, -6 * (1 - t / APPROACH));
      } else if (shellSeg && t < APPROACH + shellSeg.t1) {
        const k = (t - APPROACH - shellSeg.t0) / Math.max(1e-3, shellSeg.t1 - shellSeg.t0);
        this.shell.position.lerpVectors(shellSeg.from, shellSeg.to, THREE.MathUtils.clamp(k, 0, 1));
        this.shell.visible = true;
      } else {
        this.shell.visible = false;
      }
    }

    // 击穿闪光
    if (this.flash) {
      const k = (t - APPROACH) / 0.35;
      const flashBase = k >= 0 && k <= 1 ? 1 - k : 0;
      const mat = this.flash.material as THREE.MeshBasicMaterial;
      mat.opacity = flashBase * opacityEnv;
      this.flash.visible = mat.opacity > 0;
      this.flash.scale.setScalar(1 + Math.max(0, k) * 2);
    }

    // 破片/破甲线
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

    // 爆炸球
    if (this.blast && r.penetration?.explosion) {
      const e = r.penetration.explosion;
      const k = (t - APPROACH - e.time) / 0.4;
      const blastBase = k >= 0 && k <= 1 ? 0.55 * (1 - k) : 0;
      const mat = this.blast.material as THREE.MeshBasicMaterial;
      mat.opacity = blastBase * opacityEnv;
      this.blast.visible = mat.opacity > 0;
      this.blast.scale.setScalar(e.radius * THREE.MathUtils.clamp(0.2 + k, 0.2, 1));
    }

    // 模块与乘员受损与透明度
    for (const p of this.parts) {
      let ratio = p.timeline[0][1];
      for (const [time, value] of p.timeline) if (t >= time) ratio = value;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(healthColor(ratio));
      mat.opacity = p.baseOpacity * opacityEnv;
      p.mesh.visible = opacityEnv > 0;
    }

    // 相机:以载具几何中心为原点，仰角 15°，入射时从 -X 侧顺着 +X 看，逆时针环绕 90° 到 +Z 侧
    const aspect = this.camera.aspect || (KILLCAM.width / KILLCAM.height);
    const halfFovY = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfFovX = Math.atan(Math.tan(halfFovY) * aspect);
    const minSinFov = Math.min(Math.sin(halfFovY), Math.sin(halfFovX));
    const distance = (this.boundingRadius * 1.15) / minSinFov;
    const ELEVATION_RAD = THREE.MathUtils.degToRad(15);
    const startCamOffset = new THREE.Vector3(-Math.cos(ELEVATION_RAD) * distance, Math.sin(ELEVATION_RAD) * distance, 0);

    const angle = killcamOrbitAngle(t, APPROACH, this.tEffectEnd);
    const offset = startCamOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle * KILLCAM_ORBIT_DIRECTION);
    this.camera.position.copy(this.worldCenter).add(offset);
    this.camera.lookAt(this.worldCenter);
  }
}

/** 回放标题与结果摘要 */
function describe(r: HitReplay, titleOverride?: string): string {
  const title = titleOverride ?? `击毁回放 · ${r.spec.name}`;
  const lines: string[] = [`<b>${title}</b>`];
  if (r.armor) {
    lines.push(`击穿 · 等效 ${Math.round(r.armor.effectiveArmor)}mm / 穿深 ${Math.round(r.armor.penetration)}mm`);
  }
  const killed = (r.penetration?.hits ?? []).filter((h) => h.kind === 'crew' && h.destroyed).map((h) => h.name);
  const broken = (r.penetration?.hits ?? []).filter((h) => h.kind === 'module' && h.destroyed).map((h) => h.name);
  if (killed.length) lines.push(`阵亡:${killed.join('、')}`);
  if (broken.length) lines.push(`损坏:${[...new Set(broken)].join('、')}`);
  if (r.detonated) lines.push('<span style="color:#ff8a2a">弹药殉爆</span>');
  return lines.join('<br>');
}
