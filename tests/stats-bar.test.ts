import { describe, expect, it } from 'vitest';
import { FpsMeter, formatStats, newMatchId, StatsBar } from '../src/ui/hud/StatsBar';

describe('帧率与对局信息条', () => {
  it('计算固定帧间隔,并随最近帧间隔变化', () => {
    const meter = new FpsMeter();
    for (let at = 0; at <= 500; at += 1000 / 60) meter.tick(at);
    expect(meter.fps).toBe(60);

    for (let at = 500; at <= 1000; at += 20) meter.tick(at);
    expect(meter.fps).toBe(50);
  });

  it('生成 15 位小写十六进制对局 ID,并支持注入随机源', () => {
    const first = newMatchId();
    const second = newMatchId();
    expect(first).toMatch(/^[0-9a-f]{15}$/);
    expect(second).toMatch(/^[0-9a-f]{15}$/);
    expect(first).not.toBe(second);
    expect(newMatchId(() => 0.5)).toBe('888888888888888');
  });

  it('格式化统计值并取整', () => {
    expect(formatStats({ fps: 74.6, pingMs: 0.4, lossPct: 0.6, matchId: '52def57001e76f0' }))
      .toBe('FPS: 75  Ping: 0  PL: 1%  52def57001e76f0');
  });

  it('挂载 DOM、节流更新文字并支持显示控制', () => {
    const parent = document.createElement('div');
    const statsBar = new StatsBar(parent);
    const element = parent.firstElementChild as HTMLElement;

    expect(element).not.toBeNull();
    expect(element.style.position).toBe('fixed');
    expect(element.style.display).toBe('none');
    statsBar.setVisible(true);
    statsBar.setMatchId('0123456789abcde');
    for (let now = 0; now < 500; now += 1000 / 60) statsBar.update(now);
    statsBar.update(500);
    expect(element.textContent).toContain('FPS: 60  Ping: 0  PL: 0%  0123456789abcde');
    statsBar.setVisible(false);
    expect(element.style.display).toBe('none');
  });
});
