import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import type { ObstacleSpec, Vec2 } from '../src/data/types';
import { HARBOR_TOWN } from '../src/data/mapspecs/harbor_town';
import { buildTerrain } from '../src/game/terrain';
import { GameMap } from '../src/game/Map';
import { Game } from '../src/game/Game';
import { VEHICLES } from '../src/data/vehicles';

beforeAll(async () => {
  await RAPIER.init();
});

/** 检查二维点是否落在障碍物的旋转包围盒内 (包含安全边距) */
function isPointInObstacle(px: number, pz: number, o: ObstacleSpec, margin = 2.0): boolean {
  const [ox, oz] = o.position;
  const [w, , d] = o.size;
  const rad = (-o.rotationY * Math.PI) / 180;
  const dx = px - ox;
  const dz = pz - oz;
  const lx = dx * Math.cos(rad) - dz * Math.sin(rad);
  const lz = dx * Math.sin(rad) + dz * Math.cos(rad);
  return Math.abs(lx) <= w / 2 + margin && Math.abs(lz) <= d / 2 + margin;
}

/** 检查线段路径是否与任意障碍物相交 (按步长采样) */
function isPathObstructed(from: Vec2, to: Vec2, obstacles: ObstacleSpec[], margin = 1.2): boolean {
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(4, Math.ceil(dist / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from[0] + t * (to[0] - from[0]);
    const z = from[1] + t * (to[1] - from[1]);
    for (const o of obstacles) {
      if (isPointInObstacle(x, z, o, margin)) return true;
    }
  }
  return false;
}

describe('港口城镇地图数据与规格', () => {
  it('尺寸为 1500 m, 能整除 cellSize, buildTerrain 构建成功', () => {
    expect(HARBOR_TOWN.id).toBe('harbor_town');
    expect(HARBOR_TOWN.name).toBe('港口城镇');
    expect(HARBOR_TOWN.size).toBe(1500);
    expect(HARBOR_TOWN.terrain.cellSize).toBe(10);
    expect(HARBOR_TOWN.size % HARBOR_TOWN.terrain.cellSize).toBe(0);

    const grid = buildTerrain(HARBOR_TOWN);
    expect(grid.resolution).toBe(151);
    expect(grid.half).toBe(750);
    expect(grid.heights.length).toBe(151 * 151);
    expect(grid.surfaces.length).toBe(151 * 151);
  });

  it('地表字符网格行数/列数一致, 且所有字符都在 legend 之中', () => {
    const surface = HARBOR_TOWN.surface;
    expect(surface).toBeDefined();
    const rows = surface!.rows;
    expect(rows.length).toBe(150);

    const legendKeys = Object.keys(surface!.legend);
    expect(legendKeys).toContain('.');
    expect(legendKeys).toContain(',');
    expect(legendKeys).toContain('r');
    expect(legendKeys).toContain('s');

    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].length).toBe(150);
      for (const ch of rows[i]) {
        expect(ch in surface!.legend).toBe(true);
      }
    }
  });

  it('障碍物数量 ≤ 300 且均在地图边界内', () => {
    const obstacles = HARBOR_TOWN.obstacles;
    expect(obstacles.length).toBeGreaterThan(50);
    expect(obstacles.length).toBeLessThanOrEqual(300);

    const half = HARBOR_TOWN.size / 2;
    for (const o of obstacles) {
      const [x, z] = o.position;
      const [w, h, d] = o.size;
      expect(h).toBeGreaterThan(0);
      const halfBound = Math.max(w, d) / 2;
      expect(Math.abs(x) + halfBound).toBeLessThan(half);
      expect(Math.abs(z) + halfBound).toBeLessThan(half);
    }
  });

  it('包含 15~25 m 办公楼、8~14 m 厂房/仓库、2~3 层集装箱堆和低矮围墙', () => {
    const obstacles = HARBOR_TOWN.obstacles;

    const officeBuildings = obstacles.filter((o) => o.size[1] >= 15 && o.size[1] <= 25 && o.size[0] >= 15);
    expect(officeBuildings.length).toBeGreaterThanOrEqual(3);

    const warehouses = obstacles.filter((o) => o.size[1] >= 8 && o.size[1] <= 14 && (o.size[0] >= 20 || o.size[2] >= 20));
    expect(warehouses.length).toBeGreaterThanOrEqual(8);

    const containerStacks = obstacles.filter((o) => Math.abs(o.size[0] - 6) < 0.1 && (Math.abs(o.size[1] - 4.8) < 0.1 || Math.abs(o.size[1] - 7.2) < 0.1));
    expect(containerStacks.length).toBeGreaterThanOrEqual(50);

    const lowWalls = obstacles.filter((o) => o.size[1] <= 2.0 && o.size[1] >= 1.0 && (o.size[0] >= 10 || o.size[2] >= 10));
    expect(lowWalls.length).toBeGreaterThanOrEqual(10);
  });
});

describe('港口城镇出生点与巡逻路线', () => {
  it('玩家与所有敌方出生点均在地图内且距离边界墙足够远 (|x|, |z| < 700)', () => {
    const { player, targets } = HARBOR_TOWN.spawns;
    const allSpawns = [player, ...targets];
    expect(allSpawns.length).toBeGreaterThanOrEqual(5);

    for (const s of allSpawns) {
      expect(Math.abs(s.position[0])).toBeLessThan(700);
      expect(Math.abs(s.position[1])).toBeLessThan(700);
    }
  });

  it('玩家到每个敌方出生点的直线距离在 [150, 900] m 之间', () => {
    const { player, targets } = HARBOR_TOWN.spawns;
    for (const t of targets) {
      const dist = Math.hypot(player.position[0] - t.position[0], player.position[1] - t.position[1]);
      expect(dist).toBeGreaterThanOrEqual(150);
      expect(dist).toBeLessThanOrEqual(900);
    }
  });

  it('所有出生点均不在水里且不在障碍物碰撞体内', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const map = new GameMap(HARBOR_TOWN, world);
    const { player, targets } = HARBOR_TOWN.spawns;
    const allSpawns = [player, ...targets];

    for (const s of allSpawns) {
      const [x, z] = s.position;
      expect(map.surfaceAt(x, z)).not.toBe('water');
      expect(map.heightAt(x, z)).toBeGreaterThan(HARBOR_TOWN.waterLevel!);

      for (const o of HARBOR_TOWN.obstacles) {
        expect(isPointInObstacle(x, z, o, 1.8)).toBe(false);
      }
    }
  });

  it('带 2~3 条巡逻路线, 巡逻目标点在地图内、不在水里、不在障碍物内且路径通畅', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const map = new GameMap(HARBOR_TOWN, world);
    const targetsWithPatrol = HARBOR_TOWN.spawns.targets.filter((t) => t.patrol !== undefined);

    expect(targetsWithPatrol.length).toBeGreaterThanOrEqual(2);
    expect(targetsWithPatrol.length).toBeLessThanOrEqual(4);

    for (const t of targetsWithPatrol) {
      const to = t.patrol!.to;
      expect(Math.abs(to[0])).toBeLessThan(700);
      expect(Math.abs(to[1])).toBeLessThan(700);

      expect(map.surfaceAt(to[0], to[1])).not.toBe('water');
      expect(map.heightAt(to[0], to[1])).toBeGreaterThan(HARBOR_TOWN.waterLevel!);

      for (const o of HARBOR_TOWN.obstacles) {
        expect(isPointInObstacle(to[0], to[1], o, 1.8)).toBe(false);
      }

      // 巡逻路径沿途无障碍物阻挡 (街道/通道净宽保证通行)
      expect(isPathObstructed(t.position, to, HARBOR_TOWN.obstacles, 1.2)).toBe(false);
    }
  });
});

describe('港口城镇完整物理仿真构建与验证', () => {
  it('南部存在浅水港湾水域 (水面在 -0.5 m, 浅水可涉渡)', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const map = new GameMap(HARBOR_TOWN, world);

    // 检查 z = 550 港湾水域中心处
    expect(map.surfaceAt(0, 550)).toBe('water');
    const h = map.heightAt(0, 550);
    expect(h).toBeLessThan(HARBOR_TOWN.waterLevel!);
    // 水深约 1.0 m, 属于浅水
    expect(HARBOR_TOWN.waterLevel! - h).toBeCloseTo(1.0, 1);
  });

  it('GameMap 碰撞体加载正常, Game 实例能执行 fixedUpdate', () => {
    const game = new Game({
      map: HARBOR_TOWN,
      vehicles: VEHICLES,
      seed: 42,
      enemyAi: false,
      vegetation: false, // 加速物理测试
    });

    expect(game.player).toBeDefined();
    expect(game.targets.length).toBe(HARBOR_TOWN.spawns.targets.length);

    // 运行 30 步 (0.5 秒) 让车辆受重力平稳落至地面
    for (let i = 0; i < 30; i++) {
      game.fixedUpdate(1 / 60);
    }

    expect(game.player.isDead).toBe(false);
    for (const t of game.targets) {
      expect(t.isDead).toBe(false);
      const pos = t.physicsPosition();
      expect(Number.isNaN(pos.x)).toBe(false);
      expect(Number.isNaN(pos.y)).toBe(false);
      expect(Number.isNaN(pos.z)).toBe(false);
    }
  });
});
