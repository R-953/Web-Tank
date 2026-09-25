import { describe, it, expect } from 'vitest';
import {
  MAX_IMPACT_ANGLE_DEG,
  armorForFace,
  classifyFace,
  effectiveArmor,
  impactAngleDeg,
  resolveHit,
} from '../src/game/Damage';

const ARMOR = { front: 100, side: 50, rear: 30 };
const SHELL = { penetration: 110 };
const DEG = Math.PI / 180;

/** 与法线 n 成 angle 度、从外往里打的弹道方向(在 xz 平面内偏转) */
function dirAtAngle(n: { x: number; y: number; z: number }, angle: number) {
  // n 是 ±Z 或 ±X 的单位向量;取与之垂直的水平轴做偏转
  const perp = Math.abs(n.z) > 0.5 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const c = Math.cos(angle * DEG);
  const s = Math.sin(angle * DEG);
  return { x: -n.x * c + perp.x * s, y: -n.y * c + perp.y * s, z: -n.z * c + perp.z * s };
}

describe('受击面判定', () => {
  it('本地 -Z 是正面、+Z 是背面、±X 是侧面、±Y 是顶/底', () => {
    expect(classifyFace({ x: 0, y: 0, z: -1 })).toBe('front');
    expect(classifyFace({ x: 0, y: 0, z: 1 })).toBe('rear');
    expect(classifyFace({ x: 1, y: 0, z: 0 })).toBe('side');
    expect(classifyFace({ x: -1, y: 0, z: 0 })).toBe('side');
    expect(classifyFace({ x: 0, y: 1, z: 0 })).toBe('top');
    expect(classifyFace({ x: 0, y: -1, z: 0 })).toBe('bottom');
  });

  it('顶/底面按三个面里最薄的装甲算', () => {
    expect(armorForFace(ARMOR, 'top')).toBe(30);
    expect(armorForFace(ARMOR, 'bottom')).toBe(30);
    expect(armorForFace(ARMOR, 'front')).toBe(100);
  });
});

describe('入射角与等效装甲', () => {
  it('垂直命中入射角为 0,方向向量不必归一化', () => {
    expect(impactAngleDeg({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -1 })).toBeCloseTo(0, 6);
  });

  it('入射角 60° 时等效装甲翻倍', () => {
    expect(impactAngleDeg(dirAtAngle({ x: 0, y: 0, z: -1 }, 60), { x: 0, y: 0, z: -1 })).toBeCloseTo(60, 6);
    expect(effectiveArmor(50, 60)).toBeCloseTo(100, 6);
  });

  it(`掠射按 ${MAX_IMPACT_ANGLE_DEG}° 封顶,不会除以 0`, () => {
    const eff = effectiveArmor(50, 90);
    expect(Number.isFinite(eff)).toBe(true);
    expect(eff).toBeCloseTo(50 / Math.cos(MAX_IMPACT_ANGLE_DEG * DEG), 6);
  });
});

describe('穿透判定 resolveHit', () => {
  const front = { x: 0, y: 0, z: -1 };
  const side = { x: 1, y: 0, z: 0 };

  it('正面垂直命中:等效 100mm ≤ 穿深 110mm → 击穿,能击穿', () => {
    const r = resolveHit(SHELL, ARMOR, dirAtAngle(front, 0), front);
    expect(r.face).toBe('front');
    expect(r.penetrated).toBe(true);
  });

  it('正面 30° 命中:等效约 115mm > 110mm → 未击穿', () => {
    const r = resolveHit(SHELL, ARMOR, dirAtAngle(front, 30), front);
    expect(r.effectiveArmor).toBeCloseTo(100 / Math.cos(30 * DEG), 6);
    expect(r.penetrated).toBe(false);
  });

  it('侧面 60° 命中:等效 100mm → 击穿', () => {
    const r = resolveHit(SHELL, ARMOR, dirAtAngle(side, 60), side);
    expect(r.face).toBe('side');
    expect(r.penetrated).toBe(true);
  });

  it('侧面 70° 命中:等效约 146mm → 未击穿', () => {
    const r = resolveHit(SHELL, ARMOR, dirAtAngle(side, 70), side);
    expect(r.penetrated).toBe(false);
  });
});
