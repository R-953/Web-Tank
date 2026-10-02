// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressRing, type RingIcon } from '../src/ui/hud/ProgressRing';

describe('ProgressRing 进度圆环组件', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('初始创建时默认隐藏并具有正确的 DOM 结构', () => {
    const ring = new ProgressRing(container);
    expect(ring.root).toBeDefined();
    expect(ring.root.parentElement).toBe(container);
    expect(ring.root.style.display).toBe('none');

    const svg = ring.root.querySelector('svg.progress-ring-svg');
    expect(svg).not.toBeNull();
    const bgCircle = ring.root.querySelector('circle.progress-ring-bg');
    expect(bgCircle).not.toBeNull();
    const fgCircle = ring.root.querySelector('circle.progress-ring-fg');
    expect(fgCircle).not.toBeNull();
  });

  it('进度 → stroke-dashoffset 计算正确且支持 clamp', () => {
    const ring = new ProgressRing(container);
    const radius = 18;
    const circumference = 2 * Math.PI * radius;

    // 0 进度: offset = 周长
    ring.set({ progress: 0, icon: 'repair' });
    const offset0 = parseFloat(ring.fgCircle.getAttribute('stroke-dashoffset') || '0');
    expect(offset0).toBeCloseTo(circumference, 1);

    // 50% 进度: offset = 周长 * 0.5
    ring.set({ progress: 0.5, icon: 'repair' });
    const offsetHalf = parseFloat(ring.fgCircle.getAttribute('stroke-dashoffset') || '0');
    expect(offsetHalf).toBeCloseTo(circumference * 0.5, 1);

    // 100% 进度: offset = 0
    ring.set({ progress: 1, icon: 'repair' });
    const offsetFull = parseFloat(ring.fgCircle.getAttribute('stroke-dashoffset') || '0');
    expect(offsetFull).toBeCloseTo(0, 1);

    // 溢出范围 clamp
    ring.set({ progress: -0.5, icon: 'repair' });
    expect(parseFloat(ring.fgCircle.getAttribute('stroke-dashoffset') || '0')).toBeCloseTo(circumference, 1);

    ring.set({ progress: 1.5, icon: 'repair' });
    expect(parseFloat(ring.fgCircle.getAttribute('stroke-dashoffset') || '0')).toBeCloseTo(0, 1);
  });

  it('有 label 时显示文字说明, 无 label 时隐藏文字说明', () => {
    const ring = new ProgressRing(container);

    // 带 label
    ring.set({ progress: 0.6, icon: 'repair', label: '正在修理,剩余:30秒' });
    expect(ring.labelEl.textContent).toBe('正在修理,剩余:30秒');
    expect(ring.labelEl.style.display).toBe('block');

    // 不带 label (省略)
    ring.set({ progress: 0.8, icon: 'ammo' });
    expect(ring.labelEl.textContent).toBe('');
    expect(ring.labelEl.style.display).toBe('none');

    // 空格 label
    ring.set({ progress: 0.2, icon: 'driver', label: '   ' });
    expect(ring.labelEl.textContent).toBe('');
    expect(ring.labelEl.style.display).toBe('none');
  });

  it('hide() 隐藏组件, set() 恢复显示', () => {
    const ring = new ProgressRing(container);

    ring.set({ progress: 0.5, icon: 'commander' });
    expect(ring.root.style.display).toBe('flex');

    ring.hide();
    expect(ring.root.style.display).toBe('none');

    ring.set({ progress: 0.8, icon: 'commander' });
    expect(ring.root.style.display).toBe('flex');
  });

  it('支持所有 RingIcon 图标及色调 (tone)', () => {
    const ring = new ProgressRing(container);
    const icons: RingIcon[] = [
      'driver',
      'gunner',
      'loader',
      'commander',
      'radio',
      'machinegunner',
      'repair',
      'ammo',
    ];

    for (const icon of icons) {
      ring.set({ progress: 0.5, icon });
      expect(ring.iconGroup.innerHTML.length).toBeGreaterThan(0);
    }

    // 默认 / amber 色调
    ring.set({ progress: 0.5, icon: 'repair', tone: 'amber' });
    expect(ring.fgCircle.getAttribute('stroke')).toBe('#ffcf5a');

    // blue 色调
    ring.set({ progress: 0.5, icon: 'repair', tone: 'blue' });
    expect(ring.fgCircle.getAttribute('stroke')).toBe('#7cc4ff');
  });
});
