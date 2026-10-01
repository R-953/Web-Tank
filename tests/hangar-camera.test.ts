import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { HANGAR_ROOM, fitRadius, HangarScene } from '../src/ui/menu/Hangar';

describe('机库镜头防穿墙 (HANGAR_ROOM 与 fitRadius)', () => {
  const target = { x: 0, y: 1.3, z: 0 };

  it('HANGAR_ROOM 范围合理并为厂房内表面留出余量', () => {
    // 厂房两侧立柱在 x=±16.5(0.45见方), 内侧面为 ±16.275; 后立柱在 z=-14.5, 内侧面为 -14.275; 屋架下表面在 y=10.25; 余量 0.4m
    expect(HANGAR_ROOM.halfWidth).toBeCloseTo(15.875, 3);
    expect(HANGAR_ROOM.back).toBeCloseTo(-13.875, 3);
    expect(HANGAR_ROOM.ceiling).toBeCloseTo(9.85, 3);
  });

  it('朝后墙方向 (radius=20): 算出的镜头位置在 HANGAR_ROOM 以内且收缩', () => {
    const dir = { x: 0, y: 0, z: -1 };
    const r = fitRadius(target, dir, 20);
    expect(r).toBeLessThan(20);
    const pos = {
      x: target.x + dir.x * r,
      y: target.y + dir.y * r,
      z: target.z + dir.z * r,
    };
    expect(pos.z).toBeGreaterThanOrEqual(HANGAR_ROOM.back - 1e-6);
    expect(pos.x).toBeLessThanOrEqual(HANGAR_ROOM.halfWidth + 1e-6);
    expect(pos.x).toBeGreaterThanOrEqual(-HANGAR_ROOM.halfWidth - 1e-6);
    expect(pos.y).toBeLessThanOrEqual(HANGAR_ROOM.ceiling + 1e-6);
    expect(pos.z).toBeCloseTo(HANGAR_ROOM.back, 6);
  });

  it('朝两侧墙方向 (radius=20): 算出的镜头位置在 HANGAR_ROOM 以内且收缩', () => {
    // 朝右墙 (+x)
    const dirRight = { x: 1, y: 0, z: 0 };
    const rRight = fitRadius(target, dirRight, 20);
    expect(rRight).toBeLessThan(20);
    const posRight = {
      x: target.x + dirRight.x * rRight,
      y: target.y + dirRight.y * rRight,
      z: target.z + dirRight.z * rRight,
    };
    expect(posRight.x).toBeLessThanOrEqual(HANGAR_ROOM.halfWidth + 1e-6);
    expect(posRight.x).toBeCloseTo(HANGAR_ROOM.halfWidth, 6);
    expect(posRight.z).toBeGreaterThanOrEqual(HANGAR_ROOM.back - 1e-6);
    expect(posRight.y).toBeLessThanOrEqual(HANGAR_ROOM.ceiling + 1e-6);

    // 朝左墙 (-x)
    const dirLeft = { x: -1, y: 0, z: 0 };
    const rLeft = fitRadius(target, dirLeft, 20);
    expect(rLeft).toBeLessThan(20);
    const posLeft = {
      x: target.x + dirLeft.x * rLeft,
      y: target.y + dirLeft.y * rLeft,
      z: target.z + dirLeft.z * rLeft,
    };
    expect(posLeft.x).toBeGreaterThanOrEqual(-HANGAR_ROOM.halfWidth - 1e-6);
    expect(posLeft.x).toBeCloseTo(-HANGAR_ROOM.halfWidth, 6);
    expect(posLeft.z).toBeGreaterThanOrEqual(HANGAR_ROOM.back - 1e-6);
    expect(posLeft.y).toBeLessThanOrEqual(HANGAR_ROOM.ceiling + 1e-6);
  });

  it('朝上方方向 (radius=20): 算出的镜头位置在 HANGAR_ROOM 以内且收缩', () => {
    const dirUp = { x: 0, y: 1, z: 0 };
    const rUp = fitRadius(target, dirUp, 20);
    expect(rUp).toBeLessThan(20);
    const posUp = {
      x: target.x + dirUp.x * rUp,
      y: target.y + dirUp.y * rUp,
      z: target.z + dirUp.z * rUp,
    };
    expect(posUp.y).toBeLessThanOrEqual(HANGAR_ROOM.ceiling + 1e-6);
    expect(posUp.y).toBeCloseTo(HANGAR_ROOM.ceiling, 6);
  });

  it('朝 +z 敞开的一面方向: 不收缩', () => {
    const dirFront = { x: 0, y: 0, z: 1 };
    const rFront = fitRadius(target, dirFront, 20);
    expect(rFront).toBe(20);

    // 带有正常小仰角 (pitch = 0.16) 朝正前方 (+z)
    const pitch = 0.16;
    const cp = Math.cos(pitch);
    const dirSlanted = {
      x: 0,
      y: Math.sin(pitch),
      z: cp,
    };
    const rSlanted = fitRadius(target, dirSlanted, 20);
    // target.y (1.3) + 20 * sin(0.16) = 4.49 < ceiling(9.85), 不应该收缩
    expect(rSlanted).toBe(20);
  });

  it('任何方向的返回值都 <= 输入的 radius', () => {
    // 遍历球面上各种朝向(包括机库支持的所有 yaw 和 pitch 范围)
    for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.2) {
      for (let pitch = 0.02; pitch <= 0.6; pitch += 0.05) {
        const cp = Math.cos(pitch);
        const dir = {
          x: Math.sin(yaw) * cp,
          y: Math.sin(pitch),
          z: Math.cos(yaw) * cp,
        };
        for (const inputRadius of [5, 10, 15, 20, 25]) {
          const fitted = fitRadius(target, dir, inputRadius);
          expect(fitted).toBeLessThanOrEqual(inputRadius);

          const px = target.x + dir.x * fitted;
          const py = target.y + dir.y * fitted;
          const pz = target.z + dir.z * fitted;

          expect(px).toBeLessThanOrEqual(HANGAR_ROOM.halfWidth + 1e-6);
          expect(px).toBeGreaterThanOrEqual(-HANGAR_ROOM.halfWidth - 1e-6);
          expect(py).toBeLessThanOrEqual(HANGAR_ROOM.ceiling + 1e-6);
          expect(pz).toBeGreaterThanOrEqual(HANGAR_ROOM.back - 1e-6);
        }
      }
    }
  });

  it('近距离 (radius=6.5) 时在厂房中心各方向均不收缩', () => {
    for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.5) {
      const pitch = 0.16;
      const cp = Math.cos(pitch);
      const dir = {
        x: Math.sin(yaw) * cp,
        y: Math.sin(pitch),
        z: Math.cos(yaw) * cp,
      };
      expect(fitRadius(target, dir, 6.5)).toBe(6.5);
    }
  });

  it('斜向后上方对角线: 同时靠近后墙与天花板时按最紧边界收缩', () => {
    const rawDir = new THREE.Vector3(1, 1, -1).normalize();
    const dir = { x: rawDir.x, y: rawDir.y, z: rawDir.z };
    const r = fitRadius(target, dir, 20);
    expect(r).toBeLessThan(20);
    const px = target.x + dir.x * r;
    const py = target.y + dir.y * r;
    const pz = target.z + dir.z * r;
    expect(px).toBeLessThanOrEqual(HANGAR_ROOM.halfWidth + 1e-6);
    expect(py).toBeLessThanOrEqual(HANGAR_ROOM.ceiling + 1e-6);
    expect(pz).toBeGreaterThanOrEqual(HANGAR_ROOM.back - 1e-6);
  });
});

describe('HangarScene 镜头更新与防穿墙集成', () => {
  it('初始化与更新后相机位置在 HANGAR_ROOM 边界以内', () => {
    const hangar = new HangarScene();
    hangar.update(0);
    const pos = hangar.camera.position;
    expect(pos.x).toBeLessThanOrEqual(HANGAR_ROOM.halfWidth + 1e-6);
    expect(pos.x).toBeGreaterThanOrEqual(-HANGAR_ROOM.halfWidth - 1e-6);
    expect(pos.y).toBeLessThanOrEqual(HANGAR_ROOM.ceiling + 1e-6);
    expect(pos.z).toBeGreaterThanOrEqual(HANGAR_ROOM.back - 1e-6);
    hangar.dispose();
  });
});
