import * as THREE from 'three';
import type { HitReplay } from '../game/Game';
import type { InternalsSnapshot } from '../game/internalsSnapshot';
import type { ModuleType } from '../data/types';
import {
  APPROACH,
  KILLCAM_ORBIT_DEGREES,
  KILLCAM_ORBIT_DIRECTION,
  computeVehicleBounds,
  killcamDuration,
  killcamOrbitAngle,
} from './KillCam';
import { KillCamOverlay, ratioAt } from './killcamOverlay';
import { WorldXray, type XrayVehicle } from './WorldXray';

export interface WorldReplayCameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface ImpactMarkState {
  visible: boolean;
  disc: { radius: number; opacity: number };
  ring1: { scale: number; opacity: number; visible: boolean };
  ring2: { scale: number; opacity: number; visible: boolean };
}

export interface TrajectoryLinePoints {
  start: THREE.Vector3;
  entry: THREE.Vector3;
  end: THREE.Vector3;
  currentTip: THREE.Vector3;
  points: THREE.Vector3[];
}

/**
 * 纯函数: 计算回放相机的空间位姿 (position 与 target)
 * - 以残骸的包围盒中心为中心
 * - 起点在弹道射来的一侧稍高处(仰角约 15°), 接触前看向弹着点 entry, 接触后看向中心
 * - 接触后沿 KILLCAM_ORBIT_DEGREES / KILLCAM_ORBIT_DIRECTION 缓慢环绕
 * - 距离约 2.2 倍包围盒半径, 结束前略微拉远
 */
export function worldReplayCameraPose(
  t: number,
  replay: HitReplay,
  bounds: { center: THREE.Vector3; radius: number },
): WorldReplayCameraPose {
  const timing = killcamDuration(replay);
  const { tContact, tEffectEnd, total } = timing;
  const center = bounds.center;
  const entry = replay.entry;

  // 目标注视点: 接触前看向弹着点 entry, 接触后平滑过渡到残骸中心 center
  const kTarget = THREE.MathUtils.clamp((t - tContact) / 0.3, 0, 1);
  const target = t <= tContact ? entry.clone() : entry.clone().lerp(center, kTarget);

  // 弹道射来方向: 炮弹行进方向为 replay.dir, 则来向为 -replay.dir
  const incoming = new THREE.Vector3(-replay.dir.x, 0, -replay.dir.z);
  if (incoming.lengthSq() < 1e-6) {
    incoming.set(0, 0, 1);
  } else {
    incoming.normalize();
  }

  // 仰角约 15°
  const ELEVATION_RAD = THREE.MathUtils.degToRad(15);
  const elevatedDir = incoming.clone().multiplyScalar(Math.cos(ELEVATION_RAD));
  elevatedDir.y = Math.sin(ELEVATION_RAD);
  elevatedDir.normalize();

  // 基础距离约 2.2 倍包围盒半径, 结束前略微拉远
  const baseDistance = 2.2 * Math.max(bounds.radius, 1.0);
  let distance = baseDistance;
  if (t > tEffectEnd) {
    const pullProgress = THREE.MathUtils.clamp((t - tEffectEnd) / Math.max(0.01, total - tEffectEnd), 0, 1);
    distance = baseDistance * (1 + 0.2 * pullProgress);
  }

  // 环绕角度: 接触前为 0, 接触后平滑环绕
  const angle = killcamOrbitAngle(t, tContact, tEffectEnd, KILLCAM_ORBIT_DEGREES);
  const offset = elevatedDir
    .clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle * KILLCAM_ORBIT_DIRECTION)
    .multiplyScalar(distance);

  const position = center.clone().add(offset);
  return { position, target };
}

/**
 * 纯函数: 外壳 X 光过渡淡入淡出系数 (0..1)
 * - 接触前为 0 (真实外壳)
 * - 接触后 0.2 s 内从 0 褪成 1 (半透明灰壳)
 * - 后效期间保持 1
 * - 结束前从 1 淡回 0
 */
export function worldReplayFade(
  t: number,
  tContact: number,
  tEffectEnd: number,
  total: number,
): number {
  if (t < tContact) return 0;
  if (t < tContact + 0.2) {
    return (t - tContact) / 0.2;
  }
  if (t <= tEffectEnd) {
    return 1;
  }
  if (t < total) {
    const fadeDuration = Math.max(0.01, total - tEffectEnd);
    return Math.max(0, 1 - (t - tEffectEnd) / fadeDuration);
  }
  return 0;
}

/**
 * 纯函数: 计算弹着标记(圆盘与向外扩散的圆环)在时刻 dt (从接触起算) 的状态
 * - 接触起 0.6 s 内圆盘不透明度 0.55 → 0
 * - 两圈圆环向外扩散 (1 → 2.2 倍半径) 并淡出
 */
export function worldReplayImpactMark(dt: number, baseRadius = 0.25): ImpactMarkState {
  if (dt < 0 || dt > 0.6) {
    return {
      visible: false,
      disc: { radius: baseRadius, opacity: 0 },
      ring1: { scale: 1, opacity: 0, visible: false },
      ring2: { scale: 1, opacity: 0, visible: false },
    };
  }
  const kDisc = dt / 0.6;
  const discOpacity = 0.55 * (1 - kDisc);

  const kRing1 = Math.min(1, dt / 0.5);
  const ring1Scale = 1 + 1.2 * kRing1;
  const ring1Opacity = 0.55 * (1 - kRing1);

  let ring2Visible = false;
  let ring2Scale = 1;
  let ring2Opacity = 0;
  if (dt >= 0.12) {
    ring2Visible = true;
    const kRing2 = Math.min(1, (dt - 0.12) / 0.48);
    ring2Scale = 1 + 1.2 * kRing2;
    ring2Opacity = 0.55 * (1 - kRing2);
  }

  return {
    visible: true,
    disc: { radius: baseRadius, opacity: discOpacity },
    ring1: { scale: ring1Scale, opacity: ring1Opacity, visible: true },
    ring2: { scale: ring2Scale, opacity: ring2Opacity, visible: ring2Visible },
  };
}

/**
 * 纯函数: 计算弹道轨迹线端点与各点列表
 * - 从射来方向远处 (沿 -dir 约 8 m) 到弹着点 entry
 * - 击穿后在车内继续延伸至终点 end (穿透轨迹终点或沿 dir 约 2.5 m)
 * - 接触前按 t / tContact 从远处飞至 entry
 */
export function worldReplayTrajectoryPoints(
  t: number,
  entry: THREE.Vector3,
  dir: THREE.Vector3,
  penetrationEnd?: THREE.Vector3,
  tContact = APPROACH,
  penetrationDuration = 0.3,
): TrajectoryLinePoints {
  const normDir = dir.clone().normalize();
  const start = entry.clone().addScaledVector(normDir, -8);
  const end = penetrationEnd ? penetrationEnd.clone() : entry.clone().addScaledVector(normDir, 2.5);

  let currentTip: THREE.Vector3;
  let points: THREE.Vector3[];

  if (t <= 0) {
    currentTip = start.clone();
    points = [start.clone(), start.clone()];
  } else if (t < tContact) {
    const k = t / tContact;
    currentTip = start.clone().lerp(entry, k);
    points = [start.clone(), currentTip.clone()];
  } else {
    const dur = Math.max(1e-3, penetrationDuration);
    const kPen = THREE.MathUtils.clamp((t - tContact) / dur, 0, 1);
    currentTip = entry.clone().lerp(end, kPen);
    points = [start.clone(), entry.clone(), currentTip.clone()];
  }

  return { start, entry: entry.clone(), end, currentTip, points };
}

export interface WorldReplayOptions {
  groundLuminance?: number;
}

/**
 * 死亡回放接触前残骸材质在暗地面上的提亮比例。
 * 载具被击毁时 Vehicle.becomeWreck 会将原色 × 0.25;
 * 在草地、土地等暗地面(相对亮度 <= 0.55)上, 残骸原色 × 0.25 容易融进深色背景看不清,
 * 故接触前按 0.45 / 0.25 = 1.8 倍提亮(即恢复到原色约 × 0.45)。
 * 在雪地等高亮地面(相对亮度 >= 0.75)上则不提亮(保持 1.0 倍, 即维持原色 × 0.25), 形成天然反差。
 */
export const WRECK_BRIGHTEN_FACTOR_DARK = 1.8;

/**
 * 纯函数: 根据地面相对亮度计算残骸材质提亮倍率。
 * - 亮度 <= 0.55: WRECK_BRIGHTEN_FACTOR_DARK (1.8)
 * - 亮度 >= 0.75: 1.0 (雪地等亮背景不提亮)
 * - 0.55..0.75: 平滑线性过渡
 */
export function wreckBrightenFactorFor(groundLuminance: number): number {
  const u = THREE.MathUtils.clamp((groundLuminance - 0.55) / 0.2, 0, 1);
  return THREE.MathUtils.lerp(WRECK_BRIGHTEN_FACTOR_DARK, 1.0, u);
}

interface HighlightBox {
  id: string;
  group: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  edgeMat: THREE.LineBasicMaterial;
}

export class WorldReplay {
  private _active = false;
  private _finished = false;

  private replay: HitReplay | null = null;
  private worldReplayData: HitReplay | null = null;
  private worldBounds = { center: new THREE.Vector3(), radius: 1 };
  private worldPenEnd = new THREE.Vector3();
  private origWreckMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> = new Map();
  private clonedWreckMaterials: THREE.Material[] = [];

  private startMs = 0;
  private tContact = APPROACH;
  private tEffectEnd = 0;
  private total = 0;
  private penetrationDuration = 0.3;

  private worldXray: WorldXray | null = null;
  private overlayContainer: HTMLDivElement;
  private overlay: KillCamOverlay;

  // 弹道线 (细青绿线 0x39e6c4)
  private trajectoryLine: THREE.Line | null = null;
  private trajectoryMat: THREE.LineBasicMaterial | null = null;

  // 弹着标记 (橙色 0xff8a1f)
  private markGroup: THREE.Group | null = null;
  private markDisc: THREE.Mesh | null = null;
  private markRing1: THREE.Mesh | null = null;
  private markRing2: THREE.Mesh | null = null;
  private markDiscMat: THREE.MeshBasicMaterial | null = null;
  private markRing1Mat: THREE.MeshBasicMaterial | null = null;
  private markRing2Mat: THREE.MeshBasicMaterial | null = null;

  // 受损模块红色轮廓盒子
  private highlightBoxes: HighlightBox[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    overlayHost: HTMLElement,
  ) {
    this.overlayContainer = document.createElement('div');
    Object.assign(this.overlayContainer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '10',
      display: 'none',
    });
    overlayHost.appendChild(this.overlayContainer);
    this.overlay = new KillCamOverlay(this.overlayContainer);
  }

  get active(): boolean {
    return this._active;
  }

  get finished(): boolean {
    return this._finished;
  }

  play(vehicle: XrayVehicle, replay: HitReplay, nowMs: number, opts?: WorldReplayOptions): void {
    if (this._active) {
      this.stop();
    }

    this._active = true;
    this._finished = false;
    this.replay = replay;
    this.startMs = nowMs;

    const timing = killcamDuration(replay);
    this.tContact = timing.tContact;
    this.tEffectEnd = timing.tEffectEnd;
    this.total = timing.total;
    this.penetrationDuration = replay.penetration?.duration ?? 0.3;

    const groundLuminance = opts?.groundLuminance ?? 0;
    const brightenFactor = wreckBrightenFactorFor(groundLuminance);

    this.origWreckMaterials.clear();
    this.clonedWreckMaterials = [];

    // 若需要提亮残骸(且载具已损毁变黑), 给材质做一次提亮克隆; stop 时干净还原
    if (brightenFactor > 1.001 && replay.destroyed) {
      vehicle.root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          this.origWreckMaterials.set(o, o.material);
          const origMat = o.material;
          const isArray = Array.isArray(origMat);
          const mats = isArray ? origMat : [origMat];
          const newMats = mats.map((m) => {
            const cloned = m.clone();
            if ('color' in cloned && (cloned as THREE.MeshStandardMaterial).color) {
              (cloned as THREE.MeshStandardMaterial).color.multiplyScalar(brightenFactor);
            }
            this.clonedWreckMaterials.push(cloned);
            return cloned;
          });
          o.material = isArray ? newMats : newMats[0];
        }
      });
    }

    vehicle.root.updateMatrixWorld(true);

    // 转换车体坐标到世界坐标
    const worldEntry = vehicle.root.localToWorld(replay.entry.clone());
    const worldDir = replay.dir.clone().transformDirection(vehicle.root.matrixWorld).normalize();
    const rawNormal = replay.normal ? replay.normal.clone() : new THREE.Vector3(0, 0, 1);
    if (rawNormal.lengthSq() < 1e-4) rawNormal.set(0, 0, 1);
    const worldNormal = rawNormal.transformDirection(vehicle.root.matrixWorld).normalize();

    // 弹道终点
    const shellSeg = replay.penetration?.segments.find((s) => s.kind === 'shell');
    if (shellSeg) {
      this.worldPenEnd = vehicle.root.localToWorld(shellSeg.to.clone());
    } else {
      this.worldPenEnd = worldEntry.clone().addScaledVector(worldDir, 2.5);
    }

    // 计算世界包围盒中心和半径
    // 不传 vehicle.root:网格合并那一步用的是 matrixWorld(世界坐标),而车在世界里不在原点,会把包围盒撑到几百米外
    const localBounds = computeVehicleBounds(replay.spec, replay.turretYaw, replay.gunPitch);
    const worldCenter = vehicle.root.localToWorld(localBounds.center.clone());
    this.worldBounds = { center: worldCenter, radius: localBounds.radius };

    this.worldReplayData = {
      ...replay,
      entry: worldEntry,
      dir: worldDir,
      normal: worldNormal,
    };

    // 1. 初始化 WorldXray
    this.worldXray = new WorldXray(vehicle, groundLuminance);
    const initialSnapshot = this.buildSnapshot(0);
    this.worldXray.enable(initialSnapshot);
    this.worldXray.setFade(0); // 接触前为真实外壳

    // 2. 弹道线 (细青绿线 0x39e6c4)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([worldEntry, worldEntry]);
    this.trajectoryMat = new THREE.LineBasicMaterial({
      color: 0x39e6c4,
      transparent: true,
      opacity: 0.9,
    });
    this.trajectoryLine = new THREE.Line(lineGeo, this.trajectoryMat);
    this.trajectoryLine.name = 'world-replay-trajectory';
    this.scene.add(this.trajectoryLine);

    // 3. 弹着标记 (橙色 0xff8a1f)
    const caliber = replay.shell?.caliber ?? 75;
    const markRadius = Math.max(0.2, (caliber / 1000) * 3);
    this.markGroup = new THREE.Group();
    this.markGroup.name = 'world-replay-impact-mark';
    this.markGroup.position.copy(worldEntry.clone().addScaledVector(worldNormal, 0.03));
    this.markGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);

    this.markDiscMat = new THREE.MeshBasicMaterial({
      color: 0xff8a1f,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.markDisc = new THREE.Mesh(new THREE.CircleGeometry(markRadius, 32), this.markDiscMat);
    this.markDisc.visible = false;
    this.markGroup.add(this.markDisc);

    this.markRing1Mat = new THREE.MeshBasicMaterial({
      color: 0xff8a1f,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.markRing1 = new THREE.Mesh(new THREE.RingGeometry(markRadius * 0.88, markRadius, 32), this.markRing1Mat);
    this.markRing1.visible = false;
    this.markGroup.add(this.markRing1);

    this.markRing2Mat = new THREE.MeshBasicMaterial({
      color: 0xff8a1f,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.markRing2 = new THREE.Mesh(new THREE.RingGeometry(markRadius * 0.88, markRadius, 32), this.markRing2Mat);
    this.markRing2.visible = false;
    this.markGroup.add(this.markRing2);

    this.scene.add(this.markGroup);

    // 4. 受损模块红色高亮轮廓盒子
    this.highlightBoxes = [];
    for (const m of replay.layout.modules) {
      const boxGeo = new THREE.BoxGeometry(m.size[0] * 1.04, m.size[1] * 1.04, m.size[2] * 1.04);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff3b30,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0xff3b30,
        transparent: true,
        opacity: 0.8,
      });
      const boxGroup = new THREE.Group();
      boxGroup.name = `damaged-box-${m.id}`;
      boxGroup.position.set(m.center[0], m.center[1], m.center[2]);
      boxGroup.add(new THREE.Mesh(boxGeo, mat));
      boxGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat));
      boxGroup.visible = false;

      const parentNode = m.part === 'turret' ? vehicle.turretPivot : m.part === 'gun' ? vehicle.gunPivot : vehicle.root;
      parentNode.add(boxGroup);

      this.highlightBoxes.push({ id: m.id, group: boxGroup, mat, edgeMat });
    }

    // 5. 文字覆盖层
    this.overlayContainer.style.display = 'block';
    this.overlay.show(replay);

    // 立即执行第一帧
    this.update(nowMs);
  }

  update(nowMs: number): void {
    if (!this._active || !this.replay || !this.worldReplayData) return;

    const t = (nowMs - this.startMs) / 1000;
    if (t >= this.total) {
      this._finished = true;
    }

    // 1. 相机位姿推进
    const pose = worldReplayCameraPose(t, this.worldReplayData, this.worldBounds);
    this.camera.position.copy(pose.position);
    this.camera.lookAt(pose.target);

    // 2. 外壳 X 光与内构更新
    const fade = worldReplayFade(t, this.tContact, this.tEffectEnd, this.total);
    if (this.worldXray) {
      this.worldXray.setFade(fade);
      const snapshot = this.buildSnapshot(t);
      this.worldXray.update(snapshot);
    }

    // 3. 弹道线更新
    if (this.trajectoryLine && this.worldReplayData) {
      const traj = worldReplayTrajectoryPoints(
        t,
        this.worldReplayData.entry,
        this.worldReplayData.dir,
        this.worldPenEnd,
        this.tContact,
        this.penetrationDuration,
      );
      this.trajectoryLine.geometry.dispose();
      this.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(traj.points);
      this.trajectoryLine.visible = t <= this.total;
    }

    // 4. 弹着标记更新
    if (this.markDisc && this.markRing1 && this.markRing2 && this.markDiscMat && this.markRing1Mat && this.markRing2Mat) {
      const markState = worldReplayImpactMark(t - this.tContact);
      this.markDisc.visible = markState.visible;
      this.markDiscMat.opacity = markState.disc.opacity;

      this.markRing1.visible = markState.ring1.visible;
      this.markRing1.scale.set(markState.ring1.scale, markState.ring1.scale, 1);
      this.markRing1Mat.opacity = markState.ring1.opacity;

      this.markRing2.visible = markState.ring2.visible;
      this.markRing2.scale.set(markState.ring2.scale, markState.ring2.scale, 1);
      this.markRing2Mat.opacity = markState.ring2.opacity;
    }

    // 5. 受损模块红色高亮盒子更新
    for (const hb of this.highlightBoxes) {
      const ratio = ratioAt(this.replay, hb.id, t, this.tContact);
      const show = ratio < 1 && fade > 0.05;
      hb.group.visible = show;
      if (show) {
        hb.mat.opacity = 0.3 * fade;
        hb.edgeMat.opacity = 0.8 * fade;
      }
    }

    // 6. 文字层更新
    this.overlay.update(t, this.tContact);
  }

  stop(): void {
    if (!this._active) return;

    // 还原外壳与内构
    if (this.worldXray) {
      this.worldXray.disable();
      this.worldXray = null;
    }

    // 还原提亮前的残骸材质并释放克隆
    if (this.origWreckMaterials.size > 0) {
      for (const [mesh, origMat] of this.origWreckMaterials.entries()) {
        mesh.material = origMat;
      }
      this.origWreckMaterials.clear();
    }
    for (const mat of this.clonedWreckMaterials) {
      mat.dispose();
    }
    this.clonedWreckMaterials = [];

    // 清理弹道线
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine.geometry.dispose();
      this.trajectoryLine = null;
    }
    if (this.trajectoryMat) {
      this.trajectoryMat.dispose();
      this.trajectoryMat = null;
    }

    // 清理弹着标记
    if (this.markGroup) {
      this.scene.remove(this.markGroup);
      if (this.markDisc) this.markDisc.geometry.dispose();
      if (this.markRing1) this.markRing1.geometry.dispose();
      if (this.markRing2) this.markRing2.geometry.dispose();
      this.markDiscMat?.dispose();
      this.markRing1Mat?.dispose();
      this.markRing2Mat?.dispose();
      this.markDisc = null;
      this.markRing1 = null;
      this.markRing2 = null;
      this.markDiscMat = null;
      this.markRing1Mat = null;
      this.markRing2Mat = null;
      this.markGroup = null;
    }

    // 清理受损模块高亮盒子
    for (const hb of this.highlightBoxes) {
      hb.group.removeFromParent();
      hb.group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
        }
      });
      hb.mat.dispose();
      hb.edgeMat.dispose();
    }
    this.highlightBoxes = [];

    // 隐藏文字层
    this.overlay.hide();
    this.overlayContainer.style.display = 'none';

    this.replay = null;
    this.worldReplayData = null;
    this._active = false;
    this._finished = false;
  }

  private buildSnapshot(t: number): InternalsSnapshot {
    const replay = this.replay!;
    return {
      spec: replay.spec,
      turretYaw: replay.turretYaw,
      gunPitch: replay.gunPitch,
      modules: replay.layout.modules.map((m) => {
        const ratio = ratioAt(replay, m.id, t, this.tContact);
        return {
          id: m.id,
          type: m.type as ModuleType,
          part: m.part,
          center: m.center,
          size: m.size,
          ratio,
        };
      }),
      crew: replay.layout.crew.map((c) => {
        const ratio = ratioAt(replay, c.id, t, this.tContact);
        return {
          id: c.id,
          role: c.role,
          part: c.part as 'hull' | 'turret',
          center: c.center,
          ratio,
          alive: ratio > 0,
        };
      }),
    };
  }
}
