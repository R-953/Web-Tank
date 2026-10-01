import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { VEHICLES } from '../../src/data/vehicles';
import { SHELL_TYPES } from '../../src/data/shells';
import { penetrationTable } from '../../src/data/penetration';
import { flyShell } from '../sim';

/** B1 隐藏测试:评分时拷进 tests/__hidden__/,执行者看不到 */
beforeAll(async () => {
  await RAPIER.init();
});

const RANGES = [100, 500, 1000, 2000];
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));

describe('B1 隐藏测试', () => {
  for (const v of Object.values(VEHICLES)) {
    it(`和逐帧模拟一致:${v.name} 的全部炮弹`, () => {
      for (const s of v.weapons.filter((w) => w.kind !== 'mg').flatMap((w) => w.ammo)) {
        const sim = flyShell(s, RANGES);
        const got = penetrationTable(s, RANGES);
        expect(got).toHaveLength(RANGES.length);
        got.forEach((g, i) => {
          expect(g.range).toBe(RANGES[i]);
          expect(rel(g.penetration, sim[i].penetration)).toBeLessThan(0.02);
          expect(rel(g.velocity, sim[i].speed)).toBeLessThan(0.02);
          expect(rel(g.time, sim[i].time)).toBeLessThan(0.02);
        });
      }
    });
  }

  const all = Object.values(VEHICLES).flatMap((v) => v.weapons.filter((w) => w.kind !== 'mg').flatMap((w) => w.ammo));
  const kinetic = all.find((s) => SHELL_TYPES[s.type].family === 'kinetic')!;
  const chemical = all.find((s) => SHELL_TYPES[s.type].family !== 'kinetic')!;

  it('距离 0:炮口速度、时间 0、炮口穿深', () => {
    const [g] = penetrationTable(kinetic, [0]);
    expect(g.velocity).toBeCloseTo(kinetic.muzzleVelocity, 6);
    expect(g.time).toBeCloseTo(0, 9);
    expect(g.penetration).toBeCloseTo(kinetic.penetration, 6);
  });

  it('乱序输入:按输入顺序返回,数值和有序输入一致', () => {
    const a = penetrationTable(kinetic, [1000, 0, 500]);
    const b = penetrationTable(kinetic, [0, 500, 1000]);
    expect(a.map((x) => x.range)).toEqual([1000, 0, 500]);
    expect(a[0].penetration).toBeCloseTo(b[2].penetration, 9);
    expect(a[2].time).toBeCloseTo(b[1].time, 9);
  });

  it('化学能弹:穿深和距离无关,速度照样衰减', () => {
    const t = penetrationTable(chemical, [0, 1000, 2000]);
    for (const g of t) expect(g.penetration).toBeCloseTo(chemical.penetration, 9);
    expect(t[2].velocity).toBeLessThan(t[0].velocity);
  });

  it('动能弹:越远越慢、穿深越低、时间越长', () => {
    const t = penetrationTable(kinetic, [0, 500, 1000, 1500]);
    for (let i = 1; i < t.length; i++) {
      expect(t[i].velocity).toBeLessThan(t[i - 1].velocity);
      expect(t[i].penetration).toBeLessThan(t[i - 1].penetration);
      expect(t[i].time).toBeGreaterThan(t[i - 1].time);
    }
  });

  it('空数组返回空数组,不改动输入', () => {
    expect(penetrationTable(kinetic, [])).toEqual([]);
    const input = [2000, 100];
    penetrationTable(kinetic, input);
    expect(input).toEqual([2000, 100]);
  });
});
