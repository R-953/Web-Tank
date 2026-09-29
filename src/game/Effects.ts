import * as THREE from 'three';

export type ImpactKind = 'penetration' | 'bounce' | 'ground' | 'spark' | 'dust' | 'splash' | 'leaves';

interface Effect {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  fromScale: number;
  toScale: number;
  /** 每秒上升,m(烟) */
  rise: number;
  /** 起始不透明度 */
  opacity: number;
}

const SPHERE = new THREE.IcosahedronGeometry(1, 1);
const FLAME = new THREE.ConeGeometry(0.45, 1.6, 7).translate(0, 0.8, 0);

const IMPACT_STYLE: Record<ImpactKind, { color: number; size: number; life: number }> = {
  penetration: { color: 0xff7a1a, size: 0.9, life: 0.25 },
  bounce: { color: 0xe8e8e8, size: 0.6, life: 0.25 },
  ground: { color: 0x8a7a5a, size: 0.8, life: 0.25 },
  // 枪弹:很小、很短
  spark: { color: 0xffe2a0, size: 0.18, life: 0.08 },
  dust: { color: 0x9a8a68, size: 0.35, life: 0.3 },
  splash: { color: 0xcfe3f0, size: 0.4, life: 0.35 },
  leaves: { color: 0x5f7f2e, size: 1.1, life: 0.6 },
};

/** 持续燃烧 / 冒烟的发射器(起火的车、残骸) */
interface Emitter {
  group: THREE.Group;
  flames: THREE.Mesh[];
  flameMat: THREE.MeshBasicMaterial | null;
  kind: 'fire' | 'smoke';
  timer: number;
  phase: number;
  /** 本步有没有被 setEmitter 刷新(没刷新就说明已经灭了) */
  touched: boolean;
}

/** 起火时每隔多久冒一团烟,秒;残骸冒烟更稀 */
const FIRE_SMOKE_INTERVAL = 0.18;
const WRECK_SMOKE_INTERVAL = 0.45;

/** 简单的特效(命中火花、爆炸、炮口焰、起火、残骸冒烟),按游戏时间推进 */
export class Effects {
  readonly root = new THREE.Group();
  private readonly list: Effect[] = [];
  private readonly emitters = new Map<string, Emitter>();

  impact(point: THREE.Vector3, kind: ImpactKind): void {
    const s = IMPACT_STYLE[kind];
    this.spawn(point, s.color, s.life, s.size * 0.3, s.size);
  }

  explosion(point: THREE.Vector3): void {
    this.spawn(point, 0xffa040, 0.8, 1.0, 5.0);
    this.spawn(point.clone().setY(point.y + 1), 0x3a3a3a, 1.6, 1.5, 6.0);
  }

  muzzleFlash(point: THREE.Vector3, size = 1): void {
    this.spawn(point, 0xffe0a0, 0.08, 0.4 * size, 0.9 * size);
  }

  /**
   * 设置某个发射器(按 id)在这一步的位置:kind = 'fire' 为明火 + 浓烟,'smoke' 为残骸的细烟。
   * 每个固定步都要调用;某一步没调用的发射器会被移除。
   */
  setEmitter(id: string, position: THREE.Vector3, kind: 'fire' | 'smoke'): void {
    let e = this.emitters.get(id);
    if (e && e.kind !== kind) {
      this.removeEmitter(id);
      e = undefined;
    }
    if (!e) {
      const group = new THREE.Group();
      group.name = `emitter:${id}`;
      const flames: THREE.Mesh[] = [];
      let flameMat: THREE.MeshBasicMaterial | null = null;
      if (kind === 'fire') {
        flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
        for (let i = 0; i < 3; i++) {
          const m = new THREE.Mesh(FLAME, flameMat);
          m.position.set((i - 1) * 0.35, 0, (i % 2) * 0.3 - 0.15);
          flames.push(m);
          group.add(m);
        }
      }
      this.root.add(group);
      e = { group, flames, flameMat, kind, timer: 0, phase: this.emitters.size * 1.7, touched: true };
      this.emitters.set(id, e);
    }
    e.group.position.copy(position);
    e.touched = true;
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.age += dt;
      const t = Math.min(1, e.age / e.life);
      e.mesh.scale.setScalar(e.fromScale + (e.toScale - e.fromScale) * t);
      e.mesh.position.y += e.rise * dt;
      e.material.opacity = e.opacity * (1 - t);
      if (t >= 1) {
        this.root.remove(e.mesh);
        e.material.dispose();
        this.list.splice(i, 1);
      }
    }
    for (const [id, e] of this.emitters) {
      if (!e.touched) {
        this.removeEmitter(id);
        continue;
      }
      e.touched = false;
      e.phase += dt;
      // 火苗闪烁:高度和亮度随时间抖动
      e.flames.forEach((f, k) => {
        const s = 0.75 + 0.35 * Math.sin(e.phase * (11 + k * 3.7) + k) + 0.15 * Math.sin(e.phase * 23 + k * 2);
        f.scale.set(0.9 + 0.2 * Math.sin(e.phase * 7 + k), Math.max(0.3, s), 0.9);
      });
      if (e.flameMat) e.flameMat.opacity = 0.7 + 0.2 * Math.sin(e.phase * 17);
      e.timer -= dt;
      if (e.timer <= 0) {
        const fire = e.kind === 'fire';
        e.timer += fire ? FIRE_SMOKE_INTERVAL : WRECK_SMOKE_INTERVAL;
        const p = e.group.position.clone();
        p.x += Math.sin(e.phase * 5.3) * 0.4;
        p.z += Math.cos(e.phase * 4.1) * 0.4;
        p.y += fire ? 1.2 : 0.5;
        this.spawn(p, fire ? 0x2a2622 : 0x4a4744, fire ? 3.2 : 4.5, 0.5, fire ? 2.4 : 2.0, 2.4, fire ? 0.5 : 0.3);
      }
    }
  }

  get count(): number {
    return this.list.length;
  }

  /** 当前发射器数量(测试 / 调试用) */
  get emitterCount(): number {
    return this.emitters.size;
  }

  dispose(): void {
    for (const id of [...this.emitters.keys()]) this.removeEmitter(id);
    for (const e of this.list) e.material.dispose();
    this.list.length = 0;
  }

  private removeEmitter(id: string): void {
    const e = this.emitters.get(id);
    if (!e) return;
    this.root.remove(e.group);
    e.flameMat?.dispose();
    this.emitters.delete(id);
  }

  private spawn(point: THREE.Vector3, color: number, life: number, fromScale: number, toScale: number, rise = 0, opacity = 1): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, opacity });
    const mesh = new THREE.Mesh(SPHERE, material);
    mesh.position.copy(point);
    mesh.scale.setScalar(fromScale);
    this.root.add(mesh);
    this.list.push({ mesh, material, age: 0, life, fromScale, toScale, rise, opacity });
  }
}
