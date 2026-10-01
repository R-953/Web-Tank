import type { VehicleSpec } from '../../data/types';

/** 成长常数 T:挂机 T 时长升到满级的 50%(负责人定为两周),毫秒 */
export const CREW_HALF_TIME_MS = 14 * 24 * 60 * 60 * 1000; // 14 天 = 1,209,600,000 ms

/** 显示给玩家的满级等级 */
export const CREW_MAX_LEVEL = 100;

/** 最大成长进度(严格小于 1,保证永远 < 1) */
const MAX_PROGRESS = 1 - Number.EPSILON / 2;

/**
 * 成长进度 f ∈ [0, 1):f(t) = t / (t + T)。
 * 从进度 f0 出发再挂机 elapsedMs 后的进度:先反推 t0 = T·f0 / (1 − f0),再算 f(t0 + elapsedMs)。
 * elapsedMs ≤ 0(含改了系统时间导致的负值)时原样返回 f0;f0 夹到 [0, 1)。
 */
export function progressAfter(
  f0: number,
  elapsedMs: number,
  halfTimeMs: number = CREW_HALF_TIME_MS,
): number {
  // f0 夹到 [0, 1)
  const clampedF0 = Math.max(0, Math.min(f0, MAX_PROGRESS));

  // 负时间、0 时间原样返回(若 f0 合法即原样返回 f0;超限则返回夹住后的值)
  if (elapsedMs <= 0) {
    return clampedF0;
  }

  // 先反推 t0 = T · f0 / (1 − f0)
  const t0 = (halfTimeMs * clampedF0) / (1 - clampedF0);
  const t = t0 + elapsedMs;

  // 再算 f(t0 + elapsedMs)
  const f = t / (t + halfTimeMs);

  // 保证永远 < 1 且 ≥ 0
  if (f >= 1) {
    return MAX_PROGRESS;
  }
  return Math.max(0, f);
}

/** 显示等级 = floor(f × CREW_MAX_LEVEL) */
export function crewLevel(f: number): number {
  return Math.floor(Math.max(0, f) * CREW_MAX_LEVEL);
}

/** 满级数值(结构与 data/types.ts 里将要加的 CrewAceSpec 相同,这里单独声明,避免依赖 028) */
export interface AceValues {
  reloadTime: number;
  turretRotationSpeed: number;
  elevationSpeed: number;
}

/**
 * 按技能 skill ∈ [0, 1](= 成长进度 × 熟练度,调用方算好)把载具数值从新手线性插值到王牌,返回新的 VehicleSpec(不改入参)。
 * - 主炮(weapons 里 kind 不是 'mg' 的)reloadTime:novice + (ace − novice) × skill
 * - turretRotationSpeed、turret.elevationSpeed 同理
 * - 机枪不变;ace 为 undefined 时原样返回(拷贝或原对象都行,但不能改入参);skill 夹到 [0, 1]
 */
export function applyCrewSkill(
  spec: VehicleSpec,
  ace: AceValues | undefined,
  skill: number,
): VehicleSpec {
  if (!ace) {
    return spec;
  }

  const s = Math.max(0, Math.min(1, skill));

  return {
    ...spec,
    turretRotationSpeed: spec.turretRotationSpeed + (ace.turretRotationSpeed - spec.turretRotationSpeed) * s,
    turret: {
      ...spec.turret,
      elevationSpeed: spec.turret.elevationSpeed + (ace.elevationSpeed - spec.turret.elevationSpeed) * s,
    },
    weapons: spec.weapons.map((w) =>
      w.kind !== 'mg'
        ? {
            ...w,
            reloadTime: w.reloadTime + (ace.reloadTime - w.reloadTime) * s,
          }
        : { ...w },
    ),
  };
}
