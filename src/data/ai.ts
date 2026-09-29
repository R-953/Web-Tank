/**
 * 敌方还击 AI 的参数(简单版:不会移动找掩体,只会转炮塔、估距、开火)。
 *
 * 两套预设:
 *   - guard「守卫」:第四轮的原始参数,原封不动保留,留给以后的「守卫模式」上强度用。
 *     实测:玩家出生后 4 秒左右就会被 600 m 外的 T-34-85 击穿,训练场里太难。
 *   - training「训练」:训练场默认用这一套,发现距离近、瞄得慢、有散布,给玩家先手的机会。
 */
export interface AIParams {
  /** 交战距离:超过它不会开火,m */
  engageRange: number;
  /** 进入这个距离且有视线就会发现玩家;更远的敌人要被打中或被近弹惊动才还击,m */
  alertRange: number;
  /** 玩家的炮弹落在这个半径内算「被打了」,m */
  nearMissRadius: number;
  /** 发现目标后瞄准多久才开第一炮,秒 [最短, 最长] */
  aimTime: readonly [number, number];
  /** 估距误差(比例,均匀分布 ±) */
  rangeError: number;
  /** 每打一发,根据落点修正估距,误差乘这个系数 */
  correction: number;
  /** 瞄准点在目标中心附近的随机偏移,m */
  aimSpread: number;
  /** 炮管指向与瞄准点的夹角小于它才开火,度 */
  alignTolerance: number;
  /** 视线检测间隔,秒 */
  losInterval: number;
  /** 瞄准散布(1σ),毫弧度:每发炮弹的瞄准点再随距离偏开一点 */
  dispersionMrad: number;
}

export type AIPresetId = 'training' | 'guard';

export const AI_PRESETS: Readonly<Record<AIPresetId, { name: string; description: string; params: AIParams }>> = {
  training: {
    name: '训练',
    description: '350 m 内才会主动发现你;瞄准 5–8 秒,估距误差 ±20%,有散布',
    params: {
      engageRange: 1200,
      alertRange: 350,
      nearMissRadius: 15,
      aimTime: [5, 8],
      rangeError: 0.2,
      correction: 0.8,
      aimSpread: 1.0,
      alignTolerance: 0.5,
      losInterval: 0.5,
      dispersionMrad: 2.5,
    },
  },
  guard: {
    name: '守卫(高强度)',
    description: '第四轮的原始参数:800 m 发现、瞄准 2–3 秒、估距 ±10% 且越打越准',
    params: {
      engageRange: 1500,
      alertRange: 800,
      nearMissRadius: 30,
      aimTime: [2, 3],
      rangeError: 0.1,
      correction: 0.5,
      aimSpread: 0.4,
      alignTolerance: 0.5,
      losInterval: 0.25,
      dispersionMrad: 0,
    },
  },
};

/** 缺省参数(训练预设) */
export const AI: AIParams = AI_PRESETS.training.params;
