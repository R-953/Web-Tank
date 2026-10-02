export interface KillcamPolicyInput {
  playerId: string;
  shooterId: string;
  targetId: string;
  targetName: string;
  /** 击毁者的车名(查不到就 undefined) */
  killerName?: string;
  /** 这一发把目标打毁了(replay.destroyed) */
  destroyed: boolean;
  /** 设置:命中回放总开关 / 所有命中都回放 */
  killCam: boolean;
  killCamAll: boolean;
}

/** null = 不播;否则是传给 killcam.play 的选项 */
export type KillcamPlan = null | { layout?: 'full'; title?: string };

export function killcamPlan(i: KillcamPolicyInput): KillcamPlan {
  if (!i.killCam) return null;

  if (i.shooterId === i.playerId) {
    if (i.destroyed) return {};
    return i.killCamAll ? { title: `命中回放 · ${i.targetName}` } : null;
  }

  if (i.targetId === i.playerId && i.destroyed) {
    return {
      layout: 'full',
      title: i.killerName ? `被 ${i.killerName} 击毁` : '被击毁',
    };
  }

  return null;
}
