import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  WorldReplay,
  worldReplayCameraPose,
  worldReplayFade,
  worldReplayImpactMark,
  worldReplayTrajectoryPoints,
  WRECK_BRIGHTEN_FACTOR_DARK,
  wreckBrightenFactorFor,
} from '../src/ui/WorldReplay';
import { killcamDuration } from '../src/ui/KillCam';
import type { HitReplay } from '../src/game/Game';
import type { XrayVehicle } from '../src/ui/WorldXray';
import { SHOOTER, TARGET } from './fixtures';

function makeTestReplay(): HitReplay {
  return {
    spec: TARGET,
    shell: SHOOTER.weapons[0].ammo[0],
    turretYaw: 0,
    gunPitch: 0,
    part: 'hull',
    entry: new THREE.Vector3(0, 0.5, -2),
    dir: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 0, -1),
    armor: {
      face: 'front',
      armor: 80,
      angleDeg: 0,
      effectiveArmor: 80,
      penetration: 100,
      penetrated: true,
      ricochet: false,
    },
    external: [],
    penetration: {
      entry: new THREE.Vector3(0, 0.5, -2),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [
        {
          kind: 'shell',
          from: new THREE.Vector3(0, 0.5, -2),
          to: new THREE.Vector3(0, 0.5, 0.5),
          t0: 0,
          t1: 0.15,
          hitId: 'engine',
        },
      ],
      explosion: null,
      hits: [
        {
          kind: 'module',
          id: 'engine',
          name: '发动机',
          source: 'shell',
          damage: 100,
          destroyed: true,
          time: 0.1,
          hpBefore: 100,
          hpAfter: 0,
          maxHp: 100,
        },
      ],
      fuseArmed: true,
      detonated: false,
      knockedOut: false,
      duration: 0.3,
    },
    before: { engine: 1, ammo: 1, 'crew:0': 1 },
    after: { engine: 0, ammo: 1, 'crew:0': 1 },
    layout: {
      modules: [
        { id: 'engine', type: 'engine', part: 'hull', center: [0, 0.2, 0], size: [1, 1, 1.2] },
        { id: 'ammo', type: 'ammo', part: 'turret', center: [0, 0, 0.5], size: [0.8, 0.5, 0.5] },
      ],
      crew: [{ id: 'crew:0', role: 'driver', part: 'hull', center: [0, 0, -1] }],
    },
    destroyed: true,
    detonated: false,
  };
}

function makeTestVehicle(): XrayVehicle & { hullMesh: THREE.Mesh } {
  const root = new THREE.Group();
  const turretPivot = new THREE.Group();
  const gunPivot = new THREE.Group();
  root.add(turretPivot);
  turretPivot.add(gunPivot);

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x445566 });
  const hullMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), hullMat);
  root.add(hullMesh);

  return { root, turretPivot, gunPivot, hullMesh };
}

describe('worldReplayCameraPose 纯函数', () => {
  it('起点在弹道射来一侧 (位于 -replay.dir 方向)', () => {
    const replay = makeTestReplay();
    replay.dir.set(0, 0, 1); // 炮弹向 +Z 飞行, 来向为 -Z
    const bounds = { center: new THREE.Vector3(0, 1, 0), radius: 3 };

    const pose0 = worldReplayCameraPose(0, replay, bounds);
    // 相机在 center 相对来向一侧, 即 (position - center) 与 (-dir) 的点积大于 0
    const fromCenter = pose0.position.clone().sub(bounds.center);
    const incomingDir = new THREE.Vector3(0, 0, -1);
    expect(fromCenter.dot(incomingDir)).toBeGreaterThan(0);
  });

  it('环绕角度随时间单调递增 (无逆向抖动)', () => {
    const replay = makeTestReplay();
    const bounds = { center: new THREE.Vector3(0, 0, 0), radius: 3 };
    const timing = killcamDuration(replay);

    // 采样多个时刻
    const sampleTimes = [
      0,
      timing.tContact * 0.5,
      timing.tContact,
      timing.tContact + 0.1,
      timing.tContact + 0.3,
      timing.tEffectEnd,
      timing.total,
    ];

    const angles: number[] = [];
    for (const t of sampleTimes) {
      const pose = worldReplayCameraPose(t, replay, bounds);
      const camOffset = pose.position.clone().sub(bounds.center);
      // 水平投影角度 (atan2)
      angles.push(Math.atan2(camOffset.x, camOffset.z));
    }

    // 检查角度单调变化 (或由于连续旋转, 角度增量始终同号或为 0)
    for (let i = 1; i < angles.length; i++) {
      let diff = angles[i] - angles[i - 1];
      // 角度环绕边界处理
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      expect(diff).toBeGreaterThanOrEqual(-1e-5);
    }
  });

  it('结束时距离略增 (拉远视角)', () => {
    const replay = makeTestReplay();
    const bounds = { center: new THREE.Vector3(0, 0, 0), radius: 3 };
    const timing = killcamDuration(replay);

    const poseContact = worldReplayCameraPose(timing.tContact, replay, bounds);
    const poseEnd = worldReplayCameraPose(timing.total, replay, bounds);

    const distContact = poseContact.position.distanceTo(bounds.center);
    const distEnd = poseEnd.position.distanceTo(bounds.center);

    expect(distEnd).toBeGreaterThan(distContact);
    expect(distEnd / distContact).toBeCloseTo(1.2, 2);
  });
});

describe('worldReplayFade 纯函数', () => {
  const tContact = 0.8;
  const tEffectEnd = 1.5;
  const total = 2.0;

  it('接触前为 0 (真实外壳)', () => {
    expect(worldReplayFade(0, tContact, tEffectEnd, total)).toBe(0);
    expect(worldReplayFade(0.79, tContact, tEffectEnd, total)).toBe(0);
  });

  it('接触后 0.2s 内从 0 渐变到 1', () => {
    expect(worldReplayFade(tContact, tContact, tEffectEnd, total)).toBe(0);
    expect(worldReplayFade(tContact + 0.1, tContact, tEffectEnd, total)).toBeCloseTo(0.5, 5);
    expect(worldReplayFade(tContact + 0.2, tContact, tEffectEnd, total)).toBe(1);
  });

  it('后效期间保持 1', () => {
    expect(worldReplayFade(1.2, tContact, tEffectEnd, total)).toBe(1);
    expect(worldReplayFade(tEffectEnd, tContact, tEffectEnd, total)).toBe(1);
  });

  it('结束前平滑淡回 0', () => {
    expect(worldReplayFade((tEffectEnd + total) / 2, tContact, tEffectEnd, total)).toBeCloseTo(0.5, 5);
    expect(worldReplayFade(total, tContact, tEffectEnd, total)).toBe(0);
    expect(worldReplayFade(total + 0.5, tContact, tEffectEnd, total)).toBe(0);
  });
});

describe('worldReplayImpactMark 纯函数', () => {
  it('dt < 0 时不可见', () => {
    const mark = worldReplayImpactMark(-0.1);
    expect(mark.visible).toBe(false);
  });

  it('dt = 0 时圆盘不透明度最高且圆环就绪', () => {
    const mark = worldReplayImpactMark(0, 0.3);
    expect(mark.visible).toBe(true);
    expect(mark.disc.radius).toBe(0.3);
    expect(mark.disc.opacity).toBeCloseTo(0.55, 5);
    expect(mark.ring1.visible).toBe(true);
    expect(mark.ring1.scale).toBeCloseTo(1.0, 5);
    expect(mark.ring2.visible).toBe(false);
  });

  it('dt 增加时圆环向外扩散并淡出', () => {
    const mark = worldReplayImpactMark(0.3, 0.3);
    expect(mark.visible).toBe(true);
    expect(mark.ring1.scale).toBeGreaterThan(1.0);
    expect(mark.ring2.visible).toBe(true);
    expect(mark.ring2.scale).toBeGreaterThan(1.0);
    expect(mark.disc.opacity).toBeLessThan(0.55);
  });

  it('dt > 0.6 时完成并不可见', () => {
    const mark = worldReplayImpactMark(0.61);
    expect(mark.visible).toBe(false);
  });
});

describe('worldReplayTrajectoryPoints 纯函数', () => {
  const entry = new THREE.Vector3(0, 0, 0);
  const dir = new THREE.Vector3(0, 0, 1);
  const penEnd = new THREE.Vector3(0, 0, 2);

  it('t = 0 时从远处约 8m 开始', () => {
    const traj = worldReplayTrajectoryPoints(0, entry, dir, penEnd, 0.8, 0.3);
    expect(traj.start.z).toBeCloseTo(-8, 5);
    expect(traj.currentTip.distanceTo(traj.start)).toBeCloseTo(0, 5);
  });

  it('t = tContact 时到达弹着点 entry', () => {
    const traj = worldReplayTrajectoryPoints(0.8, entry, dir, penEnd, 0.8, 0.3);
    expect(traj.currentTip.distanceTo(entry)).toBeCloseTo(0, 5);
  });

  it('t > tContact 时在车内延伸至终点', () => {
    const traj = worldReplayTrajectoryPoints(1.1, entry, dir, penEnd, 0.8, 0.3);
    expect(traj.currentTip.distanceTo(penEnd)).toBeCloseTo(0, 5);
    expect(traj.points.length).toBe(3);
  });
});

describe('WorldReplay 类冒烟测试', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('play -> update 几步 -> stop, 场景与材质干净还原且无残留对象', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    const vehicle = makeTestVehicle();
    scene.add(vehicle.root);

    const initialSceneChildCount = scene.children.length; // 包含 vehicle.root
    const initialVehicleChildCount = vehicle.root.children.length;
    const origMaterial = vehicle.hullMesh.material;

    const replay = makeTestReplay();
    const worldReplay = new WorldReplay(scene, camera, host);

    expect(worldReplay.active).toBe(false);
    expect(worldReplay.finished).toBe(false);

    // 1. play
    worldReplay.play(vehicle, replay, 1000);
    expect(worldReplay.active).toBe(true);
    expect(worldReplay.finished).toBe(false);

    // 材质被克隆为 X 光材质
    expect(vehicle.hullMesh.material).not.toBe(origMaterial);
    expect(scene.children.length).toBeGreaterThan(initialSceneChildCount);

    // 2. update: 接触前
    worldReplay.update(1400); // t = 0.4s
    expect(worldReplay.active).toBe(true);
    expect(worldReplay.finished).toBe(false);

    // 3. update: 接触后后效中
    worldReplay.update(2000); // t = 1.0s
    expect(worldReplay.active).toBe(true);

    // 4. update: 播完 (total 之后)
    const timing = killcamDuration(replay);
    worldReplay.update(1000 + timing.total * 1000 + 100);
    expect(worldReplay.finished).toBe(true);
    expect(worldReplay.active).toBe(true); // active 保持 true 直到 stop

    // 5. stop: 清理一切
    worldReplay.stop();
    expect(worldReplay.active).toBe(false);
    expect(worldReplay.finished).toBe(false);

    // 场景新增对象全部移除
    expect(scene.children.length).toBe(initialSceneChildCount);
    expect(vehicle.root.children.length).toBe(initialVehicleChildCount);

    // 载具材质原样换回
    expect(vehicle.hullMesh.material).toBe(origMaterial);
  });

  it('车不在原点时,相机仍然贴着车(回归:包围盒曾把世界坐标混进本地坐标,相机飞到千米外)', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    const vehicle = makeTestVehicle();
    vehicle.root.position.set(0, 1, 1200);
    scene.add(vehicle.root);

    const worldReplay = new WorldReplay(scene, camera, host);
    worldReplay.play(vehicle, makeTestReplay(), 1000);
    for (const ms of [1000, 1400, 2000, 3000]) {
      worldReplay.update(ms);
      expect(camera.position.distanceTo(vehicle.root.position)).toBeLessThan(60);
    }
    worldReplay.stop();
  });

  it('根据 groundLuminance 参数控制接触前残骸材质是否提亮, 并在 stop 时还原原始材质', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    const vehicle = makeTestVehicle();
    scene.add(vehicle.root);
    const origMaterial = vehicle.hullMesh.material;
    const initialHex = (origMaterial as THREE.MeshStandardMaterial).color.getHex();

    const worldReplay = new WorldReplay(scene, camera, host);

    // 1. 暗地面(草地亮度 0.495): 接触前残骸材质提亮 1.8 倍
    worldReplay.play(vehicle, makeTestReplay(), 1000, { groundLuminance: 0.495 });
    const currentMatDark = vehicle.hullMesh.material as THREE.MeshStandardMaterial;
    expect(currentMatDark).not.toBe(origMaterial);
    const expectedColorDark = new THREE.Color(initialHex).multiplyScalar(1.8);
    expect(currentMatDark.color.r).toBeCloseTo(expectedColorDark.r, 3);
    expect(currentMatDark.color.g).toBeCloseTo(expectedColorDark.g, 3);
    expect(currentMatDark.color.b).toBeCloseTo(expectedColorDark.b, 3);

    worldReplay.stop();
    expect(vehicle.hullMesh.material).toBe(origMaterial);

    // 2. 亮地面(雪地亮度 0.914): 接触前残骸维持原色(不提亮)
    worldReplay.play(vehicle, makeTestReplay(), 1000, { groundLuminance: 0.914 });
    const currentMatSnow = vehicle.hullMesh.material as THREE.MeshStandardMaterial;
    expect(currentMatSnow).not.toBe(origMaterial);
    expect(currentMatSnow.color.getHex()).toBe(initialHex);

    worldReplay.stop();
    expect(vehicle.hullMesh.material).toBe(origMaterial);
  });
});

describe('wreckBrightenFactorFor 纯函数', () => {
  it('暗地面 (<= 0.55) 提亮 1.8 倍 (原色 0.25 -> 0.45)', () => {
    expect(wreckBrightenFactorFor(0)).toBeCloseTo(WRECK_BRIGHTEN_FACTOR_DARK, 5);
    expect(wreckBrightenFactorFor(0.3)).toBeCloseTo(1.8, 5);
    expect(wreckBrightenFactorFor(0.55)).toBeCloseTo(1.8, 5);
  });

  it('亮地面 (>= 0.75, 如雪地) 维持 1.0 倍 (不提亮)', () => {
    expect(wreckBrightenFactorFor(0.75)).toBeCloseTo(1.0, 5);
    expect(wreckBrightenFactorFor(0.9)).toBeCloseTo(1.0, 5);
    expect(wreckBrightenFactorFor(1.0)).toBeCloseTo(1.0, 5);
  });

  it('中间过渡段 (0.55..0.75) 平滑单调插值', () => {
    expect(wreckBrightenFactorFor(0.65)).toBeCloseTo(1.4, 5);
    expect(wreckBrightenFactorFor(0.6)).toBeGreaterThan(wreckBrightenFactorFor(0.7));
  });
});

