import * as THREE from 'three';
import type { AttachPart, Vec3, VehicleSpec } from '../../data/types';
import { isCasemate } from '../casemate';

const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

/** 轴对齐盒(在所属坐标系内) */
export interface LocalBox {
  part: AttachPart;
  center: THREE.Vector3;
  half: THREE.Vector3;
}

export function localBox(part: AttachPart, center: Vec3, size: Vec3): LocalBox {
  return {
    part,
    center: new THREE.Vector3(center[0], center[1], center[2]),
    half: new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2),
  };
}

/** 射线与轴对齐盒求交(slab 法)。dir 须为单位向量。起点在盒内时 tEnter < 0。 */
export function rayBox(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  center: THREE.Vector3,
  half: THREE.Vector3,
): { tEnter: number; tExit: number } | null {
  let tMin = -Infinity;
  let tMax = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    const o = origin[axis] - center[axis];
    const d = dir[axis];
    const h = half[axis];
    if (Math.abs(d) < 1e-12) {
      if (o < -h || o > h) return null;
      continue;
    }
    let t1 = (-h - o) / d;
    let t2 = (h - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  if (tMax < 0) return null;
  return { tEnter: tMin, tExit: tMax };
}

export function boxContains(p: THREE.Vector3, center: THREE.Vector3, half: THREE.Vector3, eps = 1e-6): boolean {
  return (
    Math.abs(p.x - center.x) <= half.x + eps &&
    Math.abs(p.y - center.y) <= half.y + eps &&
    Math.abs(p.z - center.z) <= half.z + eps
  );
}

/** 点到轴对齐盒的距离(在盒内为 0) */
export function pointBoxDistance(p: THREE.Vector3, center: THREE.Vector3, half: THREE.Vector3): number {
  const dx = Math.max(Math.abs(p.x - center.x) - half.x, 0);
  const dy = Math.max(Math.abs(p.y - center.y) - half.y, 0);
  const dz = Math.max(Math.abs(p.z - center.z) - half.z, 0);
  return Math.hypot(dx, dy, dz);
}

/**
 * 载具的三个坐标系(车体 / 炮塔 / 火炮)之间的变换,取决于当前炮塔角和俯仰角。
 * 与 Vehicle 的节点层级一致:炮塔座圈在车顶中心,炮耳轴在炮塔正面中部。
 * 固定战斗室车辆:「炮塔」(战斗室)不转,水平角加在火炮上(绕炮耳轴先转水平、再俯仰)。
 */
export class VehicleFrames {
  private readonly toHull: Record<AttachPart, THREE.Matrix4>;
  private readonly fromHull: Record<AttachPart, THREE.Matrix4>;

  constructor(readonly spec: VehicleSpec, readonly turretYaw: number, readonly gunPitch: number) {
    const casemate = isCasemate(spec);
    const turretOffset = new THREE.Vector3(0, spec.hull.height / 2, 0);
    const gunOffset = new THREE.Vector3(0, spec.turret.height / 2, -spec.turret.length / 2);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, turretYaw);
    const pitch = new THREE.Quaternion().setFromAxisAngle(RIGHT, gunPitch);
    const turret = new THREE.Matrix4().compose(turretOffset, casemate ? new THREE.Quaternion() : yaw, new THREE.Vector3(1, 1, 1));
    const gunLocal = new THREE.Matrix4().compose(
      gunOffset,
      casemate ? yaw.clone().multiply(pitch) : pitch,
      new THREE.Vector3(1, 1, 1),
    );
    const gun = turret.clone().multiply(gunLocal);
    this.toHull = { hull: new THREE.Matrix4(), turret, gun };
    this.fromHull = { hull: new THREE.Matrix4(), turret: turret.clone().invert(), gun: gun.clone().invert() };
  }

  /** 把某坐标系下的点转到车体坐标 */
  pointToHull(part: AttachPart, p: THREE.Vector3): THREE.Vector3 {
    return p.clone().applyMatrix4(this.toHull[part]);
  }

  pointFromHull(part: AttachPart, p: THREE.Vector3): THREE.Vector3 {
    return p.clone().applyMatrix4(this.fromHull[part]);
  }

  dirFromHull(part: AttachPart, d: THREE.Vector3): THREE.Vector3 {
    return d.clone().transformDirection(this.fromHull[part]);
  }

  /** 该坐标系在车体坐标下的旋转 */
  partQuaternion(part: AttachPart): THREE.Quaternion {
    const q = new THREE.Quaternion();
    this.toHull[part].decompose(new THREE.Vector3(), q, new THREE.Vector3());
    return q;
  }

  /** 车体坐标下的射线与某个局部盒求交 */
  intersect(box: LocalBox, origin: THREE.Vector3, dir: THREE.Vector3): { tEnter: number; tExit: number } | null {
    return rayBox(this.pointFromHull(box.part, origin), this.dirFromHull(box.part, dir), box.center, box.half);
  }

  contains(box: LocalBox, p: THREE.Vector3, eps = 1e-6): boolean {
    return boxContains(this.pointFromHull(box.part, p), box.center, box.half, eps);
  }

  distance(box: LocalBox, p: THREE.Vector3): number {
    return pointBoxDistance(this.pointFromHull(box.part, p), box.center, box.half);
  }

  /** 车内空间 = 车体盒 ∪ 炮塔盒 */
  interiorBoxes(): LocalBox[] {
    const { hull, turret } = this.spec;
    return [
      localBox('hull', [0, 0, 0], [hull.width, hull.height, hull.length]),
      localBox('turret', [0, turret.height / 2, 0], [turret.width, turret.height, turret.length]),
    ];
  }

  /** 从车内一点沿 dir 走到离开车内空间的距离(可以从车体穿进炮塔再出去),不超过 maxT */
  interiorExit(origin: THREE.Vector3, dir: THREE.Vector3, maxT: number): number {
    const boxes = this.interiorBoxes();
    let t = 0;
    for (let i = 0; i < 4; i++) {
      const p = origin.clone().addScaledVector(dir, t);
      let exit = -1;
      for (const b of boxes) {
        if (!this.contains(b, p, 1e-4)) continue;
        const hit = this.intersect(b, p, dir);
        if (hit) exit = Math.max(exit, hit.tExit);
      }
      if (exit < 0) return Math.min(t, maxT);
      t += exit + 1e-4;
      if (t >= maxT) return maxT;
    }
    return Math.min(t, maxT);
  }
}

/** 可复现的伪随机数(mulberry32),回放和测试需要结果稳定 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 以 axis 为轴、半角 halfAngle(弧度)的圆锥内均匀取一个方向 */
export function randomInCone(axis: THREE.Vector3, halfAngle: number, rng: () => number): THREE.Vector3 {
  const cosMax = Math.cos(halfAngle);
  const cosT = 1 - rng() * (1 - cosMax);
  const sinT = Math.sqrt(1 - cosT * cosT);
  const phi = rng() * Math.PI * 2;
  const a = axis.clone().normalize();
  const helper = Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(a, helper).normalize();
  const v = new THREE.Vector3().crossVectors(a, u);
  return a
    .multiplyScalar(cosT)
    .addScaledVector(u, sinT * Math.cos(phi))
    .addScaledVector(v, sinT * Math.sin(phi))
    .normalize();
}
