import type { MapSpec, SurfaceType, TerrainFeature, Vec2 } from '../data/types';

/**
 * 地形栅格化:把 MapSpec.terrain(手写高度网格 + 地形要素)和地表网格画成规则网格上的
 * 高度与地表类型。纯函数、确定性,不依赖 three / rapier,方便单测。
 */

/** 地表类型在 surfaces 数组里的编码顺序 */
export const SURFACE_ORDER: readonly SurfaceType[] = ['grass', 'dirt', 'sand', 'rock', 'mud', 'water'];

export interface TerrainGrid {
  /** 每边采样点数 */
  resolution: number;
  cellSize: number;
  /** 地图半边长 */
  half: number;
  /** 行优先(先 z 后 x),m */
  heights: Float32Array;
  /** 每个采样点的地表类型(SURFACE_ORDER 下标) */
  surfaces: Uint8Array;
}

const smoothstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** 点到折线的最近距离 */
export function distanceToPath(x: number, z: number, path: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
  }
  if (path.length === 1) best = Math.hypot(x - path[0][0], z - path[0][1]);
  return best;
}

/**
 * 单个要素在 (x, z) 处的高度增量,以及「主体范围」权重(≥ 0.5 时覆盖地表类型)。
 */
export function featureAt(f: TerrainFeature, x: number, z: number): { dh: number; weight: number } {
  switch (f.kind) {
    case 'hill': {
      const t = Math.hypot(x - f.at[0], z - f.at[1]) / f.radius;
      if (t >= 1) return { dh: 0, weight: 0 };
      const p = 0.5 * (1 + Math.cos(Math.PI * t));
      return { dh: f.height * p, weight: p > 0.3 ? 1 : 0 };
    }
    case 'mountain': {
      const t = Math.hypot(x - f.at[0], z - f.at[1]) / f.radius;
      if (t >= 1) return { dh: 0, weight: 0 };
      const p = Math.pow(1 - smoothstep(t), 1.8);
      return { dh: f.height * p, weight: p > 0.12 ? 1 : 0 };
    }
    case 'ridge': {
      const t = distanceToPath(x, z, f.path) / (f.width / 2);
      if (t >= 1) return { dh: 0, weight: 0 };
      const p = 0.5 * (1 + Math.cos(Math.PI * t));
      return { dh: f.height * p, weight: p > 0.3 ? 1 : 0 };
    }
    case 'plateau': {
      const d = Math.hypot(x - f.at[0], z - f.at[1]);
      const p = d <= f.radius ? 1 : 1 - smoothstep((d - f.radius) / f.edge);
      return { dh: f.height * p, weight: p > 0.5 ? 1 : 0 };
    }
    case 'dunes': {
      const t = Math.hypot(x - f.at[0], z - f.at[1]) / f.radius;
      if (t >= 1) return { dh: 0, weight: 0 };
      const mask = 1 - smoothstep((t - 0.6) / 0.4);
      const a = (f.heading * Math.PI) / 180;
      const proj = x * Math.cos(a) + z * Math.sin(a);
      const wave = Math.pow(0.5 + 0.5 * Math.sin((2 * Math.PI * proj) / f.wavelength), 1.5);
      return { dh: f.height * mask * wave, weight: mask > 0.5 ? 1 : 0 };
    }
    case 'valley': {
      const d = distanceToPath(x, z, f.path);
      const w = f.width / 2;
      const p = d <= w ? 1 : 1 - smoothstep((d - w) / f.bank);
      return { dh: -f.depth * p, weight: d <= w + f.bank ? 1 : 0 };
    }
  }
}

/** 手写高度网格在 (x, z) 处的双线性插值(m) */
function gridHeight(spec: MapSpec, x: number, z: number): number {
  const g = spec.terrain.heightmap;
  if (!g) return 0;
  const n = g.resolution;
  const cell = spec.size / (n - 1);
  const fx = Math.min(Math.max((x + spec.size / 2) / cell, 0), n - 1);
  const fz = Math.min(Math.max((z + spec.size / 2) / cell, 0), n - 1);
  const ix = Math.min(Math.floor(fx), n - 2);
  const iz = Math.min(Math.floor(fz), n - 2);
  const tx = fx - ix;
  const tz = fz - iz;
  const h = (i: number, k: number) => g.heights[k * n + i] * g.heightScale;
  return (
    (h(ix, iz) * (1 - tx) + h(ix + 1, iz) * tx) * (1 - tz) + (h(ix, iz + 1) * (1 - tx) + h(ix + 1, iz + 1) * tx) * tz
  );
}

/** 地表网格在 (x, z) 处的类型(最近的格子) */
function gridSurface(spec: MapSpec, x: number, z: number): SurfaceType {
  const s = spec.surface;
  if (!s || s.rows.length === 0) return 'grass';
  const rows = s.rows.length;
  const cols = s.rows[0].length;
  const cz = Math.min(rows - 1, Math.max(0, Math.floor(((z + spec.size / 2) / spec.size) * rows)));
  const cx = Math.min(cols - 1, Math.max(0, Math.floor(((x + spec.size / 2) / spec.size) * cols)));
  return s.legend[s.rows[cz][cx]] ?? 'grass';
}

export function buildTerrain(spec: MapSpec): TerrainGrid {
  const { cellSize } = spec.terrain;
  const cells = spec.size / cellSize;
  if (Math.abs(cells - Math.round(cells)) > 1e-6) {
    throw new Error(`地图 ${spec.id}:边长 ${spec.size} 不是采样间距 ${cellSize} 的整数倍`);
  }
  if (spec.surface) {
    const w = spec.surface.rows[0]?.length ?? 0;
    spec.surface.rows.forEach((r, i) => {
      if (r.length !== w) throw new Error(`地图 ${spec.id}:地表网格第 ${i} 行长度 ${r.length},应为 ${w}`);
      for (const ch of r) if (!(ch in spec.surface!.legend)) throw new Error(`地图 ${spec.id}:地表网格含未定义字符 "${ch}"`);
    });
  }
  const n = Math.round(cells) + 1;
  const half = spec.size / 2;
  const heights = new Float32Array(n * n);
  const surfaces = new Uint8Array(n * n);
  const features = spec.terrain.features;
  const water = spec.waterLevel;
  for (let iz = 0; iz < n; iz++) {
    const z = -half + iz * cellSize;
    for (let ix = 0; ix < n; ix++) {
      const x = -half + ix * cellSize;
      let h = spec.terrain.base + gridHeight(spec, x, z);
      let surface = gridSurface(spec, x, z);
      for (const f of features) {
        const { dh, weight } = featureAt(f, x, z);
        h += dh;
        if (f.surface && weight >= 0.5) surface = f.surface;
      }
      if (water !== undefined && h < water - 0.05) surface = 'water';
      const k = iz * n + ix;
      heights[k] = h;
      surfaces[k] = SURFACE_ORDER.indexOf(surface);
    }
  }
  return { resolution: n, cellSize, half, heights, surfaces };
}
