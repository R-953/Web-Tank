import * as THREE from 'three';
import type { Vec2 } from '../data/types';
import { AI } from '../data/ai';
import { REVERSE_SPEED_RATIO, idleControls, type Vehicle, type VehicleControls } from './Vehicle';

/** 非玩家载具的控制器:每个固定步给出控制输入 */
export interface VehicleController {
  update(vehicle: Vehicle): VehicleControls;
}

/** 静止靶 */
export class StaticController implements VehicleController {
  update(): VehicleControls {
    return idleControls();
  }
}

/**
 * 匀速往返巡逻:朝车头方向开到终点,再倒车回起点(车身朝向不变,侧面始终朝同一边)。
 * 不需要任何智能,只用来验证战斗闭环。
 */
export class PatrolController implements VehicleController {
  private readonly a: THREE.Vector3;
  private readonly b: THREE.Vector3;
  private readonly axis: THREE.Vector3;
  private readonly length: number;
  private towardB = true;

  constructor(from: Vec2, to: Vec2, private readonly speedKmh: number) {
    this.a = new THREE.Vector3(from[0], 0, from[1]);
    this.b = new THREE.Vector3(to[0], 0, to[1]);
    this.axis = this.b.clone().sub(this.a);
    this.length = this.axis.length();
    this.axis.normalize();
  }

  update(vehicle: Vehicle): VehicleControls {
    const pos = vehicle.physicsPosition().setY(0);
    const along = pos.sub(this.a).dot(this.axis);
    if (this.towardB && along >= this.length) this.towardB = false;
    else if (!this.towardB && along <= 0) this.towardB = true;

    // 车头是否朝向 b:决定「去 b」是前进还是倒车
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(vehicle.physicsQuaternion()).setY(0).normalize();
    const facesB = fwd.dot(this.axis) >= 0;
    const forward = this.towardB === facesB;

    const maxForward = vehicle.spec.maxSpeed;
    const throttle = forward
      ? Math.min(1, this.speedKmh / maxForward)
      : -Math.min(1, this.speedKmh / (maxForward * REVERSE_SPEED_RATIO));
    return { throttle, steer: 0, aimPoint: null, fire: false, sightRange: 0 };
  }
}

/** 还击 AI 需要从对局里读取的信息 */
export interface AIContext {
  player: Vehicle;
  /** 已模拟的游戏时间,秒 */
  time: number;
  /** from 的炮塔能否看到 to(地形、障碍物、其他车都会挡) */
  lineOfSight(from: Vehicle, to: Vehicle): boolean;
  rng: () => number;
}

/**
 * 简单的还击 AI:只负责炮塔和开火,车体移动交给巡逻 / 静止控制器。
 *   - 玩家进入 alertRange 且有视线,或者自己被打中 / 被近弹惊动 → 进入交战状态;
 *   - 交战距离内有视线:转炮塔对准玩家(带移动提前量),按「真实距离 ×(1 ± 估距误差)」设表尺;
 *   - 瞄准 aimTime 秒、炮管对准、装填完毕就开火;每打一发修正一次估距误差。
 */
export class GunnerAI {
  alerted = false;
  private hasLos = false;
  private nextLosCheck = 0;
  private acquiredAt = -1;
  private aimDelay = 0;
  private rangeError = 0;
  private readonly aimOffset = new THREE.Vector3();

  constructor(private readonly params: typeof AI = AI) {}

  /** 被玩家打中,或玩家的炮弹落在附近 */
  alert(): void {
    this.alerted = true;
  }

  update(self: Vehicle, ctx: AIContext, base: VehicleControls): VehicleControls {
    const p = this.params;
    const target = ctx.player;
    if (self.isDead || target.isDead) return base;
    const myPos = self.physicsPosition();
    const targetPos = target.physicsPosition();
    const dist = myPos.distanceTo(targetPos);
    if (dist > p.engageRange && !this.alerted) return base;

    if (ctx.time >= this.nextLosCheck) {
      this.nextLosCheck = ctx.time + p.losInterval;
      const los = ctx.lineOfSight(self, target);
      if (los && !this.hasLos) this.acquire(ctx);
      this.hasLos = los;
      if (los && dist <= p.alertRange) this.alerted = true;
    }
    if (!this.alerted || !this.hasLos || dist > p.engageRange) return base;

    // 瞄准点:目标中心 + 随机偏移 + 移动提前量(按平均弹速估飞行时间)
    const shell = self.activeShell;
    const flight = shell ? dist / (shell.muzzleVelocity * 0.9) : 0;
    const v = target.body.linvel();
    const aimPoint = targetPos
      .clone()
      .add(this.aimOffset)
      .add(new THREE.Vector3(v.x, 0, v.z).multiplyScalar(flight));
    const sightRange = Math.max(0, dist * (1 + this.rangeError));

    const { origin, dir } = self.boresight();
    const want = aimPoint.clone().sub(origin).normalize();
    const aligned = dir.angleTo(want) < (p.alignTolerance * Math.PI) / 180;
    const ready = ctx.time - this.acquiredAt >= this.aimDelay;
    const fire = aligned && ready && !!self.loaded;
    if (fire) {
      // 看到落点后修正估距,下一发换个瞄准点
      this.rangeError *= p.correction;
      this.rollAimOffset(ctx.rng);
    }
    return { ...base, aimPoint, sightRange, fire };
  }

  private acquire(ctx: AIContext): void {
    const p = this.params;
    this.acquiredAt = ctx.time;
    this.aimDelay = p.aimTime[0] + (p.aimTime[1] - p.aimTime[0]) * ctx.rng();
    this.rangeError = (ctx.rng() * 2 - 1) * p.rangeError;
    this.rollAimOffset(ctx.rng);
  }

  private rollAimOffset(rng: () => number): void {
    const s = this.params.aimSpread;
    this.aimOffset.set((rng() * 2 - 1) * s, (rng() * 2 - 1) * s * 0.5 + 0.3, (rng() * 2 - 1) * s);
  }
}
