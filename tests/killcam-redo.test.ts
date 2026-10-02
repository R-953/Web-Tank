import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  KillCam,
  KILLCAM_ORBIT_DEGREES,
  KILLCAM_ORBIT_DIRECTION,
  killcamNormalizeYaw,
  killcamOrbitAngle,
  killcamInternalsOpacity,
} from '../src/ui/KillCam';
import type { HitReplay } from '../src/game/Game';
import { SHOOTER, TARGET } from './fixtures';

describe('KillCam 常量与规范化纯函数', () => {
  it('KILLCAM_ORBIT_DEGREES 为 90 度，KILLCAM_ORBIT_DIRECTION 为 1 或 -1', () => {
    expect(KILLCAM_ORBIT_DEGREES).toBe(90);
    expect([1, -1]).toContain(KILLCAM_ORBIT_DIRECTION);
  });

  describe('killcamNormalizeYaw', () => {
    it('四个主方向能正确计算转到 +X 轴所需的绕 Y 轴旋转角', () => {
      // 1. 本身沿 +X 方向，旋转角应为 0
      const yawX = killcamNormalizeYaw({ x: 1, y: 0, z: 0 });
      expect(yawX).toBeCloseTo(0, 5);

      // 2. 沿 +Z 方向，绕 Y 轴正向转 PI/2 会将 (0, 0, 1) 转到 (1, 0, 0)
      const yawZ = killcamNormalizeYaw({ x: 0, y: 0, z: 1 });
      expect(yawZ).toBeCloseTo(Math.PI / 2, 5);

      // 3. 沿 -X 方向，旋转角应为 PI
      const yawNegX = killcamNormalizeYaw({ x: -1, y: 0, z: 0 });
      expect(Math.abs(yawNegX)).toBeCloseTo(Math.PI, 5);

      // 4. 沿 -Z 方向，旋转角应为 -PI/2
      const yawNegZ = killcamNormalizeYaw({ x: 0, y: 0, z: -1 });
      expect(yawNegZ).toBeCloseTo(-Math.PI / 2, 5);

      // 验证旋转后的水平分量均严格指向 +X 且 Z 分量为 0
      for (const dir of [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: -1 },
      ]) {
        const yaw = killcamNormalizeYaw(dir);
        const rot = new THREE.Vector3(dir.x, dir.y, dir.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        expect(rot.x).toBeGreaterThan(0.99);
        expect(rot.z).toBeCloseTo(0, 5);
      }
    });

    it('竖直向下(水平分量接近 0)时取旋转角 0', () => {
      expect(killcamNormalizeYaw({ x: 0, y: -1, z: 0 })).toBe(0);
      expect(killcamNormalizeYaw({ x: 0, y: 1, z: 0 })).toBe(0);
      expect(killcamNormalizeYaw({ x: 1e-8, y: -1, z: 1e-8 })).toBe(0);
    });

    it('带俯仰角时只转水平方向，俯仰分量 y 保持且水平分量转到 +X', () => {
      const dirs = [
        { x: 1, y: 2, z: 0 },
        { x: 0, y: -3, z: 1 },
        { x: 1, y: 0.5, z: 1 },
        { x: -2, y: -1.5, z: 2 },
      ];

      for (const dir of dirs) {
        const yaw = killcamNormalizeYaw(dir);
        const rot = new THREE.Vector3(dir.x, dir.y, dir.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        // 水平分量指向 +X
        expect(rot.x).toBeGreaterThan(0);
        expect(rot.z).toBeCloseTo(0, 5);
        // 俯仰保持不变
        expect(rot.y).toBeCloseTo(dir.y, 5);
      }
    });
  });

  describe('killcamOrbitAngle', () => {
    const tImpact = 0.8;
    const tEnd = 2.0;

    it('入射前(t <= tImpact)角度为 0', () => {
      expect(killcamOrbitAngle(0, tImpact, tEnd)).toBe(0);
      expect(killcamOrbitAngle(0.4, tImpact, tEnd)).toBe(0);
      expect(killcamOrbitAngle(tImpact, tImpact, tEnd)).toBe(0);
    });

    it('结束时刻(t >= tEnd)为目标角度', () => {
      const targetRad = THREE.MathUtils.degToRad(KILLCAM_ORBIT_DEGREES);
      expect(killcamOrbitAngle(tEnd, tImpact, tEnd)).toBeCloseTo(targetRad, 5);
      expect(killcamOrbitAngle(tEnd + 0.5, tImpact, tEnd)).toBeCloseTo(targetRad, 5);
      expect(killcamOrbitAngle(10, tImpact, tEnd)).toBeCloseTo(targetRad, 5);

      // 支持自定义度数
      expect(killcamOrbitAngle(tEnd, tImpact, tEnd, 180)).toBeCloseTo(Math.PI, 5);
    });

    it('在 [tImpact, tEnd] 区间内严格单调递增', () => {
      const steps = 20;
      let prev = 0;
      for (let i = 1; i <= steps; i++) {
        const t = tImpact + ((tEnd - tImpact) * i) / steps;
        const current = killcamOrbitAngle(t, tImpact, tEnd);
        expect(current).toBeGreaterThan(prev);
        prev = current;
      }
    });

    it('端点斜率平滑(smoothstep，两端导数为 0)', () => {
      const dt = 1e-4;
      // tImpact 处的数值导数
      const slopeStart = (killcamOrbitAngle(tImpact + dt, tImpact, tEnd) - killcamOrbitAngle(tImpact, tImpact, tEnd)) / dt;
      expect(slopeStart).toBeCloseTo(0, 2);

      // tEnd 处的数值导数
      const slopeEnd = (killcamOrbitAngle(tEnd, tImpact, tEnd) - killcamOrbitAngle(tEnd - dt, tImpact, tEnd)) / dt;
      expect(slopeEnd).toBeCloseTo(0, 2);
    });

    it('tEnd <= tImpact 时安全处理不除零', () => {
      const targetRad = THREE.MathUtils.degToRad(KILLCAM_ORBIT_DEGREES);
      expect(killcamOrbitAngle(0.5, 1.0, 1.0)).toBe(0);
      expect(killcamOrbitAngle(1.5, 1.0, 1.0)).toBe(targetRad);
      expect(killcamOrbitAngle(1.0, 1.0, 0.5)).toBe(targetRad);
    });
  });

  describe('killcamInternalsOpacity', () => {
    const tContact = 0.8;
    const tEnd = 2.0;
    const fadeIn = 0.25;
    const fadeOut = 0.4;

    it('接触前为 0', () => {
      expect(killcamInternalsOpacity(0, tContact, tEnd, fadeIn, fadeOut)).toBe(0);
      expect(killcamInternalsOpacity(0.5, tContact, tEnd, fadeIn, fadeOut)).toBe(0);
      expect(killcamInternalsOpacity(tContact - 0.001, tContact, tEnd, fadeIn, fadeOut)).toBe(0);
    });

    it('淡入阶段从 0 平滑上升到 1', () => {
      const valMid = killcamInternalsOpacity(tContact + fadeIn / 2, tContact, tEnd, fadeIn, fadeOut);
      expect(valMid).toBeCloseTo(0.5, 5);

      const valStart = killcamInternalsOpacity(tContact, tContact, tEnd, fadeIn, fadeOut);
      expect(valStart).toBe(0);

      const valEnd = killcamInternalsOpacity(tContact + fadeIn, tContact, tEnd, fadeIn, fadeOut);
      expect(valEnd).toBeCloseTo(1, 5);
    });

    it('中间后效活跃阶段为 1', () => {
      expect(killcamInternalsOpacity(tContact + fadeIn, tContact, tEnd, fadeIn, fadeOut)).toBe(1);
      expect(killcamInternalsOpacity((tContact + fadeIn + tEnd) / 2, tContact, tEnd, fadeIn, fadeOut)).toBe(1);
      expect(killcamInternalsOpacity(tEnd, tContact, tEnd, fadeIn, fadeOut)).toBe(1);
    });

    it('淡出阶段从 1 平滑下降到 0', () => {
      const valMid = killcamInternalsOpacity(tEnd + fadeOut / 2, tContact, tEnd, fadeIn, fadeOut);
      expect(valMid).toBeCloseTo(0.5, 5);

      const val1 = killcamInternalsOpacity(tEnd + fadeOut * 0.25, tContact, tEnd, fadeIn, fadeOut);
      const val2 = killcamInternalsOpacity(tEnd + fadeOut * 0.75, tContact, tEnd, fadeIn, fadeOut);
      expect(val1).toBeGreaterThan(val2);
    });

    it('结束后(t >= tEnd + fadeOut)为 0', () => {
      expect(killcamInternalsOpacity(tEnd + fadeOut, tContact, tEnd, fadeIn, fadeOut)).toBe(0);
      expect(killcamInternalsOpacity(tEnd + fadeOut + 0.1, tContact, tEnd, fadeIn, fadeOut)).toBe(0);
      expect(killcamInternalsOpacity(10, tContact, tEnd, fadeIn, fadeOut)).toBe(0);
    });

    it('fadeIn / fadeOut 为 0 时不除零、不产生 NaN', () => {
      // 瞬间淡入淡出
      expect(killcamInternalsOpacity(0.5, 1.0, 2.0, 0, 0)).toBe(0);
      expect(killcamInternalsOpacity(1.0, 1.0, 2.0, 0, 0)).toBe(1);
      expect(killcamInternalsOpacity(1.5, 1.0, 2.0, 0, 0)).toBe(1);
      expect(killcamInternalsOpacity(2.0, 1.0, 2.0, 0, 0)).toBe(0);
      expect(killcamInternalsOpacity(2.5, 1.0, 2.0, 0, 0)).toBe(0);
    });
  });
});

describe('KillCam 场景重做与相机行为集成', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function makeReplay(dir = new THREE.Vector3(0, 0, 1)): HitReplay {
    return {
      spec: TARGET,
      shell: SHOOTER.weapons[0].ammo[0],
      turretYaw: 0,
      gunPitch: 0,
      part: 'hull',
      entry: new THREE.Vector3(0, 0.5, -1),
      dir,
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
        dir,
        segments: [],
        explosion: null,
        hits: [],
        fuseArmed: true,
        detonated: false,
        knockedOut: true,
        duration: 0.3,
      },
      before: { engine: 1 },
      after: { engine: 0.4 },
      layout: {
        modules: [{ id: 'engine', type: 'engine', part: 'hull', center: [0, 0, 1], size: [1, 1, 1] }],
        crew: [{ id: 'driver', role: 'driver', part: 'hull', center: [0, 0, -1] }],
      },
      destroyed: false,
      detonated: false,
    };
  }

  it('场景根节点 root 统一旋转，使 dir 的水平分量规范化为 +X', () => {
    const killcam = new KillCam(container);
    // 从 +Z 方向入射的炮弹
    const r = makeReplay(new THREE.Vector3(0, 0, 1));
    killcam.play(r);

    const root = (killcam as unknown as { root: THREE.Group }).root;
    expect(root).toBeDefined();
    // killcamNormalizeYaw(0, 0, 1) 为 PI / 2
    expect(root.rotation.y).toBeCloseTo(Math.PI / 2, 5);

    killcam.stop();
  });

  it('入射前相机位于 -X 侧顺着 +X 看，内构不可见；后效期间环绕 90 度并淡入淡出', () => {
    const killcam = new KillCam(container);
    const r = makeReplay(new THREE.Vector3(1, 0, 0));
    killcam.play(r);

    const parts = (killcam as unknown as { parts: Array<{ mesh: THREE.Mesh }> }).parts;
    const worldCenter = (killcam as unknown as { worldCenter: THREE.Vector3 }).worldCenter;

    // 1. t = 0 (入射前)
    const now = performance.now();
    killcam.update(now);

    // 相机在 -X 侧
    expect(killcam.camera.position.x).toBeLessThan(worldCenter.x);
    // 仰角 15 度，Y 高于 center
    expect(killcam.camera.position.y).toBeGreaterThan(worldCenter.y);
    // Z 偏移量接近 0
    expect(killcam.camera.position.z).toBeCloseTo(worldCenter.z, 3);

    // 内构在接触前透明度为 0
    for (const p of parts) {
      expect((p.mesh.material as THREE.MeshBasicMaterial).opacity).toBe(0);
      expect(p.mesh.visible).toBe(false);
    }

    // 2. t = 0.8 + 0.25 (淡入完成)
    killcam.update(now + 1050);
    for (const p of parts) {
      expect((p.mesh.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(0.5);
      expect(p.mesh.visible).toBe(true);
    }

    // 3. t = 0.8 + 0.3 + 0.4 = 1.5s (后效结束时刻)
    killcam.update(now + 1500);
    // 相机转到 +Z 侧
    expect(killcam.camera.position.z).toBeGreaterThan(worldCenter.z);
    expect(killcam.camera.position.x).toBeCloseTo(worldCenter.x, 2);

    // 4. t = 1.5s + 0.4s = 1.9s (淡出完成)
    killcam.update(now + 1900);
    for (const p of parts) {
      expect((p.mesh.material as THREE.MeshBasicMaterial).opacity).toBe(0);
      expect(p.mesh.visible).toBe(false);
    }

    // 5. t = 1.5s + 0.5s = 2.0s (回放结束，去掉 HOLD)
    killcam.update(now + 2050);
    expect(killcam.active).toBe(false);
  });
});
