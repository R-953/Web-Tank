import { describe, expect, it } from 'vitest';
import { killcamPlan, type KillcamPolicyInput } from '../src/ui/killcamPolicy';

describe('killcamPlan 回放触发策略', () => {
  const input = (overrides: Partial<KillcamPolicyInput> = {}): KillcamPolicyInput => ({
    playerId: 'player',
    shooterId: 'player',
    targetId: 'enemy',
    targetName: '敌方坦克',
    destroyed: false,
    killCam: true,
    killCamAll: false,
    ...overrides,
  });

  it('总开关关闭时一律不播', () => {
    expect(killcamPlan(input({ killCam: false, destroyed: true, killCamAll: true }))).toBeNull();
    expect(killcamPlan(input({
      shooterId: 'enemy',
      targetId: 'player',
      destroyed: true,
      killCam: false,
    }))).toBeNull();
  });

  it('玩家击毁目标时播右上角小窗,不带标题', () => {
    expect(killcamPlan(input({ destroyed: true, killCamAll: false }))).toEqual({});
  });

  it('玩家命中但未击毁时仅在开启所有命中回放后播', () => {
    expect(killcamPlan(input({ killCamAll: true }))).toEqual({ title: '命中回放 · 敌方坦克' });
    expect(killcamPlan(input({ killCamAll: false }))).toBeNull();
  });

  it('己方被击毁时播全屏回放,标题包含击毁者名字或使用缺省文案', () => {
    expect(killcamPlan(input({
      shooterId: 'enemy',
      targetId: 'player',
      destroyed: true,
      killerName: '敌方坦克',
    }))).toEqual({ layout: 'full', title: '被 敌方坦克 击毁' });
    expect(killcamPlan(input({
      shooterId: 'enemy',
      targetId: 'player',
      destroyed: true,
    }))).toEqual({ layout: 'full', title: '被击毁' });
  });

  it('己方被击中但未击毁时不播,即使开启所有命中回放', () => {
    expect(killcamPlan(input({
      shooterId: 'enemy',
      targetId: 'player',
      killCamAll: true,
    }))).toBeNull();
  });

  it('AI 打 AI 时不播', () => {
    expect(killcamPlan(input({
      shooterId: 'enemy',
      targetId: 'other',
      destroyed: true,
      killCamAll: true,
    }))).toBeNull();
  });
});
