import type { VehicleSpec } from '../../data/types';
import { DEG, ModelKit, bothSides, box, cyl, extrude, palette, revolve, tube, type ModelParts, type Vec2 } from './kit';
import { discWheel, runningGear, steelRoadWheel, toothedSprocket } from './running';
import { axe, doubleBaffleBrake, fanGrille, grille, headlight, lateCupola, periscope, roundHatch, shovel, spareLink, towCables, towLug } from './parts';

/**
 * 虎式 Ausf. E(1944 后期型):
 *   箱形车体、垂直的驾驶员前装甲板(观察窗 + 航向机枪球座 + 顶部中央大灯)、近水平的首上与带拖车耳板的车鼻;
 *   8 轴交错钢缘负重轮、前置带齿主动轮、后置诱导轮、翼子板与前后挡泥板;
 *   马蹄形炮塔、后期低矮指挥塔(7 具潜望镜)、装填手圆舱盖、厚重防盾、88 L/56 炮 + 双室制退器、炮塔后储物箱、
 *   侧面备用履带板;发动机舱格栅 / 风扇罩、后部排气管与护罩、千斤顶、拖车钢缆与随车工具。
 */
export function buildTigerI(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const hh = hull.height / 2; // 0.975
  const hw = hull.width / 2; // 1.78
  const C = palette(spec.color);
  const H = kit.batch(root);
  const T = kit.batch(turretPivot);
  const G = kit.batch(gunPivot);

  const ground = -hh;
  const trackW = 0.72;
  const trackT = 0.07;
  const trackX = hw - trackW / 2;
  const belly = ground + 0.47; // 离地间隙 0.47
  const deck = 0.12; // 上部车体底面 / 翼子板高度
  const top = hh;
  const supW = 1.62; // 上部车体半宽(两侧翼子板再往外伸到履带外缘)
  const tubW = hw - trackW - 0.03; // 下部车体半宽(两条履带之间)
  const zF = -2.6; // 驾驶员前装甲板
  const zR = 2.95; // 后装甲板

  // ---------------- 行走机构
  const wheelR = 0.4;
  const wheelY = ground + trackT + wheelR;
  // 8 轴交错布置:奇数轴在外排、偶数轴在内排(从侧面看外排压住内排)
  const roadWheels = Array.from({ length: 8 }, (_, i) => ({ x: i % 2 === 0 ? hw - 0.14 : hw - 0.28, y: wheelY, z: -1.55 + i * 0.47 }));
  const wc = { face: C.paint, rim: C.steel, hub: C.shade, tyre: C.rubber, spoke: C.shade };
  runningGear(kit, root, { x: trackX, width: trackW, thickness: trackT, pitch: 0.19, color: C.track }, [
    { geo: steelRoadWheel(wheelR, 0.1, wc), radius: wheelR, wheels: roadWheels },
    { geo: toothedSprocket(0.4, 13, 0.46, trackT, wc), radius: 0.4, teeth: 13, wheels: [{ x: trackX, y: -0.4, z: -2.68 }] },
    { geo: discWheel(0.3, 0.3, { ...wc, hole: C.dark }), radius: 0.3, tensioner: true, wheels: [{ x: trackX, y: -0.42, z: 2.6 }] },
  ]);

  // ---------------- 车体
  // 下部车体:近水平的首上(Bugplatte)+ 前倾首下,后部垂直
  H.add(
    extrude(
      [
        [-2.88, belly],
        [2.85, belly],
        [zR, belly + 0.12],
        [zR, deck],
        [zF, deck],
        [-3.12, -0.03],
      ],
      'x',
      -tubW,
      tubW,
    ),
    C.paint,
  );
  // 上部车体:外伸盖住履带,前 / 侧 / 后都是垂直装甲板
  H.add(box(supW * 2, top - deck, zR - zF), C.paint, [0, (top + deck) / 2, (zF + zR) / 2]);
  bothSides((s) => {
    // 侧装甲板在前后端伸出一截(与前后装甲板咬合)
    H.add(box(0.1, top - deck, 0.1), C.paint, [s * (supW - 0.05), (top + deck) / 2, zF - 0.05]);
    H.add(box(0.1, top - deck - 0.05, 0.08), C.paint, [s * (supW - 0.05), (top + deck - 0.05) / 2, zR + 0.04]);
    // 翼子板:侧装甲板下沿到履带外缘
    const xo = hw + 0.02;
    H.add(box(xo - supW + 0.02, 0.025, zR - zF), C.shade, [s * ((xo + supW - 0.02) / 2), deck - 0.0125, (zF + zR) / 2]);
    // 前挡泥板:盖住主动轮,前端向下折
    const fm: Vec2[] = [
      [zF + 0.02, deck],
      [zF + 0.02, deck - 0.025],
      [-3.02, deck - 0.03],
      [-3.2, deck - 0.14],
      [-3.23, deck - 0.12],
      [-3.04, deck],
    ];
    H.add(extrude(fm, 'x', s * (tubW + 0.02), s * xo), C.shade);
    // 后挡泥板
    H.add(box(xo - tubW - 0.02, 0.025, 0.22), C.shade, [s * ((xo + tubW + 0.02) / 2), deck - 0.0125, zR + 0.11]);
    // 车首拖车耳板(下部车体侧板前伸)+ 钩孔
    H.add(
      towLug(
        C,
        [
          [-2.9, belly + 0.02],
          [-3.22, -0.32],
          [-3.25, -0.08],
          [-3.1, 0.03],
          [-2.95, -0.02],
        ],
        s * 0.94,
        s * 1.02,
        [-3.15, -0.19],
      ),
      null,
    );
    // 车体顶部:驾驶员 / 机电员舱盖 + 潜望镜
    H.add(roundHatch(C, 0.27), null, [s * 0.62, top, -2.05]);
    H.add(periscope(C), null, [s * 0.62, top, -2.42]);
    // 发动机舱:外侧矩形进气格栅 + 后部圆形风扇罩
    H.add(grille(C, 0.78, 0.72, 4), null, [s * 1.07, top, 1.55]);
    H.add(fanGrille(C, 0.3), null, [s * 1.02, top, 2.45]);
    // 排气管 + 圆筒形护罩
    H.add(box(0.22, 0.3, 0.12), C.shade, [s * 0.52, top - 0.32, zR + 0.05]);
    H.add(cyl(0.15, 0.15, 0.48, 8), C.shade, [s * 0.52, top - 0.3, zR + 0.16]);
    H.add(revolve([[0.075, top - 0.1], [0.075, top + 0.2]], 'y', 8, { colors: [C.rust], endCap: C.dark }), null, [s * 0.52, 0, zR + 0.16]);
    // 后部拖车钩
    H.add(box(0.12, 0.2, 0.14), C.shade, [s * 0.78, -0.26, zR + 0.06]);
  });
  // 驾驶员观察窗(左)
  H.add(box(0.46, 0.2, 0.09), C.paint, [-0.62, 0.64, zF - 0.045]);
  H.add(box(0.32, 0.035, 0.02), C.dark, [-0.62, 0.66, zF - 0.095]);
  // 航向机枪球形座(右)+ MG34
  H.add(revolve([[0.19, zF + 0.01], [0.19, zF - 0.03], [0.15, zF - 0.1], [0.08, zF - 0.14]], 'z', 8), C.paint, [0.6, 0.56, 0]);
  H.add(tube(0.035, 0.03, zF - 0.12, zF - 0.42, 6), C.dark, [0.6, 0.56, 0]);
  // 后期型大灯:前装甲板顶部中央
  H.add(headlight(C), null, [0, top, zF + 0.06]);
  // 发动机检修舱盖 + 加油口
  H.add(box(0.95, 0.04, 1.25), C.shade, [0, top + 0.02, 2.2]);
  H.add(revolve([[0.13, top + 0.04], [0.13, top + 0.07], [0.09, top + 0.09]], 'y', 10), C.shade, [0, 0, 1.92]);
  // 后装甲板:千斤顶
  H.add(revolve([[0.08, -0.32], [0.08, 0.32]], 'x', 8), C.steel, [0, 0.36, zR + 0.1]);
  H.add(box(0.06, 0.12, 0.08), C.shade, [-0.22, 0.36, zR + 0.04]);
  H.add(box(0.06, 0.12, 0.08), C.shade, [0.22, 0.36, zR + 0.04]);
  // 左侧拖车钢缆、右侧随车工具
  H.add(towCables(C, [-supW - 0.03, 0.42, -1.95], [-supW - 0.03, 0.42, 2.3], [0, 1, 0], 0.08), null);
  H.add(shovel(C, 1.1), null, [supW + 0.03, 0.74, 0.5]);
  H.add(axe(C, 0.85, true), null, [supW + 0.03, 0.42, 0.6]);
  H.add(axe(C, 0.8), null, [supW + 0.03, 0.42, 1.95]);

  // ---------------- 炮塔(马蹄形:平直前装甲板 + 一整块弯成马蹄形的侧后装甲)
  const th = turret.height; // 0.95
  const tfz = -1.36; // 前装甲板外表面(炮塔坐标)
  const wall: Vec2[] = [
    [1.08, tfz + 0.04],
    [1.26, -0.95],
    [1.33, -0.35],
    [1.33, 0.2],
  ];
  for (let k = 1; k < 8; k++) {
    const a = (k / 8) * Math.PI;
    wall.push([1.33 * Math.cos(a), 0.2 + 1.05 * Math.sin(a)]);
  }
  wall.push([-1.33, 0.2], [-1.33, -0.35], [-1.26, -0.95], [-1.08, tfz + 0.04]);
  T.add(extrude(wall, 'y', 0, th), C.paint);
  // 前装甲板(比侧壁略宽略高,看得出是单独一块)
  T.add(box(2.26, th + 0.02, 0.16), C.paint, [0, th / 2 + 0.01, tfz + 0.08]);
  // 顶部:指挥塔(左后)、装填手圆舱盖(右)、潜望镜、通风罩、近防榴弹发射器
  T.add(lateCupola(C), null, [-0.72, th, 0.42]);
  T.add(roundHatch(C, 0.29), null, [0.55, th, -0.05]);
  T.add(periscope(C, 0.14), null, [0.5, th, -0.62]);
  T.add(revolve([[0.14, th], [0.14, th + 0.05], [0.08, th + 0.1]], 'y', 10), C.shade, [0, 0, -0.85]);
  T.add(revolve([[0.09, th], [0.09, th + 0.12], [0.07, th + 0.14]], 'y', 8), C.shade, [0.42, 0, 0.64]);
  // 右后逃生舱门、左后手枪射孔
  const wallAt = (a: number, off: number) => {
    const nx = Math.cos(a) / 1.33;
    const nz = Math.sin(a) / 1.05;
    const n = Math.hypot(nx, nz);
    return {
      pos: [1.33 * Math.cos(a) + (nx / n) * off, th * 0.48, 0.2 + 1.05 * Math.sin(a) + (nz / n) * off] as const,
      rot: [0, Math.atan2(-nz / n, nx / n), 0] as const,
    };
  };
  const hatch = wallAt(38 * DEG, -0.02);
  T.add(revolve([[0.24, 0], [0.24, 0.045], [0.2, 0.065]], 'x', 10, { startCap: null }), C.paint, hatch.pos, hatch.rot);
  const port = wallAt(150 * DEG, -0.01);
  T.add(revolve([[0.08, 0], [0.08, 0.05], [0.05, 0.07]], 'x', 8), C.shade, port.pos, port.rot);
  // 侧面备用履带板(竖挂)
  bothSides((s) => {
    for (let k = 0; k < 3; k++) T.add(spareLink(C, 0.62, 0.13), null, [s * 1.33, th * 0.47, -0.3 + k * 0.155], [0, 0, -s * Math.PI / 2]);
  });
  // 炮塔后储物箱(Rommel 箱)
  T.add(
    extrude(
      [
        [1.02, 0.28],
        [1.58, 0.28],
        [1.64, 0.34],
        [1.64, 0.74],
        [1.58, 0.8],
        [1.02, 0.8],
      ],
      'x',
      -0.72,
      0.72,
    ),
    C.paint,
  );
  T.add(box(1.48, 0.03, 0.6), C.shade, [0, 0.815, 1.33]);
  bothSides((s) => T.add(box(0.08, 0.1, 0.03), C.steel, [s * 0.42, 0.62, 1.65]));

  // ---------------- 防盾 + 88 L/56(随火炮俯仰)
  // 厚防盾:前表面为以耳轴后方为圆心的圆弧面
  const mc = 0.24;
  const mr = 0.52;
  const span = 40 * DEG;
  const mant: Vec2[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = -span + (2 * span * k) / 8;
    mant.push([mc - mr * Math.cos(a), mr * Math.sin(a)]);
  }
  mant.push([0.16, mr * Math.sin(span)], [0.16, -mr * Math.sin(span)]);
  G.add(extrude(mant, 'x', -0.75, 0.75), C.paint);
  // 双目瞄准镜孔(左)、并列机枪(右)
  for (const x of [-0.3, -0.42]) G.add(box(0.07, 0.07, 0.04), C.dark, [x, 0.14, -0.261]);
  G.add(box(0.12, 0.1, 0.06), C.paint, [0.4, 0.04, -0.28]);
  G.add(tube(0.025, 0.022, -0.3, -0.42, 6), C.dark, [0.4, 0.04, 0]);
  // 炮管护套 + 炮管(渐细)+ 双室制退器
  const muzzle = -turret.barrelLength;
  const brake = 0.5;
  G.add(revolve([[0.21, -0.2], [0.21, -0.45], [0.18, -0.5], [0.14, -0.53]], 'z', 10), C.paint);
  G.add(revolve([[0.125, -0.5], [0.112, -0.64], [0.104, -1.6], [0.088, muzzle + brake + 0.01]], 'z', 8), C.paint);
  G.add(doubleBaffleBrake(C, brake, 0.135, 0.088, C.paint), null, [0, 0, muzzle + brake]);
}
