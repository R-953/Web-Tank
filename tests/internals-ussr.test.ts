import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { AttachPart, CrewRole, ModuleType, VehicleSpec } from '../src/data/types';
import { T34_85, SU_100, ISU_122 } from '../src/data/vehicles';
import { DamageModel } from '../src/game/damage/DamageModel';
import { VehicleFrames } from '../src/game/damage/geometry';

interface Box3D {
  min: [number, number, number];
  max: [number, number, number];
}

function moduleAabb(center: readonly [number, number, number], size: readonly [number, number, number]): Box3D {
  return {
    min: [center[0] - size[0] / 2, center[1] - size[1] / 2, center[2] - size[2] / 2],
    max: [center[0] + size[0] / 2, center[1] + size[1] / 2, center[2] + size[2] / 2],
  };
}

function boxesOverlap(a: Box3D, b: Box3D, eps = 1e-4): boolean {
  const overlapX = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
  const overlapY = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
  const overlapZ = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
  return overlapX > eps && overlapY > eps && overlapZ > eps;
}

/** 把任意局部坐标系下的轴对齐盒子转换到车体坐标系(零偏转下仍为轴对齐盒) */
function boxToHull(frames: VehicleFrames, part: AttachPart, center: readonly [number, number, number], size: readonly [number, number, number]): Box3D {
  const c = frames.pointToHull(part, new THREE.Vector3(center[0], center[1], center[2]));
  return {
    min: [c.x - size[0] / 2, c.y - size[1] / 2, c.z - size[2] / 2],
    max: [c.x + size[0] / 2, c.y + size[1] / 2, c.z + size[2] / 2],
  };
}

const USSR_VEHICLES: Array<{
  spec: VehicleSpec;
  crewCount: number;
  expectedRoles: CrewRole[];
  ammoTotal: number;
}> = [
  {
    spec: T34_85,
    crewCount: 5,
    expectedRoles: ['driver', 'radio', 'gunner', 'commander', 'loader'],
    ammoTotal: 55,
  },
  {
    spec: SU_100,
    crewCount: 4,
    expectedRoles: ['driver', 'gunner', 'commander', 'loader'],
    ammoTotal: 33,
  },
  {
    spec: ISU_122,
    crewCount: 5,
    expectedRoles: ['driver', 'gunner', 'commander', 'loader', 'loader'],
    ammoTotal: 30,
  },
];

describe('苏联车辆内构细化测试(T-34-85、SU-100、ISU-122)', () => {
  for (const { spec, crewCount, expectedRoles, ammoTotal } of USSR_VEHICLES) {
    describe(spec.name, () => {
      it('乘员人数与岗位集合正确', () => {
        const { crew } = spec.internals;
        expect(crew).toHaveLength(crewCount);

        const roles = crew.map((c) => c.role);
        expect(roles.sort()).toEqual([...expectedRoles].sort());

        // SU-100 与 ISU-122 没有航向机枪手，不应包含 radio
        if (spec.id === 'su_100' || spec.id === 'isu_122') {
          expect(roles).not.toContain('radio');
        }
        // ISU-122 有两名装填手(第一装填手 + 第二装填手/闩手)
        if (spec.id === 'isu_122') {
          const loaders = crew.filter((c) => c.role === 'loader');
          expect(loaders).toHaveLength(2);
        }
      });

      it('每个乘员的 center 在所属部件盒内', () => {
        const { hull, turret } = spec;
        for (const c of spec.internals.crew) {
          const [x, y, z] = c.center;
          if (c.part === 'hull') {
            expect(Math.abs(x)).toBeLessThanOrEqual(hull.width / 2 + 1e-4);
            expect(Math.abs(y)).toBeLessThanOrEqual(hull.height / 2 + 1e-4);
            expect(Math.abs(z)).toBeLessThanOrEqual(hull.length / 2 + 1e-4);
          } else if (c.part === 'turret') {
            expect(Math.abs(x)).toBeLessThanOrEqual(turret.width / 2 + 1e-4);
            // 炮塔坐标系 y 原点在座圈/车顶，向上为正，高度在 [0, turret.height] 之间
            expect(y).toBeGreaterThanOrEqual(-1e-4);
            expect(y).toBeLessThanOrEqual(turret.height + 1e-4);
            expect(Math.abs(z)).toBeLessThanOrEqual(turret.length / 2 + 1e-4);
          }
        }
      });

      it('每个模块的盒子在所属部件范围内(炮与炮管放宽到炮管长度)', () => {
        const { hull, turret } = spec;
        for (const m of spec.internals.modules) {
          const aabb = moduleAabb(m.center, m.size);
          if (m.part === 'hull') {
            expect(aabb.min[0]).toBeGreaterThanOrEqual(-hull.width / 2 - 1e-4);
            expect(aabb.max[0]).toBeLessThanOrEqual(hull.width / 2 + 1e-4);
            expect(aabb.min[1]).toBeGreaterThanOrEqual(-hull.height / 2 - 1e-4);
            expect(aabb.max[1]).toBeLessThanOrEqual(hull.height / 2 + 1e-4);
            expect(aabb.min[2]).toBeGreaterThanOrEqual(-hull.length / 2 - 1e-4);
            expect(aabb.max[2]).toBeLessThanOrEqual(hull.length / 2 + 1e-4);
          } else if (m.part === 'turret') {
            expect(aabb.min[0]).toBeGreaterThanOrEqual(-turret.width / 2 - 1e-4);
            expect(aabb.max[0]).toBeLessThanOrEqual(turret.width / 2 + 1e-4);
            expect(aabb.min[1]).toBeGreaterThanOrEqual(-1e-4);
            expect(aabb.max[1]).toBeLessThanOrEqual(turret.height + 1e-4);
            expect(aabb.min[2]).toBeGreaterThanOrEqual(-turret.length / 2 - 1e-4);
            expect(aabb.max[2]).toBeLessThanOrEqual(turret.length / 2 + 1e-4);
          } else if (m.part === 'gun') {
            if (m.type === 'barrel') {
              expect(aabb.min[2]).toBeGreaterThanOrEqual(-turret.barrelLength - 1e-4);
              expect(aabb.max[2]).toBeLessThanOrEqual(1e-4);
            } else if (m.type === 'breech') {
              expect(aabb.min[2]).toBeGreaterThanOrEqual(-1e-4);
              expect(aabb.max[2]).toBeLessThanOrEqual(turret.length);
            }
          }
        }
      });

      it('弹药架总容量与原载弹量一致，且取弹顺序有效', () => {
        const ammoModules = spec.internals.modules.filter((m) => m.type === 'ammo');
        expect(ammoModules.length).toBeGreaterThan(0);

        const totalCapacity = ammoModules.reduce((sum, m) => sum + (m.capacity ?? 0), 0);
        expect(totalCapacity).toBe(ammoTotal);

        // 验证 DamageModel 中的 ammoCapacity
        const dm = new DamageModel(spec);
        expect(dm.ammoCapacity).toBe(ammoTotal);

        // 验证 drawOrder 从 1 开始，不重复
        const orders = ammoModules.map((m) => m.drawOrder).filter((o): o is number => o !== undefined);
        expect(orders).toHaveLength(ammoModules.length);
        expect(new Set(orders).size).toBe(orders.length);
        orders.sort((a, b) => a - b);
        expect(orders[0]).toBe(1);
      });

      it('模块 id 在同一辆车内唯一', () => {
        const ids = spec.internals.modules.map((m) => m.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
      });

      it('任意两个同类模块的盒子不重叠', () => {
        const frames = new VehicleFrames(spec, 0, 0);
        const byType = new Map<ModuleType, typeof spec.internals.modules>();

        for (const m of spec.internals.modules) {
          const list = byType.get(m.type) ?? [];
          list.push(m);
          byType.set(m.type, list);
        }

        for (const [type, modules] of byType.entries()) {
          for (let i = 0; i < modules.length; i++) {
            for (let j = i + 1; j < modules.length; j++) {
              const m1 = modules[i];
              const m2 = modules[j];

              // 统一投影到车体坐标系进行三维求交
              const box1 = boxToHull(frames, m1.part, m1.center, m1.size);
              const box2 = boxToHull(frames, m2.part, m2.center, m2.size);

              const overlaps = boxesOverlap(box1, box2);
              if (overlaps) {
                // 输出详细错误信息便于定位
                expect.fail(
                  `同类模块 ${type} 发生空间重叠: [${m1.id}] (${m1.part}) 与 [${m2.id}] (${m2.part})`,
                );
              }
              expect(overlaps).toBe(false);
            }
          }
        }
      });

      it('DamageModel 正常加载所有乘员与模块，且各关键模块齐备', () => {
        const dm = new DamageModel(spec);
        expect(dm.crew).toHaveLength(crewCount);
        expect(dm.modules.some((m) => m.type === 'engine')).toBe(true);
        expect(dm.modules.some((m) => m.type === 'transmission')).toBe(true);
        expect(dm.modules.some((m) => m.type === 'traverse')).toBe(true);
        expect(dm.modules.some((m) => m.type === 'elevation')).toBe(true);
        expect(dm.modules.some((m) => m.type === 'breech')).toBe(true);
        expect(dm.modules.some((m) => m.type === 'barrel')).toBe(true);
        expect(dm.modules.filter((m) => m.type === 'fuel').length).toBeGreaterThanOrEqual(4);
        expect(dm.modules.filter((m) => m.type === 'ammo').length).toBeGreaterThanOrEqual(4);
      });
    });
  }
});
