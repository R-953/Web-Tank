import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  KillCam,
  KILLCAM_ORBIT_DEGREES,
  killcamDuration,
  killcamCameraRig,
  killcamBounceDir,
  killcamModuleColor,
  killcamCrewColor,
  buildCrewFigure,
  killcamPriority,
  enqueueByPriority,
  MODULE_TYPE_COLORS,
} from '../src/ui/KillCam';
import type { HitReplay } from '../src/game/Game';
import { SHOOTER, TARGET } from './fixtures';

function createBaseReplay(overrides: Partial<HitReplay> = {}): HitReplay {
  return {
    spec: TARGET,
    shell: SHOOTER.weapons[0].ammo[0],
    turretYaw: 0,
    gunPitch: 0,
    part: 'hull',
    entry: new THREE.Vector3(0, 0.5, -1),
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
      entry: new THREE.Vector3(0, 0.5, -1),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [],
      explosion: null,
      hits: [],
      fuseArmed: true,
      detonated: false,
      knockedOut: false,
      duration: 0.3,
    },
    before: { engine: 1, driver: 1 },
    after: { engine: 1, driver: 1 },
    layout: {
      modules: [{ id: 'engine', type: 'engine', part: 'hull', center: [0, 0, 1], size: [1, 1, 1] }],
      crew: [{ id: 'driver', role: 'driver', part: 'hull', center: [0, 0, -1] }],
    },
    destroyed: false,
    detonated: false,
    ...overrides,
  };
}

describe('066-killcam-all-hits: 命中回放新特性纯逻辑测试', () => {
  describe('killcamDuration', () => {
    it('击穿类时长基于 penetration.duration 计算', () => {
      const replay = createBaseReplay({
        penetration: {
          entry: new THREE.Vector3(),
          dir: new THREE.Vector3(),
          segments: [],
          explosion: null,
          hits: [],
          fuseArmed: true,
          detonated: false,
          knockedOut: false,
          duration: 0.3,
        },
      });
      const d = killcamDuration(replay);
      // tContact = 0.8, tEffectEnd = 0.8 + 0.3 + 0.4 = 1.5, total = 1.5 + 0.5 = 2.0
      expect(d.tContact).toBeCloseTo(0.8, 5);
      expect(d.tEffectEnd).toBeCloseTo(1.5, 5);
      expect(d.total).toBeCloseTo(2.0, 5);
    });

    it('跳弹类时长固定为 contact + 1.0 + finishDelay', () => {
      const replay = createBaseReplay({
        penetration: null,
        armor: {
          face: 'front',
          armor: 80,
          angleDeg: 75,
          effectiveArmor: 250,
          penetration: 100,
          penetrated: false,
          ricochet: true,
        },
      });
      const d = killcamDuration(replay);
      // tContact = 0.8, tEffectEnd = 0.8 + 1.0 = 1.8, total = 1.8 + 0.5 = 2.3
      expect(d.tContact).toBeCloseTo(0.8, 5);
      expect(d.tEffectEnd).toBeCloseTo(1.8, 5);
      expect(d.total).toBeCloseTo(2.3, 5);
    });

    it('未击穿类(含打中炮管)时长与跳弹一致', () => {
      const replayNopen = createBaseReplay({
        penetration: null,
        armor: {
          face: 'front',
          armor: 120,
          angleDeg: 0,
          effectiveArmor: 120,
          penetration: 100,
          penetrated: false,
          ricochet: false,
        },
      });
      const d1 = killcamDuration(replayNopen);
      expect(d1.tContact).toBeCloseTo(0.8, 5);
      expect(d1.tEffectEnd).toBeCloseTo(1.8, 5);
      expect(d1.total).toBeCloseTo(2.3, 5);

      const replayBarrel = createBaseReplay({
        penetration: null,
        armor: null,
      });
      const d2 = killcamDuration(replayBarrel);
      expect(d2.tContact).toBeCloseTo(0.8, 5);
      expect(d2.tEffectEnd).toBeCloseTo(1.8, 5);
      expect(d2.total).toBeCloseTo(2.3, 5);
    });
  });

  describe('killcamCameraRig', () => {
    const center = new THREE.Vector3(0, 1.2, 0);
    const entry = new THREE.Vector3(0.5, 1.0, -1.8);
    const radius = 3.5;

    it('击穿类相机注视中心，保持 1.0 距离缩放与 90 度环绕', () => {
      const replay = createBaseReplay();
      const rig = killcamCameraRig(replay, center, radius, entry);
      expect(rig.target.x).toBeCloseTo(center.x, 5);
      expect(rig.target.y).toBeCloseTo(center.y, 5);
      expect(rig.target.z).toBeCloseTo(center.z, 5);
      expect(rig.distanceScale).toBe(1);
      expect(rig.orbitDeg).toBe(KILLCAM_ORBIT_DEGREES);
    });

    it('跳弹注视弹着点 entry，使用 0.75 距离缩放与 45 度环绕', () => {
      const replay = createBaseReplay({
        penetration: null,
        armor: {
          face: 'front',
          armor: 80,
          angleDeg: 75,
          effectiveArmor: 250,
          penetration: 100,
          penetrated: false,
          ricochet: true,
        },
      });
      const rig = killcamCameraRig(replay, center, radius, entry);
      expect(rig.target.x).toBeCloseTo(entry.x, 5);
      expect(rig.target.y).toBeCloseTo(entry.y, 5);
      expect(rig.target.z).toBeCloseTo(entry.z, 5);
      expect(rig.distanceScale).toBe(0.75);
      expect(rig.orbitDeg).toBe(KILLCAM_ORBIT_DEGREES / 2);
    });

    it('未击穿注视弹着点 entry，使用 0.75 距离缩放与 45 度环绕', () => {
      const replay = createBaseReplay({
        penetration: null,
        armor: null,
      });
      const rig = killcamCameraRig(replay, center, radius, entry);
      expect(rig.target.x).toBeCloseTo(entry.x, 5);
      expect(rig.target.y).toBeCloseTo(entry.y, 5);
      expect(rig.target.z).toBeCloseTo(entry.z, 5);
      expect(rig.distanceScale).toBe(0.75);
      expect(rig.orbitDeg).toBe(KILLCAM_ORBIT_DEGREES / 2);
    });
  });

  describe('killcamBounceDir', () => {
    it('垂直命中装甲面时几乎反向', () => {
      const dir = new THREE.Vector3(1, 0, 0);
      const normal = new THREE.Vector3(-1, 0, 0);
      const bounce = killcamBounceDir(dir, normal);
      expect(bounce.x).toBeCloseTo(-1, 5);
      expect(bounce.y).toBeCloseTo(0, 5);
      expect(bounce.z).toBeCloseTo(0, 5);
      expect(bounce.length()).toBeCloseTo(1, 5);
    });

    it('掠射大角度命中时几乎沿原方向', () => {
      const dir = new THREE.Vector3(1, 0.05, 0).normalize();
      const normal = new THREE.Vector3(0, -1, 0);
      const bounce = killcamBounceDir(dir, normal);
      expect(dir.dot(bounce)).toBeGreaterThan(0.99);
      expect(bounce.length()).toBeCloseTo(1, 5);
    });

    it('当 normal 与 dir 同向 (d·n > 0) 时自动朝向来弹修正', () => {
      const dir = new THREE.Vector3(0, 0, 1);
      // 传入了向内的法线 (0, 0, 1)
      const normalInward = new THREE.Vector3(0, 0, 1);
      const bounce = killcamBounceDir(dir, normalInward);
      // 修正后应反弹回 -Z
      expect(bounce.z).toBeCloseTo(-1, 5);
      expect(bounce.length()).toBeCloseTo(1, 5);
    });

    it('任意角度反射结果严格为单位向量', () => {
      const testCases = [
        { dir: new THREE.Vector3(1, 2, 3), normal: new THREE.Vector3(-1, 0, 0) },
        { dir: new THREE.Vector3(-2, 1, -1), normal: new THREE.Vector3(0, 1, 1) },
        { dir: new THREE.Vector3(0.3, -0.8, 0.5), normal: new THREE.Vector3(0.5, 0.2, -0.8) },
      ];
      for (const tc of testCases) {
        const bounce = killcamBounceDir(tc.dir, tc.normal);
        expect(bounce.length()).toBeCloseTo(1, 5);
      }
    });
  });

  describe('killcamModuleColor 与 killcamCrewColor', () => {
    it('完好状态返回对应模块类型色', () => {
      expect(killcamModuleColor('ammo', 1)).toBe(MODULE_TYPE_COLORS.ammo);
      expect(killcamModuleColor('engine', 1)).toBe(MODULE_TYPE_COLORS.engine);
      expect(killcamModuleColor('fuel', 1)).toBe(MODULE_TYPE_COLORS.fuel);
      expect(killcamModuleColor('transmission', 1)).toBe(MODULE_TYPE_COLORS.transmission);
    });

    it('半血状态按比例向红色 0xff3b30 插值', () => {
      const ammoHalf = killcamModuleColor('ammo', 0.5);
      const ammoFull = MODULE_TYPE_COLORS.ammo;
      const red = 0xff3b30;
      expect(ammoHalf).not.toBe(ammoFull);
      expect(ammoHalf).not.toBe(red);

      const cAmmo = new THREE.Color(ammoFull).lerp(new THREE.Color(red), 0.5).getHex();
      expect(ammoHalf).toBe(cAmmo);
    });

    it('报废状态 (ratio <= 0) 返回近黑色 0x1a1a1a', () => {
      expect(killcamModuleColor('ammo', 0)).toBe(0x1a1a1a);
      expect(killcamModuleColor('engine', -0.5)).toBe(0x1a1a1a);
      expect(killcamCrewColor(0)).toBe(0x1a1a1a);
      expect(killcamCrewColor(-1)).toBe(0x1a1a1a);
    });

    it('乘员完好为 0x9fb6c7，受损向红色插值', () => {
      expect(killcamCrewColor(1)).toBe(0x9fb6c7);
      const crewHalf = killcamCrewColor(0.5);
      const expected = new THREE.Color(0x9fb6c7).lerp(new THREE.Color(0xff3b30), 0.5).getHex();
      expect(crewHalf).toBe(expected);
    });
  });

  describe('buildCrewFigure', () => {
    it('生成坐姿人形模型，包围盒高度约 1.0 m', () => {
      const figure = buildCrewFigure();
      expect(figure).toBeInstanceOf(THREE.Group);

      const box = new THREE.Box3().setFromObject(figure);
      const size = box.getSize(new THREE.Vector3());
      expect(size.y).toBeCloseTo(1.0, 1);
    });

    it('包含头、躯干与四肢部件且具有轮廓线', () => {
      const figure = buildCrewFigure();
      const head = figure.getObjectByName('head') as THREE.Mesh;
      const torso = figure.getObjectByName('torso') as THREE.Mesh;
      const thighL = figure.getObjectByName('thigh_l') as THREE.Mesh;
      const thighR = figure.getObjectByName('thigh_r') as THREE.Mesh;
      const calfL = figure.getObjectByName('calf_l') as THREE.Mesh;
      const calfR = figure.getObjectByName('calf_r') as THREE.Mesh;

      expect(head).toBeDefined();
      expect(torso).toBeDefined();
      expect(thighL).toBeDefined();
      expect(thighR).toBeDefined();
      expect(calfL).toBeDefined();
      expect(calfR).toBeDefined();

      // 各部件挂有 EdgesGeometry 轮廓线
      for (const part of [head, torso, thighL, thighR, calfL, calfR]) {
        const line = part.children.find((c) => c instanceof THREE.LineSegments);
        expect(line).toBeDefined();
      }
    });
  });

  describe('killcamPriority 与 enqueueByPriority', () => {
    it('根据击中结果确定优先级: ricochet 1 < nopen 2 < penetrated 3 < crew-out 4 < ammo-exploded 5', () => {
      // 1. 跳弹
      const rRicochet = createBaseReplay({
        penetration: null,
        armor: { face: 'front', armor: 80, angleDeg: 75, effectiveArmor: 200, penetration: 100, penetrated: false, ricochet: true },
      });
      expect(killcamPriority(rRicochet)).toBe(1);

      // 2. 未击穿
      const rNopen = createBaseReplay({
        penetration: null,
        armor: { face: 'front', armor: 80, angleDeg: 0, effectiveArmor: 80, penetration: 60, penetrated: false, ricochet: false },
      });
      expect(killcamPriority(rNopen)).toBe(2);

      // 2b. 直接打中炮管 (armor 为 null)
      const rNoArmor = createBaseReplay({ penetration: null, armor: null });
      expect(killcamPriority(rNoArmor)).toBe(2);

      // 3. 击穿但未击伤乘员且未殉爆
      const rPen = createBaseReplay();
      expect(killcamPriority(rPen)).toBe(3);

      // 4. 乘员失去战斗力
      const rCrewOut = createBaseReplay({
        before: { driver: 1 },
        after: { driver: 0 },
      });
      expect(killcamPriority(rCrewOut)).toBe(4);

      // 5. 弹药殉爆
      const rAmmoExp = createBaseReplay({
        detonated: true,
      });
      expect(killcamPriority(rAmmoExp)).toBe(5);
    });

    it('队列未满直接入队', () => {
      const q: Array<{ id: number; replay: HitReplay }> = [];
      const item1 = { id: 1, replay: createBaseReplay() }; // pri 3
      enqueueByPriority(q, item1, 2);
      expect(q).toEqual([item1]);

      const item2 = { id: 2, replay: createBaseReplay({ detonated: true }) }; // pri 5
      enqueueByPriority(q, item2, 2);
      expect(q).toEqual([item1, item2]);
    });

    it('满队列丢最低优先级项', () => {
      const q = [
        { id: 1, replay: createBaseReplay() }, // pri 3
        { id: 2, replay: createBaseReplay({ armor: { face: 'front', armor: 80, angleDeg: 75, effectiveArmor: 200, penetration: 100, penetrated: false, ricochet: true } }) }, // pri 1
      ];
      const newItem = { id: 3, replay: createBaseReplay({ before: { driver: 1 }, after: { driver: 0 } }) }; // pri 4

      enqueueByPriority(q, newItem, 2);
      // item 2 (pri 1) 最低被丢，q 变为 [item1, newItem]
      expect(q.map((x) => x.id)).toEqual([1, 3]);
    });

    it('满队列且存在同级最低时丢最旧的', () => {
      const q = [
        { id: 1, replay: createBaseReplay({ armor: { face: 'front', armor: 80, angleDeg: 0, effectiveArmor: 80, penetration: 60, penetrated: false, ricochet: false } }) }, // pri 2 (旧)
        { id: 2, replay: createBaseReplay({ armor: { face: 'front', armor: 80, angleDeg: 0, effectiveArmor: 80, penetration: 60, penetrated: false, ricochet: false } }) }, // pri 2 (新)
      ];
      const newItem = { id: 3, replay: createBaseReplay() }; // pri 3

      enqueueByPriority(q, newItem, 2);
      // id 1 和 id 2 均为最低 pri 2，丢最旧的 id 1
      expect(q.map((x) => x.id)).toEqual([2, 3]);
    });

    it('新来的如果是最低优先级则丢新来的', () => {
      const q = [
        { id: 1, replay: createBaseReplay({ detonated: true }) }, // pri 5
        { id: 2, replay: createBaseReplay() }, // pri 3
      ];
      const lowItem = {
        id: 3,
        replay: createBaseReplay({ armor: { face: 'front', armor: 80, angleDeg: 75, effectiveArmor: 200, penetration: 100, penetrated: false, ricochet: true } }),
      }; // pri 1

      enqueueByPriority(q, lowItem, 2);
      // lowItem 最低，丢 lowItem，q 保持不变
      expect(q.map((x) => x.id)).toEqual([1, 2]);

      // 同级最低也丢新来的
      const tieLowItem = { id: 4, replay: createBaseReplay() }; // pri 3
      enqueueByPriority(q, tieLowItem, 2);
      expect(q.map((x) => x.id)).toEqual([1, 2]);
    });
  });

  describe('KillCam 类在各种命中场景下的完整生命周期', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('跳弹回放 play 后 active 为 true，可正常更新与停止', () => {
      const killcam = new KillCam(container);
      const r = createBaseReplay({
        penetration: null,
        armor: {
          face: 'front',
          armor: 80,
          angleDeg: 75,
          effectiveArmor: 250,
          penetration: 100,
          penetrated: false,
          ricochet: true,
        },
      });

      killcam.play(r);
      expect(killcam.active).toBe(true);

      const now = performance.now();
      expect(() => killcam.update(now + 200)).not.toThrow();
      expect(() => killcam.update(now + 1000)).not.toThrow();

      killcam.stop();
      expect(killcam.active).toBe(false);
    });

    it('未击穿带外挂模块回放 play 后正常更新与外挂模块显隐', () => {
      const killcam = new KillCam(container);
      const r = createBaseReplay({
        penetration: null,
        armor: {
          face: 'side',
          armor: 40,
          angleDeg: 0,
          effectiveArmor: 40,
          penetration: 30,
          penetrated: false,
          ricochet: false,
        },
        external: [
          {
            id: 'track_l',
            name: '左履带',
            kind: 'module',
            source: 'external',
            damage: 80,
            hpBefore: 100,
            hpAfter: 20,
            maxHp: 100,
            destroyed: false,
            time: 0,
          },
        ],
        layout: {
          modules: [
            { id: 'track_l', type: 'track', part: 'hull', center: [-1.2, 0, 0], size: [0.4, 0.5, 4] },
            { id: 'engine', type: 'engine', part: 'hull', center: [0, 0, 1], size: [1, 1, 1] },
          ],
          crew: [{ id: 'driver', role: 'driver', part: 'hull', center: [0, 0, -1] }],
        },
      });

      killcam.play(r);
      expect(killcam.active).toBe(true);

      const now = performance.now();
      // t = 0 (接触前)
      killcam.update(now);
      // t = 1.0s (接触后淡入阶段)
      killcam.update(now + 1000);

      const parts = (killcam as unknown as { parts: Array<{ id: string; mesh: THREE.Mesh; kind: string }> }).parts;
      const trackPart = parts.find((p) => p.id === 'track_l');
      const enginePart = parts.find((p) => p.id === 'engine');
      const crewPart = parts.find((p) => p.kind === 'crew');

      // 外挂受损模块淡入可见
      expect(trackPart?.mesh.visible).toBe(true);
      // 内部模块与乘员在未击穿时不可见
      expect(enginePart?.mesh.visible).toBe(false);
      expect(crewPart?.mesh.visible).toBe(false);

      killcam.stop();
      expect(killcam.active).toBe(false);
    });

    it('击穿且殉爆回放 play 后正常渲染各阶段', () => {
      const killcam = new KillCam(container);
      const r = createBaseReplay({
        detonated: true,
        penetration: {
          entry: new THREE.Vector3(0, 0.5, -1),
          dir: new THREE.Vector3(0, 0, 1),
          segments: [],
          explosion: { center: new THREE.Vector3(0, 0, 0), radius: 1.5, time: 0.1 },
          hits: [],
          fuseArmed: true,
          detonated: true,
          knockedOut: true,
          duration: 0.3,
        },
      });

      killcam.play(r);
      expect(killcam.active).toBe(true);

      const now = performance.now();
      expect(() => killcam.update(now)).not.toThrow();
      expect(() => killcam.update(now + 900)).not.toThrow();
      expect(() => killcam.update(now + 1500)).not.toThrow();

      killcam.stop();
      expect(killcam.active).toBe(false);
    });
  });
});
