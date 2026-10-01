import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { VehicleSpec } from '../src/data/types';
import { defaultBindings, findConflicts } from '../src/data/controls';
import { FreeLook } from '../src/engine/FreeLook';
import type { Vehicle } from '../src/game/Vehicle';
import { SHOOTER } from './fixtures';
import { M4A3_76W } from '../src/data/vehicles';
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

describe('受控差速器固定半径转向(谢尔曼)', () => {
  it('谢尔曼静止时按住转向 3 秒,航向变化 < 1°(不能原地转)', () => {
    const { v, run } = drivingRig(M4A3_76W);
    run(0.5);
    const h0 = heading(v);
    run(3, { throttle: 0, steer: 1 });
    const h1 = heading(v);
    expect(Math.abs(h1 - h0)).toBeLessThan(1 * DEG);
  });

  it('未设 turnRadius 的车仍能原地转(其他车行为不变)', () => {
    const { h } = drive(SHOOTER, { throttle: 0, steer: -1 }, 1.5);
    expect(h).toBeLessThan(-5 * DEG);
  });

  it('以 10 km/h 行驶时的转弯半径在 19 m 直径 ±15% 以内', () => {
    const { v, run, step } = drivingRig(M4A3_76W);
    run(0.5);
    const throttle10 = 10 / M4A3_76W.maxSpeed;
    // 先行驶并进入转向稳态
    run(2, { throttle: throttle10, steer: 1 });

    // 瞬时运动学直径: 2 * v / omega
    const speed = v.body.linvel();
    const linearSpeed = Math.hypot(speed.x, speed.z);
    const yawRate = Math.abs(v.body.angvel().y);
    const kinematicDiameter = (2 * linearSpeed) / yawRate;
    expect(kinematicDiameter).toBeGreaterThanOrEqual(19 * 0.85);
    expect(kinematicDiameter).toBeLessThanOrEqual(19 * 1.15);

    // 轨迹实测直径: 沿圆周运动采样
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < Math.round(25 / (1 / 60)); i++) {
      step({ throttle: throttle10, steer: 1 });
      const p = v.physicsPosition();
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
    }
    const pathDiameter = maxX - minX;
    expect(pathDiameter).toBeGreaterThanOrEqual(19 * 0.85);
    expect(pathDiameter).toBeLessThanOrEqual(19 * 1.15);
  });
});

