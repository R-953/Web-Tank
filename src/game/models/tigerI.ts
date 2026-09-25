import * as THREE from 'three';
import type { VehicleSpec } from '../../data/types';
import { ModelKit, bothSides, darker, prism, rect, tube, wheel, type ModelParts } from './kit';

/**
 * 虎式 Ausf. E:箱形车体、近乎垂直的前装甲、交错负重轮、马蹄形炮塔、带双室制退器的长 88 炮。
 */
export function buildTigerI(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const hh = hull.height / 2; // 0.975
  const hl = hull.length / 2; // 3.16
  const hw = hull.width / 2; // 1.78

  const body = kit.material(spec.color);
  const shade = kit.material(darker(spec.color, 0.8));
  const track = kit.material(0x2e2b26, 0.95);
  const rubber = kit.material(0x3a3935, 0.95);
  const dark = kit.material(0x1c1c1c, 0.9);

  // 履带:侧面看是梯形(接地段短、上段长),宽 0.72m
  const trackW = 0.72;
  const trackTop = -0.05;
  bothSides((s) => {
    const x0 = s * (hw - trackW);
    const x1 = s * hw;
    const r = { x0: Math.min(x0, x1), x1: Math.max(x0, x1) };
    kit.add(root, prism(-hh, trackTop, { ...r, z0: -1.9, z1: 1.9 }, { ...r, z0: -hl, z1: hl - 0.1 }), track);
    // 交错负重轮(外层 4 个 + 内层 4 个错开)
    for (let i = 0; i < 8; i++) {
      const z = -2.35 + i * 0.67;
      const outer = i % 2 === 0;
      kit.add(root, wheel(0.4, 0.1, 12), rubber, [s * (hw + (outer ? 0.02 : -0.08)), -0.55, z]);
    }
    // 主动轮(前)与诱导轮(后)
    kit.add(root, wheel(0.42, 0.18, 10), dark, [s * (hw - 0.2), -0.3, -hl + 0.35]);
    kit.add(root, wheel(0.36, 0.18, 10), dark, [s * (hw - 0.2), -0.45, hl - 0.4]);
  });

  // 车底 + 车鼻(上方近水平的首上、下方倾斜的首下)
  kit.add(root, prism(-0.5, trackTop, rect(hull.width - 2 * trackW, -hl + 0.35, hl - 0.2), rect(hull.width - 2 * trackW, -hl, hl - 0.1)), shade);
  // 上部车体:外扩覆盖履带,正面垂直(100mm)
  kit.add(root, prism(trackTop, hh, rect(hull.width - 0.1, -hl + 0.55, hl - 0.05), rect(hull.width - 0.1, -hl + 0.6, hl - 0.15)), body);
  // 车首前伸的短平台
  kit.add(root, prism(-0.35, trackTop, rect(hull.width - 0.2, -hl, -hl + 0.6), rect(hull.width - 0.2, -hl, -hl + 0.6)), body);
  // 驾驶员观察窗、航向机枪
  kit.add(root, new THREE.BoxGeometry(0.45, 0.14, 0.06), dark, [0.55, hh - 0.3, -hl + 0.52]);
  kit.add(root, new THREE.CylinderGeometry(0.1, 0.1, 0.12, 8).rotateX(Math.PI / 2), dark, [-0.6, hh - 0.35, -hl + 0.52]);
  // 车尾两根排气管
  bothSides((s) => kit.add(root, new THREE.CylinderGeometry(0.09, 0.09, 0.45, 8), dark, [s * 0.5, hh - 0.1, hl - 0.05]));

  // --- 炮塔:前半方、后半马蹄形,高 0.95
  const th = turret.height;
  const tl = turret.length / 2;
  const tw = turret.width / 2;
  kit.add(turretPivot, new THREE.BoxGeometry(turret.width - 0.1, th, tl), body, [0, th / 2, -tl / 2]);
  const horseshoe = new THREE.CylinderGeometry(1, 1, th, 14).scale(tw, 1, tl);
  kit.add(turretPivot, horseshoe, body, [0, th / 2, 0]);
  // 车长指挥塔(左后)、炮塔后部储物箱
  kit.add(turretPivot, new THREE.CylinderGeometry(0.4, 0.42, 0.24, 12), shade, [-0.6, th + 0.12, 0.45]);
  kit.add(turretPivot, new THREE.BoxGeometry(1.5, 0.5, 0.45), shade, [0, th / 2 + 0.05, tl + 0.18]);

  // --- 防盾 + 炮管(随火炮俯仰)
  kit.add(gunPivot, new THREE.BoxGeometry(1.5, 0.72, 0.3), shade, [0, 0, -0.12]);
  const muzzle = -turret.barrelLength;
  kit.add(gunPivot, tube(0.11, 0.085, -0.25, muzzle + 0.4, 10), shade);
  // 双室炮口制退器
  kit.add(gunPivot, tube(0.16, 0.16, muzzle + 0.42, muzzle, 10), dark);
}
