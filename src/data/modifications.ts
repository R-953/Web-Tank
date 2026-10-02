import type { VehicleSpec } from './types';

/**
 * 改装(Modifications):每辆车的机动 / 防护 / 火力三栏、每栏分 I–IV 级的可选升级。
 * 不做研发点数和价格:玩家在改装界面里勾选即时生效,免费。
 * 接口由主程定死,数据和逻辑见任务卡 054,界面见 055。
 */
export type ModBranch = 'mobility' | 'protection' | 'firepower';
export type ModTier = 1 | 2 | 3 | 4;

/**
 * 改装的效果。只列已经能接到 VehicleSpec 现有字段上的几种;
 * `effects` 为空数组的改装(如维修用备件、灭火器)表示效果暂未接入游戏,界面上要标明。
 */
export type ModEffect =
  | { kind: 'turretRotationSpeed'; mult: number } // 水平方向机速度 ×
  | { kind: 'elevationSpeed'; mult: number } // 高低机速度 ×
  | { kind: 'turnRate'; mult: number } // 车体转向角速度 ×
  | { kind: 'acceleration'; mult: number } // 起步加速度 ×
  | { kind: 'maxSpeed'; mult: number }; // 最大速度 ×

export interface ModificationSpec {
  /** 全局唯一,如 'mobility_tracks' */
  id: string;
  name: string;
  branch: ModBranch;
  tier: ModTier;
  /** 必须先启用的改装 id(同一栏里低一级的) */
  requires?: readonly string[];
  description: string;
  effects: readonly ModEffect[];
  /** 数值出处;查不到时写「估算:……(方法)」 */
  source: string;
}

/** 这辆车能用的改装列表(按国家 / 类别)。占位:054 实现 */
export function modificationsFor(_spec: VehicleSpec): readonly ModificationSpec[] {
  return [];
}

/** 把已启用的改装套到 spec 上,返回新对象(不改入参);不适用或缺前置的 id 忽略。占位:054 实现 */
export function applyModifications(spec: VehicleSpec, _enabled: readonly string[]): VehicleSpec {
  return spec;
}

/** 去掉不适用 / 缺前置的 id,保持顺序。占位:054 实现 */
export function sanitizeModifications(_spec: VehicleSpec, enabled: readonly string[]): string[] {
  return [...enabled];
}

/**
 * 点一下某个改装:启用时要求前置已启用(否则原样返回),关闭时连带关闭依赖它的改装。
 * 返回新数组,不改入参。占位:054 实现
 */
export function toggleModification(_spec: VehicleSpec, enabled: readonly string[], _id: string): string[] {
  return [...enabled];
}
