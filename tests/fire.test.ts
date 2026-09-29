import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, type GameEvent } from '../src/game/Game';
import { DamageModel } from '../src/game/damage/DamageModel';
import { makeRng } from '../src/game/damage/geometry';
import { DAMAGE } from '../src/data/damage';
import { TIGER_I, VEHICLES } from '../src/data/vehicles';
import { TEST_VEHICLES, flatMap } from './fixtures';

const DT = 1 / 60;

beforeAll(async () => {
  await RAPIER.init();
});

function run(game: Game, seconds: number, events: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    game.fixedUpdate(DT);
    events.push(...game.drainEvents());
  }
  return events;
}

const fireEvents = (events: GameEvent[], id: string) =>
  events.filter((e): e is Extract<GameEvent, { type: 'fire' }> => e.type === 'fire' && e.vehicleId === id);

describe('起火(DamageModel)', () => {
  it('油箱被打坏大概率起火;起火后附近的模块持续掉血,烧完自行熄灭', () => {
    const d = new DamageModel(TIGER_I);
    const tank = d.modules.find((m) => m.type === 'fuel')!;
    d.applyDamage({ kind: 'module', module: tank }, tank.hp, 'shell', 0); // 没有 rng:按中位数规则,打坏时起火概率 ≥ 50% 就起火
    expect(d.fire?.source).toBe(tank.id);
    const events = d.update(DT);
    expect(events.some((e) => e.type === 'fire-start')).toBe(true);
    const engine = d.module('engine')!;
    const before = engine.hp;
    for (let i = 0; i < 60 * 5; i++) d.update(DT);
    expect(engine.hp).toBeLessThan(before);
    const out: string[] = [];
    for (let i = 0; i < 60 * 60 && d.fire; i++) out.push(...d.update(DT).map((e) => (e.type === 'fire-out' ? e.reason : e.type)));
    expect(d.fire).toBeNull();
    expect(out).toContain('burnt-out');
  });

  it('灭火:2 秒扑灭,用掉一个灭火器;灭火器用完就灭不了', () => {
    const d = new DamageModel(TIGER_I);
    d.extinguishers = 1;
    d.ignite('engine');
    expect(d.extinguish()).toBe(true);
    expect(d.extinguish()).toBe(false); // 正在灭
    let reason = '';
    for (let i = 0; i < Math.ceil((DAMAGE.fire.extinguishTime + 0.1) / DT); i++) {
      for (const e of d.update(DT)) if (e.type === 'fire-out') reason = e.reason;
    }
    expect(reason).toBe('extinguished');
    expect(d.extinguishers).toBe(0);
    d.ignite('engine');
    expect(d.extinguish()).toBe(false);
  });

  it('火烧到弹药架:烤够 cookOffDelay 秒后可能殉爆', () => {
    const d = new DamageModel(TIGER_I);
    // 找一个离弹药架最近的可燃模块来点火;没有就直接在弹药架上点
    const rack = d.racks.find((r) => d.rackRounds(r) > 0)!;
    d.ignite(rack.module.id);
    d.fire!.remaining = 1000;
    const rng = makeRng(7);
    let cooked = false;
    for (let i = 0; i < 60 * 120 && !cooked; i++) cooked = d.update(DT, rng).some((e) => e.type === 'cook-off');
    expect(cooked).toBe(true);
    expect(d.detonated).toBe(true);
    expect(d.knockedOut).toBe(true);
  });
});

describe('起火(对局)', () => {
  function tigers() {
    const map = flatMap({ vehicleId: 'tiger_i', position: [0, 60], heading: 0 }, [{ vehicleId: 'tiger_i', position: [0, -60], heading: 90 }], 400);
    return new Game({ map, vehicles: VEHICLES, seed: 5, enemyAi: false });
  }

  it('玩家起火 → 按灭火键 → 2 秒后扑灭,事件依次是 start / extinguishing / extinguished', () => {
    const game = tigers();
    game.player.damage.ignite('engine');
    const events = run(game, 0.5);
    game.extinguish();
    run(game, DAMAGE.fire.extinguishTime + 0.2, events);
    const states = fireEvents(events, 'player').map((e) => e.state);
    expect(states).toEqual(['start', 'extinguishing', 'extinguished']);
    expect(fireEvents(events, 'player')[0].module).toBe('发动机');
    expect(fireEvents(events, 'player')[1].seconds).toBe(DAMAGE.fire.extinguishTime);
    expect(game.player.damage.extinguishers).toBe(DAMAGE.fire.extinguishers - 1);
    // 没着火时按灭火键什么都不发生
    game.extinguish();
    expect(fireEvents(run(game, 0.1), 'player')).toHaveLength(0);
  });

  it('灭火器用完:报「没有灭火器了」', () => {
    const game = tigers();
    game.player.damage.extinguishers = 0;
    game.player.damage.ignite('engine');
    const events = run(game, 0.2);
    game.extinguish();
    run(game, 0.1, events);
    expect(fireEvents(events, 'player').map((e) => e.state)).toContain('no-extinguisher');
  });

  it('敌方起火后在 aiReaction(6–10 秒)内自己灭火', () => {
    const game = tigers();
    const target = game.targets[0];
    target.damage.ignite('engine');
    const events = run(game, 12);
    const fe = fireEvents(events, target.id);
    expect(fe.map((e) => e.state)).toEqual(['start', 'extinguishing', 'extinguished']);
    const at = events.indexOf(fe[1]);
    expect(at).toBeGreaterThan(0);
    expect(target.damage.fire).toBeNull();
  });

  it('火把乘员烧到不够数:报一次「被摧毁」,原因是烧毁', () => {
    // 测试车:传动装置在车头,驾驶员和无线电员就在旁边
    const map = flatMap({ vehicleId: 'shooter', position: [0, 60], heading: 0 }, [{ vehicleId: 'shooter', position: [0, -60], heading: 90 }], 400);
    const game = new Game({ map, vehicles: TEST_VEHICLES, seed: 5, enemyAi: false });
    const d = game.targets[0].damage;
    // 只留驾驶员和炮手活着,再把火点在驾驶员旁边的传动装置上,并且不灭火
    for (const c of d.crew) {
      if (c.homeRole === 'driver' || c.homeRole === 'gunner') continue;
      c.hp = 0;
      c.alive = false;
    }
    d.extinguishers = 0;
    d.ignite('transmission');
    d.fire!.remaining = 1000;
    const events = run(game, 30);
    const destroyed = events.filter((e) => e.type === 'destroyed' && e.vehicleId === game.targets[0].id);
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0].type === 'destroyed' && destroyed[0].cause).toBe('fire');
    expect(game.state).toBe('victory');
  });

  it('起火的车冒火冒烟,扑灭后火苗消失;残骸冒一阵烟', () => {
    const game = tigers();
    game.player.damage.ignite('engine');
    run(game, 0.5);
    expect(game.effects.emitterCount).toBe(1);
    game.extinguish();
    run(game, DAMAGE.fire.extinguishTime + 0.2);
    expect(game.effects.emitterCount).toBe(0);
  });
});
