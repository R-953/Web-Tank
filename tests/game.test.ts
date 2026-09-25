import * as THREE from 'three';
import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, type GameEvent } from '../src/game/Game';
import { idleControls } from '../src/game/Vehicle';
import type { SpawnSpec } from '../src/data/types';
import { TEST_VEHICLES, flatMap } from './fixtures';

const DT = 1 / 60;

beforeAll(async () => {
  await RAPIER.init();
});

/** 玩家在 (0, 30) 朝 -Z;靶车在 (0, -20),朝向由测试决定 */
function setup(target: Partial<SpawnSpec> = {}, playerLoadout?: Record<string, number>) {
  const game = new Game({
    map: flatMap({ vehicleId: 'shooter', position: [0, 30], heading: 0 }, [
      { vehicleId: 'target', position: [0, -20], heading: 90, ...target },
    ]),
    vehicles: TEST_VEHICLES,
    seed: 7,
    playerLoadout,
  });
  const events: GameEvent[] = [];
  const run = (seconds: number, fire = false) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      const t = game.targets[0];
      game.setPlayerControls({ ...idleControls(), aimPoint: t.physicsPosition(), fire });
      game.fixedUpdate(DT);
      events.push(...game.drainEvents());
    }
  };
  run(1); // 落地、炮塔对准
  return { game, events, run, target: game.targets[0] };
}

const hits = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { type: 'hit' }> => e.type === 'hit');

describe('战斗闭环:移动 → 瞄准 → 开火 → 命中判定 → 模块 / 乘员伤害 → 摧毁', () => {
  it('打侧面:击穿,车内模块或乘员掉血,回放数据完整', () => {
    const { events, run, target } = setup({ heading: 90 });
    run(1 / 60, true);
    run(0.4);
    const h = hits(events);
    expect(h).toHaveLength(1);
    const r = h[0].replay;
    expect(r.armor!.face).toBe('side');
    expect(r.armor!.penetrated).toBe(true);
    expect(r.penetration).not.toBeNull();
    expect(r.penetration!.hits.length).toBeGreaterThan(0);
    // 回放里的前后快照与车辆当前状态一致
    const hurt = Object.keys(r.after).filter((k) => r.after[k] < r.before[k]);
    expect(hurt.length).toBeGreaterThan(0);
    const damaged =
      target.damage.modules.some((m) => m.hp < m.maxHp) || target.damage.crew.some((c) => c.hp < 100);
    expect(damaged).toBe(true);
  });

  it('打正面:150mm > 穿深 100mm,未击穿,车内毫发无损', () => {
    const { events, run, target } = setup({ heading: 180 });
    run(1 / 60, true);
    run(0.4);
    const h = hits(events);
    expect(h).toHaveLength(1);
    expect(h[0].replay.armor!.face).toBe('front');
    expect(h[0].replay.armor!.penetrated).toBe(false);
    expect(h[0].replay.penetration).toBeNull();
    expect(target.damage.modules.every((m) => m.hp === m.maxHp)).toBe(true);
    expect(target.damage.crew.every((c) => c.alive && c.hp === 100)).toBe(true);
  });

  it('连续击穿直到乘员不足 2 人(或殉爆):摧毁并判定胜利', () => {
    const { game, events, run, target } = setup({ heading: 90 });
    for (let i = 0; i < 30 && !target.isDead; i++) run(0.5, true);
    expect(target.isDead).toBe(true);
    expect(target.damage.aliveCount < 2 || target.damage.detonated).toBe(true);
    const destroyed = events.filter((e) => e.type === 'destroyed' && e.vehicleId === target.id);
    expect(destroyed).toHaveLength(1);
    // 致命一击的回放标记为 destroyed(用于播放击杀回放)
    expect(hits(events).filter((e) => e.replay.destroyed)).toHaveLength(1);
    expect(events.some((e) => e.type === 'victory')).toBe(true);
    expect(game.state).toBe('victory');
  });

  it('打中炮管:炮管被打坏,炮弹被挡下不进车内,靶车无法开火', () => {
    const { events, run, target, game } = setup({ heading: 90 });
    // 瞄炮管中段(伸出车体侧面,不会先打到炮塔)
    const { origin, dir } = target.muzzle();
    const aim = origin.clone().addScaledVector(dir, -1.2);
    for (let i = 0; i < 60; i++) {
      game.setPlayerControls({ ...idleControls(), aimPoint: aim, fire: i === 40 });
      game.fixedUpdate(DT);
      events.push(...game.drainEvents());
    }
    run(0.3);
    const h = hits(events);
    expect(h).toHaveLength(1);
    expect(h[0].part).toBe('barrel');
    expect(h[0].replay.penetration).toBeNull();
    expect(target.damage.module('barrel')!.hp).toBe(0);
    expect(target.damage.canFire).toBe(false);
    expect(target.damage.crew.every((c) => c.alive)).toBe(true);
  });

  it('打中侧面低处的履带:履带断,车辆无法行驶', () => {
    const { events, target, game } = setup({ heading: 90 });
    // 朝向玩家(+Z)那一侧的履带,瞄它在车体侧面上的中点
    const f = target.frames();
    const toWorld = (v: THREE.Vector3) => v.applyQuaternion(target.physicsQuaternion()).add(target.physicsPosition());
    const candidates = target.damage.modules
      .filter((m) => m.type === 'track')
      .map((m) => {
        const c = f.pointToHull('hull', m.box.center);
        const onPlate = c.clone().setX(Math.sign(c.x) * (target.spec.hull.width / 2));
        return { id: m.id, aim: toWorld(onPlate) };
      })
      .sort((a, b) => b.aim.z - a.aim.z);
    const { id: trackId, aim } = candidates[0];
    for (let i = 0; i < 90; i++) {
      game.setPlayerControls({ ...idleControls(), aimPoint: aim, fire: i === 60 });
      game.fixedUpdate(DT);
      events.push(...game.drainEvents());
    }
    const h = hits(events);
    expect(h).toHaveLength(1);
    expect(h[0].replay.external.map((x) => x.id)).toContain(trackId);
    expect(target.damage.module(trackId)!.hp).toBe(0);
    expect(target.damage.canDrive).toBe(false);
  });

  it('高爆弹打在车体侧面:穿深只有十几毫米打不穿,但冲击波把旁边的履带炸断', () => {
    const { events, run, target } = setup({ heading: 90 }, { he: 10 });
    run(1 / 60, true);
    run(0.4);
    const h = hits(events);
    expect(h).toHaveLength(1);
    expect(h[0].replay.shell.type).toBe('HE');
    expect(h[0].replay.armor!.penetrated).toBe(false);
    expect(h[0].replay.external.some((x) => x.name.includes('履带'))).toBe(true);
    expect(target.damage.crew.every((c) => c.alive && c.hp === 100)).toBe(true);
    expect(target.damage.canDrive).toBe(false);
  });

  it('碎甲弹不计入射角:从 62° 斜着打侧面也能击穿(被帽弹同样角度打不穿)', () => {
    // 靶车转 62°:侧面对炮口的入射角约 62°(等效 107mm);50mm 侧装甲,碎甲弹 90mm 穿深
    const hesh = setup({ heading: 90 + 62 }, { hesh: 10 });
    hesh.run(1 / 60, true);
    hesh.run(0.4);
    const a = hits(hesh.events)[0].replay.armor!;
    expect(a.face).toBe('side');
    expect(a.angleDeg).toBeGreaterThan(55);
    expect(a.penetrated).toBe(true);
    const ap = setup({ heading: 90 + 62 }, { aphe: 10 });
    ap.run(1 / 60, true);
    ap.run(0.4);
    expect(hits(ap.events)[0].replay.armor!.penetrated).toBe(false);
  });

  it('两个物理步之间的一次快速点击也会开火(高刷新率下有的帧不跑物理步)', () => {
    const { game } = setup({ heading: 90 });
    const aimPoint = game.targets[0].physicsPosition();
    game.setPlayerControls({ ...idleControls(), aimPoint, fire: true }); // 按下
    game.setPlayerControls({ ...idleControls(), aimPoint, fire: false }); // 同一个物理步前就松开
    game.fixedUpdate(DT);
    expect(game.drainEvents().some((e) => e.type === 'fired')).toBe(true);
    game.fixedUpdate(DT);
    expect(game.drainEvents().some((e) => e.type === 'fired')).toBe(false);
  });

  it('炮弹飞出后会被清理,不会无限堆积', () => {
    const { game, run } = setup({ heading: 90 });
    run(1 / 60, true);
    expect(game.projectiles.length).toBe(1);
    run(1);
    expect(game.projectiles.length).toBe(0);
  });
});

describe('巡逻靶', () => {
  it('匀速往返:到终点后倒车返回,巡航速度稳定', () => {
    const { game } = setup({ position: [-20, -20], heading: -90, patrol: { to: [20, -20], speed: 12 } });
    const t = game.targets[0];
    let maxX = -Infinity;
    const cruise: number[] = [];
    let returned = false;
    for (let i = 0; i < 40 * 60; i++) {
      game.fixedUpdate(DT);
      const x = t.physicsPosition().x;
      maxX = Math.max(maxX, x);
      if (x > -10 && x < 10 && maxX < 15) cruise.push(Math.abs(t.forwardSpeed));
      if (maxX >= 19 && x < 0) returned = true;
    }
    expect(maxX).toBeGreaterThanOrEqual(19);
    expect(returned).toBe(true);
    const avg = cruise.reduce((a, b) => a + b, 0) / cruise.length;
    expect(avg).toBeCloseTo(12 / 3.6, 1);
    expect(Math.max(...cruise) - Math.min(...cruise)).toBeLessThan(0.1);
  });
});
