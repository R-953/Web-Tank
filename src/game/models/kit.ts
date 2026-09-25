import * as THREE from 'three';

/**
 * 程序化低多边形建模的小工具。所有载具模型都用它拼装,保证风格一致。
 *
 * 坐标约定(与 Vehicle 的节点一致):
 *   root        车体中心为原点,车体碰撞盒占 y ∈ [-h/2, h/2],-Z 为车头
 *   turretPivot 位于车体顶面中心,炮塔从 y = 0 往上建
 *   gunPivot    位于炮塔正面中部(耳轴),炮管沿 -Z 伸出 barrelLength 到炮口
 */
export interface ModelParts {
  root: THREE.Group;
  turretPivot: THREE.Group;
  gunPivot: THREE.Group;
}

export type Tuple3 = readonly [number, number, number];

/** 矩形截面:x 左右范围、z 前后范围(z0 为车头一侧) */
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export class ModelKit {
  readonly materials: THREE.MeshStandardMaterial[] = [];

  material(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.1, flatShading: true });
    this.materials.push(m);
    return m;
  }

  add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: Tuple3 = [0, 0, 0], rot?: Tuple3): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
}

/**
 * 六面体:底面矩形在 y0,顶面矩形在 y1,两者可以不同大小 / 错开,
 * 用来做倾斜的首上装甲、内倾的侧装甲、梯形履带侧影等。
 */
export function prism(y0: number, y1: number, bottom: Rect, top: Rect): THREE.BufferGeometry {
  const b = [
    [bottom.x0, y0, bottom.z0],
    [bottom.x1, y0, bottom.z0],
    [bottom.x1, y0, bottom.z1],
    [bottom.x0, y0, bottom.z1],
  ];
  const t = [
    [top.x0, y1, top.z0],
    [top.x1, y1, top.z0],
    [top.x1, y1, top.z1],
    [top.x0, y1, top.z1],
  ];
  const quads = [
    [b[0], b[1], b[2], b[3]],
    [t[0], t[1], t[2], t[3]],
    [b[0], b[1], t[1], t[0]],
    [b[1], b[2], t[2], t[1]],
    [b[2], b[3], t[3], t[2]],
    [b[3], b[0], t[0], t[3]],
  ];
  const center = new THREE.Vector3();
  [...b, ...t].forEach((p) => center.add(new THREE.Vector3(p[0], p[1], p[2])));
  center.divideScalar(8);

  const pos: number[] = [];
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  for (const q of quads) {
    for (const [i, j, k] of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      va.fromArray(q[i]);
      vb.fromArray(q[j]);
      vc.fromArray(q[k]);
      const n = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va));
      if (n.lengthSq() < 1e-12) continue; // 退化三角形(顶面收成一条边时)
      const outward = new THREE.Vector3().add(va).add(vb).add(vc).divideScalar(3).sub(center);
      const tri = n.dot(outward) >= 0 ? [va, vb, vc] : [va, vc, vb];
      tri.forEach((v) => pos.push(v.x, v.y, v.z));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** 对称矩形:宽 w(x),前后 z0..z1 */
export function rect(w: number, z0: number, z1: number): Rect {
  return { x0: -w / 2, x1: w / 2, z0, z1 };
}

/** 轮子:轴线沿 X */
export function wheel(radius: number, width: number, segments = 10): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius, width, segments).rotateZ(Math.PI / 2);
}

/** 沿 -Z 伸出的圆柱(炮管、炮口制退器),从 z0 延伸到 z1(z1 < z0) */
export function tube(rStart: number, rEnd: number, z0: number, z1: number, segments = 8): THREE.BufferGeometry {
  const len = z0 - z1;
  // CylinderGeometry 顶端在 +Y;rotateX(-90°) 后顶端指向 -Z
  return new THREE.CylinderGeometry(rEnd, rStart, len, segments)
    .rotateX(-Math.PI / 2)
    .translate(0, 0, z0 - len / 2);
}

/** 两侧对称放置:对每个 x 符号调用 fn */
export function bothSides(fn: (side: 1 | -1) => void): void {
  fn(-1);
  fn(1);
}

export function darker(color: number, k: number): number {
  return new THREE.Color(color).multiplyScalar(k).getHex();
}
