import type { VehicleSpec } from '../../data/types';
import { DEG, ModelKit, bothSides, box, cyl, extrude, loft, palette, prism, revolve, rod, type ModelParts, type Tuple3, type Vec2 } from './kit';
import { discWheel, runningGear, steelRoadWheel, toothedSprocket } from './running';
import { axe, doubleBaffleBrake, fanGrille, grille, headlight, lateCupola, periscope, rectHatch, roundHatch, shovel, spareLink, towCables, towLug } from './parts';

/**
 * 虎王(亨舍尔炮塔):
 *   50° 首上 + 50° 首下构成尖车鼻(带大拖车耳板)、25° 内倾侧装甲、后倾的尾板;
 *   9 轴交错钢缘负重轮、前置带齿主动轮、后诱导轮,翼子板带侧裙边、前后挡泥板;
 *   正面平直、两侧 21° 内倾、顶前部下斜的楔形炮塔,「猪头」钟形防盾,88 L/71 长炮管 + 双室制退器;
 *   指挥塔、装填手舱盖、尾舱后逃生门、侧面备用履带板;两根高排气管、发动机舱格栅 / 风扇罩、钢缆与工具。
 */
export function buildTigerII(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const hh = hull.height / 2; // 1.05
  const hl = hull.length / 2; // 3.69
  const hw = hull.width / 2; // 1.875
  const C = palette(spec.color);
  const H = kit.batch(root);
  const T = kit.batch(turretPivot);
  const G = kit.batch(gunPivot);

  const ground = -hh;
  const trackW = 0.8;
  const trackT = 0.08;
  const trackX = hw - trackW / 2;
  const belly = ground + 0.49;
  const deck = 0.22; // 上部车体底面 / 翼子板
  const top = hh;
  const tubW = hw - trackW - 0.025;
  const upW = hw - 0.035; // 上部车体底边半宽
  const sideK = Math.tan(25 * DEG);
  const roofW = upW - (top - deck) * sideK;
  const noseY = -0.15;
  const glacisZ = (y: number) => -hl + Math.abs(y - noseY) * Math.tan(50 * DEG); // 首上 / 首下同为 50°
  const rearZ = (y: number) => 3.55 - (top - y) * Math.tan(25 * DEG); // 尾板上端后倾

  // ---------------- 行走机构:9 轴交错负重轮
  const wheelR = 0.4;
  const wheelY = ground + trackT + wheelR;
  const wc = { face: C.paint, rim: C.steel, hub: C.shade, tyre: C.rubber, spoke: C.shade };
  runningGear(kit, root, { x: trackX, width: trackW, thickness: trackT, pitch: 0.19, color: C.track }, [
    {
      geo: steelRoadWheel(wheelR, 0.1, wc),
      radius: wheelR,
      wheels: Array.from({ length: 9 }, (_, i) => ({ x: i % 2 === 0 ? hw - 0.15 : hw - 0.3, y: wheelY, z: -2.05 + i * 0.52 })),
    },
    { geo: toothedSprocket(0.42, 13, 0.5, trackT, wc), radius: 0.42, teeth: 13, wheels: [{ x: trackX, y: -0.32, z: -3.08 }] },
    { geo: discWheel(0.33, 0.34, { ...wc, hole: C.dark }, 6), radius: 0.33, tensioner: true, wheels: [{ x: trackX, y: -0.45, z: 3.05 }] },
  ]);

  // ---------------- 车体
  // 下部车体(两条履带之间):尖车鼻,尾板后倾
  H.add(
    extrude(
      [
        [glacisZ(belly), belly],
        [rearZ(belly), belly],
        [rearZ(deck), deck],
        [glacisZ(deck), deck],
        [-hl, noseY],
      ],
      'x',
      -tubW,
      tubW,
    ),
    C.paint,
  );
  // 上部车体:首上 50°、侧面 25° 内倾、尾板后倾
  H.add(
    prism(deck, top, { x0: -upW, x1: upW, z0: glacisZ(deck), z1: rearZ(deck) }, { x0: -roofW, x1: roofW, z0: glacisZ(top), z1: rearZ(top) }),
    C.paint,
  );
  bothSides((s) => {
    const xo = hw + 0.03;
    // 翼子板 + 下垂的侧裙边
    H.add(box(xo - upW + 0.08, 0.025, rearZ(deck) - glacisZ(deck) + 0.1), C.shade, [s * (xo + upW - 0.08) / 2, deck - 0.0125, (glacisZ(deck) + rearZ(deck)) / 2]);
    H.add(box(0.02, 0.14, rearZ(deck) - glacisZ(deck) - 0.2), C.shade, [s * (xo - 0.01), deck - 0.07, (glacisZ(deck) + rearZ(deck)) / 2]);
    // 前挡泥板(主动轮上方,前端下折)、后挡泥板
    const fm: Vec2[] = [
      [glacisZ(deck) + 0.1, deck],
      [glacisZ(deck) + 0.1, deck - 0.025],
      [-3.45, deck - 0.03],
      [-3.62, deck - 0.14],
      [-3.65, deck - 0.12],
      [-3.47, deck],
    ];
    H.add(extrude(fm, 'x', s * (tubW + 0.02), s * xo), C.shade);
    H.add(box(xo - tubW - 0.02, 0.025, 0.3), C.shade, [s * (xo + tubW + 0.02) / 2, deck - 0.0125, rearZ(deck) + 0.1]);
    // 车首大拖车耳板(下部车体侧板前伸)
    H.add(
      towLug(
        C,
        [
          [glacisZ(-0.46), -0.46],
          [-3.62, -0.42],
          [-3.79, -0.24],
          [-3.79, -0.04],
          [-3.62, 0.08],
          [glacisZ(0.1) + 0.02, 0.1],
        ],
        s * (tubW - 0.08),
        s * tubW,
        [-3.72, -0.15],
        0.07,
      ),
      null,
    );
    // 车顶:驾驶员 / 机电员舱盖 + 潜望镜
    H.add(roundHatch(C, 0.25), null, [s * 0.62, top, -1.93]);
    H.add(periscope(C), null, [s * 0.62, top, -2.18]);
    // 发动机舱:外侧矩形进气格栅 + 后部圆形风扇罩
    H.add(grille(C, 0.72, 0.8, 4), null, [s * 1.0, top, 2.25]);
    H.add(fanGrille(C, 0.32), null, [s * 0.95, top, 3.12]);
    // 两根高排气管:根部装甲罩贴在后倾的尾板上
    H.add(cyl(0.15, 0.17, 0.4, 10), C.shade, [s * 0.45, top - 0.17, rearZ(top) - 0.02]);
    H.add(revolve([[0.08, top], [0.08, top + 0.58]], 'y', 8, { colors: [C.rust], endCap: C.dark }), null, [s * 0.45, 0, rearZ(top) - 0.02]);
    // 尾部拖车钩
    H.add(box(0.14, 0.24, 0.16), C.shade, [s * 0.8, -0.3, rearZ(-0.3) + 0.06]);
    // 侧面拖车钢缆(贴着内倾侧装甲)
    const cy = 0.46;
    H.add(towCables(C, [s * (upW - (cy - deck) * sideK + 0.03), cy, -1.7], [s * (upW - (cy - deck) * sideK + 0.03), cy, 2.3], [-s * Math.sin(25 * DEG), Math.cos(25 * DEG), 0], 0.08), null);
  });
  // 首上:航向机枪球座(右)、大灯(左上)
  const n50: Tuple3 = [0, Math.sin(50 * DEG), -Math.cos(50 * DEG)];
  const gl = (x: number, y: number, off: number): Tuple3 => [x, y + off * n50[1], glacisZ(y) + off * n50[2]];
  const glRot: Tuple3 = [-40 * DEG, 0, 0];
  H.add(revolve([[0.19, 0], [0.19, 0.05], [0.14, 0.13], [0.07, 0.16]], 'y', 10), C.paint, gl(0.62, 0.52, 0), glRot);
  H.add(rod([0.62, 0.63, glacisZ(0.63) - 0.04], [0.62, 0.63, glacisZ(0.63) - 0.38], 0.03, 6), C.dark);
  H.add(headlight(C, 0.085), null, gl(-1.05, 0.8, 0));
  // 发动机检修舱盖 + 两个圆形加油口
  H.add(box(1.0, 0.04, 1.3), C.shade, [0, top + 0.02, 2.6]);
  for (const z of [2.2, 3.0]) H.add(revolve([[0.13, top + 0.04], [0.13, top + 0.07], [0.09, top + 0.09]], 'y', 10), C.shade, [0, 0, z]);
  // 尾板:千斤顶
  H.add(revolve([[0.09, -0.35], [0.09, 0.35]], 'x', 8), C.steel, [0, 0.35, rearZ(0.35) + 0.07]);
  // 工具(挂在内倾侧装甲上):左侧炮管清洁杆筒、右侧铁锹与斧子
  const ty = 0.8;
  const tx = upW - (ty - deck) * sideK;
  H.add(revolve([[0.06, -1.2], [0.06, 1.2]], 'z', 6, { colors: [C.shade], endCap: C.steel }), null, [-(tx + 0.06), ty, 0.2]);
  H.add(shovel(C, 1.1), null, [tx + 0.03, ty, 0.1], [0, 0, 25 * DEG]);
  H.add(axe(C, 0.85), null, [tx + 0.03, ty, 1.5], [0, 0, 25 * DEG]);

  // ---------------- 亨舍尔炮塔:正面 10°、两侧 21° 内倾、尾部 20°,顶板前部下斜
  const th = turret.height; // 0.95
  const ring = (y: number, frontZ: number, fx: number, sx: number, sz: number, rsx: number, rsz: number, rx: number, rz: number): Tuple3[] => [
    [fx, y, frontZ],
    [sx, y, sz],
    [rsx, y, rsz],
    [rx, y, rz],
    [-rx, y, rz],
    [-rsx, y, rsz],
    [-sx, y, sz],
    [-fx, y, frontZ],
  ];
  const k21 = Math.tan(21 * DEG);
  const yF = 0.84; // 正面板顶
  T.add(
    loft([
      ring(0, -1.58, 0.95, 1.4, -0.95, 1.36, 1.35, 1.02, 1.72),
      ring(yF, -1.58 + yF * Math.tan(10 * DEG), 0.95 - yF * k21 * 0.8, 1.4 - yF * k21, -0.9, 1.36 - yF * k21, 1.3, 1.02 - yF * k21, 1.72 - yF * Math.tan(20 * DEG)),
      ring(th, -1.0, 0.95 - th * k21 * 0.8, 1.4 - th * k21, -0.82, 1.36 - th * k21, 1.28, 1.02 - th * k21, 1.72 - th * Math.tan(20 * DEG)),
    ]),
    C.paint,
  );
  // 正面装甲板(比侧壁厚,边缘外凸)
  T.add(prism(0, yF, { x0: -0.99, x1: 0.99, z0: -1.61, z1: -1.4 }, { x0: -0.99 + yF * k21 * 0.8, x1: 0.99 - yF * k21 * 0.8, z0: -1.61 + yF * Math.tan(10 * DEG), z1: -1.28 }), C.paint);
  // 顶部:指挥塔(左后)、装填手舱盖(右后)、潜望镜、通风罩、近防武器、吊装座
  T.add(lateCupola(C, 0.36), null, [-0.6, th, 0.45]);
  T.add(rectHatch(C, 0.5, 0.62), null, [0.58, th, 0.62]);
  T.add(periscope(C, 0.14), null, [0.55, th, -0.2]);
  T.add(periscope(C, 0.14), null, [-0.45, th - 0.03, -0.62], [-8 * DEG, 0, 0]);
  T.add(revolve([[0.13, th], [0.13, th + 0.05], [0.07, th + 0.1]], 'y', 10), C.shade, [0.05, 0, -0.35]);
  T.add(revolve([[0.09, th], [0.09, th + 0.12], [0.07, th + 0.14]], 'y', 8), C.shade, [0.15, 0, 1.05]);
  for (const [x, z] of [[-0.85, -0.3], [0.85, -0.3], [0, 1.25]] as const) T.add(cyl(0.06, 0.07, 0.07, 6), C.shade, [x, th + 0.035, z]);
  // 正面炮手瞄准镜孔(防盾左侧)
  T.add(box(0.1, 0.1, 0.05), C.dark, [-0.5, 0.6, -1.61 + 0.6 * Math.tan(10 * DEG) - 0.01], [-10 * DEG, 0, 0]);
  // 尾部圆形逃生 / 换炮管舱门
  const rearN = 20 * DEG;
  T.add(revolve([[0.34, 0], [0.34, 0.045], [0.3, 0.065]], 'z', 12), C.paint, [0, 0.42, 1.72 - 0.42 * Math.tan(20 * DEG) - 0.02], [-rearN, 0, 0]);
  T.add(box(0.12, 0.05, 0.05), C.steel, [0, 0.42, 1.72 - 0.42 * Math.tan(20 * DEG) + 0.06], [-rearN, 0, 0]);
  // 侧面备用履带板(贴在 21° 内倾侧壁上)
  bothSides((s) => {
    const y = 0.45;
    const x = 1.38 - y * k21;
    for (let k = 0; k < 4; k++) T.add(spareLink(C, 0.66, 0.14), null, [s * (x - 0.01), y, -0.2 + k * 0.17], [0, 0, -s * (Math.PI / 2 - 21 * DEG)]);
  });

  // ---------------- 「猪头」钟形防盾 + 88 L/71 + 双室制退器
  G.add(
    revolve(
      [
        [0.41, 0.32],
        [0.41, 0.06],
        [0.38, -0.14],
        [0.3, -0.3],
        [0.21, -0.39],
        [0.17, -0.42],
      ],
      'z',
      12,
      { colors: [C.paint] },
    ),
    null,
  );
  G.add(tube(0.03, 0.025, -0.28, -0.4, 6), C.dark, [0.26, 0.05, 0]);
  const muzzle = -turret.barrelLength;
  const brake = 0.55;
  G.add(
    revolve(
      [
        [0.15, -0.4],
        [0.15, -0.6],
        [0.12, -0.64],
        [0.112, -2.55],
        [0.122, -2.57],
        [0.122, -2.7],
        [0.1, -2.72],
        [0.088, muzzle + brake + 0.01],
      ],
      'z',
      8,
      { colors: [C.paint] },
    ),
    null,
  );
  G.add(doubleBaffleBrake(C, brake, 0.135, 0.088, C.paint), null, [0, 0, muzzle + brake]);
}

/** 沿 -Z 的细管 */
function tube(rStart: number, rEnd: number, z0: number, z1: number, segments = 6) {
  return revolve(
    [
      [rStart, z0],
      [rEnd, z1],
    ],
    'z',
    segments,
  );
}
