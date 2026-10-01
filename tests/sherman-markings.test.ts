import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { M4A3E2, M4A3E8, M4A3_76W } from '../src/data/vehicles';
import { GeoBatch, palette, DEG } from '../src/game/models/kit';
import { shermanLayout, type ShermanLayout, type ShermanVariant } from '../src/game/models/sherman/layout';
import { buildShermanMarkings, STAR_COLOR } from '../src/game/models/sherman/markings';

interface MarkingsResult {
  L: ShermanLayout;
  H: GeoBatch;
  T: GeoBatch;
  triCount: number;
  geoH: THREE.BufferGeometry;
  geoT: THREE.BufferGeometry;
}

function buildMarkingsOnly(
  spec = M4A3_76W,
  variant: ShermanVariant = { suspension: 'vvss', turret: 't23', gun: 'm1a1', applique: false },
): MarkingsResult {
  const L = shermanLayout(spec, variant);
  const C = palette(spec.color);
  const H = new GeoBatch();
  const T = new GeoBatch();
  buildShermanMarkings(L, H, T, C);
  const triCount = H.triangles + T.triangles;
  const geoH = H.build();
  const geoT = T.build();
  return { L, H, T, triCount, geoH, geoT };
}

/**
 * 用 layout.ts 定义的尺寸与解析平面, 计算任意顶点到谢尔曼车体四个贴附面的垂直距离最小值:
 * 1. 车体左侧面: x = - (L.upperHalfW + L.applique)
 * 2. 车体右侧面: x = + (L.upperHalfW + L.applique)
 * 3. 车顶/发动机舱盖: y = L.top
 * 4. 47° 倾斜首上面(外法线 (0, sin 47°, -cos 47°), 含附加装甲厚度 L.applique)
 */
function minDistanceToArmorPlates(v: THREE.Vector3, L: ShermanLayout): number {
  // 1. 左侧面
  const dLeft = Math.abs(v.x - (- (L.upperHalfW + L.applique)));
  // 2. 右侧面
  const dRight = Math.abs(v.x - (L.upperHalfW + L.applique));
  // 3. 车顶
  const dRoof = Math.abs(v.y - L.top);
  // 4. 首上 47° 斜板 (法线方向距离)
  const dGlacis = Math.abs(
    (v.y - L.glacisBottom.y) * Math.sin(47 * DEG) -
    (v.z - L.glacisBottom.z) * Math.cos(47 * DEG) -
    L.applique,
  );

  return Math.min(dLeft, dRight, dRoof, dGlacis);
}

describe('谢尔曼真实涂装与白星标识测试 (026-sherman-paint)', () => {
  const testVehicles = [
    { id: 'm4a3_76w', spec: M4A3_76W, variant: { suspension: 'vvss' as const, turret: 't23' as const, gun: 'm1a1' as const, applique: false } },
    { id: 'm4a3e8', spec: M4A3E8, variant: { suspension: 'hvss' as const, turret: 't23' as const, gun: 'm1a2' as const, applique: false } },
    { id: 'm4a3e2', spec: M4A3E2, variant: { suspension: 'vvss' as const, turret: 'jumbo' as const, gun: 'm3' as const, applique: true } },
  ];

  it('三辆车均成功生成标识, 且每辆车的标识三角面合计 ≤ 300', () => {
    for (const { spec, variant } of testVehicles) {
      const res = buildMarkingsOnly(spec, variant);

      // 三辆车都生成了标识
      expect(res.triCount).toBeGreaterThan(0);
      // 标识三角面合计 ≤ 300
      expect(res.triCount).toBeLessThanOrEqual(300);
      // 细节丰富度(包含两侧五角星与发动机舱盖对空识别星, 至少 50 三角面)
      expect(res.triCount).toBeGreaterThanOrEqual(50);
    }
  });

  it('每个标识的顶点离它所贴的面不超过 1 cm (基于 layout.ts 的尺寸验证)', () => {
    for (const { spec, variant } of testVehicles) {
      const res = buildMarkingsOnly(spec, variant);
      const posH = res.geoH.getAttribute('position');
      const v = new THREE.Vector3();

      for (let i = 0; i < posH.count; i++) {
        v.fromBufferAttribute(posH, i);
        const dist = minDistanceToArmorPlates(v, res.L);

        // 顶点离对应表面不超过 1 cm (0.01 m)
        expect(dist).toBeLessThanOrEqual(0.01);
        // 且未发生穿插进装甲内或完全贴紧(设计为外侧 5 mm 左右, 留容差)
        expect(dist).toBeGreaterThanOrEqual(0.003);
      }
    }
  });

  it('三辆车的标识差异符合史料: E2 首上无白星(防瞄准), 76W 与 E8 首上有 47° 倾斜白星', () => {
    const w76 = buildMarkingsOnly(M4A3_76W, testVehicles[0].variant);
    const e8 = buildMarkingsOnly(M4A3E8, testVehicles[1].variant);
    const e2 = buildMarkingsOnly(M4A3E2, testVehicles[2].variant);

    // 判断在首上区域是否有顶点:
    const hasGlacisVertices = (res: MarkingsResult) => {
      const pos = res.geoH.getAttribute('position');
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        // 首上区域判定: z < -1.5 且 y 在首上高度区间
        if (v.z < -1.5 && v.y > res.L.sponsonY && v.y < res.L.top) {
          const dGlacis = Math.abs(
            (v.y - res.L.glacisBottom.y) * Math.sin(47 * DEG) -
            (v.z - res.L.glacisBottom.z) * Math.cos(47 * DEG) -
            res.L.applique,
          );
          if (dGlacis <= 0.01) return true;
        }
      }
      return false;
    };

    expect(hasGlacisVertices(w76)).toBe(true);
    expect(hasGlacisVertices(e8)).toBe(true);
    // E2 首上附加装甲无白星
    expect(hasGlacisVertices(e2)).toBe(false);

    // E2 面数因无首上星而少 10 面
    expect(w76.triCount).toBe(72);
    expect(e8.triCount).toBe(72);
    expect(e2.triCount).toBe(62);
  });

  it('标识颜色使用平光暖白, 不用纯白色(0xffffff)', () => {
    // 检查 STAR_COLOR 颜色定义: 红色与绿色略大于蓝色(暖调)
    const c = new THREE.Color(STAR_COLOR);
    expect(c.r).toBeGreaterThan(c.b);
    expect(c.g).toBeGreaterThan(c.b);
    expect(STAR_COLOR).not.toBe(0xffffff);

    // 检查网格顶点色均写入了 STAR_COLOR
    for (const { spec, variant } of testVehicles) {
      const res = buildMarkingsOnly(spec, variant);
      const col = res.geoH.getAttribute('color');
      expect(col).toBeDefined();
      for (let i = 0; i < col.count; i++) {
        expect(col.getX(i)).toBeCloseTo(c.r, 2);
        expect(col.getY(i)).toBeCloseTo(c.g, 2);
        expect(col.getZ(i)).toBeCloseTo(c.b, 2);
      }
    }
  });

  it('三辆车的涂装色已换成有出处的暗色 Olive Drab (FS 33070: 0x544f3d), 区别于 4BO 与德系黄色', () => {
    for (const { spec } of testVehicles) {
      expect(spec.color).toBe(0x544f3d);
      // 暗色褐色调: R > G > B
      const r = (spec.color >> 16) & 0xff;
      const g = (spec.color >> 8) & 0xff;
      const b = spec.color & 0xff;
      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
    }
  });
});
