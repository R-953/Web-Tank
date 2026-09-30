import type { VehicleSpec } from '../../data/types';
import { DEG, ModelKit, bothSides, box, darker, extrude, palette, prism, revolve, rod, type ModelParts, type Tuple3, type Vec2 } from './kit';
import { discWheel, rubberRoadWheel, runningGear } from './running';
import { axe, headlight, periscope, rectHatch, roundHatch, shovel, spareLink, towCables } from './parts';

/**
 * SU-100(1944 年型,T-34-85 底盘):
 *   首上 75 mm / 55° 装甲从车鼻一直延伸到战斗室顶(驾驶员舱门 + 两具潜望镜、备用履带板、大灯)、53° 首下、40° 内倾侧装甲;
 *   战斗室在车体前半部:侧板接着车体侧装甲往上(内倾角按 20° 估算)、平顶,右前方外凸的车长指挥塔座 + 指挥塔(5 个观察窗 + 潜望镜)、
 *   炮手瞄准镜舱盖、装填手矩形舱盖、潜望镜、后部两个通风罩、侧面扶手;
 *   首上固定的铸造炮框 + 大型铸造球面防盾(随火炮转动)+ D-10S 长炮管(略收细、无制退器);
 *   5 对大直径挂胶克里斯蒂负重轮、前诱导轮、后主动轮;
 *   发动机舱百叶窗 / 检修舱盖、尾板排气管与传动检修门、侧面外挂油桶、翼子板、拖车钢缆与随车工具。
 * 车体部分沿用 T-34-85 模型的坐标(两者车体盒同为 6.1 × 3.0 × 1.62 m)。
 */
export function buildSU100(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
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
  // 首上 55°:从车鼻一直延伸到战斗室顶
  const glacisK = Math.tan(55 * DEG);
  const glacisZ = (y: number) => noseZ + (y - noseY) * glacisK;
  const rearTipY = -0.05;
  const rearZ = (y: number) => 3.0 - (y - rearTipY) * Math.tan(47 * DEG);
  // 首上外法线(朝前上方);贴在首上的零件用 gl 定位、glRot 摆正
  const gn: Tuple3 = [0, Math.sin(55 * DEG), -Math.cos(55 * DEG)];
  const glRot: Tuple3 = [-35 * DEG, 0, 0];
  const gl = (x: number, y: number, off: number): Tuple3 => [x, y + off * gn[1], glacisZ(y) + off * gn[2]];

  // ---------------- 行走机构:5 对大负重轮,前诱导轮、后主动轮(同 T-34-85)
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
  // 下部车体(两条履带之间):首上 55° / 首下 53° 在车鼻相交;车尾上下两块斜板
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
  // 上部车体:首上 55°、侧面 40° 内倾、后部 47°;车顶前半部由战斗室盖住
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
    // 侧面外挂油桶(每侧两个,绑在战斗室后方的倾斜侧装甲上)
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
  // 战斗室下方的内倾侧装甲:左侧拖车钢缆,右侧铁锹与斧子
  const sideX = (y: number) => upW - (y - deck) * side;
  const sn: Vec2 = [Math.cos(40 * DEG), Math.sin(40 * DEG)]; // 右侧侧装甲外法线
  const cy = 0.3;
  const up: Tuple3 = [Math.sin(40 * DEG), Math.cos(40 * DEG), 0]; // 左侧沿斜面向上
  H.add(towCables(C, [-(sideX(cy) + 0.04), cy, -2.1], [-(sideX(cy) + 0.04), cy, 0.35], up, 0.07), null);
  const ty = 0.4;
  const tool: Tuple3 = [sideX(ty) + sn[0] * 0.024, ty + sn[1] * 0.024, 0];
  H.add(shovel(C, 1.0), null, [tool[0], tool[1], -0.15], [0, 0, 40 * DEG]);
  H.add(axe(C, 0.8), null, [tool[0], tool[1], -1.25], [0, 0, 40 * DEG]);
  // 首上:驾驶员舱门(左,两具潜望镜)、备用履带板、大灯;SU-100 没有航向机枪
  const dx = -0.68;
  const dy = 0.42;
  H.add(box(0.54, 0.06, 0.5), C.paint, gl(dx, dy, 0.03), glRot);
  H.add(box(0.46, 0.02, 0.42), C.shade, gl(dx, dy, 0.065), glRot);
  for (const x of [dx - 0.15, dx + 0.15]) H.add(periscope(C, 0.12, 0.07, 0.1), null, gl(x, dy + 0.12, 0.05), glRot);
  for (const x of [-0.5, 0, 0.5]) H.add(spareLink(C, 0.46, 0.17), null, gl(x, 0.02, 0), glRot);
  H.add(headlight(C, 0.08), null, gl(-1.12, 0.36, 0));
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

  // ---------------- 战斗室(turretPivot 坐标:原点在车顶、车体 z = offset 处,y = 0 为车顶,不转动)
  const oz = turret.offset ?? 0; // -0.7
  const ch = turret.height; // 0.63,平顶高度
  const cRear = turret.length / 2; // 1.4,后壁底边
  const cz = (y: number) => glacisZ(top + y) - oz; // 首上在战斗室坐标里的 z
  const cSide = Math.tan(20 * DEG); // 战斗室侧板内倾(估算)
  const cW = (y: number) => roofW - y * cSide; // 战斗室侧板半宽:底边与车顶边缘重合
  // 主体:前面是首上的延续(与车体上那一段同一平面、接缝处同宽,无缝无台阶),侧板 20° 内倾,后壁略前倾
  T.add(prism(0, ch, rect2(roofW, cz(0), cRear), rect2(cW(ch), cz(ch), cRear - 0.08)), C.paint);
  // 右前方外凸的车长指挥塔座(SU-100 区别于 SU-85 的外形特征):底边落在车顶边缘,正面前倾
  const bx0 = cW(ch) - 0.02;
  T.add(
    prism(0, ch, { x0: bx0, x1: roofW, z0: -0.42, z1: 0.62 }, { x0: bx0, x1: roofW - 0.03, z0: cz(ch) + 0.02, z1: 0.58 }),
    C.paint,
  );
  // 车长指挥塔:圆筒 + 5 个观察窗 + 旋转顶盖 + 潜望镜
  const kx = 0.6;
  const kz = 0.22;
  const kr = 0.3;
  T.add(
    revolve(
      [
        [kr, ch - 0.05],
        [kr, ch + 0.12],
        [kr - 0.03, ch + 0.15],
        [kr - 0.04, ch + 0.17],
        [kr - 0.11, ch + 0.2],
      ],
      'y',
      12,
      { colors: [C.paint, C.shade, C.paint, C.paint] },
    ),
    null,
    [kx, 0, kz],
  );
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    T.add(box(0.11, 0.045, 0.04), C.dark, [kx + (kr - 0.005) * Math.cos(a), ch + 0.06, kz + (kr - 0.005) * Math.sin(a)], [0, Math.PI / 2 - a, 0]);
  }
  T.add(periscope(C, 0.12, 0.08, 0.1), null, [kx + 0.05, ch + 0.19, kz - 0.04]);
  // 炮手瞄准镜舱盖(左前)+ 潜望镜
  T.add(roundHatch(C, 0.17, 0.05, C.shade), null, [-0.3, ch, 0.12]);
  T.add(periscope(C, 0.14, 0.08, 0.11), null, [-0.56, ch, 0.02]);
  // 装填手矩形舱盖(左后)+ 中部潜望镜
  T.add(rectHatch(C, 0.55, 0.6), null, [-0.3, ch, 0.66]);
  T.add(periscope(C, 0.14, 0.08, 0.11), null, [0.1, ch, 0.45]);
  // 后部两个通风罩
  for (const x of [0.18, 0.5]) {
    T.add(revolve([[0.14, ch - 0.02], [0.14, ch + 0.05], [0.09, ch + 0.1]], 'y', 10), C.shade, [x, 0, 1.08]);
  }
  // 侧面扶手(贴着内倾侧板;右侧避开指挥塔座)
  bothSides((s) => {
    const y = 0.42;
    const zs = s < 0 ? [-0.3, 0.45, 1.2] : [0.8, 1.25];
    const pts = zs.map((z): Tuple3 => [s * (cW(y) + 0.07), y, z]);
    for (let k = 0; k + 1 < pts.length; k++) T.add(rod(pts[k], pts[k + 1], 0.02, 4), C.shade);
    for (const p of pts) T.add(box(0.1, 0.03, 0.03), C.shade, [p[0] - s * 0.045, p[1], p[2]]);
  });
  // 首上固定的铸造炮框:轴线沿首上法线,中心在炮耳轴到首上的垂足处;防盾后下部嵌在炮框里
  const gy = ch / 2; // 炮耳轴(战斗室盒子正面中心)
  const gz = -turret.length / 2;
  const dPivot = (cz(gy) - gz) * Math.cos(55 * DEG); // 炮耳轴到首上的垂直距离 ≈ 0.48
  const foot: Tuple3 = [0, gy - dPivot * gn[1], gz - dPivot * gn[2]];
  T.add(
    revolve(
      [
        [0.47, -0.08],
        [0.47, 0.14],
        [0.42, 0.22],
        [0.38, 0.26],
      ],
      'y',
      14,
    ),
    C.paint,
    foot,
    glRot,
  );

  // ---------------- 防盾 + D-10S 炮(无制退器)
  // 铸造球面防盾:绕竖轴的旋转椭球(宽 0.76、高 0.6),中心在炮耳轴上,
  // 所以 ±8° 水平转动时外形不变;往炮框方向伸出 0.31–0.36 m,俯仰全程都嵌在炮框(厚 0.26、离耳轴 ≈ 0.48)里
  const mRx = 0.38;
  const mRy = 0.3;
  const mant: Vec2[] = [];
  for (let k = -4; k <= 4; k++) {
    const a = k * 20 * DEG;
    mant.push([mRx * Math.cos(a), mRy * Math.sin(a)]);
  }
  G.add(revolve(mant, 'y', 14), C.paint);
  // 瞄准镜孔(左)
  G.add(box(0.07, 0.07, 0.05), C.dark, [-0.2, 0.06, -0.3]);
  // 炮管护套 + 炮管(略收细,炮口不加厚)
  const muzzle = -turret.barrelLength;
  G.add(revolve([[0.16, -0.28], [0.16, -0.62], [0.13, -0.68]], 'z', 12), C.paint);
  G.add(
    revolve(
      [
        [0.115, -0.64],
        [0.105, -1.4],
        [0.086, muzzle],
      ],
      'z',
      10,
      { colors: [C.paint], endCap: C.dark },
    ),
    null,
  );
}

/** 对称矩形截面(半宽 hw,前后 z0..z1) */
function rect2(hw: number, z0: number, z1: number) {
  return { x0: -hw, x1: hw, z0, z1 };
}
