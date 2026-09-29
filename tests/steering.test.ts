import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { VehicleSpec } from '../src/data/types';
import { defaultBindings, findConflicts } from '../src/data/controls';
import { FreeLook } from '../src/engine/FreeLook';
import type { Vehicle } from '../src/game/Vehicle';
import { SHOOTER } from './fixtures';
import { drivingRig } from './sim';

const DEG = Math.PI / 180;
const CASEMATE: VehicleSpec = { ...SHOOTER, id: 'casemate', turret: { ...SHOOTER.turret, traverse: [10, 10] } };

beforeAll(async () => {
  await RAPIER.init();
});

/** 车头朝向,弧度,0 = 北(−Z),正值 = 向左(朝 −X) */
function heading(v: Vehicle): number {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(v.physicsQuaternion());
  return Math.atan2(-f.x, -f.z);
}

/** 出生朝北:+X 在右边,+Z 在后面 */
function drive(spec: VehicleSpec, controls: { throttle: number; steer: number; aimPoint?: THREE.Vector3 }, seconds = 1.5) {
  const { v, run } = drivingRig(spec);
  run(0.5);
  const p0 = v.physicsPosition();
  run(seconds, controls);
  return { v, h: heading(v), d: v.physicsPosition().sub(p0) };
}

describe('转向键:前进 / 原地 / 倒车', () => {
  it('前进 W + D:车头右转,往右前方走', () => {
    const { h, d } = drive(SHOOTER, { throttle: 1, steer: -1 });
    expect(h).toBeLessThan(-5 * DEG);
    expect(d.x).toBeGreaterThan(0.5);
    expect(d.z).toBeLessThan(0);
  });

  it('原地只按 D:车头右转(和以前一样)', () => {
    const { h } = drive(SHOOTER, { throttle: 0, steer: -1 });
    expect(h).toBeLessThan(-5 * DEG);
  });

  it('倒车 S + D:向右后方倒,车头转向 −X(左)', () => {
    const { h, d } = drive(SHOOTER, { throttle: -1, steer: -1 });
    expect(h).toBeGreaterThan(5 * DEG);
    expect(d.x).toBeGreaterThan(0.2);
    expect(d.z).toBeGreaterThan(0);
  });

  it('倒车 S + A:向左后方倒,车头转向 +X(右)', () => {
    const { h, d } = drive(SHOOTER, { throttle: -1, steer: 1 });
    expect(h).toBeLessThan(-5 * DEG);
    expect(d.x).toBeLessThan(-0.2);
    expect(d.z).toBeGreaterThan(0);
  });

  it('固定战斗室倒车时的自动转向不反:瞄准点在左边,车头照样向左转过去', () => {
    const { h } = drive(CASEMATE, { throttle: -1, steer: 0, aimPoint: new THREE.Vector3(-400, 1, 0) }, 4);
    expect(h).toBeGreaterThan(20 * DEG);
  });
});

describe('自由视角', () => {
  it('按下时记住视角;按住期间视角可以随意改;松开后恢复', () => {
    const fl = new FreeLook();
    const view = { yaw: 0.3, pitch: -0.1 };
    expect(fl.update(false, view)).toBe(false);
    expect(fl.update(true, view)).toBe(true);
    view.yaw = 2.5;
    view.pitch = 0.2;
    expect(fl.update(true, view)).toBe(true);
    expect(view.yaw).toBe(2.5);
    expect(fl.update(false, view)).toBe(false);
    expect(view).toEqual({ yaw: 0.3, pitch: -0.1 });
  });

  it('reset 清掉状态,之后松开不会把视角拉回去', () => {
    const fl = new FreeLook();
    const view = { yaw: 1, pitch: 0 };
    fl.update(true, view);
    view.yaw = 2;
    fl.reset();
    expect(fl.active).toBe(false);
    fl.update(false, view);
    expect(view.yaw).toBe(2);
  });

  it('默认键位 C,和其他操作不冲突', () => {
    const b = defaultBindings();
    expect(b.freeLook).toEqual(['KeyC', null]);
    expect(findConflicts(b).size).toBe(0);
  });
});
