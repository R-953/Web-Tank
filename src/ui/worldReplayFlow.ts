import type { KillcamPlan } from './killcamPolicy';

export interface XrayFadeParams {
  enabled: boolean;
  scoped: boolean;
}

export interface CanShowResultParams {
  gameState: string;
  resultAt: number | null;
  now: number;
  delaySec: number;
  killcamActive: boolean;
  worldReplayActive: boolean;
}

export interface InternalsDisplayParams {
  internalsOn: boolean;
  internalsStyle: 'world' | 'panel';
  mapOpen?: boolean;
  paused?: boolean;
  alive?: boolean;
  worldReplayActive?: boolean;
}

/**
 * 判断是否走世界内死亡回放:
 * - 只有己方被击毁 (plan.layout === 'full') 且死亡回放样式为 'world' 时才走 WorldReplay;
 * - 其余回放 (如击毁敌方右上角小窗) 或样式为 'window' 时走原有的 KillCam 独立窗口。
 */
export function useWorldReplay(
  plan: KillcamPlan | null | undefined,
  settingsOrStyle: 'world' | 'window' | { deathReplayStyle: 'world' | 'window' },
): boolean {
  if (!plan || plan.layout !== 'full') return false;
  const style = typeof settingsOrStyle === 'string' ? settingsOrStyle : settingsOrStyle.deathReplayStyle;
  return style === 'world';
}

/**
 * 计算 O 键 X 光的目标透明度/混合度 (0..1):
 * - 未开启: 0 (真实材质)
 * - 开启且开镜 (scoped): 0 (避免灰壳与轮廓线遮挡瞄准镜)
 * - 开启且非开镜: 1 (完全 X 光灰壳 + 轮廓线 + 内构)
 */
export function xrayFadeTarget(params: XrayFadeParams): number {
  if (!params.enabled) return 0;
  return params.scoped ? 0 : 1;
}

/**
 * 判断当前内构显示模式:
 * - 若地图开启、暂停、车毁、或正在播世界回放, 则均不显示 ('none');
 * - 否则按设置返回 'world' 或 'panel'。
 */
export function internalsDisplayMode(params: InternalsDisplayParams): 'world' | 'panel' | 'none' {
  if (!params.internalsOn) return 'none';
  if (params.mapOpen || params.paused || params.alive === false || params.worldReplayActive) {
    return 'none';
  }
  return params.internalsStyle;
}

/**
 * 判断胜负结算画面是否可以弹出:
 * - 对局必须已结束 (state !== 'playing');
 * - 延迟时间已到达 (now - resultAt > delaySec * 1000);
 * - killcam 与 worldReplay 两者均不在回放中。
 */
export function canShowResult(params: CanShowResultParams): boolean {
  if (params.gameState === 'playing') return false;
  if (params.resultAt === null) return false;
  if (params.now - params.resultAt <= params.delaySec * 1000) return false;
  if (params.killcamActive || params.worldReplayActive) return false;
  return true;
}

/**
 * 判断是否应更新常规第三人称 / 瞄准镜跟随相机:
 * - 世界内死亡回放期间由 WorldReplay 独占驱动相机, 此时跳过跟随相机的更新。
 */
export function shouldUpdateFollowCamera(params: { worldReplayActive: boolean }): boolean {
  return !params.worldReplayActive;
}

/**
 * 判断战斗 HUD (准星、小地图等) 是否可见:
 * - 地图界面开启或世界死亡回放期间隐藏, 避免遮挡画面。
 */
export function isBattleHudVisible(params: { mapOpen: boolean; worldReplayActive: boolean }): boolean {
  return !params.mapOpen && !params.worldReplayActive;
}
