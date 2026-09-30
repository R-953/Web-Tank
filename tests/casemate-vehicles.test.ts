import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { ShellSpec, VehicleSpec } from '../src/data/types';
import { ISU_122, SU_100, TIGER_II } from '../src/data/vehicles';
import type { Vehicle } from '../src/game/Vehicle';
import { drivingRig, flyShell } from './sim';

const DEG = Math.PI / 180;

beforeAll(async () => {
  await RAPIER.init();
});

function heading(v: Vehicle): number {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(v.physicsQuaternion());
  return Math.atan2(-f.x, -f.z);
}

function aimError(v: Vehicle, target: THREE.Vector3): number {
  const { origin, dir } = v.boresight();
  const want = target.clone().sub(origin).setY(0);
  return (dir.clone().setY(0).angleTo(want) * 180) / Math.PI;
}

const shell = (spec: VehicleSpec, id: string): ShellSpec => spec.weapons[0].ammo.find((a) => a.id === id)!;

describe('SU-100 / ISU-122:固定战斗室实车', () => {
  for (const spec of [SU_100, ISU_122]) {
    it(`${spec.name}:目标在正左侧 400 m,车体自动转过去对准,火炮不超出射界`, () => {
      const { v, run } = drivingRig(spec);
      run(0.5);
      const target = new THREE.Vector3(-400, 1.5, 0);
      run(20, { aimPoint: target });
      const [left, right] = spec.turret.traverse!;
      expect(heading(v)).toBeGreaterThan(70 * DEG);
      expect(aimError(v, target)).toBeLessThan(0.5);
      expect(v.turretYaw).toBeLessThanOrEqual(left * DEG + 1e-6);
      expect(v.turretYaw).toBeGreaterThanOrEqual(-right * DEG - 1e-6);
    });
  }
});

describe('穿深曲线对照资料(苏方判据表:Shirokorad 等,容差 3%)', () => {
  const cases: Array<[string, ShellSpec, Array<[number, number]>]> = [
    ['BR-412(D-10S)', shell(SU_100, 'br412'), [[500, 160], [1000, 150]]],
    ['BR-471(A-19S)', shell(ISU_122, 'br471'), [[500, 150], [1000, 130], [1500, 115], [2000, 100]]],
    ['BR-471B(A-19S)', shell(ISU_122, 'br471b'), [[500, 155], [1000, 145], [1500, 135], [2000, 125]]],
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

  it('两门炮的穿甲弹在 500 m 都能打穿虎王侧面(80 mm 垂直)', () => {
    for (const s of [shell(SU_100, 'br412'), shell(ISU_122, 'br471')]) {
      expect(flyShell(s, [500])[0].penetration).toBeGreaterThan(TIGER_II.armor.side);
    }
  });
});
