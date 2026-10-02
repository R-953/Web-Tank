import type { MapSpec, Vec2 } from '../types';

/**
 * 冰冻河道走向(西北 → 南西),贯穿地图西半部。
 * 河谷下切约 5 m,谷底平坦宽阔且无开放水面,表面为冰冻硬岩与砂石,坦克可沿谷底通行突击。
 */
const FROZEN_RIVER: Vec2[] = [
  [-550, -950],
  [-480, -500],
  [-380, -100],
  [-300, 200],
  [-350, 600],
  [-450, 950],
];

/**
 * 地表网格:20 × 20,每格 100 m。第一行是地图北边(z = -1000),最后一行是南边(z = +1000)。
 *
 * 注:当前地表系统尚未加入专属的「雪地」类型(详见 types.ts)。
 * 本图按约定用现有地表类型近似雪原环境:
 * - '.' (grass) 近似开阔雪原平原;
 * - ',' (dirt) 近似林间与被履带碾压露出的深色冻土;
 * - 'r' (rock) 近似冰冻河道硬面与裸岩;
 * - 's' (sand) 近似河滩与浅滩碎石。
 * 材质与着色器的纯白雪地效果留待未来地表系统扩展时统一接入。
 */
const SNOW_FOREST_SURFACE_ROWS = [
  'rrrr,,,,,,,,,,,,,,,,',
  'rrrr,,,,...........,',
  ',,rr,,,............,',
  ',,,rr,..............',
  ',,,,rr..............',
  '.....rr............,',
  '......rr.....,,,,,,,',
  '.......rr...,,,,,,,,',
  '.......rr..,,,,,,,,,',
  '........rr.,,,,,,,,,',
  '........rr..........',
  '.......rr...........',
  '......rr............',
  '......rr............',
  '.....rr............,',
  '....rr..............',
  '...rr.......,,,,,,,,',
  '...rr.......,,,,,,,,',
  '..rr........,,,,,,,,',
  '..rr................',
];

/**
 * 雪地森林地图:2000 m × 2000 m。
 * 偏开阔和遮蔽并存:开阔雪原、针叶林带、起伏缓丘与一条冰冻河谷,
 * 适合远距离对射与林缘伏击战术。
 */
export const SNOW_FOREST: MapSpec = {
  id: 'snow_forest',
  name: '雪地森林',
  size: 2000,
  terrain: {
    cellSize: 10,
    base: 0,
    features: [
      // --- 冰冻河谷:宽谷底平坦无水,硬石地表,两侧缓坡
      { kind: 'valley', path: FROZEN_RIVER, width: 45, depth: 5, bank: 25, surface: 'rock' },

      // --- 北部丘陵带(射击远景屏障与阵地高点)
      { kind: 'hill', at: [-600, -750], radius: 260, height: 26, surface: 'dirt' },
      { kind: 'hill', at: [0, -850], radius: 300, height: 30 },
      { kind: 'hill', at: [650, -700], radius: 280, height: 24 },

      // --- 中部与林间缓丘(提供车体半遮蔽与起伏射界)
      { kind: 'hill', at: [-140, -190], radius: 120, height: 8 },
      { kind: 'hill', at: [260, -50], radius: 140, height: 9 },
      { kind: 'hill', at: [-60, 390], radius: 100, height: 6 },
      { kind: 'hill', at: [300, 240], radius: 150, height: 10 },
      { kind: 'hill', at: [-180, 600], radius: 120, height: 7 },
      { kind: 'hill', at: [200, 680], radius: 130, height: 8 },

      // --- 边缘起伏地带
      { kind: 'hill', at: [600, 100], radius: 220, height: 16 },
      { kind: 'hill', at: [700, 550], radius: 200, height: 15 },
      { kind: 'hill', at: [-650, 450], radius: 200, height: 14 },

      // --- 防护土堤(ridge):起伏雪堤做射击掩体
      { kind: 'ridge', path: [[-80, 180], [60, 150], [180, 160]], width: 40, height: 3.5 },
      { kind: 'ridge', path: [[-120, 520], [0, 500], [120, 520]], width: 35, height: 3 },
      { kind: 'ridge', path: [[-220, -100], [-100, -80], [40, -90]], width: 40, height: 3.5 },
      { kind: 'ridge', path: [[180, 120], [320, 100]], width: 30, height: 2.8 },
    ],
  },
  surface: {
    legend: {
      '.': 'grass',
      ',': 'dirt',
      r: 'rock',
      s: 'sand',
    },
    rows: SNOW_FOREST_SURFACE_ROWS,
  },
  // 冰冻河道,无开放水体
  obstacles: [
    // --- 农舍聚落 A (东南部林缘农庄,靠近 2 号靶车巡逻区)
    { position: [260, 280], size: [14, 7, 10], rotationY: 15 },
    { position: [280, 250], size: [18, 8.5, 12], rotationY: -10 },
    { position: [250, 340], size: [12, 6.5, 9], rotationY: 25 },
    { position: [210, 210], size: [8, 1.2, 2.5], rotationY: 45 },
    { position: [290, 310], size: [5, 1.8, 4], rotationY: 0 },

    // --- 农舍聚落 B (北部废弃农舍与谷仓,在 4、5 号靶车之间偏东)
    { position: [80, -180], size: [16, 8, 12], rotationY: 30 },
    { position: [110, -220], size: [12, 6.5, 8], rotationY: -15 },
    { position: [50, -150], size: [6, 2, 4], rotationY: 60 },
    { position: [95, -130], size: [10, 1.4, 3], rotationY: -20 },

    // --- 农舍聚落 C (西部近河谷农舍,在 3 号靶车东北侧)
    { position: [-200, 210], size: [14, 7, 9], rotationY: -35 },
    { position: [-170, 240], size: [15, 7.5, 11], rotationY: 10 },
    { position: [-230, 180], size: [8, 1.2, 2.5], rotationY: 20 },

    // --- 南部林缘掩护(位于玩家出发侧前方两侧,留出中路开阔视界)
    { position: [-60, 580], size: [7, 1.3, 2.5], rotationY: 25 },
    { position: [70, 590], size: [5, 1.8, 3.5], rotationY: -15 },
    { position: [-180, 520], size: [5, 2, 4], rotationY: -20 },
    { position: [160, 480], size: [6, 1.5, 3], rotationY: 35 },

    // --- 中央雪原自然掩体(倒木与散落石堆)
    { position: [-50, 290], size: [6, 2, 4.5], rotationY: 40 },
    { position: [120, 220], size: [8, 1.3, 2.2], rotationY: -30 },
    { position: [-140, 40], size: [7, 1.8, 3.8], rotationY: 15 },
    { position: [30, 20], size: [9, 1.4, 2.6], rotationY: -50 },
    { position: [-80, -80], size: [5, 1.9, 4], rotationY: 10 },

    // --- 河谷两岸的冻石与倒木
    { position: [-380, 320], size: [6, 2.2, 5], rotationY: -45 },
    { position: [-280, -20], size: [8, 1.4, 2.5], rotationY: 15 },
    { position: [-420, -250], size: [7, 2, 4.2], rotationY: 70 },
  ],
  vegetation: {
    zones: [
      // --- 南部针叶林带(玩家出生点后方的林区,玩家在其林缘前沿出生)
      { kind: 'pine', polygon: [[-600, 720], [600, 720], [650, 880], [-650, 880]], density: 85, seed: 631 },
      { kind: 'tree', polygon: [[-600, 720], [600, 720], [650, 880], [-650, 880]], density: 20, seed: 632 },
      { kind: 'bush', polygon: [[-600, 720], [600, 720], [650, 880], [-650, 880]], density: 35, seed: 633 },

      // --- 西北部大针叶林区(河谷西岸密林)
      { kind: 'pine', polygon: [[-850, -850], [-450, -850], [-400, -350], [-550, -50], [-850, -50]], density: 75, seed: 641 },
      { kind: 'tree', polygon: [[-850, -850], [-450, -850], [-400, -350], [-550, -50], [-850, -50]], density: 18, seed: 642 },
      { kind: 'bush', polygon: [[-850, -850], [-450, -850], [-400, -350], [-550, -50], [-850, -50]], density: 25, seed: 643 },

      // --- 东北部深远针叶林
      { kind: 'pine', polygon: [[380, -850], [850, -850], [850, -250], [420, -250]], density: 80, seed: 651 },
      { kind: 'tree', polygon: [[380, -850], [850, -850], [850, -250], [420, -250]], density: 20, seed: 652 },
      { kind: 'bush', polygon: [[380, -850], [850, -850], [850, -250], [420, -250]], density: 30, seed: 653 },

      // --- 东侧森林边缘带(农舍东侧防护林)
      { kind: 'pine', polygon: [[380, 50], [750, 50], [750, 600], [400, 600]], density: 60, seed: 661 },
      { kind: 'tree', polygon: [[380, 50], [750, 50], [750, 600], [400, 600]], density: 20, seed: 662 },
      { kind: 'bush', polygon: [[380, 50], [750, 50], [750, 600], [400, 600]], density: 35, seed: 663 },

      // --- 西线隐蔽接近林带(河谷东侧丘陵林带,利于坦克借助树木与反斜面接近 1、3 号靶车)
      { kind: 'pine', polygon: [[-240, 240], [-130, 260], [-120, 500], [-230, 480]], density: 55, seed: 671 },
      { kind: 'bush', polygon: [[-240, 240], [-130, 260], [-120, 500], [-230, 480]], density: 45, seed: 672 },

      // --- 东线隐蔽接近林带(农舍西南侧小树林)
      { kind: 'pine', polygon: [[90, 320], [170, 300], [180, 520], [100, 540]], density: 50, seed: 681 },
      { kind: 'bush', polygon: [[90, 320], [170, 300], [180, 520], [100, 540]], density: 40, seed: 682 },

      // --- 敌方阵地前沿遮蔽灌丛与疏林
      { kind: 'pine', at: [180, -30], radius: 45, density: 40, seed: 691 },
      { kind: 'bush', at: [140, -40], radius: 35, density: 55, seed: 692 },
      { kind: 'pine', at: [-160, -160], radius: 50, density: 40, seed: 693 },
      { kind: 'bush', at: [-100, -180], radius: 40, density: 60, seed: 694 },

      // --- 雪原开阔地带零星灌木
      { kind: 'bush', at: [-40, 180], radius: 30, density: 35, seed: 695 },
      { kind: 'bush', at: [60, 160], radius: 35, density: 30, seed: 696 },
      { kind: 'bush', at: [-200, 80], radius: 40, density: 35, seed: 697 },
    ],
    grass: { density: 10, seed: 6999 },
    clearRadius: 15,
  },
  spawns: {
    player: {
      vehicleId: 'tiger_i',
      position: [0, 650],
      heading: 0,
    },
    targets: [
      // 1 号靶车:约 282 m,林缘与小丘掩护的 T-34-85,沿东西向小径巡逻
      {
        vehicleId: 't34_85',
        position: [-80, 380],
        heading: 90,
        patrol: { to: [-180, 380], speed: 14 },
      },
      // 2 号靶车:约 448 m,东侧农舍与林缘间的虎王,沿南北向巡逻
      {
        vehicleId: 'tiger_ii',
        position: [220, 260],
        heading: 180,
        patrol: { to: [220, 360], speed: 10 },
      },
      // 3 号靶车:约 590 m,冰冻河谷东岸台地隐蔽的 SU-100 歼击车,沿谷缘往返巡逻
      {
        vehicleId: 'su_100',
        position: [-260, 120],
        heading: 140,
        patrol: { to: [-260, 20], speed: 12 },
      },
      // 4 号靶车:约 726 m,东北侧林带边缘设伏的 T-34-85
      {
        vehicleId: 't34_85',
        position: [150, -60],
        heading: 170,
      },
      // 5 号靶车:约 858 m,北侧丘陵阵地后的虎王重型坦克,正面对敌做远距离阻击
      {
        vehicleId: 'tiger_ii',
        position: [-120, -200],
        heading: 175,
      },
    ],
  },
};
