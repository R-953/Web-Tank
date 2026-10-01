import { cyl, prism, tube, type GeoBatch, type Palette } from '../kit';
import type { ShermanLayout } from './layout';

/**
 * 炮塔与火炮:T23 炮塔(76 mm M1A1 / M1A2)或 Jumbo 厚壁炮塔(75 mm M3),由 L.variant 决定。
 *
 * 【占位】任务 015 会整个重写这个文件。现在炮塔是一个梯形块加指挥塔,火炮是一根圆管。
 * T 是炮塔静态网格(turretPivot,原点在座圈中心、车顶高度);G 是火炮网格(gunPivot,原点在炮耳轴,随俯仰转动)。
 * 炮盾随火炮俯仰,所以放在 G 里。
 */
export function buildShermanTurret(L: ShermanLayout, T: GeoBatch, G: GeoBatch, C: Palette): void {
  const { length, width, height, trunnionZ } = L.turretBox;
  const jumbo = L.variant.turret === 'jumbo';
  T.add(
    prism(0, height, { x0: -width / 2, x1: width / 2, z0: trunnionZ + 0.15, z1: length / 2 }, { x0: -width / 2 + 0.2, x1: width / 2 - 0.2, z0: trunnionZ + 0.35, z1: length / 2 - 0.25 }),
    C.paint,
  );
  // 车长指挥塔(右后)
  T.add(cyl(0.3, 0.33, 0.28, 10), C.paint, [0.45, height + 0.14, 0.35]);
  // 炮盾 + 炮管
  G.add(prism(-0.3, 0.3, { x0: -0.4, x1: 0.4, z0: -0.25, z1: 0.1 }, { x0: -0.35, x1: 0.35, z0: -0.2, z1: 0.1 }), C.paint);
  const r = jumbo ? 0.065 : 0.06;
  G.add(tube(r * 1.4, r, -0.25, -L.barrelLength * 0.4), C.paint);
  G.add(tube(r, r * 0.9, -L.barrelLength * 0.4, -L.barrelLength), C.paint);
  if (L.variant.gun === 'm1a2') G.add(tube(0.09, 0.09, -L.barrelLength + 0.3, -L.barrelLength), C.shade);
}
