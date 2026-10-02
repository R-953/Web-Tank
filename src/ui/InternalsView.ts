import * as THREE from 'three';
import type { CrewRole } from '../data/types';
import { applyGunPose, buildVehicleModel } from '../game/models';
import { turretRingOffset } from '../game/damage/geometry';
import type { InternalsSnapshot } from '../game/internalsSnapshot';
import {
  buildInternalsModel,
  MODULE_TYPE_COLORS,
  healthColor,
  type InternalsModel,
  type InternalsModuleItem,
} from './internalsModel';

export { healthColor, MODULE_TYPE_COLORS };

/** 内构视窗尺寸与边距(左侧中部) */
export const INTERNALS_VIEW = { width: 440, height: 270, margin: 16 } as const;

/** 视口矩形计算(CSS 像素,左上角原点) */
export function internalsViewRect(_viewW: number, viewH: number): { x: number; y: number; w: number; h: number } {
  const w = INTERNALS_VIEW.width;
  const h = INTERNALS_VIEW.height;
  return {
    x: INTERNALS_VIEW.margin,
    y: Math.max(0, Math.round((viewH - h) / 2)),
    w,
    h,
  };
}

const GHOST = new THREE.MeshBasicMaterial({ color: 0x8fa0ae, transparent: true, opacity: 0.08, depthWrite: false });
const EDGE = new THREE.LineBasicMaterial({ color: 0xb7c4cf, transparent: true, opacity: 0.35 });

/** 乘员岗位简称 */
export const CREW_SHORT_NAMES: Record<CrewRole, string> = {
  commander: '车长',
  gunner: '炮手',
  loader: '装填手',
  driver: '驾驶员',
  radio: '无线电员',
};

type ModuleItem = InternalsModuleItem;

interface CrewItem {
  id: string;
  group: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  torsoMesh: THREE.Mesh;
  labelEl: HTMLDivElement;
}

/**
 * 战斗中按 O 显示的当前车辆内构 X 光画面。
 * 固定在车体左前方 3/4 俯视视角,常驻、实时、无击毁动画。
 */
export class InternalsView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, INTERNALS_VIEW.width / INTERNALS_VIEW.height, 0.05, 100);

  private _visible = false;
  private readonly frame: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly labelsContainer: HTMLDivElement;
  private readonly legendEl: HTMLDivElement;

  private root: THREE.Group | null = null;
  private turretPivot: THREE.Group | null = null;
  private gunPivot: THREE.Group | null = null;
  private internalsModel: InternalsModel | null = null;

  private cachedSpecId: string | null = null;
  private lastSnapshot: InternalsSnapshot | null = null;

  private readonly modulesMap = new Map<string, ModuleItem>();
  private readonly crewMap = new Map<string, CrewItem>();

  constructor(parent: HTMLElement) {
    this.scene.background = new THREE.Color(0x0d1116);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(-2, 4, -3);
    this.scene.add(dirLight);

    this.frame = document.createElement('div');
    this.frame.className = 'internals-view-frame';
    Object.assign(this.frame.style, {
      position: 'fixed',
      border: '1px solid rgba(255, 255, 255, 0.35)',
      borderRadius: '4px',
      pointerEvents: 'none',
      display: 'none',
      color: '#f2f2f2',
      textShadow: '0 1px 2px #000',
      zIndex: '6',
      boxSizing: 'border-box',
      overflow: 'hidden',
    });

    this.titleEl = document.createElement('div');
    Object.assign(this.titleEl.style, {
      position: 'absolute',
      left: '8px',
      top: '6px',
      font: '12px/1.4 system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
      fontWeight: 'bold',
      color: '#f2f2f2',
    });
    this.titleEl.textContent = '车辆内构';
    this.frame.appendChild(this.titleEl);

    this.labelsContainer = document.createElement('div');
    Object.assign(this.labelsContainer.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    });
    this.frame.appendChild(this.labelsContainer);

    this.legendEl = document.createElement('div');
    Object.assign(this.legendEl.style, {
      position: 'absolute',
      left: '8px',
      right: '8px',
      bottom: '4px',
      display: 'flex',
      justifyContent: 'space-between',
      font: '10px/1.2 system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
      color: 'rgba(240, 246, 252, 0.85)',
      pointerEvents: 'none',
    });
    this.legendEl.innerHTML = [
      '<span style="color:#ffaa00">■ 弹药架</span>',
      '<span style="color:#33b5e5">■ 发动机</span>',
      '<span style="color:#ab47bc">■ 变速箱</span>',
      '<span style="color:#ff4081">■ 油箱</span>',
      '<span style="color:#e0e0e0">■ 炮闩</span>',
      '<span style="color:#00e676">■ 方向机</span>',
      '<span style="color:#00e5ff">■ 高低机</span>',
    ].join(' ');
    this.frame.appendChild(this.legendEl);

    parent.appendChild(this.frame);
    this.updateFrame();
  }

  setVisible(v: boolean): void {
    this._visible = v;
    this.frame.style.display = v ? 'block' : 'none';
    if (v) {
      this.updateFrame();
      if (this.lastSnapshot) {
        this.updateLabels(this.lastSnapshot);
      }
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  /**
   * 每帧调用:更新炮塔 / 炮管姿态和各模块、乘员的颜色。
   * 模型按 spec.id 缓存,换车才重建。
   */
  update(s: InternalsSnapshot): void {
    this.lastSnapshot = s;

    if (this.cachedSpecId !== s.spec.id) {
      this.rebuild(s);
      this.cachedSpecId = s.spec.id;
    } else {
      if (this.turretPivot && this.gunPivot) {
        applyGunPose(s.spec, { turretPivot: this.turretPivot, gunPivot: this.gunPivot }, s.turretYaw, s.gunPitch);
      }
      this.updateColorsAndPositions(s);
    }

    if (this._visible) {
      this.updateLabels(s);
    }
  }

  /** 在主渲染器上开一个视口画出来(同 KillCam.render 的做法,画完恢复视口和剪裁) */
  render(renderer: THREE.WebGLRenderer): void {
    if (!this._visible || !this.lastSnapshot) return;
    try {
      const size = renderer.getSize(new THREE.Vector2());
      if (!size || size.x <= 0 || size.y <= 0) return;
      const rect = internalsViewRect(size.x, size.y);
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
      // 没有 WebGL(jsdom)时不要抛错
    }
  }

  dispose(): void {
    this.clearVehicle();
    if (this.frame.parentElement) {
      this.frame.parentElement.removeChild(this.frame);
    }
  }

  private updateFrame(): void {
    const viewW = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1024;
    const viewH = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 768;
    const rect = internalsViewRect(viewW, viewH);
    this.frame.style.left = `${rect.x}px`;
    this.frame.style.top = `${rect.y}px`;
    this.frame.style.width = `${rect.w}px`;
    this.frame.style.height = `${rect.h}px`;
  }

  private clearVehicle(): void {
    if (this.internalsModel) {
      this.internalsModel.dispose();
      this.internalsModel = null;
    }
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const m = o.material as THREE.Material;
          if (m !== GHOST && m !== EDGE) {
            m.dispose();
          }
        }
      });
    }
    this.root = null;
    this.turretPivot = null;
    this.gunPivot = null;
    this.modulesMap.clear();
    this.crewMap.clear();
    this.labelsContainer.innerHTML = '';
    this.cachedSpecId = null;
  }

  private rebuild(s: InternalsSnapshot): void {
    this.clearVehicle();

    this.titleEl.textContent = `车辆内构 · ${s.spec.name}`;

    const root = new THREE.Group();
    const { turret } = s.spec;
    const turretPivot = new THREE.Group();
    const gunPivot = new THREE.Group();
    turretPivot.position.copy(turretRingOffset(s.spec));
    gunPivot.position.set(0, turret.height / 2, -turret.length / 2);
    root.add(turretPivot);
    turretPivot.add(gunPivot);
    applyGunPose(s.spec, { turretPivot, gunPivot }, s.turretYaw, s.gunPitch);

    // 车体半透明外壳 + 轮廓线
    const temp = buildVehicleModel(s.spec, { root, turretPivot, gunPivot });
    temp.materials.forEach((m) => m.dispose());
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = GHOST;
        o.castShadow = false;
        if (!(o instanceof THREE.InstancedMesh)) {
          o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), EDGE));
        }
      }
    });

    this.internalsModel = buildInternalsModel(s, {
      colorMode: 'health',
      moduleOpacity: 0.8,
      crewOpacity: 0.9,
      edges: true,
    });
    root.add(this.internalsModel.hullMount);
    turretPivot.add(this.internalsModel.turretMount);
    gunPivot.add(this.internalsModel.gunMount);

    for (const [id, item] of this.internalsModel.modulesMap) {
      this.modulesMap.set(id, item);
    }

    for (const c of s.crew) {
      const crewItem = this.internalsModel.crewMap.get(c.id);
      if (!crewItem) continue;

      const labelEl = document.createElement('div');
      labelEl.className = 'internals-crew-label';
      labelEl.textContent = CREW_SHORT_NAMES[c.role] ?? c.role;
      Object.assign(labelEl.style, {
        position: 'absolute',
        transform: 'translate(-50%, -100%)',
        fontSize: '11px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        textShadow: '0 1px 2px #000, 0 0 3px #000',
      });
      this.labelsContainer.appendChild(labelEl);

      this.crewMap.set(c.id, {
        id: c.id,
        group: crewItem.group,
        mat: crewItem.mat,
        torsoMesh: crewItem.torsoMesh,
        labelEl,
      });
    }

    // 相机固定在车体左前方 3/4 俯视,随车体坐标系(不随炮塔转)
    const { hull: h, turret: tu } = s.spec;
    const radius = 0.5 * Math.hypot(h.length, h.width, h.height + tu.height);
    const target = new THREE.Vector3(0, (h.height + tu.height) * 0.25, 0);
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const distance = (radius * 1.15) / Math.sin(halfFov);
    const camDir = new THREE.Vector3(-1.0, 0.75, -1.0).normalize();
    this.camera.position.copy(target).addScaledVector(camDir, distance);
    this.camera.lookAt(target);

    this.root = root;
    this.turretPivot = turretPivot;
    this.gunPivot = gunPivot;
    this.scene.add(root);
  }

  private updateColorsAndPositions(s: InternalsSnapshot): void {
    this.internalsModel?.update(s);
  }

  private updateLabels(s: InternalsSnapshot): void {
    try {
      this.camera.updateMatrixWorld();
      for (const c of s.crew) {
        const item = this.crewMap.get(c.id);
        if (!item) continue;

        item.labelEl.textContent = CREW_SHORT_NAMES[c.role] ?? c.role;
        item.labelEl.style.color = !c.alive ? '#777777' : c.ratio < 0.5 ? '#f07b1e' : c.ratio < 1 ? '#f0d23a' : '#ffffff';

        const pos = new THREE.Vector3();
        item.group.getWorldPosition(pos);
        pos.y += 0.45;
        pos.project(this.camera);

        if (pos.z < 1) {
          const x = (pos.x * 0.5 + 0.5) * INTERNALS_VIEW.width;
          const y = (-pos.y * 0.5 + 0.5) * INTERNALS_VIEW.height;
          item.labelEl.style.left = `${Math.round(x)}px`;
          item.labelEl.style.top = `${Math.round(y)}px`;
          item.labelEl.style.display = 'block';
        } else {
          item.labelEl.style.display = 'none';
        }
      }
    } catch {
      // jsdom guard
    }
  }
}
