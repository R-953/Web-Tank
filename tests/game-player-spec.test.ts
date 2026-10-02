import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from '../src/game/Game';
import { TEST_VEHICLES, flatMap } from './fixtures';
import { applyModifications } from '../src/data/modifications';
import { applyPaint } from '../src/data/paints';
import { VEHICLES } from '../src/data/vehicles';
import type { VehicleSpec } from '../src/data/types';

beforeAll(async () => {
  await RAPIER.init();
});

/** 玩家和一辆靶车是同一型号 */
function sameModelGame(playerSpec?: VehicleSpec, crewSkill = 0) {
  return new Game({
    map: flatMap({ vehicleId: 'shooter', position: [0, 30], heading: 0 }, [{ vehicleId: 'shooter', position: [0, -60], heading: 0 }]),
    vehicles: TEST_VEHICLES,
    seed: 3,
    playerSpec,
    playerCrewSkill: crewSkill,
  });
}

describe('GameConfig.playerSpec(改装 / 涂装只作用在玩家这一辆)', () => {
  it('不传时玩家和靶车都用 vehicles 里的原始数据', () => {
    const game = sameModelGame();
    expect(game.player.spec).toBe(TEST_VEHICLES.shooter);
    expect(game.targets[0].spec).toBe(TEST_VEHICLES.shooter);
  });

  it('传了就只换玩家,同型号的靶车不受影响', () => {
    const base = TEST_VEHICLES.shooter;
    const tuned: VehicleSpec = { ...base, turretRotationSpeed: base.turretRotationSpeed * 1.5, color: 0x112233 };
    const game = sameModelGame(tuned);
    expect(game.player.spec.turretRotationSpeed).toBeCloseTo(base.turretRotationSpeed * 1.5);
    expect(game.player.spec.color).toBe(0x112233);
    expect(game.targets[0].spec).toBe(base);
  });

  it('id 对不上的 playerSpec 被忽略(防止拿错车的数据)', () => {
    const other: VehicleSpec = { ...TEST_VEHICLES.target, color: 0x445566 };
    const game = sameModelGame(other);
    expect(game.player.spec).toBe(TEST_VEHICLES.shooter);
  });

  it('玩家的改装和车组技能叠加:先改装,再按技能插值', () => {
    const base = TEST_VEHICLES.shooter;
    const tuned: VehicleSpec = { ...base, turretRotationSpeed: base.turretRotationSpeed * 2 };
    const novice = sameModelGame(tuned, 0);
    expect(novice.player.spec.turretRotationSpeed).toBeCloseTo(base.turretRotationSpeed * 2);
  });

  it('真实车型:套上改装和涂装后进游戏,数据和颜色都对', () => {
    const tiger = VEHICLES.tiger_i;
    const mods = ['firepower_horizontal_drive'];
    const spec = applyPaint(applyModifications(tiger, mods), 'winter_white');
    const game = new Game({
      map: flatMap({ vehicleId: tiger.id, position: [0, 30], heading: 0 }),
      vehicles: VEHICLES,
      seed: 5,
      playerVehicleId: tiger.id,
      playerSpec: spec,
    });
    expect(game.player.spec.turretRotationSpeed).toBeGreaterThan(tiger.turretRotationSpeed);
    expect(game.player.spec.color).not.toBe(tiger.color);
  });
});
