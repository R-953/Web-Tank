import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { VehicleSpec } from '../src/data/types';
import { autoSteer, clampYaw, isCasemate, yawLimits } from '../src/game/casemate';
import { VehicleFrames } from '../src/game/damage/geometry';
import type { Vehicle } from '../src/game/Vehicle';
import { SHOOTER } from './fixtures';
import { drivingRig } from './sim';

const DEG = Math.PI / 180;

/** 测试用固定战斗室车:射界左 10° / 右 12°(故意不对称,好检查正负号) */
const CASEMATE: VehicleSpec = { ...SHOOTER, id: 'casemate', turret: { ...SHOOTER.turret, traverse: [10, 12] } };

beforeAll(async () => {
  await RAPIER.init();
});

/** 车头朝向,弧度,0 = 北(−Z),正值向左 */
function heading(v: Vehicle): number {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(v.physicsQuaternion());
  return Math.atan2(-f.x, -f.z);
}

/** 炮管指向与「炮口 → 目标」的夹角,度 */
function aimError(v: Vehicle, target: THREE.Vector3): number {
  const { origin, dir } = v.boresight();
  const want = target.clone().sub(origin);
  want.y = 0;
  const flat = dir.clone().setY(0);
  return (flat.angleTo(want) * 180) / Math.PI;
}

describe('固定战斗室:射界换算', () => {
  it('只有设了 traverse 的车才是固定战斗室;射界换成弧度,向左为正', () => {
    expect(isCasemate(SHOOTER)).toBe(false);
    expect(yawLimits(SHOOTER)).toBeNull();
    expect(isCasemate(CASEMATE)).toBe(true);
    const [min, max] = yawLimits(CASEMATE)!;
    expect(min).toBeCloseTo(-12 * DEG, 9);
    expect(max).toBeCloseTo(10 * DEG, 9);
  });

  it('水平角夹进射界;炮塔车不受限', () => {
    expect(clampYaw(CASEMATE, 30 * DEG)).toBeCloseTo(10 * DEG, 9);
    expect(clampYaw(CASEMATE, -30 * DEG)).toBeCloseTo(-12 * DEG, 9);
    expect(clampYaw(CASEMATE, 5 * DEG)).toBeCloseTo(5 * DEG, 9);
    expect(clampYaw(SHOOTER, 2)).toBe(2);
  });

  it('自动转向:射界内为 0,向左超出向左转、向右超出向右转,超出越多转得越快,最多打满', () => {
    expect(autoSteer(CASEMATE, 0)).toBe(0);
    expect(autoSteer(CASEMATE, 9 * DEG)).toBe(0);
    expect(autoSteer(CASEMATE, 13 * DEG)).toBeGreaterThan(0);
    expect(autoSteer(CASEMATE, 13 * DEG)).toBeLessThan(1);
    expect(autoSteer(CASEMATE, 90 * DEG)).toBe(1);
    expect(autoSteer(CASEMATE, -15 * DEG)).toBeLessThan(0);
    expect(autoSteer(CASEMATE, -170 * DEG)).toBe(-1);
    expect(autoSteer(SHOOTER, 90 * DEG)).toBe(0);
  });

  it('坐标系:战斗室不随水平角转,火炮绕炮耳轴转;炮塔车的炮塔照旧跟着转', () => {
    const yaw = 8 * DEG;
    const cm = new VehicleFrames(CASEMATE, yaw, 0);
    const tr = new VehicleFrames(SHOOTER, yaw, 0);
    const probe = new THREE.Vector3(0, 0, -1);
    // 战斗室上的点不动
    const still = new VehicleFrames(CASEMATE, 0, 0).pointToHull('turret', probe);
    expect(cm.pointToHull('turret', probe).distanceTo(still)).toBeLessThan(1e-9);
    // 炮塔车的炮塔会转
    expect(tr.pointToHull('turret', probe).distanceTo(new VehicleFrames(SHOOTER, 0, 0).pointToHull('turret', probe))).toBeGreaterThan(0.05);
    // 火炮原点(炮耳轴)在战斗室正面不动,炮管方向向左转了 yaw
    const pivot0 = new VehicleFrames(CASEMATE, 0, 0).pointToHull('gun', new THREE.Vector3());
    expect(cm.pointToHull('gun', new THREE.Vector3()).distanceTo(pivot0)).toBeLessThan(1e-9);
    const muzzleDir = cm.pointToHull('gun', new THREE.Vector3(0, 0, -1)).sub(pivot0);
    expect(Math.atan2(-muzzleDir.x, -muzzleDir.z)).toBeCloseTo(yaw, 9);
  });
});

describe('固定战斗室:整局瞄准', () => {
  it('瞄准点在正左侧:车体自动左转,最后炮管对准目标,火炮不超出射界', () => {
    const { v, run } = drivingRig(CASEMATE);
    run(0.5);
    const target = new THREE.Vector3(-400, 1, 0); // 出生时车头朝北(−Z),目标在正左
    run(15, { aimPoint: target });
    expect(heading(v)).toBeGreaterThan(75 * DEG);
    expect(aimError(v, target)).toBeLessThan(0.5);
    expect(v.turretYaw).toBeLessThanOrEqual(10 * DEG + 1e-6);
    expect(v.turretYaw).toBeGreaterThanOrEqual(-12 * DEG - 1e-6);
  });

  it('瞄准点在正右侧:向右转(射界不对称也不影响方向)', () => {
    const { v, run } = drivingRig(CASEMATE);
    run(0.5);
    const target = new THREE.Vector3(400, 1, 0);
    run(15, { aimPoint: target });
    expect(heading(v)).toBeLessThan(-75 * DEG);
    expect(aimError(v, target)).toBeLessThan(0.5);
  });

  it('瞄准点在射界内:车体不动,只转火炮', () => {
    const { v, run } = drivingRig(CASEMATE);
    run(0.5);
    const h0 = heading(v);
    const target = new THREE.Vector3(-500 * Math.tan(6 * DEG), 1, -500); // 偏左 6°
    run(5, { aimPoint: target });
    expect(Math.abs(heading(v) - h0)).toBeLessThan(0.2 * DEG);
    expect(v.turretYaw).toBeGreaterThan(5 * DEG);
    expect(aimError(v, target)).toBeLessThan(0.5);
  });

  it('按了转向键就以玩家为准:瞄准点在左边,按右转仍然右转', () => {
    const { v, run } = drivingRig(CASEMATE);
    run(0.5);
    run(3, { aimPoint: new THREE.Vector3(-400, 1, 0), steer: -1 });
    expect(heading(v)).toBeLessThan(-10 * DEG);
  });

  it('炮塔车不受影响:瞄准点在正左侧,车体不转,炮塔转过去', () => {
    const { v, run } = drivingRig(SHOOTER);
    run(0.5);
    const h0 = heading(v);
    const target = new THREE.Vector3(-400, 1, 0);
    run(15, { aimPoint: target });
    expect(Math.abs(heading(v) - h0)).toBeLessThan(0.2 * DEG);
    expect(v.turretYaw).toBeGreaterThan(80 * DEG);
    expect(aimError(v, target)).toBeLessThan(0.5);
  });

  it('canTraverseTo:固定战斗室只在射界内为真;炮塔车总是真(AI 据此决定要不要停车转向)', () => {
    const cm = drivingRig(CASEMATE);
    cm.run(0.5);
    expect(cm.v.canTraverseTo(new THREE.Vector3(0, 1, -500))).toBe(true);
    expect(cm.v.canTraverseTo(new THREE.Vector3(-400, 1, 0))).toBe(false);
    const tr = drivingRig(SHOOTER);
    tr.run(0.5);
    expect(tr.v.canTraverseTo(new THREE.Vector3(-400, 1, 0))).toBe(true);
  });
});
