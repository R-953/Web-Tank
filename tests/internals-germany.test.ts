import { describe, it, expect } from 'vitest';
import { TIGER_I, TIGER_II } from '../src/data/vehicles';
import type { CrewRole, ModuleSpec, VehicleSpec } from '../src/data/types';
import { CREW_ROLE_NAMES } from '../src/data/modules';

const GERMAN_VEHICLES: Array<{ id: string; spec: VehicleSpec; expectedCapacity: number }> = [
  { id: 'tiger_i', spec: TIGER_I, expectedCapacity: 92 },
  { id: 'tiger_ii', spec: TIGER_II, expectedCapacity: 86 },
];

const EXPECTED_ROLES: CrewRole[] = ['commander', 'gunner', 'loader', 'driver', 'radio'];

describe('德国车辆内构细化 (虎式 E 与 虎王)', () => {
  for (const { id, spec, expectedCapacity } of GERMAN_VEHICLES) {
    describe(`${spec.name} (${id})`, () => {
      it('乘员人数为 5 人,且覆盖完整的 5 种乘员岗位', () => {
        expect(spec.internals.crew).toHaveLength(5);
        const roles = spec.internals.crew.map((c) => c.role);
        expect(new Set(roles).size).toBe(5);
        for (const role of EXPECTED_ROLES) {
          expect(roles).toContain(role);
          expect(CREW_ROLE_NAMES[role]).toBeDefined();
        }

        // 驾驶员和机电员在车体,车长、炮手、装填手在炮塔
        const driver = spec.internals.crew.find((c) => c.role === 'driver')!;
        const radio = spec.internals.crew.find((c) => c.role === 'radio')!;
        const gunner = spec.internals.crew.find((c) => c.role === 'gunner')!;
        const commander = spec.internals.crew.find((c) => c.role === 'commander')!;
        const loader = spec.internals.crew.find((c) => c.role === 'loader')!;

        expect(driver.part).toBe('hull');
        expect(radio.part).toBe('hull');
        expect(gunner.part).toBe('turret');
        expect(commander.part).toBe('turret');
        expect(loader.part).toBe('turret');

        // 驾驶员在左(-X),机电员在右(+X)
        expect(driver.center[0]).toBeLessThan(0);
        expect(radio.center[0]).toBeGreaterThan(0);

        // 炮手在主炮左侧(-X),车长在炮手后方(+Z),装填手在主炮右侧(+X)
        expect(gunner.center[0]).toBeLessThan(0);
        expect(commander.center[0]).toBeLessThan(0);
        expect(commander.center[2]).toBeGreaterThan(gunner.center[2]);
        expect(loader.center[0]).toBeGreaterThan(0);
      });

      it('每个乘员的 center 在所属部件的外形盒内', () => {
        const { hull, turret } = spec;
        const halfHull = [hull.width / 2, hull.height / 2, hull.length / 2] as const;
        const halfTurret = [turret.width / 2, turret.height / 2, turret.length / 2] as const;

        for (const c of spec.internals.crew) {
          if (c.part === 'hull') {
            expect(Math.abs(c.center[0])).toBeLessThanOrEqual(halfHull[0]);
            expect(Math.abs(c.center[1])).toBeLessThanOrEqual(halfHull[1]);
            expect(Math.abs(c.center[2])).toBeLessThanOrEqual(halfHull[2]);
          } else {
            // 炮塔坐标系:原点在座圈中心,y=0 为车顶,y 向上至 turret.height
            expect(Math.abs(c.center[0])).toBeLessThanOrEqual(halfTurret[0]);
            expect(c.center[1]).toBeGreaterThanOrEqual(0);
            expect(c.center[1]).toBeLessThanOrEqual(turret.height);
            expect(Math.abs(c.center[2])).toBeLessThanOrEqual(halfTurret[2]);
          }
        }
      });

      it('每个模块的盒子在所属部件范围内(炮管与炮闩部件放宽到炮管长度与炮塔长度)', () => {
        const { hull, turret } = spec;
        const halfHull = [hull.width / 2, hull.height / 2, hull.length / 2] as const;
        const halfTurret = [turret.width / 2, turret.height / 2, turret.length / 2] as const;

        for (const m of spec.internals.modules) {
          const half = [m.size[0] / 2, m.size[1] / 2, m.size[2] / 2] as const;

          if (m.part === 'hull') {
            expect(m.center[0] - half[0]).toBeGreaterThanOrEqual(-halfHull[0] - 1e-4);
            expect(m.center[0] + half[0]).toBeLessThanOrEqual(halfHull[0] + 1e-4);
            expect(m.center[1] - half[1]).toBeGreaterThanOrEqual(-halfHull[1] - 1e-4);
            expect(m.center[1] + half[1]).toBeLessThanOrEqual(halfHull[1] + 1e-4);
            expect(m.center[2] - half[2]).toBeGreaterThanOrEqual(-halfHull[2] - 1e-4);
            expect(m.center[2] + half[2]).toBeLessThanOrEqual(halfHull[2] + 1e-4);
          } else if (m.part === 'turret') {
            expect(m.center[0] - half[0]).toBeGreaterThanOrEqual(-halfTurret[0] - 1e-4);
            expect(m.center[0] + half[0]).toBeLessThanOrEqual(halfTurret[0] + 1e-4);
            expect(m.center[1] - half[1]).toBeGreaterThanOrEqual(-1e-4);
            expect(m.center[1] + half[1]).toBeLessThanOrEqual(turret.height + 1e-4);
            expect(m.center[2] - half[2]).toBeGreaterThanOrEqual(-halfTurret[2] - 1e-4);
            expect(m.center[2] + half[2]).toBeLessThanOrEqual(halfTurret[2] + 1e-4);
          } else if (m.part === 'gun') {
            // 火炮局部系:原点在炮耳轴,-Z 沿炮管伸出,炮管最长 barrelLength,炮闩向 +Z 后伸
            if (m.type === 'barrel') {
              expect(m.center[2] - half[2]).toBeGreaterThanOrEqual(-turret.barrelLength - 1e-4);
              expect(m.center[2] + half[2]).toBeLessThanOrEqual(1e-4);
            } else if (m.type === 'breech') {
              expect(m.center[2] - half[2]).toBeGreaterThanOrEqual(-1e-4);
              expect(m.center[2] + half[2]).toBeLessThanOrEqual(turret.length + 1e-4);
            }
          }
        }
      });

      it('弹药架总容量与预期一致,取弹顺序合法', () => {
        const ammoRacks = spec.internals.modules.filter((m) => m.type === 'ammo');
        expect(ammoRacks.length).toBeGreaterThan(0);

        const totalCapacity = ammoRacks.reduce((acc, cur) => acc + (cur.capacity ?? 0), 0);
        expect(totalCapacity).toBe(expectedCapacity);

        // drawOrder 必须全为正数且唯一
        const orders = ammoRacks.map((r) => r.drawOrder!);
        expect(orders.every((o) => typeof o === 'number' && o > 0)).toBe(true);
        expect(new Set(orders).size).toBe(orders.length);
      });

      it('模块 id 在同一辆车内唯一', () => {
        const ids = spec.internals.modules.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('任意两个同类模块的盒子不重叠', () => {
        // 将模块盒转到同一参考系(车体坐标系,炮塔角=0,俯仰=0)统一做碰撞排查
        function toHullBox(spec: VehicleSpec, m: ModuleSpec) {
          const cx = m.center[0];
          let cy = m.center[1];
          let cz = m.center[2];

          if (m.part === 'turret') {
            cy += spec.hull.height / 2;
            cz += spec.turret.offset ?? 0;
          } else if (m.part === 'gun') {
            cy += spec.hull.height / 2 + spec.turret.height / 2;
            cz += (spec.turret.offset ?? 0) - spec.turret.length / 2;
          }

          const hx = m.size[0] / 2;
          const hy = m.size[1] / 2;
          const hz = m.size[2] / 2;

          return {
            minX: cx - hx,
            maxX: cx + hx,
            minY: cy - hy,
            maxY: cy + hy,
            minZ: cz - hz,
            maxZ: cz + hz,
          };
        }

        const modules = spec.internals.modules;
        for (let i = 0; i < modules.length; i++) {
          for (let j = i + 1; j < modules.length; j++) {
            const a = modules[i];
            const b = modules[j];

            if (a.type !== b.type) continue;

            const boxA = toHullBox(spec, a);
            const boxB = toHullBox(spec, b);

            const eps = 1e-4;
            const overlapX = Math.max(boxA.minX, boxB.minX) < Math.min(boxA.maxX, boxB.maxX) - eps;
            const overlapY = Math.max(boxA.minY, boxB.minY) < Math.min(boxA.maxY, boxB.maxY) - eps;
            const overlapZ = Math.max(boxA.minZ, boxB.minZ) < Math.min(boxA.maxZ, boxB.maxZ) - eps;

            const overlaps = overlapX && overlapY && overlapZ;
            expect(overlaps, `同类模块 ${a.id} 与 ${b.id} 发生空间重叠`).toBe(false);
          }
        }
      });
    });
  }
});
