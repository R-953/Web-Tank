import { describe, it, expect } from 'vitest';
import { clampView, gridLabel, viewToWorld, worldToView, zoomCircle, zoomSquare } from '../src/ui/Minimap';

describe('小地图网格标注', () => {
  it('西北角 A1、东南角 J10、中心 F6;超出地图按最近的边格算', () => {
    expect(gridLabel(-1499, -1499, 3000)).toBe('A1');
    expect(gridLabel(1499, 1499, 3000)).toBe('J10');
    expect(gridLabel(0, 0, 3000)).toBe('F6');
    expect(gridLabel(-1, -1, 3000)).toBe('E5');
    expect(gridLabel(5000, -5000, 3000)).toBe('A10');
    // 玩家出生点 (0, 1200):第 10 行(J)
    expect(gridLabel(0, 1200, 3000)).toBe('J6');
  });
});

describe('小地图坐标变换', () => {
  const full = { cx: 0, cz: 0, half: 1500 };

  it('缺省视野显示整张地图:西北角在左上、东南角在右下,来回变换一致', () => {
    expect(worldToView(full, 240, -1500, -1500)).toEqual([0, 0]);
    expect(worldToView(full, 240, 1500, 1500)).toEqual([240, 240]);
    const [px, py] = worldToView(full, 240, 321, -777);
    const w = viewToWorld(full, 240, px, py);
    expect(w.x).toBeCloseTo(321, 6);
    expect(w.z).toBeCloseTo(-777, 6);
  });

  it('方形放大:光标下的点不动;放大到 8 倍封顶;缩小回 1 倍时视野回到整张地图', () => {
    const v = zoomSquare(full, 1500, 600, -300, -2);
    expect(v.half).toBeCloseTo(750, 6);
    const before = worldToView(full, 240, 600, -300);
    const after = worldToView(v, 240, 600, -300);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
    let z = full;
    for (let i = 0; i < 20; i++) z = zoomSquare(z, 1500, 0, 0, -1);
    expect(z.half).toBeCloseTo(1500 / 8, 6);
    for (let i = 0; i < 20; i++) z = zoomSquare(z, 1500, 1400, 1400, 1);
    expect(z).toEqual(full);
  });

  it('方形视野不会超出地图边界', () => {
    const v = clampView({ cx: 1400, cz: -1450, half: 300 }, 1500);
    expect(v.cx).toBe(1200);
    expect(v.cz).toBe(-1200);
    const z = zoomSquare(full, 1500, 1500, 1500, -1);
    expect(z.cx + z.half).toBeLessThanOrEqual(1500 + 1e-9);
    expect(z.cz + z.half).toBeLessThanOrEqual(1500 + 1e-9);
  });

  it('圆形模式的显示半径在 150–1500 m 之间', () => {
    expect(zoomCircle(400, -2)).toBeCloseTo(200, 6);
    expect(zoomCircle(400, -10)).toBe(150);
    expect(zoomCircle(400, 10)).toBe(1500);
  });
});
