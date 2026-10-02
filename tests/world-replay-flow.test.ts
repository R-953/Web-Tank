import { describe, expect, it } from 'vitest';
import {
  canShowResult,
  internalsDisplayMode,
  isBattleHudVisible,
  shouldUpdateFollowCamera,
  useWorldReplay,
  xrayFadeTarget,
} from '../src/ui/worldReplayFlow';
import type { KillcamPlan } from '../src/ui/killcamPolicy';

describe('worldReplayFlow 纯函数测试', () => {
  describe('useWorldReplay 回放分流逻辑', () => {
    it('己方被击毁 (full) 且样式为 world 时走世界死亡回放', () => {
      const plan: KillcamPlan = { layout: 'full', title: '被 虎式 击毁' };
      expect(useWorldReplay(plan, 'world')).toBe(true);
      expect(useWorldReplay(plan, { deathReplayStyle: 'world' })).toBe(true);
    });

    it('己方被击毁但样式为 window 时不走世界回放 (维持原有全屏独立窗口)', () => {
      const plan: KillcamPlan = { layout: 'full', title: '被 虎式 击毁' };
      expect(useWorldReplay(plan, 'window')).toBe(false);
      expect(useWorldReplay(plan, { deathReplayStyle: 'window' })).toBe(false);
    });

    it('击中 / 击毁敌方的小窗回放即使样式为 world 也不走世界死亡回放', () => {
      expect(useWorldReplay({}, 'world')).toBe(false);
      expect(useWorldReplay({ title: '命中回放 · 敌方' }, 'world')).toBe(false);
    });

    it('无回放计划 (null / undefined) 时不走世界回放', () => {
      expect(useWorldReplay(null, 'world')).toBe(false);
      expect(useWorldReplay(undefined, 'world')).toBe(false);
    });
  });

  describe('xrayFadeTarget 开镜淡出逻辑', () => {
    it('未开启 X 光时淡出目标为 0', () => {
      expect(xrayFadeTarget({ enabled: false, scoped: false })).toBe(0);
      expect(xrayFadeTarget({ enabled: false, scoped: true })).toBe(0);
    });

    it('开启 X 光但开镜时淡出为 0, 避免轮廓线挡瞄准镜', () => {
      expect(xrayFadeTarget({ enabled: true, scoped: true })).toBe(0);
    });

    it('开启 X 光且退出开镜时淡回为 1', () => {
      expect(xrayFadeTarget({ enabled: true, scoped: false })).toBe(1);
    });
  });

  describe('internalsDisplayMode 内构显示方式与屏蔽状态', () => {
    it('未开启 O 键时返回 none', () => {
      expect(internalsDisplayMode({ internalsOn: false, internalsStyle: 'world' })).toBe('none');
      expect(internalsDisplayMode({ internalsOn: false, internalsStyle: 'panel' })).toBe('none');
    });

    it('开启 O 键正常态下根据设置返回 world 或 panel', () => {
      expect(internalsDisplayMode({ internalsOn: true, internalsStyle: 'world' })).toBe('world');
      expect(internalsDisplayMode({ internalsOn: true, internalsStyle: 'panel' })).toBe('panel');
    });

    it('地图打开、暂停、阵亡或死亡回放期间强制屏蔽 (返回 none)', () => {
      expect(internalsDisplayMode({ internalsOn: true, internalsStyle: 'world', mapOpen: true })).toBe('none');
      expect(internalsDisplayMode({ internalsOn: true, internalsStyle: 'world', paused: true })).toBe('none');
      expect(internalsDisplayMode({ internalsOn: true, internalsStyle: 'world', alive: false })).toBe('none');
      expect(internalsDisplayMode({ internalsOn: true, internalsStyle: 'world', worldReplayActive: true })).toBe('none');
    });
  });

  describe('canShowResult 结算画面弹出判断', () => {
    const base = {
      gameState: 'defeat',
      resultAt: 1000,
      now: 4000,
      delaySec: 2,
      killcamActive: false,
      worldReplayActive: false,
    };

    it('在战斗还在进行中时不弹出', () => {
      expect(canShowResult({ ...base, gameState: 'playing' })).toBe(false);
    });

    it('resultAt 为空或等待时间未达标时不弹出', () => {
      expect(canShowResult({ ...base, resultAt: null })).toBe(false);
      expect(canShowResult({ ...base, now: 2500 })).toBe(false); // 2500 - 1000 = 1500ms <= 2000ms
    });

    it('killcam 或 worldReplay 正在进行中时不弹出结算画面', () => {
      expect(canShowResult({ ...base, killcamActive: true })).toBe(false);
      expect(canShowResult({ ...base, worldReplayActive: true })).toBe(false);
      expect(canShowResult({ ...base, killcamActive: true, worldReplayActive: true })).toBe(false);
    });

    it('所有条件满足且两类回放均已结束时允许弹出结算画面', () => {
      expect(canShowResult(base)).toBe(true);
      expect(canShowResult({ ...base, now: 3001 })).toBe(true);
    });
  });

  describe('shouldUpdateFollowCamera 相机控制权交接', () => {
    it('世界回放进行中跳过跟随相机更新', () => {
      expect(shouldUpdateFollowCamera({ worldReplayActive: true })).toBe(false);
    });

    it('世界回放非活跃时允许更新跟随相机', () => {
      expect(shouldUpdateFollowCamera({ worldReplayActive: false })).toBe(true);
    });
  });

  describe('isBattleHudVisible 战斗 HUD 屏蔽', () => {
    it('正常状态下 HUD 可见', () => {
      expect(isBattleHudVisible({ mapOpen: false, worldReplayActive: false })).toBe(true);
    });

    it('地图打开或世界死亡回放进行中隐藏 HUD', () => {
      expect(isBattleHudVisible({ mapOpen: true, worldReplayActive: false })).toBe(false);
      expect(isBattleHudVisible({ mapOpen: false, worldReplayActive: true })).toBe(false);
      expect(isBattleHudVisible({ mapOpen: true, worldReplayActive: true })).toBe(false);
    });
  });
});
