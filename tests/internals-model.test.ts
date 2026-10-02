import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TIGER_I } from '../src/data/vehicles';
import type { InternalsSnapshot } from '../src/game/internalsSnapshot';
import {
  buildInternalsModel,
  MODULE_TYPE_COLORS,
  killcamModuleColor,
  killcamCrewColor,
  buildCrewFigure,
} from '../src/ui/internalsModel';

function makeSnapshot(overrides: Partial<InternalsSnapshot> = {}): InternalsSnapshot {
  return {
    spec: TIGER_I,
    turretYaw: 0,
    gunPitch: 0,
    modules: [
      { id: 'engine', type: 'engine', part: 'hull', center: [0, 0, 1], size: [1, 1, 1], ratio: 1 },
      { id: 'ammo_hull', type: 'ammo', part: 'hull', center: [0.5, 0, 0], size: [0.6, 0.4, 0.8], ratio: 1 },
      { id: 'traverse', type: 'traverse', part: 'turret', center: [0, 0, 0], size: [0.3, 0.3, 0.3], ratio: 1 },
      { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -2], size: [0.2, 0.2, 2], ratio: 1 },
    ],
    crew: [
      { id: 'driver', role: 'driver', part: 'hull', center: [-0.5, 0, -1], ratio: 1, alive: true },
      { id: 'gunner', role: 'gunner', part: 'turret', center: [-0.3, 0.2, 0], ratio: 1, alive: true },
    ],
    ...overrides,
  };
}

describe('internalsModel 共享 3D X 光模型组件', () => {
  it('挂载点分组正确: hull / turret / gun 分别归属到对应挂载点', () => {
    const snap = makeSnapshot();
    const model = buildInternalsModel(snap);

    // 检查挂载点结构
    expect(model.hullMount).toBeInstanceOf(THREE.Group);
    expect(model.turretMount).toBeInstanceOf(THREE.Group);
    expect(model.gunMount).toBeInstanceOf(THREE.Group);

    // 模块分组
    const engine = model.modulesMap.get('engine')!;
    const ammo = model.modulesMap.get('ammo_hull')!;
    const traverse = model.modulesMap.get('traverse')!;
    const barrel = model.modulesMap.get('barrel')!;

    expect(engine.mesh.parent).toBe(model.hullMount);
    expect(ammo.mesh.parent).toBe(model.hullMount);
    expect(traverse.mesh.parent).toBe(model.turretMount);
    expect(barrel.mesh.parent).toBe(model.gunMount);

    // 乘员分组
    const driver = model.crewMap.get('driver')!;
    const gunner = model.crewMap.get('gunner')!;

    expect(driver.group.parent).toBe(model.hullMount);
    expect(gunner.group.parent).toBe(model.turretMount);

    model.dispose();
  });

  it('update 着色: 满血 = 类型色、半血偏红、0 = 近黑、乘员阵亡近黑', () => {
    const snap = makeSnapshot();
    const model = buildInternalsModel(snap);

    const engine = model.modulesMap.get('engine')!;
    const ammo = model.modulesMap.get('ammo_hull')!;
    const driver = model.crewMap.get('driver')!;

    // 1. 满血状态
    expect(engine.mat.color.getHex()).toBe(MODULE_TYPE_COLORS.engine);
    expect(ammo.mat.color.getHex()).toBe(MODULE_TYPE_COLORS.ammo);
    expect(driver.mat.color.getHex()).toBe(0x9fb6c7);

    // 2. 发动机受损半血 0.5: 向 0xff3b30 插值
    const snapHalf = makeSnapshot({
      modules: [
        { id: 'engine', type: 'engine', part: 'hull', center: [0, 0, 1], size: [1, 1, 1], ratio: 0.5 },
        { id: 'ammo_hull', type: 'ammo', part: 'hull', center: [0.5, 0, 0], size: [0.6, 0.4, 0.8], ratio: 1 },
        { id: 'traverse', type: 'traverse', part: 'turret', center: [0, 0, 0], size: [0.3, 0.3, 0.3], ratio: 1 },
        { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -2], size: [0.2, 0.2, 2], ratio: 1 },
      ],
      crew: [
        { id: 'driver', role: 'driver', part: 'hull', center: [-0.5, 0, -1], ratio: 0.5, alive: true },
        { id: 'gunner', role: 'gunner', part: 'turret', center: [-0.3, 0.2, 0], ratio: 1, alive: true },
      ],
    });
    model.update(snapHalf);

    expect(engine.mat.color.getHex()).toBe(killcamModuleColor('engine', 0.5));
    expect(driver.mat.color.getHex()).toBe(killcamCrewColor(0.5));

    // 3. 报废与乘员阵亡: 均为近黑 0x1a1a1a
    const snapDead = makeSnapshot({
      modules: [
        { id: 'engine', type: 'engine', part: 'hull', center: [0, 0, 1], size: [1, 1, 1], ratio: 0 },
        { id: 'ammo_hull', type: 'ammo', part: 'hull', center: [0.5, 0, 0], size: [0.6, 0.4, 0.8], ratio: 1 },
        { id: 'traverse', type: 'traverse', part: 'turret', center: [0, 0, 0], size: [0.3, 0.3, 0.3], ratio: 1 },
        { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -2], size: [0.2, 0.2, 2], ratio: 1 },
      ],
      crew: [
        { id: 'driver', role: 'driver', part: 'hull', center: [-0.5, 0, -1], ratio: 0, alive: false },
        { id: 'gunner', role: 'gunner', part: 'turret', center: [-0.3, 0.2, 0], ratio: 1, alive: true },
      ],
    });
    model.update(snapDead);

    expect(engine.mat.color.getHex()).toBe(0x1a1a1a);
    expect(driver.mat.color.getHex()).toBe(0x1a1a1a);

    // 对不上 id 的条目安全忽略不报错
    const snapExtra = makeSnapshot({
      modules: [{ id: 'nonexistent', type: 'engine', part: 'hull', center: [0, 0, 0], size: [1, 1, 1], ratio: 0.5 }],
      crew: [{ id: 'nobody', role: 'radio', part: 'hull', center: [0, 0, 0], ratio: 0.5, alive: true }],
    });
    expect(() => model.update(snapExtra)).not.toThrow();

    model.dispose();
  });

  it('乘员换挂载点: 顶替换位时从炮塔移到车体', () => {
    const snap = makeSnapshot();
    const model = buildInternalsModel(snap);

    const gunner = model.crewMap.get('gunner')!;
    expect(gunner.group.parent).toBe(model.turretMount);

    // 炮手顶替驾驶员位置，坐标和 part 均换到车体
    const snapSwap = makeSnapshot({
      crew: [
        { id: 'driver', role: 'driver', part: 'hull', center: [-0.5, 0, -1], ratio: 0, alive: false },
        { id: 'gunner', role: 'driver', part: 'hull', center: [-0.5, 0, -1], ratio: 1, alive: true },
      ],
    });
    model.update(snapSwap);

    expect(gunner.group.parent).toBe(model.hullMount);
    expect(model.turretMount.children).not.toContain(gunner.group);
    expect(gunner.group.position.x).toBeCloseTo(-0.5);
    expect(gunner.group.position.z).toBeCloseTo(-1);

    model.dispose();
  });

  it('setOpacity 控制透明度: 0 隐藏、0.5 各材质 = 基础 × 0.5', () => {
    // 默认基础透明度: 模块 0.55, 乘员 0.7
    const snap = makeSnapshot();
    const model = buildInternalsModel(snap);

    const engine = model.modulesMap.get('engine')!;
    const driver = model.crewMap.get('driver')!;

    // setOpacity(0.5)
    model.setOpacity(0.5);
    expect(model.hullMount.visible).toBe(true);
    expect(model.turretMount.visible).toBe(true);
    expect(model.gunMount.visible).toBe(true);

    expect(engine.mat.opacity).toBeCloseTo(0.55 * 0.5, 5);
    expect(driver.mat.opacity).toBeCloseTo(0.7 * 0.5, 5);
    expect(engine.mesh.visible).toBe(true);
    expect(driver.group.visible).toBe(true);

    // setOpacity(0): 整体 visible = false
    model.setOpacity(0);
    expect(model.hullMount.visible).toBe(false);
    expect(model.turretMount.visible).toBe(false);
    expect(model.gunMount.visible).toBe(false);

    expect(engine.mat.opacity).toBe(0);
    expect(driver.mat.opacity).toBe(0);
    expect(engine.mesh.visible).toBe(false);
    expect(driver.group.visible).toBe(false);

    model.dispose();
  });

  it('自定义基础透明度与 edges 选项生效', () => {
    const snap = makeSnapshot();
    const model = buildInternalsModel(snap, {
      moduleOpacity: 0.8,
      crewOpacity: 0.9,
      edges: false,
    });

    const engine = model.modulesMap.get('engine')!;
    const driver = model.crewMap.get('driver')!;

    expect(engine.baseOpacity).toBe(0.8);
    expect(driver.baseOpacity).toBe(0.9);
    expect(engine.edges).toBeUndefined();

    model.setOpacity(0.5);
    expect(engine.mat.opacity).toBeCloseTo(0.8 * 0.5, 5);
    expect(driver.mat.opacity).toBeCloseTo(0.9 * 0.5, 5);

    model.dispose();
  });

  it('dispose 释放几何体与材质，并将三个挂载点从父节点摘掉', () => {
    const parent = new THREE.Group();
    const snap = makeSnapshot();
    const model = buildInternalsModel(snap);

    parent.add(model.hullMount);
    parent.add(model.turretMount);
    parent.add(model.gunMount);
    expect(parent.children.length).toBe(3);

    model.dispose();

    expect(parent.children.length).toBe(0);
    expect(model.hullMount.parent).toBeNull();
    expect(model.turretMount.parent).toBeNull();
    expect(model.gunMount.parent).toBeNull();
    expect(model.modulesMap.size).toBe(0);
    expect(model.crewMap.size).toBe(0);
  });

  it('buildCrewFigure 独立构造且附带 userData 材质引用', () => {
    const fig = buildCrewFigure();
    expect(fig.name).toBe('crew-figure');
    expect(fig.userData.bodyMat).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(fig.userData.edgeMat).toBeInstanceOf(THREE.LineBasicMaterial);
  });
});
