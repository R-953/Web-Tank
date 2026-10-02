import type { MapSpec, Vec2 } from './types';
import { HARBOR_TOWN } from './mapspecs/harbor_town';
import { SNOW_FOREST } from './mapspecs/snow_forest';

/**
 * 把手写的字符网格('0'~'9')转成 0..1 的高度数组。
 * 只是让高度图便于手工编辑的编码方式,不是程序化生成。
 */
export function parseHeightRows(rows: readonly string[]): number[] {
  const n = rows.length;
  const out: number[] = [];
  rows.forEach((row, i) => {
    if (row.length !== n) {
      throw new Error(`高度图第 ${i} 行长度 ${row.length},应为 ${n}`);
    }
    for (const ch of row) {
      const d = ch.charCodeAt(0) - 48;
      if (d < 0 || d > 9) throw new Error(`高度图第 ${i} 行含非法字符 "${ch}"`);
      out.push(d / 9);
    }
  });
  return out;
}

// 21 × 21 采样点,每格 10m。第一行是地图北边(z = -100),最后一行是南边(z = +100)。
// 四周是高地挡住出界,中间是平地;右侧(x≈20..50, z≈0..30)有一块缓坡可做掩护。
const TRAINING_GROUND_ROWS = [
  '999999888888888999999',
  '998877766666667778899',
  '987654433333334456789',
  '876532211111112235678',
  '765421000000000124567',
  '654310000000000013456',
  '543200000000000002345',
  '432100000000000001234',
  '432110000000000001234',
  '432221000000000001234',
  '432221000000012101234',
  '432110000000123201234',
  '432100000000123201234',
  '432100000000012101234',
  '432100000000000001234',
  '543200000000000002345',
  '654310000000000013456',
  '765421000000000124567',
  '876532211111112235678',
  '987654433333334456789',
  '999999888888888999999',
];

/** 小训练场:200 m 见方,手写高度网格(测试和快速验证用) */
export const TRAINING_GROUND: MapSpec = {
  id: 'training_ground',
  name: '训练场',
  size: 200,
  terrain: {
    cellSize: 10,
    base: 0,
    heightmap: {
      resolution: TRAINING_GROUND_ROWS.length,
      heights: parseHeightRows(TRAINING_GROUND_ROWS),
      heightScale: 10,
    },
    features: [],
  },
  obstacles: [
    { position: [-5, 10], size: [6, 4, 3], rotationY: 15 },
    { position: [30, 40], size: [4, 3, 4], rotationY: 0 },
    { position: [-45, 35], size: [8, 3, 3], rotationY: -30 },
    { position: [55, -10], size: [5, 4, 5], rotationY: 45 },
    { position: [-10, -65], size: [12, 3, 2], rotationY: 0 },
    { position: [-60, -10], size: [4, 6, 4], rotationY: 10 },
  ],
  // 植被:东南角一小片树林、西北角灌木丛,虎王旁边几丛灌木做半遮挡;玩家到两辆靶车之间留空
  vegetation: {
    zones: [
      { kind: 'tree', at: [70, 62], radius: 18, density: 180, seed: 101 },
      { kind: 'bush', at: [72, 45], radius: 16, density: 220, seed: 102 },
      { kind: 'bush', at: [-72, -62], radius: 22, density: 220, seed: 103 },
      { kind: 'pine', at: [-78, -78], radius: 16, density: 200, seed: 104 },
      { kind: 'bush', at: [-50, -34], radius: 7, density: 400, seed: 105 },
    ],
    grass: { density: 16, seed: 106 },
    clearRadius: 10,
  },
  spawns: {
    player: { vehicleId: 'tiger_i', position: [0, 70], heading: 0 },
    targets: [
      // 静止靶:虎王,车头大致朝向玩家出生点,正面打不穿
      { vehicleId: 'tiger_ii', position: [-30, -30], heading: 200 },
      // 移动靶:T-34-85 沿 x 方向以 10 km/h 匀速往返,侧面朝向玩家
      { vehicleId: 't34_85', position: [10, -50], heading: -90, patrol: { to: [50, -50], speed: 10 } },
    ],
  },
};

/** 河道走向(北 → 南),河谷和河床共用 */
const RIVER: Vec2[] = [
  [-700, -1500],
  [-620, -900],
  [-520, -350],
  [-560, 200],
  [-700, 750],
  [-850, 1500],
];

/**
 * 河谷试验场:3 km × 3 km。北边是一排山地(岩地),西边是丘陵(土地),东边是荒漠(沙丘和两座台地),
 * 中间是平原;一条河谷从北边山里下来,斜穿西半边,河床里有浅水可以涉渡。
 * 玩家在南边出生、朝北;靶车分布在约 600 m – 2 km,北边沿线每 500 m 立一根测距标杆(x = 40)。
 * 地表网格每格 100 m,第一行是北边(z = −1500)。
 */
export const RIVER_VALLEY: MapSpec = {
  id: 'river_valley',
  name: '河谷试验场',
  size: 3000,
  terrain: {
    cellSize: 10,
    base: 0,
    features: [
      // --- 北部山地
      { kind: 'mountain', at: [-1150, -1350], radius: 520, height: 230, surface: 'rock' },
      { kind: 'mountain', at: [-600, -1420], radius: 450, height: 280, surface: 'rock' },
      { kind: 'mountain', at: [-50, -1380], radius: 480, height: 240, surface: 'rock' },
      { kind: 'mountain', at: [550, -1400], radius: 450, height: 260, surface: 'rock' },
      { kind: 'mountain', at: [1150, -1300], radius: 520, height: 210, surface: 'rock' },
      { kind: 'mountain', at: [1450, -800], radius: 350, height: 150, surface: 'rock' },
      { kind: 'mountain', at: [-1450, -700], radius: 350, height: 170, surface: 'rock' },
      { kind: 'hill', at: [-300, -950], radius: 250, height: 35 },
      { kind: 'hill', at: [300, -980], radius: 220, height: 30 },
      // --- 西部丘陵
      { kind: 'hill', at: [-1250, -250], radius: 300, height: 40, surface: 'dirt' },
      { kind: 'hill', at: [-1100, 350], radius: 260, height: 32, surface: 'dirt' },
      { kind: 'hill', at: [-1300, 800], radius: 300, height: 45, surface: 'dirt' },
      { kind: 'hill', at: [-1000, 1150], radius: 280, height: 30, surface: 'dirt' },
      { kind: 'hill', at: [-1350, 1350], radius: 200, height: 25, surface: 'dirt' },
      { kind: 'ridge', path: [[-1200, -50], [-1050, 200], [-1150, 500]], width: 180, height: 18 },
      // --- 中部平原:几处缓坡可以做车体掩护
      { kind: 'hill', at: [150, -150], radius: 180, height: 10 },
      { kind: 'hill', at: [-150, 450], radius: 140, height: 7 },
      { kind: 'ridge', path: [[250, 300], [450, 250]], width: 60, height: 3 },
      // --- 东部荒漠
      { kind: 'dunes', at: [950, 550], radius: 650, height: 7, wavelength: 70, heading: 20, surface: 'sand' },
      { kind: 'plateau', at: [1050, -350], radius: 230, height: 40, edge: 70, surface: 'rock' },
      { kind: 'plateau', at: [700, 1150], radius: 140, height: 18, edge: 50, surface: 'rock' },
      // --- 河谷:宽谷下切 16 m,谷底再切出 2.5 m 深的河床(泥滩),水面在 −17.3 m,约 1.2 m 深
      { kind: 'valley', path: RIVER, width: 220, depth: 16, bank: 110 },
      { kind: 'valley', path: RIVER, width: 36, depth: 2.5, bank: 10, surface: 'mud' },
    ],
  },
  surface: {
    legend: { '.': 'grass', ',': 'dirt', s: 'sand', r: 'rock' },
    rows: [
      'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      'rrrrrr,rrrrrrrrrrrrr,rrrrrrrrr',
      ',,,,,,,,,,,,,,,,,,,,,,,,,rrrrr',
      ',,,,,,,,.............,,,,,rrrr',
      ',,,,,,,..............,,sssssss',
      ',,,,,,...............,ssssssss',
      ',,,,,,..............,,ssssssss',
      ',,,,,,,.............,sssssssss',
      ',,,,,,,..............ssssssss,',
      ',,,,,,...............,sssssss,',
      ',,,,,,...............,ssssssss',
      ',,,,,................,ssssssss',
      ',,,,,,...............,,sssssss',
      ',,,,,,,...............,sssssss',
      ',,,,,,,...............,sssssss',
      ',,,,,,................,ssssss,',
      ',,,,,,,...............,,sssss,',
      ',,,,,,,,...............,sssss,',
      ',,,,,,,,...............,,ssss,',
      ',,,,,,,,,...............,ssss,',
      ',,,,,,,,,...............,,sss,',
      ',,,,,,,,,,...............,sss,',
      ',,,,,,,,,,...............,,ss,',
      ',,,,,,,,,,,...............,ss,',
      ',,,,,,,,,,,................,,,',
      ',,,,,,,,,,,,...............,,,',
      ',,,,,,,,,,,,,..............,,,',
    ],
  },
  waterLevel: -17.3,
  obstacles: [
    // 测距标杆:距出生点 500 / 1000 / 1500 / 2000 m
    { position: [40, 700], size: [0.6, 5, 0.6], rotationY: 0 },
    { position: [40, 200], size: [0.6, 5, 0.6], rotationY: 0 },
    { position: [40, -300], size: [0.6, 5, 0.6], rotationY: 0 },
    { position: [40, -800], size: [0.6, 5, 0.6], rotationY: 0 },
    // 平原上的废墟 / 巨石
    { position: [-80, 600], size: [8, 4, 6], rotationY: 10 },
    { position: [300, 100], size: [10, 5, 8], rotationY: 20 },
    { position: [-300, -300], size: [6, 3, 6], rotationY: -15 },
    { position: [420, 900], size: [7, 3.5, 5], rotationY: 35 },
    // 荒漠岩石、丘陵农舍
    { position: [1100, 900], size: [12, 6, 10], rotationY: 25 },
    { position: [800, 200], size: [9, 5, 9], rotationY: 40 },
    { position: [-1000, 700], size: [10, 5, 8], rotationY: -20 },
  ],
  /**
   * 植被(固定种子撒点,每次加载一样):
   *   - 出生点西侧一片阔叶林、东侧一片小树林,可以绕着走、躲进去;
   *   - 河谷两岸是河滩林和灌木,西边丘陵是针叶林,北边山脚两片针叶林;
   *   - 平原上几条东西向的树篱(树 + 灌木),田野里稀疏的灌木,荒漠里零星的灌丛;
   *   - 靶车旁边有几丛灌木做半遮挡。
   * 玩家(0, 1200)到各靶车的视线走廊里不放树林和树篱。
   */
  vegetation: {
    zones: [
      // --- 出生点附近
      { kind: 'tree', polygon: [[-420, 1060], [-160, 1090], [-150, 1320], [-430, 1330]], density: 90, seed: 201 },
      { kind: 'bush', polygon: [[-420, 1060], [-160, 1090], [-150, 1320], [-430, 1330]], density: 50, seed: 202 },
      { kind: 'tree', at: [230, 1300], radius: 60, density: 160, seed: 203 },
      { kind: 'bush', at: [200, 1220], radius: 45, density: 80, seed: 204 },
      // --- 河谷两岸(水面和泥滩里自动跳过)
      { kind: 'tree', polygon: [[-800, 1100], [-600, 1100], [-470, 500], [-430, 0], [-640, 0], [-720, 500]], density: 18, seed: 211 },
      { kind: 'bush', polygon: [[-820, 1200], [-580, 1200], [-450, 500], [-410, -400], [-660, -400], [-740, 500]], density: 15, seed: 212 },
      { kind: 'pine', polygon: [[-700, -400], [-450, -400], [-520, -900], [-700, -950]], density: 30, seed: 213 },
      // --- 西部丘陵的针叶林
      { kind: 'pine', at: [-1120, 380], radius: 170, density: 45, seed: 221 },
      { kind: 'pine', at: [-1280, -250], radius: 140, density: 40, seed: 222 },
      { kind: 'tree', at: [-1050, 1050], radius: 150, density: 30, seed: 223 },
      // --- 北部山脚
      { kind: 'pine', at: [320, -1000], radius: 140, density: 45, seed: 231 },
      { kind: 'pine', at: [-330, -1000], radius: 110, density: 40, seed: 232 },
      // --- 平原上的树篱(东西向窄条),避开玩家到靶车的视线走廊
      { kind: 'tree', polygon: [[460, 940], [820, 930], [820, 946], [460, 956]], density: 170, seed: 241 },
      { kind: 'bush', polygon: [[460, 936], [820, 926], [820, 950], [460, 960]], density: 260, seed: 242 },
      { kind: 'tree', polygon: [[-420, 520], [-320, 515], [-320, 531], [-420, 536]], density: 170, seed: 243 },
      { kind: 'bush', polygon: [[-460, 512], [-300, 505], [-300, 535], [-460, 540]], density: 240, seed: 244 },
      { kind: 'tree', polygon: [[350, 40], [620, 20], [620, 36], [350, 56]], density: 150, seed: 245 },
      // --- 田野里稀疏的灌木、荒漠里零星的灌丛
      { kind: 'bush', polygon: [[-450, 1100], [450, 1100], [450, -600], [-450, -600]], density: 2, seed: 251 },
      { kind: 'bush', at: [950, 550], radius: 600, density: 1.5, seed: 252, scale: [0.6, 1.0] },
      // --- 靶车旁的半遮挡
      { kind: 'bush', at: [150, 585], radius: 14, density: 250, seed: 261 },
      { kind: 'bush', at: [990, 520], radius: 16, density: 200, seed: 262 },
      { kind: 'bush', at: [110, -125], radius: 18, density: 200, seed: 263 },
    ],
    grass: { density: 16, seed: 290 },
  },
  spawns: {
    player: { vehicleId: 'tiger_i', position: [0, 1200], heading: 0 },
    targets: [
      // 约 600 m:平原上的 T-34-85,侧面朝向玩家
      { vehicleId: 't34_85', position: [120, 600], heading: 90 },
      // 约 850 m:沿东西向巡逻的 T-34-85
      { vehicleId: 't34_85', position: [-250, 350], heading: -90, patrol: { to: [250, 350], speed: 15 } },
      // 约 1.1 km:荒漠里的 T-34-85
      { vehicleId: 't34_85', position: [950, 500], heading: 30 },
      // 约 1.3 km:缓坡上的虎王,正面朝南,正面打不穿
      { vehicleId: 'tiger_ii', position: [150, -100], heading: 180 },
      // 约 2 km:山脚下的虎王,超出敌方交战距离,只用来练远距离射击
      { vehicleId: 'tiger_ii', position: [-100, -850], heading: 150 },
    ],
  },
};

export const MAPS: Readonly<Record<string, MapSpec>> = {
  [RIVER_VALLEY.id]: RIVER_VALLEY,
  [TRAINING_GROUND.id]: TRAINING_GROUND,
  [HARBOR_TOWN.id]: HARBOR_TOWN,
  [SNOW_FOREST.id]: SNOW_FOREST,
};
