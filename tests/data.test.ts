import { describe, it, expect } from 'vitest';
import { VEHICLES } from '../src/data/vehicles';
import { MAPS, parseHeightRows } from '../src/data/maps';
import { SHELL_TYPES } from '../src/data/shells';
import { ammoCapacity } from '../src/game/Loadout';

describe('载具数据', () => {
  it('字典 key 与 id 一致', () => {
    for (const [key, spec] of Object.entries(VEHICLES)) expect(spec.id).toBe(key);
  });

  it('字段完整且数值合法', () => {
    for (const spec of Object.values(VEHICLES)) {
      for (const face of ['front', 'side', 'rear'] as const) {
        expect(spec.armor[face]).toBeGreaterThan(0);
        expect(spec.turretArmor[face]).toBeGreaterThan(0);
      }
      expect(spec.maxSpeed).toBeGreaterThan(0);
      expect(spec.turretRotationSpeed).toBeGreaterThan(0);
      expect(spec.hull.length).toBeGreaterThan(0);
      expect(spec.hull.width).toBeGreaterThan(0);
      expect(spec.hull.height).toBeGreaterThan(0);
      expect(spec.hull.turnRate).toBeGreaterThan(0);
      expect(spec.hull.acceleration).toBeGreaterThan(0);
      expect(spec.turret.elevation[0]).toBeLessThanOrEqual(0);
      expect(spec.turret.elevation[1]).toBeGreaterThanOrEqual(0);
      expect(spec.turret.elevationSpeed).toBeGreaterThan(0);
      expect(spec.sight.magnifications.length).toBeGreaterThan(0);
      for (const m of spec.sight.magnifications) expect(m).toBeGreaterThanOrEqual(1);
      for (const w of spec.weapons) {
        expect(w.reloadTime).toBeGreaterThan(0);
        expect(w.ammo.length).toBeGreaterThan(0);
        expect(new Set(w.ammo.map((a) => a.id)).size).toBe(w.ammo.length);
        for (const a of w.ammo) {
          expect(SHELL_TYPES[a.type]).toBeDefined();
          expect(a.muzzleVelocity).toBeGreaterThan(0);
          expect(a.penetration).toBeGreaterThan(0);
          expect(a.caliber).toBeGreaterThan(0);
          expect(a.mass).toBeGreaterThan(0);
          expect(a.fuseDelay).toBeGreaterThanOrEqual(0);
          if (SHELL_TYPES[a.type].delayedExplosive || SHELL_TYPES[a.type].family === 'chemical') expect(a.explosiveMass).toBeGreaterThan(0);
          else expect(a.explosiveMass).toBe(0);
        }
      }
    }
  });
});

describe('载具内构', () => {
  it('模块 id 唯一,尺寸为正;乘员岗位与史实一致(一般 5 人,下表列出的车 4 人);关键模块都有', () => {
    const FIVE = ['commander', 'driver', 'gunner', 'loader', 'radio'];
    // 固定战斗室车没有专职无线电员 / 航向机枪手:SU-100 由车长兼任无线电员;ISU-122 的第 5 人是闩手(第二装填手)
    const FOUR = ['commander', 'driver', 'gunner', 'loader'];
    const crewRoles: Record<string, string[]> = { su_100: FOUR, isu_122: [...FOUR, 'loader'] };
    for (const spec of Object.values(VEHICLES)) {
      const ids = spec.internals.modules.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const m of spec.internals.modules) for (const d of m.size) expect(d).toBeGreaterThan(0);
      const types = new Set(spec.internals.modules.map((m) => m.type));
      for (const t of ['engine', 'transmission', 'track', 'barrel', 'breech', 'ammo', 'traverse', 'elevation'] as const) {
        expect(types.has(t)).toBe(true);
      }
      expect(spec.internals.modules.filter((m) => m.type === 'track')).toHaveLength(2);
      const roles = spec.internals.crew.map((c) => c.role).sort();
      expect(roles).toEqual(crewRoles[spec.id] ?? FIVE);
    }
  });

  it('弹药架都有容量和唯一的取弹顺序;总容量与史实载弹量一致', () => {
    const expected: Record<string, number> = { tiger_i: 92, t34_85: 55, tiger_ii: 86, su_100: 33, isu_122: 30 };
    for (const spec of Object.values(VEHICLES)) {
      const racks = spec.internals.modules.filter((m) => m.type === 'ammo');
      for (const r of racks) {
        expect(r.capacity).toBeGreaterThan(0);
        expect(r.drawOrder).toBeGreaterThan(0);
      }
      expect(new Set(racks.map((r) => r.drawOrder)).size).toBe(racks.length);
      expect(ammoCapacity(spec)).toBe(expected[spec.id]);
    }
  });
});

describe('地图数据', () => {
  it('高度图尺寸正确,取值在 0..1', () => {
    for (const map of Object.values(MAPS)) {
      const g = map.terrain.heightmap;
      if (!g) continue;
      expect(g.heights).toHaveLength(g.resolution * g.resolution);
      expect(Math.min(...g.heights)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...g.heights)).toBeLessThanOrEqual(1);
    }
  });

  it('出生点引用的载具存在,且都在地图范围内', () => {
    for (const map of Object.values(MAPS)) {
      const half = map.size / 2;
      const spawns = [map.spawns.player, ...map.spawns.targets];
      for (const s of spawns) {
        expect(VEHICLES[s.vehicleId]).toBeDefined();
        const points = [s.position, ...(s.patrol ? [s.patrol.to] : [])];
        for (const [x, z] of points) {
          expect(Math.abs(x)).toBeLessThan(half);
          expect(Math.abs(z)).toBeLessThan(half);
        }
      }
      expect(VEHICLES[map.spawns.player.vehicleId].weapons.length).toBeGreaterThan(0);
    }
  });

  it('parseHeightRows 拒绝行列不一致或含非法字符的网格', () => {
    expect(parseHeightRows(['09', '90'])).toEqual([0, 1, 1, 0]);
    expect(() => parseHeightRows(['000', '00', '000'])).toThrow();
    expect(() => parseHeightRows(['0a', '00'])).toThrow();
  });
});
