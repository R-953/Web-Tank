import { describe, expect, it } from 'vitest';
import type { VehicleSpec } from '../src/data/types';
import { VEHICLES } from '../src/data/vehicles';
import { vehicleCardData } from '../src/ui/menu/VehicleCard';

describe('载具新增基础属性数据层校验 (任务 064)', () => {
  const expectedVehicleIds = [
    'tiger_i',
    't34_85',
    'tiger_ii',
    'su_100',
    'isu_122',
    'm4a3_76w',
    'm4a3e8',
    'm4a3e2',
  ];

  it('8 辆核心载具均已配置且包含新增字段', () => {
    for (const id of expectedVehicleIds) {
      const spec = VEHICLES[id];
      expect(spec, `载具 ${id} 应当存在于 VEHICLES 中`).toBeDefined();
      expect(spec.mass, `载具 ${id} 的 mass 应当已定义`).toBeDefined();
      expect(spec.enginePower, `载具 ${id} 的 enginePower 应当已定义`).toBeDefined();
      expect(spec.reverseSpeed, `载具 ${id} 的 reverseSpeed 应当已定义`).toBeDefined();
    }
  });

  it('所有载具战斗全重 mass > 0, 发动机功率与转速为正, 倒车速度 > 0 且 <= 前进速度', () => {
    for (const id of expectedVehicleIds) {
      const spec = VEHICLES[id];
      expect(spec.mass).toBeGreaterThan(0);
      expect(spec.enginePower?.hp).toBeGreaterThan(0);
      expect(spec.enginePower?.rpm).toBeGreaterThan(0);
      expect(spec.reverseSpeed).toBeGreaterThan(0);
      expect(spec.reverseSpeed!).toBeLessThanOrEqual(spec.maxSpeed);
    }
  });

  it('各载具数据值符合出处与设定', () => {
    // 虎式 Ausf. E: 57.0 t, 700 hp @ 3000 rpm, 倒车 6 km/h (Wikipedia 2500 rpm 限速)
    const tiger = VEHICLES.tiger_i;
    expect(tiger.mass).toBe(57000);
    expect(tiger.enginePower).toEqual({ hp: 700, rpm: 3000 });
    expect(tiger.reverseSpeed).toBe(6);

    // T-34-85: 32.2 t, 500 hp @ 1800 rpm, 倒车 9 km/h (War Thunder 值)
    const t34 = VEHICLES.t34_85;
    expect(t34.mass).toBe(32200);
    expect(t34.enginePower).toEqual({ hp: 500, rpm: 1800 });
    expect(t34.reverseSpeed).toBe(9);

    // 虎王: 69.8 t, 700 hp @ 3000 rpm, 倒车 11 km/h (War Thunder 值)
    const tiger2 = VEHICLES.tiger_ii;
    expect(tiger2.mass).toBe(69800);
    expect(tiger2.enginePower).toEqual({ hp: 700, rpm: 3000 });
    expect(tiger2.reverseSpeed).toBe(11);

    // SU-100: 31.6 t, 500 hp @ 1800 rpm, 倒车 9 km/h (War Thunder 值)
    const su100 = VEHICLES.su_100;
    expect(su100.mass).toBe(31600);
    expect(su100.enginePower).toEqual({ hp: 500, rpm: 1800 });
    expect(su100.reverseSpeed).toBe(9);

    // ISU-122: 45.5 t, 520 hp @ 2000 rpm, 倒车 14 km/h (War Thunder 值)
    const isu122 = VEHICLES.isu_122;
    expect(isu122.mass).toBe(45500);
    expect(isu122.enginePower).toEqual({ hp: 520, rpm: 2000 });
    expect(isu122.reverseSpeed).toBe(14);

    // M4A3(76)W: 32.3 t, 500 hp @ 2600 rpm, 倒车 5 km/h (Hunnicutt 1994 / War Thunder 值)
    const m4a3 = VEHICLES.m4a3_76w;
    expect(m4a3.mass).toBe(32300);
    expect(m4a3.enginePower).toEqual({ hp: 500, rpm: 2600 });
    expect(m4a3.reverseSpeed).toBe(5);

    // M4A3E8: 33.7 t, 500 hp @ 2600 rpm, 倒车 5 km/h
    const m4a3e8 = VEHICLES.m4a3e8;
    expect(m4a3e8.mass).toBe(33700);
    expect(m4a3e8.enginePower).toEqual({ hp: 500, rpm: 2600 });
    expect(m4a3e8.reverseSpeed).toBe(5);

    // M4A3E2: 38.0 t, 500 hp @ 2600 rpm, 倒车 4 km/h (修改最终传动比)
    const m4a3e2 = VEHICLES.m4a3e2;
    expect(m4a3e2.mass).toBe(38000);
    expect(m4a3e2.enginePower).toEqual({ hp: 500, rpm: 2600 });
    expect(m4a3e2.reverseSpeed).toBe(4);
  });
});

describe('vehicleCardData 信息卡展示逻辑 (任务 064)', () => {
  it('字段齐全时, 机动节正确显示质量、发动机功率、前进/倒车速度', () => {
    const card = vehicleCardData(VEHICLES.tiger_i, 0);
    const mobSec = card.sections.find((s) => s.title === '机动');
    expect(mobSec).toBeDefined();

    const massRow = mobSec?.rows.find((r) => r.label === '质量');
    expect(massRow?.value).toBe('57.0 t');

    const powerRow = mobSec?.rows.find((r) => r.label === '发动机功率');
    expect(powerRow?.value).toBe('700 hp @ 3000 rpm');

    const speedRow = mobSec?.rows.find((r) => r.label === '最大速度');
    expect(speedRow?.value).toBe('38 / 6 km/h');
  });

  it('同轴机枪存在且带 rounds 时显示「同轴机枪弹药 n 发」', () => {
    const tigerCard = vehicleCardData(VEHICLES.tiger_i, 0);
    const fireSec = tigerCard.sections.find((s) => s.title === '火力');
    expect(fireSec).toBeDefined();

    const mgRow = fireSec?.rows.find((r) => r.label === '同轴机枪');
    expect(mgRow).toBeDefined();

    const ammoRow = fireSec?.rows.find((r) => r.label === '同轴机枪弹药');
    expect(ammoRow).toBeDefined();
    expect(ammoRow?.value).toBe('2550 发');
  });

  it('无同轴机枪的固定战斗室车辆不显示同轴机枪弹药行', () => {
    // SU-100 没有机枪
    const suCard = vehicleCardData(VEHICLES.su_100, 0);
    const fireSec = suCard.sections.find((s) => s.title === '火力');
    expect(fireSec).toBeDefined();
    expect(fireSec?.rows.find((r) => r.label === '同轴机枪')).toBeUndefined();
    expect(fireSec?.rows.find((r) => r.label === '同轴机枪弹药')).toBeUndefined();

    // ISU-122 没有机枪
    const isuCard = vehicleCardData(VEHICLES.isu_122, 0);
    const isuFire = isuCard.sections.find((s) => s.title === '火力');
    expect(isuFire).toBeDefined();
    expect(isuFire?.rows.find((r) => r.label === '同轴机枪')).toBeUndefined();
    expect(isuFire?.rows.find((r) => r.label === '同轴机枪弹药')).toBeUndefined();
  });

  it('字段缺失测试: 缺 mass / enginePower / reverseSpeed / mg 时不显示对应行, 且最大速度仅显示前进速度', () => {
    const minimalSpec: VehicleSpec = {
      id: 'test_minimal',
      name: '极简测试车',
      armor: { front: 50, side: 30, rear: 20 },
      turretArmor: { front: 40, side: 30, rear: 20 },
      maxSpeed: 45,
      turretRotationSpeed: 10,
      weapons: [
        {
          id: 'test_gun',
          name: '75 mm 炮',
          reloadTime: 5,
          ammo: [],
        },
      ],
      hull: { length: 5, width: 2.5, height: 1.8, turnRate: 15, acceleration: 4 },
      turret: { length: 2, width: 2, height: 0.8, barrelLength: 2, elevation: [-5, 20], elevationSpeed: 3 },
      sight: { magnifications: [2.5], reticle: 'german' },
      internals: { modules: [], crew: [] },
      color: 0x333333,
    };

    const card = vehicleCardData(minimalSpec, 0);
    const mobSec = card.sections.find((s) => s.title === '机动');
    expect(mobSec).toBeDefined();

    // 缺少 mass 和 enginePower, 不应存在对应行
    expect(mobSec?.rows.find((r) => r.label === '质量')).toBeUndefined();
    expect(mobSec?.rows.find((r) => r.label === '发动机功率')).toBeUndefined();

    // 缺少 reverseSpeed, 最大速度仅显示前进
    const speedRow = mobSec?.rows.find((r) => r.label === '最大速度');
    expect(speedRow?.value).toBe('45 km/h');

    // 缺少机枪, 不应存在同轴机枪弹药行
    const fireSec = card.sections.find((s) => s.title === '火力');
    expect(fireSec?.rows.find((r) => r.label === '同轴机枪弹药')).toBeUndefined();
  });
});
