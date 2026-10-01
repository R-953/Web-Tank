import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { palette } from '../../src/game/models/kit';
import { m2hb } from '../../src/game/models/m2hb';

/** B2 隐藏测试:评分时拷进 tests/__hidden__/,执行者看不到。尺寸按任务卡,容差约 10% */
const geo: THREE.BufferGeometry = m2hb(palette(0x4b5320));
const pos = geo.getAttribute('position');
geo.computeBoundingBox();
const box = geo.boundingBox!;
const verts = (pred: (x: number, y: number, z: number) => boolean) => {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (pred(x, y, z)) out.push([x, y, z]);
  }
  return out;
};

describe('B2 隐藏测试', () => {
  it('带位置和顶点色,没有 NaN', () => {
    expect(pos).toBeDefined();
    expect(geo.getAttribute('color')).toBeDefined();
    for (let i = 0; i < pos.count * 3; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
  });

  it('三角面不超过 800', () => {
    const tris = (geo.index ? geo.index.count : pos.count) / 3;
    expect(tris).toBeGreaterThan(20);
    expect(tris).toBeLessThanOrEqual(800);
  });

  it('枪管朝 −Z:枪口 z ≈ −1.15,枪尾 z ≈ +0.50', () => {
    expect(box.min.z).toBeGreaterThan(-1.27);
    expect(box.min.z).toBeLessThan(-1.03);
    expect(box.max.z).toBeGreaterThan(0.4);
    expect(box.max.z).toBeLessThan(0.6);
  });

  it('底座底面在 y = 0,整体高度合理', () => {
    expect(Math.abs(box.min.y)).toBeLessThan(0.02);
    expect(box.max.y).toBeGreaterThan(0.45);
    expect(box.max.y).toBeLessThan(0.7);
  });

  it('枪管在中线上、轴线高约 0.40 m', () => {
    const front = verts((_x, _y, z) => z < -0.9);
    expect(front.length).toBeGreaterThan(0);
    for (const [x, y] of front) {
      expect(Math.abs(x)).toBeLessThan(0.06);
      expect(Math.abs(y - 0.4)).toBeLessThan(0.08);
    }
  });

  it('机匣顶面高出枪管轴线', () => {
    expect(verts((_x, y, z) => Math.abs(z) < 0.2 && y > 0.47).length).toBeGreaterThan(0);
  });

  it('弹箱挂在左侧(−X),整体宽度不超过 0.6 m', () => {
    expect(box.max.x).toBeLessThan(0.3);
    expect(box.min.x).toBeGreaterThan(-0.3);
    expect(box.min.x).toBeLessThan(-0.12);
    expect(-box.min.x).toBeGreaterThan(box.max.x + 0.04);
  });
});
