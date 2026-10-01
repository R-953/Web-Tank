import { describe, it, expect } from 'vitest';
import { arrowVertices, clampView, gridLabel, markerColor, viewToWorld, worldToView, zoomCircle, zoomSquare } from '../src/ui/Minimap';

describe('小地图标记颜色', () => {
  it('敌军红色、友军蓝色,被击毁的双方都是灰色', () => {
    expect(markerColor('enemy', false)).toBe('#ff3b30');
    expect(markerColor('ally', false)).toBe('#3aa0ff');
    expect(markerColor('enemy', true)).toBe('#5a5a5a');
    expect(markerColor('ally', true)).toBe('#5a5a5a');
  });
});

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

describe('小地图箭头标记', () => {
  const full = { cx: 0, cz: 0, half: 1500 };

  it('朝北尖端向上、朝西向左、朝南向下、朝东向右;两个后角对称', () => {
    const tip = (heading: number) => arrowVertices(100, 100, heading)[0];
    expect(tip(0)[0]).toBeCloseTo(100, 6);
    expect(tip(0)[1]).toBeCloseTo(94, 6);
    expect(tip(Math.PI / 2)[0]).toBeCloseTo(94, 6);
    expect(tip(Math.PI / 2)[1]).toBeCloseTo(100, 6);
    expect(tip(Math.PI)[1]).toBeCloseTo(106, 6);
    expect(tip(-Math.PI / 2)[0]).toBeCloseTo(106, 6);
    const [t, r, l] = arrowVertices(0, 0, 0.7);
    expect(Math.hypot(r[0] - t[0], r[1] - t[1])).toBeCloseTo(Math.hypot(l[0] - t[0], l[1] - t[1]), 6);
  });

  it('尖端方向和车头在小地图上的方向一致(朝向按 main.ts 的算法由车头向量求出)', () => {
    for (const a of [0, 0.4, 1.3, 2.5, -0.8, -2.2, Math.PI]) {
      // 车头方向(世界坐标,水平面);朝向算法同 main.ts:atan2(-fwd.x, -fwd.z)
      const fwd = { x: Math.cos(a), z: Math.sin(a) };
      const heading = Math.atan2(-fwd.x, -fwd.z);
      const [ox, oy] = worldToView(full, 240, 0, 0);
      const [fx, fy] = worldToView(full, 240, fwd.x * 100, fwd.z * 100);
      const want = Math.atan2(fy - oy, fx - ox);
      const [t] = arrowVertices(ox, oy, heading);
      const got = Math.atan2(t[1] - oy, t[0] - ox);
      expect(Math.cos(got - want)).toBeCloseTo(1, 6);
    }
  });
});
