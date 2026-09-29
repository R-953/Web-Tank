import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { PlantKind, SurfaceType, Vec2, VegetationSpec, VegetationZone } from '../data/types';
import type { GameMap } from './Map';
import { makeRng } from './damage/geometry';

/**
 * 植被:树(阔叶 / 针叶)、灌木、草丛。
 *
 * - 位置:植被区(圆 / 多边形)里按密度用固定种子撒点,每次加载完全一样;水面、陡坡、障碍物和出生点附近跳过。
 *   画质设置里的「植被密度」按每棵植物自己的哈希值确定性地抽稀,不会让剩下的植物挪位置。
 * - 树:树干有 Rapier 圆柱碰撞体,会挡车、挡炮弹;坦克动量够大就把树撞倒(倒向行驶方向),
 *   主炮打中会被打断,机枪只能打断细树。倒下的树不再有碰撞体。树冠挡视线(敌方 AI 看不穿)。
 * - 灌木:没有碰撞体,车压过去就碎;主炮炮弹穿过时打碎,机枪要打几发。完好的灌木挡视线,可以藏车。
 * - 草丛:不存数据,按 32 m 分块在镜头附近按需生成(同一块每次生成都一样);履带压过会被压倒,
 *   过几秒慢慢恢复原形。草丛不挡炮弹和视线。
 */

export interface Plant {
  index: number;
  kind: PlantKind;
  x: number;
  y: number;
  z: number;
  scale: number;
  /** 绕 Y 轴随机转角 */
  rot: number;
  /** 树干半径 / 灌木半径,m */
  radius: number;
  /** 树高 / 灌木高,m */
  height: number;
  /** 树冠(或灌木)球心高度与半径,挡视线用 */
  crownY: number;
  crownR: number;
  hp: number;
  state: 'ok' | 'falling' | 'down' | 'gone';
  /** 倒下的方向(水平单位向量)与进度 0..1 */
  fallDir: Vec2;
  fall: number;
  collider: RAPIER.Collider | null;
}

export interface VegetationOptions {
  /** 植被密度 0..1(画质设置) */
  density: number;
  /** 草丛渲染半径,m;0 = 不要草 */
  grassDistance: number;
  /** 这些点周围不长树和灌木(出生点) */
  clearPoints: Vec2[];
  /** 是否生成渲染用的网格(测试里可以关掉) */
  render?: boolean;
}

/** 植物的基本尺寸:树高、树干半径 / 灌木半径、树冠半径,再乘个体的 scale */
const PLANT_SIZE: Record<PlantKind, { height: number; radius: number; crown: number; hp: number; minSpacing: number }> = {
  tree: { height: 11, radius: 0.25, crown: 3.2, hp: 8, minSpacing: 4 },
  pine: { height: 15, radius: 0.22, crown: 2.6, hp: 7, minSpacing: 3.5 },
  // 灌木高约 2.2–3.4 m,足够遮住一辆趴着的坦克的炮塔;hp = 机枪子弹命中次数(主炮炮弹一发打碎)
  bush: { height: 2.8, radius: 1.6, crown: 1.6, hp: 12, minSpacing: 1 },
};

/** 撞倒一棵树需要的动量(kg·m/s)= 该系数 × 树干半径² */
const TREE_BREAK_MOMENTUM_PER_R2 = 150_000;
/** 针叶树冠的下沿高度(占树高的比例),渲染和挡视线共用 */
const PINE_CROWN_BASE = 0.1;
/** 推树时即使车已经被顶住,也按这个速度估算推力(m/s) */
const PUSH_SPEED = 1.0;
const FALL_TIME = 1.6;
const GRASS_CHUNK = 32;
/** 各地表上草丛的相对密度 */
const GRASS_BY_SURFACE: Record<SurfaceType, number> = { grass: 1, dirt: 0.45, sand: 0.06, rock: 0.12, mud: 0.25, water: 0 };
const GRASS_FLATTEN_HOLD = 1.5;
const GRASS_RECOVER_TIME = 4;

const UP = new THREE.Vector3(0, 1, 0);
/** 渲染地块边长,m */
const TILE = 200;
/** 阔叶树冠的竖向拉长比例(椭球) */
const CROWN_STRETCH = 1.25;
type MeshPart = 'trunk' | 'crown' | 'pineTrunk' | 'pineCrown' | 'bush';

/** 点是否在多边形内(射线法) */
export function pointInPolygon(x: number, z: number, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(poly: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(a / 2);
}

/** 整数哈希 → 0..1(确定性抽稀、分块种子用) */
function hash01(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

interface GrassChunk {
  key: string;
  cx: number;
  cz: number;
  /** 每丛草:x, y, z, 转角, 大小 */
  data: Float32Array;
  count: number;
  /** 被压倒的程度 0..1 与最后一次被压的时间 */
  bend: Float32Array;
  pressedAt: Float32Array;
  mesh: THREE.InstancedMesh | null;
}

export class Vegetation {
  readonly root = new THREE.Group();
  readonly plants: Plant[] = [];
  private readonly grid = new Map<string, Plant[]>();
  /**
   * 因画质密度被抽掉的点也要参与最小间距判断,否则低密度下后面的点会「挤进」空出来的位置,
   * 留下的植物就不再是满密度的子集了。
   */
  private readonly ghosts = new Map<string, { kind: PlantKind; x: number; z: number; crownR: number }[]>();
  private readonly cell = 25;
  private readonly byCollider = new Map<number, Plant>();
  /**
   * 渲染网格按 TILE × TILE 米的地块分开(每块每种部件一个 InstancedMesh),
   * 这样主画面和阴影都能按地块做视锥剔除,不必每帧画整张地图的树。
   */
  private readonly tiles = new Map<string, Partial<Record<MeshPart, THREE.InstancedMesh>>>();
  /** 每棵植物所在的地块和实例编号 */
  private readonly slot = new Map<Plant, { tile: string; i: number }>();
  private readonly sharedGeo: THREE.BufferGeometry[] = [];
  private readonly sharedMat: THREE.Material[] = [];
  private readonly animating = new Set<Plant>();
  /** 已经倒下、等下一个物理步之前再移除的树干碰撞体(见 flush) */
  private readonly pendingRemoval: RAPIER.Collider[] = [];
  private readonly grassChunks = new Map<string, GrassChunk>();
  private readonly grassRecovering = new Set<GrassChunk>();
  private grassGeo: THREE.BufferGeometry | null = null;
  private grassMat: THREE.Material | null = null;
  private readonly render: boolean;
  private time = 0;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor(
    private readonly map: GameMap,
    private readonly spec: VegetationSpec | undefined,
    private readonly world: RAPIER.World,
    private readonly options: VegetationOptions,
  ) {
    this.root.name = 'vegetation';
    this.render = options.render !== false;
    if (spec) {
      spec.zones.forEach((z) => this.scatter(z));
      for (const p of this.plants) if (p.kind !== 'bush') this.addTreeCollider(p);
    }
    if (this.render) this.buildMeshes();
  }

  // ------------------------------------------------------------------ 生成

  private scatter(zone: VegetationZone): void {
    const rng = makeRng(zone.seed);
    const size = PLANT_SIZE[zone.kind];
    const [smin, smax] = zone.scale ?? [0.8, 1.2];
    let area: number;
    let bounds: [number, number, number, number];
    let inside: (x: number, z: number) => boolean;
    if (zone.polygon && zone.polygon.length >= 3) {
      const poly = zone.polygon;
      area = polygonArea(poly);
      const xs = poly.map((p) => p[0]);
      const zs = poly.map((p) => p[1]);
      bounds = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      inside = (x, z) => pointInPolygon(x, z, poly);
    } else {
      const [cx, cz] = zone.at ?? [0, 0];
      const r = zone.radius ?? 50;
      area = Math.PI * r * r;
      bounds = [cx - r, cx + r, cz - r, cz + r];
      inside = (x, z) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r;
    }
    const target = Math.round((area * zone.density) / 10_000);
    const clear = this.spec?.clearRadius ?? 12;
    const half = this.map.half - 5;
    let placed = 0;
    for (let attempt = 0; attempt < target * 6 && placed < target; attempt++) {
      const x = bounds[0] + (bounds[1] - bounds[0]) * rng();
      const z = bounds[2] + (bounds[3] - bounds[2]) * rng();
      const scale = smin + (smax - smin) * rng();
      const rot = rng() * Math.PI * 2;
      const keep = rng();
      if (!inside(x, z) || Math.abs(x) > half || Math.abs(z) > half) continue;
      if (this.options.clearPoints.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < clear * clear)) continue;
      const surface = this.map.surfaceAt(x, z);
      if (surface === 'water' || (zone.kind !== 'bush' && surface === 'mud')) continue;
      if (this.slope(x, z) > (zone.kind === 'bush' ? 0.7 : 0.55)) continue;
      if (this.nearObstacle(x, z, size.radius * scale + 2)) continue;
      const spacing = size.minSpacing * scale;
      if (this.nearby(x, z, spacing).some((p) => p.kind === zone.kind) || this.nearGhost(zone.kind, x, z, spacing)) continue;
      placed++;
      // 画质抽稀:在上面所有随机数都用过之后再判断,保证不同密度下留下的植物位置不变
      if (keep > this.options.density) {
        const key = this.key(x, z);
        const list = this.ghosts.get(key) ?? [];
        list.push({ kind: zone.kind, x, z, crownR: (zone.kind === 'bush' ? size.radius : size.crown) * scale });
        this.ghosts.set(key, list);
        continue;
      }
      this.addPlant(zone.kind, x, z, scale, rot);
    }
  }

  private addPlant(kind: PlantKind, x: number, z: number, scale: number, rot: number): Plant {
    const size = PLANT_SIZE[kind];
    const height = size.height * scale;
    const crownR = size.crown * scale;
    const p: Plant = {
      index: this.plants.length,
      kind,
      x,
      y: this.map.heightAt(x, z),
      z,
      scale,
      rot,
      radius: size.radius * scale,
      height,
      crownY: kind === 'bush' ? height * 0.5 : kind === 'pine' ? height * (PINE_CROWN_BASE + 0.3) : height - crownR * CROWN_STRETCH,
      crownR: kind === 'bush' ? size.radius * scale : crownR,
      hp: Math.max(1, Math.round(size.hp * scale)),
      state: 'ok',
      fallDir: [1, 0],
      fall: 0,
      collider: null,
    };
    this.plants.push(p);
    const key = this.key(x, z);
    const list = this.grid.get(key) ?? [];
    list.push(p);
    this.grid.set(key, list);
    return p;
  }

  private addTreeCollider(p: Plant): void {
    const trunkH = Math.min(5, p.height * 0.45);
    const desc = RAPIER.ColliderDesc.cylinder(trunkH / 2, p.radius).setTranslation(p.x, p.y + trunkH / 2, p.z).setFriction(0.6);
    p.collider = this.world.createCollider(desc);
    this.byCollider.set(p.collider.handle, p);
  }

  private nearGhost(kind: PlantKind, x: number, z: number, r: number): boolean {
    const cx0 = Math.floor((x - r) / this.cell);
    const cx1 = Math.floor((x + r) / this.cell);
    const cz0 = Math.floor((z - r) / this.cell);
    const cz1 = Math.floor((z + r) / this.cell);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        for (const g of this.ghosts.get(`${cx},${cz}`) ?? []) {
          // 与 nearby() 一致:间距 + 对方的树冠半径
          const reach = r + g.crownR;
          if (g.kind === kind && (g.x - x) ** 2 + (g.z - z) ** 2 <= reach * reach) return true;
        }
      }
    }
    return false;
  }

  private slope(x: number, z: number): number {
    const d = 2;
    const hx = this.map.heightAt(x + d, z) - this.map.heightAt(x - d, z);
    const hz = this.map.heightAt(x, z + d) - this.map.heightAt(x, z - d);
    return Math.hypot(hx, hz) / (2 * d);
  }

  private nearObstacle(x: number, z: number, r: number): boolean {
    return this.map.spec.obstacles.some((o) => {
      const reach = Math.hypot(o.size[0], o.size[2]) / 2 + r;
      return (o.position[0] - x) ** 2 + (o.position[1] - z) ** 2 < reach * reach;
    });
  }

  private key(x: number, z: number): string {
    return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
  }

  /** 半径 r 内的植物(所有状态) */
  nearby(x: number, z: number, r: number): Plant[] {
    const out: Plant[] = [];
    const c0x = Math.floor((x - r) / this.cell);
    const c1x = Math.floor((x + r) / this.cell);
    const c0z = Math.floor((z - r) / this.cell);
    const c1z = Math.floor((z + r) / this.cell);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        for (const p of this.grid.get(`${cx},${cz}`) ?? []) {
          if ((p.x - x) ** 2 + (p.z - z) ** 2 <= (r + p.crownR) ** 2) out.push(p);
        }
      }
    }
    return out;
  }

  /** 按碰撞体找树 */
  treeByCollider(handle: number): Plant | undefined {
    return this.byCollider.get(handle);
  }

  count(kind: PlantKind, state: Plant['state'] = 'ok'): number {
    return this.plants.filter((p) => p.kind === kind && p.state === state).length;
  }

  // ------------------------------------------------------------------ 破坏

  /** 把树放倒:去掉碰撞体,开始倒下的动画 */
  fellTree(p: Plant, dirX: number, dirZ: number): void {
    if (p.kind === 'bush' || p.state !== 'ok') return;
    const len = Math.hypot(dirX, dirZ) || 1;
    p.fallDir = [dirX / len, dirZ / len];
    p.state = 'falling';
    p.fall = 0;
    // 碰撞体不立刻删:同一个物理步里其他炮弹的射线检测可能还会查到它(那时 hitTree 会让炮弹直接穿过)
    if (p.collider) {
      this.pendingRemoval.push(p.collider);
      p.collider = null;
    }
    this.animating.add(p);
  }

  /** 移除本步倒下的树的碰撞体;在 world.step() 之前调用 */
  flush(): void {
    for (const c of this.pendingRemoval) {
      this.byCollider.delete(c.handle);
      this.world.removeCollider(c, true);
    }
    this.pendingRemoval.length = 0;
  }

  /**
   * 炮弹 / 子弹穿过灌木:主炮炮弹(≥ 20 mm)一发打碎,机枪子弹每发扣 1 点。
   * 灌木不挡弹,炮弹继续飞。返回灌木是否被打碎。
   */
  hitBush(p: Plant, caliber: number): boolean {
    if (p.kind !== 'bush' || p.state !== 'ok') return false;
    p.hp -= caliber >= 20 ? p.hp : 1;
    if (p.hp > 0) return false;
    this.destroyBush(p);
    return true;
  }

  /** 打碎 / 压碎灌木 */
  destroyBush(p: Plant): void {
    if (p.kind !== 'bush' || p.state !== 'ok') return;
    p.state = 'gone';
    p.hp = 0;
    this.writeInstance(p);
  }

  /**
   * 炮弹 / 子弹打中树干。返回炮弹是否被挡下:
   * 主炮动能弹把树打断后继续飞;化学能弹在树上起爆;机枪子弹被挡下(细树打几发会断)。
   */
  hitTree(p: Plant, dirX: number, dirZ: number, caliber: number, chemical: boolean): { stopped: boolean; felled: boolean } {
    if (p.state !== 'ok') return { stopped: false, felled: false };
    if (caliber >= 20) {
      this.fellTree(p, dirX, dirZ);
      return { stopped: chemical, felled: true };
    }
    p.hp -= 1;
    if (p.hp <= 0 && p.radius < 0.2) {
      this.fellTree(p, dirX, dirZ);
      return { stopped: true, felled: true };
    }
    return { stopped: true, felled: false };
  }

  /** 炮弹飞过的线段穿过的完好灌木(按沿线距离排序) */
  bushesOnSegment(a: THREE.Vector3, b: THREE.Vector3): Plant[] {
    const out: { p: Plant; t: number }[] = [];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len2 = dx * dx + dy * dy + dz * dz;
    if (len2 === 0) return [];
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const reach = Math.sqrt(len2) / 2 + 3;
    for (const p of this.nearby(mx, mz, reach)) {
      if (p.kind !== 'bush' || p.state !== 'ok') continue;
      const cy = p.y + p.crownY;
      let t = ((p.x - a.x) * dx + (cy - a.y) * dy + (p.z - a.z) * dz) / len2;
      t = Math.min(1, Math.max(0, t));
      const d2 = (a.x + dx * t - p.x) ** 2 + (a.y + dy * t - cy) ** 2 + (a.z + dz * t - p.z) ** 2;
      if (d2 <= p.crownR * p.crownR) out.push({ p, t });
    }
    return out.sort((x, y) => x.t - y.t).map((x) => x.p);
  }

  /**
   * 视线是否被植被挡住:线段穿过完好灌木或完好树冠即算挡住。
   * 起点附近 fromClear 米内的植物不算(趴在灌木里的车能看出去)。
   */
  blocksSight(a: THREE.Vector3, b: THREE.Vector3, fromClear = 4): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1) return false;
    const steps = Math.ceil(len / 40);
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const mx = a.x + dx * ((t0 + t1) / 2);
      const mz = a.z + dz * ((t0 + t1) / 2);
      for (const p of this.nearby(mx, mz, (len / steps) / 2 + 1)) {
        if (p.state !== 'ok') continue;
        if (p.kind === 'pine') {
          // 针叶树冠是个圆锥:下沿半径 crownR,越往上越细。取线段在水平面上离树轴最近的点,看那里的高度在不在树冠里
          const h2 = dx * dx + dz * dz;
          if (h2 < 1e-6) continue;
          const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / h2));
          if (t * len < fromClear) continue;
          const d = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
          const y = a.y + dy * t - p.y;
          const base = p.height * PINE_CROWN_BASE;
          if (y < base || y > p.height) continue;
          const r = p.crownR * (1 - (y - base) / (p.height - base)) * 0.8;
          if (d <= r) return true;
          continue;
        }
        const cy = p.y + p.crownY;
        let t = ((p.x - a.x) * dx + (cy - a.y) * dy + (p.z - a.z) * dz) / (len * len);
        t = Math.min(1, Math.max(0, t));
        if (t * len < fromClear) continue;
        // 阔叶树冠是竖向拉长的椭球
        const sy = p.kind === 'bush' ? 1 : CROWN_STRETCH;
        const d2 = (a.x + dx * t - p.x) ** 2 + ((a.y + dy * t - cy) / sy) ** 2 + (a.z + dz * t - p.z) ** 2;
        const r = p.kind === 'bush' ? p.crownR * 0.9 : p.crownR * 0.8;
        if (d2 <= r * r) return true;
      }
    }
    return false;
  }

  /**
   * 车辆与植被的互动(每个固定步、物理步之前调用):
   *   压碎覆盖到的灌木;前后方顶到的树,动量够就撞倒(车速损失一点),不够就被树干碰撞体挡住;
   *   履带下的草丛被压倒。
   * @returns 撞倒的树(调用方可以播放音效)
   */
  interactVehicle(v: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    length: number;
    width: number;
    mass: number;
    forwardSpeed: number;
    /** 驾驶员正在往哪个方向推(油门方向,-1 / 0 / 1) */
    pushing: number;
  }): Plant[] {
    const felled: Plant[] = [];
    const inv = this.q.copy(v.quaternion).invert();
    const reach = Math.hypot(v.length, v.width) / 2 + 3;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(v.quaternion);
    for (const p of this.nearby(v.position.x, v.position.z, reach)) {
      if (p.state !== 'ok') continue;
      const local = this.v.set(p.x - v.position.x, 0, p.z - v.position.z).applyQuaternion(inv);
      const hx = v.width / 2;
      const hz = v.length / 2;
      if (p.kind === 'bush') {
        const r = p.radius * 0.6;
        if (Math.abs(local.x) <= hx + r && Math.abs(local.z) <= hz + r) this.destroyBush(p);
        continue;
      }
      const margin = 0.2;
      if (Math.abs(local.x) > hx + p.radius + margin || Math.abs(local.z) > hz + p.radius + margin) continue;
      // 树在车头前方(local.z < 0)时只有往前推才算,在车尾后方时只有倒车才算
      const ahead = local.z < 0 ? 1 : -1;
      const moving = Math.sign(v.forwardSpeed) === ahead ? Math.abs(v.forwardSpeed) : 0;
      const push = v.pushing === ahead ? PUSH_SPEED : 0;
      const momentum = v.mass * Math.max(moving, push);
      if (momentum >= TREE_BREAK_MOMENTUM_PER_R2 * p.radius * p.radius) {
        this.fellTree(p, fwd.x * ahead, fwd.z * ahead);
        felled.push(p);
      }
    }
    this.pressGrass(v.position, inv, v.length, v.width);
    return felled;
  }

  // ------------------------------------------------------------------ 每帧

  /** 推进倒树动画、草丛分块加载与恢复 */
  update(dt: number, camera: THREE.Vector3): void {
    this.time += dt;
    for (const p of this.animating) {
      p.fall = Math.min(1, p.fall + dt / FALL_TIME);
      this.writeInstance(p);
      if (p.fall >= 1) {
        p.state = 'down';
        this.animating.delete(p);
        const slot = this.slot.get(p);
        if (slot && this.render) this.updateBounds(slot.tile);
      }
    }
    if (this.render && this.options.grassDistance > 0 && this.spec?.grass) this.streamGrass(camera);
    this.recoverGrass();
  }

  dispose(): void {
    this.pendingRemoval.length = 0;
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const t of this.tiles.values()) Object.values(t).forEach((m) => m?.dispose());
    this.sharedGeo.forEach((g) => g.dispose());
    this.sharedMat.forEach((m) => m.dispose());
    this.grassMat?.dispose();
    this.grassGeo?.dispose();
    for (const c of this.grassChunks.values()) c.mesh?.dispose();
  }

  // ------------------------------------------------------------------ 渲染

  private buildMeshes(): void {
    const bark = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1, flatShading: true });
    const leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
    const needle = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
    const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });

    // 单位几何体:树干底部在原点、高 1、半径 1;树冠 / 灌木是半径 1 的多面体
    const trunk = new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0);
    const crown = new THREE.IcosahedronGeometry(1, 1);
    const pineCrown = mergeCones();
    const bush = new THREE.IcosahedronGeometry(1, 1).scale(1, 0.85, 1);
    jiggle(crown, 0.18, 11);
    jiggle(bush, 0.2, 23);
    this.sharedGeo.push(trunk, crown, pineCrown, bush);
    this.sharedMat.push(bark, leaf, needle, bushMat);

    const parts: Record<PlantKind, { part: MeshPart; geo: THREE.BufferGeometry; mat: THREE.Material; colors?: [number, number] }[]> = {
      tree: [
        { part: 'trunk', geo: trunk, mat: bark },
        { part: 'crown', geo: crown, mat: leaf, colors: [0x4f7a2a, 0x6f8f35] },
      ],
      pine: [
        { part: 'pineTrunk', geo: trunk, mat: bark },
        { part: 'pineCrown', geo: pineCrown, mat: needle, colors: [0x2f5a2c, 0x3f6b35] },
      ],
      bush: [{ part: 'bush', geo: bush, mat: bushMat, colors: [0x4d6b2a, 0x6a7f34] }],
    };

    // 按地块分组
    const groups = new Map<string, Map<PlantKind, Plant[]>>();
    for (const p of this.plants) {
      const tile = `${Math.floor(p.x / TILE)},${Math.floor(p.z / TILE)}`;
      const byKind = groups.get(tile) ?? new Map<PlantKind, Plant[]>();
      const list = byKind.get(p.kind) ?? [];
      this.slot.set(p, { tile, i: list.length });
      list.push(p);
      byKind.set(p.kind, list);
      groups.set(tile, byKind);
    }
    const c0 = new THREE.Color();
    const c1 = new THREE.Color();
    const c = new THREE.Color();
    for (const [tile, byKind] of groups) {
      const meshes: Partial<Record<MeshPart, THREE.InstancedMesh>> = {};
      for (const [kind, list] of byKind) {
        for (const def of parts[kind]) {
          const mesh = new THREE.InstancedMesh(def.geo, def.mat, list.length);
          mesh.castShadow = kind !== 'bush';
          mesh.receiveShadow = true;
          mesh.name = `veg:${def.part}:${tile}`;
          if (def.colors) {
            c0.set(def.colors[0]);
            c1.set(def.colors[1]);
            list.forEach((p, i) => mesh.setColorAt(i, c.copy(c0).lerp(c1, hash01(p.index, 7))));
          }
          meshes[def.part] = mesh;
          this.root.add(mesh);
        }
      }
      this.tiles.set(tile, meshes);
    }
    for (const p of this.plants) this.writeInstance(p);
    this.updateBounds();
  }

  /** 重新计算各地块网格的包围球(视锥剔除用);倒下的树会伸出地块,留足余量 */
  private updateBounds(tile?: string): void {
    const list = tile ? [this.tiles.get(tile)] : [...this.tiles.values()];
    for (const t of list) {
      for (const m of Object.values(t ?? {})) {
        if (!m) continue;
        m.computeBoundingSphere();
        if (m.boundingSphere) m.boundingSphere.radius += 16;
      }
    }
  }

  /** 按植物当前状态写实例矩阵(倒下的树绕树根旋转) */
  private writeInstance(p: Plant): void {
    if (!this.render) return;
    const slot = this.slot.get(p);
    if (!slot) return;
    const meshes = this.tiles.get(slot.tile);
    if (!meshes) return;
    const i = slot.i;
    const base = new THREE.Matrix4();
    const tilt = p.state === 'falling' || p.state === 'down' ? easeFall(p.fall) * (Math.PI / 2 - 0.08) : 0;
    const axis = new THREE.Vector3(p.fallDir[1], 0, -p.fallDir[0]); // 水平面内垂直于倒向的轴
    const q = new THREE.Quaternion().setFromAxisAngle(axis, -tilt).multiply(new THREE.Quaternion().setFromAxisAngle(UP, p.rot));
    base.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1));
    const set = (name: MeshPart, local: THREE.Matrix4) => {
      const mesh = meshes[name];
      if (!mesh) return;
      mesh.setMatrixAt(i, this.m4.multiplyMatrices(base, local));
      mesh.instanceMatrix.needsUpdate = true;
    };
    if (p.kind === 'bush') {
      const s = p.state === 'gone' ? 0.0001 : p.radius;
      set('bush', new THREE.Matrix4().compose(new THREE.Vector3(0, p.crownY, 0), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
      return;
    }
    const trunkH = p.kind === 'pine' ? p.height * 0.9 : p.crownY + p.crownR * 0.5;
    const trunkM = new THREE.Matrix4().makeScale(p.radius, trunkH, p.radius);
    const crownM = new THREE.Matrix4().compose(
      new THREE.Vector3(0, p.kind === 'pine' ? p.height * PINE_CROWN_BASE : p.crownY, 0),
      new THREE.Quaternion(),
      p.kind === 'pine'
        ? new THREE.Vector3(p.crownR, p.height * (1 - PINE_CROWN_BASE), p.crownR)
        : new THREE.Vector3(p.crownR, p.crownR * CROWN_STRETCH, p.crownR),
    );
    set(p.kind === 'pine' ? 'pineTrunk' : 'trunk', trunkM);
    set(p.kind === 'pine' ? 'pineCrown' : 'crown', crownM);
  }

  // ------------------------------------------------------------------ 草丛

  private streamGrass(camera: THREE.Vector3): void {
    const R = this.options.grassDistance;
    const c0x = Math.floor((camera.x - R) / GRASS_CHUNK);
    const c1x = Math.floor((camera.x + R) / GRASS_CHUNK);
    const c0z = Math.floor((camera.z - R) / GRASS_CHUNK);
    const c1z = Math.floor((camera.z + R) / GRASS_CHUNK);
    const wanted = new Set<string>();
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const mx = (cx + 0.5) * GRASS_CHUNK - camera.x;
        const mz = (cz + 0.5) * GRASS_CHUNK - camera.z;
        if (mx * mx + mz * mz > (R + GRASS_CHUNK) ** 2) continue;
        const key = `${cx},${cz}`;
        wanted.add(key);
        if (!this.grassChunks.has(key)) this.loadGrassChunk(cx, cz, key);
      }
    }
    for (const [key, chunk] of this.grassChunks) {
      if (wanted.has(key)) continue;
      if (chunk.mesh) {
        this.root.remove(chunk.mesh);
        chunk.mesh.dispose();
      }
      this.grassRecovering.delete(chunk);
      this.grassChunks.delete(key);
    }
  }

  private loadGrassChunk(cx: number, cz: number, key: string): GrassChunk {
    const g = this.spec!.grass!;
    const rng = makeRng(Math.floor(hash01(cx, cz, g.seed) * 2 ** 31));
    const expected = ((g.density * GRASS_CHUNK * GRASS_CHUNK) / 100) * Math.max(0.05, this.options.density);
    const data = new Float32Array(Math.ceil(expected) * 5);
    let n = 0;
    const half = this.map.half;
    for (let i = 0; i < Math.ceil(expected); i++) {
      const x = (cx + rng()) * GRASS_CHUNK;
      const z = (cz + rng()) * GRASS_CHUNK;
      const pick = rng();
      const rot = rng() * Math.PI;
      const size = 0.55 + rng() * 0.5;
      if (Math.abs(x) > half || Math.abs(z) > half) continue;
      if (pick > GRASS_BY_SURFACE[this.map.surfaceAt(x, z)]) continue;
      data.set([x, this.map.heightAt(x, z), z, rot, size], n * 5);
      n++;
    }
    const chunk: GrassChunk = { key, cx, cz, data, count: n, bend: new Float32Array(n), pressedAt: new Float32Array(n), mesh: null };
    if (this.render && n > 0) {
      if (!this.grassGeo) this.grassGeo = grassGeometry();
      if (!this.grassMat) this.grassMat = grassMaterial();
      const mesh = new THREE.InstancedMesh(this.grassGeo, this.grassMat, n);
      mesh.name = 'veg:grass';
      mesh.receiveShadow = true;
      chunk.mesh = mesh;
      for (let i = 0; i < n; i++) this.writeGrass(chunk, i);
      mesh.computeBoundingSphere();
      this.root.add(mesh);
    }
    this.grassChunks.set(key, chunk);
    return chunk;
  }

  private writeGrass(chunk: GrassChunk, i: number): void {
    if (!chunk.mesh) return;
    const d = chunk.data;
    const o = i * 5;
    const bend = chunk.bend[i];
    // 压倒:高度变矮并向一侧倒
    this.q.setFromAxisAngle(UP, d[o + 3]).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bend * 1.2));
    this.s.set(d[o + 4], d[o + 4] * (1 - 0.65 * bend), d[o + 4]);
    this.m4.compose(this.v.set(d[o], d[o + 1], d[o + 2]), this.q, this.s);
    chunk.mesh.setMatrixAt(i, this.m4);
    chunk.mesh.instanceMatrix.needsUpdate = true;
  }

  /** 履带(车体两侧各约 1/4 车宽的条带)压过的草丛倒下 */
  private pressGrass(pos: THREE.Vector3, inv: THREE.Quaternion, length: number, width: number): void {
    if (this.grassChunks.size === 0) return;
    const r = Math.hypot(length, width) / 2;
    const c0x = Math.floor((pos.x - r) / GRASS_CHUNK);
    const c1x = Math.floor((pos.x + r) / GRASS_CHUNK);
    const c0z = Math.floor((pos.z - r) / GRASS_CHUNK);
    const c1z = Math.floor((pos.z + r) / GRASS_CHUNK);
    const trackW = width * 0.25;
    const local = new THREE.Vector3();
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const chunk = this.grassChunks.get(`${cx},${cz}`);
        if (!chunk) continue;
        const d = chunk.data;
        for (let i = 0; i < chunk.count; i++) {
          const o = i * 5;
          const dx = d[o] - pos.x;
          const dz = d[o + 2] - pos.z;
          if (dx * dx + dz * dz > r * r) continue;
          local.set(dx, 0, dz).applyQuaternion(inv);
          const ax = Math.abs(local.x);
          if (ax > width / 2 || ax < width / 2 - trackW || Math.abs(local.z) > length / 2) continue;
          chunk.pressedAt[i] = this.time;
          if (chunk.bend[i] < 1) {
            chunk.bend[i] = 1;
            this.writeGrass(chunk, i);
          }
          this.grassRecovering.add(chunk);
        }
      }
    }
  }

  private recoverGrass(): void {
    for (const chunk of this.grassRecovering) {
      let any = false;
      for (let i = 0; i < chunk.count; i++) {
        if (chunk.bend[i] <= 0) continue;
        const since = this.time - chunk.pressedAt[i];
        if (since < GRASS_FLATTEN_HOLD) {
          any = true;
          continue;
        }
        const b = Math.max(0, 1 - (since - GRASS_FLATTEN_HOLD) / GRASS_RECOVER_TIME);
        if (b !== chunk.bend[i]) {
          chunk.bend[i] = b;
          this.writeGrass(chunk, i);
        }
        if (b > 0) any = true;
      }
      if (!any) this.grassRecovering.delete(chunk);
    }
  }

  /** 已加载的草丛数量与被压倒的数量(测试 / 调试用) */
  grassStats(): { loaded: number; bent: number } {
    let loaded = 0;
    let bent = 0;
    for (const c of this.grassChunks.values()) {
      loaded += c.count;
      for (let i = 0; i < c.count; i++) if (c.bend[i] > 0) bent++;
    }
    return { loaded, bent };
  }

  /** 测试用:不渲染也能加载镜头附近的草丛 */
  loadGrassAround(x: number, z: number, radius: number): void {
    if (!this.spec?.grass) return;
    for (let cx = Math.floor((x - radius) / GRASS_CHUNK); cx <= Math.floor((x + radius) / GRASS_CHUNK); cx++) {
      for (let cz = Math.floor((z - radius) / GRASS_CHUNK); cz <= Math.floor((z + radius) / GRASS_CHUNK); cz++) {
        const key = `${cx},${cz}`;
        if (!this.grassChunks.has(key)) this.loadGrassChunk(cx, cz, key);
      }
    }
  }
}

function easeFall(t: number): number {
  // 先慢后快,像树倒下时越倒越快
  return t * t;
}

/** 顶点确定性地随机外推一点,让树冠 / 灌木不那么规整 */
function jiggle(geo: THREE.BufferGeometry, amount: number, seed: number): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const cache = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let k = cache.get(key);
    if (k === undefined) {
      k = 1 + (hash01(i * 13 + seed, cache.size, seed) - 0.5) * 2 * amount;
      cache.set(key, k);
    }
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
}

/** 针叶树冠:三层圆锥叠起来,底部在 y = 0、顶在 y = 1、半径 1 */
function mergeCones(): THREE.BufferGeometry {
  const parts = [
    new THREE.ConeGeometry(1, 0.5, 7).translate(0, 0.25, 0),
    new THREE.ConeGeometry(0.75, 0.45, 7).translate(0, 0.5, 0),
    new THREE.ConeGeometry(0.5, 0.4, 7).translate(0, 0.8, 0),
  ].map((g) => g.toNonIndexed());
  const total = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.getAttribute('position').array as Float32Array, o);
    o += g.getAttribute('position').count * 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 草丛:两片交叉的竖直面片,底部在原点,高约 0.6 m。
 * 每片正反两面各做一份三角形、法线都朝上(像草地一样受光),材质只画正面——
 * 如果用双面材质,three.js 会把背面的法线翻过来朝下,背面的草就是黑的。
 */
function grassGeometry(): THREE.BufferGeometry {
  const w = 0.5;
  const h = 0.6;
  const quads = [
    [-w, 0, 0, w, 0, 0, w, h, 0, -w, h, 0],
    [0, 0, -w, 0, 0, w, 0, h, w, 0, h, -w],
  ];
  const pos: number[] = [];
  const uv: number[] = [];
  const uvOf = (k: number) => [k === 0 || k === 3 ? 0 : 1, k >= 2 ? 1 : 0];
  for (const q of quads) {
    const v = (i: number) => [q[i * 3], q[i * 3 + 1], q[i * 3 + 2]];
    for (const tri of [
      [0, 1, 2],
      [0, 2, 3],
      [2, 1, 0],
      [3, 2, 0],
    ]) {
      for (const k of tri) {
        pos.push(...v(k));
        uv.push(...uvOf(k));
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
  return geo;
}

/** 草叶贴图:canvas 画几十根草叶,颜色贴近草地地表;没有 canvas(测试环境)时退化为纯色 */
function grassMaterial(): THREE.Material {
  const mat = new THREE.MeshLambertMaterial({ color: 0x86a04a, side: THREE.FrontSide, alphaTest: 0.5 });
  if (typeof document === 'undefined') return mat;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return mat;
  ctx.clearRect(0, 0, 64, 64);
  const rng = makeRng(99);
  for (let i = 0; i < 26; i++) {
    const x = 4 + rng() * 56;
    const lean = (rng() - 0.5) * 18;
    const h = 26 + rng() * 34;
    const g = 150 + Math.floor(rng() * 50);
    ctx.strokeStyle = `rgb(${g - 45 + Math.floor(rng() * 20)}, ${g}, ${55 + Math.floor(rng() * 25)})`;
    ctx.lineWidth = 2 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  mat.map = tex;
  mat.color.set(0xd8e0c8);
  return mat;
}
