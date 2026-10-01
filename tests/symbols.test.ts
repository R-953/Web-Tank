import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VehicleClass } from '../src/data/types';
import {
  symbolShape,
  symbolSvg,
  drawSymbol,
  setSymbology,
  currentSymbology,
  SYMBOL_COLORS,
  type Symbology,
} from '../src/ui/symbols';
import { classIcon } from '../src/ui/menu/classIcons';
import { SettingsStore, defaultSettings, sanitize } from '../src/settings/Settings';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

describe('战术军标 (Symbology) 核心模块', () => {
  beforeEach(() => {
    setSymbology('nato');
  });

  it('两套 × 四种类型共 8 个符号互不相同', () => {
    const sets: Symbology[] = ['nato', 'warsaw'];
    const classes: VehicleClass[] = ['light', 'medium', 'heavy', 'td'];

    const partSignatures = new Set<string>();
    const svgs = new Set<string>();

    for (const set of sets) {
      for (const cls of classes) {
        const shape = symbolShape(cls, { set });
        expect(shape.parts.length).toBeGreaterThan(0);

        // 以部件路径串作为该类型的几何指纹
        const signature = `${set}:${shape.parts.map((p) => p.d).join('|')}`;
        partSignatures.add(signature);

        // 内联 SVG 也互不相同
        const svg = symbolSvg(cls, { set });
        svgs.add(svg);
      }
    }

    // 两套 × 四类必须有 8 个完全独立的图形
    expect(partSignatures.size).toBe(8);
    expect(svgs.size).toBe(8);
  });

  it('传 / 不传 affiliation 时正确生成 / 忽略识别框', () => {
    const noFrame = symbolShape('medium', { set: 'nato' });
    expect(noFrame.frame).toBeUndefined();

    const withFrameFriend = symbolShape('medium', { set: 'nato', affiliation: 'friend' });
    expect(withFrameFriend.frame).toBeDefined();

    const withFrameHostile = symbolShape('medium', { set: 'warsaw', affiliation: 'hostile' });
    expect(withFrameHostile.frame).toBeDefined();

    const withFrameNeutral = symbolShape('medium', { set: 'nato', affiliation: 'neutral' });
    expect(withFrameNeutral.frame).toBeDefined();

    // 检查 symbolSvg 中是否有 frame path
    const svgNoFrame = symbolSvg('medium', { set: 'nato' });
    expect(svgNoFrame).not.toContain('M 3 7 H 29');

    const svgWithFrame = symbolSvg('medium', { set: 'nato', affiliation: 'friend' });
    expect(svgWithFrame).toContain('M 3 7 H 29');
  });

  it('友军 / 敌军 / 中立三种框的形状和颜色符合文档', () => {
    // 友军: 矩形, 蓝色 #00a8f0
    const friend = symbolShape('medium', { set: 'nato', affiliation: 'friend' });
    expect(friend.frame).toBeDefined();
    expect(friend.frame?.d).toContain('M 3 7 H 29 V 25 H 3 Z');
    expect(friend.frame?.stroke).toBe(SYMBOL_COLORS.friend);
    expect(friend.frame?.stroke).toBe('#00a8f0');

    // 敌军: 菱形, 红色 #ff4d4d
    const hostile = symbolShape('heavy', { set: 'warsaw', affiliation: 'hostile' });
    expect(hostile.frame).toBeDefined();
    expect(hostile.frame?.d).toContain('M 16 2 L 30 16 L 16 30 L 2 16 Z');
    expect(hostile.frame?.stroke).toBe(SYMBOL_COLORS.hostile);
    expect(hostile.frame?.stroke).toBe('#ff4d4d');

    // 中立: 正方形, 绿色 #00c800
    const neutral = symbolShape('light', { set: 'nato', affiliation: 'neutral' });
    expect(neutral.frame).toBeDefined();
    expect(neutral.frame?.d).toContain('M 5 5 H 27 V 27 H 5 Z');
    expect(neutral.frame?.stroke).toBe(SYMBOL_COLORS.neutral);
    expect(neutral.frame?.stroke).toBe('#00c800');
  });

  it('不传 affiliation 时使用 currentColor', () => {
    const shape = symbolShape('medium', { set: 'nato' });
    for (const part of shape.parts) {
      expect(part.stroke).toBe('currentColor');
    }
  });

  it('dead 变灰且叠加 × 标记', () => {
    const alive = symbolShape('medium', { set: 'nato', affiliation: 'friend' });
    expect(alive.frame?.stroke).toBe(SYMBOL_COLORS.friend);
    expect(alive.parts.some((p) => p.d.includes('M 9 9 L 23 23'))).toBe(false);

    const dead = symbolShape('medium', { set: 'nato', affiliation: 'friend', dead: true });
    expect(dead.frame?.stroke).toBe(SYMBOL_COLORS.dead);
    expect(dead.frame?.stroke).toBe('#888888');
    for (const part of dead.parts) {
      expect(part.stroke).toBe(SYMBOL_COLORS.dead);
    }
    // 叠了 × 标记
    const xPart = dead.parts.find((p) => p.d.includes('M 9 9 L 23 23'));
    expect(xPart).toBeDefined();

    // SVG 渲染检查
    const deadSvg = symbolSvg('medium', { set: 'nato', affiliation: 'friend', dead: true });
    expect(deadSvg).toContain('#888888');
    expect(deadSvg).toContain('aria-label="北约 · 中型坦克 · 友军 · 被击毁"');
  });

  it('aria-label 生成正确', () => {
    expect(symbolSvg('medium', { set: 'nato', affiliation: 'friend' })).toContain(
      'aria-label="北约 · 中型坦克 · 友军"',
    );
    expect(symbolSvg('heavy', { set: 'warsaw', affiliation: 'hostile' })).toContain(
      'aria-label="华约 · 重型坦克 · 敌军"',
    );
    expect(symbolSvg('light', { set: 'nato', affiliation: 'neutral' })).toContain(
      'aria-label="北约 · 轻型坦克 · 中立"',
    );
    expect(symbolSvg('td', { set: 'warsaw' })).toContain('aria-label="华约 · 坦克歼击车 / 突击炮"');
    expect(symbolSvg('medium', { set: 'nato' })).toContain('aria-label="北约 · 中型坦克"');
    expect(symbolSvg('heavy', { set: 'warsaw', dead: true })).toContain(
      'aria-label="华约 · 重型坦克 · 被击毁"',
    );
  });

  it('setSymbology 后 currentSymbology 与 classIcon 跟着变', () => {
    expect(currentSymbology()).toBe('nato');

    const natoSvg = classIcon('medium');
    expect(natoSvg).toContain('aria-label="北约 · 中型坦克"');

    setSymbology('warsaw');
    expect(currentSymbology()).toBe('warsaw');

    const warsawSvg = classIcon('medium');
    expect(warsawSvg).toContain('aria-label="华约 · 中型坦克"');

    // 两套符号的实际几何路径也发生变化
    expect(natoSvg).not.toBe(warsawSvg);

    setSymbology('nato');
    expect(currentSymbology()).toBe('nato');
  });

  it('drawSymbol 能正确调用 canvas 绘制 API 并按尺寸缩放', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      lineCap: '',
    } as unknown as CanvasRenderingContext2D;

    drawSymbol(mockCtx, 'medium', 100, 200, { set: 'nato', affiliation: 'friend', size: 32 });

    expect(mockCtx.save).toHaveBeenCalledTimes(1);
    expect(mockCtx.translate).toHaveBeenCalledWith(100, 200);
    expect(mockCtx.translate).toHaveBeenCalledWith(-16, -16);
    expect(mockCtx.scale).toHaveBeenCalledWith(1, 1);
    expect(mockCtx.restore).toHaveBeenCalledTimes(1);
  });
});

describe('战术符号设置项 (Settings & sanitize)', () => {
  it('缺省设置中 symbology 为 nato', () => {
    const def = defaultSettings();
    expect(def.game.symbology).toBe('nato');
  });

  it('旧设置/空设置没有这一项时缺省为北约', () => {
    expect(sanitize(null).game.symbology).toBe('nato');
    expect(sanitize({}).game.symbology).toBe('nato');
    expect(sanitize({ game: {} }).game.symbology).toBe('nato');
    expect(sanitize({ game: { minimapShape: 'circle' } }).game.symbology).toBe('nato');
  });

  it('非法值自动纠正为缺省的 nato', () => {
    expect(sanitize({ game: { symbology: 'invalid_faction' } }).game.symbology).toBe('nato');
    expect(sanitize({ game: { symbology: 123 } }).game.symbology).toBe('nato');
  });

  it('合法值 warsaw 能够正确识别与存储', () => {
    expect(sanitize({ game: { symbology: 'warsaw' } }).game.symbology).toBe('warsaw');

    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    expect(store.value.game.symbology).toBe('nato');

    store.update((d) => {
      d.game.symbology = 'warsaw';
    });
    expect(store.value.game.symbology).toBe('warsaw');

    const reloaded = new SettingsStore(storage);
    expect(reloaded.value.game.symbology).toBe('warsaw');
  });
});
