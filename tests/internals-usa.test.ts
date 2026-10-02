import { describe, it, expect } from 'vitest';
import { M4A3_76W, M4A3E8, M4A3E2 } from '../src/data/vehicles';
import type { CrewRole, ModuleSpec, VehicleSpec } from '../src/data/types';

const USA_VEHICLES: VehicleSpec[] = [M4A3_76W, M4A3E8, M4A3E2];

describe('美国车辆内构细化(M4A3_76W, M4A3E8, M4A3E2)', () => {
  describe('乘员人数与岗位集合', () => {
    const expectedRoles: CrewRole[] = ['driver', 'radio', 'gunner', 'commander', 'loader'];

    for (const spec of USA_VEHICLES) {
      it(`${spec.name}: 共有 5 名乘员,岗位集合完整`, () => {
        const crew = spec.internals.crew;
        expect(crew.length).toBe(5);

        const roles = crew.map((c) => c.role);
        expect(new Set(roles)).toEqual(new Set(expectedRoles));
      });

      it(`${spec.name}: 驾驶员与机电员在车体,车长、炮手、装填手在炮塔`, () => {
        const crew = spec.internals.crew;
        const hullCrew = crew.filter((c) => c.part === 'hull');
        const turretCrew = crew.filter((c) => c.part === 'turret');

        expect(hullCrew.length).toBe(2);
        expect(hullCrew.map((c) => c.role).sort()).toEqual(['driver', 'radio']);

        expect(turretCrew.length).toBe(3);
        expect(turretCrew.map((c) => c.role).sort()).toEqual(['commander', 'gunner', 'loader']);
      });

      it(`${spec.name}: 乘员站位符合实车布局(左装填手、右炮手车长;左驾驶员、右机电员)`, () => {
        const crew = spec.internals.crew;
        const driver = crew.find((c) => c.role === 'driver')!;
        const radio = crew.find((c) => c.role === 'radio')!;
        const loader = crew.find((c) => c.role === 'loader')!;
        const gunner = crew.find((c) => c.role === 'gunner')!;
        const commander = crew.find((c) => c.role === 'commander')!;

        // 车体: 驾驶员在左 (X < 0), 机电员/副驾驶在右 (X > 0), 都在前部 (Z < 0)
        expect(driver.center[0]).toBeLessThan(0);
        expect(radio.center[0]).toBeGreaterThan(0);
        expect(driver.center[2]).toBeLessThan(-1.5);
        expect(radio.center[2]).toBeLessThan(-1.5);

        // 炮塔: 谢尔曼左侧装填, 装填手在左 (X < 0), 炮手与车长在右 (X > 0)
        expect(loader.center[0]).toBeLessThan(0);
        expect(gunner.center[0]).toBeGreaterThan(0);
        expect(commander.center[0]).toBeGreaterThan(0);

        // 炮手在炮塔前部 (Z < 0), 车长在炮塔后部指挥塔下方 (Z > 0) 且高度高于炮手
        expect(gunner.center[2]).toBeLessThan(0);
        expect(commander.center[2]).toBeGreaterThan(0);
        expect(commander.center[1]).toBeGreaterThan(gunner.center[1]);
      });
    }
  });

  describe('乘员 center 在所属部件盒内', () => {
    for (const spec of USA_VEHICLES) {
      it(`${spec.name}: 每个乘员的 center 坐标在所属部件外形盒内`, () => {
        const halfHW = spec.hull.width / 2;
        const halfHH = spec.hull.height / 2;
        const halfHL = spec.hull.length / 2;

        const halfTW = spec.turret.width / 2;
        const turretH = spec.turret.height;
        const halfTL = spec.turret.length / 2;
        const tOffset = spec.turret.offset ?? 0;

        for (const c of spec.internals.crew) {
          if (c.part === 'hull') {
            expect(c.center[0]).toBeGreaterThanOrEqual(-halfHW);
            expect(c.center[0]).toBeLessThanOrEqual(halfHW);
            expect(c.center[1]).toBeGreaterThanOrEqual(-halfHH);
            expect(c.center[1]).toBeLessThanOrEqual(halfHH);
            expect(c.center[2]).toBeGreaterThanOrEqual(-halfHL);
            expect(c.center[2]).toBeLessThanOrEqual(halfHL);
          } else {
            expect(c.center[0]).toBeGreaterThanOrEqual(-halfTW);
            expect(c.center[0]).toBeLessThanOrEqual(halfTW);
            // 炮塔坐标系: y = 0 为座圈/车顶面, 向上到 turret.height
            expect(c.center[1]).toBeGreaterThanOrEqual(0);
            expect(c.center[1]).toBeLessThanOrEqual(turretH);
            expect(c.center[2]).toBeGreaterThanOrEqual(-halfTL + tOffset);
            expect(c.center[2]).toBeLessThanOrEqual(halfTL + tOffset);
          }
        }
      });
    }
  });

  describe('模块盒子在所属部件范围内', () => {
    const EPS = 1e-4;

    for (const spec of USA_VEHICLES) {
      it(`${spec.name}: 车体模块与履带模块盒子均在车体碰撞盒范围内`, () => {
        const halfHW = spec.hull.width / 2;
        const halfHH = spec.hull.height / 2;
        const halfHL = spec.hull.length / 2;

        const hullModules = spec.internals.modules.filter((m) => m.part === 'hull');
        for (const m of hullModules) {
          const minX = m.center[0] - m.size[0] / 2;
          const maxX = m.center[0] + m.size[0] / 2;
          const minY = m.center[1] - m.size[1] / 2;
          const maxY = m.center[1] + m.size[1] / 2;
          const minZ = m.center[2] - m.size[2] / 2;
          const maxZ = m.center[2] + m.size[2] / 2;

          expect(minX).toBeGreaterThanOrEqual(-halfHW - EPS);
          expect(maxX).toBeLessThanOrEqual(halfHW + EPS);
          expect(minY).toBeGreaterThanOrEqual(-halfHH - EPS);
          expect(maxY).toBeLessThanOrEqual(halfHH + EPS);
          expect(minZ).toBeGreaterThanOrEqual(-halfHL - EPS);
          expect(maxZ).toBeLessThanOrEqual(halfHL + EPS);
        }
      });

      it(`${spec.name}: 炮塔模块(方向机、高低机、待发弹架)均在炮塔碰撞盒范围内`, () => {
        const halfTW = spec.turret.width / 2;
        const turretH = spec.turret.height;
        const halfTL = spec.turret.length / 2;
        const tOffset = spec.turret.offset ?? 0;

        const turretModules = spec.internals.modules.filter((m) => m.part === 'turret');
        for (const m of turretModules) {
          const minX = m.center[0] - m.size[0] / 2;
          const maxX = m.center[0] + m.size[0] / 2;
          const minY = m.center[1] - m.size[1] / 2;
          const maxY = m.center[1] + m.size[1] / 2;
          const minZ = m.center[2] - m.size[2] / 2;
          const maxZ = m.center[2] + m.size[2] / 2;

          expect(minX).toBeGreaterThanOrEqual(-halfTW - EPS);
          expect(maxX).toBeLessThanOrEqual(halfTW + EPS);
          expect(minY).toBeGreaterThanOrEqual(-EPS);
          expect(maxY).toBeLessThanOrEqual(turretH + EPS);
          expect(minZ).toBeGreaterThanOrEqual(-halfTL + tOffset - EPS);
          expect(maxZ).toBeLessThanOrEqual(halfTL + tOffset + EPS);
        }
      });

      it(`${spec.name}: 火炮部件(炮管、炮闩)长度与范围合理`, () => {
        const barrel = spec.internals.modules.find((m) => m.id === 'barrel')!;
        expect(barrel).toBeDefined();
        expect(barrel.part).toBe('gun');
        expect(barrel.size[2]).toBeCloseTo(spec.turret.barrelLength, 2);
        // 炮管沿 -Z 伸出
        expect(barrel.center[2]).toBeCloseTo(-spec.turret.barrelLength / 2, 2);

        const breech = spec.internals.modules.find((m) => m.id === 'breech')!;
        expect(breech).toBeDefined();
        expect(breech.part).toBe('gun');
        // 炮闩在炮耳轴后方 (+Z)
        expect(breech.center[2]).toBeGreaterThan(0);
      });
    }
  });

  describe('弹药架容量与取弹顺序', () => {
    for (const spec of USA_VEHICLES) {
      it(`${spec.name}: 弹药架总容量与主武器弹药总数严格一致`, () => {
        const ammoModules = spec.internals.modules.filter((m) => m.type === 'ammo');
        const totalCapacity = ammoModules.reduce((sum, m) => sum + (m.capacity ?? 0), 0);

        // 主武器弹药总容量
        const weaponCapacity = spec.id === 'm4a3e2' ? 104 : 71;
        expect(totalCapacity).toBe(weaponCapacity);
      });

      it(`${spec.name}: 待发弹架 drawOrder=1(无水套),底板湿式弹药箱带有 wet 标记且 drawOrder 靠后`, () => {
        const ready = spec.internals.modules.find((m) => m.id === 'ammo_ready');
        expect(ready).toBeDefined();
        expect(ready!.drawOrder).toBe(1);
        expect(ready!.wet).toBeFalsy();

        const floorL = spec.internals.modules.find((m) => m.id === 'ammo_floor_l');
        expect(floorL).toBeDefined();
        expect(floorL!.wet).toBe(true);
        expect(floorL!.drawOrder).toBe(2);

        const floorR = spec.internals.modules.find((m) => m.id === 'ammo_floor_r');
        expect(floorR).toBeDefined();
        expect(floorR!.wet).toBe(true);
        expect(floorR!.drawOrder).toBe(3);
      });
    }
  });

  describe('模块 ID 唯一性', () => {
    for (const spec of USA_VEHICLES) {
      it(`${spec.name}: 同一辆车内所有模块 ID 唯一`, () => {
        const ids = spec.internals.modules.map((m) => m.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });
    }
  });

  describe('同类模块盒子互不重叠', () => {
    function boxesOverlap(
      b1: { min: [number, number, number]; max: [number, number, number] },
      b2: { min: [number, number, number]; max: [number, number, number] },
      eps = 1e-4,
    ): boolean {
      const overlapX = Math.min(b1.max[0], b2.max[0]) - Math.max(b1.min[0], b2.min[0]);
      const overlapY = Math.min(b1.max[1], b2.max[1]) - Math.max(b1.min[1], b2.min[1]);
      const overlapZ = Math.min(b1.max[2], b2.max[2]) - Math.max(b1.min[2], b2.min[2]);
      return overlapX > eps && overlapY > eps && overlapZ > eps;
    }

    function moduleToBoxInHullFrame(
      m: ModuleSpec,
      spec: VehicleSpec,
    ): { min: [number, number, number]; max: [number, number, number] } {
      let cx = m.center[0];
      let cy = m.center[1];
      let cz = m.center[2];

      if (m.part === 'turret') {
        cy += spec.hull.height / 2;
        cz += spec.turret.offset ?? 0;
      } else if (m.part === 'gun') {
        // gun 原点在 (0, turret.height / 2, -turret.length / 2)
        cy += spec.hull.height / 2 + spec.turret.height / 2;
        cz += (spec.turret.offset ?? 0) - spec.turret.length / 2;
      }

      return {
        min: [cx - m.size[0] / 2, cy - m.size[1] / 2, cz - m.size[2] / 2],
        max: [cx + m.size[0] / 2, cy + m.size[1] / 2, cz + m.size[2] / 2],
      };
    }

    for (const spec of USA_VEHICLES) {
      it(`${spec.name}: 任意两个同类模块的盒子互不重叠`, () => {
        const modules = spec.internals.modules;
        const byType = new Map<string, ModuleSpec[]>();

        for (const m of modules) {
          const list = byType.get(m.type) ?? [];
          list.push(m);
          byType.set(m.type, list);
        }

        for (const [type, list] of byType.entries()) {
          if (list.length < 2) continue;
          for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
              const b1 = moduleToBoxInHullFrame(list[i], spec);
              const b2 = moduleToBoxInHullFrame(list[j], spec);
              const overlap = boxesOverlap(b1, b2);
              expect(overlap, `模块 ${list[i].id} 与 ${list[j].id} (类型 ${type}) 重叠`).toBe(false);
            }
          }
        }
      });
    }
  });

  describe('三车差异化参数体现', () => {
    it('M4A3E2 Jumbo 炮塔更宽,火炮为 75mm M3(较小炮闩与较短炮管)', () => {
      expect(M4A3E2.turret.width).toBeGreaterThan(M4A3_76W.turret.width);
      expect(M4A3E2.turret.barrelLength).toBeLessThan(M4A3_76W.turret.barrelLength);

      const breechE2 = M4A3E2.internals.modules.find((m) => m.id === 'breech')!;
      const breech76W = M4A3_76W.internals.modules.find((m) => m.id === 'breech')!;
      expect(breechE2.size[2]).toBeLessThan(breech76W.size[2]);

      // Jumbo 炮塔待发架为 4 发,76W 为 6 发
      const readyE2 = M4A3E2.internals.modules.find((m) => m.id === 'ammo_ready')!;
      const ready76W = M4A3_76W.internals.modules.find((m) => m.id === 'ammo_ready')!;
      expect(readyE2.capacity).toBe(4);
      expect(ready76W.capacity).toBe(6);

      // Jumbo 炮塔内部炮手和装填手横向站位随更宽炮塔向外扩展
      const gunnerE2 = M4A3E2.internals.crew.find((c) => c.role === 'gunner')!;
      const gunner76W = M4A3_76W.internals.crew.find((c) => c.role === 'gunner')!;
      expect(gunnerE2.center[0]).toBeGreaterThan(gunner76W.center[0]);
    });

    it('M4A3E8 HVSS 采用宽履带,M4A3(76)W 采用 VVSS 标准履带', () => {
      const trackE8 = M4A3E8.internals.modules.find((m) => m.id === 'track_l')!;
      const track76W = M4A3_76W.internals.modules.find((m) => m.id === 'track_l')!;
      expect(trackE8.size[0]).toBeCloseTo(0.58, 2);
      expect(track76W.size[0]).toBeCloseTo(0.42, 2);
      expect(trackE8.size[0]).toBeGreaterThan(track76W.size[0]);
    });

    it('M4A3E2 采用 T48 加鸭嘴加宽端联器履带', () => {
      const trackE2 = M4A3E2.internals.modules.find((m) => m.id === 'track_l')!;
      expect(trackE2.size[0]).toBeCloseTo(0.51, 2);
    });
  });
});
