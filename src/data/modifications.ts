import type { VehicleSpec } from './types';
import { isCasemate } from '../game/casemate';

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

/** 机动改装(通用) */
export const MOBILITY_MODS: readonly ModificationSpec[] = [
  {
    id: 'mobility_tracks',
    name: '履带',
    branch: 'mobility',
    tier: 1,
    description: '更换新履带，降低地面阻力，提升车体转向灵敏度',
    effects: [{ kind: 'turnRate', mult: 1.05 }],
    source: '估算: 参考 War Thunder 履带改装设定，改善履带附着力与阻力，车体转向速度 +5%',
  },
  {
    id: 'mobility_suspension',
    name: '悬挂',
    branch: 'mobility',
    tier: 2,
    requires: ['mobility_tracks'],
    description: '检修悬挂系统与减震弹簧，改善复杂地形上的转向与加速稳定性',
    effects: [
      { kind: 'turnRate', mult: 1.04 },
      { kind: 'acceleration', mult: 1.04 },
    ],
    source: '估算: 参考 War Thunder 悬挂改装设定，提升越野平稳性，车体转向速度 +4%，起步加速度 +4%',
  },
  {
    id: 'mobility_transmission',
    name: '传动',
    branch: 'mobility',
    tier: 3,
    requires: ['mobility_suspension'],
    description: '检修变速箱与终传动机构，减少动力传输损耗，提升转向与加速',
    effects: [
      { kind: 'turnRate', mult: 1.04 },
      { kind: 'acceleration', mult: 1.05 },
    ],
    source: '估算: 参考 War Thunder 传动改装设定，优化动力传动效率，车体转向速度 +4%，起步加速度 +5%',
  },
  {
    id: 'mobility_engine',
    name: '发动机',
    branch: 'mobility',
    tier: 4,
    requires: ['mobility_transmission'],
    description: '大修发动机并更换磨损件，恢复额定输出功率与最高行驶速度',
    effects: [
      { kind: 'acceleration', mult: 1.06 },
      { kind: 'maxSpeed', mult: 1.05 },
    ],
    source: '估算: 参考 War Thunder 发动机大修改装设定，恢复额定输出功率，起步加速度 +6%，最大速度 +5%(按任务卡上限)',
  },
];

/** 防护改装(通用) */
export const PROTECTION_MODS: readonly ModificationSpec[] = [
  {
    id: 'protection_parts',
    name: '备件',
    branch: 'protection',
    tier: 1,
    description: '携带基础野战备件与工具，用于战场维修损坏模块',
    effects: [],
    source: '估算: 参考 War Thunder 维修备件设定，用于战场野战维修损坏模块，效果暂未接入',
  },
  {
    id: 'protection_fpe',
    name: '灭火器',
    branch: 'protection',
    tier: 2,
    description: '携带车载灭火系统，扑灭发动机与舱内火灾',
    effects: [],
    source: '估算: 参考 War Thunder 灭火装置设定，用于扑灭发动机舱起火，效果暂未接入',
  },
  {
    id: 'protection_crew',
    name: '乘员补充',
    branch: 'protection',
    tier: 3,
    description: '在战区呼叫补充一名失去战斗力的乘员',
    effects: [],
    source: '估算: 参考 War Thunder 乘员补充机制，用于救护补充失去战斗力的乘员，效果暂未接入',
  },
];

/** 火力改装(常规带旋转炮塔车辆) */
export const FIREPOWER_TURRET_MODS: readonly ModificationSpec[] = [
  {
    id: 'firepower_horizontal_drive',
    name: '水平驱动',
    branch: 'firepower',
    tier: 1,
    description: '润滑和检修炮塔方向机与座圈齿环，提升水平旋转速度',
    effects: [{ kind: 'turretRotationSpeed', mult: 1.10 }],
    source: '估算: 参考 War Thunder 水平方向机改装设定，润滑和检修驱动齿圈与齿轮箱，水平旋转速度 +10%',
  },
  {
    id: 'firepower_vertical_drive',
    name: '垂直驱动',
    branch: 'firepower',
    tier: 2,
    requires: ['firepower_horizontal_drive'],
    description: '润滑和检修火炮高低机齿弧与平衡机，提升火炮俯仰速度',
    effects: [{ kind: 'elevationSpeed', mult: 1.10 }],
    source: '估算: 参考 War Thunder 高低俯仰驱动改装设定，润滑和检修火炮高低机齿弧，俯仰速度 +10%',
  },
  {
    id: 'firepower_adjustment',
    name: '射击调整',
    branch: 'firepower',
    tier: 3,
    description: '校准火炮内膛与瞄准基线，改善射击密集度与散布',
    effects: [],
    source: '估算: 参考 War Thunder 射击调整改装设定，校验火炮内膛与瞄准基线，效果暂未接入',
  },
];

/** 火力改装(固定战斗室 / 坦克歼击车 / 突击炮：没有炮塔方向机) */
export const FIREPOWER_CASEMATE_MODS: readonly ModificationSpec[] = [
  {
    id: 'firepower_vertical_drive',
    name: '垂直驱动',
    branch: 'firepower',
    tier: 2,
    description: '润滑和检修火炮高低机齿弧与平衡机，提升火炮俯仰速度',
    effects: [{ kind: 'elevationSpeed', mult: 1.10 }],
    source: '估算: 参考 War Thunder 高低俯仰驱动改装设定，润滑和检修火炮高低机齿弧，俯仰速度 +10%',
  },
  {
    id: 'firepower_adjustment',
    name: '射击调整',
    branch: 'firepower',
    tier: 3,
    description: '校准火炮内膛与瞄准基线，改善射击密集度与散布',
    effects: [],
    source: '估算: 参考 War Thunder 射击调整改装设定，校验火炮内膛与瞄准基线，效果暂未接入',
  },
];

/** 这辆车能用的改装列表(按国家 / 类别)。坦克歼击车 / 突击炮无炮塔方向机 */
export function modificationsFor(spec: VehicleSpec): readonly ModificationSpec[] {
  const firepower = isCasemate(spec) ? FIREPOWER_CASEMATE_MODS : FIREPOWER_TURRET_MODS;
  return [...MOBILITY_MODS, ...PROTECTION_MODS, ...firepower];
}

/** 把已启用的改装套到 spec 上,返回新对象(不改入参);不适用或缺前置的 id 忽略。 */
export function applyModifications(spec: VehicleSpec, enabled: readonly string[]): VehicleSpec {
  if (!enabled || enabled.length === 0) {
    return spec;
  }

  const validIds = sanitizeModifications(spec, enabled);
  if (validIds.length === 0) {
    return spec;
  }

  const available = modificationsFor(spec);
  const modMap = new Map(available.map((m) => [m.id, m]));

  let turretRotationSpeedMult = 1;
  let elevationSpeedMult = 1;
  let turnRateMult = 1;
  let accelerationMult = 1;
  let maxSpeedMult = 1;

  for (const id of validIds) {
    const mod = modMap.get(id);
    if (!mod) continue;
    for (const eff of mod.effects) {
      switch (eff.kind) {
        case 'turretRotationSpeed':
          turretRotationSpeedMult *= eff.mult;
          break;
        case 'elevationSpeed':
          elevationSpeedMult *= eff.mult;
          break;
        case 'turnRate':
          turnRateMult *= eff.mult;
          break;
        case 'acceleration':
          accelerationMult *= eff.mult;
          break;
        case 'maxSpeed':
          maxSpeedMult *= eff.mult;
          break;
      }
    }
  }

  const hasAnyEffect =
    turretRotationSpeedMult !== 1 ||
    elevationSpeedMult !== 1 ||
    turnRateMult !== 1 ||
    accelerationMult !== 1 ||
    maxSpeedMult !== 1;

  if (!hasAnyEffect) {
    return spec;
  }

  return {
    ...spec,
    turretRotationSpeed: spec.turretRotationSpeed * turretRotationSpeedMult,
    maxSpeed: spec.maxSpeed * maxSpeedMult,
    hull: {
      ...spec.hull,
      turnRate: spec.hull.turnRate * turnRateMult,
      acceleration: spec.hull.acceleration * accelerationMult,
    },
    turret: {
      ...spec.turret,
      elevationSpeed: spec.turret.elevationSpeed * elevationSpeedMult,
    },
  };
}

/** 去掉不适用 / 缺前置的 id,去重,保持列表里的顺序。 */
export function sanitizeModifications(spec: VehicleSpec, enabled: readonly string[]): string[] {
  if (!enabled || enabled.length === 0) {
    return [];
  }
  const available = modificationsFor(spec);
  const enabledSet = new Set(enabled);
  const valid = new Set<string>();

  for (const mod of available) {
    if (!enabledSet.has(mod.id)) {
      continue;
    }
    const reqs = mod.requires;
    if (reqs && reqs.length > 0) {
      const allSatisfied = reqs.every((r) => valid.has(r));
      if (!allSatisfied) {
        continue;
      }
    }
    valid.add(mod.id);
  }

  return available.filter((m) => valid.has(m.id)).map((m) => m.id);
}

/**
 * 点一下某个改装:启用时要求前置已启用(否则原样返回),关闭时连带关闭依赖它的改装。
 * 返回新数组,不改入参。
 */
export function toggleModification(spec: VehicleSpec, enabled: readonly string[], id: string): string[] {
  const available = modificationsFor(spec);
  const target = available.find((m) => m.id === id);
  if (!target) {
    return [...enabled];
  }

  const sanitized = sanitizeModifications(spec, enabled);
  const isCurrentlyEnabled = sanitized.includes(id);

  if (isCurrentlyEnabled) {
    // 关闭时连带关闭依赖它的改装
    const remaining = sanitized.filter((x) => x !== id);
    return sanitizeModifications(spec, remaining);
  } else {
    // 启用时要求前置已启用(否则原样返回)
    if (target.requires && target.requires.length > 0) {
      const allSatisfied = target.requires.every((r) => sanitized.includes(r));
      if (!allSatisfied) {
        return [...enabled];
      }
    }
    return sanitizeModifications(spec, [...sanitized, id]);
  }
}
