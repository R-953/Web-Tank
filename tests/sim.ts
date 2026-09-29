/** 物理校验用的小型模拟工具(测试与报告共用) */
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { ShellSpec, VehicleSpec } from '../src/data/types';
import { Projectile } from '../src/game/Projectile';
import { GameMap } from '../src/game/Map';
import { Vehicle, idleControls, type VehicleControls } from '../src/game/Vehicle';
import { flatMap } from './fixtures';

export const DT = 1 / 60;

export interface FlightSample {
  range: number;
  time: number;
  speed: number;
  penetration: number;
  /** 相对发射高度的下坠,m */
  drop: number;
}

/**
 * 在空旷的世界里水平发射一发炮弹(按游戏里的 60Hz 固定步),
 * 记录飞过各个距离时的弹速、穿深、飞行时间和下坠(相邻两步之间线性插值)。
 */
export function flyShell(shell: ShellSpec, ranges: number[]): FlightSample[] {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const origin = new THREE.Vector3(0, 1000, 0);
  const p = new Projectile('test', null, shell, origin, new THREE.Vector3(0, 0, -1));
  const out: FlightSample[] = [];
  const sorted = [...ranges].sort((a, b) => a - b);
  let t = 0;
  let prev = { range: 0, time: 0, speed: shell.muzzleVelocity, penetration: p.penetration, drop: 0 };
  while (out.length < sorted.length && t < 10) {
    p.step(DT, world);
    t += DT;
    const cur = { range: -p.position.z, time: t, speed: p.velocity.length(), penetration: p.penetration, drop: origin.y - p.position.y };
    while (out.length < sorted.length && cur.range >= sorted[out.length]) {
      const r = sorted[out.length];
      const k = (r - prev.range) / (cur.range - prev.range);
      const lerp = (a: number, b: number) => a + (b - a) * k;
      out.push({
        range: r,
        time: lerp(prev.time, cur.time),
        speed: lerp(prev.speed, cur.speed),
        penetration: lerp(prev.penetration, cur.penetration),
        drop: lerp(prev.drop, cur.drop),
      });
    }
    prev = cur;
  }
  world.free();
  return out;
}

/** 平地驾驶台架:4km 见方的平地上放一辆车 */
export function drivingRig(spec: VehicleSpec) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  new GameMap(flatMap({ vehicleId: spec.id, position: [0, 0], heading: 0 }, [], 4000), world);
  const v = new Vehicle('v', spec, world, new THREE.Vector3(0, spec.hull.height / 2 + 0.3, 0), 0);
  return rig(world, v);
}

/** 坡道台架:沿 -Z 方向上升、坡度 slopeDeg 的长坡,车头朝上坡方向 */
export function slopeRig(spec: VehicleSpec, slopeDeg: number) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (slopeDeg * Math.PI) / 180);
  const ramp = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 1, 200).setFriction(0.9), ramp);
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const pos = normal.clone().multiplyScalar(1 + spec.hull.height / 2 + 0.05);
  const v = new Vehicle('v', spec, world, pos, 0);
  v.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  const upSlope = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  return { ...rig(world, v), upSlope };
}

function rig(world: RAPIER.World, v: Vehicle) {
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
  const speed = () => {
    const l = v.body.linvel();
    return Math.hypot(l.x, l.y, l.z);
  };
  return { world, v, step, run, speed };
}

/**
 * 与 Vehicle.longitudinalSpeed 同一个方程,用 1ms 步长独立数值积分,
 * 返回满油门从静止加速到 targetKmh 所需时间(用来核对游戏内 60Hz 积分)。
 */
export function referenceAccelTime(spec: VehicleSpec, targetKmh: number, rollingResistance: number): number {
  const c = rollingResistance * 9.81;
  const vMax = spec.maxSpeed / 3.6;
  const target = targetKmh / 3.6;
  const h = 1e-3;
  let v = 0;
  let t = 0;
  while (v < target && t < 600) {
    const traction = Math.min(spec.hull.acceleration, (c * vMax) / Math.max(v, 0.05));
    v = Math.min(vMax, v + Math.max(0, traction - c) * h);
    t += h;
  }
  return t;
}
