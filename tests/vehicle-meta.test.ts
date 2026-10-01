import { describe, it, expect } from 'vitest';
import { VEHICLES } from '../src/data/vehicles';
import type { Nation, VehicleClass } from '../src/data/types';

describe('载具元数据与王牌乘员数值(任务 028)', () => {
  const vehicleList = Object.values(VEHICLES);

  it('共有 8 辆载具全部配置了 5 个元数据字段', () => {
    expect(vehicleList).toHaveLength(8);
    for (const v of vehicleList) {
      expect(v.nation).toBeDefined();
      expect(v.vehicleClass).toBeDefined();
      expect(typeof v.serviceYear).toBe('number');
      expect(v.serviceYear).toBeGreaterThanOrEqual(1939);
      expect(v.serviceYear).toBeLessThanOrEqual(1945);
      expect(typeof v.family).toBe('string');
      expect(v.family?.length).toBeGreaterThan(0);
      expect(v.crewAce).toBeDefined();
      expect(v.crewAce?.reloadTime).toBeGreaterThan(0);
      expect(v.crewAce?.turretRotationSpeed).toBeGreaterThan(0);
      expect(v.crewAce?.elevationSpeed).toBeGreaterThan(0);
    }
  });

  it('国家、车型与车族配置与任务卡约定完全一致', () => {
    const expectedTable: Record<string, { nation: Nation; vehicleClass: VehicleClass; family: string; serviceYear: number }> = {
      tiger_i: { nation: 'germany', vehicleClass: 'heavy', family: 'tiger', serviceYear: 1942 },
      tiger_ii: { nation: 'germany', vehicleClass: 'heavy', family: 'tiger_ii', serviceYear: 1944 },
      t34_85: { nation: 'ussr', vehicleClass: 'medium', family: 't34', serviceYear: 1944 },
      su_100: { nation: 'ussr', vehicleClass: 'td', family: 'su100', serviceYear: 1944 },
      isu_122: { nation: 'ussr', vehicleClass: 'td', family: 'isu', serviceYear: 1944 },
      m4a3_76w: { nation: 'usa', vehicleClass: 'medium', family: 'm4a3', serviceYear: 1944 },
      m4a3e8: { nation: 'usa', vehicleClass: 'medium', family: 'm4a3', serviceYear: 1944 },
      m4a3e2: { nation: 'usa', vehicleClass: 'medium', family: 'm4a3', serviceYear: 1944 },
    };

    for (const [id, expected] of Object.entries(expectedTable)) {
      const v = VEHICLES[id];
      expect(v, `Vehicle ${id} must exist`).toBeDefined();
      expect(v.nation).toBe(expected.nation);
      expect(v.vehicleClass).toBe(expected.vehicleClass);
      expect(v.family).toBe(expected.family);
      expect(v.serviceYear).toBe(expected.serviceYear);
    }
  });

  it('三辆谢尔曼车族相同,其余各车车族各不相同', () => {
    const shermanIds = ['m4a3_76w', 'm4a3e8', 'm4a3e2'];
    const nonShermanIds = ['tiger_i', 'tiger_ii', 't34_85', 'su_100', 'isu_122'];

    const shermanFamilies = new Set(shermanIds.map((id) => VEHICLES[id].family));
    expect(shermanFamilies.size).toBe(1);
    expect(shermanFamilies.has('m4a3')).toBe(true);

    const nonShermanFamilies = nonShermanIds.map((id) => VEHICLES[id].family);
    const allDistinctFamilies = new Set([VEHICLES.m4a3_76w.family, ...nonShermanFamilies]);
    // 总共有 1 个谢尔曼车族 + 5 个其他车族 = 6 个互不相同的车族
    expect(allDistinctFamilies.size).toBe(6);
  });

  it('王牌乘员装填时间严格小于现有装填时间,且王牌旋转速度 ≥ 现有旋转速度', () => {
    for (const v of vehicleList) {
      const ace = v.crewAce!;
      const baseReload = v.weapons[0].reloadTime;
      const baseTurretRotation = v.turretRotationSpeed;
      const baseElevation = v.turret.elevationSpeed;

      expect(ace.reloadTime, `${v.id} ace reload should be faster`).toBeLessThan(baseReload);
      expect(ace.turretRotationSpeed, `${v.id} ace horizontal rotation should be >= base`).toBeGreaterThanOrEqual(baseTurretRotation);
      expect(ace.elevationSpeed, `${v.id} ace elevation speed should be >= base`).toBeGreaterThanOrEqual(baseElevation);
    }
  });
});
