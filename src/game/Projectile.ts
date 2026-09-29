import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { ShellSpec } from '../data/types';
import { dragK } from '../data/shells';
import { shellPenetration } from './Damage';
import { buildShellModel } from './models/shell';

const GRAVITY = 9.81;
/**
 * 参考阻力参数 k(1/m):dv/dt = −k·|v|·v,8.8cm Pzgr.39 的值。每发炮弹实际用的 k 由弹重、口径和
 * 阻力系数算出(data/shells.ts 的 dragK);这个常量只作为 integrateBallistic 的缺省值。
 */
export const DRAG_K = 1.2e-4;
const MAX_AGE = 10;
// 曳光:从弹底向后拖出的发光条(曳光管在弹底)
const TRACER_LEN = 3.5;
const TRACER_GEO = new THREE.BoxGeometry(0.12, 0.12, TRACER_LEN).translate(0, 0, -TRACER_LEN / 2);
const TRACER_MAT = new THREE.MeshBasicMaterial({ color: 0xffb15a, transparent: true, opacity: 0.85, depthWrite: false });
const TRACER_AXIS = new THREE.Vector3(0, 0, 1);
/** 口径小于它(mm)的算枪弹:只画一根细曳光,不建弹体模型 */
export const SMALL_CALIBER = 20;
const BULLET_TRACER_LEN = 2.2;
const BULLET_TRACER_GEO = new THREE.BoxGeometry(0.035, 0.035, BULLET_TRACER_LEN).translate(0, 0, -BULLET_TRACER_LEN / 2);
const BULLET_TRACER_MAT = new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.9, depthWrite: false });
/** 枪弹最多飞行多久(之后已经没有杀伤力,也看不见了),秒 */
const BULLET_MAX_AGE = 4;

/**
 * 弹道积分一步:空气阻力(对 dv/dt = −k|v|v 的精确单步解)+ 重力;位移按步首、步末速度的平均值
 * (梯形积分),重力下的抛物线因此是精确的,60Hz 下 1000 m 下坠误差 < 0.1%。
 * 会原地修改 velocity,返回这一步的位移。游戏里的炮弹和表尺射表共用这一个函数。
 */
export function integrateBallistic(velocity: THREE.Vector3, dt: number, k = DRAG_K): THREE.Vector3 {
  const v0 = velocity.clone();
  const speed = v0.length();
  velocity.multiplyScalar(1 / (1 + k * speed * dt));
  velocity.y -= GRAVITY * dt;
  return v0.add(velocity).multiplyScalar(0.5 * dt);
}

export interface ProjectileHit {
  collider: RAPIER.Collider;
  point: THREE.Vector3;
  /** 命中面外法线(世界坐标) */
  normal: THREE.Vector3;
  /** 命中瞬间的弹道方向(世界坐标,单位向量) */
  dir: THREE.Vector3;
}

/**
 * 抛射体:自己积分弹道(受重力),每个固定步用射线扫描本步的位移段做命中检测。
 * 射线能直接拿到命中点和表面法线,入射角穿透判定需要它;高速炮弹也不会穿模。
 */
export class Projectile {
  /** 弹体实体模型 + 曳光,整体朝向飞行方向(+Z) */
  readonly mesh = new THREE.Group();
  readonly position: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  alive = true;
  /** 本发炮弹的阻力参数 k,1/m */
  readonly dragK: number;
  private age = 0;
  private readonly prevPos = new THREE.Vector3();
  private readonly currPos = new THREE.Vector3();

  constructor(
    readonly ownerId: string,
    private readonly ownerBody: RAPIER.RigidBody | null,
    readonly shell: ShellSpec,
    origin: THREE.Vector3,
    dir: THREE.Vector3,
  ) {
    if (this.isBullet) this.mesh.add(new THREE.Mesh(BULLET_TRACER_GEO, BULLET_TRACER_MAT));
    else this.mesh.add(buildShellModel(shell), new THREE.Mesh(TRACER_GEO, TRACER_MAT));
    this.dragK = dragK(shell);
    this.position = origin.clone();
    this.velocity = dir.clone().normalize().multiplyScalar(shell.muzzleVelocity);
    this.prevPos.copy(origin);
    this.currPos.copy(origin);
    this.syncVisual(1);
  }

  /** 推进一个固定步;命中则返回命中信息并标记为失效 */
  step(dt: number, world: RAPIER.World): ProjectileHit | null {
    if (!this.alive) return null;
    const disp = integrateBallistic(this.velocity, dt, this.dragK);
    const dist = disp.length();
    const dir = disp.clone().divideScalar(dist);

    const ray = new RAPIER.Ray(this.position, dir);
    const hit = world.castRayAndGetNormal(ray, dist, true, undefined, undefined, undefined, this.ownerBody ?? undefined);

    this.prevPos.copy(this.position);
    if (hit) {
      const point = this.position.clone().addScaledVector(dir, hit.timeOfImpact);
      this.position.copy(point);
      this.currPos.copy(point);
      this.alive = false;
      return {
        collider: hit.collider,
        point,
        normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
        dir: this.velocity.clone().normalize(),
      };
    }

    this.position.add(disp);
    this.currPos.copy(this.position);
    this.age += dt;
    if (this.age > (this.isBullet ? BULLET_MAX_AGE : MAX_AGE) || this.position.y < -100) this.alive = false;
    return null;
  }

  /** 枪弹(口径 < 20 mm) */
  get isBullet(): boolean {
    return this.shell.caliber < SMALL_CALIBER;
  }

  /**
   * 命中后继续飞(打断树干的动能弹):从命中点沿弹道前移 distance 米,速度乘 speedFactor。
   * 下一步的射线从新位置出发,不会再打到同一个碰撞体。
   */
  passThrough(distance: number, speedFactor: number): void {
    const dir = this.velocity.clone().normalize();
    this.position.addScaledVector(dir, distance);
    this.currPos.copy(this.position);
    this.velocity.multiplyScalar(speedFactor);
    this.alive = true;
  }

  /** 当前弹速下的穿深,mm(化学能弹与弹速无关) */
  get penetration(): number {
    return shellPenetration(this.shell, this.velocity.length());
  }

  syncVisual(alpha: number): void {
    this.mesh.position.lerpVectors(this.prevPos, this.currPos, alpha);
    const v = this.velocity;
    if (v.lengthSq() > 0) this.mesh.quaternion.setFromUnitVectors(TRACER_AXIS, v.clone().normalize());
  }
}
