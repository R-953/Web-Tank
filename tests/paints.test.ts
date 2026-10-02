import { describe, it, expect } from 'vitest';
import { VEHICLES } from '../src/data/vehicles';
import { paintsFor, applyPaint } from '../src/data/paints';
import type { VehicleSpec } from '../src/data/types';

describe('载具涂装方案数据 (paints)', () => {
  const allVehicles = Object.values(VEHICLES);

  it('所有车型都至少有 2 个涂装方案, 第一项必须是出厂(id 为 default, color = spec.color)', () => {
    expect(allVehicles.length).toBeGreaterThanOrEqual(8);

    for (const veh of allVehicles) {
      const paints = paintsFor(veh);
      expect(paints.length, `车型 ${veh.id} 的涂装方案数量应 >= 2`).toBeGreaterThanOrEqual(2);

      const first = paints[0];
      expect(first.id, `车型 ${veh.id} 第一项 id 应为 'default'`).toBe('default');
      expect(first.color, `车型 ${veh.id} 第一项颜色应等于 spec.color`).toBe(veh.color);
    }
  });

  it('同一车型内涂装方案 id 唯一, 且 source 出处非空', () => {
    for (const veh of allVehicles) {
      const paints = paintsFor(veh);
      const ids = new Set<string>();

      for (const p of paints) {
        expect(ids.has(p.id), `车型 ${veh.id} 中涂装 id '${p.id}' 重复`).toBe(false);
        ids.add(p.id);

        expect(typeof p.name).toBe('string');
        expect(p.name.trim().length).toBeGreaterThan(0);

        expect(typeof p.color).toBe('number');
        expect(Number.isInteger(p.color)).toBe(true);
        expect(p.color).toBeGreaterThanOrEqual(0);
        expect(p.color).toBeLessThanOrEqual(0xffffff);

        expect(typeof p.source).toBe('string');
        expect(p.source.trim().length, `车型 ${veh.id} 方案 ${p.id} 的 source 不能为空`).toBeGreaterThan(0);
      }
    }
  });

  it('各车型的史实涂装符合规范', () => {
    // 虎式 / 虎王: 暗黄、橄榄绿、装甲灰(虎式早期)等
    const tigerIPaints = paintsFor(VEHICLES.tiger_i);
    const tigerIIds = tigerIPaints.map((p) => p.id);
    expect(tigerIIds).toContain('default');
    expect(tigerIIds).toContain('panzergrau');
    expect(tigerIIds).toContain('olivgruen');
    expect(tigerIIds).toContain('winter_white');

    const tigerIIPaints = paintsFor(VEHICLES.tiger_ii);
    const tigerIIIds = tigerIIPaints.map((p) => p.id);
    expect(tigerIIIds).toContain('default');
    expect(tigerIIIds).toContain('dunkelgelb');
    expect(tigerIIIds).toContain('olivgruen');
    expect(tigerIIIds).toContain('winter_white');

    // 苏军车: 4BO、冬季水洗白
    for (const id of ['t34_85', 'su_100', 'isu_122']) {
      const paints = paintsFor(VEHICLES[id]);
      const ids = paints.map((p) => p.id);
      expect(ids).toContain('default');
      expect(ids).toContain('winter_white');
    }

    // 美军谢尔曼三车: 橄榄褐(保持 026 号卡色值 0x544f3d)、冬季水洗白
    for (const id of ['m4a3_76w', 'm4a3e8', 'm4a3e2']) {
      const paints = paintsFor(VEHICLES[id]);
      expect(paints[0].color).toBe(0x544f3d);
      const ids = paints.map((p) => p.id);
      expect(ids).toContain('default');
      expect(ids).toContain('winter_white');
    }
  });

  it('未知 spec 也能安全回退并保证至少 2 个方案', () => {
    const dummySpec: VehicleSpec = {
      ...VEHICLES.tiger_i,
      id: 'custom_tank',
      name: '自定义测试车',
      color: 0x123456,
    };
    const paints = paintsFor(dummySpec);
    expect(paints.length).toBeGreaterThanOrEqual(2);
    expect(paints[0].id).toBe('default');
    expect(paints[0].color).toBe(0x123456);
  });
});

describe('套用涂装逻辑 (applyPaint)', () => {
  const tiger = VEHICLES.tiger_i;

  it('null / undefined / default / 未知 id 原样返回对象引用', () => {
    expect(applyPaint(tiger, null)).toBe(tiger);
    expect(applyPaint(tiger, undefined)).toBe(tiger);
    expect(applyPaint(tiger, 'default')).toBe(tiger);
    expect(applyPaint(tiger, 'non_existent_paint')).toBe(tiger);
    expect(applyPaint(tiger, '')).toBe(tiger);
  });

  it('合法涂装 id 返回全新对象, 不修改入参', () => {
    const originalColor = tiger.color;
    const painted = applyPaint(tiger, 'panzergrau');

    // 返回新对象, 引用不相等
    expect(painted).not.toBe(tiger);
    // 入参原封不动
    expect(tiger.color).toBe(originalColor);
    // 新对象的颜色已更新为装甲灰 (0x3b3f42)
    expect(painted.color).toBe(0x3b3f42);
    // 其他属性保持一致
    expect(painted.id).toBe(tiger.id);
    expect(painted.name).toBe(tiger.name);
    expect(painted.armor).toEqual(tiger.armor);
    expect(painted.weapons).toEqual(tiger.weapons);
  });

  it('冬季涂装套用到谢尔曼与 T-34-85 返回正确的冬季颜色', () => {
    const winterSherman = applyPaint(VEHICLES.m4a3_76w, 'winter_white');
    expect(winterSherman.color).toBe(0xd8dcd6);

    const winterT34 = applyPaint(VEHICLES.t34_85, 'winter_white');
    expect(winterT34.color).toBe(0xd8dcd6);
  });
});
