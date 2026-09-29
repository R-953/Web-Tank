import * as THREE from 'three';

/**
 * 程序化低多边形建模的小工具。所有载具模型都用它拼装,保证风格一致。
 *
 * 坐标约定(与 Vehicle 的节点一致):
 *   root        车体中心为原点,车体碰撞盒占 y ∈ [-h/2, h/2],-Z 为车头,+X 为右
 *   turretPivot 位于车体顶面中心,炮塔从 y = 0 往上建,绕 Y 旋转
 *   gunPivot    位于炮塔正面中部(耳轴),炮管沿 -Z 伸出 barrelLength 到炮口,绕 X 俯仰
 *
 * 性能约定:
 *   - 静态零件按「父节点 × 材质」合并成一个网格(GeoBatch),颜色写进顶点色,
 *     所以每辆车的静态部分只有 3 个网格(车体 / 炮塔 / 火炮)。
 *   - 会动的零件(负重轮、主动轮、诱导轮、履带板)用 InstancedMesh,每帧只改实例矩阵。
 */
export interface ModelParts {
  root: THREE.Group;
  turretPivot: THREE.Group;
  gunPivot: THREE.Group;
}

export type Tuple3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

/** 矩形截面:x 左右范围、z 前后范围(z0 为车头一侧) */
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export const DEG = Math.PI / 180;

const _v = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _mat = new THREE.Matrix4();

/** 由平移 / 欧拉角(XYZ)/ 缩放组成变换矩阵 */
export function transform(pos?: Tuple3, rot?: Tuple3, scale?: Tuple3, out = new THREE.Matrix4()): THREE.Matrix4 {
  _pos.set(pos?.[0] ?? 0, pos?.[1] ?? 0, pos?.[2] ?? 0);
  _quat.setFromEuler(_euler.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0));
  _scl.set(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1);
  return out.compose(_pos, _quat, _scl);
}

/**
 * 静态几何合并批次:把许多零件(各自带颜色和摆放变换)烘焙进一个非索引几何,
 * 颜色写入顶点色,最后生成一个网格。等价于 BufferGeometryUtils.mergeGeometries + 顶点着色
 * (本项目安装的 three 不带 examples/jsm,所以自己实现)。
 */
export class GeoBatch {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly c = new THREE.Color();

  /**
   * @param color 零件颜色;传 null 则沿用几何自带的顶点色(loft / revolve 分段着色的零件)
   */
  add(geo: THREE.BufferGeometry, color: number | null, pos?: Tuple3, rot?: Tuple3, scale?: Tuple3): this {
    return this.addMatrix(geo, color, transform(pos, rot, scale, _mat));
  }

  addMatrix(geo: THREE.BufferGeometry, color: number | null, m: THREE.Matrix4): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.getAttribute('position');
    const own = color === null ? g.getAttribute('color') : undefined;
    this.c.setHex(color ?? 0xffffff);
    // 镜像变换会翻转三角形绕序,交换两个顶点恢复朝外
    const order = m.determinant() < 0 ? [0, 2, 1] : [0, 1, 2];
    for (let i = 0; i + 2 < p.count; i += 3) {
      for (const k of order) {
        _v.fromBufferAttribute(p, i + k).applyMatrix4(m);
        this.pos.push(_v.x, _v.y, _v.z);
        if (own) this.col.push(own.getX(i + k), own.getY(i + k), own.getZ(i + k));
        else this.col.push(this.c.r, this.c.g, this.c.b);
      }
    }
    return this;
  }

  get triangles(): number {
    return this.pos.length / 9;
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
}

export class ModelKit {
  /** 本模型用到的全部材质(受伤闪烁 / 击毁变黑时统一处理) */
  readonly materials: THREE.MeshStandardMaterial[] = [];
  /** 顶点色涂装材质:所有静态件与车轮共用(材质本身为白色,颜色在顶点色里) */
  readonly paint: THREE.MeshStandardMaterial;
  /** 履带板:顶点色 + 略带金属感 */
  readonly steel: THREE.MeshStandardMaterial;

  private readonly batches: Array<{ parent: THREE.Object3D; material: THREE.Material; batch: GeoBatch }> = [];
  private readonly animators: Array<(left: number, right: number) => void> = [];
  private readonly instanced: THREE.InstancedMesh[] = [];

  constructor() {
    this.paint = this.material(0xffffff, 0.82, true);
    this.steel = this.material(0xffffff, 0.7, true, 0.15);
  }

  material(color: number, roughness = 0.85, vertexColors = false, metalness = 0.1): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true, vertexColors });
    this.materials.push(m);
    return m;
  }

  /** 取(或新建)挂在 parent 下、使用 material 的静态合并批次 */
  batch(parent: THREE.Object3D, material: THREE.Material = this.paint): GeoBatch {
    let entry = this.batches.find((b) => b.parent === parent && b.material === material);
    if (!entry) {
      entry = { parent, material, batch: new GeoBatch() };
      this.batches.push(entry);
    }
    return entry.batch;
  }

  /** 直接挂一个独立网格(不合并) */
  add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: Tuple3 = [0, 0, 0], rot?: Tuple3): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** 会动的实例化网格(车轮 / 履带板);实例矩阵由动画函数每帧写入 */
  instancedMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.instanced.push(mesh);
    return mesh;
  }

  onAnimate(fn: (left: number, right: number) => void): void {
    this.animators.push(fn);
  }

  animate(left: number, right: number): void {
    for (const fn of this.animators) fn(left, right);
  }

  /** 生成所有合并网格,把行走机构摆到初始位置 */
  finish(): void {
    for (const { parent, material, batch } of this.batches) {
      if (batch.triangles === 0) continue;
      const mesh = new THREE.Mesh(batch.build(), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.batches.length = 0;
    this.animate(0, 0);
    // 实例包围球:履带板始终在履带环内、车轮原地转动,算一次即可
    for (const m of this.instanced) m.computeBoundingSphere();
  }
}

// ---------------------------------------------------------------------------
// 几何体(全部返回非索引几何;带分段颜色时附 color 属性)
// ---------------------------------------------------------------------------

function makeGeometry(pos: number[], col?: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** 闭合网格按带符号体积判断绕序,体积为负则整体翻转,保证法线朝外 */
function orientOutward(pos: number[], col?: number[]): void {
  let vol = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
    const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  if (vol >= 0) return;
  const swap = (arr: number[], i: number) => {
    for (let k = 0; k < 3; k++) {
      const t = arr[i + 3 + k];
      arr[i + 3 + k] = arr[i + 6 + k];
      arr[i + 6 + k] = t;
    }
  };
  for (let i = 0; i < pos.length; i += 9) {
    swap(pos, i);
    if (col) swap(col, i);
  }
}

class TriList {
  readonly pos: number[] = [];
  readonly col: number[] | undefined;
  private readonly c = new THREE.Color();
  constructor(colored: boolean) {
    this.col = colored ? [] : undefined;
  }
  tri(a: Tuple3, b: Tuple3, c: Tuple3, hex = 0xffffff): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-14) return; // 退化三角形
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    if (this.col) {
      this.c.setHex(hex);
      for (let k = 0; k < 3; k++) this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }
  geometry(): THREE.BufferGeometry {
    orientOutward(this.pos, this.col);
    return makeGeometry(this.pos, this.col);
  }
}

export interface LoftOptions {
  /** 每一段(相邻两圈之间)的颜色;不给则不写顶点色。数组短于段数时沿用最后一个 */
  colors?: readonly number[];
  /** 起端 / 末端封口颜色;null 表示不封口;缺省沿用相邻段的颜色 */
  startCap?: number | null;
  endCap?: number | null;
  /** 条纹:第 band 段里每隔 every 个面换成 color(车轮辐板 / 减重坑,转动时看得出来) */
  stripes?: ReadonlyArray<{ band: number; color: number; every: number }>;
}

/**
 * 放样:把若干圈点数相同的轮廓依次连成筒面,两端扇形封口(每圈须为凸多边形)。
 * 适合炮塔(铸造圆炮塔、楔形炮塔)、旋转体(炮管、指挥塔、车轮)等凸截面形体。
 */
export function loft(rings: readonly (readonly Tuple3[])[], opts: LoftOptions = {}): THREE.BufferGeometry {
  const list = new TriList(opts.colors !== undefined);
  const colors = opts.colors ?? [0xffffff];
  const band = (i: number) => colors[Math.max(0, Math.min(i, colors.length - 1))];
  const n = rings[0].length;
  for (let i = 0; i + 1 < rings.length; i++) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    const stripe = opts.stripes?.find((st) => st.band === i);
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const hex = stripe && j % stripe.every === 0 ? stripe.color : band(i);
      list.tri(r0[j], r0[j1], r1[j1], hex);
      list.tri(r0[j], r1[j1], r1[j], hex);
    }
  }
  // 凸截面:从第 0 个顶点扇形封口(n - 2 个三角形)
  const cap = (ring: readonly Tuple3[], reverse: boolean, hex: number) => {
    for (let j = 1; j + 1 < n; j++) {
      if (reverse) list.tri(ring[0], ring[j + 1], ring[j], hex);
      else list.tri(ring[0], ring[j], ring[j + 1], hex);
    }
  };
  if (opts.startCap !== null) cap(rings[0], true, opts.startCap ?? band(0));
  if (opts.endCap !== null) cap(rings[rings.length - 1], false, opts.endCap ?? band(rings.length - 2));
  return list.geometry();
}

export type Axis = 'x' | 'y' | 'z';

/**
 * 旋转体:profile 为 [半径, 轴向坐标] 序列,绕 axis 轴旋转一周。
 * 轴向 'z' 用于炮管 / 防盾(-Z 为炮口方向),'x' 用于车轮,'y' 用于指挥塔、舱盖、排气管。
 */
export function revolve(profile: readonly Vec2[], axis: Axis, segments = 12, opts?: LoftOptions, phase = 0): THREE.BufferGeometry {
  const rings = profile.map(([r, a]) => {
    const ring: Tuple3[] = [];
    for (let k = 0; k < segments; k++) {
      const t = phase + (k / segments) * Math.PI * 2;
      const u = r * Math.cos(t);
      const v = r * Math.sin(t);
      ring.push(axis === 'x' ? [a, u, v] : axis === 'y' ? [u, a, v] : [u, v, a]);
    }
    return ring;
  });
  return loft(rings, opts);
}

/**
 * 拉伸:outline 为二维轮廓(可凹),沿 axis 从 a0 拉伸到 a1。轮廓坐标含义:
 *   'x' → (z, y) 侧视轮廓,沿车宽方向拉伸(车体侧面剖面、防盾截面、挡泥板)
 *   'y' → (x, z) 俯视轮廓,沿高度拉伸(马蹄形炮塔、舱盖)
 *   'z' → (x, y) 正视轮廓,沿前后方向拉伸
 */
export function extrude(outline: readonly Vec2[], axis: Axis, a0: number, a1: number, color?: number): THREE.BufferGeometry {
  const P = (u: number, v: number, a: number): Tuple3 => (axis === 'x' ? [a, v, u] : axis === 'y' ? [u, a, v] : [u, v, a]);
  const list = new TriList(color !== undefined);
  const hex = color ?? 0xffffff;
  const n = outline.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [u0, v0] = outline[i];
    const [u1, v1] = outline[(i + 1) % n];
    area += u0 * v1 - u1 * v0;
  }
  const faces = THREE.ShapeUtils.triangulateShape(
    outline.map(([u, v]) => new THREE.Vector2(u, v)),
    [],
  );
  for (const f of faces) {
    let [i, j, k] = f;
    const [ui, vi] = outline[i];
    const [uj, vj] = outline[j];
    const [uk, vk] = outline[k];
    // 让封口三角形与轮廓同向,再按端面翻转,保证与侧面绕序一致
    if (((uj - ui) * (vk - vi) - (vj - vi) * (uk - ui)) * area < 0) [j, k] = [k, j];
    list.tri(P(outline[i][0], outline[i][1], a0), P(outline[k][0], outline[k][1], a0), P(outline[j][0], outline[j][1], a0), hex);
    list.tri(P(outline[i][0], outline[i][1], a1), P(outline[j][0], outline[j][1], a1), P(outline[k][0], outline[k][1], a1), hex);
  }
  for (let i = 0; i < n; i++) {
    const [u0, v0] = outline[i];
    const [u1, v1] = outline[(i + 1) % n];
    list.tri(P(u0, v0, a0), P(u1, v1, a0), P(u1, v1, a1), hex);
    list.tri(P(u0, v0, a0), P(u1, v1, a1), P(u0, v0, a1), hex);
  }
  return list.geometry();
}

/**
 * 六面体:底面矩形在 y0,顶面矩形在 y1,两者可以不同大小 / 错开,
 * 用来做倾斜的首上装甲、内倾的侧装甲、梯形履带侧影等。
 */
export function prism(y0: number, y1: number, bottom: Rect, top: Rect): THREE.BufferGeometry {
  const b: Tuple3[] = [
    [bottom.x0, y0, bottom.z0],
    [bottom.x1, y0, bottom.z0],
    [bottom.x1, y0, bottom.z1],
    [bottom.x0, y0, bottom.z1],
  ];
  const t: Tuple3[] = [
    [top.x0, y1, top.z0],
    [top.x1, y1, top.z0],
    [top.x1, y1, top.z1],
    [top.x0, y1, top.z1],
  ];
  return loft([b, t]);
}

/** 对称矩形:宽 w(x),前后 z0..z1 */
export function rect(w: number, z0: number, z1: number): Rect {
  return { x0: -w / 2, x1: w / 2, z0, z1 };
}

export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

/** 竖直圆柱(轴线沿 Y,中心在原点) */
export function cyl(rTop: number, rBottom: number, h: number, segments = 8): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBottom, h, segments);
}

/** 轮子:轴线沿 X */
export function wheel(radius: number, width: number, segments = 10): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius, width, segments).rotateZ(Math.PI / 2);
}

/** 沿 -Z 伸出的圆柱(炮管、炮口制退器),从 z0 延伸到 z1(z1 < z0) */
export function tube(rStart: number, rEnd: number, z0: number, z1: number, segments = 8): THREE.BufferGeometry {
  const len = z0 - z1;
  // CylinderGeometry 顶端在 +Y;rotateX(-90°) 后顶端指向 -Z
  return new THREE.CylinderGeometry(rEnd, rStart, len, segments).rotateX(-Math.PI / 2).translate(0, 0, z0 - len / 2);
}

/** 连接两点的细杆(扶手、拖车钢缆、工具柄) */
export function rod(a: Tuple3, b: Tuple3, radius: number, segments = 5): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, segments, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return geo.applyMatrix4(new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
}

/** 两侧对称放置:对每个 x 符号调用 fn */
export function bothSides(fn: (side: 1 | -1) => void): void {
  fn(-1);
  fn(1);
}

export function darker(color: number, k: number): number {
  return new THREE.Color(color).multiplyScalar(k).getHex();
}

/** 通用配色:涂装色派生的明暗 + 常用金属 / 橡胶 / 木柄颜色 */
export function palette(color: number) {
  return {
    paint: color,
    light: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.12).getHex(),
    shade: darker(color, 0.8),
    deep: darker(color, 0.6),
    dark: 0x1b1b19,
    steel: 0x55544e,
    rust: 0x6a4630,
    rubber: 0x2a2a28,
    track: 0x5b564d,
    wood: 0x7a5b3c,
    lens: 0xd6dde0,
  };
}
export type Palette = ReturnType<typeof palette>;
