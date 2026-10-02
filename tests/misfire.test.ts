import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { DamageModel, MISFIRE_MAX_CHANCE } from '../src/game/damage/DamageModel';
import { Vehicle, idleControls, MISFIRE_COOLDOWN } from '../src/game/Vehicle';
import { Game, type GameEvent } from '../src/game/Game';
import { makeRng } from '../src/game/damage/geometry';
import { SHOOTER, TEST_VEHICLES, flatMap } from './fixtures';

const DT = 1 / 60;

beforeAll(async () => {
  await RAPIER.init();
});

// ---- DamageModel 单元测试 ----

describe('DamageModel 哑火概率', () => {
  /** 创建一个 DamageModel 并返回炮闩和炮管模块 */
  function setup() {
    const dm = new DamageModel(SHOOTER);
    const breech = dm.modules.find((m) => m.type === 'breech')!;
    const barrel = dm.modules.find((m) => m.type === 'barrel')!;
    return { dm, breech, barrel };
  }

  it('模块满血时 misfireChance = 0', () => {
    const { dm } = setup();
    expect(dm.misfireChance).toBe(0);
  });

  it('炮闩掉血 → misfireChance 按公式增长', () => {
    const { dm, breech } = setup();
    breech.hp = breech.maxHp * 0.4; // 剩余 40%,损伤比例 60%
    const expected = MISFIRE_MAX_CHANCE * 0.6;
    expect(dm.misfireChance).toBeCloseTo(expected, 6);
  });

  it('炮管掉血 → misfireChance 按公式增长', () => {
    const { dm, barrel } = setup();
    barrel.hp = barrel.maxHp * 0.3; // 剩余 30%,损伤比例 70%
    const expected = MISFIRE_MAX_CHANCE * 0.7;
    expect(dm.misfireChance).toBeCloseTo(expected, 6);
  });

  it('取炮闩和炮管中较大的哑火概率', () => {
    const { dm, breech, barrel } = setup();
    breech.hp = breech.maxHp * 0.5; // 损伤 50% → P = 0.25
    barrel.hp = barrel.maxHp * 0.2; // 损伤 80% → P = 0.40
    expect(dm.misfireChance).toBeCloseTo(MISFIRE_MAX_CHANCE * 0.8, 6);
    expect(dm.misfirePart).toBe('barrel');
  });

  it('两者损伤相同时 misfirePart 取炮闩', () => {
    const { dm, breech, barrel } = setup();
    breech.hp = breech.maxHp * 0.5;
    barrel.hp = barrel.maxHp * 0.5;
    expect(dm.misfirePart).toBe('breech');
  });

  it('模块报废时 canFire = false,misfireChance = 0', () => {
    const { dm, breech } = setup();
    breech.hp = 0;
    expect(dm.canFire).toBe(false);
    expect(dm.misfireChance).toBe(0);
  });

  it('炮管报废时 canFire = false', () => {
    const { dm, barrel } = setup();
    barrel.hp = 0;
    expect(dm.canFire).toBe(false);
    expect(dm.misfireChance).toBe(0);
  });

  it('模块血量越低概率越高（多级验证）', () => {
    const { dm, breech } = setup();
    const chances: number[] = [];
    for (const ratio of [0.9, 0.6, 0.3, 0.1]) {
      breech.hp = breech.maxHp * ratio;
      chances.push(dm.misfireChance);
    }
    // 每一级都应该比前一级高
    for (let i = 1; i < chances.length; i++) {
      expect(chances[i]).toBeGreaterThan(chances[i - 1]);
    }
  });
});

// ---- Vehicle 集成测试 ----

describe('Vehicle 哑火机制', () => {
  function createVehicle() {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    // 地面碰撞体
    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(100, 1, 100).setTranslation(0, -1, 0), ground);
    const v = new Vehicle('test', SHOOTER, world, new THREE.Vector3(0, 1, 0), 0);
    world.step();
    v.capturePose();
    v.capturePose();
    return { world, v };
  }

  it('满血时按住开火不会哑火', () => {
    const { world, v } = createVehicle();
    const rng = makeRng(42);
    v.controls = { ...idleControls(), fire: true };
    const shots = v.fixedUpdate(DT, world, rng);
    expect(shots.length).toBe(1);
    expect(v.lastMisfire).toBeNull();
  });

  it('哑火时不消耗炮弹、不产生 FireRequest', () => {
    const { world, v } = createVehicle();
    // 制造一个必然哑火的条件:炮闩几乎打坏
    const breech = v.damage.modules.find((m) => m.type === 'breech')!;
    breech.hp = 1; // 几乎打坏
    const roundsBefore = v.damage.rounds();
    const loadedBefore = v.loaded;
    expect(loadedBefore).not.toBeNull();

    // 用一个始终返回接近 0 的 rng,确保一定哑火（概率接近 0.5,rng < 0.5 一定触发）
    const alwaysLow = () => 0.01;
    v.controls = { ...idleControls(), fire: true };
    const shots = v.fixedUpdate(DT, world, alwaysLow);

    expect(shots.length).toBe(0);
    expect(v.lastMisfire).not.toBeNull();
    expect(v.loaded).toBe(loadedBefore); // 炮弹还在炮膛里
    expect(v.damage.rounds()).toBe(roundsBefore); // 弹药架没变
  });

  it('哑火后 misfirePart 正确指向损伤更重的模块', () => {
    const { world, v } = createVehicle();
    const barrel = v.damage.modules.find((m) => m.type === 'barrel')!;
    barrel.hp = 1; // 炮管损伤更重
    const alwaysLow = () => 0.01;
    v.controls = { ...idleControls(), fire: true };
    v.fixedUpdate(DT, world, alwaysLow);
    expect(v.lastMisfire?.part).toBe('barrel');
  });

  it('哑火后冷却期内不能再次击发', () => {
    const { world, v } = createVehicle();
    const breech = v.damage.modules.find((m) => m.type === 'breech')!;
    breech.hp = 1;
    const alwaysLow = () => 0.01;
    v.controls = { ...idleControls(), fire: true };

    // 第一步：哑火
    v.fixedUpdate(DT, world, alwaysLow);
    expect(v.lastMisfire).not.toBeNull();
    expect(v.misfireCooldown).toBeCloseTo(MISFIRE_COOLDOWN, 2);

    // 冷却期内继续按开火：不触发（既不开火也不重新掷骰）
    const secondShots = v.fixedUpdate(DT, world, alwaysLow);
    expect(secondShots.length).toBe(0);
    expect(v.lastMisfire).toBeNull(); // 本步没有新的哑火

    // 快进过冷却期（松开开火键,防止冷却结束时立刻开火消耗炮弹）
    v.controls = { ...idleControls(), fire: false };
    for (let t = 0; t < MISFIRE_COOLDOWN / DT + 2; t++) {
      v.fixedUpdate(DT, world, alwaysLow);
    }
    expect(v.misfireCooldown).toBe(0);

    // 冷却结束后再按开火,应该再次哑火
    v.controls = { ...idleControls(), fire: true };
    v.fixedUpdate(DT, world, alwaysLow);
    expect(v.lastMisfire).not.toBeNull();
  });

  it('高 rng 值不会触发哑火（概率检查正确）', () => {
    const { world, v } = createVehicle();
    const breech = v.damage.modules.find((m) => m.type === 'breech')!;
    breech.hp = breech.maxHp * 0.5; // 损伤 50%,P = 0.25
    // rng 返回 0.99,远高于 0.25 的概率,不应触发哑火
    const alwaysHigh = () => 0.99;
    v.controls = { ...idleControls(), fire: true };
    const shots = v.fixedUpdate(DT, world, alwaysHigh);
    expect(shots.length).toBe(1);
    expect(v.lastMisfire).toBeNull();
  });
});

// ---- Game 集成测试:事件与敌方 ----

describe('Game 集成:哑火事件与敌方', () => {
  it('哑火时 Game 发出 misfire 事件', () => {
    const map = flatMap(
      { vehicleId: 'shooter', position: [0, 0], heading: 0 },
      [{ vehicleId: 'target', position: [0, 50], heading: 180 }],
    );
    const game = new Game({
      map,
      vehicles: TEST_VEHICLES,
      seed: 42,
      enemyAi: false,
      vegetation: false,
      render: false,
    });

    // 损伤玩家的炮闩
    const breech = game.player.damage.modules.find((m) => m.type === 'breech')!;
    breech.hp = 1;

    // 多次尝试开火,直到触发哑火
    let misfireFound = false;
    for (let attempt = 0; attempt < 200 && !misfireFound; attempt++) {
      game.setPlayerControls({ ...idleControls(), fire: true });
      game.fixedUpdate(DT);
      const events = game.drainEvents();
      const misfire = events.find((e): e is Extract<GameEvent, { type: 'misfire' }> => e.type === 'misfire');
      if (misfire) {
        misfireFound = true;
        expect(misfire.vehicleId).toBe('player');
        expect(misfire.part).toBe('breech');
      }
      // 如果这一步成功开火了,需要重新装弹等一段时间
      if (events.some((e) => e.type === 'fired')) {
        // 等装填完毕
        for (let i = 0; i < 60; i++) {
          game.setPlayerControls(idleControls());
          game.fixedUpdate(DT);
          game.drainEvents();
        }
      }
      // 哑火冷却
      if (events.some((e) => e.type === 'misfire')) break;
      for (let i = 0; i < Math.ceil(MISFIRE_COOLDOWN / DT) + 1; i++) {
        game.setPlayerControls(idleControls());
        game.fixedUpdate(DT);
        game.drainEvents();
      }
    }
    expect(misfireFound).toBe(true);

    game.dispose();
  });

  it('满血玩家不会哑火', () => {
    const map = flatMap(
      { vehicleId: 'shooter', position: [0, 0], heading: 0 },
      [],
    );
    const game = new Game({
      map,
      vehicles: TEST_VEHICLES,
      seed: 123,
      enemyAi: false,
      vegetation: false,
      render: false,
    });

    // 满血开火 100 次,不应出现哑火
    for (let attempt = 0; attempt < 100; attempt++) {
      game.setPlayerControls({ ...idleControls(), fire: true });
      game.fixedUpdate(DT);
      const events = game.drainEvents();
      const misfire = events.find((e) => e.type === 'misfire');
      expect(misfire).toBeUndefined();
      // 等装填
      for (let i = 0; i < 60; i++) {
        game.setPlayerControls(idleControls());
        game.fixedUpdate(DT);
        game.drainEvents();
      }
    }

    game.dispose();
  });

  it('敌方 AI 也会哑火', () => {
    const map = flatMap(
      { vehicleId: 'shooter', position: [0, 0], heading: 0 },
      [{ vehicleId: 'shooter', position: [0, 80], heading: 180, ai: true }],
    );
    const game = new Game({
      map,
      vehicles: TEST_VEHICLES,
      seed: 7,
      enemyAi: true,
      vegetation: false,
      render: false,
    });

    // 损伤敌方的炮闩
    const enemy = game.targets[0];
    const breech = enemy.damage.modules.find((m) => m.type === 'breech')!;
    breech.hp = 1;

    // 让敌方 AI 发现玩家并尝试开火,运行多步
    let misfireFound = false;
    for (let i = 0; i < 1200 && !misfireFound; i++) {
      game.setPlayerControls(idleControls());
      game.fixedUpdate(DT);
      const events = game.drainEvents();
      const misfire = events.find(
        (e): e is Extract<GameEvent, { type: 'misfire' }> => e.type === 'misfire' && e.vehicleId === enemy.id,
      );
      if (misfire) {
        misfireFound = true;
        expect(misfire.part).toBe('breech');
      }
    }
    expect(misfireFound).toBe(true);

    game.dispose();
  });
});

// ---- 统计测试:用固定种子跑多次,验证概率在合理范围 ----

describe('哑火概率统计验证', () => {
  it('损伤 50% 时,100 次击发中哑火次数在合理范围', () => {
    // P = 0.5 × 0.5 = 0.25,100 次中约 25 次
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(100, 1, 100).setTranslation(0, -1, 0), ground);
    const rng = makeRng(12345);

    let misfires = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      const v = new Vehicle(`v${i}`, SHOOTER, world, new THREE.Vector3(0, 1, 0), 0);
      world.step();
      v.capturePose();
      v.capturePose();
      const breech = v.damage.modules.find((m) => m.type === 'breech')!;
      breech.hp = breech.maxHp * 0.5; // 损伤 50%,P = 0.25
      v.controls = { ...idleControls(), fire: true };
      const shots = v.fixedUpdate(DT, world, rng);
      if (shots.length === 0 && v.lastMisfire) misfires++;
    }
    // 25% 概率,100 次:期望 25,允许 10–45 的范围(很宽松)
    expect(misfires).toBeGreaterThanOrEqual(10);
    expect(misfires).toBeLessThanOrEqual(45);

    world.free();
  });

  it('损伤 90% 时哑火概率显著高于损伤 10%', () => {
    const rng = makeRng(9999);

    function countMisfires(damageRatio: number, n: number): number {
      let count = 0;
      for (let i = 0; i < n; i++) {
        const dm = new DamageModel(SHOOTER);
        const breech = dm.modules.find((m) => m.type === 'breech')!;
        breech.hp = breech.maxHp * (1 - damageRatio);
        const p = dm.misfireChance;
        if (rng() < p) count++;
      }
      return count;
    }

    const lowDamage = countMisfires(0.1, 200); // P = 0.05
    const highDamage = countMisfires(0.9, 200); // P = 0.45
    expect(highDamage).toBeGreaterThan(lowDamage);
  });
});
