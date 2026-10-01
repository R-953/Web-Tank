import { describe, it, expect } from 'vitest';
import { azimuthFromYaw, azimuthTicks } from '../src/ui/SightOverlay';

describe('瞄准镜方位角计算 azimuthFromYaw', () => {
  it('azimuthFromYaw(0) = 0', () => {
    expect(azimuthFromYaw(0)).toBe(0);
  });

  it('向右转 90°(yaw = -π/2)= 90', () => {
    expect(azimuthFromYaw(-Math.PI / 2)).toBe(90);
  });

  it('向左转 90°(yaw = π/2)= 270', () => {
    expect(azimuthFromYaw(Math.PI / 2)).toBe(270);
  });

  it('正南方向(yaw = ±π)= 180', () => {
    expect(azimuthFromYaw(Math.PI)).toBe(180);
    expect(azimuthFromYaw(-Math.PI)).toBe(180);
  });

  it('azimuthFromYaw 结果永远在 [0, 360)', () => {
    expect(azimuthFromYaw(2 * Math.PI)).toBe(0);
    expect(azimuthFromYaw(-2 * Math.PI)).toBe(0);
    expect(azimuthFromYaw(4 * Math.PI)).toBe(0);
    expect(azimuthFromYaw(-4 * Math.PI)).toBe(0);

    // 稠密测试各种 yaw 值
    for (let y = -20; y <= 20; y += 0.25) {
      const az = azimuthFromYaw(y);
      expect(az).toBeGreaterThanOrEqual(0);
      expect(az).toBeLessThan(360);
      expect(Object.is(az, -0)).toBe(false);
    }
  });
});

describe('顶部方位刻度带 azimuthTicks', () => {
  it('azimuthTicks(355, 30) 里有 deg = 0 的长刻度且 label = "0",offset = 5;每个长刻度的 deg 都是 15 的倍数', () => {
    const ticks = azimuthTicks(355, 30);

    // 包含 deg = 0 的长刻度且 label = "0", offset = 5
    const zeroTick = ticks.find((t) => t.deg === 0);
    expect(zeroTick).toBeDefined();
    expect(zeroTick!.major).toBe(true);
    expect(zeroTick!.label).toBe('0');
    expect(zeroTick!.offset).toBe(5);

    // 每个长刻度的 deg 都是 15 的倍数
    const majorTicks = ticks.filter((t) => t.major);
    expect(majorTicks.length).toBeGreaterThan(0);
    for (const t of majorTicks) {
      expect(t.deg % 15).toBe(0);
      expect(t.label).toBe(String(t.deg));
    }

    // 短刻度不带文字标签
    const minorTicks = ticks.filter((t) => !t.major);
    for (const t of minorTicks) {
      expect(t.label).toBeNull();
    }
  });

  it('跨 0 / 360 时 offset 连续且单调递增', () => {
    const ticks = azimuthTicks(355, 30);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].offset - ticks[i - 1].offset).toBeCloseTo(5, 5);
      expect(ticks[i].offset).toBeGreaterThan(ticks[i - 1].offset);
    }
  });

  it('方位 0° 为中心时左右对称分布', () => {
    const ticks = azimuthTicks(0, 30);
    const centerTick = ticks.find((t) => t.offset === 0);
    expect(centerTick).toBeDefined();
    expect(centerTick!.deg).toBe(0);
    expect(centerTick!.major).toBe(true);
    expect(centerTick!.label).toBe('0');

    // 左边 -15° 为 345, 右边 +15° 为 15
    const left15 = ticks.find((t) => t.offset === -15);
    expect(left15).toBeDefined();
    expect(left15!.deg).toBe(345);
    expect(left15!.major).toBe(true);
    expect(left15!.label).toBe('345');

    const right15 = ticks.find((t) => t.offset === 15);
    expect(right15).toBeDefined();
    expect(right15!.deg).toBe(15);
    expect(right15!.major).toBe(true);
    expect(right15!.label).toBe('15');
  });
});
