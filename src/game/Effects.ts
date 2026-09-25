import * as THREE from 'three';

export type ImpactKind = 'penetration' | 'bounce' | 'ground';

interface Effect {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  fromScale: number;
  toScale: number;
}

const SPHERE = new THREE.IcosahedronGeometry(1, 1);

const IMPACT_STYLE: Record<ImpactKind, { color: number; size: number }> = {
  penetration: { color: 0xff7a1a, size: 0.9 },
  bounce: { color: 0xe8e8e8, size: 0.6 },
  ground: { color: 0x8a7a5a, size: 0.8 },
};

/** 简单的一次性特效(命中火花、爆炸、炮口焰),按游戏时间推进 */
export class Effects {
  readonly root = new THREE.Group();
  private readonly list: Effect[] = [];

  impact(point: THREE.Vector3, kind: ImpactKind): void {
    const s = IMPACT_STYLE[kind];
    this.spawn(point, s.color, 0.25, s.size * 0.3, s.size);
  }

  explosion(point: THREE.Vector3): void {
    this.spawn(point, 0xffa040, 0.8, 1.0, 5.0);
    this.spawn(point.clone().setY(point.y + 1), 0x3a3a3a, 1.6, 1.5, 6.0);
  }

  muzzleFlash(point: THREE.Vector3): void {
    this.spawn(point, 0xffe0a0, 0.08, 0.4, 0.9);
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.age += dt;
      const t = Math.min(1, e.age / e.life);
      e.mesh.scale.setScalar(e.fromScale + (e.toScale - e.fromScale) * t);
      e.material.opacity = 1 - t;
      if (t >= 1) {
        this.root.remove(e.mesh);
        e.material.dispose();
        this.list.splice(i, 1);
      }
    }
  }

  get count(): number {
    return this.list.length;
  }

  private spawn(point: THREE.Vector3, color: number, life: number, fromScale: number, toScale: number): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(SPHERE, material);
    mesh.position.copy(point);
    mesh.scale.setScalar(fromScale);
    this.root.add(mesh);
    this.list.push({ mesh, material, age: 0, life, fromScale, toScale });
  }
}
