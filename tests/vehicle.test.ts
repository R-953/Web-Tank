import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GameMap } from '../src/game/Map';
import { REVERSE_SPEED_RATIO, Vehicle, idleControls, type VehicleControls } from '../src/game/Vehicle';
import { FixedStepper } from '../src/engine/FixedStepper';
import { SHOOTER, flatMap } from './fixtures';

const DT = 1 / 60;
const DEG = Math.PI / 180;

beforeAll(async () => {
  await RAPIER.init();
});

function setup() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  // 4km 见方的平地,满油门开一分钟也碰不到边界墙
  new GameMap(flatMap({ vehicleId: 'shooter', position: [0, 0], heading: 0 }, [], 4000), world);
  const v = new Vehicle('v', SHOOTER, world, new THREE.Vector3(0, SHOOTER.hull.height / 2 + 0.3, 0), 0);
  const step = (controls: Partial<VehicleControls> = {}) => {
    v.controls = { ...idleControls(), ...controls };
    const req = v.fixedUpdate(DT, world)[0] ?? null;
    world.timestep = DT;
    world.step();
    v.capturePose();
    return req;
  };
  const run = (seconds: number, controls: Partial<VehicleControls> = {}) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) step(controls);
  };
  run(0.5); // 落地
  return { world, v, step, run };
}

const horizontalSpeed = (v: Vehicle) => {
  const l = v.body.linvel();
  return Math.hypot(l.x, l.z);
};

describe('载具驾驶', () => {
  it('油门全开:速度只增不减、从不超过最高速度,并逐渐逼近最高速度', () => {
    const { v, step } = setup();
    const max = SHOOTER.maxSpeed / 3.6;
    let prev = 0;
    let monotonic = true;
    let peak = 0;
    for (let i = 0; i < 60 * 60; i++) {
      step({ throttle: 1 });
      const s = horizontalSpeed(v);
      if (s < prev - 1e-3) monotonic = false;
      prev = s;
      peak = Math.max(peak, s);
    }
    expect(monotonic).toBe(true);
    expect(peak).toBeLessThanOrEqual(max + 0.05);
    expect(horizontalSpeed(v)).toBeGreaterThan(max * 0.97);
    // 确实朝车头(-Z)方向开出去了
    expect(v.physicsPosition().z).toBeLessThan(-100);
  });

  it('松开油门后会停下(回归:旧实现的力会跨帧累加,松手后还在加速)', () => {
    const { v, run } = setup();
    run(3, { throttle: 1 });
    run(6);
    expect(horizontalSpeed(v)).toBeLessThan(0.05);
  });

  it('倒车最高速度 = maxSpeed × REVERSE_SPEED_RATIO', () => {
    const { v, run } = setup();
    run(10, { throttle: -1 });
    expect(horizontalSpeed(v)).toBeCloseTo((SHOOTER.maxSpeed / 3.6) * REVERSE_SPEED_RATIO, 1);
    expect(v.physicsPosition().z).toBeGreaterThan(5);
  });

  it('转向:按住时达到 turnRate,松开后停止旋转', () => {
    const { v, run } = setup();
    run(1, { steer: 1 });
    expect(v.body.angvel().y).toBeCloseTo(SHOOTER.hull.turnRate * DEG, 2);
    run(1);
    expect(Math.abs(v.body.angvel().y)).toBeLessThan(0.01);
  });

  it('模拟结果与刷新率无关(30Hz 与 144Hz 走完 2 秒位置一致)', () => {
    const results: number[] = [];
    for (const hz of [30, 144]) {
      const { v, step } = setup();
      const stepper = new FixedStepper(DT);
      for (let f = 0; f < 2 * hz; f++) stepper.advance(1 / hz, () => step({ throttle: 1, steer: 0.3 }));
      results.push(v.physicsPosition().z);
    }
    expect(results[0]).toBeCloseTo(results[1], 4);
  });
});

describe('炮塔与开火', () => {
  it('炮塔按 turretRotationSpeed 转向瞄准点', () => {
    const { v, run } = setup();
    // 瞄准正右方(+X):目标炮塔角 -90°
    const aimPoint = new THREE.Vector3(100, 2, 0);
    run(1, { aimPoint });
    expect(v.turretYaw / DEG).toBeCloseTo(-SHOOTER.turretRotationSpeed, 0);
    run(2, { aimPoint });
    expect(v.turretYaw / DEG).toBeCloseTo(-90, 1);
  });

  it('装填完成前不能再次开火', () => {
    const { step } = setup();
    let shots = 0;
    for (let i = 0; i < 60; i++) if (step({ fire: true })) shots++; // 1 秒,装填 0.5 秒
    expect(shots).toBe(2);
  });

  it('炮弹从炮口沿炮管方向射出', () => {
    const { v, step } = setup();
    const req = step({ fire: true });
    expect(req).not.toBeNull();
    const { origin, dir } = req!;
    expect(dir.z).toBeLessThan(-0.99); // 炮塔朝车头 -Z
    const center = v.physicsPosition();
    expect(center.z - origin.z).toBeGreaterThan(SHOOTER.turret.length / 2 + SHOOTER.turret.barrelLength - 0.1);
  });
});
