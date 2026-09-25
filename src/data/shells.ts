import type { ShellSpec, ShellType } from './types';

/**
 * 弹种通用参数。先按「动能弹 / 化学能弹」各写一套通用逻辑(game/Damage.ts、damage/penetration.ts),
 * 再用这里的参数按弹种微调入射角表现、跳弹、阻力和击穿后效;个别炮弹的差异用 ShellSpec 自己的字段
 * (初速、弹重、口径、dragCoefficient)体现。
 *
 * 取值依据(详见 docs/physics-validation.md 第 8 节):
 *   - 阻力系数:由公开穿深 – 距离表反推(德制被帽弹 ≈ 0.34,硬芯弹 ≈ 0.26–0.31)
 *   - 跳弹角:War Thunder 公开数据(被帽弹 48° / 63° / 71°,无帽弹 47° / 60° / 65°,硬芯弹 66° / 70° / 72°,
 *     破甲弹 62° / 69° / 73°),碎甲弹为估算
 *   - 硬芯弹斜面惩罚:等效厚度按 t / cos^1.5 θ(对照 KwK 43 30° 实测表的比值 0.75–0.78 取的近似)
 *   - 被帽弹不做「转正」:德方 30° 实测表比几何换算还低,加转正会更偏离实测
 */
export type ShellFamily = 'kinetic' | 'chemical';

export interface ShellTypeSpec {
  /** 中文名 */
  name: string;
  family: ShellFamily;
  /** 击穿后按引信延迟在车内起爆(APHE 系) */
  delayedExplosive: boolean;
  /** 默认超音速阻力系数 Cd */
  dragCoefficient: number;
  /** 入射角修正:等效装甲 = t / cos(max(0, θ − normalization))^angleExponent */
  normalization: number;
  angleExponent: number;
  /** 碎甲弹:判定只看装甲厚度,不计入射角(直到跳弹) */
  ignoresAngle: boolean;
  /** 跳弹概率 0% / 50% / 100% 对应的入射角,度 */
  ricochet: readonly [number, number, number];
  /** 击穿后弹体(破甲弹为金属射流)在车内的伤害倍数;0 = 没有东西钻进车内 */
  body: number;
  /** 弹体 / 射流在车内最远走多远,m */
  bodyRange: number;
  /** 装甲崩落破片的数量与伤害倍数 */
  spall: number;
  /** 崩落破片锥的半角,度 */
  spallCone: number;
  /** 没击穿时,装药在车外爆炸,波及履带、炮管等外挂模块 */
  externalBlast: boolean;
}

const CAPPED_RICOCHET = [48, 63, 71] as const;
const UNCAPPED_RICOCHET = [47, 60, 65] as const;

const kinetic = (name: string, o: Partial<ShellTypeSpec>): ShellTypeSpec => ({
  name,
  family: 'kinetic',
  delayedExplosive: false,
  dragCoefficient: 0.34,
  normalization: 0,
  angleExponent: 1,
  ignoresAngle: false,
  ricochet: CAPPED_RICOCHET,
  body: 1,
  bodyRange: 30,
  spall: 1,
  spallCone: 22,
  externalBlast: false,
  ...o,
});

const chemical = (name: string, o: Partial<ShellTypeSpec>): ShellTypeSpec => ({
  name,
  family: 'chemical',
  delayedExplosive: false,
  dragCoefficient: 0.38,
  normalization: 0,
  angleExponent: 1,
  ignoresAngle: false,
  ricochet: [62, 69, 73],
  body: 0,
  bodyRange: 0,
  spall: 1,
  spallCone: 22,
  externalBlast: true,
  ...o,
});

export const SHELL_TYPES: Readonly<Record<ShellType, ShellTypeSpec>> = {
  // --- 动能弹 · 实心
  AP: kinetic('尖头穿甲弹', { dragCoefficient: 0.36, ricochet: UNCAPPED_RICOCHET }),
  APC: kinetic('被帽穿甲弹', { dragCoefficient: 0.4 }),
  // 钝头咬得住斜面:转正 4°
  APBC: kinetic('钝头风帽穿甲弹', { normalization: 4 }),
  APCBC: kinetic('被帽风帽穿甲弹', {}),
  // --- 动能弹 · 带装药
  APHE: kinetic('穿甲爆破弹', { delayedExplosive: true, dragCoefficient: 0.36, ricochet: UNCAPPED_RICOCHET }),
  APHEBC: kinetic('钝头风帽穿甲爆破弹', { delayedExplosive: true, normalization: 4 }),
  'APCBC-HE': kinetic('被帽风帽穿甲爆破弹', { delayedExplosive: true }),
  // --- 动能弹 · 硬芯:弹芯小,车内杀伤弱;斜面表现差、容易跳弹
  APCR: kinetic('硬芯穿甲弹', {
    dragCoefficient: 0.3,
    angleExponent: 1.5,
    ricochet: [66, 70, 72],
    body: 0.5,
    spall: 0.6,
    spallCone: 15,
  }),
  // --- 化学能弹
  // 破甲弹:金属射流沿弹道钻进车内一小段,破片锥很窄
  HEAT: chemical('破甲弹', { body: 1.2, bodyRange: 2.5, spall: 0.5, spallCone: 10 }),
  // 高爆弹:在装甲表面起爆;击穿(薄装甲)时冲击波和弹片进入车内
  HE: chemical('高爆弹', { dragCoefficient: 0.36, ricochet: [79, 80, 81], spall: 1 }),
  // 碎甲弹:从装甲内表面崩落大量破片,基本不受入射角影响
  HESH: chemical('碎甲弹', { dragCoefficient: 0.42, ignoresAngle: true, ricochet: [73, 77, 80], spall: 2, spallCone: 50 }),
};

export function shellType(shell: Pick<ShellSpec, 'type'>): ShellTypeSpec {
  return SHELL_TYPES[shell.type];
}

/**
 * 高爆弹穿深(mm)按 TNT 当量装药量(kg)查表插值。表来自 War Thunder 的公开拆包数据:
 * 0.1 kg → 4 mm,0.2 → 5,2 → 25,3 → 35,5 → 40,8 → 60,10 → 62。
 */
const HE_TABLE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.1, 4],
  [0.2, 5],
  [2, 25],
  [3, 35],
  [5, 40],
  [8, 60],
  [10, 62],
];

export function hePenetration(tntKg: number): number {
  if (tntKg <= 0) return 0;
  for (let i = 1; i < HE_TABLE.length; i++) {
    const [x1, y1] = HE_TABLE[i];
    if (tntKg <= x1) {
      const [x0, y0] = HE_TABLE[i - 1];
      return y0 + ((y1 - y0) * (tntKg - x0)) / (x1 - x0);
    }
  }
  return HE_TABLE[HE_TABLE.length - 1][1];
}

/** 空气密度的一半 ρ/2,kg/m³ */
const HALF_RHO = 0.6;

/** 弹道积分用的阻力参数 k(1/m):dv/dt = −k|v|v,k = ρ/2 · Cd · A / m */
export function dragK(shell: Pick<ShellSpec, 'type' | 'caliber' | 'mass' | 'dragCoefficient'>): number {
  const d = shell.caliber / 1000;
  const area = (Math.PI * d * d) / 4;
  const cd = shell.dragCoefficient ?? SHELL_TYPES[shell.type].dragCoefficient;
  return (HALF_RHO * cd * area) / shell.mass;
}

/** 弹种的简称(HUD 用) */
export const SHELL_SHORT: Readonly<Record<ShellType, string>> = {
  AP: 'AP',
  APC: 'APC',
  APBC: 'APBC',
  APCBC: 'APCBC',
  APHE: 'APHE',
  APHEBC: 'APHEBC',
  'APCBC-HE': 'APCBC-HE',
  APCR: 'APCR',
  HEAT: 'HEAT',
  HE: 'HE',
  HESH: 'HESH',
};
