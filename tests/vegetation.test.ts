import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GameMap } from '../src/game/Map';
import { Vegetation, type VegetationOptions } from '../src/game/Vegetation';
import { Game, type GameEvent } from '../src/game/Game';
import { idleControls } from '../src/game/Vehicle';
import type { MapSpec, VegetationSpec } from '../src/data/types';
import { VEHICLES } from '../src/data/vehicles';
import { flatMap } from './fixtures';

const DT = 1 / 60;

beforeAll(async () => {
  await RAPIER.init();
});

function build(map: MapSpec, spec: VegetationSpec, options: Partial<VegetationOptions> = {}) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const gm = new GameMap(map, world);
  const veg = new Vegetation(gm, spec, world, { density: 1, grassDistance: 0, clearPoints: [], render: false, ...options });
  return { world, gm, veg };
}

const FLAT = flatMap({ vehicleId: 'tiger_i', position: [0, 100], heading: 0 }, [], 400);
const MIXED: VegetationSpec = {
  zones: [
    { kind: 'tree', at: [-80, -80], radius: 60, density: 150, seed: 1 },
    { kind: 'pine', at: [80, -80], radius: 60, density: 150, seed: 2 },
    { kind: 'bush', polygon: [[-150, 20], [150, 20], [150, 150], [-150, 150]], density: 60, seed: 3 },
  ],
};
const positions = (v: Vegetation) => v.plants.map((p) => `${p.kind}:${p.x.toFixed(3)},${p.z.toFixed(3)}`);

describe('植被生成', () => {
  it('固定种子:两次生成的位置完全一样;密度大致符合数据', () => {
    const a = build(FLAT, MIXED).veg;
    const b = build(FLAT, MIXED).veg;
    expect(positions(a)).toEqual(positions(b));
    const area = Math.PI * 60 * 60;
    expect(a.count('tree')).toBeGreaterThan((area * 150) / 10_000 * 0.7);
    expect(a.count('tree')).toBeLessThanOrEqual(Math.round((area * 150) / 10_000));
    expect(a.count('bush')).toBeGreaterThan(300 * 130 * 60 / 10_000 * 0.7);
  });

  it('出生点周围留空', () => {
    const { veg } = build(FLAT, MIXED, { clearPoints: [[0, 80], [-80, -80]] });
    for (const p of veg.plants) {
      expect(Math.hypot(p.x - 0, p.z - 80)).toBeGreaterThanOrEqual(12);
      expect(Math.hypot(p.x + 80, p.z + 80)).toBeGreaterThanOrEqual(12);
    }
  });

  it('水里不长:河谷里的浅水没有植物', () => {
    const map: MapSpec = {
      ...FLAT,
      terrain: {
        cellSize: 5,
        base: 0,
        features: [{ kind: 'valley', path: [[0, -200], [0, 200]], width: 40, depth: 3, bank: 10 }],
      },
      waterLevel: -1.5,
    };
    const { gm, veg } = build(map, { zones: [{ kind: 'bush', polygon: [[-100, -100], [100, -100], [100, 100], [-100, 100]], density: 80, seed: 9 }] });
    expect(veg.count('bush')).toBeGreaterThan(100);
    for (const p of veg.plants) expect(gm.surfaceAt(p.x, p.z)).not.toBe('water');
    expect(veg.plants.some((p) => Math.abs(p.x) < 15)).toBe(false);
  });

  it('画质密度 0.5:剩下约一半,而且留下的植物位置不变(是满密度的子集)', () => {
    const full = build(FLAT, MIXED).veg;
    const half = build(FLAT, MIXED, { density: 0.5 }).veg;
    const ratio = half.plants.length / full.plants.length;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
    const all = new Set(positions(full));
    expect(positions(half).every((p) => all.has(p))).toBe(true);
  });
});

describe('植被破坏', () => {
  /** 在 (0, -10) 附近只长一棵树 */
  const ONE_TREE: VegetationSpec = { zones: [{ kind: 'tree', at: [0, -10], radius: 1, density: 10_000, seed: 4 }] };
  const tank = (mass: number, speed: number, pushing = 0) => ({
    position: new THREE.Vector3(0, 1, -10 + 3 + 0.3),
    quaternion: new THREE.Quaternion(),
    length: 6,
    width: 3.5,
    mass,
    forwardSpeed: speed,
    pushing,
  });

  it('轻车慢速顶不倒树,重型坦克开过去就撞倒(倒向行驶方向),碰撞体随之移除', () => {
    const { veg } = build(FLAT, ONE_TREE);
    expect(veg.plants).toHaveLength(1);
    const tree = veg.plants[0];
    tree.x = 0;
    tree.z = -10;
    expect(veg.interactVehicle(tank(800, 0.3))).toHaveLength(0);
    expect(tree.state).toBe('ok');
    const handle = tree.collider!.handle;
    expect(veg.interactVehicle(tank(57_000, 2, 1))).toHaveLength(1);
    expect(tree.state).toBe('falling');
    expect(tree.fallDir[1]).toBeCloseTo(-1, 6);
    // 碰撞体等到 flush(物理步之前)才移除;在那之前按碰撞体还能找到这棵树
    expect(veg.treeByCollider(handle)).toBe(tree);
    veg.flush();
    expect(veg.treeByCollider(handle)).toBe(undefined as unknown as typeof tree);
    for (let i = 0; i < 120; i++) veg.update(DT, new THREE.Vector3());
    expect(tree.state).toBe('down');
  });

  it('主炮炮弹一发打碎灌木,机枪要打很多发;树挡住子弹,主炮动能弹打断树继续飞,化学能弹在树上起爆', () => {
    const { veg } = build(FLAT, { zones: [{ kind: 'bush', at: [0, 0], radius: 20, density: 400, seed: 5 }, ...ONE_TREE.zones] });
    const bushes = veg.plants.filter((p) => p.kind === 'bush');
    expect(veg.hitBush(bushes[0], 88)).toBe(true);
    let shots = 0;
    while (!veg.hitBush(bushes[1], 7.92) && shots < 100) shots++;
    expect(shots + 1).toBeGreaterThanOrEqual(8);
    expect(shots + 1).toBeLessThanOrEqual(20);
    const tree = veg.plants.find((p) => p.kind === 'tree')!;
    expect(veg.hitTree(tree, 0, -1, 7.92, false)).toEqual({ stopped: true, felled: false });
    expect(veg.hitTree(tree, 0, -1, 88, false)).toEqual({ stopped: false, felled: true });
    const { veg: v2 } = build(FLAT, ONE_TREE);
    expect(v2.hitTree(v2.plants[0], 0, -1, 75, true)).toEqual({ stopped: true, felled: true });
  });

  it('灌木和树冠挡视线,离起点很近的不算(趴在灌木里能看出去)', () => {
    const { veg } = build(FLAT, { zones: [{ kind: 'pine', at: [0, 0], radius: 30, density: 400, seed: 6 }] });
    const a = new THREE.Vector3(-200, 2.5, 0);
    const b = new THREE.Vector3(200, 2.5, 0);
    expect(veg.blocksSight(a, b)).toBe(true);
    expect(veg.blocksSight(new THREE.Vector3(-200, 2.5, 100), new THREE.Vector3(200, 2.5, 100))).toBe(false);
    const bushOnly = build(FLAT, { zones: [{ kind: 'bush', at: [0, 0], radius: 2, density: 3000, seed: 7 }] }).veg;
    const bush = bushOnly.plants[0];
    const from = new THREE.Vector3(bush.x, 1, bush.z);
    expect(bushOnly.blocksSight(from, new THREE.Vector3(bush.x + 300, 1, bush.z))).toBe(false);
    expect(bushOnly.blocksSight(new THREE.Vector3(bush.x - 300, 1, bush.z), new THREE.Vector3(bush.x + 300, 1, bush.z))).toBe(true);
  });

  it('草丛被履带压倒,车开走后几秒内恢复原形', () => {
    const { veg } = build(FLAT, { zones: [], grass: { density: 150, seed: 8 } });
    veg.loadGrassAround(0, 0, 20);
    expect(veg.grassStats().loaded).toBeGreaterThan(100);
    veg.interactVehicle(tank(57_000, 3));
    const bent = veg.grassStats().bent;
    expect(bent).toBeGreaterThan(5);
    for (let i = 0; i < 60; i++) veg.update(DT, new THREE.Vector3());
    expect(veg.grassStats().bent).toBe(bent);
    for (let i = 0; i < 60 * 5; i++) veg.update(DT, new THREE.Vector3());
    expect(veg.grassStats().bent).toBe(0);
  });
});

describe('植被与对局', () => {
  function duel(vegetation: VegetationSpec, enemyAi = false) {
    const map: MapSpec = {
      ...flatMap({ vehicleId: 'tiger_i', position: [0, 100], heading: 0 }, [{ vehicleId: 't34_85', position: [0, -100], heading: 90, ammoFraction: 1 }], 500),
      vegetation,
    };
    const game = new Game({ map, vehicles: VEHICLES, seed: 3, enemyAi, render: false, aiPreset: 'guard' });
    const events: GameEvent[] = [];
    const run = (seconds: number, controls = idleControls) => {
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        game.setPlayerControls(controls());
        game.fixedUpdate(DT);
        events.push(...game.drainEvents());
      }
    };
    return { game, events, run };
  }

  it('坦克开进灌木丛把灌木压碎', () => {
    const { game, run } = duel({ zones: [{ kind: 'bush', polygon: [[-15, 30], [15, 30], [15, 70], [-15, 70]], density: 300, seed: 11 }] });
    const before = game.vegetation!.count('bush');
    expect(before).toBeGreaterThan(10);
    run(12, () => ({ ...idleControls(), throttle: 1 }));
    expect(game.vegetation!.count('bush', 'gone')).toBeGreaterThan(3);
  });

  it('坦克撞倒路上的树,不会被树挡住', () => {
    const { game, events, run } = duel({ zones: [{ kind: 'tree', polygon: [[-3, 55], [3, 55], [3, 60], [-3, 60]], density: 3000, seed: 12 }] });
    expect(game.vegetation!.count('tree')).toBeGreaterThan(0);
    run(15, () => ({ ...idleControls(), throttle: 1 }));
    expect(events.some((e) => e.type === 'tree-felled')).toBe(true);
    expect(game.player.physicsPosition().z).toBeLessThan(45);
  });

  it('主炮炮弹穿过灌木:灌木碎了,炮弹照样打中后面的车', () => {
    const { game, events, run } = duel({ zones: [{ kind: 'bush', at: [0, 0], radius: 3, density: 2500, seed: 13 }] });
    expect(game.vegetation!.count('bush')).toBeGreaterThan(0);
    const aim = () => ({ ...idleControls(), aimPoint: game.targets[0].physicsPosition() });
    run(3, aim);
    run(1.5, () => ({ ...aim(), fire: true }));
    expect(events.some((e) => e.type === 'impact' && e.kind === 'bush')).toBe(true);
    expect(events.some((e) => e.type === 'hit' && e.targetId === game.targets[0].id)).toBe(true);
  });

  it('躲在灌木后面敌方看不见;开炮之后暴露位置几秒', () => {
    // 玩家车前 12–26 m 一片密灌木(出生点 12 m 内不长)
    const { game, run } = duel({ zones: [{ kind: 'bush', polygon: [[-15, 74], [15, 74], [15, 88], [-15, 88]], density: 4000, seed: 14 }] });
    expect(game.vegetation!.count('bush')).toBeGreaterThan(5);
    run(0.5);
    const enemy = game.targets[0];
    expect(game.lineOfSight(enemy, game.player)).toBe(false);
    game.setPlayerControls({ ...idleControls(), aimPoint: new THREE.Vector3(60, 1, -100), fire: true });
    game.fixedUpdate(DT);
    expect(game.lineOfSight(enemy, game.player)).toBe(true);
  });
});
