import type { MapSpec, ObstacleSpec } from '../types';

/**
 * 港口城镇 (Harbor Town)
 * 1500 m × 1500 m,正方形,中心在 [0, 0]。
 * 采样网格间距 cellSize = 10 m,高度网格采样点 151 × 151。
 * 地表字符网格 150 × 150,每格对应地面 10 m × 10 m。
 *
 * 布局:
 * - 北侧:开阔城镇入口与郊野缓坡,玩家在 [0, -420] 出生,车头朝南 (+Z) 俯瞰主干道。
 * - 中部:工商业街区与仓库群,由南北主干道 (x = 0) 和多条东西横街构成直角路网 (宽度 ≥ 14 m)。
 * - 东部:铁路走廊 (x ≈ 220) 与大型集装箱货运堆场,提供长达 120 m 的集装箱狭道巡逻路线。
 * - 南侧:港口码头与浅水港湾 (z ≥ 400),水面在 -0.5 m,水深约 1.0 m,可慢速涉水渡过。
 * - 障碍物共 155 个 (厂房/仓库、办公楼、2~3层集装箱堆、低矮围墙、龙门吊塔基等),严格控制在 300 个以内。
 */

// 辅助函数:生成 2~3 层标准集装箱堆 (每个集装箱 6 × 2.6 × 2.4 m)
function containerStack(x: number, z: number, tiers: 2 | 3, rot = 0): ObstacleSpec {
  return {
    position: [x, z],
    size: [6, tiers * 2.4, 2.6],
    rotationY: rot,
  };
}

// 辅助函数:生成沿 X 方向或 Z 方向的集装箱列
function containerRow(startX: number, startZ: number, count: number, stepZ: number, tiersPattern: (2 | 3)[]): ObstacleSpec[] {
  const list: ObstacleSpec[] = [];
  for (let i = 0; i < count; i++) {
    const tiers = tiersPattern[i % tiersPattern.length];
    list.push(containerStack(startX, startZ + i * stepZ, tiers));
  }
  return list;
}

// 障碍物列表
const OBSTACLES: ObstacleSpec[] = [
  // --- 办公与行政楼群 (高 16~24 m)
  { position: [-60, -170], size: [24, 20, 22], rotationY: 0 }, // 市政/邮政大楼
  { position: [-60, -30], size: [26, 24, 24], rotationY: 0 },  // 港务监督局大楼
  { position: [55, -170], size: [24, 18, 20], rotationY: 0 },  // 海关与检验局
  { position: [55, -30], size: [22, 16, 22], rotationY: 0 },   // 航运交易所
  { position: [-60, 110], size: [20, 18, 20], rotationY: 0 },  // 港区物流调度中心

  // --- 大型工业厂房与仓库 (宽 20~60 m, 高 8~14 m)
  { position: [-180, -170], size: [48, 10, 24], rotationY: 0 }, // 北部 1 号货栈
  { position: [165, -170], size: [50, 12, 30], rotationY: 0 },  // 北部重型机械修配厂
  { position: [-180, -30], size: [44, 11, 26], rotationY: 0 },  // 综合货运仓储库
  { position: [165, -30], size: [46, 10, 24], rotationY: 0 },   // 铁路转运库
  { position: [-180, 110], size: [54, 13, 30], rotationY: 0 },  // 船厂配件制造车间
  { position: [55, 110], size: [42, 12, 28], rotationY: 0 },    // 港口冷链冷库
  { position: [-180, 250], size: [48, 11, 28], rotationY: 0 },  // 码头 1 号转运库
  { position: [-80, 260], size: [30, 10, 22], rotationY: 0 },   // 码头 2 号保税库
  { position: [55, 250], size: [44, 10, 24], rotationY: 0 },    // 码头散货中转站
  { position: [165, 250], size: [50, 12, 30], rotationY: 0 },   // 粮油与干散货码头站

  // --- 中小型车间与维修棚
  { position: [-90, -210], size: [28, 8, 16], rotationY: 0 },
  { position: [-150, -210], size: [24, 8, 16], rotationY: 0 },
  { position: [80, -210], size: [24, 9, 18], rotationY: 0 },
  { position: [-90, 10], size: [26, 8, 16], rotationY: 0 },
  { position: [-90, 70], size: [24, 9, 18], rotationY: 0 },
  { position: [80, 70], size: [22, 8, 16], rotationY: 0 },
  { position: [-145, 290], size: [26, 8, 16], rotationY: 0 },
  { position: [80, 290], size: [24, 8, 16], rotationY: 0 },

  // --- 港口油罐与龙门起重机塔基
  { position: [-210, 20], size: [14, 9, 14], rotationY: 0 },
  { position: [-210, 45], size: [14, 9, 14], rotationY: 0 },
  { position: [-150, 20], size: [12, 8, 12], rotationY: 0 },
  { position: [-150, 45], size: [12, 8, 12], rotationY: 0 },
  { position: [-180, 350], size: [8, 18, 8], rotationY: 0 },
  { position: [-70, 350], size: [8, 18, 8], rotationY: 0 },
  { position: [70, 350], size: [8, 18, 8], rotationY: 0 },
  { position: [180, 350], size: [8, 18, 8], rotationY: 0 },

  // --- 低矮围墙 (高 1.6 m, 车体掩体)
  { position: [-200, -230], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [-170, -230], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [-140, -230], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [140, -230], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [170, -230], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [200, -230], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [-220, 60], size: [0.8, 1.6, 20], rotationY: 0 },
  { position: [-220, 90], size: [0.8, 1.6, 20], rotationY: 0 },
  { position: [-220, 140], size: [0.8, 1.6, 20], rotationY: 0 },
  { position: [-220, 170], size: [0.8, 1.6, 20], rotationY: 0 },
  { position: [-195, 170], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [-165, 170], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [35, 50], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [65, 50], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [35, 170], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [65, 170], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [135, 50], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [165, 50], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [195, 50], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [135, 170], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [165, 170], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [195, 170], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [-105, 310], size: [20, 1.6, 0.8], rotationY: 0 },
  { position: [-15, 310], size: [12, 1.6, 0.8], rotationY: 0 },

  // --- 东部集装箱货运堆场 (6 列,共 60 堆)
  // 留出 x = 180 处宽 21 m 的铁路巡逻走廊 (Row D 右边界 171, Row E 左边界 192)
  ...containerRow(135, 65, 10, 10, [2, 3, 2, 2, 3, 3, 2, 3, 2, 3]),
  ...containerRow(145, 65, 10, 10, [3, 2, 3, 3, 2, 2, 3, 2, 3, 2]),
  ...containerRow(160, 65, 10, 10, [2, 2, 3, 2, 3, 2, 3, 3, 2, 3]),
  ...containerRow(168, 65, 10, 10, [3, 3, 2, 3, 2, 3, 2, 2, 3, 2]),
  ...containerRow(195, 65, 10, 10, [2, 3, 2, 3, 2, 2, 3, 3, 2, 3]),
  ...containerRow(205, 65, 10, 10, [3, 2, 3, 2, 3, 3, 2, 2, 3, 2]),

  // --- 港口东翼转运集装箱堆 (12 堆)
  ...containerRow(145, 205, 3, 10, [2, 3, 2]),
  ...containerRow(155, 205, 3, 10, [3, 2, 3]),
  ...containerRow(175, 205, 3, 10, [2, 3, 3]),
  ...containerRow(195, 205, 3, 10, [3, 2, 2]),

  // --- 港口西翼转运集装箱堆 (12 堆)
  ...containerRow(-205, 205, 3, 10, [2, 2, 3]),
  ...containerRow(-195, 205, 3, 10, [3, 3, 2]),
  ...containerRow(-165, 205, 3, 10, [2, 3, 2]),
  ...containerRow(-155, 205, 3, 10, [3, 2, 3]),

  // --- 西部编组站与工业支线集装箱堆 (8 堆)
  ...containerRow(-200, -130, 2, 10, [2, 3]),
  ...containerRow(-190, -130, 2, 10, [3, 2]),
  ...containerRow(-160, -130, 2, 10, [2, 2]),
  ...containerRow(-150, -130, 2, 10, [3, 3]),

  // --- 东部编组线集装箱堆 (8 堆)
  ...containerRow(150, -130, 2, 10, [2, 3]),
  ...containerRow(160, -130, 2, 10, [3, 2]),
  ...containerRow(180, -130, 2, 10, [2, 3]),
  ...containerRow(190, -130, 2, 10, [3, 2]),
];

// 地表网格构建:150 行 × 150 列
// 每格代表 10 m × 10 m, 第一行在最北端 (z = -750), 最后一行在最南端 (z = +750)。
// '.' = grass, ',' = dirt, 'r' = rock (硬质路面), 's' = sand (沙滩水岸)
function createSurfaceRows(): string[] {
  const rows: string[] = [];

  for (let iz = 0; iz < 150; iz++) {
    const chars: string[] = new Array(150).fill('.');

    // 北部丘陵与西北缓坡 (自然土地/岩石地表)
    if (iz < 25) {
      for (let ix = 120; ix < 145; ix++) chars[ix] = 'r';
      for (let ix = 15; ix < 35; ix++) chars[ix] = ',';
    }

    // 铁路走廊:从北部 iz = 20 一直延伸至码头区 iz = 107 (x = 220 对应 ix = 97)
    if (iz >= 20 && iz <= 107) {
      chars[97] = ',';
    }

    // 主干道:南北大道,从 iz = 25 延伸至码头区 iz = 107 (x = 0 对应 ix = 75)
    if (iz >= 25 && iz <= 107) {
      chars[75] = 'r';
    }

    // 城镇路网区间 (iz: 51 ~ 107)
    if (iz >= 51 && iz <= 107) {
      // 东西横街整行铺设路面 (从 ix = 45 到 ix = 105)
      // 1st St (iz = 51), 2nd St (iz = 65), 3rd St (iz = 79), 4th St (iz = 93), 滨海大道 (iz = 107)
      if (iz === 51 || iz === 65 || iz === 79 || iz === 93 || iz === 107) {
        for (let ix = 45; ix <= 105; ix++) {
          chars[ix] = 'r';
        }
      } else {
        // 南北向次干道
        chars[51] = 'r'; // 西外环路 (x = -240)
        chars[63] = 'r'; // 西内环路 (x = -120)
        chars[86] = 'r'; // 东内环路 (x = 110)
      }

      // 东部集装箱堆场泥地地表 (iz: 85 ~ 106, ix: 88 ~ 96)
      if (iz >= 85 && iz <= 106) {
        for (let ix = 88; ix <= 96; ix++) {
          chars[ix] = ',';
        }
      }

      // 工业区与街区内部空地铺设碎石/土地
      for (let ix = 52; ix <= 62; ix += 3) chars[ix] = ',';
      for (let ix = 66; ix <= 74; ix += 2) chars[ix] = ',';
    }

    // 港口水岸过渡带 (iz: 108 ~ 116)
    if (iz >= 108 && iz <= 116) {
      for (let ix = 0; ix < 150; ix++) {
        chars[ix] = iz >= 113 ? 's' : ',';
      }
      // 码头堤道延伸
      if (iz <= 112) {
        chars[75] = 'r';
        chars[51] = 'r';
        chars[97] = ',';
      }
    }

    // 南侧港湾水域 (iz: 117 ~ 149)
    if (iz >= 117) {
      for (let ix = 0; ix < 150; ix++) {
        chars[ix] = 's';
      }
    }

    rows.push(chars.join(''));
  }

  return rows;
}

const HARBOR_TOWN_SURFACE_ROWS = createSurfaceRows();

/**
 * 港口城镇 MapSpec
 */
export const HARBOR_TOWN: MapSpec = {
  id: 'harbor_town',
  name: '港口城镇',
  size: 1500,
  terrain: {
    cellSize: 10,
    base: 2.0,
    features: [
      // --- 南部港湾水系:宽谷下切 3.0 m,使 z ≥ 420 区域高度降至 -1.0 m (浅水涉水区,水深 1.0 m)
      {
        kind: 'valley',
        path: [
          [-800, 580],
          [800, 580],
        ],
        width: 320,
        depth: 3.0,
        bank: 40,
        surface: 'mud',
      },
      // --- 东北部山峦与缓丘 (岩石地表,提供远景遮挡与火力制高点)
      { kind: 'hill', at: [520, -480], radius: 200, height: 14, surface: 'rock' },
      { kind: 'hill', at: [620, -320], radius: 150, height: 10, surface: 'rock' },
      // --- 西北部缓坡
      { kind: 'hill', at: [-500, -520], radius: 180, height: 8, surface: 'dirt' },
      // --- 东侧外围防风路堤
      {
        kind: 'ridge',
        path: [
          [400, -200],
          [550, 100],
        ],
        width: 80,
        height: 5,
        surface: 'dirt',
      },
    ],
  },
  surface: {
    legend: {
      '.': 'grass',
      ',': 'dirt',
      r: 'rock',
      s: 'sand',
    },
    rows: HARBOR_TOWN_SURFACE_ROWS,
  },
  waterLevel: 0.0,
  obstacles: OBSTACLES,
  vegetation: {
    zones: [
      // 城镇外围入口街旁行道树与灌木 (零星树丛,不遮挡视野长廊)
      { kind: 'tree', at: [35, -360], radius: 22, density: 35, seed: 6201 },
      { kind: 'bush', at: [-35, -360], radius: 20, density: 40, seed: 6202 },
      { kind: 'tree', at: [120, -320], radius: 25, density: 30, seed: 6203 },
      { kind: 'bush', at: [-140, -310], radius: 25, density: 35, seed: 6204 },
      // 东北缓丘旁的零星松树
      { kind: 'pine', at: [460, -420], radius: 45, density: 25, seed: 6205 },
      // 街区空地内的零星灌木点缀
      { kind: 'bush', at: [-110, -60], radius: 15, density: 20, seed: 6206 },
      { kind: 'bush', at: [25, 10], radius: 12, density: 25, seed: 6207 },
      { kind: 'bush', at: [-30, 180], radius: 14, density: 25, seed: 6208 },
    ],
    grass: { density: 4, seed: 6210 },
    clearRadius: 12,
  },
  spawns: {
    // 玩家:出生在城镇北端开阔大道入口,车头朝南 (+Z, heading = 180) 正对城镇主干道
    player: {
      vehicleId: 'tiger_i',
      position: [0, -420],
      heading: 180,
    },
    targets: [
      // 1. 约 250 m:主干道北十字路口巡逻的 T-34-85,沿南北主干道巡逻
      {
        vehicleId: 't34_85',
        position: [0, -170],
        heading: 0,
        patrol: { to: [0, -50], speed: 12 },
        ammoFraction: 0.8,
      },
      // 2. 约 367 m:2 号横街 (东西向) 巡逻的 T-34-85,侧面正对主干道
      {
        vehicleId: 't34_85',
        position: [-180, -100],
        heading: 90,
        patrol: { to: [-40, -100], speed: 14 },
        ammoFraction: 0.8,
      },
      // 3. 约 494 m:东部集装箱货运站铁道线巡逻的 T-34-85
      {
        vehicleId: 't34_85',
        position: [180, 40],
        heading: 180,
        patrol: { to: [180, 160], speed: 12 },
        ammoFraction: 0.8,
      },
      // 4. 约 534 m:西侧仓库街区拐角伏击的虎王,正面对准拐角出入口
      {
        vehicleId: 'tiger_ii',
        position: [-120, 100],
        heading: 45,
        ammoFraction: 1.0,
      },
      // 5. 约 661 m:码头转运货栈西侧警戒的 SU-100 坦克歼击车
      {
        vehicleId: 'su_100',
        position: [-30, 240],
        heading: 30,
        ammoFraction: 0.9,
      },
      // 6. 约 741 m:滨海码头大道主干道防线前沿的虎王
      {
        vehicleId: 'tiger_ii',
        position: [40, 320],
        heading: 0,
        ammoFraction: 1.0,
      },
    ],
  },
};
