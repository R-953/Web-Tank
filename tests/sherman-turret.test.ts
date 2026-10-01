import { describe, it, expect } from 'vitest';
import { M4A3E2, M4A3E8, M4A3_76W } from '../src/data/vehicles';
import { GeoBatch, palette } from '../src/game/models/kit';
import { shermanLayout, type ShermanLayout } from '../src/game/models/sherman/layout';
import { buildShermanTurret } from '../src/game/models/sherman/turret';

function buildTurretBatches(layout: ShermanLayout) {
  const T = new GeoBatch();
  const G = new GeoBatch();
  const C = palette(layout.spec.color);
  buildShermanTurret(layout, T, G, C);
  return { T, G };
}

describe('谢尔曼炮塔与火炮模型 (015-sherman-turrets)', () => {
  const variants = [
    { name: 'M4A3(76)W (T23 + M1A1)', spec: M4A3_76W, turret: 't23' as const, gun: 'm1a1' as const, minElev: -12, maxElev: 25 },
    { name: 'M4A3E8 (T23 + M1A2)', spec: M4A3E8, turret: 't23' as const, gun: 'm1a2' as const, minElev: -12, maxElev: 25 },
    { name: 'M4A3E2 Jumbo (Jumbo + M3)', spec: M4A3E2, turret: 'jumbo' as const, gun: 'm3' as const, minElev: -10, maxElev: 25 },
  ];

  for (const { name, spec, turret, gun, minElev, maxElev } of variants) {
    describe(name, () => {
      const L = shermanLayout(spec, { suspension: 'vvss', turret, gun, applique: turret === 'jumbo' });
      const { T, G } = buildTurretBatches(L);
      const geoT = T.build();
      const geoG = G.build();

      it('T 和 G 节点都有几何体, 且三角面总数不超过 2,500', () => {
        expect(T.triangles).toBeGreaterThan(0);
        expect(G.triangles).toBeGreaterThan(0);
        const totalTris = T.triangles + G.triangles;
        expect(totalTris).toBeLessThan(2500);
      });

      it('炮塔底面贴紧车顶 (min y = 0), 没有零件插进车顶 (y < -0.001)', () => {
        const posT = geoT.getAttribute('position');
        let minY = Infinity;
        for (let i = 0; i < posT.count; i++) {
          const y = posT.getY(i);
          if (y < minY) minY = y;
        }
        expect(minY).toBeGreaterThanOrEqual(-0.001);
        expect(minY).toBeLessThan(0.01);
      });

      it('炮塔底面完整包覆 69 in 座圈 (r = L.ring.r = 0.8763 m)', () => {
        // 在 y=0 底面上, 围绕座圈一周进行多角度射线检测, 确认座圈都在炮塔底面内部
        const posT = geoT.getAttribute('position');
        const rRing = L.ring.r;

        // 提取 y 近似 0 的所有底面顶点
        const basePts: Array<[number, number]> = [];
        for (let i = 0; i < posT.count; i++) {
          if (Math.abs(posT.getY(i)) < 0.01) {
            basePts.push([posT.getX(i), posT.getZ(i)]);
          }
        }
        expect(basePts.length).toBeGreaterThan(0);

        // 验证沿 360° 每一角度, 底面多边形顶点能包围座圈半径
        for (let deg = 0; deg < 360; deg += 15) {
          const rad = (deg * Math.PI) / 180;

          // 简易检查: 找到沿该方向外侧的底面顶点距离 >= rRing
          let maxProjection = -Infinity;
          for (const [x, z] of basePts) {
            const proj = x * Math.cos(rad) + z * Math.sin(rad);
            if (proj > maxProjection) maxProjection = proj;
          }
          expect(maxProjection).toBeGreaterThanOrEqual(rRing - 0.01);
        }
      });

      it('炮口末端精确位于 z = -L.barrelLength', () => {
        const posG = geoG.getAttribute('position');
        let minZ = Infinity;
        for (let i = 0; i < posG.count; i++) {
          const z = posG.getZ(i);
          if (z < minZ) minZ = z;
        }
        expect(minZ).toBeCloseTo(-L.barrelLength, 2);
      });

      it('在全部俯仰角内 (-12°..+25° / -10°..+25°), 炮盾不插车顶、不穿炮塔顶, 且背面始终位于炮塔前脸以内', () => {
        // gunPivot 在炮塔坐标系中为 (0, trunnionY, trunnionZ) = (0, 0.36, -1.25)
        const trunnionY = L.turretBox.trunnionY;
        const trunnionZ = L.turretBox.trunnionZ;
        const posG = geoG.getAttribute('position');

        // 只检验防盾和炮根部件 (zG > -0.55 的顶点, 排除长身管探出车头部分)
        const mantletIndices: number[] = [];
        for (let i = 0; i < posG.count; i++) {
          if (posG.getZ(i) >= -0.55) {
            mantletIndices.push(i);
          }
        }
        expect(mantletIndices.length).toBeGreaterThan(0);

        for (let pitchDeg = minElev; pitchDeg <= maxElev; pitchDeg += 1) {
          const pitch = (pitchDeg * Math.PI) / 180;
          const cosP = Math.cos(pitch);
          const sinP = Math.sin(pitch);

          for (const idx of mantletIndices) {
            const yG = posG.getY(idx);
            const zG = posG.getZ(idx);

            // 绕 X 轴旋转 (俯仰)
            const yRot = yG * cosP - zG * sinP;
            const zRot = yG * sinP + zG * cosP;

            // 转到 turretPivot 坐标系
            const yT = trunnionY + yRot;
            const zT = trunnionZ + zRot;

            // 1. 不插进车体顶板 (yT >= 0)
            expect(yT).toBeGreaterThanOrEqual(-0.001);

            // 2. 不插穿炮塔顶板 (顶板高 0.72)
            expect(yT).toBeLessThanOrEqual(L.turretBox.height + 0.05);

            // 3. 炮盾背面 (zG >= 0.15) 始终位于炮塔前脸以内 (zT >= -1.22)
            if (zG >= 0.15) {
              expect(zT).toBeGreaterThan(-1.22);
            }
          }
        }
      });
    });
  }

  it('两种炮塔与三种火炮特征互不混淆', () => {
    const l76 = shermanLayout(M4A3_76W, { suspension: 'vvss', turret: 't23', gun: 'm1a1', applique: false });
    const lE8 = shermanLayout(M4A3E8, { suspension: 'hvss', turret: 't23', gun: 'm1a2', applique: false });
    const lE2 = shermanLayout(M4A3E2, { suspension: 'vvss', turret: 'jumbo', gun: 'm3', applique: true });

    // 1. 炮塔宽度: Jumbo (2.35 m) 宽于 T23 (2.2 m)
    expect(lE2.turretBox.width).toBeGreaterThan(l76.turretBox.width);

    // 2. 火炮长度: 76 mm 显著长于 75 mm
    expect(l76.barrelLength).toBeGreaterThan(3.0);
    expect(lE8.barrelLength).toBeGreaterThan(l76.barrelLength); // E8 制退器多出 0.07 m
    expect(lE2.barrelLength).toBeLessThan(2.0); // 75 mm M3 仅 1.89 m

    // 3. E8 制退器存在
    const bE8 = buildTurretBatches(lE8);
    const b76 = buildTurretBatches(l76);
    // E8 制退器有侧开孔零件, G 节点的三角面数比 76W 更多
    expect(bE8.G.triangles).toBeGreaterThan(b76.G.triangles);
  });
});
