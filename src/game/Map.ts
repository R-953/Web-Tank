import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MapSpec, SurfaceType } from '../data/types';
import { SURFACES } from '../data/surfaces';
import { SURFACE_ORDER, buildTerrain, type TerrainGrid } from './terrain';

const DEG2RAD = Math.PI / 180;

const ROCK_COLOR = new THREE.Color(SURFACES.rock.color);
const SURFACE_COLORS = SURFACE_ORDER.map((t) => new THREE.Color(SURFACES[t].color));

/**
 * 由 MapSpec 构建地形、水面与障碍物。高度先按要素栅格化(game/terrain.ts),再生成 Three 网格,
 * 碰撞体直接用同一份顶点/三角形建 Rapier trimesh,渲染与碰撞的表面完全一致。
 * (没用 Rapier heightfield:它对恰好落在网格线上的射线会漏检,见 Changelog.md)
 */
export class GameMap {
  readonly root = new THREE.Group();
  readonly half: number;
  readonly cellSize: number;
  /** 栅格化后的高度与地表(小地图也用它) */
  readonly grid: TerrainGrid;
  private readonly res: number;

  constructor(readonly spec: MapSpec, world: RAPIER.World) {
    this.grid = buildTerrain(spec);
    this.res = this.grid.resolution;
    this.half = spec.size / 2;
    this.cellSize = this.grid.cellSize;
    this.root.name = `map:${spec.id}`;
    this.buildTerrain(world);
    this.buildWater();
    this.buildBoundary(world);
    this.buildObstacles(world);
  }

  /** 采样点 (ix, iz) 的实际高度 */
  vertexHeight(ix: number, iz: number): number {
    const cx = Math.min(Math.max(ix, 0), this.res - 1);
    const cz = Math.min(Math.max(iz, 0), this.res - 1);
    return this.grid.heights[cz * this.res + cx];
  }

  /**
   * 世界坐标 (x, z) 的地面高度。按与 PlaneGeometry 相同的三角剖分插值
   * (每格沿 (ix, iz+1)–(ix+1, iz) 对角线切成两个三角形),与碰撞面完全一致。
   */
  heightAt(x: number, z: number): number {
    const max = this.res - 1;
    const fx = Math.min(Math.max((x + this.half) / this.cellSize, 0), max);
    const fz = Math.min(Math.max((z + this.half) / this.cellSize, 0), max);
    const ix = Math.min(Math.floor(fx), max - 1);
    const iz = Math.min(Math.floor(fz), max - 1);
    const tx = fx - ix;
    const tz = fz - iz;
    const ha = this.vertexHeight(ix, iz);
    const hb = this.vertexHeight(ix, iz + 1);
    const hc = this.vertexHeight(ix + 1, iz + 1);
    const hd = this.vertexHeight(ix + 1, iz);
    if (tx + tz <= 1) return ha + (hd - ha) * tx + (hb - ha) * tz;
    return hc + (hb - hc) * (1 - tx) + (hd - hc) * (1 - tz);
  }

  /** 世界坐标 (x, z) 处的地表类型(最近的采样点) */
  surfaceAt(x: number, z: number): SurfaceType {
    const max = this.res - 1;
    const ix = Math.min(max, Math.max(0, Math.round((x + this.half) / this.cellSize)));
    const iz = Math.min(max, Math.max(0, Math.round((z + this.half) / this.cellSize)));
    return SURFACE_ORDER[this.grid.surfaces[iz * this.res + ix]];
  }

  private buildTerrain(world: RAPIER.World): void {
    const n = this.res;
    const size = this.spec.size;

    // --- 渲染网格:PlaneGeometry 旋转到 XZ 平面后,顶点 k = iz * n + ix,与数据的行优先顺序一致
    const geo = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) pos.setY(k, this.grid.heights[k]);
    geo.computeVertexNormals();
    // 顶点色:地表颜色;草地 / 土地的陡坡露出岩石;按格点做一点确定性的明暗变化,避免大片纯色
    const normals = geo.getAttribute('normal') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const type = this.grid.surfaces[k];
      c.copy(SURFACE_COLORS[type]);
      const steep = 1 - normals.getY(k);
      if ((SURFACE_ORDER[type] === 'grass' || SURFACE_ORDER[type] === 'dirt') && steep > 0.12) c.lerp(ROCK_COLOR, Math.min(1, (steep - 0.12) * 4));
      const jitter = ((Math.sin(k * 12.9898) * 43758.5453) % 1) * 0.06;
      c.multiplyScalar(0.97 + jitter);
      c.toArray(colors, k * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.root.add(mesh);

    // --- 碰撞体:直接用渲染网格的顶点和三角形
    const vertices = new Float32Array(pos.array);
    const indices = new Uint32Array(geo.getIndex()!.array);
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0.9);
    world.createCollider(desc);
  }

  /** 水面:只是一张半透明平面,不参与物理(浅水的减速由地表类型 water 体现) */
  private buildWater(): void {
    const level = this.spec.waterLevel;
    if (level === undefined) return;
    const geo = new THREE.PlaneGeometry(this.spec.size, this.spec.size).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d6e8c, transparent: true, opacity: 0.7, roughness: 0.25, metalness: 0.1 });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = level;
    water.name = 'water';
    this.root.add(water);
  }

  /** 四周不可见的墙,防止开出地图 */
  private buildBoundary(world: RAPIER.World): void {
    const h = 1000; // 足够高,山地地图也挡得住
    const t = 2;
    const s = this.half;
    const walls: Array<[number, number, number, number]> = [
      [0, -s - t, s + t, t],
      [0, s + t, s + t, t],
      [-s - t, 0, t, s + t],
      [s + t, 0, t, s + t],
    ];
    for (const [x, z, hx, hz] of walls) {
      world.createCollider(RAPIER.ColliderDesc.cuboid(hx, h / 2, hz).setTranslation(x, h / 2 - 300, z));
    }
  }

  private buildObstacles(world: RAPIER.World): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8378, flatShading: true, roughness: 0.9 });
    for (const o of this.spec.obstacles) {
      const [w, h, d] = o.size;
      const [x, z] = o.position;
      // 稍微埋进地面,避免斜坡上悬空
      const y = this.heightAt(x, z) - 0.4 + h / 2;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rotationY * DEG2RAD);

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.quaternion.copy(q);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
      world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(0.8), body);
    }
  }
}
