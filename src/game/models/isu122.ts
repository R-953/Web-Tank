import type { VehicleSpec } from '../../data/types';
import { DEG, GeoBatch, ModelKit, bothSides, box, darker, extrude, loft, palette, revolve, rod, type ModelParts, type Tuple3, type Vec2 } from './kit';
import { discWheel, rubberRoadWheel, runningGear, toothedSprocket } from './running';
import { axe, grille, periscope, rectHatch, roundHatch, shovel, spareLink, towLug } from './parts';

/**
 * ISU-122(1944 年型,IS-2 底盘,122 mm A-19S):
 *   车首上下两块装甲在车首尖端相交:下首板 30° 往后收到车底,上首板 30° 后倾、和战斗室正面是同一块斜面
 *   一直上到平顶(上首板挂两排备用履带板,车首两个拖车耳板);
 *   每侧 6 对 550 mm 挂胶双负重轮(扭杆摆臂)、3 对托带轮、后置 14 齿主动轮(终传动壳)、前置诱导轮,650 mm 宽带诱导齿的履带;
 *   上部车体和战斗室侧板 15° 内倾、盖在履带上方,底边落在翼子板上(翼子板露在外面),正面两角 45° 斜切;
 *   高大的箱形战斗室占车体前 60%:正面左侧驾驶员观察窗,顶上车长 / 装填手两个圆舱盖(各带潜望镜)、
 *   瞄准镜潜望镜、通风罩、后部双片矩形舱盖,侧面扶手;
 *   方正的铸造防盾(圆角厚块)+ 圆柱炮管套筒 + 细长无制退器的 A-19S 炮管;
 *   发动机舱:大圆形检修舱盖、右侧进气格栅、尾部横向出风格栅、加油口;上尾板后倾(铰链 + 两根带护罩的排气管)、
 *   下尾板拖车耳板;前后挡泥板,后部两侧翼子板上各两个外挂油桶;侧面随车工具(铁锹、撬棍、斧子)。
 * 不加 DShK 高射机枪和天线。
 * 负重轮直径、履带宽度用 IS-2 公开数据(550 / 650 mm);正面 30°、侧面 15° 按任务说明;
 * 离地间隙 0.47 m、下首板 / 尾板角度、战斗室和各零件的尺寸按参考图比例估算。
 */
export function buildISU122(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const hh = hull.height / 2; // 0.775
  const hw = hull.width / 2; // 1.535
  const hl = hull.length / 2; // 3.385
  const C = palette(spec.color);
  const H = kit.batch(root);
  const T = kit.batch(turretPivot);
  const G = kit.batch(gunPivot);

  const ground = -hh;
  const trackW = 0.65;
  const trackT = 0.075;
  const trackX = hw - trackW / 2; // 1.21
  const belly = ground + 0.47; // 离地间隙 0.47(估算)
  const deck = 0.24; // 翼子板 / 上部车体底面
  const top = hh;
  const tubW = trackX - trackW / 2 - 0.03; // 下部车体半宽(两条履带之间)0.855
  const supW = 1.36; // 上部车体侧板底边半宽(外挂油桶要留在车宽以内)
  const xo = hw + 0.02; // 翼子板外缘
  const sideK = Math.tan(15 * DEG);
  const sw = (y: number) => supW - (y - deck) * sideK; // 上部车体 / 战斗室侧板半宽(车体坐标 y)
  const sn: Vec2 = [Math.cos(15 * DEG), Math.sin(15 * DEG)]; // 右侧侧板外法线
  const cheek = 0.3; // 正面两角斜切(俯视 45°)
  // 正面:车首尖端 (−hl, 0) 起 30° 后倾一直到战斗室顶;下首板同样 30°,往后收到车底
  const frontK = Math.tan(30 * DEG);
  const zF = (y: number) => -hl + y * frontK;
  // 车尾:上尾板后倾到尾端 (hl, rearTipY),下尾板往前收到车底
  const rearTipY = 0.1;
  const rearK = 0.72;
  const zR = (y: number) => hl - (y - rearTipY) * rearK;

  // ---------------- 行走机构:6 对双负重轮、3 对托带轮、后主动轮、前诱导轮
  const wheelR = 0.275;
  const wheelY = ground + trackT + wheelR;
  const wc = { face: C.paint, rim: C.rubber, hub: C.shade, tyre: C.rubber, spoke: C.deep };
  // 双轮:两片挂胶轮夹着履带诱导齿(内侧那片镜像,轮毂朝车体)
  const disc = rubberRoadWheel(wheelR, 0.13, wc, 12);
  const twin = new GeoBatch().add(disc, null, [0.115, 0, 0]).add(disc, null, [-0.115, 0, 0], undefined, [-1, 1, 1]).build();
  const roadZ = [-2.025, -1.215, -0.405, 0.405, 1.215, 2.025];
  const sprR = 0.33;
  const sprW = 0.34;
  const spr = { x: trackX, y: -0.28, z: 2.87 };
  const idlR = 0.3;
  const idl = { x: trackX, y: -0.25, z: -2.9 };
  const rollerR = 0.1;
  const rollerY = 0.03;
  const rollerZ = [-1.62, 0, 1.62];
  const roller = rubberRoadWheel(rollerR, 0.08, { face: C.shade, rim: C.rubber, hub: C.deep, tyre: C.rubber }, 10);
  const twinRoller = new GeoBatch().add(roller, null, [0.1, 0, 0]).add(roller, null, [-0.1, 0, 0], undefined, [-1, 1, 1]).build();
  runningGear(kit, root, { x: trackX, width: trackW, thickness: trackT, pitch: 0.165, color: C.track, style: 'guide' }, [
    { geo: twin, radius: wheelR, wheels: roadZ.map((z) => ({ x: trackX, y: wheelY, z })) },
    { geo: toothedSprocket(sprR, 14, sprW, trackT, wc), radius: sprR, teeth: 14, wheels: [spr] },
    { geo: discWheel(idlR, 0.3, { ...wc, hole: C.dark }, 6), radius: idlR, tensioner: true, wheels: [idl] },
    { geo: twinRoller, radius: rollerR, wheels: rollerZ.map((z) => ({ x: trackX, y: rollerY, z })) },
  ]);
  // 沿 X 的短圆柱(右侧几何,左侧用 scale 镜像):摆臂轴座、车轴、终传动壳、诱导轮曲柄座、托带轮轴
  const xCyl = (profile: readonly Vec2[]) => revolve(profile, 'x', 8);
  const hubIn = trackX - 0.115 - 0.065 - 0.045; // 内侧负重轮轮毂端面 0.985
  const armX = (tubW + hubIn) / 2;
  bothSides((s) => {
    const m: Tuple3 = [s, 1, 1];
    for (const z of roadZ) {
      // 扭杆摆臂:轴座在前上方,车轮在后
      H.add(rod([s * armX, wheelY, z], [s * armX, wheelY + 0.12, z - 0.22], 0.045, 6), C.shade);
      H.add(xCyl([[0.06, tubW - 0.02], [0.06, armX + 0.04]]), C.deep, [0, wheelY + 0.12, z - 0.22], undefined, m);
      H.add(xCyl([[0.05, armX - 0.02], [0.05, hubIn + 0.015]]), C.deep, [0, wheelY, z], undefined, m);
    }
    H.add(xCyl([[0.19, tubW - 0.02], [0.19, 0.95], [0.14, spr.x - sprW / 2 + 0.02]]), C.shade, [0, spr.y, spr.z], undefined, m);
    H.add(xCyl([[0.09, tubW - 0.02], [0.09, idl.x - 0.15 + 0.02]]), C.shade, [0, idl.y, idl.z], undefined, m);
    for (const z of rollerZ) H.add(xCyl([[0.035, tubW - 0.02], [0.035, trackX + 0.06]]), C.deep, [0, rollerY, z], undefined, m);
  });

  // ---------------- 车体
  // 下部车体(两条履带之间):上下首板在车首尖端相交,上下尾板在车尾尖端相交
  H.add(
    extrude(
      [
        [-hl - belly * frontK, belly],
        [hl - (rearTipY - belly) * 0.7, belly],
        [hl, rearTipY],
        [zR(deck), deck],
        [zF(deck), deck],
        [-hl, 0],
      ],
      'x',
      -tubW,
      tubW,
    ),
    C.paint,
  );
  // 上部车体:翼子板以上,侧板 15° 内倾、正面两角斜切,前面是战斗室正面的延续,后面是上尾板;车顶前 60% 由战斗室盖住
  // 截面:y 高处(车体坐标)的侧板半宽 / 正面位置,输出时整体平移 (0, dy, dz),后面到 rear
  const ring = (y: number, rear: number, dy = 0, dz = 0): Tuple3[] => {
    const w = sw(y);
    const z0 = zF(y) + dz;
    return [
      [-(w - cheek), y + dy, z0],
      [w - cheek, y + dy, z0],
      [w, y + dy, z0 + cheek],
      [w, y + dy, rear],
      [-w, y + dy, rear],
      [-w, y + dy, z0 + cheek],
    ];
  };
  H.add(loft([ring(deck, zR(deck)), ring(top, zR(top))]), C.paint);

  bothSides((s) => {
    // 翼子板:侧面长条 + 前端下折的挡泥板 + 后挡泥板
    const fw = xo - (supW - 0.05);
    H.add(box(fw, 0.025, zR(deck) - zF(deck)), C.shade, [s * (xo - fw / 2), deck - 0.0125, (zR(deck) + zF(deck)) / 2]);
    const fm: Vec2[] = [
      [zF(deck) + 0.06, deck],
      [zF(deck) + 0.06, deck - 0.025],
      [-3.36, deck - 0.025],
      [-3.52, deck - 0.19],
      [-3.545, deck - 0.17],
      [-3.385, deck],
    ];
    H.add(extrude(fm, 'x', s * (tubW + 0.02), s * xo), C.shade);
    const rm: Vec2[] = [
      [zR(deck) - 0.06, deck],
      [zR(deck) - 0.06, deck - 0.025],
      [3.36, deck - 0.025],
      [3.47, deck - 0.12],
      [3.495, deck - 0.1],
      [3.39, deck],
    ];
    H.add(extrude(rm, 'x', s * (tubW + 0.02), s * xo), C.shade);
    // 车首 / 车尾拖车耳板(后端埋进首板 / 尾板)
    const lug = (outline: Vec2[], x: number, hole: Vec2) => H.add(towLug(C, outline, s * x, s * (x + 0.08), hole, 0.04), null);
    lug(
      [
        [-3.28, -0.16],
        [-3.47, -0.12],
        [-3.5, 0.0],
        [-3.44, 0.07],
        [-3.3, 0.12],
      ],
      0.5,
      [-3.43, -0.02],
    );
    lug(
      [
        [3.2, -0.12],
        [3.45, -0.08],
        [3.49, 0.03],
        [3.44, 0.1],
        [3.33, 0.16],
      ],
      0.55,
      [3.43, 0.01],
    );
  });

  // 上首板:两排备用履带板
  const fRot: Tuple3 = [-60 * DEG, 0, 0]; // 局部 +Y 转到上首板外法线,局部 Z 沿板面向上
  const hp = (x: number, y: number, off: number): Tuple3 => [x, y + off * Math.sin(30 * DEG), zF(y) - off * Math.cos(30 * DEG)];
  for (const y of [0.28, 0.5]) bothSides((s) => H.add(spareLink(C, 0.62, 0.17), null, hp(s * 0.36, y, 0), fRot));

  // 战斗室下方侧板上的随车工具:右侧铁锹 + 撬棍,左侧斧子
  const sideAt = (s: number, y: number, off: number): Tuple3 => [s * (sw(y) + sn[0] * off), y + sn[1] * off, 0];
  {
    const p = sideAt(1, 0.5, 0.024);
    H.add(shovel(C, 1.0), null, [p[0], p[1], -0.7], [0, 0, 15 * DEG]);
    const q = sideAt(1, 0.66, 0.02);
    H.add(rod([q[0], q[1], -2.3], [q[0], q[1], -0.9], 0.018, 5), C.steel);
    const a = sideAt(-1, 0.5, 0.024);
    H.add(axe(C, 0.8), null, [a[0], a[1], -1.0], [0, 0, -15 * DEG]);
  }

  // 后部两侧翼子板上的外挂油桶(每侧两个,底面落在翼子板上、贴着侧板)
  const tankR = 0.16;
  const tankY = deck + tankR - 0.005;
  const tankX = supW + (tankR - 0.01 - (tankY - deck) * sn[1]) / sn[0];
  const drumCol = darker(spec.color, 0.88);
  const drum = revolve(
    [
      [tankR * 0.85, -0.44],
      [tankR, -0.41],
      [tankR, 0.41],
      [tankR * 0.85, 0.44],
    ],
    'z',
    10,
    { colors: [C.deep, drumCol, C.deep] },
  );
  const strap = revolve(
    [
      [tankR + 0.006, -0.025],
      [tankR + 0.006, 0.025],
    ],
    'z',
    10,
    { startCap: null, endCap: null },
  );
  bothSides((s) => {
    for (const zc of [1.3, 2.28]) {
      H.add(drum, null, [s * tankX, tankY, zc]);
      for (const dz of [-0.25, 0.25]) H.add(strap, C.deep, [s * tankX, tankY, zc + dz]);
    }
  });

  // 发动机舱:大圆形检修舱盖(中央鼓包 + 一圈螺栓)、右侧进气格栅、尾部横向出风格栅、两个加油口
  const mh: Tuple3 = [-0.35, top, 1.55];
  H.add(revolve([[0.5, -0.01], [0.5, 0.04], [0.46, 0.055]], 'y', 16, { startCap: null }), C.paint, mh);
  H.add(revolve([[0.16, 0.05], [0.16, 0.09], [0.08, 0.13]], 'y', 10), C.shade, mh);
  const hexBolt = revolve([[0.022, 0.045], [0.022, 0.072]], 'y', 6);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    H.add(hexBolt, C.shade, [mh[0] + 0.4 * Math.cos(a), top, mh[2] + 0.4 * Math.sin(a)]);
  }
  H.add(grille(C, 0.62, 1.05, 6), null, [0.62, top, 1.55]);
  H.add(grille(C, 1.9, 0.42, 3), null, [0, top, 2.55]);
  bothSides((s) => H.add(revolve([[0.07, top - 0.01], [0.07, top + 0.03], [0.05, top + 0.045]], 'y', 8), C.shade, [s * 0.95, 0, 0.9]));

  // 上尾板:顶边两个铰链、两根带护罩的排气管
  const rTilt = Math.atan(rearK);
  const rp = (x: number, y: number, off: number): Tuple3 => [x, y + off * Math.sin(rTilt), zR(y) + off * Math.cos(rTilt)];
  const rRot: Tuple3 = [Math.PI / 2 - rTilt, 0, 0];
  bothSides((s) => {
    H.add(box(0.18, 0.05, 0.08), C.shade, rp(s * 0.45, top - 0.05, 0.02), rRot);
    const ex = s * 0.72;
    const ey = 0.5;
    H.add(revolve([[0.075, zR(ey) - 0.08], [0.075, zR(ey) + 0.15]], 'z', 8, { colors: [C.rust], endCap: C.dark }), null, [ex, ey, 0]);
    // 护罩:顶板 + 两侧板,后端埋进尾板
    const cy = ey + 0.1;
    H.add(box(0.26, 0.035, 0.24), C.paint, [ex, cy, zR(cy) + 0.1]);
    for (const dx of [-0.115, 0.115]) H.add(box(0.03, 0.13, 0.2), C.paint, [ex + dx, cy - 0.065, zR(cy - 0.065) + 0.08]);
  });

  // ---------------- 战斗室(turretPivot 坐标:原点在车顶、车体 z = offset 处,y = 0 为车顶,不转动)
  const oz = turret.offset ?? 0; // -1.1
  const ch = turret.height; // 0.93,平顶高度
  const cRear = turret.length / 2; // 1.8,后壁
  const zFT = (y: number) => zF(y + top) - oz; // 正面在战斗室坐标里的 z
  // 主体:正面是上首板的延续(同一斜面、接缝处同宽),两角斜切,侧板 15° 内倾,后壁垂直
  T.add(loft([ring(top, cRear, -top, -oz), ring(top + ch, cRear, -top, -oz)]), C.paint);
  // 正面左侧驾驶员观察窗(贴在 30° 正面上)
  const cRot: Tuple3 = [30 * DEG, 0, 0]; // 局部 Z 沿正面法线,局部 Y 沿板面向上
  const fp = (x: number, y: number, off: number): Tuple3 => [x, y + off * Math.sin(30 * DEG), zFT(y) - off * Math.cos(30 * DEG)];
  T.add(box(0.26, 0.15, 0.08), C.paint, fp(-0.63, 0.25, 0.03), cRot);
  T.add(box(0.18, 0.03, 0.02), C.dark, fp(-0.63, 0.26, 0.075), cRot);
  // 顶部:车长圆舱盖(右前)、装填手圆舱盖(左),舱盖上各一具潜望镜;瞄准镜潜望镜(左前)、通风罩、后部双片矩形舱盖
  for (const [x, z] of [
    [0.52, -0.72],
    [-0.5, -0.2],
  ] as const) {
    T.add(roundHatch(C, 0.26, 0.05), null, [x, ch, z]);
    T.add(periscope(C, 0.12, 0.08, 0.1), null, [x, ch + 0.045, z + 0.03]);
  }
  T.add(box(0.26, 0.04, 0.26), C.shade, [-0.42, ch + 0.02, -0.95]);
  T.add(periscope(C, 0.16, 0.14, 0.14), null, [-0.42, ch + 0.035, -0.96]);
  T.add(revolve([[0.15, ch - 0.02], [0.15, ch + 0.05], [0.1, ch + 0.1]], 'y', 10), C.shade, [0.02, 0, -0.62]);
  T.add(revolve([[0.12, ch - 0.02], [0.12, ch + 0.04], [0.08, ch + 0.08]], 'y', 10), C.shade, [0.6, 0, 0.5]);
  T.add(rectHatch(C, 0.9, 0.6), null, [-0.1, ch, 1.3]);
  T.add(box(0.012, 0.012, 0.54), C.dark, [-0.1, ch + 0.072, 1.3]);
  // 侧面扶手(贴着内倾侧板)
  bothSides((s) => {
    const y = 0.62;
    const pts = [-0.8, 0.2, 1.2].map((z): Tuple3 => [s * (sw(y + top) + 0.07), y, z]);
    for (let k = 0; k + 1 < pts.length; k++) T.add(rod(pts[k], pts[k + 1], 0.02, 4), C.shade);
    for (const p of pts) T.add(box(0.1, 0.03, 0.03), C.shade, [p[0] - s * 0.045, p[1], p[2]]);
  });

  // ---------------- 铸造防盾 + A-19S(随火炮转动)
  // 方正的圆角厚块:炮耳轴在正面斜板前方 ≈ 0.2 m,防盾后段伸进斜板 0.6 m 以上,
  // 左 3° / 右 7°、−3° / +22° 时后端面都埋在战斗室里,板面外只露出前面一截
  G.add(loft([rrect(-0.31, 0.36, 0.3, 0.08), rrect(-0.26, 0.4, 0.34, 0.12), rrect(0.62, 0.4, 0.34, 0.12)]), C.paint);
  G.add(box(0.07, 0.07, 0.04), C.dark, [-0.24, 0.12, -0.31]); // 瞄准镜孔(左)
  bothSides((s) => G.add(box(0.04, 0.05, 0.08), C.shade, [s * 0.2, 0.355, -0.14])); // 顶部吊耳
  // 圆柱炮管套筒 + 细长炮管(略收细,无制退器)
  const muzzle = -turret.barrelLength;
  G.add(revolve([[0.15, -0.28], [0.15, -0.8], [0.13, -0.84]], 'z', 12), C.paint);
  G.add(
    revolve(
      [
        [0.1, -0.82],
        [0.093, -2.0],
        [0.083, muzzle],
      ],
      'z',
      10,
      { colors: [C.paint], endCap: C.dark },
    ),
    null,
  );
}

/** 圆角矩形截面(z 处,半宽 w、半高 h、圆角半径 r),逆时针 */
function rrect(z: number, w: number, h: number, r: number): Tuple3[] {
  const pts: Tuple3[] = [];
  const corners = [
    [1, 1, 0],
    [-1, 1, 90],
    [-1, -1, 180],
    [1, -1, 270],
  ] as const;
  for (const [sx, sy, a0] of corners) {
    for (let k = 0; k <= 3; k++) {
      const a = (a0 + k * 30) * DEG;
      pts.push([sx * (w - r) + r * Math.cos(a), sy * (h - r) + r * Math.sin(a), z]);
    }
  }
  return pts;
}
