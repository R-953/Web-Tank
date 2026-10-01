import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { OrbitCamera, THIRD_PERSON_FOV, THIRD_PERSON_ZOOM_FOV } from '../src/engine/OrbitCamera';

describe('第三人称视角放大(third-person zoom)', () => {
  it('常量定义符合规范:默认 70°,放大估算取 35°', () => {
    expect(THIRD_PERSON_FOV).toBe(70);
    expect(THIRD_PERSON_ZOOM_FOV).toBe(35);
  });

  it('第三人称切换后 fov 在 70 和放大值之间来回', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    expect(orbit.thirdZoomed).toBe(false);
    expect(orbit.fov).toBe(THIRD_PERSON_FOV);
    expect(camera.fov).toBe(THIRD_PERSON_FOV);

    // 第一次切换:放大
    orbit.toggleThirdZoom();
    expect(orbit.thirdZoomed).toBe(true);
    expect(orbit.fov).toBe(THIRD_PERSON_ZOOM_FOV);
    expect(camera.fov).toBe(THIRD_PERSON_ZOOM_FOV);

    // 第二次切换:复原
    orbit.toggleThirdZoom();
    expect(orbit.thirdZoomed).toBe(false);
    expect(orbit.fov).toBe(THIRD_PERSON_FOV);
    expect(camera.fov).toBe(THIRD_PERSON_FOV);
  });

  it('setSight() 后再 setThirdPerson() 放大状态已复位', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    // 第三人称放大
    orbit.toggleThirdZoom();
    expect(orbit.thirdZoomed).toBe(true);
    expect(orbit.fov).toBe(THIRD_PERSON_ZOOM_FOV);

    // 开镜:倍率 2.5
    orbit.setSight(2.5);
    expect(orbit.mode).toBe('sight');
    expect(orbit.thirdZoomed).toBe(false);
    expect(orbit.fov).toBeCloseTo(62.5 / 2.5);
    expect(camera.fov).toBeCloseTo(62.5 / 2.5);

    // 切回第三人称:放大状态已复位为 false
    orbit.setThirdPerson();
    expect(orbit.mode).toBe('third');
    expect(orbit.thirdZoomed).toBe(false);
    expect(orbit.fov).toBe(THIRD_PERSON_FOV);
    expect(camera.fov).toBe(THIRD_PERSON_FOV);
  });

  it('开镜时 toggleThirdZoom() 不改变 fov', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    orbit.setSight(4);
    const expectedSightFov = 62.5 / 4;
    expect(orbit.fov).toBeCloseTo(expectedSightFov);
    expect(camera.fov).toBeCloseTo(expectedSightFov);

    orbit.toggleThirdZoom();
    expect(orbit.thirdZoomed).toBe(false);
    expect(orbit.fov).toBeCloseTo(expectedSightFov);
    expect(camera.fov).toBeCloseTo(expectedSightFov);
  });

  it('放大时同样的鼠标位移转动角度按视场比例变小(scaleWithZoom 开着时)', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    orbit.setSensitivity({ mouse: 1, sight: 1, scaleWithZoom: true, invertY: false });

    // 未放大时转动
    orbit.yaw = 0;
    orbit.pitch = 0;
    orbit.rotate(10, 10);
    const dYawNormal = Math.abs(orbit.yaw);
    const dPitchNormal = Math.abs(orbit.pitch);

    // 放大后相同位移转动
    orbit.toggleThirdZoom();
    orbit.yaw = 0;
    orbit.pitch = 0;
    orbit.rotate(10, 10);
    const dYawZoomed = Math.abs(orbit.yaw);
    const dPitchZoomed = Math.abs(orbit.pitch);

    const fovRatio = THIRD_PERSON_ZOOM_FOV / THIRD_PERSON_FOV;
    expect(dYawZoomed / dYawNormal).toBeCloseTo(fovRatio, 5);
    expect(dPitchZoomed / dPitchNormal).toBeCloseTo(fovRatio, 5);

    // scaleWithZoom 关掉时,不按视场比例缩放
    orbit.setSensitivity({ mouse: 1, sight: 1, scaleWithZoom: false, invertY: false });
    orbit.yaw = 0;
    orbit.pitch = 0;
    orbit.rotate(10, 10);
    expect(Math.abs(orbit.yaw)).toBeCloseTo(dYawNormal, 5);
    expect(Math.abs(orbit.pitch)).toBeCloseTo(dPitchNormal, 5);
  });

  it('setThirdZoom(true/false) 支持精确设置并在开镜时忽略', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    const orbit = new OrbitCamera(camera);

    orbit.setThirdZoom(true);
    expect(orbit.thirdZoomed).toBe(true);
    expect(orbit.fov).toBe(THIRD_PERSON_ZOOM_FOV);

    // 重复设置幂等
    orbit.setThirdZoom(true);
    expect(orbit.thirdZoomed).toBe(true);
    expect(orbit.fov).toBe(THIRD_PERSON_ZOOM_FOV);

    orbit.setThirdZoom(false);
    expect(orbit.thirdZoomed).toBe(false);
    expect(orbit.fov).toBe(THIRD_PERSON_FOV);

    // 开镜时 setThirdZoom 无效
    orbit.setSight(3);
    orbit.setThirdZoom(true);
    expect(orbit.thirdZoomed).toBe(false);
    expect(orbit.fov).toBeCloseTo(62.5 / 3);
  });
});
