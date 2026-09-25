import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GameMap } from '../src/game/Map';
import { TRAINING_GROUND } from '../src/data/maps';

beforeAll(async () => {
  await RAPIER.init();
});

function build() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const map = new GameMap(TRAINING_GROUND, world);
  world.step();
  const groundY = (x: number, z: number) => {
    const hit = world.castRay(new RAPIER.Ray({ x, y: 100, z }, { x: 0, y: -1, z: 0 }), 200, true);
    return hit ? 100 - hit.timeOfImpact : NaN;
  };
  return { world, map, groundY };
}

const nearObstacle = (x: number, z: number) =>
  TRAINING_GROUND.obstacles.some((o) => Math.hypot(o.position[0] - x, o.position[1] - z) < 10);

describe('地图:高度图 + 障碍物', () => {
  it('碰撞地形与渲染网格用同一份高度数据(采样点上高度一致)', () => {
    const { map, groundY } = build();
    const terrain = map.root.getObjectByName('terrain') as THREE.Mesh;
    const pos = terrain.geometry.getAttribute('position');
    const n = TRAINING_GROUND.terrain.heightmap!.resolution;
    let checked = 0;
    for (let iz = 1; iz < n - 1; iz += 2) {
      for (let ix = 1; ix < n - 1; ix += 2) {
        const x = -map.half + ix * map.cellSize;
        const z = -map.half + iz * map.cellSize;
        if (nearObstacle(x, z)) continue;
        const expected = map.vertexHeight(ix, iz);
        expect(groundY(x, z)).toBeCloseTo(expected, 2);
        expect(pos.getX(iz * n + ix)).toBeCloseTo(x, 4);
        expect(pos.getZ(iz * n + ix)).toBeCloseTo(z, 4);
        expect(pos.getY(iz * n + ix)).toBeCloseTo(expected, 4);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('heightAt 在格点上等于采样高度', () => {
    const { map } = build();
    expect(map.heightAt(-map.half, -map.half)).toBeCloseTo(map.vertexHeight(0, 0), 6);
    expect(map.heightAt(0, 0)).toBeCloseTo(map.vertexHeight(10, 10), 6);
  });

  it('heightAt 与碰撞面在任意位置一致(包括恰好落在网格线上的点)', () => {
    const { map, groundY } = build();
    let checked = 0;
    for (let i = 0; i < 400; i++) {
      // 一半点落在网格线上(旧的 heightfield 碰撞体在这些点上射线会漏检)
      const onLine = i % 2 === 0;
      const x = onLine ? Math.round((i * 37) % 180) - 90 : ((i * 7.31) % 180) - 90;
      const z = onLine ? -90 + 10 * (i % 19) : ((i * 3.77) % 180) - 90;
      if (nearObstacle(x, z)) continue;
      expect(groundY(x, z)).toBeCloseTo(map.heightAt(x, z), 3);
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('障碍物有碰撞体,顶部高于地面', () => {
    const { map, groundY } = build();
    for (const o of TRAINING_GROUND.obstacles) {
      const [x, z] = o.position;
      expect(groundY(x, z)).toBeGreaterThan(map.heightAt(x, z) + o.size[1] / 2);
    }
  });

  it('四周有边界墙,开不出地图', () => {
    const { world, map } = build();
    const hit = world.castRay(new RAPIER.Ray({ x: 0, y: 12, z: 0 }, { x: 1, y: 0, z: 0 }), 500, true);
    expect(hit).not.toBeNull();
    expect(hit!.timeOfImpact).toBeLessThanOrEqual(map.half + 0.01);
  });
});
