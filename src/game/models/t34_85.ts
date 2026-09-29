import type { VehicleSpec } from '../../data/types';
import { DEG, ModelKit, bothSides, box, darker, extrude, loft, palette, prism, revolve, rod, tube, type ModelParts, type Tuple3, type Vec2 } from './kit';
import { discWheel, rubberRoadWheel, runningGear } from './running';
import { headlight, periscope, roundHatch, spareLink } from './parts';

/**
 * T-34-85(1944 年型):
 *   60° 首上装甲(驾驶员舱门 + 航向机枪球座 + 备用履带板 + 大灯)、53° 首下、40° 内倾侧装甲、后部倾斜的传动舱检修门与排气管;
 *   5 对大直径挂胶克里斯蒂负重轮、前诱导轮、后主动轮、宽履带(带中央诱导齿);
 *   铸造圆炮塔(下缘外鼓、后部尾舱)、车长指挥塔、装填手舱盖、两个通风罩、侧面扶手、横置半圆柱防盾、无制退器的 85 炮;
 *   侧面外挂油桶、发动机舱百叶窗。
 */
export function buildT3485(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const hh = hull.height / 2; // 0.81
  const hw = hull.width / 2; // 1.5
  const C = palette(spec.color);
  const H = kit.batch(root);
  const T = kit.batch(turretPivot);
  const G = kit.batch(gunPivot);

  const ground = -hh;
  const trackW = 0.5;
  const trackT = 0.07;
  const trackX = hw - trackW / 2;
  const belly = ground + 0.4;
  const deck = 0.2; // 翼子板 / 上部车体底面
  const top = hh;
  const tubW = hw - trackW - 0.02;
  const upW = hw - 0.04; // 上部车体底边半宽
  const side = Math.tan(40 * DEG); // 侧装甲内倾
  const roofW = upW - (top - deck) * side;
  const noseY = -0.1;
  const noseZ = -3.02;
  const glacisZ = (y: number) => noseZ + (y - noseY) * Math.tan(60 * DEG);
  const rearTipY = -0.05;
  const rearZ = (y: number) => 3.0 - (y - rearTipY) * Math.tan(47 * DEG);

  // ---------------- 行走机构:5 对大负重轮,前诱导轮、后主动轮
  const wheelR = 0.415;
  const wheelY = ground + trackT + wheelR;
  const wc = { face: C.paint, rim: C.rubber, hub: C.shade, tyre: C.rubber, spoke: C.deep };
  runningGear(kit, root, { x: trackX, width: trackW, thickness: trackT, pitch: 0.2, color: C.track }, [
    {
      geo: rubberRoadWheel(wheelR, 0.2, wc),
      radius: wheelR,
      wheels: [-1.95, -0.98, -0.01, 0.96, 1.93].map((z) => ({ x: hw - 0.13, y: wheelY, z })),
    },
    // 后主动轮(滚柱式,无齿):盘面带减重孔
    { geo: discWheel(0.31, 0.36, { face: C.paint, rim: C.shade, hub: C.shade, tyre: C.rubber, hole: C.dark }, 6), radius: 0.31, wheels: [{ x: trackX, y: -0.25, z: 2.7 }] },
    // 前诱导轮
    { geo: discWheel(0.3, 0.3, { face: C.paint, rim: C.shade, hub: C.shade, tyre: C.rubber, hole: C.dark }, 5), radius: 0.3, wheels: [{ x: trackX, y: -0.22, z: -2.7 }] },
  ]);

  // ---------------- 车体
  // 下部车体(两条履带之间):首上 60° / 首下 53° 在车鼻相交;车尾上下两块斜板
  H.add(
    extrude(
      [
        [noseZ + 0.41, belly],
        [2.62, belly],
        [3.0, rearTipY],
        [rearZ(deck), deck],
        [glacisZ(deck), deck],
        [noseZ, noseY],
      ],
      'x',
      -tubW,
      tubW,
    ),
    C.paint,
  );
  // 上部车体:首上 60°、侧面 40° 内倾、后部 47°
  H.add(prism(deck, top, rect2(upW, glacisZ(deck), rearZ(deck)), rect2(roofW, glacisZ(top), rearZ(top))), C.paint);
  const strap = revolve(
    [
      [0.2, -0.025],
      [0.2, 0.025],
    ],
    'z',
    9,
    { startCap: null, endCap: null },
  );
  bothSides((s) => {
    // 翼子板:侧面窄条 + 前端下折的挡泥板 + 后挡泥板
    const xo = hw + 0.03;
    H.add(box(xo - upW + 0.1, 0.025, rearZ(deck) - glacisZ(deck)), C.shade, [s * (xo + upW - 0.1) / 2, deck - 0.0125, (glacisZ(deck) + rearZ(deck)) / 2]);
    const fm: Vec2[] = [
      [glacisZ(deck) + 0.05, deck],
      [glacisZ(deck) + 0.05, deck - 0.025],
      [-2.95, deck - 0.025],
      [-3.1, deck - 0.12],
      [-3.13, deck - 0.1],
      [-2.97, deck],
    ];
    H.add(extrude(fm, 'x', s * (tubW + 0.02), s * xo), C.shade);
    const rm: Vec2[] = [
      [rearZ(deck) - 0.05, deck],
      [rearZ(deck) - 0.05, deck - 0.025],
      [3.02, deck - 0.025],
      [3.1, deck - 0.09],
      [3.13, deck - 0.07],
      [3.04, deck],
    ];
    H.add(extrude(rm, 'x', s * (tubW + 0.02), s * xo), C.shade);
    // 侧面外挂油桶(每侧两个,绑在倾斜侧装甲上)
    const yd = 0.47;
    const xs = upW - (yd - deck) * side;
    const n: Vec2 = [Math.cos(40 * DEG), Math.sin(40 * DEG)];
    const r = 0.19;
    const drumCol = darker(spec.color, 0.88);
    for (const zc of [0.95, 1.95]) {
      const drum = revolve(
        [
          [r * 0.85, -0.42],
          [r, -0.39],
          [r, 0.39],
          [r * 0.85, 0.42],
        ],
        'z',
        9,
        { colors: [C.deep, drumCol, C.deep] },
      );
      const at: [number, number] = [s * (xs + n[0] * (r - 0.01)), yd + n[1] * (r - 0.01)];
      H.add(drum, null, [at[0], at[1], zc]);
      // 两道绑带
      for (const dz of [-0.24, 0.24]) H.add(strap, C.deep, [at[0], at[1], zc + dz]);
    }
    // 车首拖车钩
    H.add(box(0.1, 0.1, 0.16), C.dark, [s * 0.62, noseY - 0.04, noseZ + 0.04]);
    // 后部排气管(装甲罩 + 管口)
    const ey = 0.02;
    H.add(box(0.26, 0.16, 0.2), C.paint, [s * 0.58, ey + 0.08, rearZ(ey + 0.1) + 0.06], [43 * DEG, 0, 0]);
    H.add(revolve([[0.07, rearZ(ey) - 0.05], [0.07, rearZ(ey) + 0.14]], 'z', 8, { colors: [C.rust], endCap: C.dark }), null, [s * 0.58, ey, 0]);
    // 发动机舱两侧百叶窗(进气)
    H.add(box(0.24, 0.035, 0.85), C.dark, [s * (roofW - 0.2), top + 0.0175, 1.55]);
    for (let k = 0; k < 3; k++) H.add(box(0.26, 0.03, 0.05), C.shade, [s * (roofW - 0.2), top + 0.04, 1.27 + k * 0.28]);
  });
  // 首上:驾驶员舱门(左,两具潜望镜)、航向机枪球座(右)、备用履带板、大灯
  const gl = (x: number, y: number, off: number): Tuple3 => [x, y + off * Math.cos(30 * DEG), glacisZ(y) - off * Math.sin(30 * DEG)];
  const glRot: Tuple3 = [-30 * DEG, 0, 0];
  H.add(box(0.58, 0.06, 0.52), C.paint, gl(-0.46, 0.44, 0.03), glRot);
  H.add(box(0.5, 0.02, 0.44), C.shade, gl(-0.46, 0.44, 0.065), glRot);
  for (const x of [-0.62, -0.3]) H.add(periscope(C, 0.12, 0.07, 0.1), null, gl(x, 0.6, 0.05), glRot);
  H.add(revolve([[0.17, 0], [0.17, 0.05], [0.12, 0.12], [0.06, 0.15]], 'y', 10), C.paint, gl(0.52, 0.36, 0), glRot);
  H.add(tube(0.03, 0.025, glacisZ(0.43) - 0.05, glacisZ(0.43) - 0.35, 6), C.dark, [0.52, 0.43, 0]);
  for (const x of [-0.5, 0, 0.5]) H.add(spareLink(C, 0.46, 0.17), null, gl(x, 0.02, 0), glRot);
  H.add(headlight(C, 0.08), null, gl(-0.98, 0.45, 0.0), [0, 0, 0]);
  // 车尾上斜板:圆形传动舱检修门
  const rearRot: Tuple3 = [(90 - 47) * DEG, 0, 0];
  const rp = (x: number, y: number, off: number): Tuple3 => [x, y + off * Math.sin(47 * DEG), rearZ(y) + off * Math.cos(47 * DEG)];
  H.add(revolve([[0.36, 0], [0.36, 0.035], [0.32, 0.05]], 'y', 12, { colors: [C.paint, C.paint], startCap: null }), null, rp(0, 0.4, 0), rearRot);
  H.add(box(0.12, 0.04, 0.06), C.steel, rp(0, 0.4, 0.06), rearRot);
  // 发动机检修舱盖(中央,带百叶)+ 尾部横向格栅
  H.add(box(0.8, 0.04, 0.62), C.paint, [0, top + 0.02, 1.62]);
  H.add(box(0.5, 0.03, 0.34), C.dark, [0, top + 0.05, 1.62]);
  for (let k = 0; k < 4; k++) H.add(box(0.52, 0.025, 0.035), C.shade, [0, top + 0.07, 1.49 + k * 0.087]);
  H.add(box(roofW * 2 - 0.2, 0.035, 0.18), C.dark, [0, top + 0.0175, rearZ(top) - 0.14]);
  for (let k = 0; k < 5; k++) H.add(box(0.05, 0.03, 0.2), C.shade, [-0.6 + k * 0.3, top + 0.04, rearZ(top) - 0.14]);

  // ---------------- 铸造炮塔:下缘外鼓、前部圆、后部收窄成尾舱,顶部平
  const th = turret.height; // 1.0
  // [高度, 半宽, 前沿 z, 后沿 z]
  const rings: Array<[number, number, number, number]> = [
    [0.0, 1.0, -0.98, 1.1],
    [0.13, 1.12, -1.13, 1.26],
    [0.5, 1.1, -1.12, 1.3],
    [0.8, 0.97, -0.95, 1.22],
    [th - 0.02, 0.8, -0.72, 1.08],
  ];
  const N = 20;
  const outlineX = (hwAt: number, zf: number, zr: number, z: number) => {
    const front = z < 0;
    const e = front ? 2.6 : 3.4;
    const b = front ? -zf : zr;
    const t = Math.min(1, Math.abs(z) / b);
    const taper = front ? 1 : 1 - 0.16 * t;
    return hwAt * Math.pow(1 - Math.pow(t, e), 1 / e) * taper;
  };
  const ringPts = ([y, a, zf, zr]: [number, number, number, number]): Tuple3[] => {
    const pts: Tuple3[] = [];
    for (let k = 0; k < N; k++) {
      const t = (k / N) * Math.PI * 2;
      const c = Math.cos(t);
      const sn = Math.sin(t);
      const front = sn < 0;
      const e = front ? 2.6 : 3.4;
      const z = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e) * (front ? -zf : zr);
      let x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
      if (!front) x *= 1 - 0.16 * (z / zr);
      pts.push([x, y, z]);
    }
    return pts;
  };
  T.add(loft(rings.map(ringPts)), C.paint);
  // 炮塔壁在 (y, z) 处的半宽(给扶手、观察孔定位)
  const wallX = (y: number, z: number) => {
    let i = 0;
    while (i < rings.length - 2 && rings[i + 1][0] < y) i++;
    const [y0, a0, f0, r0] = rings[i];
    const [y1, a1, f1, r1] = rings[i + 1];
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    return outlineX(a0 + (a1 - a0) * t, f0 + (f1 - f0) * t, r0 + (r1 - r0) * t, z);
  };
  // 后壁在 (y, x) 处的 z(二分求解)
  const rearWallZ = (y: number, x: number) => {
    let lo = 0;
    let hi = 1.4;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (wallX(y, mid) > x) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  // 车长指挥塔(左后):圆筒 + 5 个观察窗 + 旋转顶盖 + 潜望镜
  const cx = -0.46;
  const cz = 0.42;
  T.add(
    revolve(
      [
        [0.34, th - 0.16],
        [0.34, th + 0.14],
        [0.31, th + 0.17],
        [0.3, th + 0.2],
        [0.22, th + 0.24],
      ],
      'y',
      12,
      { colors: [C.paint, C.shade, C.paint, C.paint] },
    ),
    null,
    [cx, 0, cz],
  );
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    T.add(box(0.12, 0.05, 0.04), C.dark, [cx + 0.335 * Math.cos(a), th + 0.06, cz + 0.335 * Math.sin(a)], [0, Math.PI / 2 - a, 0]);
  }
  T.add(periscope(C, 0.12, 0.08, 0.1), null, [cx + 0.08, th + 0.23, cz - 0.05]);
  // 装填手舱盖(右)+ 潜望镜、炮手潜望镜(左前)、后部两个通风罩
  T.add(roundHatch(C, 0.26), null, [0.44, th - 0.02, 0.3]);
  T.add(periscope(C, 0.12, 0.08, 0.1), null, [0.44, th - 0.02, -0.12]);
  T.add(periscope(C, 0.12, 0.08, 0.1), null, [-0.34, th - 0.02, -0.38]);
  for (const [x, z] of [[0.02, 0.86], [0.38, 0.8]] as const) {
    T.add(revolve([[0.15, th - 0.04], [0.15, th + 0.03], [0.1, th + 0.08]], 'y', 10), C.shade, [x, 0, z]);
  }
  // 侧面扶手(三段折线贴着炮塔壁)+ 后部扶手、手枪射孔
  bothSides((s) => {
    const y = 0.68;
    const zs = [-0.5, 0.05, 0.65];
    const pts = zs.map((z): Tuple3 => [s * (wallX(y, z) + 0.07), y, z]);
    for (let k = 0; k + 1 < pts.length; k++) T.add(rod(pts[k], pts[k + 1], 0.02, 4), C.shade);
    for (const p of pts) T.add(box(0.1, 0.03, 0.03), C.shade, [p[0] - s * 0.045, p[1], p[2]]);
    const pz = 0.35;
    T.add(revolve([[0.07, 0], [0.07, 0.05], [0.045, 0.07]], 'x', 8), C.shade, [s * (wallX(0.42, pz) - 0.02), 0.42, pz], [0, s > 0 ? 0 : Math.PI, 0]);
  });
  {
    // 尾舱扶手:沿后壁弧线,离壁 7 cm
    const y = 0.62;
    const pts = [-0.55, 0, 0.55].map((x): Tuple3 => [x, y, rearWallZ(y, Math.abs(x)) + 0.07]);
    for (let k = 0; k + 1 < pts.length; k++) T.add(rod(pts[k], pts[k + 1], 0.02, 4), C.shade);
    for (const p of pts) T.add(box(0.03, 0.03, 0.1), C.shade, [p[0], p[1], p[2] - 0.045]);
  }

  // ---------------- 防盾 + 85 炮(无制退器)
  // 横置半圆柱铸造防盾:以耳轴稍后为轴心,后端伸进炮塔
  const mc = 0.1;
  const mr = 0.33;
  const span = 72 * DEG;
  const mant: Vec2[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = -span + (2 * span * k) / 8;
    mant.push([mc - mr * Math.cos(a), mr * Math.sin(a)]);
  }
  mant.push([0.32, mr * Math.sin(span)], [0.32, -mr * Math.sin(span)]);
  G.add(extrude(mant, 'x', -0.5, 0.5), C.paint);
  // 瞄准镜孔(左)、并列机枪(右)
  G.add(box(0.07, 0.07, 0.04), C.dark, [-0.24, 0.1, mc - mr * Math.cos(Math.asin(0.1 / mr)) - 0.005]);
  G.add(tube(0.028, 0.024, -0.2, -0.36, 6), C.dark, [0.24, 0.02, 0]);
  // 炮管护套 + 炮管 + 炮口加厚环
  const muzzle = -turret.barrelLength;
  G.add(revolve([[0.16, -0.15], [0.16, -0.58], [0.12, -0.63]], 'z', 12), C.paint);
  G.add(
    revolve(
      [
        [0.1, -0.6],
        [0.093, -1.1],
        [0.07, muzzle + 0.12],
        [0.08, muzzle + 0.1],
        [0.08, muzzle],
      ],
      'z',
      8,
      { colors: [C.paint], endCap: C.dark },
    ),
    null,
  );
}

/** 对称矩形截面(半宽 hw,前后 z0..z1) */
function rect2(hw: number, z0: number, z1: number) {
  return { x0: -hw, x1: hw, z0, z1 };
}
