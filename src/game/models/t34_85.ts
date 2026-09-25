import * as THREE from 'three';
import type { VehicleSpec } from '../../data/types';
import { ModelKit, bothSides, darker, prism, rect, tube, wheel, type ModelParts } from './kit';

/**
 * T-34-85:60° 倾斜的首上装甲、内倾侧装甲、5 对大直径克里斯蒂负重轮、铸造圆形炮塔、无制退器的 85 炮。
 */
export function buildT3485(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const hh = hull.height / 2; // 0.81
  const hl = hull.length / 2; // 3.05
  const hw = hull.width / 2; // 1.5

  const body = kit.material(spec.color);
  const shade = kit.material(darker(spec.color, 0.8));
  const track = kit.material(0x2b2a26, 0.95);
  const rubber = kit.material(0x33342f, 0.95);
  const dark = kit.material(0x1c1c1c, 0.9);

  const trackW = 0.5;
  const deck = 0.06; // 履带上沿 / 上部车体底
  bothSides((s) => {
    const xs = [s * (hw - trackW), s * hw];
    const r = { x0: Math.min(...xs), x1: Math.max(...xs) };
    kit.add(root, prism(-hh, deck - 0.1, { ...r, z0: -2.3, z1: 2.5 }, { ...r, z0: -hl + 0.05, z1: hl - 0.05 }), track);
    for (let i = 0; i < 5; i++) {
      kit.add(root, wheel(0.41, 0.14, 12), rubber, [s * (hw + 0.02), -0.4, -2.1 + i * 1.08]);
    }
    kit.add(root, wheel(0.3, 0.16, 10), dark, [s * (hw - 0.15), -0.3, hl - 0.3]);
    kit.add(root, wheel(0.3, 0.16, 10), dark, [s * (hw - 0.15), -0.3, -hl + 0.3]);
  });

  // 下部车体:车首下装甲前倾
  kit.add(root, prism(-0.55, deck, rect(hull.width - 2 * trackW, -hl + 0.55, hl - 0.2), rect(hull.width - 2 * trackW, -hl, hl - 0.05)), shade);
  // 上部车体:首上 60°、侧面约 40° 内倾、后部 45°
  const upperH = hh - deck; // 0.75
  const glacisInset = upperH * Math.tan((60 * Math.PI) / 180);
  kit.add(
    root,
    prism(deck, hh, rect(hull.width, -hl, hl - 0.05), rect(hull.width - 0.5, -hl + glacisInset, hl - 0.05 - upperH)),
    body,
  );
  // 驾驶员舱门、航向机枪
  kit.add(root, new THREE.BoxGeometry(0.55, 0.06, 0.45), shade, [-0.45, (deck + hh) / 2 + 0.03, -hl + glacisInset / 2 - 0.02], [-Math.PI / 6, 0, 0]);
  kit.add(root, new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8).rotateX(-Math.PI / 6), dark, [0.55, (deck + hh) / 2, -hl + glacisInset / 2 - 0.05]);
  // 车尾两根排气管
  bothSides((s) => kit.add(root, tube(0.08, 0.08, hl + 0.1, hl - 0.15, 8), dark, [s * 0.55, deck + 0.2, 0]));

  // --- 铸造炮塔:下宽上窄的椭圆体,后部带尾舱
  const th = turret.height;
  const tl = turret.length / 2;
  const tw = turret.width / 2;
  const cast = new THREE.CylinderGeometry(0.78, 1, th, 10).scale(tw, 1, tl * 0.92);
  kit.add(turretPivot, cast, body, [0, th / 2, 0.05]);
  kit.add(turretPivot, prism(0.05, th - 0.1, rect(turret.width * 0.75, tl * 0.4, tl + 0.05), rect(turret.width * 0.6, tl * 0.4, tl - 0.1)), body);
  kit.add(turretPivot, new THREE.CylinderGeometry(0.33, 0.35, 0.22, 10), shade, [-0.45, th + 0.1, 0.35]);

  // --- 防盾 + 85 炮(无制退器)
  kit.add(gunPivot, new THREE.BoxGeometry(0.9, 0.5, 0.35), shade, [0, -0.05, -0.1]);
  kit.add(gunPivot, tube(0.1, 0.075, -0.25, -turret.barrelLength, 10), shade);
}
