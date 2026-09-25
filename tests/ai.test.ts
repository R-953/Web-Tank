import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, type GameEvent } from '../src/game/Game';
import { idleControls } from '../src/game/Vehicle';
import type { ObstacleSpec } from '../src/data/types';
import { SHOOTER, TEST_VEHICLES, flatMap } from './fixtures';

const DT = 1 / 60;

beforeAll(async () => {
  await RAPIER.init();
});

/** 玩家(测试射手)在南边朝北,敌方射手在北边 distance 米处,侧面朝向玩家 */
function duel(distance: number, obstacles: ObstacleSpec[] = [], seed = 3, playerLoadout: Record<string, number> = { aphe: 60 }) {
  const vehicles = { ...TEST_VEHICLES, enemy: { ...SHOOTER, id: 'enemy', name: '敌方射手' } };
  const map = flatMap(
    { vehicleId: 'shooter', position: [0, distance / 2], heading: 0 },
    [{ vehicleId: 'enemy', position: [0, -distance / 2], heading: 90, ammoFraction: 1 }],
    distance + 400,
  );
  map.obstacles = obstacles;
  const game = new Game({ map, vehicles, seed, playerLoadout });
  const events: GameEvent[] = [];
  const run = (seconds: number, controls = idleControls(), until?: () => boolean) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      game.setPlayerControls(controls);
      game.fixedUpdate(DT);
      events.push(...game.drainEvents());
      if (until?.()) break;
    }
  };
  const enemyFired = () => events.filter((e) => e.type === 'fired' && e.shooterId === game.targets[0].id).length;
  return { game, events, run, enemyFired };
}

describe('敌方还击 AI', () => {
  it('300 m 内有视线:几秒内开火、命中玩家,最终把玩家打到失去战斗力(判负)', () => {
    const { game, events, run, enemyFired } = duel(300);
    run(8);
    expect(enemyFired()).toBeGreaterThan(0);
    run(120, idleControls(), () => game.state !== 'playing');
    expect(events.some((e) => e.type === 'hit' && e.targetId === 'player')).toBe(true);
    expect(game.state).toBe('defeat');
    expect(events.some((e) => e.type === 'defeat')).toBe(true);
  });

  it('先瞄准 2–3 秒才开第一炮', () => {
    const { run, enemyFired } = duel(300);
    run(1.9);
    expect(enemyFired()).toBe(0);
    run(4);
    expect(enemyFired()).toBeGreaterThan(0);
  });

  it('视线被障碍物挡住时不开火', () => {
    const wall: ObstacleSpec = { position: [0, 0], size: [40, 12, 4], rotationY: 0 };
    const { run, enemyFired } = duel(300, [wall]);
    run(15);
    expect(enemyFired()).toBe(0);
  });

  it('1 km 外(超出发现距离)不主动开火;被玩家打中后才还击', () => {
    // 玩家只带高爆弹:打不穿,但能惊动它
    const { game, run, enemyFired } = duel(1000, [], 3, { he: 20 });
    run(10);
    expect(enemyFired()).toBe(0);
    expect(game.isAlerted(game.targets[0])).toBe(false);
    // 玩家瞄准敌车车体、表尺设 1000 m 开一炮(高爆弹)
    const aim = game.targets[0].physicsPosition();
    run(4, { ...idleControls(), aimPoint: aim, sightRange: 1000 });
    run(0.1, { ...idleControls(), aimPoint: aim, sightRange: 1000, fire: true });
    run(3, { ...idleControls(), aimPoint: aim, sightRange: 1000 });
    expect(game.targets[0].isDead).toBe(false);
    expect(game.isAlerted(game.targets[0])).toBe(true);
    run(8, { ...idleControls(), aimPoint: aim, sightRange: 1000 });
    expect(enemyFired()).toBeGreaterThan(0);
  });

  it('敌方估距有误差但会越打越准:300 m 连续射击的命中率不低于一半', () => {
    const { game, events, run } = duel(300, [], 11);
    run(60, idleControls(), () => game.state !== 'playing');
    const fired = events.filter((e) => e.type === 'fired' && e.shooterId !== 'player').length;
    const hits = events.filter((e) => e.type === 'hit' && e.targetId === 'player').length;
    expect(fired).toBeGreaterThan(0);
    expect(hits / fired).toBeGreaterThanOrEqual(0.5);
    // 敌车一直在原地
    expect(game.targets[0].physicsPosition().distanceTo(new THREE.Vector3(0, game.targets[0].physicsPosition().y, -150))).toBeLessThan(1);
  });
});
