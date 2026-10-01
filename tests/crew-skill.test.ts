import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { activeCrewSkill } from '../src/game/crew/skill';
import { Game } from '../src/game/Game';
import { VEHICLES } from '../src/data/vehicles';
import type { Profile, ProfileVehicle } from '../src/settings/Profile';
import { defaultProfile } from '../src/settings/Profile';
import { flatMap } from './fixtures';

const mockVehicles: ProfileVehicle[] = [
  { id: 'tiger_i', nation: 'germany', family: 'tiger' },
  { id: 'tiger_ii', nation: 'germany', family: 'tiger' },
  { id: 'panther', nation: 'germany', family: 'panther' },
  { id: 't34_85', nation: 'ussr', family: 't34' },
];

describe('activeCrewSkill', () => {
  it('正常情况: 车组 progress × 熟练度', () => {
    const profile: Profile = {
      version: 1,
      lastSeen: 1000,
      activeNation: 'germany',
      nations: {
        germany: {
          crews: [
            { progress: 0.6, trained: ['tiger_i'] },
          ],
          lineups: [
            {
              id: 'lineup-1',
              name: '编组 1',
              slots: ['tiger_i'],
              selected: 0,
            },
          ],
          activeLineup: 'lineup-1',
        },
      },
    };

    // 训练过 tiger_i，当前载具为 tiger_i，同车族熟练度为 1 → 0.6 × 1 = 0.6
    expect(activeCrewSkill(profile, mockVehicles)).toBeCloseTo(0.6, 6);

    // 同车族换车 tiger_ii，熟练度依然为 1
    profile.nations.germany.lineups[0].slots[0] = 'tiger_ii';
    expect(activeCrewSkill(profile, mockVehicles)).toBeCloseTo(0.6, 6);

    // progress 为 0.35 时
    profile.nations.germany.crews[0].progress = 0.35;
    expect(activeCrewSkill(profile, mockVehicles)).toBeCloseTo(0.35, 6);
  });

  it('熟练度为 0: 车组未训练过同车族载具时返回 0', () => {
    const profile: Profile = {
      version: 1,
      lastSeen: 1000,
      activeNation: 'germany',
      nations: {
        germany: {
          crews: [
            // 训练过黑豹(panther车族)，但出战虎式(tiger车族)
            { progress: 0.8, trained: ['panther'] },
          ],
          lineups: [
            {
              id: 'lineup-1',
              name: '编组 1',
              slots: ['tiger_i'],
              selected: 0,
            },
          ],
          activeLineup: 'lineup-1',
        },
      },
    };

    expect(activeCrewSkill(profile, mockVehicles)).toBe(0);

    // trained 为空时熟练度也是 0
    profile.nations.germany.crews[0].trained = [];
    expect(activeCrewSkill(profile, mockVehicles)).toBe(0);
  });

  it('defaultProfile 初始存档: progress 0 时返回 0', () => {
    const p = defaultProfile(mockVehicles, 1000);
    expect(activeCrewSkill(p, mockVehicles)).toBe(0);
  });

  it('存档里当前格子无效时返回 0', () => {
    // 1. 当前选中的格子未分配载具(null)
    const emptySlotProfile: Profile = {
      version: 1,
      lastSeen: 1000,
      activeNation: 'germany',
      nations: {
        germany: {
          crews: [{ progress: 0.7, trained: ['tiger_i'] }],
          lineups: [
            {
              id: 'lineup-1',
              name: '编组 1',
              slots: [null],
              selected: 0,
            },
          ],
          activeLineup: 'lineup-1',
        },
      },
    };
    expect(activeCrewSkill(emptySlotProfile, mockVehicles)).toBe(0);

    // 2. selected 超出范围
    const invalidSelectedProfile: Profile = {
      ...emptySlotProfile,
      nations: {
        germany: {
          ...emptySlotProfile.nations.germany,
          lineups: [
            {
              id: 'lineup-1',
              name: '编组 1',
              slots: ['tiger_i'],
              selected: 99,
            },
          ],
        },
      },
    };
    expect(activeCrewSkill(invalidSelectedProfile, mockVehicles)).toBe(0);

    // 3. selected 为负数
    invalidSelectedProfile.nations.germany.lineups[0].selected = -1;
    expect(activeCrewSkill(invalidSelectedProfile, mockVehicles)).toBe(0);

    // 4. activeNation 不在 nations 中
    const missingNationProfile: Profile = {
      ...emptySlotProfile,
      activeNation: 'usa',
    };
    expect(activeCrewSkill(missingNationProfile, mockVehicles)).toBe(0);

    // 5. activeLineup 不存在
    const missingLineupProfile: Profile = {
      ...emptySlotProfile,
      nations: {
        germany: {
          ...emptySlotProfile.nations.germany,
          activeLineup: 'non-existent',
        },
      },
    };
    expect(activeCrewSkill(missingLineupProfile, mockVehicles)).toBe(0);

    // 6. 载具在 vehicles 列表中找不到
    const unknownVehProfile: Profile = {
      ...emptySlotProfile,
      nations: {
        germany: {
          ...emptySlotProfile.nations.germany,
          lineups: [
            {
              id: 'lineup-1',
              name: '编组 1',
              slots: ['unknown_tank'],
              selected: 0,
            },
          ],
        },
      },
    };
    expect(activeCrewSkill(unknownVehProfile, mockVehicles)).toBe(0);
  });
});

describe('Game 中的车组技能应用', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const createTestMap = () =>
    flatMap(
      { vehicleId: 'tiger_i', position: [0, 0], heading: 0 },
      [{ vehicleId: 't34_85', position: [0, 50], heading: 180 }],
    );

  it('playerCrewSkill: 1 时玩家载具的主炮装填 = crewAce.reloadTime、方向机 = crewAce.turretRotationSpeed; 敌方载具不受影响', () => {
    const map = createTestMap();
    const game = new Game({
      map,
      vehicles: VEHICLES,
      playerCrewSkill: 1,
      vegetation: false,
      render: false,
    });

    const tigerAce = VEHICLES.tiger_i.crewAce!;
    expect(tigerAce).toBeDefined();

    // 玩家载具数值 = 王牌数值
    expect(game.player.spec.weapons[0].reloadTime).toBe(tigerAce.reloadTime);
    expect(game.player.spec.turretRotationSpeed).toBe(tigerAce.turretRotationSpeed);
    expect(game.player.spec.turret.elevationSpeed).toBe(tigerAce.elevationSpeed);
    expect(game.player.primaryWeapon?.reloadTime).toBe(tigerAce.reloadTime);

    // 敌方载具数值不变 (仍为 VEHICLES 中的基础新手数值)
    expect(game.targets).toHaveLength(1);
    const target = game.targets[0];
    expect(target.spec.weapons[0].reloadTime).toBe(VEHICLES.t34_85.weapons[0].reloadTime);
    expect(target.spec.turretRotationSpeed).toBe(VEHICLES.t34_85.turretRotationSpeed);
    expect(target.spec.turret.elevationSpeed).toBe(VEHICLES.t34_85.turret.elevationSpeed);
    expect(target.primaryWeapon?.reloadTime).toBe(VEHICLES.t34_85.weapons[0].reloadTime);
  });

  it('playerCrewSkill 缺省时和 VEHICLES 里的数值一样; 敌方载具不受影响', () => {
    const map = createTestMap();
    const game = new Game({
      map,
      vehicles: VEHICLES,
      vegetation: false,
      render: false,
    });

    // 玩家载具数值 = 缺省新手数值
    expect(game.player.spec.weapons[0].reloadTime).toBe(VEHICLES.tiger_i.weapons[0].reloadTime);
    expect(game.player.spec.turretRotationSpeed).toBe(VEHICLES.tiger_i.turretRotationSpeed);
    expect(game.player.spec.turret.elevationSpeed).toBe(VEHICLES.tiger_i.turret.elevationSpeed);
    expect(game.player.primaryWeapon?.reloadTime).toBe(VEHICLES.tiger_i.weapons[0].reloadTime);

    // 敌方载具数值不变
    const target = game.targets[0];
    expect(target.spec.weapons[0].reloadTime).toBe(VEHICLES.t34_85.weapons[0].reloadTime);
    expect(target.spec.turretRotationSpeed).toBe(VEHICLES.t34_85.turretRotationSpeed);
    expect(target.spec.turret.elevationSpeed).toBe(VEHICLES.t34_85.turret.elevationSpeed);
  });

  it('playerCrewSkill: 0 时为新手数值(与缺省一致)', () => {
    const map = createTestMap();
    const game = new Game({
      map,
      vehicles: VEHICLES,
      playerCrewSkill: 0,
      vegetation: false,
      render: false,
    });

    expect(game.player.spec.weapons[0].reloadTime).toBe(VEHICLES.tiger_i.weapons[0].reloadTime);
    expect(game.player.spec.turretRotationSpeed).toBe(VEHICLES.tiger_i.turretRotationSpeed);
    expect(game.player.spec.turret.elevationSpeed).toBe(VEHICLES.tiger_i.turret.elevationSpeed);
  });

  it('playerCrewSkill: 0.5 时在线性插值正中间; 敌方载具不受影响', () => {
    const map = createTestMap();
    const game = new Game({
      map,
      vehicles: VEHICLES,
      playerCrewSkill: 0.5,
      vegetation: false,
      render: false,
    });

    const tigerAce = VEHICLES.tiger_i.crewAce!;
    const tigerNovice = VEHICLES.tiger_i;

    const expectedReload = tigerNovice.weapons[0].reloadTime + (tigerAce.reloadTime - tigerNovice.weapons[0].reloadTime) * 0.5;
    const expectedRot = tigerNovice.turretRotationSpeed + (tigerAce.turretRotationSpeed - tigerNovice.turretRotationSpeed) * 0.5;
    const expectedElev = tigerNovice.turret.elevationSpeed + (tigerAce.elevationSpeed - tigerNovice.turret.elevationSpeed) * 0.5;

    expect(game.player.spec.weapons[0].reloadTime).toBeCloseTo(expectedReload, 6);
    expect(game.player.spec.turretRotationSpeed).toBeCloseTo(expectedRot, 6);
    expect(game.player.spec.turret.elevationSpeed).toBeCloseTo(expectedElev, 6);

    // 敌方载具仍不受影响
    const target = game.targets[0];
    expect(target.spec.weapons[0].reloadTime).toBe(VEHICLES.t34_85.weapons[0].reloadTime);
    expect(target.spec.turretRotationSpeed).toBe(VEHICLES.t34_85.turretRotationSpeed);
  });
});
