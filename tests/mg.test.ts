import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, type GameEvent } from '../src/game/Game';
import { idleControls, type VehicleControls } from '../src/game/Vehicle';
import { VEHICLES } from '../src/data/vehicles';
import { flatMap } from './fixtures';

const DT = 1 / 60;

beforeAll(async () => {
  await RAPIER.init();
});

/** 玩家虎式对着 distance 米外侧面朝向自己的虎式,按住机枪 */
function range(distance = 60) {
  const map = flatMap(
    { vehicleId: 'tiger_i', position: [0, distance / 2], heading: 0 },
    [{ vehicleId: 'tiger_i', position: [0, -distance / 2], heading: 90 }],
    400,
  );
  const game = new Game({ map, vehicles: VEHICLES, seed: 2, enemyAi: false });
  const events: GameEvent[] = [];
  const target = game.targets[0];
  const aim = (): VehicleControls => ({ ...idleControls(), aimPoint: target.physicsPosition().setY(target.physicsPosition().y + 0.3) });
  const run = (seconds: number, controls: () => VehicleControls) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      game.setPlayerControls(controls());
      game.fixedUpdate(DT);
      events.push(...game.drainEvents());
    }
  };
  const mgShots = () => events.filter((e) => e.type === 'fired' && e.shooterId === 'player' && e.weapon === 'mg').length;
  return { game, events, target, aim, run, mgShots };
}

describe('同轴机枪', () => {
  it('射速 ≈ 数据里的每分钟发数(MG 34:900 发/分 = 15 发/秒),口径 7.92 mm', () => {
    const { game, events, aim, run, mgShots } = range();
    run(3, aim);
    run(2, () => ({ ...aim(), fireMg: true }));
    expect(mgShots()).toBeGreaterThanOrEqual(29);
    expect(mgShots()).toBeLessThanOrEqual(31);
    const e = events.find((x) => x.type === 'fired' && x.weapon === 'mg');
    expect(e && e.type === 'fired' ? e.caliber : 0).toBeCloseTo(7.92, 2);
    expect(game.player.mg.inBelt).toBe(150 - mgShots());
  });

  it('打完一条 150 发的弹链要换弹链(约 5 秒),期间不能射击', () => {
    const { game, aim, run, mgShots } = range();
    run(3, aim);
    run(11, () => ({ ...aim(), fireMg: true }));
    expect(mgShots()).toBe(150);
    expect(game.player.mg.reloading).toBeGreaterThan(0);
    run(3, () => ({ ...aim(), fireMg: true }));
    expect(mgShots()).toBe(150);
    run(3, () => ({ ...aim(), fireMg: true }));
    expect(mgShots()).toBeGreaterThan(150);
    expect(game.player.mg.reserve).toBe(2550 - 300);
  });

  it('机枪打不坏虎式:长点射之后所有模块和乘员血量不变,没有命中回放,只有弹着事件', () => {
    const { target, events, aim, run } = range();
    const hp = () => [...target.damage.modules.map((m) => m.hp), ...target.damage.crew.map((c) => c.hp)];
    const before = hp();
    run(3, aim);
    run(8, () => ({ ...aim(), fireMg: true }));
    expect(hp()).toEqual(before);
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(0);
    const onTarget = events.filter((e) => e.type === 'impact' && e.targetId === target.id);
    expect(onTarget.length).toBeGreaterThan(50);
    expect(onTarget.every((e) => e.type === 'impact' && (e.kind === 'nonpen' || e.kind === 'ricochet'))).toBe(true);
  });

  it('主炮和机枪互不影响:按住机枪时主炮照常装填、开火', () => {
    const { events, aim, run } = range();
    run(3, aim);
    run(0.5, () => ({ ...aim(), fireMg: true, fire: true }));
    expect(events.filter((e) => e.type === 'fired' && e.weapon === 'main')).toHaveLength(1);
    run(1, aim);
    expect(events.filter((e) => e.type === 'hit' && e.shooterId === 'player')).toHaveLength(1);
  });
});
