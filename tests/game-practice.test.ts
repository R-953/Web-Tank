import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, type GameEvent } from '../src/game/Game';
import { idleControls } from '../src/game/Vehicle';
import { TEST_VEHICLES, flatMap } from './fixtures';

const DT = 1 / 60;

beforeAll(async () => {
  await RAPIER.init();
});

/** 玩家在 (0, 30) 朝 -Z,侧面朝向的靶车在 (0, -20) */
function setup(practice: boolean) {
  const game = new Game({
    map: flatMap({ vehicleId: 'shooter', position: [0, 30], heading: 0 }, [{ vehicleId: 'target', position: [0, -20], heading: 90 }]),
    vehicles: TEST_VEHICLES,
    seed: 7,
    practice,
    enemyAi: practice ? false : undefined,
  });
  const events: GameEvent[] = [];
  const run = (seconds: number, fire = false) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      game.setPlayerControls({ ...idleControls(), aimPoint: game.targets[0].physicsPosition(), fire });
      game.fixedUpdate(DT);
      events.push(...game.drainEvents());
    }
  };
  run(1);
  return { game, events, run, target: game.targets[0] };
}

describe('试驾(practice)', () => {
  it('靶车被全部击毁也不判胜利,对局继续', () => {
    const { game, events, run, target } = setup(true);
    for (let i = 0; i < 30 && !target.isDead; i++) run(0.5, true);
    expect(target.isDead).toBe(true);
    run(3);
    expect(events.some((e) => e.type === 'victory')).toBe(false);
    expect(game.state).toBe('playing');
  });

  it('对照:不是试驾时同样的打法会判胜利', () => {
    const { game, run, target } = setup(false);
    for (let i = 0; i < 30 && !target.isDead; i++) run(0.5, true);
    run(0.5);
    expect(game.state).toBe('victory');
  });

  it('enemyAi: false 时靶车不还击:玩家站着挨一阵也没有受伤', () => {
    const { game, run } = setup(true);
    run(15);
    expect(game.player.damage.modules.every((m) => m.hp === m.maxHp)).toBe(true);
    expect(game.player.damage.crew.every((c) => c.alive && c.hp === 100)).toBe(true);
  });
});
