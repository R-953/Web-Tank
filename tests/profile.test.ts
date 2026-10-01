import { describe, it, expect } from 'vitest';
import {
  ProfileVehicle,
  ProfileStore,
  defaultProfile,
  proficiency,
  assignVehicle,
  selectCrew,
  addLineup,
  renameLineup,
  removeLineup,
  setActiveLineup,
  setActiveNation,
  activeVehicleId,
  advanceTime,
  sanitizeProfile,
} from '../src/settings/Profile';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

const mockVehicles: ProfileVehicle[] = [
  { id: 't_34_85', nation: 'ussr', family: 't34' },
  { id: 'su_100', nation: 'ussr', family: 'su100' },
  { id: 'isu_122', nation: 'ussr', family: 'isu' },
  { id: 'tiger_e', nation: 'germany', family: 'tiger_1' },
  { id: 'tiger_2', nation: 'germany', family: 'tiger_2' },
  { id: 'm4a3_76', nation: 'usa', family: 'm4a3' },
  { id: 'm4a3e8', nation: 'usa', family: 'm4a3' },
  { id: 'm4a3e2', nation: 'usa', family: 'm4a3' },
];

describe('defaultProfile: 默认存档', () => {
  it('生成默认存档: 车组数等于各车载具数，默认编组分配各车载具并已训练，进度为0', () => {
    const now = 1700000000000;
    const p = defaultProfile(mockVehicles, now);

    expect(p.version).toBe(1);
    expect(p.lastSeen).toBe(now);
    expect(p.activeNation).toBe('ussr');

    // 苏联: 3 辆车 -> 3 个车组
    const ussr = p.nations.ussr;
    expect(ussr.crews).toHaveLength(3);
    expect(ussr.crews[0]).toEqual({ progress: 0, trained: ['t_34_85'] });
    expect(ussr.crews[1]).toEqual({ progress: 0, trained: ['su_100'] });
    expect(ussr.crews[2]).toEqual({ progress: 0, trained: ['isu_122'] });

    expect(ussr.lineups).toHaveLength(1);
    expect(ussr.lineups[0].id).toBe('lineup-1');
    expect(ussr.lineups[0].name).toBe('编组 1');
    expect(ussr.lineups[0].slots).toEqual(['t_34_85', 'su_100', 'isu_122']);
    expect(ussr.lineups[0].selected).toBe(0);
    expect(ussr.activeLineup).toBe('lineup-1');

    // 德国: 2 辆车
    const ger = p.nations.germany;
    expect(ger.crews).toHaveLength(2);
    expect(ger.lineups[0].slots).toEqual(['tiger_e', 'tiger_2']);

    // 美国: 3 辆车
    const usa = p.nations.usa;
    expect(usa.crews).toHaveLength(3);
  });
});

describe('proficiency: 熟练度计算', () => {
  it('车组训练过同车族的任一载具返回 1，否则返回 0', () => {
    const crew = { progress: 0.5, trained: ['m4a3_76'] };
    // m4a3e8 与 m4a3_76 同属 m4a3 车族
    expect(proficiency(crew, 'm4a3e8', mockVehicles)).toBe(1);
    expect(proficiency(crew, 'm4a3e2', mockVehicles)).toBe(1);
    expect(proficiency(crew, 'm4a3_76', mockVehicles)).toBe(1);

    // su_100 是 su100 车族
    expect(proficiency(crew, 'su_100', mockVehicles)).toBe(0);
    // 未知载具
    expect(proficiency(crew, 'unknown_tank', mockVehicles)).toBe(0);
  });

  it('未训练过任何载具时返回 0', () => {
    const emptyCrew = { progress: 0, trained: [] };
    expect(proficiency(emptyCrew, 'm4a3_76', mockVehicles)).toBe(0);
  });
});

describe('assignVehicle: 载具分配与规则', () => {
  it('正常分配载具给车组，不可变更新原 Profile', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    // 把德国虎式E分配给德国编组1的第1格(原第1格是 tiger_2)
    const p1 = assignVehicle(p0, 'germany', 'lineup-1', 1, null, mockVehicles);
    expect(p1.nations.germany.lineups[0].slots).toEqual(['tiger_e', null]);
    // 原 p0 不受影响
    expect(p0.nations.germany.lineups[0].slots).toEqual(['tiger_e', 'tiger_2']);
  });

  it('载具必须属于该国家，否则报错', () => {
    const p = defaultProfile(mockVehicles, 1000);
    // 试图把苏联车分给德国
    expect(() => assignVehicle(p, 'germany', 'lineup-1', 0, 't_34_85', mockVehicles)).toThrow(
      '不属于国家',
    );
    // 载具不存在
    expect(() => assignVehicle(p, 'germany', 'lineup-1', 0, 'non_existent', mockVehicles)).toThrow(
      '载具不存在',
    );
  });

  it('同一编组里一辆车只能在一个格子: 已在别的格子时从那一格移走', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    // 德国原有: slot 0: tiger_e, slot 1: tiger_2
    // 把 tiger_e 分配到 slot 1
    const p1 = assignVehicle(p0, 'germany', 'lineup-1', 1, 'tiger_e', mockVehicles);
    expect(p1.nations.germany.lineups[0].slots).toEqual([null, 'tiger_e']);
  });

  it('车组熟练度为 0 时先训练(把 vehicleId 加入 trained)', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    // 苏联车组 0 只训练了 t_34_85
    expect(p0.nations.ussr.crews[0].trained).toEqual(['t_34_85']);
    // 把 su_100 分给苏联车组 0 (su_100 是 su100 车族，熟练度为 0)
    const p1 = assignVehicle(p0, 'ussr', 'lineup-1', 0, 'su_100', mockVehicles);
    expect(p1.nations.ussr.crews[0].trained).toContain('su_100');
    expect(proficiency(p1.nations.ussr.crews[0], 'su_100', mockVehicles)).toBe(1);
  });

  it('车组熟练度已经为 1 时(同车族)，不需要重复训练', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    // 美国车组 0 训练了 m4a3_76 (m4a3 车族)
    expect(p0.nations.usa.crews[0].trained).toEqual(['m4a3_76']);
    // 分配同车族的 m4a3e8
    const p1 = assignVehicle(p0, 'usa', 'lineup-1', 0, 'm4a3e8', mockVehicles);
    // 因为 proficiency 为 1，不需要加进 trained
    expect(p1.nations.usa.crews[0].trained).toEqual(['m4a3_76']);
    expect(proficiency(p1.nations.usa.crews[0], 'm4a3e8', mockVehicles)).toBe(1);
  });

  it('结果不能让编组变空: 最后一个载具被清空时抛出错误', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    // 德国先清空 slot 1
    const p1 = assignVehicle(p0, 'germany', 'lineup-1', 1, null, mockVehicles);
    expect(p1.nations.germany.lineups[0].slots).toEqual(['tiger_e', null]);
    // 再清空 slot 0，编组将全为空，应当抛错
    expect(() => assignVehicle(p1, 'germany', 'lineup-1', 0, null, mockVehicles)).toThrow('编组不能为空');
  });

  it('selected 指向的格子被清空时，改选第一个非空格子', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    // 苏联初始 selected: 0, slots: ['t_34_85', 'su_100', 'isu_122']
    // 清空 slot 0
    const p1 = assignVehicle(p0, 'ussr', 'lineup-1', 0, null, mockVehicles);
    expect(p1.nations.ussr.lineups[0].slots[0]).toBeNull();
    // selected 改选第一个非空: 1
    expect(p1.nations.ussr.lineups[0].selected).toBe(1);

    // 若车移走导致当前 selected 被清空，也会自动改选
    // 当前 selected 已经在 1 (su_100)，现在把 su_100 移到 slot 0
    const p2 = assignVehicle(p1, 'ussr', 'lineup-1', 0, 'su_100', mockVehicles);
    // slot 1 变成 null，slot 0 变成 su_100，原 selected(1)被清空，应改选第一个非空格子 0
    expect(p2.nations.ussr.lineups[0].selected).toBe(0);
  });

  it('异常参数抛出错误: 未知国家/未知编组/索引越界', () => {
    const p = defaultProfile(mockVehicles, 1000);
    expect(() => assignVehicle(p, 'japan', 'lineup-1', 0, null, mockVehicles)).toThrow('国家不存在');
    expect(() => assignVehicle(p, 'ussr', 'lineup-99', 0, null, mockVehicles)).toThrow('编组不存在');
    expect(() => assignVehicle(p, 'ussr', 'lineup-1', -1, null, mockVehicles)).toThrow('车组索引超出范围');
    expect(() => assignVehicle(p, 'ussr', 'lineup-1', 99, null, mockVehicles)).toThrow('车组索引超出范围');
  });
});

describe('selectCrew: 选择车组', () => {
  it('能选中非空格子，不可变更新', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    const p1 = selectCrew(p0, 'ussr', 'lineup-1', 2);
    expect(p1.nations.ussr.lineups[0].selected).toBe(2);
    expect(p0.nations.ussr.lineups[0].selected).toBe(0);
  });

  it('不能选中未分配载具的车组(空格子)', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    const p1 = assignVehicle(p0, 'ussr', 'lineup-1', 1, null, mockVehicles);
    expect(() => selectCrew(p1, 'ussr', 'lineup-1', 1)).toThrow('不能选中未分配载具的车组');
  });

  it('越界或不存在编组时抛错', () => {
    const p = defaultProfile(mockVehicles, 1000);
    expect(() => selectCrew(p, 'ussr', 'lineup-1', 10)).toThrow('车组索引超出范围');
    expect(() => selectCrew(p, 'ussr', 'lineup-9', 0)).toThrow('编组不存在');
  });
});

describe('编组管理: addLineup, renameLineup, removeLineup, setActiveLineup', () => {
  it('addLineup: 复制当前编组分配，名称默认「编组 N」或使用指定名称', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    const p1 = addLineup(p0, 'ussr');
    expect(p1.nations.ussr.lineups).toHaveLength(2);
    const newL = p1.nations.ussr.lineups[1];
    expect(newL.name).toBe('编组 2');
    expect(newL.slots).toEqual(p0.nations.ussr.lineups[0].slots);
    expect(newL.selected).toBe(p0.nations.ussr.lineups[0].selected);

    // 自定义名称
    const p2 = addLineup(p1, 'ussr', '重型编组');
    expect(p2.nations.ussr.lineups[2].name).toBe('重型编组');
  });

  it('renameLineup: 重命名编组，空名称抛错', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    const p1 = renameLineup(p0, 'ussr', 'lineup-1', '主力编组');
    expect(p1.nations.ussr.lineups[0].name).toBe('主力编组');

    expect(() => renameLineup(p1, 'ussr', 'lineup-1', '')).toThrow('编组名称不能为空');
    expect(() => renameLineup(p1, 'ussr', 'lineup-1', '   ')).toThrow('编组名称不能为空');
    expect(() => renameLineup(p1, 'ussr', 'invalid-id', '新名')).toThrow('编组不存在');
  });

  it('removeLineup: 最后一个编组不能删除', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    expect(() => removeLineup(p0, 'ussr', 'lineup-1')).toThrow('最后一个编组不能删除');
  });

  it('removeLineup: 删除后如果删除的是当前 activeLineup，自动切换到剩余编组', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    const p1 = addLineup(p0, 'ussr'); // lineups: [lineup-1, lineup-2]
    const p2 = setActiveLineup(p1, 'ussr', 'lineup-1');
    expect(p2.nations.ussr.activeLineup).toBe('lineup-1');

    const p3 = removeLineup(p2, 'ussr', 'lineup-1');
    expect(p3.nations.ussr.lineups).toHaveLength(1);
    expect(p3.nations.ussr.activeLineup).toBe('lineup-2');
  });

  it('setActiveLineup: 编组不存在时抛错', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    expect(() => setActiveLineup(p0, 'ussr', 'lineup-999')).toThrow('编组不存在');
  });
});

describe('setActiveNation 与 activeVehicleId', () => {
  it('setActiveNation: 切换国家，国家不存在时报错', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    expect(p0.activeNation).toBe('ussr');
    const p1 = setActiveNation(p0, 'germany');
    expect(p1.activeNation).toBe('germany');
    expect(() => setActiveNation(p1, 'france')).toThrow('国家不存在');
  });

  it('activeVehicleId: 返回当前国家 -> 当前编组 -> selected 格子的载具 ID', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    expect(activeVehicleId(p0)).toBe('t_34_85');

    const p1 = selectCrew(p0, 'ussr', 'lineup-1', 1);
    expect(activeVehicleId(p1)).toBe('su_100');

    const p2 = setActiveNation(p1, 'germany');
    expect(activeVehicleId(p2)).toBe('tiger_e');
  });
});

describe('advanceTime: 离线时间成长', () => {
  it('now > lastSeen 时每个车组调用 grow 函数，并更新 lastSeen', () => {
    const p0 = defaultProfile(mockVehicles, 1000);
    const fakeGrow = (f0: number, elapsed: number) => Math.min(0.99, f0 + elapsed * 0.001);
    const p1 = advanceTime(p0, 1500, fakeGrow);

    expect(p1.lastSeen).toBe(1500);
    // elapsed = 500, grow = 0 + 0.5 = 0.5
    expect(p1.nations.ussr.crews[0].progress).toBe(0.5);
    expect(p1.nations.germany.crews[0].progress).toBe(0.5);
    // 原 p0 不变
    expect(p0.lastSeen).toBe(1000);
    expect(p0.nations.ussr.crews[0].progress).toBe(0);
  });

  it('now <= lastSeen (负时间或零时间) 时只更新 lastSeen，不调用 grow', () => {
    const p0 = defaultProfile(mockVehicles, 2000);
    let called = false;
    const fakeGrow = (f0: number) => {
      called = true;
      return f0 + 0.1;
    };
    const p1 = advanceTime(p0, 1000, fakeGrow);
    expect(called).toBe(false);
    expect(p1.lastSeen).toBe(1000);
    expect(p1.nations.ussr.crews[0].progress).toBe(0);
  });
});

describe('sanitizeProfile: 坏数据清洗与防护', () => {
  it('输入 null / 非对象 / 救不回来的数据返回 defaultProfile', () => {
    const now = 2000;
    const def = defaultProfile(mockVehicles, now);
    expect(sanitizeProfile(null, mockVehicles, now)).toEqual(def);
    expect(sanitizeProfile('bad string', mockVehicles, now)).toEqual(def);
    expect(sanitizeProfile(12345, mockVehicles, now)).toEqual(def);
    expect(sanitizeProfile({ nations: null }, mockVehicles, now)).toEqual(def);
  });

  it('未知国家剔除，未知载具剔除，slots 长度对齐车组数', () => {
    const now = 2000;
    const raw = {
      version: 1,
      lastSeen: 1500,
      activeNation: 'moon_nation', // 未知国家
      nations: {
        moon_nation: { crews: [], lineups: [], activeLineup: '' },
        ussr: {
          crews: [
            { progress: 0.3, trained: ['t_34_85', 'alien_tank', 'tiger_e'] }, // alien_tank 未知，tiger_e 外国
            { progress: 1.5, trained: ['su_100'] }, // 进度越界
          ],
          lineups: [
            {
              id: 'l1',
              name: '我的编组',
              slots: ['t_34_85', 'alien_tank', 'tiger_e', 'extra_slot'], // 包含外国车与多余槽位
              selected: 1, // 指向非法车(alien_tank)
            },
          ],
          activeLineup: 'l1',
        },
      },
    };

    const clean = sanitizeProfile(raw, mockVehicles, now);
    expect(clean.activeNation).toBe('ussr');
    expect(clean.nations.moon_nation).toBeUndefined();

    const ussr = clean.nations.ussr;
    // 苏联有 3 辆车，车组数严格补齐到 3
    expect(ussr.crews).toHaveLength(3);
    // 车组 0 的 trained 剔除了 alien_tank 和 tiger_e
    expect(ussr.crews[0].trained).toEqual(['t_34_85']);
    expect(ussr.crews[0].progress).toBe(0.3);
    // 车组 1 的 progress clamp 到合法范围
    expect(ussr.crews[1].progress).toBeLessThan(1);
    // 缺失的车组 2 自动填充
    expect(ussr.crews[2].trained).toEqual(['isu_122']);

    // lineups: slots 长度严格对齐到 3，alien_tank 和 tiger_e 变 null，截掉多余
    expect(ussr.lineups[0].slots).toEqual(['t_34_85', null, null]);
    // 原 selected 指向 1 (null)，应修正为第一个非空格子 0
    expect(ussr.lineups[0].selected).toBe(0);
  });

  it('同一编组出现重复载具时去重，全空编组自动修正', () => {
    const now = 2000;
    const raw = {
      version: 1,
      lastSeen: 1500,
      activeNation: 'ussr',
      nations: {
        ussr: {
          crews: [{ progress: 0, trained: [] }],
          lineups: [
            {
              id: 'l1',
              name: '',
              // 重复载具 t_34_85
              slots: ['t_34_85', 't_34_85', 't_34_85'],
              selected: 0,
            },
            {
              id: 'empty_lineup',
              name: '空编组',
              slots: [null, null, null],
              selected: 0,
            },
          ],
          activeLineup: 'non_existent',
        },
      },
    };

    const clean = sanitizeProfile(raw, mockVehicles, now);
    const ussr = clean.nations.ussr;
    // 重复载具只保留第一个，后面变为 null
    expect(ussr.lineups[0].slots).toEqual(['t_34_85', null, null]);
    // 全空编组自动分配第一辆可用载具
    expect(ussr.lineups[1].slots[0]).toBe('t_34_85');
    // activeLineup 指向有效编组
    expect(ussr.activeLineup).toBe('l1');
  });
});

describe('ProfileStore: 本地持久化与存取往返', () => {
  it('能够正确保存与恢复 Profile', () => {
    const storage = new MemoryStorage();
    const store1 = new ProfileStore(mockVehicles, storage, () => 1000);
    const p = store1.get();
    expect(p.activeNation).toBe('ussr');

    // 修改后保存
    const pUpdated = setActiveNation(p, 'germany');
    store1.set(pUpdated);

    // 重新实例化读取
    const store2 = new ProfileStore(mockVehicles, storage, () => 2000);
    expect(store2.get().activeNation).toBe('germany');
  });

  it('读取损坏数据时优雅降级为 defaultProfile', () => {
    const storage = new MemoryStorage();
    storage.setItem('webtank.profile.v1', '{ broken json');
    const store = new ProfileStore(mockVehicles, storage, () => 1000);
    expect(store.get()).toEqual(defaultProfile(mockVehicles, 1000));
  });

  it('存储不可用时(如抛出异常或 storage=null)仅在内存中工作', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('access denied');
      },
      setItem: () => {
        throw new Error('access denied');
      },
    };
    const store = new ProfileStore(mockVehicles, brokenStorage, () => 1000);
    expect(store.get().activeNation).toBe('ussr');
    const updated = setActiveNation(store.get(), 'usa');
    expect(() => store.set(updated)).not.toThrow();
    expect(store.get().activeNation).toBe('usa');

    const nullStore = new ProfileStore(mockVehicles, null, () => 1000);
    expect(nullStore.get().activeNation).toBe('ussr');
  });
});
