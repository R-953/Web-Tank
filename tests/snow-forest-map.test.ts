import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { SNOW_FOREST } from '../src/data/mapspecs/snow_forest';
import { VEHICLES } from '../src/data/vehicles';
import { buildTerrain } from '../src/game/terrain';
import { GameMap } from '../src/game/Map';
import { Game } from '../src/game/Game';
import type { ObstacleSpec } from '../src/data/types';

beforeAll(async () => {
  await RAPIER.init();
});

/**
 * 判断点 [x, z] 是否落在带有 rotationY 旋转的障碍物盒子内(可加安全边距 margin)
 */
function pointInObstacleBox(x: number, z: number, o: ObstacleSpec, margin = 2): boolean {
  const [ox, oz] = o.position;
  const [w, , d] = o.size;
  const rad = (-o.rotationY * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - ox;
  const dz = z - oz;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.abs(lx) < w / 2 + margin && Math.abs(lz) < d / 2 + margin;
}

describe('雪地森林地图规格与基础构建', () => {
  it('基础元信息与尺寸符合要求', () => {
    expect(SNOW_FOREST.id).toBe('snow_forest');
    expect(SNOW_FOREST.name).toBe('雪地森林');
    expect(SNOW_FOREST.size).toBe(2000);
    expect(SNOW_FOREST.size % SNOW_FOREST.terrain.cellSize).toBe(0);
  });

  it('buildTerrain 构建成功,分辨率正确,地形高低起伏合理', () => {
    expect(() => buildTerrain(SNOW_FOREST)).not.toThrow();
    const grid = buildTerrain(SNOW_FOREST);
    const expectedRes = SNOW_FOREST.size / SNOW_FOREST.terrain.cellSize + 1;
    expect(grid.resolution).toBe(expectedRes);
    expect(grid.heights.length).toBe(expectedRes * expectedRes);

    const minHeight = Math.min(...grid.heights);
    const maxHeight = Math.max(...grid.heights);
    // 河谷下切 -5 m,北边高丘最高约 30 m
    expect(minHeight).toBeLessThan(0);
    expect(maxHeight).toBeGreaterThan(20);
  });

  it('地表网格行数/列数与 legend 严格匹配', () => {
    const surface = SNOW_FOREST.surface;
    expect(surface).toBeDefined();
    const rows = surface!.rows;
    expect(rows.length).toBeGreaterThan(0);
    const cols = rows[0].length;
    expect(rows.length).toBe(cols);

    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].length).toBe(cols);
      for (const ch of rows[i]) {
        expect(surface!.legend[ch]).toBeDefined();
      }
    }
  });
});

describe('障碍物合规性', () => {
  it('障碍物数量 ≤ 300 且全部在地图内', () => {
    expect(SNOW_FOREST.obstacles.length).toBeGreaterThan(0);
    expect(SNOW_FOREST.obstacles.length).toBeLessThanOrEqual(300);

    const half = SNOW_FOREST.size / 2;
    for (const o of SNOW_FOREST.obstacles) {
      const [x, z] = o.position;
      const [w, , d] = o.size;
      const radius = Math.hypot(w / 2, d / 2);
      expect(Math.abs(x) + radius).toBeLessThan(half);
      expect(Math.abs(z) + radius).toBeLessThan(half);
    }
  });

  it('包含符合任务卡尺寸的农舍/谷仓以及低矮石堆倒木', () => {
    const barns = SNOW_FOREST.obstacles.filter(
      (o) => o.size[0] >= 10 && o.size[0] <= 20 && o.size[1] >= 6 && o.size[1] <= 9,
    );
    expect(barns.length).toBeGreaterThanOrEqual(4);

    const lowObstacles = SNOW_FOREST.obstacles.filter((o) => o.size[1] <= 2.5);
    expect(lowObstacles.length).toBeGreaterThanOrEqual(10);
  });
});

describe('出生点与 AI 巡逻合规性', () => {
  const half = SNOW_FOREST.size / 2;
  const boundaryMargin = 100; // 离边界墙至少 100 m
  const player = SNOW_FOREST.spawns.player;
  const targets = SNOW_FOREST.spawns.targets;

  it('所有载具 ID 均在 VEHICLES 中定义', () => {
    expect(VEHICLES[player.vehicleId]).toBeDefined();
    for (const t of targets) {
      expect(VEHICLES[t.vehicleId]).toBeDefined();
    }
  });

  it('敌方出生点约 5 个,混合多种车型', () => {
    expect(targets.length).toBe(5);
    const vehicleSet = new Set(targets.map((t) => t.vehicleId));
    expect(vehicleSet.size).toBeGreaterThanOrEqual(3);
    expect(vehicleSet.has('t34_85')).toBe(true);
    expect(vehicleSet.has('tiger_ii')).toBe(true);
  });

  it('玩家和所有敌方出生点都在地图内,离边界墙足够远', () => {
    const allSpawns = [player, ...targets];
    for (const s of allSpawns) {
      const [x, z] = s.position;
      expect(Math.abs(x)).toBeLessThan(half - boundaryMargin);
      expect(Math.abs(z)).toBeLessThan(half - boundaryMargin);
    }
  });

  it('玩家和所有敌方出生点均不在障碍物里', () => {
    const allSpawns = [player, ...targets];
    for (const s of allSpawns) {
      const [x, z] = s.position;
      for (const o of SNOW_FOREST.obstacles) {
        expect(pointInObstacleBox(x, z, o, 4)).toBe(false);
      }
    }
  });

  it('玩家和所有敌方出生点均不在水里(waterLevel 以下或 water 地表)', () => {
    const grid = buildTerrain(SNOW_FOREST);
    const allSpawns = [player, ...targets];
    for (const s of allSpawns) {
      const [x, z] = s.position;
      const ix = Math.min(grid.resolution - 1, Math.max(0, Math.round((x + grid.half) / grid.cellSize)));
      const iz = Math.min(grid.resolution - 1, Math.max(0, Math.round((z + grid.half) / grid.cellSize)));
      const k = iz * grid.resolution + ix;
      const h = grid.heights[k];

      if (SNOW_FOREST.waterLevel !== undefined) {
        expect(h).toBeGreaterThanOrEqual(SNOW_FOREST.waterLevel);
      }
      expect(grid.surfaces[k]).not.toBe(5); // 5 代表 water
    }
  });

  it('玩家出生点到每个敌方出生点的直线距离在 [150, 900] m 之间', () => {
    const [px, pz] = player.position;
    for (const t of targets) {
      const [tx, tz] = t.position;
      const dist = Math.hypot(tx - px, tz - pz);
      expect(dist).toBeGreaterThanOrEqual(150);
      expect(dist).toBeLessThanOrEqual(900);
    }
  });

  it('敌方带 2–3 条巡逻路线,巡逻目标点在地图内、离边界够远且不在障碍物里', () => {
    const patrolling = targets.filter((t) => t.patrol !== undefined);
    expect(patrolling.length).toBeGreaterThanOrEqual(2);
    expect(patrolling.length).toBeLessThanOrEqual(3);

    for (const t of patrolling) {
      const patrol = t.patrol!;
      expect(patrol.speed).toBeGreaterThan(0);
      const [tx, tz] = patrol.to;
      expect(Math.abs(tx)).toBeLessThan(half - boundaryMargin);
      expect(Math.abs(tz)).toBeLessThan(half - boundaryMargin);

      for (const o of SNOW_FOREST.obstacles) {
        expect(pointInObstacleBox(tx, tz, o, 4)).toBe(false);
      }

      // 巡逻点到出生点有实质移动距离(≥ 50 m)
      const moveLen = Math.hypot(tx - t.position[0], tz - t.position[1]);
      expect(moveLen).toBeGreaterThanOrEqual(50);
    }
  });
});

describe('植被规格', () => {
  it('植被区域配置合理,以 pine 针叶树为主,混有 tree 和 bush', () => {
    const veg = SNOW_FOREST.vegetation;
    expect(veg).toBeDefined();
    expect(veg!.zones.length).toBeGreaterThan(0);
    expect(veg!.clearRadius).toBeGreaterThanOrEqual(12);

    const kinds = new Set(veg!.zones.map((z) => z.kind));
    expect(kinds.has('pine')).toBe(true);
    expect(kinds.has('tree')).toBe(true);
    expect(kinds.has('bush')).toBe(true);

    const pineZones = veg!.zones.filter((z) => z.kind === 'pine');
    const otherZones = veg!.zones.filter((z) => z.kind !== 'pine');
    expect(pineZones.length).toBeGreaterThan(otherZones.length / 2);
  });
});

describe('GameMap 与物理系统完整集成', () => {
  it('GameMap 成功装载并在 Rapier 物理世界中构建出碰撞网格', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const map = new GameMap(SNOW_FOREST, world);
    world.step();

    // 采样玩家出生点与原点高度
    const ph = map.heightAt(SNOW_FOREST.spawns.player.position[0], SNOW_FOREST.spawns.player.position[1]);
    expect(Number.isFinite(ph)).toBe(true);

    // 边界墙阻挡
    const hit = world.castRay(new RAPIER.Ray({ x: 0, y: 15, z: 0 }, { x: 0, y: 0, z: 1 }), 1200, true);
    expect(hit).not.toBeNull();
    expect(hit!.timeOfImpact).toBeLessThanOrEqual(map.half + 0.1);
  });

  it('Game 可在雪地森林地图上完整初始化并步进运行', () => {
    const game = new Game({
      map: SNOW_FOREST,
      vehicles: VEHICLES,
      seed: 42,
      enemyAi: false,
      vegetation: false,
    });
    expect(game.vehicles.length).toBe(6); // 1 玩家 + 5 靶车
    for (let i = 0; i < 30; i++) {
      game.fixedUpdate(1 / 60);
    }
    for (const v of game.vehicles) {
      const p = v.physicsPosition();
      expect(Math.abs(p.x)).toBeLessThan(1000);
      expect(Math.abs(p.z)).toBeLessThan(1000);
    }
  });
});
