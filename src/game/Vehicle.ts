import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Loadout, ShellSpec, VehicleSpec, WeaponSpec } from '../data/types';
import { REFERENCE_ROLLING_RESISTANCE, SURFACES, type SurfaceSpec } from '../data/surfaces';
import { buildVehicleModel } from './models';
import { DamageModel } from './damage/DamageModel';
import { VehicleFrames } from './damage/geometry';
import { superelevation } from './Ballistics';

const DEG2RAD = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);
const RIGHT = new THREE.Vector3(1, 0, 0);

const G = 9.81;
/**
 * 基准滚动阻力系数(硬地面),阻力减速度 = 系数 × g。驾驶模型用它从 maxSpeed 反推有效功率:
 * 在硬地面上跑到最高速度时,牵引力刚好等于滚动阻力。实际阻力按脚下地表取(data/surfaces.ts)。
 */
export const ROLLING_RESISTANCE = REFERENCE_ROLLING_RESISTANCE;
/** 倒车最高速度 = maxSpeed × 该比例(二战坦克倒车一般在 5–10 km/h) */
export const REVERSE_SPEED_RATIO = 0.2;
/** 反向操作(刹车)的减速度,m/s²,约 0.5g */
export const BRAKE_DECEL = 5;
/** 松开油门后的滑行减速度(滚动阻力 + 发动机制动),m/s² */
export const COAST_DECEL = 1.5;
/** 没有油门且速度低于该值时直接刹停(驻车制动),m/s */
const PARKING_SPEED = 1;
/** 履带抗侧滑能力,m/s²(约 0.8g) */
const LATERAL_GRIP_ACCEL = 8;
/**
 * 碰撞体的等效密度,kg/m³:车体盒 + 炮塔盒体积 × 该密度 ≈ 战斗全重
 * (虎式约 57 t;T-34-85 偏重约 20%,虎王偏重约 7%,见 docs/physics-validation.md)。
 */
export const VEHICLE_DENSITY = 1110;
/** 转向角加速度 = 最大转向速度 × 该系数(每秒) */
const TURN_RESPONSE = 6;
/** 接地检测:车体底面以下多远还算着地,m */
const GROUND_PROBE = 0.35;
/** 车体翻到 up.y 小于该值就不再响应驾驶输入 */
const MIN_UPRIGHT = 0.35;
/** 刚体角阻尼(抑制颠簸);设定转向速度时会补偿掉它,保证实际转速等于数据里的 turnRate */
const ANGULAR_DAMPING = 0.8;
/** 炮管完全损坏前的最大额外散布(1σ),毫弧度:散布 = (1 − 炮管效率) × 该值 */
const BARREL_DAMAGE_DISPERSION_MRAD = 3;

export interface VehicleControls {
  /** -1 倒车 .. 1 前进 */
  throttle: number;
  /** -1 右转 .. 1 左转 */
  steer: number;
  /** 世界坐标瞄准点,null = 炮塔保持不动 */
  aimPoint: THREE.Vector3 | null;
  fire: boolean;
  /** 表尺距离,m:火炮在瞄准线基础上按射表抬高,0 = 不抬高 */
  sightRange: number;
}

export const idleControls = (): VehicleControls => ({ throttle: 0, steer: 0, aimPoint: null, fire: false, sightRange: 0 });

export interface FireRequest {
  weapon: WeaponSpec;
  shell: ShellSpec;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
}

/** 可被炮弹直接命中的碰撞体 */
export type VehiclePart = 'hull' | 'turret' | 'barrel';

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function rotateTowardsAngle(current: number, target: number, maxDelta: number): number {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxDelta) return wrapAngle(target);
  return wrapAngle(current + Math.sign(diff) * maxDelta);
}

/**
 * 数据驱动的载具:车体是 Rapier 动态刚体,驾驶用「直接设定目标速度」的方式,
 * 不用 addForce(Rapier 的力会跨步累加,旧实现因此失控)。
 * 炮塔 / 火炮按方向机 / 高低机速度追随瞄准点(表尺距离决定额外抬高)。
 * 伤害由 DamageModel 管理:模块受损按比例降低性能,乘员不足或弹药殉爆即被摧毁。
 */
export class Vehicle {
  readonly root = new THREE.Group();
  readonly turretPivot = new THREE.Group();
  readonly gunPivot = new THREE.Group();
  readonly body: RAPIER.RigidBody;
  readonly hullCollider: RAPIER.Collider;
  readonly turretCollider: RAPIER.Collider;
  /** 炮管命中框(传感器,只参与射线检测,不产生碰撞) */
  readonly barrelCollider: RAPIER.Collider;
  /** 模块 + 乘员状态,取代整车血量 */
  readonly damage: DamageModel;

  controls: VehicleControls = idleControls();
  /** 炮塔相对车体的水平角,弧度,0 = 朝车头 */
  turretYaw = 0;
  /** 火炮俯仰角,弧度,正值 = 抬高 */
  gunPitch = 0;
  /** 距离下一发装填完成还剩多少秒(按满编装填计;实际速度乘 reloadRate) */
  reloadRemaining = 0;
  /** 当前选择的弹种(武器 ammo 列表的下标);下一次装填装这种弹 */
  selectedShell = 0;
  /** 炮膛里的弹:弹种 + 取自哪个弹药架(换弹种时退回去);null = 空膛 */
  loaded: { shell: ShellSpec; rack: string | null } | null = null;
  /** 脚下的地表(Game 每步按位置更新),决定滚动阻力和抓地 */
  surface: SurfaceSpec = SURFACES.grass;

  private wreck = false;
  private flashTimer = 0;
  private readonly materials: THREE.MeshStandardMaterial[];
  /** 炮塔旋转中心(车体本地坐标) */
  private readonly turretOffset: THREE.Vector3;
  /** 火炮耳轴(炮塔本地坐标) */
  private readonly gunOffset: THREE.Vector3;

  private readonly prevPos = new THREE.Vector3();
  private readonly currPos = new THREE.Vector3();
  private readonly prevQuat = new THREE.Quaternion();
  private readonly currQuat = new THREE.Quaternion();
  private prevTurretYaw = 0;
  private prevGunPitch = 0;
  private currTurretYaw = 0;
  private currGunPitch = 0;

  constructor(
    readonly id: string,
    readonly spec: VehicleSpec,
    world: RAPIER.World,
    position: THREE.Vector3,
    headingRad: number,
    loadout?: Loadout,
  ) {
    this.damage = new DamageModel(spec, loadout);
    // 出发时炮膛里已经有一发
    this.selectedShell = Math.max(0, (spec.weapons[0]?.ammo ?? []).findIndex((a) => this.damage.rounds(a.id) > 0));
    this.tryLoad();
    const { hull, turret } = spec;
    this.turretOffset = new THREE.Vector3(0, hull.height / 2, 0);
    this.gunOffset = new THREE.Vector3(0, turret.height / 2, -turret.length / 2);

    const q = new THREE.Quaternion().setFromAxisAngle(UP, headingRad);
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setAngularDamping(ANGULAR_DAMPING),
    );
    this.hullCollider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(hull.width / 2, hull.height / 2, hull.length / 2)
        .setDensity(VEHICLE_DENSITY)
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
      this.body,
    );
    this.turretCollider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(turret.width / 2, turret.height / 2, turret.length / 2)
        .setTranslation(0, hull.height / 2 + turret.height / 2, 0)
        .setDensity(VEHICLE_DENSITY)
        .setFriction(0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
      this.body,
    );
    this.barrelCollider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.1, 0.1, turret.barrelLength / 2).setSensor(true).setDensity(0),
      this.body,
    );
    this.updateBarrelCollider();

    this.turretPivot.position.copy(this.turretOffset);
    this.gunPivot.position.copy(this.gunOffset);
    this.root.add(this.turretPivot);
    this.turretPivot.add(this.gunPivot);
    this.materials = buildVehicleModel(spec, { root: this.root, turretPivot: this.turretPivot, gunPivot: this.gunPivot });
    this.root.name = `vehicle:${id}`;
    this.capturePose();
    this.capturePose();
    this.syncVisual(1);
  }

  /** 被摧毁(存活乘员不足或弹药殉爆) */
  get isDead(): boolean {
    return this.damage.knockedOut;
  }

  /** 当前炮塔角 / 俯仰角下的三个坐标系 */
  frames(): VehicleFrames {
    return new VehicleFrames(this.spec, this.turretYaw, this.gunPitch);
  }

  get primaryWeapon(): WeaponSpec | undefined {
    return this.spec.weapons[0];
  }

  /** 选中的弹种 */
  get selectedShellSpec(): ShellSpec | undefined {
    return this.primaryWeapon?.ammo[this.selectedShell];
  }

  /** 表尺 / 射表按这发弹算:膛里有弹就是它,否则是选中的弹种 */
  get activeShell(): ShellSpec | undefined {
    return this.loaded?.shell ?? this.selectedShellSpec;
  }

  /**
   * 切换弹种(War Thunder 的做法):膛里是别的弹种时退回弹药架,重新装填;
   * 正在装填时继续装,装好的是新选的弹种。
   */
  selectShell(index: number): boolean {
    const ammo = this.primaryWeapon?.ammo ?? [];
    if (index < 0 || index >= ammo.length || index === this.selectedShell || this.isDead) return false;
    this.selectedShell = index;
    if (this.loaded && this.loaded.shell.id !== ammo[index].id) {
      this.damage.returnRound(this.loaded.shell.id, this.loaded.rack);
      this.loaded = null;
      this.reloadRemaining = this.primaryWeapon!.reloadTime;
    }
    return true;
  }

  /** 装填完成时从弹药架取一发选中的弹;没有这种弹了就空着 */
  private tryLoad(): void {
    const shell = this.selectedShellSpec;
    if (this.loaded || !shell || this.reloadRemaining > 0) return;
    const rack = this.damage.takeRound(shell.id);
    if (rack !== null) this.loaded = { shell, rack };
  }

  /** 沿车头方向的速度,m/s(倒车为负) */
  get forwardSpeed(): number {
    const v = this.body.linvel();
    const fwd = FORWARD.clone().applyQuaternion(this.physicsQuaternion());
    return v.x * fwd.x + v.y * fwd.y + v.z * fwd.z;
  }

  physicsPosition(out = new THREE.Vector3()): THREE.Vector3 {
    const t = this.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  physicsQuaternion(out = new THREE.Quaternion()): THREE.Quaternion {
    const r = this.body.rotation();
    return out.set(r.x, r.y, r.z, r.w);
  }

  /** 部件在世界坐标下的朝向(用于把命中法线转到本地坐标) */
  partQuaternion(part: VehiclePart, out = new THREE.Quaternion()): THREE.Quaternion {
    this.physicsQuaternion(out);
    if (part === 'turret' || part === 'barrel') out.multiply(new THREE.Quaternion().setFromAxisAngle(UP, this.turretYaw));
    if (part === 'barrel') out.multiply(new THREE.Quaternion().setFromAxisAngle(RIGHT, this.gunPitch));
    return out;
  }

  /** 世界坐标 → 车体本地坐标 */
  worldToHull(p: THREE.Vector3): THREE.Vector3 {
    return p.clone().sub(this.physicsPosition()).applyQuaternion(this.physicsQuaternion().invert());
  }

  worldDirToHull(d: THREE.Vector3): THREE.Vector3 {
    return d.clone().applyQuaternion(this.physicsQuaternion().invert());
  }

  /** 固定步更新:驾驶、炮塔、装填。满足开火条件时返回开火请求。 */
  fixedUpdate(dt: number, world: RAPIER.World): FireRequest | null {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.setEmissive(0x000000);
    }
    if (this.isDead) {
      this.becomeWreck();
      return null;
    }
    // 装填:只有还有这种弹时才推进;速度受炮闩和装填手(或兼任的炮手)效率影响
    if (!this.loaded && this.selectedShellSpec && this.damage.rounds(this.selectedShellSpec.id) > 0) {
      this.reloadRemaining = Math.max(0, this.reloadRemaining - dt * this.damage.reloadRate);
      this.tryLoad();
    }

    this.drive(dt, world);
    this.aimTurret(dt);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, this.turretYaw);
    this.turretCollider.setRotationWrtParent({ x: yawQ.x, y: yawQ.y, z: yawQ.z, w: yawQ.w });
    this.updateBarrelCollider();

    const weapon = this.primaryWeapon;
    if (this.controls.fire && weapon && this.loaded && this.damage.canFire) {
      const shell = this.loaded.shell;
      this.loaded = null;
      this.reloadRemaining = weapon.reloadTime;
      const { origin, dir } = this.muzzle();
      // 炮管受损 → 散布变大
      const sigma = (1 - this.damage.barrelFactor) * BARREL_DAMAGE_DISPERSION_MRAD * 1e-3;
      if (sigma > 0) {
        const g = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
        dir.add(new THREE.Vector3(g() * sigma, g() * sigma, g() * sigma)).normalize();
      }
      return { weapon, shell, origin, dir };
    }
    return null;
  }

  /**
   * 炮手瞄准镜在世界中的位置(按渲染插值后的姿态,相机用)。
   * 瞄准镜装在炮耳轴左侧、随火炮俯仰,和 TZF / TSh 系列的布置一致。
   */
  sightWorldPosition(out = new THREE.Vector3()): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.gunPivot.localToWorld(out.set(-0.4, 0.15, -0.1));
  }

  /** 炮口位置与指向(按物理状态计算,不受渲染插值影响) */
  muzzle(): { origin: THREE.Vector3; dir: THREE.Vector3 } {
    const q = this.physicsQuaternion();
    const qTurret = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, this.turretYaw));
    const qGun = qTurret.clone().multiply(new THREE.Quaternion().setFromAxisAngle(RIGHT, this.gunPitch));
    const pivot = this.physicsPosition()
      .add(this.turretOffset.clone().applyQuaternion(q))
      .add(this.gunOffset.clone().applyQuaternion(qTurret));
    const dir = FORWARD.clone().applyQuaternion(qGun);
    const origin = pivot.addScaledVector(dir, this.spec.turret.barrelLength);
    return { origin, dir };
  }

  /**
   * 炮管的"瞄准线":扣掉表尺给出的抬高量后的指向。炮塔追上准星时,它和准星重合,
   * HUD 用它画火炮指示圈(直接用炮管指向的话,远距离表尺下圈会飘在目标上方)。
   */
  boresight(): { origin: THREE.Vector3; dir: THREE.Vector3 } {
    const { origin, dir } = this.muzzle();
    const shell = this.activeShell;
    const lift = shell ? superelevation(shell, this.controls.sightRange) : 0;
    if (lift !== 0) {
      const axis = RIGHT.clone().applyQuaternion(
        this.physicsQuaternion().multiply(new THREE.Quaternion().setFromAxisAngle(UP, this.turretYaw)),
      );
      dir.applyAxisAngle(axis, -lift);
    }
    return { origin, dir };
  }

  /** 被击穿时闪一下 */
  flashHit(): void {
    this.flashTimer = 0.12;
    this.setEmissive(0x662200);
  }

  /** 被摧毁后变成残骸(变黑、恢复摩擦、不再响应控制) */
  becomeWreck(): void {
    if (this.wreck) return;
    this.wreck = true;
    this.controls = idleControls();
    this.materials.forEach((m) => m.color.multiplyScalar(0.25));
    this.hullCollider.setFriction(1);
    this.turretCollider.setFriction(1);
    this.hullCollider.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average);
  }

  private updateBarrelCollider(): void {
    const qYaw = new THREE.Quaternion().setFromAxisAngle(UP, this.turretYaw);
    const qGun = qYaw.clone().multiply(new THREE.Quaternion().setFromAxisAngle(RIGHT, this.gunPitch));
    const center = this.turretOffset
      .clone()
      .add(this.gunOffset.clone().applyQuaternion(qYaw))
      .add(new THREE.Vector3(0, 0, -this.spec.turret.barrelLength / 2).applyQuaternion(qGun));
    this.barrelCollider.setTranslationWrtParent({ x: center.x, y: center.y, z: center.z });
    this.barrelCollider.setRotationWrtParent({ x: qGun.x, y: qGun.y, z: qGun.z, w: qGun.w });
  }

  /** world.step 之后调用,记录插值用的前后两帧 */
  capturePose(): void {
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
    this.prevTurretYaw = this.currTurretYaw;
    this.prevGunPitch = this.currGunPitch;
    this.physicsPosition(this.currPos);
    this.physicsQuaternion(this.currQuat);
    this.currTurretYaw = this.turretYaw;
    this.currGunPitch = this.gunPitch;
  }

  syncVisual(alpha: number): void {
    this.root.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.root.quaternion.slerpQuaternions(this.prevQuat, this.currQuat, alpha);
    this.turretPivot.rotation.y = this.prevTurretYaw + wrapAngle(this.currTurretYaw - this.prevTurretYaw) * alpha;
    this.gunPivot.rotation.x = this.prevGunPitch + (this.currGunPitch - this.prevGunPitch) * alpha;
  }

  private drive(dt: number, world: RAPIER.World): void {
    const q = this.physicsQuaternion();
    const up = UP.clone().applyQuaternion(q);
    if (up.y < MIN_UPRIGHT) return;

    const t = this.body.translation();
    const probe = new RAPIER.Ray(t, { x: -up.x, y: -up.y, z: -up.z });
    const ground = world.castRay(
      probe,
      this.spec.hull.height / 2 + GROUND_PROBE,
      true,
      undefined,
      undefined,
      undefined,
      this.body,
    );
    if (!ground) return;

    const fwd = FORWARD.clone().applyQuaternion(q);
    const right = RIGHT.clone().applyQuaternion(q);
    const lv = this.body.linvel();
    const v = new THREE.Vector3(lv.x, lv.y, lv.z);
    const fwdSpeed = v.dot(fwd);
    const latSpeed = v.dot(right);
    const rest = v.clone().addScaledVector(fwd, -fwdSpeed).addScaledVector(right, -latSpeed);

    const canDrive = this.damage.canDrive;
    const throttle = canDrive ? THREE.MathUtils.clamp(this.controls.throttle, -1, 1) : 0;
    const newFwd = this.longitudinalSpeed(fwdSpeed, throttle, dt);
    const newLat = moveTowards(latSpeed, 0, LATERAL_GRIP_ACCEL * this.surface.grip * dt);
    const nv = rest.addScaledVector(fwd, newFwd).addScaledVector(right, newLat);
    this.body.setLinvel({ x: nv.x, y: nv.y, z: nv.z }, true);

    const maxYawRate = this.spec.hull.turnRate * DEG2RAD * (canDrive ? Math.min(this.damage.mobilityFactor, this.damage.trackFactor) : 0);
    const av = this.body.angvel();
    const w = new THREE.Vector3(av.x, av.y, av.z);
    const wUp = w.dot(up);
    const targetYawRate = THREE.MathUtils.clamp(this.controls.steer, -1, 1) * maxYawRate;
    const turnAccel = this.spec.hull.turnRate * DEG2RAD * TURN_RESPONSE;
    const newWUp = moveTowards(wUp, targetYawRate, turnAccel * dt);
    // Rapier 每步按 v /= (1 + dt·damping) 衰减角速度,这里预先放大抵消
    w.addScaledVector(up, newWUp * (1 + dt * ANGULAR_DAMPING) - wUp);
    this.body.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
  }

  /**
   * 纵向速度更新(每个固定步):
   *   加速:牵引加速度 = min(hull.acceleration × 地表附着, P/m ÷ v),再减去脚下地表的滚动阻力;
   *         P/m(单位质量有效功率)由「硬地面上最高速度时牵引力 = 滚动阻力」反推,即 c₀ × maxSpeed,
   *         再乘发动机 × 传动 × 驾驶员的效率。低速时受附着力 / 低挡扭矩限制,高速时受功率限制;
   *         软地面(沙地、泥滩)阻力大,极速按 c₀ / c 下降,例如沙地 0.10 时减半。
   *   减速:反向操作按 max(BRAKE_DECEL, acceleration) 刹车;松油门按 COAST_DECEL 滑行,低速时驻车刹停。
   * 坡道上的重力分量由物理引擎施加,这里不重复计算,所以爬坡能力 ≈ asin((acceleration − c) / g)。
   */
  longitudinalSpeed(fwdSpeed: number, throttle: number, dt: number): number {
    const c0 = ROLLING_RESISTANCE * G;
    const c = this.surface.rollingResistance * G;
    const vMaxForward = this.spec.maxSpeed / 3.6;
    // 发动机 / 传动受损、驾驶员受伤 → 可用功率按比例下降(极速同比下降);履带受损 → 速度上限下降
    const power = this.damage.mobilityFactor;
    const cap = vMaxForward * Math.min(power, this.damage.trackFactor);
    const target = THREE.MathUtils.clamp(
      throttle >= 0 ? throttle * vMaxForward : throttle * vMaxForward * REVERSE_SPEED_RATIO,
      -cap * REVERSE_SPEED_RATIO,
      cap,
    );
    const direction = Math.sign(fwdSpeed) || Math.sign(target);
    const speedingUp = target !== 0 && Math.sign(target) === direction && Math.abs(target) >= Math.abs(fwdSpeed);
    if (speedingUp) {
      const powerPerMass = c0 * vMaxForward * power;
      const traction = Math.min(this.spec.hull.acceleration * power * this.surface.grip, powerPerMass / Math.max(Math.abs(fwdSpeed), 0.05));
      const accel = traction - c;
      // 功率不够克服阻力(例如高速开进沙地):按差值减速
      if (accel < 0) return fwdSpeed - direction * Math.min(Math.abs(fwdSpeed), -accel * dt);
      return moveTowards(fwdSpeed, target, accel * dt);
    }
    // 反向操作 / 驻车:制动器和发动机牵引一起用,取两者中较大的能力(坡道上溜车时靠它止住)
    const braking = (target !== 0 && Math.sign(target) !== direction) || (target === 0 && Math.abs(fwdSpeed) < PARKING_SPEED);
    const brakeDecel = Math.max(BRAKE_DECEL, this.spec.hull.acceleration);
    return moveTowards(fwdSpeed, target, Math.max(braking ? brakeDecel : COAST_DECEL, c) * dt);
  }

  private aimTurret(dt: number): void {
    const aim = this.controls.aimPoint;
    if (!aim) return;
    const qInv = this.physicsQuaternion().invert();
    const local = aim.clone().sub(this.physicsPosition()).applyQuaternion(qInv).sub(this.turretOffset);
    const desiredYaw = Math.atan2(-local.x, -local.z);
    const horizontal = Math.hypot(local.x, local.z);
    const [minElev, maxElev] = this.spec.turret.elevation;
    const shell = this.activeShell;
    const lift = shell ? superelevation(shell, this.controls.sightRange) : 0;
    const desiredPitch = THREE.MathUtils.clamp(
      Math.atan2(local.y - this.gunOffset.y, Math.max(0.01, horizontal)) + lift,
      minElev * DEG2RAD,
      maxElev * DEG2RAD,
    );
    // 方向机 / 高低机受损或炮手不在位 → 转速下降甚至转不动
    const yawStep = this.spec.turretRotationSpeed * DEG2RAD * dt * this.damage.traverseFactor;
    const pitchStep = this.spec.turret.elevationSpeed * DEG2RAD * dt * this.damage.elevationFactor;
    this.turretYaw = rotateTowardsAngle(this.turretYaw, desiredYaw, yawStep);
    this.gunPitch = moveTowards(this.gunPitch, desiredPitch, pitchStep);
  }

  private setEmissive(hex: number): void {
    this.materials.forEach((m) => m.emissive.setHex(hex));
  }
}
