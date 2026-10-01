import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import type { ShellSpec, VehicleSpec } from '../src/data/types';
import { M4A3E2, M4A3E8, M4A3_76W, TIGER_I } from '../src/data/vehicles';
import { shermanLayout } from '../src/game/models/sherman/layout';
import { flyShell } from './sim';

beforeAll(async () => {
  await RAPIER.init();
});

const shell = (spec: VehicleSpec, id: string): ShellSpec => spec.weapons[0].ammo.find((a) => a.id === id)!;

describe('谢尔曼穿深曲线对照资料(Bird & Livingston 2001,90° 均质装甲,容差 3%)', () => {
  const cases: Array<[string, ShellSpec, Array<[number, number]>]> = [
    ['M62(76 mm)', shell(M4A3E8, 'm62'), [[100, 125], [500, 116], [1000, 106], [1500, 97], [2000, 89]]],
    ['M79(76 mm)', shell(M4A3E8, 'm79'), [[100, 154], [500, 131], [1000, 107], [1500, 88], [2000, 72]]],
    ['M93(76 mm)', shell(M4A3E8, 'm93'), [[100, 239], [500, 208], [1000, 175], [1500, 147], [2000, 124]]],
    ['M61(75 mm)', shell(M4A3E2, 'm61'), [[100, 88], [500, 81], [1000, 73], [1500, 65], [2000, 59]]],
    ['M72(75 mm)', shell(M4A3E2, 'm72'), [[100, 109], [500, 92], [1000, 76], [1500, 62], [2000, 51]]],
  ];
  for (const [name, s, table] of cases) {
    it(name, () => {
      const got = flyShell(s, table.map(([r]) => r));
      table.forEach(([range, want], i) => {
        expect(Math.abs(got[i].penetration - want) / want).toBeLessThan(0.03);
        expect(got[i].range).toBe(range);
      });
    });
  }

  it('两辆 76 mm 车用同一门炮的弹药;76 mm M62 在 1000 m 能打穿虎式正面(100 mm 垂直),75 mm M61 在 500 m 打不穿', () => {
    expect(M4A3_76W.weapons[0].ammo).toEqual(M4A3E8.weapons[0].ammo);
    expect(flyShell(shell(M4A3E8, 'm62'), [1000])[0].penetration).toBeGreaterThan(TIGER_I.armor.front);
    expect(flyShell(shell(M4A3E2, 'm61'), [500])[0].penetration).toBeLessThan(TIGER_I.armor.front);
  });
});

describe('谢尔曼的几何数据和资料对得上', () => {
  // [车, 炮口伸出车首(m), 火线高(m), 全高(m)];Hunnicutt 1994 / Catalogue of Standard Ordnance Items
  const cases: Array<[VehicleSpec, number, number, number]> = [
    [M4A3_76W, 47 * 0.0254, 90 * 0.0254, 117 * 0.0254],
    [M4A3E8, 50 * 0.0254, 90 * 0.0254, 117 * 0.0254],
    [M4A3E2, 0, 88 * 0.0254, 116.3 * 0.0254],
  ];
  for (const [spec, overhang, fireHeight, height] of cases) {
    it(spec.name, () => {
      const { hull, turret } = spec;
      // 炮口伸出量(types.ts 里 offset 的公式)
      const muzzle = turret.barrelLength + turret.length / 2 - (turret.offset ?? 0) - hull.length / 2;
      expect(Math.abs(muzzle - overhang)).toBeLessThan(0.01);
      // 炮耳轴高度 = 车体盒高 + 炮塔盒半高;E2 的资料值低 5.5 cm(同一车体 / 炮塔盒高,见 vehicles.ts 注释)
      expect(Math.abs(hull.height + turret.height / 2 - fireHeight)).toBeLessThan(0.06);
      // 炮塔顶到全高之间留给指挥塔 0.2–0.35 m
      const cupola = height - (hull.height + turret.height);
      expect(cupola).toBeGreaterThan(0.2);
      expect(cupola).toBeLessThan(0.35);
    });
  }

  it('共用布局:履带在车宽以内,主动轮(连履带)不顶到侧裙,车鼻在车体盒以内', () => {
    for (const [spec, suspension] of [
      [M4A3_76W, 'vvss'],
      [M4A3E8, 'hvss'],
      [M4A3E2, 'vvss'],
    ] as const) {
      const L = shermanLayout(spec, { suspension, turret: 't23', gun: 'm1a1', applique: false });
      expect(L.track.x + L.track.width / 2).toBeLessThan(spec.hull.width / 2);
      expect(L.track.x - L.track.width / 2).toBeGreaterThan(L.lowerHalfW);
      expect(L.sprocket.y + L.sprocket.r + L.track.thickness).toBeLessThan(L.sponsonY);
      expect(L.noseZ).toBeGreaterThan(-L.hl);
      expect(L.sprocket.z - L.sprocket.r - L.track.thickness).toBeGreaterThan(-L.hl);
    }
  });
});
