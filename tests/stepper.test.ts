import { describe, it, expect } from 'vitest';
import { FixedStepper } from '../src/engine/FixedStepper';

describe('FixedStepper 固定步长', () => {
  it('1 秒真实时间在 30 / 60 / 144 Hz 刷新率下都只走 60 步', () => {
    for (const hz of [30, 60, 144]) {
      const s = new FixedStepper(1 / 60);
      let steps = 0;
      for (let i = 0; i < hz; i++) steps += s.advance(1 / hz, () => {});
      expect(steps).toBe(60);
    }
  });

  it('卡顿时单帧最多补 maxStepsPerFrame 步,并丢弃积压', () => {
    const s = new FixedStepper(1 / 60, 5);
    expect(s.advance(1.0, () => {})).toBe(5);
    expect(s.alpha).toBe(0);
  });

  it('alpha 表示距离下一步的进度', () => {
    const s = new FixedStepper(1 / 60);
    expect(s.advance(1 / 120, () => {})).toBe(0);
    expect(s.alpha).toBeCloseTo(0.5, 6);
  });
});
