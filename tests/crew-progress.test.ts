import { describe, it, expect } from 'vitest';
import type { VehicleSpec } from '../src/data/types';
import {
  CREW_HALF_TIME_MS,
  CREW_MAX_LEVEL,
  progressAfter,
  crewLevel,
  applyCrewSkill,
  type AceValues,
} from '../src/game/crew/progress';

describe('车组成长曲线与等级', () => {
  it('常数定义正确:半衰期为 14 天,满级等级为 100', () => {
    expect(CREW_HALF_TIME_MS).toBe(14 * 24 * 60 * 60 * 1000);
    expect(CREW_MAX_LEVEL).toBe(100);
  });

  it('负责人的规则:从 0 开始,2 周 → 50%,6 周 → 75%,14 周 → 87.5%(误差 < 1e-9)', () => {
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
    const sixWeeksMs = 42 * 24 * 60 * 60 * 1000;
    const fourteenWeeksMs = 98 * 24 * 60 * 60 * 1000;

    const f2w = progressAfter(0, twoWeeksMs);
    const f6w = progressAfter(0, sixWeeksMs);
    const f14w = progressAfter(0, fourteenWeeksMs);

    expect(Math.abs(f2w - 0.5)).toBeLessThan(1e-9);
    expect(Math.abs(f6w - 0.75)).toBeLessThan(1e-9);
    expect(Math.abs(f14w - 0.875)).toBeLessThan(1e-9);
  });

  it('支持自定义 halfTimeMs', () => {
    expect(progressAfter(0, 1000, 1000)).toBeCloseTo(0.5, 9);
    expect(progressAfter(0, 3000, 1000)).toBeCloseTo(0.75, 9);
  });

  it('分段补算等于一次补算:progressAfter(progressAfter(0, a), b) ≈ progressAfter(0, a + b)', () => {
    const testCases: [number, number][] = [
      [14 * 24 * 60 * 60 * 1000, 28 * 24 * 60 * 60 * 1000],
      [1000 * 3600, 5000 * 3600],
      [1234567, 9876543],
      [500, 80000000],
    ];

    for (const [a, b] of testCases) {
      const stepByStep = progressAfter(progressAfter(0, a), b);
      const once = progressAfter(0, a + b);
      expect(Math.abs(stepByStep - once)).toBeLessThan(1e-9);
    }

    // 连续多次小步挂机 vs 一次挂机
    const dayMs = 24 * 60 * 60 * 1000;
    let accumulated = 0;
    for (let i = 0; i < 7; i++) {
      accumulated = progressAfter(accumulated, dayMs);
    }
    const oneWeek = progressAfter(0, 7 * dayMs);
    expect(Math.abs(accumulated - oneWeek)).toBeLessThan(1e-9);
  });

  it('负时间、0 时间原样返回;f0 超出范围被夹住;永远 < 1', () => {
    // 0 时间原样返回
    expect(progressAfter(0, 0)).toBe(0);
    expect(progressAfter(0.42, 0)).toBe(0.42);

    // 负时间原样返回
    expect(progressAfter(0.65, -1000)).toBe(0.65);
    expect(progressAfter(0.5, -24 * 60 * 60 * 1000)).toBe(0.5);

    // f0 超出范围被夹住:负数夹到 0
    expect(progressAfter(-0.2, 1000)).toBe(progressAfter(0, 1000));
    expect(progressAfter(-0.5, 0)).toBe(0);
    expect(progressAfter(-0.5, -100)).toBe(0);

    // f0 超出范围被夹住:≥ 1 夹到 [0, 1)
    expect(progressAfter(1.5, 1000)).toBeLessThan(1);
    expect(progressAfter(1.0, 0)).toBeLessThan(1);

    // 永远 < 1
    expect(progressAfter(0, 1e12)).toBeLessThan(1);
    expect(progressAfter(0, 1e20)).toBeLessThan(1);
    expect(progressAfter(0.999999, 1e15)).toBeLessThan(1);
    expect(progressAfter(0, Number.MAX_SAFE_INTEGER)).toBeLessThan(1);
  });

  it('crewLevel:0 → 0,0.5 → 50,0.999 → 99', () => {
    expect(crewLevel(0)).toBe(0);
    expect(crewLevel(0.5)).toBe(50);
    expect(crewLevel(0.999)).toBe(99);

    // 边界与过渡检查
    expect(crewLevel(0.009)).toBe(0);
    expect(crewLevel(0.01)).toBe(1);
    expect(crewLevel(0.75)).toBe(75);
    expect(crewLevel(0.875)).toBe(87);
    expect(crewLevel(-0.1)).toBe(0);
  });
});

describe('车组技能线性插值 applyCrewSkill', () => {
  const sampleSpec: VehicleSpec = {
    id: 'test_tank',
    name: '测试坦克',
    armor: { front: 100, side: 50, rear: 40 },
    turretArmor: { front: 100, side: 50, rear: 40 },
    maxSpeed: 40,
    turretRotationSpeed: 20,
    weapons: [
      {
        id: 'main_gun',
        name: '主炮',
        reloadTime: 8.0,
        ammo: [],
        kind: 'cannon',
      },
      {
        id: 'coax_mg',
        name: '同轴机枪',
        reloadTime: 6.0,
        ammo: [],
        kind: 'mg',
      },
      {
        id: 'default_gun',
        name: '未填 kind 的火炮(缺省主炮)',
        reloadTime: 10.0,
        ammo: [],
      },
    ],
    hull: { length: 6, width: 3, height: 2, turnRate: 30, acceleration: 2 },
    turret: {
      length: 2,
      width: 2,
      height: 1,
      barrelLength: 3,
      elevation: [-10, 20],
      elevationSpeed: 4.0,
    },
    sight: { magnifications: [3, 6], reticle: 'german' },
    internals: { modules: [], crew: [] },
    color: 0x445566,
  };

  const ace: AceValues = {
    reloadTime: 5.0, // 主炮从 8.0 降到 5.0
    turretRotationSpeed: 30, // 方向机从 20 提升到 30
    elevationSpeed: 8.0, // 高低机从 4.0 提升到 8.0
  };

  it('skill = 0 时保持新手初始值', () => {
    const res = applyCrewSkill(sampleSpec, ace, 0);
    expect(res.turretRotationSpeed).toBe(20);
    expect(res.turret.elevationSpeed).toBe(4.0);
    expect(res.weapons[0].reloadTime).toBe(8.0);
    expect(res.weapons[1].reloadTime).toBe(6.0); // 机枪不变
    expect(res.weapons[2].reloadTime).toBe(10.0);
  });

  it('skill = 0.5 时线性插值到新手与王牌中点', () => {
    const res = applyCrewSkill(sampleSpec, ace, 0.5);
    // turretRotationSpeed: 20 + (30 - 20) * 0.5 = 25
    expect(res.turretRotationSpeed).toBeCloseTo(25, 9);
    // elevationSpeed: 4.0 + (8.0 - 4.0) * 0.5 = 6.0
    expect(res.turret.elevationSpeed).toBeCloseTo(6.0, 9);
    // 主炮 reloadTime: 8.0 + (5.0 - 8.0) * 0.5 = 6.5
    expect(res.weapons[0].reloadTime).toBeCloseTo(6.5, 9);
    // 机枪 reloadTime 保持不变
    expect(res.weapons[1].reloadTime).toBe(6.0);
    // 缺省主炮 reloadTime: 10.0 + (5.0 - 10.0) * 0.5 = 7.5
    expect(res.weapons[2].reloadTime).toBeCloseTo(7.5, 9);
  });

  it('skill = 1 时达到王牌满级数值', () => {
    const res = applyCrewSkill(sampleSpec, ace, 1);
    expect(res.turretRotationSpeed).toBe(30);
    expect(res.turret.elevationSpeed).toBe(8.0);
    expect(res.weapons[0].reloadTime).toBe(5.0);
    expect(res.weapons[1].reloadTime).toBe(6.0); // 机枪不变
    expect(res.weapons[2].reloadTime).toBe(5.0);
  });

  it('skill 超出范围被夹到 [0, 1]', () => {
    const under = applyCrewSkill(sampleSpec, ace, -0.5);
    expect(under.turretRotationSpeed).toBe(20);
    expect(under.weapons[0].reloadTime).toBe(8.0);

    const over = applyCrewSkill(sampleSpec, ace, 1.8);
    expect(over.turretRotationSpeed).toBe(30);
    expect(over.weapons[0].reloadTime).toBe(5.0);
  });

  it('机枪始终保持不变', () => {
    for (const s of [-0.2, 0, 0.25, 0.5, 0.75, 1, 1.5]) {
      const res = applyCrewSkill(sampleSpec, ace, s);
      expect(res.weapons[1].reloadTime).toBe(6.0);
    }
  });

  it('不改动输入参数 (immutability)', () => {
    const specCopy = JSON.parse(JSON.stringify(sampleSpec));
    const aceCopy = JSON.parse(JSON.stringify(ace));

    const res = applyCrewSkill(sampleSpec, ace, 0.5);

    expect(sampleSpec).toEqual(specCopy);
    expect(ace).toEqual(aceCopy);
    expect(res).not.toBe(sampleSpec);
    expect(res.weapons).not.toBe(sampleSpec.weapons);
    expect(res.turret).not.toBe(sampleSpec.turret);
  });

  it('ace 为 undefined 时原样返回', () => {
    const res = applyCrewSkill(sampleSpec, undefined, 0.5);
    expect(res).toEqual(sampleSpec);
  });
});
