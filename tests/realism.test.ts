/**
 * 物理校验:把游戏里的弹道、穿深、机动和真实资料对照(出处与完整数据见 docs/physics-validation.md)。
 * 允许小范围误差,但每一项都有明确的容差,超出就报错,防止以后调参把数值调「离谱」。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { VEHICLES } from '../src/data/vehicles';
import type { ShellSpec } from '../src/data/types';
import { dragK } from '../src/data/shells';
import { resolveHit } from '../src/game/Damage';
import { BRAKE_DECEL, REVERSE_SPEED_RATIO, ROLLING_RESISTANCE } from '../src/game/Vehicle';
import { PENETRATION_TABLES, REAL_VEHICLES } from './reference';
import { DT, drivingRig, flyShell, referenceAccelTime, slopeRig } from './sim';

const G = 9.81;
const DEG = Math.PI / 180;
const relErr = (sim: number, ref: number) => Math.abs(sim - ref) / ref;
const shellOf = (vehicleId: string, shellId: string): ShellSpec =>
  VEHICLES[vehicleId].weapons[0].ammo.find((a) => a.id === shellId)!;

beforeAll(async () => {
  await RAPIER.init();
});

describe('弹道与穿深(对照实测穿深表)', () => {
  const tolerance: Record<string, number> = {
    pzgr39: 0.03,
    pzgr39_43: 0.05,
    br365: 0.03,
    pzgr40: 0.03,
    pzgr40_43: 0.03,
    // 线轴式硬芯弹远距离衰减极快,1500 m 处计算值本身就很分散(73–85mm)
    br365p: 0.08,
  };

  for (const table of PENETRATION_TABLES) {
    it(`${table.shellId}:垂直板穿深随距离衰减,误差 ≤ ${tolerance[table.shellId] * 100}%`, () => {
      const ranges = Object.keys(table.flat).map(Number);
      for (const s of flyShell(shellOf(table.vehicleId, table.shellId), ranges)) {
        expect(relErr(s.penetration, table.flat[s.range])).toBeLessThanOrEqual(tolerance[table.shellId]);
      }
    });
  }

  it('近距离 30° 倾角板:几何等效厚度规则与实测误差 ≤ 10%(远距离偏差见报告)', () => {
    for (const table of PENETRATION_TABLES.filter((t) => t.at30)) {
      const [s] = flyShell(shellOf(table.vehicleId, table.shellId), [100]);
      // 本项目规则:能击穿的 30° 板厚 = 穿深 × cos30°
      expect(relErr(s.penetration * Math.cos(30 * DEG), table.at30![100])).toBeLessThanOrEqual(0.1);
    }
  });

  it('60Hz 弹道积分与 1ms 步长的高精度积分一致(飞行时间、下坠误差 < 1%)', () => {
    const w = shellOf('tiger_i', 'pzgr39');
    const k = dragK(w);
    const [s] = flyShell(w, [1000]);
    // 同一方程 dv/dt = −k|v|v + g,1ms 步长积分
    let x = 0, y = 0, vx = w.muzzleVelocity, vy = 0, t = 0;
    const h = 1e-3;
    while (x < 1000) {
      const v = Math.hypot(vx, vy);
      vx -= k * v * vx * h;
      vy -= (k * v * vy + G) * h;
      x += vx * h;
      y += vy * h;
      t += h;
    }
    expect(relErr(s.time, t)).toBeLessThan(0.01);
    expect(relErr(s.drop, -y)).toBeLessThan(0.01);
    // 有空气阻力时一定比真空里飞得慢、掉得多
    expect(s.time).toBeGreaterThan(1000 / w.muzzleVelocity);
    expect(s.drop).toBeGreaterThan(0.5 * G * (1000 / w.muzzleVelocity) ** 2);
  });
});

describe('历史对局常识', () => {
  const front = { x: 0, y: 0, z: -1 };
  const fromAngle = (deg: number) => ({ x: Math.sin(deg * DEG), y: 0, z: Math.cos(deg * DEG) });
  const hit = (vehicleId: string, shellId: string, range: number, targetId: string, angleDeg: number) => {
    const w = shellOf(vehicleId, shellId);
    const [s] = flyShell(w, [range]);
    return resolveHit({ ...w, penetration: s.penetration }, VEHICLES[targetId].armor, fromAngle(angleDeg), front);
  };

  it('虎式 88 L/56 在 1400 m、30° 侧角能击穿 T-34-85 正面(Wa Prüf 估算:100–1400 m)', () => {
    expect(hit('tiger_i', 'pzgr39', 1400, 't34_85', 30).penetrated).toBe(true);
  });

  it('T-34-85 的 85 炮在 500 m 能击穿虎式正面 100mm', () => {
    expect(hit('t34_85', 'br365', 500, 'tiger_i', 0).penetrated).toBe(true);
  });

  it('虎式 88 L/56 在任何距离都打不穿虎王正面', () => {
    expect(hit('tiger_i', 'pzgr39', 10, 'tiger_ii', 0).penetrated).toBe(false);
  });

  it('虎王 88 L/71 在 2000 m 仍能正面击穿虎式', () => {
    expect(hit('tiger_ii', 'pzgr39_43', 2000, 'tiger_i', 0).penetrated).toBe(true);
  });
});

describe('机动(发动机功率、滚动阻力、附着力)', () => {
  const c = ROLLING_RESISTANCE * G;

  for (const id of ['tiger_i', 't34_85', 'tiger_ii']) {
    const spec = VEHICLES[id];
    const vMax = spec.maxSpeed / 3.6;

    it(`${spec.name}:平地极速、加速曲线、功率约束`, () => {
      const r = drivingRig(spec);
      r.run(0.5);
      const marks = [10, 20, 30].map((k) => ({ kmh: k, t: NaN }));
      let t = 0;
      let prev = r.speed();
      let maxPowerRatio = 0;
      for (let i = 0; i < 100 / DT; i++) {
        r.step({ throttle: 1 });
        t += DT;
        const v = r.speed();
        // P = F·v:每一步用掉的牵引功率不能超过由极速反推的有效功率
        if (v > 1.5) maxPowerRatio = Math.max(maxPowerRatio, (((v - prev) / DT + c) * (v + prev)) / 2 / (c * vMax));
        prev = v;
        for (const m of marks) if (Number.isNaN(m.t) && v * 3.6 >= m.kmh) m.t = t;
      }
      expect(r.speed() / vMax).toBeGreaterThan(0.97);
      expect(r.speed() / vMax).toBeLessThanOrEqual(1.005);
      expect(maxPowerRatio).toBeLessThan(1.05);
      for (const m of marks) expect(relErr(m.t, referenceAccelTime(spec, m.kmh, ROLLING_RESISTANCE))).toBeLessThan(0.03);
    });

    it(`${spec.name}:反推的有效功率 / 发动机功率落在合理传动效率(55%–95%)`, () => {
      const real = REAL_VEHICLES[id];
      const effectiveKW = (c * vMax * real.massT * 1000) / 1000;
      const eta = effectiveKW / real.engineKW;
      expect(eta).toBeGreaterThan(0.55);
      expect(eta).toBeLessThan(0.95);
    });

    it(`${spec.name}:倒车极速 5–12 km/h,刹车不超过履带附着极限`, () => {
      const reverseKmh = spec.maxSpeed * REVERSE_SPEED_RATIO;
      expect(reverseKmh).toBeGreaterThanOrEqual(5);
      expect(reverseKmh).toBeLessThanOrEqual(12);

      const r = drivingRig(spec);
      r.run(0.5);
      r.run(60, { throttle: 1 });
      const v0 = r.speed();
      const p0 = r.v.physicsPosition();
      while (r.v.forwardSpeed > 0.01) r.step({ throttle: -1 });
      const decel = Math.max(BRAKE_DECEL, spec.hull.acceleration);
      expect(decel).toBeLessThanOrEqual(0.8 * G);
      // 刹停距离 ≈ v²/(2a)
      expect(relErr(r.v.physicsPosition().distanceTo(p0), (v0 * v0) / (2 * decel))).toBeLessThan(0.1);
    });

    it(`${spec.name}:碰撞体质量与战斗全重误差 ≤ 25%`, () => {
      const r = drivingRig(spec);
      expect(relErr(r.v.body.mass() / 1000, REAL_VEHICLES[id].massT)).toBeLessThanOrEqual(0.25);
    });
  }

  it('虎式爬坡:30° 能爬上去,40° 爬不上(理论极限 asin((a − c)/g) ≈ 34°)', () => {
    const climb = (deg: number) => {
      const r = slopeRig(VEHICLES.tiger_i, deg);
      r.run(1);
      const p0 = r.v.physicsPosition();
      r.run(15, { throttle: 1 });
      return r.v.physicsPosition().sub(p0).dot(r.upSlope);
    };
    expect(climb(30)).toBeGreaterThan(5);
    expect(climb(40)).toBeLessThan(1);
  });

  it('虎式炮塔转 180° 用时 = 180 / turretRotationSpeed(19°/s ≈ 9.5 s)', () => {
    const spec = VEHICLES.tiger_i;
    const r = drivingRig(spec);
    r.run(0.5);
    const behind = new THREE.Vector3(0.001, 2, 200); // 正后方
    let t = 0;
    while (Math.abs(r.v.turretYaw) < Math.PI - 1e-3 && t < 30) {
      r.step({ aimPoint: behind });
      t += DT;
    }
    expect(relErr(t, 180 / spec.turretRotationSpeed)).toBeLessThan(0.02);
  });
});
