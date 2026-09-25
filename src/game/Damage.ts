import type { ArmorSpec, ShellSpec, ShellType } from '../data/types';
import { SHELL_TYPES, type ShellTypeSpec } from '../data/shells';

/**
 * 穿透判定(击穿与否)。击穿后的车内伤害见 damage/penetration.ts(模块 + 乘员)。
 *
 *   1. 按命中点的装甲面法线(转到载具/炮塔本地坐标)判定打在 front / side / rear(顶、底按最薄值)
 *   2. 入射角 = 弹道方向与该面法线的夹角
 *   3. 跳弹:按弹种的跳弹角区间掷概率(data/shells.ts)
 *   4. 等效装甲 = 装甲厚度 / cos(入射角 − 转正角)^指数,入射角超过 85° 按 85° 算;碎甲弹不计入射角
 *   5. 穿深 ≥ 等效装甲 → 击穿。动能弹的穿深按命中弹速折算(de Marre),化学能弹固定
 *
 * 纯函数,不依赖 three / rapier,方便单测。
 */

export type ArmorFace = 'front' | 'side' | 'rear' | 'top' | 'bottom';

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export const MAX_IMPACT_ANGLE_DEG = 85;

/**
 * de Marre 公式中穿深对弹速的指数:穿深 ∝ v^1.43。
 * 用来把「炮口穿深」按命中瞬间的弹速折算,体现远距离穿深下降。
 */
export const DE_MARRE_EXPONENT = 1.43;

/** 按命中瞬间弹速折算穿深(mm);muzzlePenetration 为炮口处(近距离)垂直穿深 */
export function penetrationAtVelocity(muzzlePenetration: number, muzzleVelocity: number, impactVelocity: number): number {
  if (muzzleVelocity <= 0) return muzzlePenetration;
  const ratio = Math.min(1, Math.max(0, impactVelocity / muzzleVelocity));
  return muzzlePenetration * Math.pow(ratio, DE_MARRE_EXPONENT);
}

/** 某发炮弹在给定弹速下的穿深:动能弹随弹速衰减,化学能弹与距离无关 */
export function shellPenetration(shell: Pick<ShellSpec, 'type' | 'penetration' | 'muzzleVelocity'>, impactVelocity: number): number {
  return SHELL_TYPES[shell.type].family === 'kinetic'
    ? penetrationAtVelocity(shell.penetration, shell.muzzleVelocity, impactVelocity)
    : shell.penetration;
}

const RAD2DEG = 180 / Math.PI;

/** 本地坐标下的外法线 → 受击面(本地 -Z 为车头,+Y 为上) */
export function classifyFace(localNormal: V3): ArmorFace {
  const ax = Math.abs(localNormal.x);
  const ay = Math.abs(localNormal.y);
  const az = Math.abs(localNormal.z);
  if (ay >= ax && ay >= az) return localNormal.y >= 0 ? 'top' : 'bottom';
  if (az >= ax) return localNormal.z < 0 ? 'front' : 'rear';
  return 'side';
}

export function armorForFace(armor: ArmorSpec, face: ArmorFace): number {
  switch (face) {
    case 'front':
      return armor.front;
    case 'side':
      return armor.side;
    case 'rear':
      return armor.rear;
    default:
      return Math.min(armor.front, armor.side, armor.rear);
  }
}

/** 入射角,度。0° = 垂直命中装甲面 */
export function impactAngleDeg(dir: V3, normal: V3): number {
  const dl = Math.hypot(dir.x, dir.y, dir.z);
  const nl = Math.hypot(normal.x, normal.y, normal.z);
  if (dl === 0 || nl === 0) return 0;
  const cos = Math.abs(dir.x * normal.x + dir.y * normal.y + dir.z * normal.z) / (dl * nl);
  return Math.acos(Math.min(1, Math.max(0, cos))) * RAD2DEG;
}

type AngleRule = Pick<ShellTypeSpec, 'normalization' | 'angleExponent' | 'ignoresAngle'>;

/** 等效装甲:厚度 / cos(入射角 − 转正角)^指数(缺省为几何换算 t / cos θ) */
export function effectiveArmor(thickness: number, angleDeg: number, rule?: AngleRule): number {
  if (rule?.ignoresAngle) return thickness;
  const a = Math.min(Math.max(angleDeg - (rule?.normalization ?? 0), 0), MAX_IMPACT_ANGLE_DEG) / RAD2DEG;
  return thickness / Math.pow(Math.cos(a), rule?.angleExponent ?? 1);
}

/** 跳弹概率:入射角在 [0%, 50%, 100%] 三个角度之间线性插值 */
export function ricochetChance(angleDeg: number, [a0, a50, a100]: readonly [number, number, number]): number {
  if (angleDeg <= a0) return 0;
  if (angleDeg >= a100) return 1;
  if (angleDeg <= a50) return (0.5 * (angleDeg - a0)) / (a50 - a0);
  return 0.5 + (0.5 * (angleDeg - a50)) / (a100 - a50);
}

export interface HitResolution {
  face: ArmorFace;
  angleDeg: number;
  /** 该面的垂直装甲厚度,mm */
  armor: number;
  /** 计入入射角后的等效装甲,mm */
  effectiveArmor: number;
  penetration: number;
  penetrated: boolean;
  /** 跳弹(没击穿) */
  ricochet: boolean;
}

/**
 * @param shell       至少要有穿深;缺省弹种按 APCBC 处理
 * @param localDir    弹道方向(载具或炮塔本地坐标)
 * @param localNormal 命中面外法线(同一本地坐标)
 * @param rng         跳弹掷骰;不传时取中位结果(概率 ≥ 50% 才跳弹),便于确定性测试
 */
export function resolveHit(
  shell: Pick<ShellSpec, 'penetration'> & { type?: ShellType },
  armor: ArmorSpec,
  localDir: V3,
  localNormal: V3,
  rng?: () => number,
): HitResolution {
  const rule = SHELL_TYPES[shell.type ?? 'APCBC'];
  const face = classifyFace(localNormal);
  const thickness = armorForFace(armor, face);
  const angleDeg = impactAngleDeg(localDir, localNormal);
  const eff = effectiveArmor(thickness, angleDeg, rule);
  const chance = ricochetChance(angleDeg, rule.ricochet);
  const ricochet = rng ? rng() < chance : chance >= 0.5;
  const penetrated = !ricochet && shell.penetration >= eff;
  return {
    face,
    angleDeg,
    armor: thickness,
    effectiveArmor: eff,
    penetration: shell.penetration,
    penetrated,
    ricochet,
  };
}
