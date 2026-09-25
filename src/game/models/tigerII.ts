import * as THREE from 'three';
import type { VehicleSpec } from '../../data/types';
import { ModelKit, bothSides, darker, prism, rect, tube, wheel, type ModelParts } from './kit';

const DEG = Math.PI / 180;

/**
 * 虎王(亨舍尔炮塔):50° 大倾角首上、25° 内倾侧装甲、9 对交错负重轮、
 * 正面平直两侧内倾的楔形炮塔、窄防盾、L/71 长炮管带制退器。
 */
export function buildTigerII(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const hh = hull.height / 2; // 1.05
  const hl = hull.length / 2; // 3.69
  const hw = hull.width / 2; // 1.875

  const body = kit.material(spec.color);
  const shade = kit.material(darker(spec.color, 0.8));
  const track = kit.material(0x2e2b26, 0.95);
  const steel = kit.material(0x44443f, 0.8);
  const dark = kit.material(0x1c1c1c, 0.9);

  const trackW = 0.8;
  const deck = -0.05;
  bothSides((s) => {
    const xs = [s * (hw - trackW), s * hw];
    const r = { x0: Math.min(...xs), x1: Math.max(...xs) };
    kit.add(root, prism(-hh, deck - 0.05, { ...r, z0: -2.1, z1: 2.1 }, { ...r, z0: -hl + 0.2, z1: hl - 0.15 }), track);
    for (let i = 0; i < 9; i++) {
      const outer = i % 2 === 0;
      kit.add(root, wheel(0.4, 0.1, 12), steel, [s * (hw + (outer ? 0.02 : -0.1)), -0.6, -2.55 + i * 0.64]);
    }
    kit.add(root, wheel(0.42, 0.2, 10), dark, [s * (hw - 0.25), -0.35, -hl + 0.45]);
    kit.add(root, wheel(0.36, 0.2, 10), dark, [s * (hw - 0.25), -0.5, hl - 0.45]);
  });

  // 下部车体:首下 50°
  const lowerH = deck + 0.6;
  kit.add(
    root,
    prism(-0.6, deck, rect(hull.width - 2 * trackW, -hl + lowerH * Math.tan(50 * DEG), hl - 0.3), rect(hull.width - 2 * trackW, -hl, hl - 0.1)),
    shade,
  );
  // 上部车体:首上 50°、侧面 25° 内倾、后部 30°
  const upperH = hh - deck; // 1.1
  kit.add(
    root,
    prism(
      deck,
      hh,
      rect(hull.width, -hl, hl - 0.1),
      rect(hull.width - 2 * upperH * Math.tan(25 * DEG), -hl + upperH * Math.tan(50 * DEG), hl - 0.1 - upperH * Math.tan(30 * DEG)),
    ),
    body,
  );
  kit.add(root, new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8).rotateX(-40 * DEG), dark, [0.6, deck + upperH / 2, -hl + (upperH / 2) * Math.tan(50 * DEG) - 0.05]);
  bothSides((s) => kit.add(root, new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8), dark, [s * 0.45, hh - 0.05, hl - 0.75]));

  // --- 亨舍尔炮塔:正面近垂直(10°),两侧 21° 内倾,后部 20°
  const th = turret.height;
  const tl = turret.length / 2;
  const tw = turret.width / 2;
  const insetSide = th * Math.tan(21 * DEG);
  kit.add(
    turretPivot,
    prism(0, th, { x0: -tw, x1: tw, z0: -tl, z1: tl }, { x0: -tw + insetSide, x1: tw - insetSide, z0: -tl + th * Math.tan(10 * DEG), z1: tl - th * Math.tan(20 * DEG) }),
    body,
  );
  kit.add(turretPivot, new THREE.CylinderGeometry(0.36, 0.38, 0.22, 12), shade, [-0.55, th + 0.1, 0.6]);

  // --- 窄防盾(「猪头」式)+ L/71 长炮管 + 制退器
  kit.add(gunPivot, new THREE.CylinderGeometry(0.34, 0.4, 0.55, 10).rotateX(-Math.PI / 2), shade, [0, 0, -0.2]);
  const muzzle = -turret.barrelLength;
  kit.add(gunPivot, tube(0.12, 0.085, -0.45, muzzle + 0.45, 10), shade);
  kit.add(gunPivot, tube(0.16, 0.16, muzzle + 0.47, muzzle, 10), dark);
}
