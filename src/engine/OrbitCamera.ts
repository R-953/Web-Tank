import * as THREE from 'three';

/** 第三人称视角的垂直视场,度 */
export const THIRD_PERSON_FOV = 70;
/**
 * 瞄准镜视场 ≈ 该值 / 倍率(度)。取自实物:TZF 9d 2.5× 视场 25°、5× 视场 12.5°;TSh-16 4× 视场 16°。
 */
export const SIGHT_FOV_AT_1X = 62.5;

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

  private readonly pivot = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** 当前垂直视场,度 */
  get fov(): number {
    return this.mode === 'sight' ? SIGHT_FOV_AT_1X / this.magnification : THIRD_PERSON_FOV;
  }

  setThirdPerson(): void {
    this.mode = 'third';
    this.applyFov();
  }

  setSight(magnification: number): void {
    this.mode = 'sight';
    this.magnification = magnification;
    this.applyFov();
  }

  rotate(dx: number, dy: number): void {
    // 放大后同样的鼠标位移转得更少,手感与视场成正比
    const k = this.sensitivity * (this.fov / THIRD_PERSON_FOV);
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, this.minPitch, this.maxPitch);
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
   */
  update(target: THREE.Vector3, groundHeightAt?: (x: number, z: number) => number, sightPosition?: THREE.Vector3): void {
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

  private applyFov(): void {
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }
}
