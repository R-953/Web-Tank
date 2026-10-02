import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WorldXray, xrayShellStyle, XRAY_GRAY_COLOR, type XrayVehicle } from '../src/ui/WorldXray';
import type { InternalsSnapshot } from '../src/game/internalsSnapshot';
import { TARGET } from './fixtures';

function createMockVehicle(): XrayVehicle & {
  hullMesh: THREE.Mesh;
  turretMesh: THREE.Mesh;
  barrelMesh: THREE.Mesh;
  instancedMesh: THREE.InstancedMesh;
} {
  const root = new THREE.Group();
  const turretPivot = new THREE.Group();
  const gunPivot = new THREE.Group();
  root.add(turretPivot);
  turretPivot.add(gunPivot);

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x4a5d3e });
  const hullGeo = new THREE.BoxGeometry(2, 1, 4);
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.name = 'hull';
  root.add(hullMesh);

  const turretMat1 = new THREE.MeshStandardMaterial({ color: 0x5a6d4e });
  const turretMat2 = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const turretGeo = new THREE.BoxGeometry(1.5, 0.8, 1.5);
  const turretMesh = new THREE.Mesh(turretGeo, [turretMat1, turretMat2]);
  turretMesh.name = 'turret';
  turretPivot.add(turretMesh);

  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const barrelGeo = new THREE.CylinderGeometry(0.1, 0.1, 3);
  const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
  barrelMesh.name = 'barrel';
  gunPivot.add(barrelMesh);

  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const instancedMesh = new THREE.InstancedMesh(wheelGeo, wheelMat, 8);
  instancedMesh.name = 'wheels';
  root.add(instancedMesh);

  return { root, turretPivot, gunPivot, hullMesh, turretMesh, barrelMesh, instancedMesh };
}

function makeMockSnapshot(): InternalsSnapshot {
  return {
    spec: TARGET,
    turretYaw: 0,
    gunPitch: 0,
    modules: [
      { id: 'engine', type: 'engine', part: 'hull', center: [0, 0, 1], size: [1, 1, 1], ratio: 1 },
      { id: 'ammo', type: 'ammo', part: 'turret', center: [0, 0, 0], size: [0.5, 0.5, 0.5], ratio: 0.8 },
      { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, 0], size: [0.3, 0.3, 0.5], ratio: 0.5 },
    ],
    crew: [
      { id: 'crew:0', role: 'driver', part: 'hull', center: [0, 0, -1], ratio: 1, alive: true },
      { id: 'crew:1', role: 'gunner', part: 'turret', center: [0, 0, 0], ratio: 0.6, alive: true },
    ],
  };
}

describe('xrayShellStyle 纯函数', () => {
  it('k = 0 时为真实外壳样式', () => {
    const style = xrayShellStyle(0);
    expect(style.opacity).toBeCloseTo(1.0, 5);
    expect(style.grayMix).toBeCloseTo(0.0, 5);
    expect(style.edgeOpacity).toBeCloseTo(0.0, 5);
  });

  it('k = 1 时为完全 X 光样式', () => {
    const style = xrayShellStyle(1);
    expect(style.opacity).toBeCloseTo(0.12, 5);
    expect(style.grayMix).toBeCloseTo(1.0, 5);
    expect(style.edgeOpacity).toBeCloseTo(0.35, 5);
  });

  it('k = 0.5 时为半透明过渡', () => {
    const style = xrayShellStyle(0.5);
    expect(style.opacity).toBeCloseTo(0.56, 5);
    expect(style.grayMix).toBeCloseTo(0.5, 5);
    expect(style.edgeOpacity).toBeCloseTo(0.175, 5);
  });

  it('k 越界时被截断在 [0, 1] 内', () => {
    expect(xrayShellStyle(-0.5)).toEqual(xrayShellStyle(0));
    expect(xrayShellStyle(1.5)).toEqual(xrayShellStyle(1));
  });
});

describe('WorldXray 类', () => {
  it('初始状态 enabled 为 false', () => {
    const v = createMockVehicle();
    const xray = new WorldXray(v);
    expect(xray.enabled).toBe(false);
  });

  it('enable 换材质为克隆且 transparent, disable 还原所有原始材质对象', () => {
    const v = createMockVehicle();
    const origHullMat = v.hullMesh.material;
    const origTurretMat = v.turretMesh.material;
    const origBarrelMat = v.barrelMesh.material;
    const origWheelMat = v.instancedMesh.material;

    const xray = new WorldXray(v);
    const snap = makeMockSnapshot();

    xray.enable(snap);
    expect(xray.enabled).toBe(true);

    // 检查每个 mesh 上的材质引用被克隆且为 transparent
    expect(v.hullMesh.material).not.toBe(origHullMat);
    const clonedHull = v.hullMesh.material as THREE.MeshStandardMaterial;
    expect(clonedHull.transparent).toBe(true);
    expect(clonedHull.depthWrite).toBe(false);

    // 材质数组测试
    expect(v.turretMesh.material).not.toBe(origTurretMat);
    const clonedTurret = v.turretMesh.material as THREE.MeshStandardMaterial[];
    expect(Array.isArray(clonedTurret)).toBe(true);
    expect(clonedTurret[0].transparent).toBe(true);
    expect(clonedTurret[0].depthWrite).toBe(false);

    // InstancedMesh 也被克隆
    expect(v.instancedMesh.material).not.toBe(origWheelMat);
    expect((v.instancedMesh.material as THREE.MeshStandardMaterial).transparent).toBe(true);

    // 轮廓线: 普通 Mesh 添加了轮廓线, InstancedMesh 未添加
    const hullEdge = v.hullMesh.children.find((c) => c.name === 'xray-edge');
    expect(hullEdge).toBeDefined();
    const wheelEdge = v.instancedMesh.children.find((c) => c.name === 'xray-edge');
    expect(wheelEdge).toBeUndefined();

    // disable 还原
    xray.disable();
    expect(xray.enabled).toBe(false);

    // 材质严格等于原始对象引用
    expect(v.hullMesh.material).toBe(origHullMat);
    expect(v.turretMesh.material).toBe(origTurretMat);
    expect(v.barrelMesh.material).toBe(origBarrelMat);
    expect(v.instancedMesh.material).toBe(origWheelMat);

    // 轮廓线被移除
    expect(v.hullMesh.children.find((c) => c.name === 'xray-edge')).toBeUndefined();
  });

  it('setFade(0 / 0.5 / 1) 的外壳不透明度与颜色混灰符合 xrayShellStyle', () => {
    const v = createMockVehicle();
    const xray = new WorldXray(v);
    const snap = makeMockSnapshot();
    xray.enable(snap);

    // setFade(0)
    xray.setFade(0);
    const mat0 = v.hullMesh.material as THREE.MeshStandardMaterial;
    expect(mat0.opacity).toBeCloseTo(xrayShellStyle(0).opacity, 5);
    expect(mat0.color.getHex()).toBe(0x4a5d3e); // 原色

    // setFade(0.5)
    xray.setFade(0.5);
    const matHalf = v.hullMesh.material as THREE.MeshStandardMaterial;
    expect(matHalf.opacity).toBeCloseTo(xrayShellStyle(0.5).opacity, 5);
    const expectedHalfColor = new THREE.Color(0x4a5d3e).lerp(new THREE.Color(XRAY_GRAY_COLOR), 0.5);
    expect(matHalf.color.getHex()).toBe(expectedHalfColor.getHex());

    // setFade(1)
    xray.setFade(1);
    const mat1 = v.hullMesh.material as THREE.MeshStandardMaterial;
    expect(mat1.opacity).toBeCloseTo(xrayShellStyle(1).opacity, 5);
    expect(mat1.color.getHex()).toBe(XRAY_GRAY_COLOR);

    xray.disable();
  });

  it('重复 enable / disable 不泄漏, 场景里节点数完全一致', () => {
    const v = createMockVehicle();
    const xray = new WorldXray(v);
    const snap = makeMockSnapshot();

    const rootChildCount = v.root.children.length;
    const turretChildCount = v.turretPivot.children.length;
    const gunChildCount = v.gunPivot.children.length;
    const hullChildCount = v.hullMesh.children.length;

    // 多次开关循环
    for (let i = 0; i < 3; i++) {
      xray.enable(snap);
      xray.setFade(0.8);
      xray.update(snap);
      xray.disable();

      expect(v.root.children.length).toBe(rootChildCount);
      expect(v.turretPivot.children.length).toBe(turretChildCount);
      expect(v.gunPivot.children.length).toBe(gunChildCount);
      expect(v.hullMesh.children.length).toBe(hullChildCount);
    }
  });

  it('连续多次 enable 不嵌套且安全', () => {
    const v = createMockVehicle();
    const origMat = v.hullMesh.material;
    const xray = new WorldXray(v);
    const snap = makeMockSnapshot();

    xray.enable(snap);
    xray.enable(snap); // 连续调用
    expect(xray.enabled).toBe(true);

    xray.disable();
    expect(xray.enabled).toBe(false);
    expect(v.hullMesh.material).toBe(origMat);
  });

  it('传入地面亮度时, 构造函数与 setGroundLuminance 能正确调整轮廓线与外壳灰度', () => {
    const v = createMockVehicle();
    // 亮地面(雪地亮度 0.9)
    const xraySnow = new WorldXray(v, 0.9);
    const snap = makeMockSnapshot();
    xraySnow.enable(snap);
    xraySnow.setFade(1);

    const edgeSnow = v.hullMesh.children.find((c) => c.name === 'xray-edge') as THREE.LineSegments;
    expect(edgeSnow).toBeDefined();
    const edgeMatSnow = edgeSnow.material as THREE.LineBasicMaterial;
    expect(edgeMatSnow.color.getHex()).toBe(0x222222);
    expect(edgeMatSnow.opacity).toBeCloseTo(0.40, 5);

    const matSnow = v.hullMesh.material as THREE.MeshStandardMaterial;
    expect(matSnow.opacity).toBeCloseTo(0.15, 5);
    expect(matSnow.color.getHex()).toBe(0x4b5258);

    // 动态切换到暗地面(草地亮度 0.4)
    xraySnow.setGroundLuminance(0.4);
    expect(edgeMatSnow.color.getHex()).toBe(0xffffff);
    expect(edgeMatSnow.opacity).toBeCloseTo(0.35, 5);

    const matGrass = v.hullMesh.material as THREE.MeshStandardMaterial;
    expect(matGrass.opacity).toBeCloseTo(0.12, 5);
    expect(matGrass.color.getHex()).toBe(XRAY_GRAY_COLOR);

    xraySnow.disable();
  });
});

