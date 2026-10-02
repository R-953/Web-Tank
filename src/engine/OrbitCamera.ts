import * as THREE from 'three';

/** 第三人称视角的垂直视场,度 */
export const THIRD_PERSON_FOV = 70;
/**
 * 第三人称放大后的垂直视场,度。
 * 估算:按 2 倍放大取 70° 的一半。
 */
export const THIRD_PERSON_ZOOM_FOV = 35;
/**
 * 瞄准镜视场 ≈ 该值 / 倍率(度)。取自实物:TZF 9d 2.5× 视场 25°、5× 视场 12.5°;TSh-16 4× 视场 16°。
 */
export const SIGHT_FOV_AT_1X = 62.5;
/** 视场平滑过渡时间常数,秒(约 0.15 s 走完 90%) */
export const FOV_TAU = 0.06;
/** 单次 rotate() 最多转动的角度,弧度(防止异常的巨大鼠标位移把视角甩到背后) */
const MAX_STEP = 0.5;

/**
 * 相机:鼠标控制朝向,两种模式——
 *   third 第三人称:相机绕目标上方的枢轴点旋转;
 *   sight 炮手瞄准镜:相机放在瞄准镜位置,视场按倍率收窄,灵敏度随之降低。
 * 屏幕中心(准星)= 相机视线方向,游戏逻辑用 getAimRay() 取瞄准射线。
 */
export class OrbitCamera {
  /** 水平朝向,弧度,0 = 看向 -Z,正值向左 */
  yaw = 0;
  /** 俯仰,弧度,负值 = 向下看 */
  pitch = -0.12;
  distance = 14;
  /** 枢轴点相对目标的高度,让载具显示在准星下方 */
  pivotHeight = 3.5;
  sensitivity = 0.0022;
  minPitch = -0.7;
  maxPitch = 0.3;
  mode: 'third' | 'sight' = 'third';
  magnification = 1;
  private _thirdZoomed = false;
  private _displayFov: number;
  private _hasUpdated = false;
  private userSensitivity = { mouse: 1, sight: 1, scaleWithZoom: true, invertY: false };

  private readonly pivot = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {
    this._displayFov = this.fov;
  }

  /** 第三人称是否处于放大状态;setSight() / setThirdPerson() 时复位为 false */
  get thirdZoomed(): boolean {
    return this._thirdZoomed;
  }

  set thirdZoomed(val: boolean) {
    this.setThirdZoom(val);
  }

  /** 当前垂直目标视场,度 */
  get fov(): number {
    if (this.mode === 'sight') return SIGHT_FOV_AT_1X / this.magnification;
    return this._thirdZoomed ? THIRD_PERSON_ZOOM_FOV : THIRD_PERSON_FOV;
  }

  /** 当前显示视场,度 */
  get displayFov(): number {
    return this._displayFov;
  }

  /**
   * 将显示视场直接设为目标值,不做平滑过渡。
   * 构造时或场景重置时由调用方按需调用。
   */
  snapFov(): void {
    this._hasUpdated = true;
    this._displayFov = this.fov;
    this.camera.fov = this._displayFov;
    this.camera.updateProjectionMatrix();
  }

  setThirdPerson(): void {
    this.mode = 'third';
    this._thirdZoomed = false;
  }

  setSight(magnification: number): void {
    this.mode = 'sight';
    this._thirdZoomed = false;
    this.magnification = magnification;
  }

  /** 设置第三人称放大状态;开镜时调用无效果 */
  setThirdZoom(zoomed: boolean): void {
    if (this.mode === 'sight') return;
    if (this._thirdZoomed === zoomed) return;
    this._thirdZoomed = zoomed;
  }

  /** 第三人称下切换放大;开镜时调用无效果 */
  toggleThirdZoom(): void {
    this.setThirdZoom(!this._thirdZoomed);
  }

  /**
   * 玩家灵敏度设置:
   *   mouse 第三人称倍数;sight 开镜倍数;
   *   scaleWithZoom 开镜后再按视场缩放(放大越多转得越慢,屏幕上的移动速度与倍率无关——War Thunder 的默认手感);
   *     关掉时只按 1/√倍率 缩放,高倍镜下转得相对快一些;
   *   invertY 反转上下。
   */
  setSensitivity(s: { mouse: number; sight: number; scaleWithZoom: boolean; invertY: boolean }): void {
    this.userSensitivity = { ...s };
  }

  rotate(dx: number, dy: number): void {
    const u = this.userSensitivity;
    let k = this.sensitivity;
    const currentFov = this._hasUpdated ? this.displayFov : this.fov;
    if (this.mode === 'sight') {
      k *= u.sight * (u.scaleWithZoom ? currentFov / THIRD_PERSON_FOV : 1 / Math.sqrt(this.magnification));
    } else {
      k *= u.mouse * (u.scaleWithZoom ? currentFov / THIRD_PERSON_FOV : 1);
    }
    // 第二道保险:一次最多转 MAX_STEP(输入层已经过滤了尖峰)
    const dYaw = THREE.MathUtils.clamp(dx * k, -MAX_STEP, MAX_STEP);
    const dPitch = THREE.MathUtils.clamp(dy * k, -MAX_STEP, MAX_STEP) * (u.invertY ? -1 : 1);
    this.yaw -= dYaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dPitch, this.minPitch, this.maxPitch);
  }

  /** 视线方向(单位向量) */
  getDirection(out = new THREE.Vector3()): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  /**
   * @param target        第三人称跟随的目标位置
   * @param groundHeightAt 用于防止第三人称相机钻进地面
   * @param sightPosition 瞄准镜在世界中的位置(sight 模式必填)
   * @param dt            帧间隔时间,秒(默认 1/60)
   */
  update(
    target: THREE.Vector3,
    groundHeightAt?: (x: number, z: number) => number,
    sightPosition?: THREE.Vector3,
    dt = 1 / 60,
  ): void {
    this._hasUpdated = true;
    const targetFov = this.fov;
    if (this._displayFov !== targetFov) {
      const prevFov = this._displayFov;
      if (dt > 0) {
        this._displayFov += (targetFov - this._displayFov) * (1 - Math.exp(-dt / FOV_TAU));
      }
      if (Math.abs(targetFov - this._displayFov) < 0.01) {
        this._displayFov = targetFov;
      }
      if (this._displayFov !== prevFov || this.camera.fov !== this._displayFov) {
        this.camera.fov = this._displayFov;
        this.camera.updateProjectionMatrix();
      }
    } else if (this.camera.fov !== this._displayFov) {
      this.camera.fov = this._displayFov;
      this.camera.updateProjectionMatrix();
    }

    this.getDirection(this.dir);
    const pos = this.camera.position;
    if (this.mode === 'sight' && sightPosition) {
      pos.copy(sightPosition);
    } else {
      this.pivot.copy(target).y += this.pivotHeight;
      pos.copy(this.pivot).addScaledVector(this.dir, -this.distance);
      if (groundHeightAt) {
        const minY = groundHeightAt(pos.x, pos.z) + 0.8;
        if (pos.y < minY) pos.y = minY;
      }
    }
    this.camera.lookAt(pos.x + this.dir.x, pos.y + this.dir.y, pos.z + this.dir.z);
  }

  /**
   * 准星射线。第三人称时起点跳过相机到枢轴这一段(那里只有自己的车),
   * 避免相机贴着障碍物时射线打在身后、炮塔被拽着转过去;瞄准镜里直接从镜头出发。
   */
  getAimRay(): { origin: THREE.Vector3; dir: THREE.Vector3 } {
    const dir = this.getDirection();
    const skip = this.mode === 'sight' ? 0 : this.distance;
    return { origin: this.camera.position.clone().addScaledVector(dir, skip), dir };
  }
}
