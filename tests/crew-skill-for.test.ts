import { describe, expect, it } from 'vitest';
import { crewSkillFor } from '../src/game/crew/skill';
import type { Profile, ProfileVehicle } from '../src/settings/Profile';

const mockVehicles: ProfileVehicle[] = [
  { id: 'tiger_i', nation: 'germany', family: 'tiger' },
  { id: 'tiger_ii', nation: 'germany', family: 'tiger' },
  { id: 'panther', nation: 'germany', family: 'panther' },
  { id: 't34_85', nation: 'ussr', family: 't34' },
];

describe('crewSkillFor 纯函数', () => {
  it('同车族保留熟练度: 训练过同车族载具时熟练度为 1, 技能 = progress × 1', () => {
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

    // 开 tiger_i: 训练过, 同车族 -> progress × 1 = 0.6
    expect(crewSkillFor(profile, mockVehicles, 'germany', 0, 'tiger_i')).toBeCloseTo(0.6, 6);

    // 同车族换开 tiger_ii: 未直接训练过 tiger_ii, 但同属 tiger 车族 -> 熟练度保留为 1, 返回 0.6
    expect(crewSkillFor(profile, mockVehicles, 'germany', 0, 'tiger_ii')).toBeCloseTo(0.6, 6);
  });

  it('换车族要训练: 未训练过同车族载具时熟练度为 0, 技能返回 0', () => {
    const profile: Profile = {
      version: 1,
      lastSeen: 1000,
      activeNation: 'germany',
      nations: {
        germany: {
          crews: [
            // 只训练过 tiger_i (tiger 车族)
            { progress: 0.8, trained: ['tiger_i'] },
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

    // 换开黑豹 panther (panther 车族), 未训练过该车族 -> 熟练度为 0, 技能返回 0
    expect(crewSkillFor(profile, mockVehicles, 'germany', 0, 'panther')).toBe(0);

    // 训练过 panther 之后 -> 熟练度为 1, 技能返回 0.8
    profile.nations.germany.crews[0].trained.push('panther');
    expect(crewSkillFor(profile, mockVehicles, 'germany', 0, 'panther')).toBeCloseTo(0.8, 6);
  });

  it('车组不存在或参数非法时返回 0', () => {
    const profile: Profile = {
      version: 1,
      lastSeen: 1000,
      activeNation: 'germany',
      nations: {
        germany: {
          crews: [
            { progress: 0.75, trained: ['tiger_i'] },
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

    // 1. crewIndex 超出范围
    expect(crewSkillFor(profile, mockVehicles, 'germany', 1, 'tiger_i')).toBe(0);
    expect(crewSkillFor(profile, mockVehicles, 'germany', 99, 'tiger_i')).toBe(0);

    // 2. crewIndex 为负数
    expect(crewSkillFor(profile, mockVehicles, 'germany', -1, 'tiger_i')).toBe(0);

    // 3. 国家不存在
    expect(crewSkillFor(profile, mockVehicles, 'ussr', 0, 't34_85')).toBe(0);
    expect(crewSkillFor(profile, mockVehicles, 'usa', 0, 'm4a3')).toBe(0);

    // 4. vehicleId 为空
    expect(crewSkillFor(profile, mockVehicles, 'germany', 0, '')).toBe(0);

    // 5. 载具在 mockVehicles 中不存在
    expect(crewSkillFor(profile, mockVehicles, 'germany', 0, 'unknown_tank')).toBe(0);

    // 6. profile 为空或无效
    expect(crewSkillFor(null as unknown as Profile, mockVehicles, 'germany', 0, 'tiger_i')).toBe(0);
  });

  it('progress 夹在 [0, 1] 之间', () => {
    const profile: Profile = {
      version: 1,
      lastSeen: 1000,
      activeNation: 'germany',
      nations: {
        germany: {
          crews: [
            { progress: 0, trained: ['tiger_i'] },
            { progress: 1.5, trained: ['tiger_i'] },
            { progress: -0.2, trained: ['tiger_i'] },
          ],
          lineups: [
            {
              id: 'lineup-1',
              name: '编组 1',
              slots: ['tiger_i', 'tiger_i', 'tiger_i'],
              selected: 0,
            },
          ],
          activeLineup: 'lineup-1',
        },
      },
    };

    expect(crewSkillFor(profile, mockVehicles, 'germany', 0, 'tiger_i')).toBe(0);
    expect(crewSkillFor(profile, mockVehicles, 'germany', 1, 'tiger_i')).toBe(1);
    expect(crewSkillFor(profile, mockVehicles, 'germany', 2, 'tiger_i')).toBe(0);
  });
});
