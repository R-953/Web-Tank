/**
 * 击穿后效的调参数值(阶段 0 统一一套,所有炮弹共用)。
 * 数值追求「单发打进乘员舱通常能杀 1–3 人、打爆弹药架必殉爆」这类 WT 式手感,
 * 没有一手资料可对照;改这里不需要动代码。
 */
export const DAMAGE = {
  /** 炮弹本体在车内的伤害 = base + 每 kg 弹重 × perKg,每穿过一个模块 / 乘员衰减 decay */
  shellBody: { base: 80, perKg: 10, decay: 0.8 },

  /** 击穿点产生的装甲破片锥(崩落) */
  spall: {
    /** 破片数 = min + 装甲厚度(mm) / mmPerFragment,不超过 max */
    min: 6,
    max: 24,
    mmPerFragment: 8,
    // 锥体半角按弹种取(data/shells.ts 的 spallCone),数量与伤害再乘弹种的 spall 倍数
    /** 单片伤害 = base + 装甲厚度(mm) × perMm */
    damageBase: 10,
    damagePerMm: 0.15,
    /** 最远飞行距离,m */
    range: 3.5,
  },

  /** 装药爆炸(APHE) */
  explosion: {
    /** 杀伤半径 R = k × (TNT 当量 kg)^(1/3),m(Hopkinson–Cranz 比例距离) */
    radiusK: 2.5,
    /** 冲击波伤害 = peak × (1 − d / R),对半径内所有模块 / 乘员 */
    peak: 200,
    /** 弹体破片:数量、单片伤害、最远距离;方向为以弹道为轴、向前偏的球面分布 */
    fragments: 32,
    fragmentDamage: 30,
    fragmentRange: 3.0,
    /** 前向偏置 0..1:0 为均匀球面,1 为全部朝前 */
    forwardBias: 0.5,
  },

  /** 外挂模块被直接命中(炮管、履带)时的伤害 */
  externalHit: { base: 100, perKg: 10 },

  /**
   * 模块受损后的性能:效率 = minEfficiency + (1 − minEfficiency) × 血量比例,归零时功能丧失。
   * 默认 0 = 与血量成正比(例如发动机剩 50% 血,出力只有 50%);调大可以让轻伤影响小一些。
   */
  minEfficiency: 0,

  /**
   * 乘员受伤后的工作效率,公式与模块相同:效率 = crewMinEfficiency + (1 − crewMinEfficiency) × 血量比例。
   * 驾驶员 → 功率与转向,炮手 → 方向机 / 高低机速度,装填手 → 装填速度,全员平均 → 维修速度,车长 → 换位速度。
   */
  crewMinEfficiency: 0,

  /** 弹药架被打坏时的殉爆概率 = detonationChance × 该架剩余弹数 / 容量;空架不会炸,没炸的弹药报废 */
  ammo: { detonationChance: 0.9 },

  /**
   * 化学能弹没击穿时在车外起爆,冲击波波及外挂模块(履带、炮管):
   * 半径 R = radiusK × (TNT 当量 kg)^(1/3),伤害 = peak × (1 − d / R)。
   */
  externalBlast: { radiusK: 3.0, peak: 180 },
} as const;
