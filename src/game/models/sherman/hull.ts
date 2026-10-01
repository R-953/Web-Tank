import {
  bothSides,
  box,
  cyl,
  DEG,
  extrude,
  prism,
  revolve,
  rod,
  tube,
  type GeoBatch,
  type Palette,
  type Tuple3,
  type Vec2,
} from '../kit';
import { axe, grille, headlight, periscope, roundHatch, shovel, spareLink, towLug } from '../parts';
import type { ShermanLayout } from './layout';

/**
 * 谢尔曼 M4A3 系列焊接车体模型(47° 单块首上)。
 *
 * 适用车辆:
 *   - M4A3(76)W: VVSS 悬挂、标准挡泥板、车头大灯带护罩
 *   - M4A3E8: HVSS 悬挂、宽履带对应加宽挡泥板与侧裙扩展板、车头大灯
 *   - M4A3E2 (Jumbo): 首上与侧面 1.5 英寸附加装甲(带焊缝与开口)、单块加厚铸造传动罩、无大灯与警报器
 *
 * 包含部件:
 *   1. 下部车体: 单块铸造传动罩(尖鼻型 / E2 加厚圆鼻型)、下部车体侧板与车底、终传动凸出罩、前拖车耳板
 *   2. 上部车体: 47° 焊接首上斜板、侧裙悬伸底面与侧壁、车尾板(10° 前倾)
 *   3. E2 附加装甲: 首上附加装甲板(航向机枪与舱口留开口)+ 侧面长方形附加装甲板 + 焊缝
 *   4. 挡泥板: 前后挡泥板(E8 加宽至约 1.46 m 覆盖 T66 履带,VVSS 宽 1.34 m)+ 侧裙下沿挡沙板安装支架
 *   5. 首上部件: M1919A4 航向机枪球座与枪管、车首大灯带金属管防撞护罩(E2 无)、警报器(E2 无)、前起吊环、备用履带板
 *   6. 车顶部件: 69 英寸座圈防弹护圈(内部完全留空)、驾驶员与副驾驶大圆舱盖(带潜望镜与把手)、
 *               双侧发动机散热百叶窗、中央铰接脊梁、后部检修盖板、4 个加油口、随车工具(铁锹、斧子、大锤、撬棍)
 *   7. 车尾部件: 双扇发动机检修门(带铰链与把手)、下部排气百叶导流板、后拖车钩、两侧防空/行车尾灯、后起吊环
 */
export function buildShermanHull(L: ShermanLayout, H: GeoBatch, C: Palette): void {
  const { ground, belly, sponsonY, top, noseZ, rearZ, lowerHalfW, upperHalfW, glacisBottom, glacisZ, variant } = L;
  const isJumbo = variant.applique;
  const isHvss = variant.suspension === 'hvss';

  // 车体侧裙与车尾板几何参数
  const rearLean = (top - sponsonY) * Math.tan(10 * DEG);
  const curUpperW = upperHalfW + L.applique;

  // -------------------------------------------------------------------------
  // 1. 下部车体(两条履带之间,半宽 lowerHalfW): 传动罩、车底、车尾下部
  // -------------------------------------------------------------------------
  // 首上斜板与竖直夹角 47°, 在 sponsonY 处的首板 z 位置
  const glacisSponsonZ = glacisZ(sponsonY);

  // 铸造传动罩侧视轮廓(标准尖鼻型 vs Jumbo 加厚圆鼻型)
  const lowerHullProfile: Vec2[] = isJumbo
    ? [
        [glacisSponsonZ, sponsonY],
        [glacisBottom.z, glacisBottom.y],
        [noseZ + 0.04, ground + 0.8],
        [noseZ, ground + 0.68],
        [noseZ, ground + 0.58],
        [noseZ + 0.06, ground + 0.46],
        [noseZ + 0.3, belly],
        [rearZ - 0.25, belly],
        [rearZ - 0.06, ground + 0.45],
        [rearZ - rearLean, sponsonY],
      ]
    : [
        [glacisSponsonZ, sponsonY],
        [glacisBottom.z, glacisBottom.y],
        [noseZ + 0.06, ground + 0.82],
        [noseZ, ground + 0.65], // 尖鼻中线棱
        [noseZ + 0.08, ground + 0.44],
        [noseZ + 0.35, belly],
        [rearZ - 0.25, belly],
        [rearZ - 0.06, ground + 0.45],
        [rearZ - rearLean, sponsonY],
      ];

  H.add(extrude(lowerHullProfile, 'x', -lowerHalfW, lowerHalfW), C.paint);

  // 传动罩与首板连接处的横向螺栓法兰条
  const flangeZ = glacisBottom.z + 0.01;
  const flangeY = glacisBottom.y + 0.01;
  H.add(box(lowerHalfW * 2, 0.04, 0.05), C.shade, [0, flangeY, flangeZ], [-43 * DEG, 0, 0]);
  const boltSpacing = (lowerHalfW * 1.8) / 9;
  for (let i = 0; i < 10; i++) {
    const bx = -lowerHalfW * 0.9 + i * boltSpacing;
    H.add(cyl(0.014, 0.014, 0.015, 6), C.steel, [bx, flangeY + 0.015, flangeZ - 0.01], [-43 * DEG, 0, 0]);
  }

  // 两侧终传动凸出盖(主动轮轴座内侧的铸件)
  bothSides((s) => {
    const finalDriveX = s * (lowerHalfW - 0.01);
    H.add(
      revolve(
        [
          [0.24, 0],
          [0.24, s * 0.06],
          [0.17, s * 0.08],
        ],
        'x',
        8,
        { colors: [C.shade] },
      ),
      null,
      [finalDriveX, L.sprocket.y, L.sprocket.z],
    );

    // 车首大拖车耳板(带拖车孔)
    const lugOutline: Vec2[] = [
      [noseZ + 0.22, ground + 0.42],
      [noseZ + 0.07, ground + 0.47],
      [noseZ + 0.03, ground + 0.57],
      [noseZ + 0.12, ground + 0.63],
      [noseZ + 0.23, ground + 0.58],
    ];
    H.add(towLug(C, lugOutline, s * 0.47, s * 0.55, [noseZ + 0.11, ground + 0.54], 0.045), null);
  });

  // -------------------------------------------------------------------------
  // 2. 上部车体(含侧裙): 47° 首上、侧裙底面在 sponsonY、车顶在 top、车尾 10° 前倾
  // -------------------------------------------------------------------------
  H.add(
    prism(
      sponsonY,
      top,
      { x0: -curUpperW, x1: curUpperW, z0: glacisSponsonZ, z1: rearZ - rearLean },
      { x0: -curUpperW, x1: curUpperW, z0: glacisZ(top), z1: rearZ },
    ),
    C.paint,
  );

  // -------------------------------------------------------------------------
  // 3. M4A3E2 Jumbo 专有: 首上附加装甲与上部侧面长方形附加装甲
  // -------------------------------------------------------------------------
  if (isJumbo) {
    const t = L.applique; // 1.5 in = 0.0381 m
    const tZ = t / Math.cos(47 * DEG); // 沿 Z 轴的厚度补偿
    const wApp = upperHalfW - 0.04;

    // 首上附加装甲分块构建以保留航向机枪和驾驶员/副驾驶舱盖开口
    // 3.1 首上下段(横贯整个首板下沿)
    const y0 = sponsonY + 0.03;
    const y1 = sponsonY + 0.24;
    H.add(
      prism(
        y0,
        y1,
        { x0: -wApp, x1: wApp, z0: glacisZ(y0) - tZ, z1: glacisZ(y0) },
        { x0: -wApp, x1: wApp, z0: glacisZ(y1) - tZ, z1: glacisZ(y1) },
      ),
      C.paint,
    );

    // 3.2 首上中段左侧(避开右侧航向机枪座)
    const y2 = top - 0.08;
    H.add(
      prism(
        y1,
        y2,
        { x0: -wApp, x1: 0.32, z0: glacisZ(y1) - tZ, z1: glacisZ(y1) },
        { x0: -wApp, x1: 0.32, z0: glacisZ(y2) - tZ, z1: glacisZ(y2) },
      ),
      C.paint,
    );

    // 3.3 首上中段右侧(机枪右侧区域)
    H.add(
      prism(
        y1,
        y2,
        { x0: 0.72, x1: wApp, z0: glacisZ(y1) - tZ, z1: glacisZ(y1) },
        { x0: 0.72, x1: wApp, z0: glacisZ(y2) - tZ, z1: glacisZ(y2) },
      ),
      C.paint,
    );

    // 3.4 首上中央上部凸出板(两舱门之间)
    H.add(
      prism(
        y2,
        top - 0.02,
        { x0: -0.2, x1: 0.2, z0: glacisZ(y2) - tZ, z1: glacisZ(y2) },
        { x0: -0.2, x1: 0.2, z0: glacisZ(top - 0.02) - tZ, z1: glacisZ(top - 0.02) },
      ),
      C.paint,
    );

    // 首上附加装甲外缘焊缝特征
    const weldMat = C.shade;
    H.add(box(wApp * 2, 0.02, 0.02), weldMat, [0, y0 + 0.01, glacisZ(y0) - tZ], [-43 * DEG, 0, 0]);
    H.add(box(0.02, y2 - y1, 0.02), weldMat, [0.32, (y1 + y2) / 2, glacisZ((y1 + y2) / 2) - tZ], [-43 * DEG, 0, 0]);
    H.add(box(0.02, y2 - y1, 0.02), weldMat, [0.72, (y1 + y2) / 2, glacisZ((y1 + y2) / 2) - tZ], [-43 * DEG, 0, 0]);

    // 3.5 侧面长方形附加装甲板(覆盖战斗室与弹药箱侧壁)
    const sideZ0 = glacisSponsonZ + 0.35;
    const sideZ1 = L.bogieZ[2] + 0.35;
    const sideLen = sideZ1 - sideZ0;
    const sideH = top - sponsonY - 0.08;
    const sideMidY = sponsonY + 0.04 + sideH / 2;
    const sideMidZ = (sideZ0 + sideZ1) / 2;

    bothSides((s) => {
      // 侧面附加装甲厚度加在原侧壁外侧
      H.add(box(t, sideH, sideLen), C.paint, [s * (upperHalfW + t / 2), sideMidY, sideMidZ]);
      // 侧装甲四周粗焊缝
      H.add(box(0.02, sideH + 0.02, 0.02), weldMat, [s * (upperHalfW + t + 0.005), sideMidY, sideZ0]);
      H.add(box(0.02, sideH + 0.02, 0.02), weldMat, [s * (upperHalfW + t + 0.005), sideMidY, sideZ1]);
      H.add(box(0.02, 0.02, sideLen), weldMat, [s * (upperHalfW + t + 0.005), sideMidY + sideH / 2, sideMidZ]);
      H.add(box(0.02, 0.02, sideLen), weldMat, [s * (upperHalfW + t + 0.005), sideMidY - sideH / 2, sideMidZ]);
    });
  }

  // -------------------------------------------------------------------------
  // 4. 侧裙支架与挡泥板(E8 HVSS 加宽至盖住宽履带)
  // -------------------------------------------------------------------------
  // 挡泥板宽度: HVSS履带外缘约 1.42 m -> 挡泥板宽至 1.46 m; VVSS 履带外缘 1.265 m -> 挡泥板宽至 1.34 m
  const fenderOuterW = isHvss ? 1.46 : isJumbo ? upperHalfW + L.applique + 0.02 : 1.34;
  const fenderInnerW = lowerHalfW + 0.01;
  const fenderW = fenderOuterW - fenderInnerW;

  bothSides((s) => {
    const fMidX = s * (fenderInnerW + fenderOuterW) / 2;

    // 4.1 侧裙下沿的挡沙板支架条(沿侧裙底边从前到后)
    const skirtLen = rearZ - rearLean - glacisSponsonZ;
    H.add(box(0.03, 0.04, skirtLen), C.shade, [s * curUpperW, sponsonY - 0.02, (glacisSponsonZ + rearZ - rearLean) / 2]);

    // 4.2 前挡泥板: 盖住主动轮上方并向下微倾斜
    const sprZ = L.sprocket.z;
    const frontFenderPoints: Vec2[] = [
      [glacisSponsonZ, sponsonY],
      [sprZ + 0.06, sponsonY],
      [-L.hl + 0.16, sponsonY - 0.12],
      [-L.hl + 0.14, sponsonY - 0.22],
      [-L.hl + 0.155, sponsonY - 0.22],
      [-L.hl + 0.175, sponsonY - 0.11],
      [sprZ + 0.06, sponsonY + 0.015],
      [glacisSponsonZ, sponsonY + 0.015],
    ];
    H.add(extrude(frontFenderPoints, 'x', s * fenderInnerW, s * fenderOuterW), C.shade);

    // 4.3 前挡泥板外缘折边与斜向加固支撑杆
    H.add(box(0.02, 0.06, sprZ + 0.06 - (-L.hl + 0.16)), C.deep, [
      s * (fenderOuterW - 0.01),
      sponsonY - 0.06,
      (sprZ + 0.06 - L.hl + 0.16) / 2,
    ]);
    H.add(
      rod(
        [s * (fenderInnerW + 0.05), sponsonY + 0.15, glacisSponsonZ + 0.1],
        [s * (fenderOuterW - 0.04), sponsonY - 0.08, -L.hl + 0.24],
        0.014,
        4,
      ),
      C.shade,
    );

    // 4.4 后挡泥板: 覆盖诱导轮上方与后部下折挡泥板
    const rearFenderPoints: Vec2[] = [
      [rearZ - rearLean, sponsonY],
      [rearZ - rearLean, sponsonY + 0.015],
      [L.hl - 0.02, sponsonY + 0.015],
      [L.hl + 0.04, sponsonY - 0.15],
      [L.hl + 0.025, sponsonY - 0.15],
      [L.hl - 0.03, sponsonY],
    ];
    H.add(extrude(rearFenderPoints, 'x', s * fenderInnerW, s * fenderOuterW), C.shade);

    // 后挡泥板橡胶防泥帘
    H.add(box(fenderW, 0.28, 0.015), C.rubber, [fMidX, sponsonY - 0.26, L.hl + 0.035]);

    // 4.5 HVSS 专有加宽侧裙走台扩展板(从前挡泥板贯穿至后挡泥板)
    if (isHvss) {
      const extW = fenderOuterW - upperHalfW;
      const extMidX = s * (upperHalfW + fenderOuterW) / 2;
      H.add(box(extW, 0.02, skirtLen), C.shade, [extMidX, sponsonY + 0.01, (glacisSponsonZ + rearZ - rearLean) / 2]);
    }
  });

  // -------------------------------------------------------------------------
  // 5. 首上部件: 航向机枪球座、大灯(E2 无)、起吊环、备用履带板
  // -------------------------------------------------------------------------
  // 5.1 M1919A4 航向机枪球座(位于首上右侧)
  const mgX = 0.52;
  const mgY = sponsonY + 0.35;
  const mgZ = glacisZ(mgY);
  // 机枪铸造球座外框
  H.add(
    revolve(
      [
        [0.13, 0],
        [0.125, 0.04],
        [0.09, 0.09],
      ],
      'z',
      8,
      { colors: [C.shade] },
    ),
    null,
    [mgX, mgY, mgZ - 0.01],
    [-47 * DEG, 0, 0],
  );
  // 机枪活动球体
  H.add(revolve([[0.08, -0.04], [0.08, 0.04]], 'z', 8, { colors: [C.deep] }), null, [mgX, mgY, mgZ - 0.06]);
  // 机枪打孔套筒枪管(向前水平探出)
  H.add(tube(0.018, 0.016, mgZ - 0.06, mgZ - 0.32, 6), C.dark, [mgX, mgY, 0]);

  // 5.2 车首大灯与保护支架(三辆共有, 但 E2 没有大灯与警报器)
  if (!isJumbo) {
    bothSides((s) => {
      const hlX = s * 0.92;
      const hlY = sponsonY + 0.44;
      const hlZ = glacisZ(hlY);

      // 大灯本体(朝向车头 -Z)
      H.add(headlight(C, 0.075), null, [hlX, hlY, hlZ]);

      // 美军特有的金属管大灯防撞护罩(倒 U 形 + 倾斜后支撑管)
      const gW = 0.1;
      const gH = 0.22;
      H.add(rod([hlX - gW, hlY - 0.02, hlZ - 0.01], [hlX - gW, hlY + gH, hlZ - 0.02], 0.01, 4), C.steel);
      H.add(rod([hlX + gW, hlY - 0.02, hlZ - 0.01], [hlX + gW, hlY + gH, hlZ - 0.02], 0.01, 4), C.steel);
      H.add(rod([hlX - gW, hlY + gH, hlZ - 0.02], [hlX + gW, hlY + gH, hlZ - 0.02], 0.01, 4), C.steel);
      H.add(rod([hlX, hlY + gH, hlZ - 0.02], [hlX, hlY + 0.02, hlZ + 0.12], 0.01, 4), C.steel);
    });

    // 左前首上防空警报器(带防撞笼)
    const hornX = -0.7;
    const hornY = sponsonY + 0.48;
    const hornZ = glacisZ(hornY);
    H.add(cyl(0.05, 0.04, 0.07, 8), C.shade, [hornX, hornY, hornZ - 0.03], [43 * DEG, 0, 0]);
    H.add(rod([hornX - 0.06, hornY - 0.02, hornZ], [hornX - 0.06, hornY + 0.1, hornZ], 0.008, 4), C.steel);
    H.add(rod([hornX + 0.06, hornY - 0.02, hornZ], [hornX + 0.06, hornY + 0.1, hornZ], 0.008, 4), C.steel);
    H.add(rod([hornX - 0.06, hornY + 0.1, hornZ], [hornX + 0.06, hornY + 0.1, hornZ], 0.008, 4), C.steel);
  }

  // 5.3 首上左右大起吊环
  bothSides((s) => {
    const ringX = s * 1.05;
    const ringY = top - 0.08;
    const ringZ = glacisZ(ringY);
    H.add(revolve([[0.04, 0], [0.04, 0.025], [0.02, 0.025], [0.02, 0]], 'z', 8, { colors: [C.steel] }), null, [
      ringX,
      ringY,
      ringZ - 0.015,
    ]);
  });

  // 5.4 首上下部挂载备用履带板(左右各一组)
  for (const s of [-0.62, 0.0]) {
    const trackY = sponsonY + 0.14;
    const trackZ = glacisZ(trackY);
    H.add(spareLink(C, 0.42, 0.16), null, [s, trackY + 0.02, trackZ - 0.02], [-47 * DEG, 0, 0]);
  }

  // -------------------------------------------------------------------------
  // 6. 车顶部件: 座圈防弹护圈、舱盖潜望镜、发动机百叶窗、随车工具
  // -------------------------------------------------------------------------
  // 6.1 炮塔座圈防弹护圈(69 英寸座圈外围的防弹挡圈,高度 0.035 m,座圈内严格留空)
  const ringR = L.ring.r; // 0.8763 m
  H.add(
    revolve(
      [
        [ringR + 0.018, 0],
        [ringR + 0.052, 0],
        [ringR + 0.048, 0.035],
        [ringR + 0.018, 0.035],
      ],
      'y',
      16,
      { colors: [C.paint, C.shade] },
    ),
    null,
    [0, top, L.ring.z],
  );

  // 6.2 驾驶员(左)与副驾驶(右)大圆舱门与潜望镜
  const hatchZ = -1.45;
  bothSides((s) => {
    const hx = s * 0.52;
    // 基础圆舱盖
    H.add(roundHatch(C, 0.25), null, [hx, top, hatchZ]);
    // 舱盖上的可旋转潜望镜(朝前方略偏外)
    H.add(periscope(C, 0.14, 0.08, 0.11), null, [hx + s * 0.02, top + 0.045, hatchZ - 0.05], [0, s * -15 * DEG, 0]);
    // 潜望镜装甲保护管架
    H.add(rod([hx - 0.09, top + 0.05, hatchZ - 0.12], [hx - 0.09, top + 0.14, hatchZ - 0.12], 0.008, 4), C.steel);
    H.add(rod([hx + 0.09, top + 0.05, hatchZ - 0.12], [hx + 0.09, top + 0.14, hatchZ - 0.12], 0.008, 4), C.steel);
    H.add(rod([hx - 0.09, top + 0.14, hatchZ - 0.12], [hx + 0.09, top + 0.14, hatchZ - 0.12], 0.008, 4), C.steel);
  });

  // 6.3 发动机舱顶盖与散热格栅(位于座圈后方, Ford GAA V8)
  // 左右各一大块发动机散热百叶窗格栅
  const grilleZ = 1.62;
  const grilleW = 0.68;
  const grilleL = 0.94;
  bothSides((s) => {
    H.add(grille(C, grilleW, grilleL, 6, C.shade), null, [s * 0.54, top, grilleZ]);
  });
  // 发动机盖板中央纵向铰链脊条
  H.add(box(0.06, 0.035, grilleL + 0.12), C.shade, [0, top + 0.0175, grilleZ]);

  // 后部发动机检修板与扣锁
  const rearDeckHatchZ = 2.48;
  H.add(box(1.48, 0.025, 0.58), C.paint, [0, top + 0.0125, rearDeckHatchZ]);
  H.add(box(1.36, 0.01, 0.48), C.shade, [0, top + 0.025, rearDeckHatchZ]);
  // 铰链细节
  for (const hx of [-0.5, 0.5]) {
    H.add(box(0.08, 0.035, 0.06), C.deep, [hx, top + 0.03, rearDeckHatchZ + 0.28]);
  }

  // 4 个圆形加油口带防护槽
  const capCoords: Tuple3[] = [
    [-0.88, top + 0.02, 1.12],
    [0.88, top + 0.02, 1.12],
    [-0.88, top + 0.02, 2.52],
    [0.88, top + 0.02, 2.52],
  ];
  for (const pos of capCoords) {
    H.add(revolve([[0.055, 0], [0.055, 0.025], [0.04, 0.035]], 'y', 8, { colors: [C.shade] }), null, pos);
  }

  // 6.4 随车工具(铁锹、斧子、大锤、撬棍)
  // 右侧车顶随车铁锹
  H.add(shovel(C, 0.96), null, [0.96, top + 0.02, 1.68], [0, 5 * DEG, 0]);
  // 左侧车顶随车斧头
  H.add(axe(C, 0.8), null, [-0.96, top + 0.02, 1.62], [0, -5 * DEG, 0]);
  // 左侧随车大锤
  H.add(axe(C, 0.85, true), null, [-0.96, top + 0.02, 2.42], [0, -5 * DEG, 0]);
  // 撬棍
  H.add(rod([0.96, top + 0.02, 2.15], [0.96, top + 0.02, 2.75], 0.018, 5), C.steel);

  // -------------------------------------------------------------------------
  // 7. 车尾部件: 双扇检修门、排气导流板、后拖车钩、尾灯、后起吊环
  // -------------------------------------------------------------------------
  // 7.1 M4A3 车尾下部双扇发动机检修门
  const doorZ = rearZ - rearLean - 0.02;
  const doorY = ground + 0.68;
  bothSides((s) => {
    const doorX = s * 0.36;
    H.add(box(0.58, 0.38, 0.03), C.paint, [doorX, doorY, doorZ]);
    H.add(box(0.5, 0.3, 0.015), C.shade, [doorX, doorY, doorZ + 0.015]);
    // 门铰链
    H.add(box(0.04, 0.08, 0.05), C.deep, [doorX + s * 0.26, doorY + 0.12, doorZ + 0.01]);
    H.add(box(0.04, 0.08, 0.05), C.deep, [doorX + s * 0.26, doorY - 0.12, doorZ + 0.01]);
  });
  // 门中心 T 形锁止把手
  H.add(box(0.08, 0.03, 0.04), C.steel, [0, doorY, doorZ + 0.025]);

  // 7.2 M4A3 特有的排气导流板(百叶箱,引导废气斜向地面避免扬尘)
  const deflY = ground + 0.38;
  const deflZ = rearZ - rearLean - 0.01;
  H.add(box(1.16, 0.18, 0.15), C.shade, [0, deflY, deflZ], [18 * DEG, 0, 0]);
  // 导流板横向百叶片
  for (let k = 0; k < 3; k++) {
    H.add(box(1.12, 0.02, 0.16), C.deep, [0, deflY - 0.05 + k * 0.05, deflZ], [25 * DEG, 0, 0]);
  }

  // 7.3 后拖车钩(重型挂钩)
  const pintleY = ground + 0.46;
  const pintleZ = rearZ - rearLean + 0.04;
  H.add(box(0.12, 0.14, 0.12), C.deep, [0, pintleY, pintleZ]);
  H.add(revolve([[0.04, -0.06], [0.04, 0.06]], 'x', 6, { colors: [C.steel] }), null, [0, pintleY + 0.04, pintleZ + 0.05]);

  // 7.4 两侧尾灯
  bothSides((s) => {
    const tlX = s * (curUpperW - 0.12);
    const tlY = sponsonY + 0.08;
    const tlZ = rearZ - 0.04;
    // 尾灯装甲护罩
    H.add(box(0.07, 0.1, 0.06), C.shade, [tlX, tlY, tlZ]);
    // 左红灯、右黑色防空灯
    const lensCol = s === -1 ? 0xb01a1a : C.dark;
    H.add(cyl(0.025, 0.025, 0.02, 6), lensCol, [tlX, tlY, tlZ + 0.032], [90 * DEG, 0, 0]);

    // 7.5 车尾上沿起吊环
    const rRingX = s * (curUpperW - 0.16);
    const rRingY = top - 0.06;
    H.add(revolve([[0.035, 0], [0.035, 0.025], [0.018, 0.025], [0.018, 0]], 'z', 8, { colors: [C.steel] }), null, [
      rRingX,
      rRingY,
      rearZ - 0.01,
    ]);
  });
}
