import type { VehicleSpec } from '../../data/types';
import { DEG, GeoBatch, ModelKit, bothSides, box, extrude, loft, palette, prism, revolve, rod, type ModelParts, type Tuple3, type Vec2 } from './kit';
import { discWheel, rubberRoadWheel, runningGear, toothedSprocket } from './running';
import { axe, doubleBaffleBrake, grille, headlight, periscope, rectHatch, roundHatch, shovel, towCables, towLug } from './parts';

/**
 * StuG III Ausf. G(1944 年型,Pz III 底盘):
 *   车鼻 21° 前板(栓接 30 mm 附加装甲 + 螺栓)、约 22° 的首上斜板(两块制动器检修舱盖)、车首拖车耳板;
 *   每侧 6 个 520 mm 挂胶双负重轮(扭杆摆臂)、3 个托带轮、前置带齿主动轮(终传动壳)、后置诱导轮;
 *   低矮的战斗室:前板 10° 后倾(左右两块栓接附加装甲、左侧驾驶员观察窗)、上部 60° 斜板、平顶,
 *   履带上方两侧翼的正面向后倾斜、侧板 11° 内倾一直落到翼子板;
 *   车长指挥塔(7 具潜望镜 + 舱盖)、炮手瞄准镜、装填手双片舱盖 + 机枪护板(不带机枪)、后壁通风罩;
 *   StuK 40 L/48:「猪头」铸造防盾 + 双室炮口制退器;
 *   发动机舱:两块检修舱盖、两侧进气格栅、尾部横向出风格栅、加油口;车尾横置消音器 + 排气管、拖车钩与耳板;
 *   翼子板与前后挡泥板,上面放铁锹、撬棍、灭火器、斧子、千斤顶与垫木,左侧发动机舱侧壁挂拖车钢缆。
 * 尺寸按 Pz III / StuG III 公开图纸量级估算(负重轮 520 mm、履带宽 400 mm、离地间隙 385 mm);
 * 不加侧裙板(会超出车宽)。
 */
export function buildStuG3G(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const hh = hull.height / 2; // 0.75
  const hw = hull.width / 2; // 1.475
  const C = palette(spec.color);
  const H = kit.batch(root);
  const T = kit.batch(turretPivot);
  const G = kit.batch(gunPivot);

  const ground = -hh;
  const trackW = 0.4;
  const trackT = 0.06;
  const trackX = hw - trackW / 2; // 1.275
  const belly = ground + 0.385; // 离地间隙 0.385
  const deck = 0.24; // 翼子板 / 上部车体底面
  const top = hh;
  const tubW = trackX - trackW / 2 - 0.03; // 下部车体半宽(两条履带之间)1.045
  const supW = 1.22; // 上部车体半宽(伸出盖住履带内侧)
  const xo = hw + 0.02; // 翼子板外缘
  const sideK = Math.tan(11 * DEG); // 战斗室侧板内倾
  const cw = (y: number) => supW - (y - deck) * sideK; // 战斗室侧板半宽(车体坐标 y):底边落在翼子板上

  // 战斗室前板 10° 后倾,炮耳轴正好落在板面上;车体上的前板与战斗室前板是同一平面
  const oz = turret.offset ?? 0; // -0.8
  const ch = turret.height; // 0.66,平顶高度
  const gy = ch / 2;
  const gz = -turret.length / 2;
  const frontK = Math.tan(10 * DEG);
  const zFT = (y: number) => gz + (y - gy) * frontK; // 战斗室坐标
  const zFront = (y: number) => oz + zFT(y - top); // 车体坐标
  const zCR = oz + turret.length / 2; // 战斗室后壁(车体坐标)0.45
  const zRT = (y: number) => turret.length / 2 - y * 0.06; // 战斗室后壁略前倾(战斗室坐标)
  // 前板上部:yF 以上是 60° 斜板,一直到屋顶前缘
  const yF = 0.4;
  const roofZ = zFT(yF) + (ch - yF) * Math.tan(60 * DEG); // 屋顶前缘(战斗室坐标)
  // 车鼻:21° 后倾的前板,上接首上斜板,斜板后端顶到战斗室前板
  const noseBot: Vec2 = [-2.75, -0.18];
  const noseTop: Vec2 = [noseBot[0] + (0.12 - noseBot[1]) * Math.tan(21 * DEG), 0.12];
  const drv: Vec2 = [zFront(0.3), 0.3];
  // 履带上方的两侧翼(sponson):前板只有 ±xc 宽,两侧翼的正面从首上斜板后缘一路后倾到屋顶前缘
  const xc = 0.94;
  const sK = (oz + roofZ - drv[0]) / (top + ch - drv[1]);
  const zS = (y: number) => drv[0] + (y - drv[1]) * sK; // 侧翼正面(车体坐标,y ≥ drv[1])
  const sponson = (s: number, y: number, w: number, z0: number, z1: number): Tuple3[] => [
    [s * xc, y, z0],
    [s * w, y, z0],
    [s * w, y, z1],
    [s * xc, y, z1],
  ];
  // 车尾:下部垂直后板 + 上部前倾 18° 的后板
  const rearZ0 = 2.72;
  const zRear = (y: number) => rearZ0 - (y - deck) * Math.tan(18 * DEG);

  // ---------------- 行走机构:6 对小负重轮(扭杆)、3 个托带轮、前主动轮、后诱导轮
  const wheelR = 0.26;
  const wheelY = ground + trackT + wheelR;
  const wc = { face: C.paint, rim: C.rubber, hub: C.shade, tyre: C.rubber, spoke: C.deep };
  // 双轮:两片挂胶轮并排、中间留缝(内侧那片镜像,轮毂朝车体)
  const disc = rubberRoadWheel(wheelR, 0.09, wc, 10);
  const twin = new GeoBatch().add(disc, null, [0.075, 0, 0]).add(disc, null, [-0.075, 0, 0], undefined, [-1, 1, 1]).build();
  const roadZ = [-1.5, -0.94, -0.28, 0.28, 0.94, 1.5];
  const sprR = 0.33;
  const spr = { x: trackX - 0.04, y: -0.23, z: -2.38 };
  const idl = { x: trackX, y: -0.23, z: 2.4 };
  const rollerR = 0.11;
  const rollerX = trackX - 0.1; // 托带轮靠车体一侧,压在履带内半边
  const rollerZ = [-1.22, 0, 1.22];
  runningGear(kit, root, { x: trackX, width: trackW, thickness: trackT, pitch: 0.12, color: C.track }, [
    { geo: twin, radius: wheelR, wheels: roadZ.map((z) => ({ x: trackX, y: wheelY, z })) },
    { geo: toothedSprocket(sprR, 18, 0.24, trackT, wc), radius: sprR, teeth: 18, wheels: [spr] },
    { geo: discWheel(0.3, 0.24, { ...wc, hole: C.dark }, 6), radius: 0.3, tensioner: true, wheels: [idl] },
    {
      geo: rubberRoadWheel(rollerR, 0.1, { face: C.shade, rim: C.rubber, hub: C.deep, tyre: C.rubber }, 10),
      radius: rollerR,
      wheels: rollerZ.map((z) => ({ x: rollerX, y: 0, z })),
    },
  ]);
  // 沿 X 的短圆柱(右侧几何,左侧用 scale 镜像):摆臂轴座、终传动壳、诱导轮曲柄座、托带轮轴
  const xCyl = (profile: readonly Vec2[]) => revolve(profile, 'x', 8);
  const armX = (tubW + trackX - 0.165) / 2; // 车体侧面与内侧轮毂之间
  bothSides((s) => {
    const m: Tuple3 = [s, 1, 1];
    for (const z of roadZ) {
      // 扭杆摆臂:轴座在前上方,车轮在后
      H.add(rod([s * armX, wheelY, z], [s * armX, wheelY + 0.1, z - 0.2], 0.04, 6), C.shade);
      H.add(xCyl([[0.05, tubW - 0.02], [0.05, armX + 0.03]]), C.deep, [0, wheelY + 0.1, z - 0.2], undefined, m);
    }
    H.add(xCyl([[0.17, tubW - 0.02], [0.17, 1.07], [0.13, spr.x - 0.11]]), C.shade, [0, spr.y, spr.z], undefined, m);
    H.add(xCyl([[0.09, tubW - 0.02], [0.09, idl.x - 0.11]]), C.shade, [0, idl.y, idl.z], undefined, m);
    for (const z of rollerZ) H.add(xCyl([[0.035, tubW - 0.02], [0.035, rollerX - 0.04]]), C.deep, [0, 0, z], undefined, m);
  });

  // ---------------- 车体
  // 下部车体(两条履带之间):车鼻前板 + 首上斜板,后部垂直后板,底板前后两端上翘
  H.add(
    extrude(
      [
        [-2.45, belly],
        [2.5, belly],
        [rearZ0, -0.12],
        [rearZ0, deck],
        [drv[0], deck],
        drv,
        noseTop,
        noseBot,
      ],
      'x',
      -tubW,
      tubW,
    ),
    C.paint,
  );
  // 上部车体:战斗室下方一段 = 前板(±xc)+ 两侧翼(侧板接着战斗室侧板 11° 内倾,正面在首上斜板以上开始后倾);
  // 发动机舱一段为垂直侧板 + 前倾后板
  H.add(prism(deck, top, rect2(xc, zFront(deck), zCR), rect2(xc, zFront(top), zCR)), C.paint);
  bothSides((s) => {
    H.add(loft([sponson(s, deck, cw(deck), zFront(deck), zCR), sponson(s, drv[1], cw(drv[1]), drv[0], zCR), sponson(s, top, cw(top), zS(top), zCR)]), C.paint);
  });
  H.add(prism(deck, top, rect2(supW, zCR - 0.02, zRear(deck)), rect2(supW, zCR - 0.02, zRear(top))), C.paint);

  // 车鼻前板:栓接的 30 mm 附加装甲 + 两排螺栓
  const nRot: Tuple3 = [21 * DEG, 0, 0];
  const np = (x: number, y: number, off: number): Tuple3 => [
    x,
    y + off * Math.sin(21 * DEG),
    noseBot[0] + (y - noseBot[1]) * Math.tan(21 * DEG) - off * Math.cos(21 * DEG),
  ];
  H.add(box(1.9, 0.26, 0.03), C.paint, np(0, -0.03, 0.012), nRot);
  for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) {
    for (const y of [-0.12, 0.06]) H.add(box(0.045, 0.045, 0.025), C.shade, np(x, y, 0.038), nRot);
  }
  // 首上斜板:两块制动器检修舱盖(后缘铰链 + 把手)
  const ud: Vec2 = [drv[0] - noseTop[0], drv[1] - noseTop[1]];
  const beta = Math.atan2(ud[1], ud[0]); // 与水平面夹角 ≈ 22°
  const uRot: Tuple3 = [-beta, 0, 0];
  const up = (x: number, t: number, off: number): Tuple3 => [x, noseTop[1] + t * ud[1] + off * Math.cos(beta), noseTop[0] + t * ud[0] - off * Math.sin(beta)];
  bothSides((s) => {
    H.add(box(0.56, 0.035, 0.3), C.paint, up(s * 0.42, 0.5, 0.0135), uRot);
    for (const dx of [-0.18, 0.18]) H.add(box(0.1, 0.045, 0.07), C.shade, up(s * 0.42 + dx, 0.84, 0.02), uRot);
    H.add(box(0.12, 0.025, 0.025), C.steel, up(s * 0.42, 0.3, 0.04), uRot);
  });
  // 左前翼子板上的大灯
  H.add(headlight(C, 0.07), null, [-1.3, deck - 0.005, -2.32]);

  bothSides((s) => {
    // 翼子板:车体两侧长条 + 前端下折的挡泥板 + 后挡泥板
    const fw = xo - (supW - 0.05);
    H.add(box(fw, 0.025, rearZ0 - zFront(deck)), C.shade, [s * (xo - fw / 2), deck - 0.0125, (rearZ0 + zFront(deck)) / 2]);
    const fm: Vec2[] = [
      [zFront(deck) + 0.05, deck],
      [zFront(deck) + 0.05, deck - 0.025],
      [-2.55, deck - 0.025],
      [-2.8, deck - 0.14],
      [-2.82, deck - 0.12],
      [-2.57, deck],
    ];
    H.add(extrude(fm, 'x', s * tubW, s * xo), C.shade);
    const rm: Vec2[] = [
      [rearZ0 - 0.05, deck],
      [rearZ0 - 0.05, deck - 0.025],
      [2.8, deck - 0.025],
      [2.88, deck - 0.1],
      [2.9, deck - 0.08],
      [2.82, deck],
    ];
    H.add(extrude(rm, 'x', s * tubW, s * xo), C.shade);
    // 车首拖车耳板(下部车体侧板前伸)+ 钩孔
    H.add(
      towLug(
        C,
        [
          [-2.5, -0.31],
          [-2.86, -0.27],
          [-2.9, -0.13],
          [-2.85, -0.04],
          [-2.66, 0.0],
        ],
        s * (tubW - 0.08),
        s * tubW,
        [-2.8, -0.15],
        0.045,
      ),
      null,
    );
    // 车尾拖车耳板
    H.add(
      towLug(
        C,
        [
          [2.6, -0.22],
          [2.84, -0.17],
          [2.87, -0.05],
          [2.8, 0.04],
          [2.7, 0.06],
        ],
        s * 0.9,
        s * 0.98,
        [2.79, -0.07],
        0.04,
      ),
      null,
    );
    // 发动机舱:检修舱盖、两侧进气格栅、加油口
    H.add(rectHatch(C, 0.8, 0.95), null, [s * 0.44, top, 1.28]);
    H.add(grille(C, 0.28, 0.9, 4), null, [s * 1.0, top, 1.28]);
    H.add(revolve([[0.07, top - 0.01], [0.07, top + 0.03], [0.05, top + 0.045]], 'y', 8), C.shade, [s * 0.44, 0, 1.93]);
    // 消音器吊架 + 箍带、向下的排气尾管
    H.add(box(0.05, 0.05, 0.12), C.shade, [s * 0.4, 0.06, rearZ0 + 0.05]);
    H.add(revolve([[0.128, -0.02], [0.128, 0.02]], 'x', 10, { startCap: null, endCap: null }), C.deep, [s * 0.4, 0.06, rearZ0 + 0.11]);
    H.add(revolve([[0.04, -0.1], [0.04, 0.02]], 'y', 8, { colors: [C.rust], startCap: C.dark }), null, [s * 0.55, 0, rearZ0 + 0.11]);
  });
  // 尾部横向出风格栅
  H.add(grille(C, 1.8, 0.36, 3), null, [0, top, 2.2]);
  // 车尾横置消音器 + 拖车钩
  H.add(revolve([[0.1, -0.74], [0.12, -0.7], [0.12, 0.7], [0.1, 0.74]], 'x', 10, { colors: [C.shade, C.rust, C.shade] }), null, [0, 0.06, rearZ0 + 0.11]);
  H.add(box(0.14, 0.12, 0.14), C.shade, [0, -0.07, rearZ0 + 0.06]);

  // 翼子板上的随车工具(平放,贴着翼子板面)
  const flat: Tuple3 = [0, 0, Math.PI / 2];
  // 右侧:铁锹、撬棍、灭火器
  H.add(shovel(C, 1.0), null, [1.36, deck + 0.012, -0.55], flat);
  H.add(rod([1.455, deck + 0.016, -0.35], [1.455, deck + 0.016, 0.75], 0.018, 5), C.steel);
  H.add(revolve([[0.05, -0.25], [0.065, -0.22], [0.065, 0.22], [0.05, 0.25]], 'z', 8, { colors: [C.steel, C.deep, C.steel] }), null, [1.36, deck + 0.06, 0.9]);
  for (const dz of [-0.14, 0.14]) {
    H.add(revolve([[0.07, -0.02], [0.07, 0.02]], 'z', 8, { startCap: null, endCap: null }), C.shade, [1.36, deck + 0.06, 0.9 + dz]);
  }
  // 左侧:斧子、千斤顶、千斤顶垫木
  H.add(axe(C, 0.8), null, [-1.34, deck + 0.012, -0.6], flat);
  H.add(revolve([[0.06, -0.24], [0.06, 0.24]], 'z', 8), C.deep, [-1.36, deck + 0.055, 1.6]);
  H.add(box(0.04, 0.04, 0.12), C.steel, [-1.36, deck + 0.13, 1.7]);
  H.add(box(0.22, 0.12, 0.3), C.wood, [-1.36, deck + 0.058, 2.15]);
  // 左侧发动机舱侧壁:拖车钢缆
  H.add(towCables(C, [-(supW + 0.022), 0.42, 0.62], [-(supW + 0.022), 0.42, 2.42], [0, 1, 0], 0.08), null);

  // ---------------- 战斗室(turretPivot 坐标:原点在车顶、车体 z = offset 处,y = 0 为车顶,不转动)
  // 中间一块:10° 前板 + 60° 上斜板 + 平顶;两侧翼:正面后倾到屋顶前缘,侧板 11° 内倾
  const cwT = (y: number) => cw(y + top);
  const zST = (y: number) => zS(y + top) - oz;
  const mid = (y: number, z0: number): Tuple3[] => [
    [-xc, y, z0],
    [xc, y, z0],
    [xc, y, zRT(y)],
    [-xc, y, zRT(y)],
  ];
  T.add(loft([mid(0, zFT(0)), mid(yF, zFT(yF)), mid(ch, roofZ)]), C.paint);
  bothSides((s) => T.add(loft([sponson(s, 0, cwT(0), zST(0), zRT(0)), sponson(s, ch, cwT(ch), zST(ch), zRT(ch))]), C.paint));
  // 前板上(炮位两侧)栓接的 30 mm 附加装甲 + 螺栓;左侧驾驶员观察窗
  const fRot: Tuple3 = [10 * DEG, 0, 0];
  const fp = (x: number, y: number, off: number): Tuple3 => [x, y + off * Math.sin(10 * DEG), zFT(y) - off * Math.cos(10 * DEG)];
  bothSides((s) => {
    T.add(box(0.6, 0.8, 0.03), C.paint, fp(s * 0.6, -0.025, 0.012), fRot);
    for (const x of [0.34, 0.6, 0.86]) {
      for (const y of [-0.37, 0.32]) T.add(box(0.045, 0.045, 0.025), C.shade, fp(s * x, y, 0.038), fRot);
    }
  });
  T.add(box(0.36, 0.16, 0.08), C.paint, fp(-0.6, 0.2, 0.06), fRot);
  T.add(box(0.26, 0.035, 0.02), C.dark, fp(-0.6, 0.21, 0.105), fRot);
  // 车长指挥塔(左后):矮圆筒 + 7 具潜望镜 + 防雨檐 + 舱盖
  const kx = -0.52;
  const kz = 0.55;
  const kr = 0.3;
  T.add(
    revolve(
      [
        [kr + 0.02, ch - 0.03],
        [kr + 0.02, ch + 0.05],
        [kr, ch + 0.07],
        [kr, ch + 0.15],
        [kr + 0.015, ch + 0.16],
        [kr + 0.015, ch + 0.18],
        [kr - 0.06, ch + 0.2],
      ],
      'y',
      14,
      { colors: [C.paint, C.paint, C.shade, C.paint, C.paint, C.paint] },
    ),
    null,
    [kx, 0, kz],
  );
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + Math.PI / 2;
    T.add(box(0.1, 0.05, 0.04), C.dark, [kx + (kr - 0.005) * Math.cos(a), ch + 0.11, kz + (kr - 0.005) * Math.sin(a)], [0, Math.PI / 2 - a, 0]);
  }
  T.add(roundHatch(C, 0.22, 0.04), null, [kx, ch + 0.2, kz]);
  // 炮手瞄准镜(左前):滑动盖板 + 镜头
  T.add(box(0.32, 0.03, 0.36), C.shade, [-0.42, ch + 0.015, -0.5]);
  T.add(periscope(C, 0.12, 0.12, 0.12), null, [-0.42, ch + 0.03, -0.52]);
  // 装填手双片舱盖(右)+ 中缝
  const lx = 0.45;
  const lz = 0.32;
  T.add(rectHatch(C, 0.56, 0.62), null, [lx, ch, lz]);
  T.add(box(0.5, 0.012, 0.02), C.dark, [lx, ch + 0.072, lz]);
  // 机枪护板(舱盖前方:底座 + 正板 + 两侧后掠翼板 + 两根撑杆;不带机枪)
  const mz = -0.06;
  const mh = 0.26;
  T.add(box(0.5, 0.04, 0.07), C.shade, [lx, ch + 0.02, mz]);
  T.add(box(0.5, mh, 0.018), C.paint, [lx, ch + mh / 2, mz]);
  T.add(box(0.08, 0.06, 0.022), C.dark, [lx, ch + mh - 0.03, mz]);
  bothSides((s) => {
    const a = 30 * DEG;
    T.add(box(0.018, mh, 0.16), C.paint, [lx + s * (0.25 + 0.08 * Math.sin(a)), ch + mh / 2, mz + 0.08 * Math.cos(a)], [0, s * a, 0]);
    T.add(rod([lx + s * 0.15, ch + 0.03, mz + 0.16], [lx + s * 0.15, ch + mh * 0.6, mz + 0.005], 0.014, 4), C.shade);
  });
  // 后壁通风罩
  const fy = 0.36;
  T.add(revolve([[0.15, zRT(fy) - 0.03], [0.15, zRT(fy) + 0.05], [0.1, zRT(fy) + 0.1]], 'z', 10), C.shade, [0.5, fy, 0]);

  // ---------------- 「猪头」防盾 + StuK 40 L/48(随火炮转动)
  // 铸造防盾:椭圆截面往前收成圆锥;后段收细、埋进战斗室前板和上部斜板里,
  // ±10° 水平、-6° / +17° 俯仰时防盾都从板面里「长」出来,不露后端面
  const ell = (z: number, rx: number, ry: number): Tuple3[] =>
    Array.from({ length: 16 }, (_, k): Tuple3 => {
      const a = (k / 16) * Math.PI * 2;
      return [rx * Math.cos(a), ry * Math.sin(a), z];
    });
  G.add(
    loft([
      ell(0.4, 0.2, 0.12),
      ell(0.2, 0.24, 0.19),
      ell(0.02, 0.28, 0.22),
      ell(-0.1, 0.28, 0.22),
      ell(-0.22, 0.25, 0.2),
      ell(-0.32, 0.2, 0.165),
      ell(-0.4, 0.145, 0.13),
      ell(-0.45, 0.1, 0.1),
    ]),
    C.paint,
  );
  // 顶部两个吊耳
  bothSides((s) => G.add(box(0.03, 0.06, 0.07), C.shade, [s * 0.1, 0.205, -0.2]));
  // 炮管根部箍环 + 炮管(渐细)+ 双室制退器
  const muzzle = -turret.barrelLength;
  const brake = 0.3;
  G.add(revolve([[0.085, -0.42], [0.085, -0.5], [0.07, -0.53]], 'z', 10), C.paint);
  G.add(revolve([[0.066, -0.5], [0.06, -0.9], [0.05, muzzle + brake + 0.01]], 'z', 8), C.paint);
  G.add(doubleBaffleBrake(C, brake, 0.085, 0.05, C.paint), null, [0, 0, muzzle + brake]);
}

/** 对称矩形截面(半宽 hw,前后 z0..z1) */
function rect2(hw: number, z0: number, z1: number) {
  return { x0: -hw, x1: hw, z0, z1 };
}
