import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import type { MapSpec } from '../src/data/types';
import { RIVER_VALLEY } from '../src/data/maps';
import { SURFACES } from '../src/data/surfaces';
import { SURFACE_ORDER, buildTerrain } from '../src/game/terrain';
import { Game } from '../src/game/Game';
import { idleControls } from '../src/game/Vehicle';
import { VEHICLES } from '../src/data/vehicles';
import { SHOOTER, TEST_VEHICLES, flatMap } from './fixtures';

beforeAll(async () => {
  await RAPIER.init();
});

/** 400 m 见方的小地图:中间一座丘陵,北边一条河(下切 3 m,水面 3 m),西北一块台地 */
const SAMPLE: MapSpec = {
  id: 'sample',
  name: '样例',
  size: 400,
  terrain: {
    cellSize: 10,
    base: 5,
    features: [
      { kind: 'hill', at: [0, 0], radius: 100, height: 20 },
      { kind: 'valley', path: [[-200, -150], [200, -150]], width: 20, depth: 3, bank: 10, surface: 'mud' },
      { kind: 'plateau', at: [-100, 100], radius: 40, height: 10, edge: 20, surface: 'rock' },
    ],
  },
  surface: { legend: { '.': 'grass', s: 'sand', r: 'rock', ',': 'dirt' }, rows: ['.s', 'r,'] },
  waterLevel: 3,
  obstacles: [],
  spawns: { player: { vehicleId: 'tiger_i', position: [0, 0], heading: 0 }, targets: [] },
};

function sample(g: ReturnType<typeof buildTerrain>, x: number, z: number) {
  const ix = Math.round((x + g.half) / g.cellSize);
  const iz = Math.round((z + g.half) / g.cellSize);
  const k = iz * g.resolution + ix;
  return { h: g.heights[k], surface: SURFACE_ORDER[g.surfaces[k]] };
}

describe('地形要素栅格化', () => {
  it('丘陵顶 = 基准 + 高度,半径外回到基准', () => {
    const g = buildTerrain(SAMPLE);
    expect(g.resolution).toBe(41);
    expect(sample(g, 0, 0).h).toBeCloseTo(25, 4);
    expect(sample(g, 150, 100).h).toBeCloseTo(5, 4);
  });

  it('河谷下切到指定深度;低于水面的地方是浅水,河岸是泥滩', () => {
    const g = buildTerrain(SAMPLE);
    const bed = sample(g, 0, -150);
    expect(bed.h).toBeCloseTo(2, 4);
    expect(bed.surface).toBe('water');
    expect(sample(g, 0, -135).surface).toBe('mud');
  });

  it('台地是平顶;地表网格按象限取(第一行是北边)', () => {
    const g = buildTerrain(SAMPLE);
    expect(sample(g, -100, 100).h).toBeCloseTo(15, 4);
    expect(sample(g, -70, 100).h).toBeCloseTo(15, 4);
    expect(sample(g, -100, 100).surface).toBe('rock');
    expect(sample(g, 150, -60).surface).toBe('sand');
    expect(sample(g, 150, 150).surface).toBe('dirt');
    expect(sample(g, -180, -60).surface).toBe('grass');
  });

  it('数据错误会直接报出来:边长不是格距整数倍、地表网格有未定义字符', () => {
    expect(() => buildTerrain({ ...SAMPLE, terrain: { ...SAMPLE.terrain, cellSize: 30 } })).toThrow();
    expect(() => buildTerrain({ ...SAMPLE, surface: { ...SAMPLE.surface!, rows: ['.x', 'r,'] } })).toThrow();
  });
});

describe('河谷试验场(3 km)', () => {
  const g = buildTerrain(RIVER_VALLEY);

  it('3 km 见方,10 m 网格;北边是山地(> 150 m),东边是沙地,河床里有水', () => {
    expect(g.resolution).toBe(301);
    expect(Math.max(...g.heights)).toBeGreaterThan(150);
    expect(sample(g, 1000, 500).surface).toBe('sand');
    expect(sample(g, -600, -1300).surface).toBe('rock');
    const waterCells = Array.from(g.surfaces).filter((s) => SURFACE_ORDER[s] === 'water').length;
    expect(waterCells).toBeGreaterThan(100);
  });

  // 生成整张 3 km 地图(地形 + 植被)单独跑就要 4–5 秒,机器忙时会超过 Vitest 默认的 5 秒,所以单独放宽超时(断言不变)
  it('所有出生点都在地图内、不在水里;玩家出生点能直接看到至少两辆靶车', { timeout: 30_000 }, () => {
    const game = new Game({ map: RIVER_VALLEY, vehicles: VEHICLES, seed: 1, enemyAi: false });
    for (let i = 0; i < 60; i++) game.fixedUpdate(1 / 60);
    for (const v of game.vehicles) {
      const p = v.physicsPosition();
      expect(Math.abs(p.x)).toBeLessThan(1500);
      expect(Math.abs(p.z)).toBeLessThan(1500);
      expect(game.map.surfaceAt(p.x, p.z)).not.toBe('water');
    }
    const visible = game.targets.filter((t) => game.lineOfSight(game.player, t));
    expect(visible.length).toBeGreaterThanOrEqual(2);
  });
});

describe('地表影响机动', () => {
  function topSpeed(surface: 'grass' | 'sand' | 'water') {
    const map = flatMap({ vehicleId: 'shooter', position: [0, 900], heading: 0 }, [], 2000);
    map.surface = { legend: { x: surface }, rows: ['x'] };
    const game = new Game({ map, vehicles: TEST_VEHICLES, seed: 1 });
    let top = 0;
    for (let i = 0; i < 60 * 60; i++) {
      game.setPlayerControls({ ...idleControls(), throttle: 1 });
      game.fixedUpdate(1 / 60);
      top = Math.max(top, game.player.forwardSpeed * 3.6);
    }
    return top;
  }

  it('草地跑到资料极速;沙地阻力翻倍,极速减半;浅水只有三分之一', () => {
    expect(topSpeed('grass')).toBeGreaterThan(SHOOTER.maxSpeed * 0.97);
    const ratio = (s: 'sand' | 'water') => SURFACES.grass.rollingResistance / SURFACES[s].rollingResistance;
    expect(topSpeed('sand') / SHOOTER.maxSpeed).toBeCloseTo(ratio('sand'), 1);
    expect(topSpeed('water') / SHOOTER.maxSpeed).toBeCloseTo(ratio('water'), 1);
  });
});
