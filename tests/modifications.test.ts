import { describe, it, expect } from 'vitest';
import {
  modificationsFor,
  applyModifications,
  sanitizeModifications,
  toggleModification,
  MOBILITY_MODS,
  PROTECTION_MODS,
  FIREPOWER_TURRET_MODS,
  FIREPOWER_CASEMATE_MODS,
} from '../src/data/modifications';
import { TIGER_I, T34_85, SU_100, ISU_122, VEHICLES } from '../src/data/vehicles';
import type { VehicleSpec } from '../src/data/types';

describe('modifications: 数据完整性与出处规范', () => {
  it('每条改装的 source 都不为空，使用了估算的写清了方法', () => {
    const allMods = [
      ...MOBILITY_MODS,
      ...PROTECTION_MODS,
      ...FIREPOWER_TURRET_MODS,
      ...FIREPOWER_CASEMATE_MODS,
    ];

    for (const mod of allMods) {
      expect(mod.id).toBeTruthy();
      expect(mod.name).toBeTruthy();
      expect(mod.description).toBeTruthy();
      expect(typeof mod.source).toBe('string');
      expect(mod.source.trim().length).toBeGreaterThan(0);
      if (mod.source.includes('估算')) {
        expect(mod.source).toMatch(/估算:\s*.+/);
      }
    }
  });

  it('坦克歼击车 / 突击炮没有「炮塔方向机」(水平驱动)', () => {
    // 常规炮塔坦克有水平驱动
    const tigerMods = modificationsFor(TIGER_I);
    expect(tigerMods.some((m) => m.id === 'firepower_horizontal_drive')).toBe(true);
    expect(tigerMods.some((m) => m.effects.some((e) => e.kind === 'turretRotationSpeed'))).toBe(true);

    const t34Mods = modificationsFor(T34_85);
    expect(t34Mods.some((m) => m.id === 'firepower_horizontal_drive')).toBe(true);

    // 坦克歼击车(SU-100, ISU-122)没有炮塔方向机
    const su100Mods = modificationsFor(SU_100);
    expect(su100Mods.some((m) => m.id === 'firepower_horizontal_drive')).toBe(false);
    expect(su100Mods.some((m) => m.effects.some((e) => e.kind === 'turretRotationSpeed'))).toBe(false);

    const isu122Mods = modificationsFor(ISU_122);
    expect(isu122Mods.some((m) => m.id === 'firepower_horizontal_drive')).toBe(false);
    expect(isu122Mods.some((m) => m.effects.some((e) => e.kind === 'turretRotationSpeed'))).toBe(false);

    // 坦克歼击车的垂直驱动没有前置要求，可直接启用
    const su100Vert = su100Mods.find((m) => m.id === 'firepower_vertical_drive');
    expect(su100Vert).toBeDefined();
    expect(su100Vert?.requires).toBeUndefined();

    // 常规坦克的垂直驱动要求先启用水平驱动
    const tigerVert = tigerMods.find((m) => m.id === 'firepower_vertical_drive');
    expect(tigerVert).toBeDefined();
    expect(tigerVert?.requires).toEqual(['firepower_horizontal_drive']);
  });
});

describe('modifications: 每个效果的数值与同类相乘', () => {
  it('单个效果数值正确套用', () => {
    // 履带: turnRate 1.05
    const specWithTracks = applyModifications(TIGER_I, ['mobility_tracks']);
    expect(specWithTracks.hull.turnRate).toBeCloseTo(TIGER_I.hull.turnRate * 1.05);
    expect(specWithTracks.hull.acceleration).toBe(TIGER_I.hull.acceleration);
    expect(specWithTracks.maxSpeed).toBe(TIGER_I.maxSpeed);

    // 水平驱动: turretRotationSpeed 1.10
    const specWithHoriz = applyModifications(TIGER_I, ['firepower_horizontal_drive']);
    expect(specWithHoriz.turretRotationSpeed).toBeCloseTo(TIGER_I.turretRotationSpeed * 1.10);
    expect(specWithHoriz.turret.elevationSpeed).toBe(TIGER_I.turret.elevationSpeed);

    // 垂直驱动(常规车需水平驱动; 直接传有效前置)
    const specWithVert = applyModifications(TIGER_I, ['firepower_horizontal_drive', 'firepower_vertical_drive']);
    expect(specWithVert.turret.elevationSpeed).toBeCloseTo(TIGER_I.turret.elevationSpeed * 1.10);

    // 发动机最高 +5% 速度(需履带、悬挂、传动)
    const fullMobility = applyModifications(TIGER_I, [
      'mobility_tracks',
      'mobility_suspension',
      'mobility_transmission',
      'mobility_engine',
    ]);
    expect(fullMobility.maxSpeed).toBeCloseTo(TIGER_I.maxSpeed * 1.05);

    // 无效果改装(备件、灭火器、乘员补充、射击调整)不改变任何数值
    const specWithNoEffects = applyModifications(TIGER_I, [
      'protection_parts',
      'protection_fpe',
      'protection_crew',
      'firepower_adjustment',
    ]);
    expect(specWithNoEffects.hull.turnRate).toBe(TIGER_I.hull.turnRate);
    expect(specWithNoEffects.hull.acceleration).toBe(TIGER_I.hull.acceleration);
    expect(specWithNoEffects.maxSpeed).toBe(TIGER_I.maxSpeed);
    expect(specWithNoEffects.turretRotationSpeed).toBe(TIGER_I.turretRotationSpeed);
    expect(specWithNoEffects.turret.elevationSpeed).toBe(TIGER_I.turret.elevationSpeed);
  });

  it('同类效果相乘计算', () => {
    // 启用履带(1.05) + 悬挂(1.04) + 传动(1.04)
    // turnRate: 1.05 * 1.04 * 1.04 = 1.13568
    // acceleration: 1.04 (悬挂) * 1.05 (传动) = 1.092
    const spec3 = applyModifications(TIGER_I, [
      'mobility_tracks',
      'mobility_suspension',
      'mobility_transmission',
    ]);
    expect(spec3.hull.turnRate).toBeCloseTo(TIGER_I.hull.turnRate * 1.05 * 1.04 * 1.04);
    expect(spec3.hull.acceleration).toBeCloseTo(TIGER_I.hull.acceleration * 1.04 * 1.05);

    // 全部机动改装启用:
    // acceleration: 1.04 * 1.05 * 1.06 = 1.15752
    const spec4 = applyModifications(TIGER_I, [
      'mobility_tracks',
      'mobility_suspension',
      'mobility_transmission',
      'mobility_engine',
    ]);
    expect(spec4.hull.acceleration).toBeCloseTo(TIGER_I.hull.acceleration * 1.04 * 1.05 * 1.06);
    expect(spec4.hull.turnRate).toBeCloseTo(TIGER_I.hull.turnRate * 1.05 * 1.04 * 1.04);
    expect(spec4.maxSpeed).toBeCloseTo(TIGER_I.maxSpeed * 1.05);
  });

  it('同一栏全部启用后的总提升不超过 +25%', () => {
    // 检验所有已知载具全部改装启用时的总提升
    for (const veh of Object.values(VEHICLES)) {
      const allMods = modificationsFor(veh);
      const allIds = allMods.map((m) => m.id);
      const fullyUpgraded = applyModifications(veh, allIds);

      // 方向机提升不超过 +25%
      expect(fullyUpgraded.turretRotationSpeed).toBeLessThanOrEqual(veh.turretRotationSpeed * 1.25 + 1e-6);

      // 高低机提升不超过 +25%
      expect(fullyUpgraded.turret.elevationSpeed).toBeLessThanOrEqual(veh.turret.elevationSpeed * 1.25 + 1e-6);

      // 车体转向提升不超过 +25%
      expect(fullyUpgraded.hull.turnRate).toBeLessThanOrEqual(veh.hull.turnRate * 1.25 + 1e-6);

      // 起步加速度提升不超过 +25%
      expect(fullyUpgraded.hull.acceleration).toBeLessThanOrEqual(veh.hull.acceleration * 1.25 + 1e-6);

      // 最大速度提升不超过 +25%
      expect(fullyUpgraded.maxSpeed).toBeLessThanOrEqual(veh.maxSpeed * 1.25 + 1e-6);

      // 分栏检验: 机动栏全部启用
      const mobilityIds = allMods.filter((m) => m.branch === 'mobility').map((m) => m.id);
      const mobilityUpgraded = applyModifications(veh, mobilityIds);
      expect(mobilityUpgraded.hull.turnRate).toBeLessThanOrEqual(veh.hull.turnRate * 1.25 + 1e-6);
      expect(mobilityUpgraded.hull.acceleration).toBeLessThanOrEqual(veh.hull.acceleration * 1.25 + 1e-6);
      expect(mobilityUpgraded.maxSpeed).toBeLessThanOrEqual(veh.maxSpeed * 1.25 + 1e-6);

      // 分栏检验: 火力栏全部启用
      const firepowerIds = allMods.filter((m) => m.branch === 'firepower').map((m) => m.id);
      const firepowerUpgraded = applyModifications(veh, firepowerIds);
      expect(firepowerUpgraded.turretRotationSpeed).toBeLessThanOrEqual(veh.turretRotationSpeed * 1.25 + 1e-6);
      expect(firepowerUpgraded.turret.elevationSpeed).toBeLessThanOrEqual(veh.turret.elevationSpeed * 1.25 + 1e-6);
    }
  });
});

describe('modifications: 前置条件、连带关闭与整理', () => {
  it('sanitizeModifications: 去掉不属于该车的 id、缺前置的 id 并去重保持顺序', () => {
    // 缺前置: 只有悬挂而无履带，悬挂被去掉
    expect(sanitizeModifications(TIGER_I, ['mobility_suspension'])).toEqual([]);

    // 缺前置: 只有发动机而无悬挂传动，发动机被去掉
    expect(sanitizeModifications(TIGER_I, ['mobility_tracks', 'mobility_engine'])).toEqual(['mobility_tracks']);

    // 包含不属于该车的 id
    expect(
      sanitizeModifications(SU_100, [
        'firepower_horizontal_drive', // SU-100 没有水平方向机
        'mobility_tracks',
        'unknown_mod_123',
      ]),
    ).toEqual(['mobility_tracks']);

    // 去重并保持列表中的定义顺序
    const dirty = ['mobility_suspension', 'mobility_tracks', 'mobility_tracks', 'protection_parts'];
    expect(sanitizeModifications(TIGER_I, dirty)).toEqual([
      'mobility_tracks',
      'mobility_suspension',
      'protection_parts',
    ]);
  });

  it('toggleModification: 启用时要求前置已启用，否则原样返回', () => {
    // 空配置下启用悬挂(需履带)，失败原样返回
    const res1 = toggleModification(TIGER_I, [], 'mobility_suspension');
    expect(res1).toEqual([]);

    // 启用履带，成功
    const res2 = toggleModification(TIGER_I, [], 'mobility_tracks');
    expect(res2).toEqual(['mobility_tracks']);

    // 已有履带下启用悬挂，成功
    const res3 = toggleModification(TIGER_I, res2, 'mobility_suspension');
    expect(res3).toEqual(['mobility_tracks', 'mobility_suspension']);

    // 炮塔坦克: 空配置下启用垂直驱动(需水平驱动)，失败
    const resFire1 = toggleModification(TIGER_I, [], 'firepower_vertical_drive');
    expect(resFire1).toEqual([]);

    // 坦克歼击车: 垂直驱动无前置，可直接启用
    const resTd1 = toggleModification(SU_100, [], 'firepower_vertical_drive');
    expect(resTd1).toEqual(['firepower_vertical_drive']);
  });

  it('toggleModification: 关闭时连带关闭依赖它的高级改装', () => {
    const fullMobility = [
      'mobility_tracks',
      'mobility_suspension',
      'mobility_transmission',
      'mobility_engine',
    ];

    // 关闭悬挂，传动与发动机连带关闭，只剩履带
    const afterCloseSuspension = toggleModification(TIGER_I, fullMobility, 'mobility_suspension');
    expect(afterCloseSuspension).toEqual(['mobility_tracks']);

    // 关闭履带，所有机动改装全部关闭
    const afterCloseTracks = toggleModification(TIGER_I, fullMobility, 'mobility_tracks');
    expect(afterCloseTracks).toEqual([]);

    // 常规坦克关闭水平驱动，垂直驱动连带关闭
    const fullFirepower = ['firepower_horizontal_drive', 'firepower_vertical_drive'];
    const afterCloseHoriz = toggleModification(TIGER_I, fullFirepower, 'firepower_horizontal_drive');
    expect(afterCloseHoriz).toEqual([]);
  });
});

describe('modifications: 不改入参 (纯函数与不可变性)', () => {
  it('applyModifications 不改变原 VehicleSpec 对象及其子对象，也不改变 crewAce 等其他字段', () => {
    const originalClone: VehicleSpec = JSON.parse(JSON.stringify(TIGER_I));
    const enabled = ['mobility_tracks', 'mobility_suspension', 'firepower_horizontal_drive'];
    const enabledCopy = [...enabled];

    const result = applyModifications(TIGER_I, enabled);

    // 原入参未被修改
    expect(TIGER_I).toEqual(originalClone);
    expect(enabled).toEqual(enabledCopy);

    // 返回新对象
    expect(result).not.toBe(TIGER_I);
    expect(result.hull).not.toBe(TIGER_I.hull);
    expect(result.turret).not.toBe(TIGER_I.turret);

    // crewAce 等其他字段保持不变
    expect(result.crewAce).toEqual(TIGER_I.crewAce);
    expect(result.armor).toEqual(TIGER_I.armor);
    expect(result.weapons).toEqual(TIGER_I.weapons);
    expect(result.sight).toEqual(TIGER_I.sight);
    expect(result.internals).toEqual(TIGER_I.internals);
  });

  it('enabled 为空或没有生效效果时原样返回', () => {
    expect(applyModifications(TIGER_I, [])).toBe(TIGER_I);
    expect(applyModifications(TIGER_I, ['unknown_mod'])).toBe(TIGER_I);
    expect(applyModifications(TIGER_I, ['protection_parts'])).toBe(TIGER_I);
  });

  it('toggleModification 与 sanitizeModifications 不修改传入的 enabled 数组', () => {
    const list = Object.freeze(['mobility_tracks']);
    expect(() => toggleModification(TIGER_I, list, 'mobility_suspension')).not.toThrow();
    expect(() => sanitizeModifications(TIGER_I, list)).not.toThrow();
  });
});
