import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { ShellSpec, VehicleSpec } from '../src/data/types';
import { STUG_III_G, SU_100, TIGER_II } from '../src/data/vehicles';
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

describe('StuG III G / SU-100:固定战斗室实车', () => {
  for (const spec of [STUG_III_G, SU_100]) {
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

describe('穿深曲线对照资料(Bird & Livingston 计算值 / 苏方 80% 判据表,容差 3%)', () => {
  const cases: Array<[string, ShellSpec, Array<[number, number]>]> = [
    ['Pzgr.39(StuK 40 L/48)', shell(STUG_III_G, 'pzgr39'), [[100, 135], [500, 123], [1000, 109]]],
    ['Pzgr.40(StuK 40 L/48)', shell(STUG_III_G, 'pzgr40'), [[100, 176], [500, 154], [1000, 130]]],
    ['BR-412(D-10S)', shell(SU_100, 'br412'), [[500, 160], [1000, 150]]],
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
    for (const s of [shell(STUG_III_G, 'pzgr39'), shell(SU_100, 'br412')]) {
      expect(flyShell(s, [500])[0].penetration).toBeGreaterThan(TIGER_II.armor.side);
    }
  });
});
