import * as THREE from 'three';
import type { HitReplay } from '../game/Game';
import { applyGunPose, buildVehicleModel } from '../game/models';
import { buildShellModel } from '../game/models/shell';
import type { Segment } from '../game/damage/penetration';
import { turretRingOffset } from '../game/damage/geometry';

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

/** 炮弹从画面外飞到击穿点的时长,秒 */
const APPROACH = 0.8;
/** 车内过程播完后停留、环绕展示的时长,秒 */
const HOLD = 3.0;

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

interface Part {
  mesh: THREE.Mesh;
  /** [回放时刻, 血量比例] 按时间排序 */
  timeline: Array<[number, number]>;
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
 * 右上角击毁回放:X 光视角慢放「炮弹飞来 → 击穿 → 车内破片 / 爆炸 → 模块与乘员变色」。
 * 只依赖 HitReplay(车体本地坐标),用主渲染器在右上角开一个小视口渲染。
 */
export class KillCam {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, KILLCAM.width / KILLCAM.height, 0.05, 100);
  private root: THREE.Group | null = null;
  private replay: HitReplay | null = null;
  private currentOpts?: KillCamOptions;
  private startMs = 0;
  private duration = 0;
  private parts: Part[] = [];
  private segments: SegmentView[] = [];
  private shell: THREE.Group | null = null;
  private flash: THREE.Mesh | null = null;
  private blast: THREE.Mesh | null = null;
  private readonly queue: PlayItem[] = [];
  private readonly frame: HTMLDivElement;
  private readonly caption: HTMLDivElement;
  private camFrom = new THREE.Vector3();
  private camLook = new THREE.Vector3();

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
    this.updateFrame();
    this.build(item.replay);
    this.startMs = nowMs;
    this.duration = APPROACH + (item.replay.penetration?.duration ?? 0.3) + HOLD;
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

    const frameOf = (part: string) => (part === 'turret' ? turretPivot : part === 'gun' ? gunPivot : root);
    const timelineFor = (id: string): Array<[number, number]> => {
      const tl: Array<[number, number]> = [[-1, r.before[id] ?? 1]];
      for (const e of r.external) if (e.id === id) tl.push([APPROACH, e.hpAfter / e.maxHp]);
      for (const h of r.penetration?.hits ?? []) if (h.id === id) tl.push([APPROACH + h.time, h.hpAfter / h.maxHp]);
      tl.push([APPROACH + (r.penetration?.duration ?? 0) + 0.05, r.after[id] ?? 1]);
      return tl.sort((a, b) => a[0] - b[0]);
    };

    for (const m of r.layout.modules) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: m.type === 'track' || m.type === 'barrel' ? 0.35 : 0.8 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(m.size[0], m.size[1], m.size[2]), mat);
      mesh.position.set(m.center[0], m.center[1], m.center[2]);
      frameOf(m.part).add(mesh);
      this.parts.push({ mesh, timeline: timelineFor(m.id) });
    }
    for (const c of r.layout.crew) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 4, 8), mat);
      mesh.position.set(c.center[0], c.center[1], c.center[2]);
      frameOf(c.part).add(mesh);
      this.parts.push({ mesh, timeline: timelineFor(c.id) });
    }

    // 车内轨迹(车体坐标)
    for (const seg of r.penetration?.segments ?? []) {
      const geo = new THREE.BufferGeometry().setFromPoints([seg.from, seg.from.clone()]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: SEGMENT_COLORS[seg.kind], transparent: true }));
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
    root.add(this.flash);
    if (r.penetration?.explosion) {
      this.blast = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, depthWrite: false }),
      );
      this.blast.position.copy(r.penetration.explosion.center);
      root.add(this.blast);
    }

    // 相机:从弹道来向的斜上方看,整车都在画面里,注视点偏向击穿点
    const { hull: h, turret: tu } = r.spec;
    const radius = 0.5 * Math.hypot(h.length, h.width, h.height + tu.height);
    const center = new THREE.Vector3(0, tu.height / 2, 0);
    this.camLook.copy(center).lerp(r.entry, 0.35);
    const back = new THREE.Vector3(-r.dir.x, 0, -r.dir.z);
    if (back.lengthSq() < 1e-6) back.set(1, 0, 0);
    back.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.45);
    back.y = 0.55;
    back.normalize();
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const distance = (radius * 1.05) / Math.sin(halfFov);
    this.camFrom.copy(this.camLook).addScaledVector(back, distance);

    this.root = root;
    this.scene.add(root);
    this.animate(0);
  }

  private animate(t: number): void {
    const r = this.replay!;
    // 炮弹:接近阶段在车外飞行,之后沿车内弹道慢速前进
    const shellSeg = r.penetration?.segments.find((s) => s.kind === 'shell');
    if (this.shell) {
      if (t < APPROACH) {
        this.shell.visible = true;
        this.shell.position.copy(r.entry).addScaledVector(r.dir, -6 * (1 - t / APPROACH));
      } else if (shellSeg && t < APPROACH + shellSeg.t1) {
        const k = (t - APPROACH - shellSeg.t0) / Math.max(1e-3, shellSeg.t1 - shellSeg.t0);
        this.shell.position.lerpVectors(shellSeg.from, shellSeg.to, THREE.MathUtils.clamp(k, 0, 1));
      } else {
        this.shell.visible = false;
      }
    }
    if (this.flash) {
      const k = (t - APPROACH) / 0.35;
      (this.flash.material as THREE.MeshBasicMaterial).opacity = k >= 0 && k <= 1 ? 1 - k : 0;
      this.flash.scale.setScalar(1 + Math.max(0, k) * 2);
    }
    for (const { seg, line } of this.segments) {
      const k = THREE.MathUtils.clamp((t - APPROACH - seg.t0) / Math.max(1e-3, seg.t1 - seg.t0), 0, 1);
      const end = seg.from.clone().lerp(seg.to, k);
      const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(1, end.x, end.y, end.z);
      pos.needsUpdate = true;
      line.visible = t >= APPROACH + seg.t0;
    }
    if (this.blast && r.penetration?.explosion) {
      const e = r.penetration.explosion;
      const k = (t - APPROACH - e.time) / 0.4;
      const mat = this.blast.material as THREE.MeshBasicMaterial;
      mat.opacity = k >= 0 && k <= 1 ? 0.55 * (1 - k) : 0;
      this.blast.scale.setScalar(e.radius * THREE.MathUtils.clamp(0.2 + k, 0.2, 1));
    }
    for (const p of this.parts) {
      let ratio = p.timeline[0][1];
      for (const [time, value] of p.timeline) if (t >= time) ratio = value;
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(healthColor(ratio));
    }
    // 相机:停留阶段缓慢环绕
    const hold = Math.max(0, t - APPROACH - (r.penetration?.duration ?? 0));
    const angle = hold * 0.25;
    const offset = this.camFrom.clone().sub(this.camLook).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.camera.position.copy(this.camLook).add(offset);
    this.camera.lookAt(this.camLook);
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
