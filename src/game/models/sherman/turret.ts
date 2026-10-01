import { DEG, GeoBatch, bothSides, box, cyl, extrude, loft, revolve, tube, type Palette, type Tuple3, type Vec2 } from '../kit';
import { periscope, roundHatch } from '../parts';
import type { ShermanLayout } from './layout';

/**
 * 谢尔曼 M4A3 系列炮塔与火炮:
 *   - M4A3(76)W: T23 铸造炮塔, M62 炮架, 76 mm M1A1(炮口无制退器, 带螺纹保护帽)
 *   - M4A3E8: T23 铸造炮塔, M62 炮架, 76 mm M1A2(单室制退器)
 *   - M4A3E2 Jumbo: 加厚炮塔(侧壁 152 mm、6° 倾角), T110 炮架(厚 178 mm), 75 mm M3(短粗, 无制退器)
 *
 * 坐标说明:
 *   T (turretPivot): 原点在车顶座圈中心 (0, L.hh, L.ring.z), y=0 为车体顶板, 炮塔从 y=0 往上建;
 *   G (gunPivot): 原点在炮耳轴 (0, trunnionY, trunnionZ), 炮管沿 -Z 伸出 barrelLength 到炮口, 绕 X 俯仰。
 *   炮盾随火炮俯仰, 固连在 G 上。
 */
export function buildShermanTurret(L: ShermanLayout, T: GeoBatch, G: GeoBatch, C: Palette): void {
  const isJumbo = L.variant.turret === 'jumbo';
  const th = L.turretBox.height; // 0.72

  // =========================================================================
  // 1. 炮塔主体 (T)
  // =========================================================================
  buildTurretBody(L, T, C, isJumbo, th);

  // =========================================================================
  // 2. 炮塔顶部设备 (T)
  // =========================================================================
  buildTurretRoofFittings(T, C, isJumbo, th);

  // =========================================================================
  // 3. 火炮与炮盾 (G)
  // =========================================================================
  buildGunAndMantlet(L, G, C, isJumbo);
}

/**
 * 炮塔铸造壳体放样 (5 层轮廓, 每层 16 个顶点对称凸多边形):
 * 底层 y=0 严格包覆座圈 (半径 L.ring.r = 0.8763 m), 尾舱在 y=0.12 处向后伸出形成下切悬垂。
 */
function buildTurretBody(L: ShermanLayout, T: GeoBatch, C: Palette, isJumbo: boolean, th: number): void {
  // [y, zFront, zRear, halfWidth, zMid, flankRatio, rearRatio]
  type LayerSpec = readonly [number, number, number, number, number, number, number];

  const t23Layers: readonly LayerSpec[] = [
    // Layer 0: y=0 底座, 完整覆盖 69 in 座圈 (r=0.8763), 最窄半径 > 0.91 m
    [0.0, -1.10, 0.94, 0.98, -0.05, 0.97, 0.68],
    // Layer 1: y=0.12 尾舱悬垂下沿伸出至 z=1.22
    [0.12, -1.22, 1.22, 1.08, 0.05, 0.96, 0.78],
    // Layer 2: y=0.36 炮耳轴高度
    [0.36, -1.24, 1.24, 1.06, 0.05, 0.94, 0.76],
    // Layer 3: y=0.58 上肩部
    [0.58, -1.18, 1.20, 0.98, 0.05, 0.92, 0.72],
    // Layer 4: y=0.72 顶盖 (侧壁内倾约 13°)
    [th, -1.10, 1.15, 0.92, 0.05, 0.88, 0.68],
  ];

  const jumboLayers: readonly LayerSpec[] = [
    // Jumbo 加厚型: 侧壁 152 mm, 侧面更平直 (倾角约 6°), 炮塔更方、更宽 (hw=1.17)
    [0.0, -1.12, 0.96, 1.02, -0.05, 0.98, 0.72],
    [0.12, -1.24, 1.24, 1.17, 0.05, 0.98, 0.85],
    [0.36, -1.25, 1.25, 1.16, 0.05, 0.97, 0.84],
    [0.58, -1.20, 1.22, 1.13, 0.05, 0.95, 0.82],
    [th, -1.12, 1.18, 1.09, 0.05, 0.93, 0.80],
  ];

  const layers = isJumbo ? jumboLayers : t23Layers;
  const rings = layers.map(([y, zF, zR, hw, zMid, flankRatio, rearRatio]) =>
    generateRingPts(y, zF, zR, hw, zMid, flankRatio, rearRatio),
  );

  T.add(loft(rings, { colors: [C.paint] }), null);

  // 座圈挡弹环 / 铸造加强圈 (紧贴底面, 盖住座圈缝隙)
  const collarR = L.ring.r + 0.035;
  T.add(
    revolve(
      [
        [collarR, 0],
        [collarR, 0.05],
        [collarR - 0.02, 0.07],
      ],
      'y',
      16,
      { colors: [C.shade], startCap: null },
    ),
    null,
    [0, 0, 0],
  );
}

/** 生成 16 顶点对称严格凸截面 */
function generateRingPts(
  y: number,
  zF: number,
  zR: number,
  hw: number,
  zMid: number,
  flankRatio: number,
  rearRatio: number,
): Tuple3[] {
  const fSpan = zMid - zF;
  const rSpan = zR - zMid;

  // 右半侧 8 个点 + 尾中心 1 个点
  const half: Array<[number, number]> = [
    [0, zF], // 0: 前中心
    [hw * 0.36, zF + fSpan * 0.16], // 1
    [hw * 0.70, zF + fSpan * 0.46], // 2
    [hw * 0.91, zF + fSpan * 0.78], // 3
    [hw, zMid], // 4: 最宽处 (炮耳轴前后)
    [hw * flankRatio, zMid + rSpan * 0.35], // 5
    [hw * ((flankRatio + rearRatio) * 0.5), zMid + rSpan * 0.70], // 6
    [hw * rearRatio, zR - rSpan * 0.08], // 7: 尾舱后角
    [0, zR], // 8: 尾中心
  ];

  const pts: Tuple3[] = [];
  // 顺时针添加右半侧
  for (let i = 0; i < 9; i++) {
    pts.push([half[i][0], y, half[i][1]]);
  }
  // 镜像添加左半侧 (7 倒回到 1)
  for (let i = 7; i >= 1; i--) {
    pts.push([-half[i][0], y, half[i][1]]);
  }

  return pts;
}

/**
 * 炮塔顶盖部件:
 *   - 车长全向指挥塔 (右后, 带 6 具观察窗 + 舱盖)
 *   - 装填手椭圆舱盖 (左侧, 带铰链与把手)
 *   - 炮手潜望镜 (右前)、装填手潜望镜 (左前)
 *   - 穹顶通风罩 (中部偏后)
 *   - 起吊环 (前左、前右、后中央)
 *   - 行军锁固定的 .50 M2 重机枪 (平放横置于尾舱后沿)
 */
function buildTurretRoofFittings(T: GeoBatch, C: Palette, isJumbo: boolean, th: number): void {
  // --- 车长指挥塔 (右后: x > 0, z > 0)
  const cupolaX = isJumbo ? 0.50 : 0.46;
  const cupolaZ = 0.40;
  const cupolaR = 0.32;
  T.add(
    revolve(
      [
        [cupolaR + 0.02, th - 0.03],
        [cupolaR + 0.02, th + 0.08],
        [cupolaR - 0.03, th + 0.13],
        [cupolaR - 0.06, th + 0.16],
      ],
      'y',
      12,
      { colors: [C.paint, C.shade, C.paint] },
    ),
    null,
    [cupolaX, 0, cupolaZ],
  );
  // 6 具直接观察窗
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    T.add(
      box(0.09, 0.04, 0.04),
      C.dark,
      [cupolaX + 0.305 * Math.cos(a), th + 0.06, cupolaZ + 0.305 * Math.sin(a)],
      [0, Math.PI / 2 - a, 0],
    );
  }
  T.add(roundHatch(C, 0.23, 0.03), null, [cupolaX, th + 0.16, cupolaZ]);

  // --- 装填手椭圆舱盖 (左侧: x < 0)
  const hatchX = isJumbo ? -0.52 : -0.46;
  const hatchZ = 0.22;
  const ovalA = 0.20; // 宽 (X)
  const ovalB = 0.26; // 长 (Z)
  const ovalPts: Vec2[] = [];
  for (let k = 0; k < 12; k++) {
    const t = (k / 12) * Math.PI * 2;
    ovalPts.push([ovalA * Math.cos(t), ovalB * Math.sin(t)]);
  }
  T.add(extrude(ovalPts, 'y', th, th + 0.035), C.paint, [hatchX, 0, hatchZ]);
  T.add(box(0.14, 0.035, 0.06), C.shade, [hatchX, th + 0.02, hatchZ + ovalB + 0.02]);
  T.add(box(0.12, 0.02, 0.02), C.steel, [hatchX, th + 0.045, hatchZ - ovalB * 0.4]);

  // --- 炮手潜望镜 (右前) & 装填手潜望镜 (左前)
  T.add(periscope(C, 0.12, 0.07, 0.10), null, [isJumbo ? 0.46 : 0.42, th, -0.46]);
  T.add(periscope(C, 0.12, 0.07, 0.10), null, [isJumbo ? -0.48 : -0.44, th, -0.30]);

  // --- 穹顶通风罩 (中部偏后)
  T.add(
    revolve(
      [
        [0.13, th],
        [0.13, th + 0.025],
        [0.10, th + 0.055],
        [0.03, th + 0.065],
      ],
      'y',
      10,
      { colors: [C.shade] },
    ),
    null,
    [-0.05, 0, 0.38],
  );

  // --- 3 处起吊耳板 (前左、前右、尾后)
  const liftY = 0.58;
  const frontLiftX = isJumbo ? 0.95 : 0.86;
  const frontLiftZ = -0.72;
  const lug = (pos: Tuple3, rotY: number) => {
    T.add(box(0.04, 0.09, 0.08), C.shade, pos, [0, rotY, 0]);
    T.add(cyl(0.022, 0.022, 0.045, 6).rotateZ(Math.PI / 2), C.dark, pos, [0, rotY, 0]);
  };
  lug([frontLiftX, liftY, frontLiftZ], 25 * DEG);
  lug([-frontLiftX, liftY, frontLiftZ], -25 * DEG);
  lug([0, liftY + 0.02, isJumbo ? 1.22 : 1.18], 0);

  // --- 行军状态 .50 M2 重机枪 (平放横置于尾舱后沿, 不翘起)
  buildStowedM2(T, C, th, isJumbo);
}

/** 行军锁固定的 M2HB 重机枪 (横放平置) */
function buildStowedM2(T: GeoBatch, C: Palette, th: number, isJumbo: boolean): void {
  const z = isJumbo ? 1.05 : 1.00;
  const y = th + 0.03;
  // 行军支架
  T.add(box(0.08, 0.05, 0.07), C.steel, [0.08, y + 0.015, z]);
  // 机匣 (沿 X 方向横向放置, 枪口朝左)
  T.add(box(0.30, 0.065, 0.065), C.dark, [-0.07, y + 0.05, z]);
  // 散热套筒与枪管 (向左延伸)
  T.add(cyl(0.022, 0.022, 0.16, 6).rotateZ(Math.PI / 2), C.steel, [-0.27, y + 0.05, z]);
  T.add(cyl(0.015, 0.015, 0.25, 6).rotateZ(Math.PI / 2), C.dark, [-0.44, y + 0.05, z]);
  // 弹箱托架
  T.add(box(0.06, 0.05, 0.08), C.shade, [0.02, y + 0.04, z - 0.07]);
}

/**
 * 炮盾与火炮 (挂在 G 节点, 原点在炮耳轴 (0, 0, 0)):
 *   - 炮盾: 宽大铸造防盾 (T23 为 M62 炮架, Jumbo 为加厚 T110 炮架)
 *   - 俯仰范围内 (-12°..+25° / -10°..+25°) 炮盾顶点与车顶、炮塔顶无穿插, 背面始终在炮塔前脸以内
 *   - 炮管末端严格位于 z = -L.barrelLength
 */
function buildGunAndMantlet(L: ShermanLayout, G: GeoBatch, C: Palette, isJumbo: boolean): void {
  const gun = L.variant.gun;
  const barrelLen = L.barrelLength;

  // -------------------------------------------------------------------------
  // A. 炮盾 (Mantlet)
  // -------------------------------------------------------------------------
  // 尺寸设定:
  // T23: 宽 0.96 (半宽 0.48), 正面高度 0.44 (半高 0.22), 前凸 -0.22, 后延 +0.18
  // Jumbo: 宽 1.16 (半宽 0.58), 正面高度 0.48 (半高 0.24), 前凸 -0.26 (178 mm 厚防盾), 后延 +0.18
  const halfW = isJumbo ? 0.58 : 0.48;
  const innerW = isJumbo ? 0.32 : 0.26;
  const yTop = isJumbo ? 0.24 : 0.22;
  const yBot = -yTop;
  const zFrontCenter = isJumbo ? -0.26 : -0.22;
  const zFrontEdge = isJumbo ? -0.20 : -0.16;
  const zRear = 0.18;

  // 4 个剖面放样: 两端外缘略微倒角收窄, 中部凸起, 后部平整伸入炮塔开口
  const mantletSlice = (x: number, zFront: number, topY: number, botY: number): Tuple3[] => [
    [x, topY, -0.15], // 0: 上前唇
    [x, 0, zFront], // 1: 正面中央
    [x, botY, -0.15], // 2: 下前唇
    [x, botY * 0.9, zRear], // 3: 下后角
    [x, topY * 0.9, zRear], // 4: 上后角
  ];

  const outerYTop = yTop * 0.92;
  const outerYBot = yBot * 0.92;
  const mantletSlices: Tuple3[][] = [
    mantletSlice(-halfW, zFrontEdge, outerYTop, outerYBot),
    mantletSlice(-innerW, zFrontCenter, yTop, yBot),
    mantletSlice(innerW, zFrontCenter, yTop, yBot),
    mantletSlice(halfW, zFrontEdge, outerYTop, outerYBot),
  ];
  G.add(loft(mantletSlices, { colors: [C.paint] }), null);

  // 炮根铸造防盾套筒 / 保护罩
  const collarR1 = isJumbo ? 0.17 : 0.14;
  const collarR2 = isJumbo ? 0.13 : 0.11;
  const collarZ0 = isJumbo ? -0.20 : -0.16;
  const collarZ1 = isJumbo ? -0.50 : -0.45;
  G.add(
    revolve(
      [
        [collarR1, collarZ0],
        [collarR1, collarZ0 - 0.14],
        [collarR2, collarZ1],
      ],
      'z',
      10,
      { colors: [C.paint] },
    ),
    null,
  );

  // 同轴机枪孔 (右侧 +X)
  const mgX = isJumbo ? 0.26 : 0.22;
  const mgY = 0.02;
  G.add(tube(0.026, 0.022, -0.18, -0.34, 6), C.dark, [mgX, mgY, 0]);

  // 瞄准镜观察孔 (左侧 -X)
  const sightX = isJumbo ? -0.26 : -0.22;
  const sightY = 0.06;
  G.add(box(0.06, 0.06, 0.08), C.dark, [sightX, sightY, -0.21]);

  // -------------------------------------------------------------------------
  // B. 火炮与炮口装置
  // -------------------------------------------------------------------------
  const muzzleZ = -barrelLen;

  if (gun === 'm1a1') {
    // 76 mm M1A1 (M4A3(76)W): 细长 52 倍径, 炮口无制退器, 仅带螺纹保护帽
    G.add(
      revolve(
        [
          [0.082, -0.45],
          [0.066, -1.20],
          [0.052, muzzleZ + 0.09],
          [0.062, muzzleZ + 0.08],
          [0.062, muzzleZ],
        ],
        'z',
        8,
        { colors: [C.paint], endCap: C.dark },
      ),
      null,
    );
  } else if (gun === 'm1a2') {
    // 76 mm M1A2 (M4A3E8): 细长 52 倍径, 炮口带单室制退器
    const brakeLen = 0.30;
    const brakeR = 0.092;
    const barrelEnd = muzzleZ + brakeLen;

    // 身管部分
    G.add(
      revolve(
        [
          [0.082, -0.45],
          [0.066, -1.20],
          [0.052, barrelEnd],
        ],
        'z',
        8,
        { colors: [C.paint] },
      ),
      null,
    );

    // 单室圆柱形制退器
    G.add(
      revolve(
        [
          [0.056, barrelEnd],
          [brakeR, barrelEnd - 0.02],
          [brakeR, muzzleZ + 0.02],
          [brakeR * 0.85, muzzleZ],
        ],
        'z',
        8,
        { colors: [C.shade], endCap: C.dark },
      ),
      null,
    );

    // 两侧开槽侧排气孔
    bothSides((s) => {
      G.add(box(0.04, brakeR * 1.1, brakeLen * 0.52), C.dark, [s * (brakeR - 0.02), 0, muzzleZ + brakeLen * 0.5]);
    });
  } else {
    // 75 mm M3 (M4A3E2): 短粗 40 倍径, 炮口带加厚环圈, 无制退器
    G.add(
      revolve(
        [
          [0.092, -0.50],
          [0.078, -1.00],
          [0.064, muzzleZ + 0.09],
          [0.072, muzzleZ + 0.08],
          [0.072, muzzleZ],
        ],
        'z',
        8,
        { colors: [C.paint], endCap: C.dark },
      ),
      null,
    );
  }
}
