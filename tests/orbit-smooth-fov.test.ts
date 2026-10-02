import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  OrbitCamera,
  FOV_TAU,
  THIRD_PERSON_FOV,
  THIRD_PERSON_ZOOM_FOV,
  SIGHT_FOV_AT_1X,
} from '../src/engine/OrbitCamera';

describe('平滑视场过渡(OrbitCamera smooth fov)', () => {
  const dummyTarget = new THREE.Vector3(0, 0, 0);

  it('导出常量与初始状态符合规范', () => {
    expect(FOV_TAU).toBe(0.06);
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    expect(orbit.fov).toBe(THIRD_PERSON_FOV);
    expect(orbit.displayFov).toBe(THIRD_PERSON_FOV);
    expect(camera.fov).toBe(THIRD_PERSON_FOV);
  });

  it('按 Z 后 displayFov 单调趋近 35° 且不过冲', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    orbit.toggleThirdZoom();
    expect(orbit.fov).toBe(THIRD_PERSON_ZOOM_FOV);

    // 缩放到 35° 的过渡过程
    let lastFov = orbit.displayFov;
    for (let i = 0; i < 60; i++) {
      orbit.update(dummyTarget, undefined, undefined, 1 / 60);
      expect(orbit.displayFov).toBeLessThanOrEqual(lastFov);
      expect(orbit.displayFov).toBeGreaterThanOrEqual(THIRD_PERSON_ZOOM_FOV);
      expect(camera.fov).toBe(orbit.displayFov);
      lastFov = orbit.displayFov;
    }
    expect(orbit.displayFov).toBe(THIRD_PERSON_ZOOM_FOV);

    // 还原回 70° 的过渡过程
    orbit.toggleThirdZoom();
    expect(orbit.fov).toBe(THIRD_PERSON_FOV);
    lastFov = orbit.displayFov;
    for (let i = 0; i < 60; i++) {
      orbit.update(dummyTarget, undefined, undefined, 1 / 60);
      expect(orbit.displayFov).toBeGreaterThanOrEqual(lastFov);
      expect(orbit.displayFov).toBeLessThanOrEqual(THIRD_PERSON_FOV);
      expect(camera.fov).toBe(orbit.displayFov);
      lastFov = orbit.displayFov;
    }
    expect(orbit.displayFov).toBe(THIRD_PERSON_FOV);
  });

  it('0.5 s 内到达目标的 99% 以内并吸附', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    orbit.toggleThirdZoom();
    const dt = 1 / 60;
    const steps = Math.round(0.5 / dt);
    for (let i = 0; i < steps; i++) {
      orbit.update(dummyTarget, undefined, undefined, dt);
    }

    const totalChange = THIRD_PERSON_FOV - THIRD_PERSON_ZOOM_FOV;
    const remaining = Math.abs(orbit.displayFov - THIRD_PERSON_ZOOM_FOV);
    expect(remaining).toBeLessThan(totalChange * 0.01);
    // 0.5 s 后剩余偏差已远低于 0.01°, 应已完全吸附到 35°
    expect(orbit.displayFov).toBe(THIRD_PERSON_ZOOM_FOV);
  });

  it('帧率无关: dt = 1/30 与 dt = 1/120 在 t = 0.2 s 时的差小于 0.05°', () => {
    const camera1 = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit1 = new OrbitCamera(camera1);
    orbit1.toggleThirdZoom();

    const camera2 = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit2 = new OrbitCamera(camera2);
    orbit2.toggleThirdZoom();

    // 30 fps 下推进 0.2 s (6 帧)
    for (let i = 0; i < 6; i++) {
      orbit1.update(dummyTarget, undefined, undefined, 1 / 30);
    }

    // 120 fps 下推进 0.2 s (24 帧)
    for (let i = 0; i < 24; i++) {
      orbit2.update(dummyTarget, undefined, undefined, 1 / 120);
    }

    expect(Math.abs(orbit1.displayFov - orbit2.displayFov)).toBeLessThan(0.05);
  });

  it('开镜 70° → 瞄准镜视场、切换倍率与关镜均平滑过渡', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    // 开镜 2.5x
    orbit.setSight(2.5);
    const targetSight25 = SIGHT_FOV_AT_1X / 2.5; // 25°
    expect(orbit.fov).toBeCloseTo(targetSight25);

    let lastFov = orbit.displayFov;
    for (let i = 0; i < 60; i++) {
      orbit.update(dummyTarget, undefined, undefined, 1 / 60);
      expect(orbit.displayFov).toBeLessThanOrEqual(lastFov);
      expect(orbit.displayFov).toBeGreaterThanOrEqual(targetSight25);
      lastFov = orbit.displayFov;
    }
    expect(orbit.displayFov).toBeCloseTo(targetSight25);

    // 切换倍率到 5x
    orbit.setSight(5);
    const targetSight50 = SIGHT_FOV_AT_1X / 5; // 12.5°
    expect(orbit.fov).toBeCloseTo(targetSight50);

    lastFov = orbit.displayFov;
    for (let i = 0; i < 60; i++) {
      orbit.update(dummyTarget, undefined, undefined, 1 / 60);
      expect(orbit.displayFov).toBeLessThanOrEqual(lastFov);
      expect(orbit.displayFov).toBeGreaterThanOrEqual(targetSight50);
      lastFov = orbit.displayFov;
    }
    expect(orbit.displayFov).toBeCloseTo(targetSight50);

    // 关镜回第三人称 70°
    orbit.setThirdPerson();
    expect(orbit.fov).toBe(THIRD_PERSON_FOV);
    lastFov = orbit.displayFov;
    for (let i = 0; i < 60; i++) {
      orbit.update(dummyTarget, undefined, undefined, 1 / 60);
      expect(orbit.displayFov).toBeGreaterThanOrEqual(lastFov);
      expect(orbit.displayFov).toBeLessThanOrEqual(THIRD_PERSON_FOV);
      lastFov = orbit.displayFov;
    }
    expect(orbit.displayFov).toBe(THIRD_PERSON_FOV);
  });

  it('snapFov() 立即到位且不经过渡', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    orbit.toggleThirdZoom();
    expect(orbit.fov).toBe(THIRD_PERSON_ZOOM_FOV);
    expect(orbit.displayFov).toBe(THIRD_PERSON_FOV);
    expect(camera.fov).toBe(THIRD_PERSON_FOV);

    orbit.snapFov();
    expect(orbit.displayFov).toBe(THIRD_PERSON_ZOOM_FOV);
    expect(camera.fov).toBe(THIRD_PERSON_ZOOM_FOV);

    // 后续 update 保持不变
    orbit.update(dummyTarget, undefined, undefined, 1 / 60);
    expect(orbit.displayFov).toBe(THIRD_PERSON_ZOOM_FOV);
    expect(camera.fov).toBe(THIRD_PERSON_ZOOM_FOV);
  });

  it('灵敏度缩放在过渡期间随 displayFov 连续变化', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);
    orbit.setSensitivity({ mouse: 1, sight: 1, scaleWithZoom: true, invertY: false });

    // 未放大时的基准转动幅度
    orbit.yaw = 0;
    orbit.pitch = 0;
    orbit.rotate(10, 10);
    const baseDelta = Math.abs(orbit.yaw);

    // 放大并逐步推进
    orbit.toggleThirdZoom();

    let prevRatio = 1.0;
    for (let i = 0; i < 10; i++) {
      orbit.update(dummyTarget, undefined, undefined, 1 / 60);
      orbit.yaw = 0;
      orbit.pitch = 0;
      orbit.rotate(10, 10);
      const currentDelta = Math.abs(orbit.yaw);
      const ratio = currentDelta / baseDelta;
      const expectedRatio = orbit.displayFov / THIRD_PERSON_FOV;

      expect(ratio).toBeCloseTo(expectedRatio, 5);
      expect(ratio).toBeLessThanOrEqual(prevRatio);
      expect(ratio).toBeGreaterThanOrEqual(0.5);
      prevRatio = ratio;
    }
  });

  it('目标不变时不再调用 updateProjectionMatrix', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);
    const spy = vi.spyOn(camera, 'updateProjectionMatrix');

    // 目标与当前视场一致时, 多次 update 不更新投影矩阵
    orbit.update(dummyTarget, undefined, undefined, 1 / 60);
    orbit.update(dummyTarget, undefined, undefined, 1 / 60);
    expect(spy).not.toHaveBeenCalled();

    // 改变目标: 过渡期间每帧更新投影矩阵
    orbit.toggleThirdZoom();
    orbit.update(dummyTarget, undefined, undefined, 1 / 60);
    expect(spy).toHaveBeenCalledTimes(1);

    // 推进直至吸附完成 (0.5 s)
    for (let i = 0; i < 40; i++) {
      orbit.update(dummyTarget, undefined, undefined, 1 / 60);
    }
    expect(orbit.displayFov).toBe(THIRD_PERSON_ZOOM_FOV);

    // 吸附完成后重置 spy, 后续帧不再调用
    spy.mockClear();
    for (let i = 0; i < 10; i++) {
      orbit.update(dummyTarget, undefined, undefined, 1 / 60);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('差值小于 0.01° 时直接吸附到目标', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    // 通过多次更新让视场极其接近 35°
    orbit.toggleThirdZoom();
    for (let i = 0; i < 50; i++) {
      orbit.update(dummyTarget, undefined, undefined, 1 / 60);
    }
    expect(orbit.displayFov).toBe(35);
  });
});
