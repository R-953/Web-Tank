import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { M4A3E2, M4A3E8, M4A3_76W } from '../src/data/vehicles';
import { GeoBatch, palette } from '../src/game/models/kit';
import { shermanLayout, type ShermanVariant } from '../src/game/models/sherman/layout';
import { buildShermanHull } from '../src/game/models/sherman/hull';

function buildHullGeo(spec = M4A3_76W, variant: ShermanVariant = { suspension: 'vvss', turret: 't23', gun: 'm1a1', applique: false }) {
  const L = shermanLayout(spec, variant);
  const C = palette(spec.color);
  const H = new GeoBatch();
  buildShermanHull(L, H, C);
  const triCount = H.triangles;
  const geo = H.build();
  geo.computeBoundingBox();
  return { L, H, geo, triCount, box: geo.boundingBox! };
}

describe('谢尔曼 M4A3 车体模型(013-sherman-hull)', () => {
  it('三辆车的车体三角面数均在合理区间,且严格小于 4,000 面', () => {
    const w76 = buildHullGeo(M4A3_76W, { suspension: 'vvss', turret: 't23', gun: 'm1a1', applique: false });
    const e8 = buildHullGeo(M4A3E8, { suspension: 'hvss', turret: 't23', gun: 'm1a2', applique: false });
    const e2 = buildHullGeo(M4A3E2, { suspension: 'vvss', turret: 'jumbo', gun: 'm3', applique: true });

    expect(w76.triCount).toBeLessThan(4000);
    expect(e8.triCount).toBeLessThan(4000);
    expect(e2.triCount).toBeLessThan(4000);
    expect(w76.triCount).toBe(2612);
    expect(e8.triCount).toBe(2636);
    expect(e2.triCount).toBe(2468);

    // 检查细节丰富度(至少 1500 三角面)
    expect(w76.triCount).toBeGreaterThan(1500);
    expect(e8.triCount).toBeGreaterThan(1500);
    expect(e2.triCount).toBeGreaterThan(1500);
  });

  it('车体边界与 layout.ts 对齐: 车鼻不超过 noseZ, 车顶在 top 附近, 车底不穿透地面', () => {
    for (const [spec, variant] of [
      [M4A3_76W, { suspension: 'vvss', turret: 't23', gun: 'm1a1', applique: false }],
      [M4A3E8, { suspension: 'hvss', turret: 't23', gun: 'm1a2', applique: false }],
      [M4A3E2, { suspension: 'vvss', turret: 'jumbo', gun: 'm3', applique: true }],
    ] as const) {
      const { L, box } = buildHullGeo(spec, variant);

      // 车鼻最前端在 -Z 方向, 不应超过 noseZ (即 min.z >= noseZ - 0.05 容差)
      expect(box.min.z).toBeGreaterThanOrEqual(L.noseZ - 0.05);

      // 车顶基准在 top, 舱盖与防弹护圈允许超出 0.15 m 以内
      expect(box.max.y).toBeLessThan(L.top + 0.2);
      expect(box.max.y).toBeGreaterThan(L.top);

      // 车底在 belly 附近, 不应沉入地面 ground 以下
      expect(box.min.y).toBeGreaterThan(L.ground - 0.05);
    }
  });

  it('车顶座圈内严格留空: 任何车顶零件均不得侵入 69 英寸座圈半径范围', () => {
    for (const [spec, variant] of [
      [M4A3_76W, { suspension: 'vvss', turret: 't23', gun: 'm1a1', applique: false }],
      [M4A3E8, { suspension: 'hvss', turret: 't23', gun: 'm1a2', applique: false }],
      [M4A3E2, { suspension: 'vvss', turret: 'jumbo', gun: 'm3', applique: true }],
    ] as const) {
      const { L, geo } = buildHullGeo(spec, variant);
      const pos = geo.getAttribute('position');
      const ringZ = L.ring.z;
      const ringR = L.ring.r;

      let intrudedVertices = 0;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        // 仅检查车顶面及以上的顶点
        if (y >= L.top - 0.005) {
          const distToCenter = Math.hypot(x, z - ringZ);
          // 如果顶点位于座圈内部(留 0.005 m 浮点容差)
          if (distToCenter < ringR - 0.005) {
            intrudedVertices++;
          }
        }
      }

      expect(intrudedVertices).toBe(0);
    }
  });

  it('三辆车之间具备显著外观区别: E8 具备加宽挡泥板, E2 具备附加装甲且无大灯', () => {
    const w76 = buildHullGeo(M4A3_76W, { suspension: 'vvss', turret: 't23', gun: 'm1a1', applique: false });
    const e8 = buildHullGeo(M4A3E8, { suspension: 'hvss', turret: 't23', gun: 'm1a2', applique: false });
    const e2 = buildHullGeo(M4A3E2, { suspension: 'vvss', turret: 'jumbo', gun: 'm3', applique: true });

    // 1. E8 的挡泥板与走台扩展板比 76W 和 E2 明显更宽, 覆盖 1.42 m 外缘宽履带
    expect(e8.box.max.x).toBeGreaterThan(1.44);
    expect(e8.box.max.x).toBeLessThan(1.5);
    expect(w76.box.max.x).toBeLessThan(1.37);

    // 2. E2 的侧面附加装甲增加车体侧向厚度
    expect(e2.L.applique).toBeGreaterThan(0);
    expect(w76.L.applique).toBe(0);

    // 3. E2 没有大灯(检查灯透镜颜色或者大灯区域)
    const e2Col = e2.geo.getAttribute('color');
    const w76Col = w76.geo.getAttribute('color');
    const lensCol = new THREE.Color(palette(0).lens);
    const hasLensColor = (attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
      for (let i = 0; i < attr.count; i++) {
        const r = attr.getX(i);
        const g = attr.getY(i);
        const b = attr.getZ(i);
        if (Math.abs(r - lensCol.r) < 0.01 && Math.abs(g - lensCol.g) < 0.01 && Math.abs(b - lensCol.b) < 0.01) {
          return true;
        }
      }
      return false;
    };

    expect(hasLensColor(w76Col)).toBe(true);
    expect(hasLensColor(e2Col)).toBe(false);
  });
});
