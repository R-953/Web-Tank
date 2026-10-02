import type { CrewSpec, ModuleSpec, VehicleSpec, WeaponSpec } from './types';
import { hePenetration } from './shells';

/*
 * 载具数据取自公开资料(出处见 docs/physics-validation.md)。
 * armor / turretArmor 填「水平来弹视线厚度」(倾斜装甲已换算)。
 * 动能弹的 penetration 为炮口穿深:由公开穿深表(100 m 或 500 m)按本项目的弹道模型反推;
 * 化学能弹的 penetration 与距离无关;高爆弹按装药量查表(hePenetration)。
 * internals 的位置按剖面图估算(精确到 ±0.2 m 左右),坐标系见 data/types.ts 的 AttachPart。
 * 弹药架的容量与取弹顺序按史实载弹布局(顺序参考 War Thunder:先取空的排在前面)。
 */

/** 左右对称的一对模块 */
function pair(id: string, type: ModuleSpec['type'], part: ModuleSpec['part'], center: [number, number, number], size: [number, number, number]): ModuleSpec[] {
  const [x, y, z] = center;
  return [
    { id: `${id}_l`, type, part, center: [-Math.abs(x), y, z], size },
    { id: `${id}_r`, type, part, center: [Math.abs(x), y, z], size },
  ];
}

/** 弹药架 */
function rack(
  id: string,
  part: ModuleSpec['part'],
  center: [number, number, number],
  size: [number, number, number],
  capacity: number,
  drawOrder: number,
  wet?: boolean,
): ModuleSpec {
  return { id, type: 'ammo', part, center, size, capacity, drawOrder, ...(wet ? { wet: true } : {}) };
}

const crew = (role: CrewSpec['role'], part: CrewSpec['part'], x: number, y: number, z: number): CrewSpec => ({
  role,
  part,
  center: [x, y, z],
});

/** 原型车 / 玩家座车:虎式 Ausf. E(1944 后期型)。箱形车体、装甲基本垂直,盒子碰撞体误差最小。 */
export const TIGER_I: VehicleSpec = {
  id: 'tiger_i',
  name: '虎式 Ausf. E(1944 后期型)',
  nation: 'germany',
  vehicleClass: 'heavy',
  serviceYear: 1942, // Wikipedia: Tiger I 于 1942 年底列装投入使用
  family: 'tiger',
  crewAce: {
    // 现有装填 7.5 s,War Thunder 新手 10.4 s → 王牌 8.0 s,按 WT 新手→王牌比例折算:7.5 × (8.0 / 10.4) ≈ 5.77 s
    reloadTime: 5.77,
    // 现有 19°/s,WT 新手 8.3°/s → 王牌 11.9°/s(瞄准技能 10/7),按 WT 新手→王牌比例折算:19 × (10 / 7) ≈ 27.14°/s
    turretRotationSpeed: 27.14,
    // 现有 4°/s,WT 页面未列乘员高低机数值,按方向机同一比例(10/7)折算估算:4 × (10 / 7) ≈ 5.71°/s
    elevationSpeed: 5.71,
  },
  // 车首 100mm 垂直;侧面上部 80 / 下部 60;后部 80
  armor: { front: 100, side: 80, rear: 80 },
  // 炮塔正面 100(防盾 110–200),侧面 / 后部 80
  turretArmor: { front: 100, side: 80, rear: 80 },
  // 1943 年 11 月起发动机限速 2500 rpm:37.7 km/h(3000 rpm 时为 45.4)
  maxSpeed: 38,
  // 液压旋转,发动机 2000 rpm「高速档」约 19°/s(低速档 6°/s)
  turretRotationSpeed: 19,
  weapons: [
    {
      id: 'kwk36',
      name: '8.8 cm KwK 36 L/56',
      reloadTime: 7.5, // 实战射速 5–10 发/分
      ammo: [
        // 10.2 kg,59 g 炸药;垂直穿深 162mm@100m
        { id: 'pzgr39', name: 'Pzgr.39', type: 'APCBC-HE', caliber: 88, mass: 10.2, muzzleVelocity: 773, penetration: 165, explosiveMass: 59, fuseDelay: 1.2, fuseSensitivity: 15 },
        // 7.3 kg 钨芯;219mm@100m
        { id: 'pzgr40', name: 'Pzgr.40', type: 'APCR', caliber: 88, mass: 7.3, muzzleVelocity: 930, penetration: 224, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0 },
        // 7.65 kg,破甲 110mm(与距离无关)
        { id: 'gr39hl', name: 'Gr.39 HL', type: 'HEAT', caliber: 88, mass: 7.65, muzzleVelocity: 600, penetration: 110, explosiveMass: 680, fuseDelay: 0, fuseSensitivity: 0.3 },
        // 9.0 kg,约 860 g 阿马托炸药
        { id: 'sprgr', name: 'Sprgr. L/4.5', type: 'HE', caliber: 88, mass: 9.0, muzzleVelocity: 820, penetration: hePenetration(0.86), explosiveMass: 860, fuseDelay: 0, fuseSensitivity: 0.1 },
      ],
    },
    {
      id: 'mg34_coax',
      name: 'MG 34 同轴机枪',
      kind: 'mg',
      reloadTime: 5, // 换弹链
      rateOfFire: 900,
      beltSize: 150,
      rounds: 2550,
      mount: [0.38, 0.02, -0.35],
      // 7.92 mm SmK 钢芯弹:12.8 g,约 755 m/s,近距离穿深约 12 mm
      ammo: [
        { id: 'smk', name: '7.92 mm SmK', type: 'AP', caliber: 7.92, mass: 0.0128, muzzleVelocity: 755, penetration: 12, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0, dragCoefficient: 0.3 },
      ],
    },
  ],
  // 车体长 6.32 / 宽 3.56 / 全高 3.00(炮塔约 0.95);转向速度为估算值
  hull: { length: 6.32, width: 3.56, height: 1.95, turnRate: 15, acceleration: 6.0 },
  // 全长含炮 8.45 → 炮口伸出车首约 2.1m;俯仰 -7° / +16°;高低机手轮约 1°/圈,估算 4°/s
  turret: { length: 2.9, width: 2.75, height: 0.95, barrelLength: 3.85, elevation: [-7, 16], elevationSpeed: 4 },
  // TZF 9c 单目镜,双倍率(与同代 TZF 9d 相同的 2.5× / 5×)
  sight: { magnifications: [2.5, 5], reticle: 'german' },
  internals: {
    modules: [
      { id: 'engine', type: 'engine', part: 'hull', center: [0, -0.05, 2.1], size: [1.3, 1.0, 1.5] },
      { id: 'transmission', type: 'transmission', part: 'hull', center: [0, -0.2, -2.45], size: [1.0, 0.8, 1.0] },
      ...pair('fuel', 'fuel', 'hull', [1.1, 0.0, 2.2], [0.5, 0.9, 1.1]),
      // 共 92 发:侧裙 4 个 16 发弹箱(最先取空)、驾驶员旁 6 发、车底 22 发
      rack('ammo_sponson_lf', 'hull', [-1.35, 0.5, -0.9], [0.5, 0.6, 1.0], 16, 1),
      rack('ammo_sponson_rf', 'hull', [1.35, 0.5, -0.9], [0.5, 0.6, 1.0], 16, 2),
      rack('ammo_sponson_lr', 'hull', [-1.35, 0.5, 0.1], [0.5, 0.6, 1.0], 16, 3),
      rack('ammo_sponson_rr', 'hull', [1.35, 0.5, 0.1], [0.5, 0.6, 1.0], 16, 4),
      rack('ammo_front', 'hull', [1.0, -0.3, -1.5], [0.5, 0.5, 0.7], 6, 5),
      rack('ammo_floor', 'hull', [0, -0.65, -0.3], [1.4, 0.3, 1.2], 22, 6),
      ...pair('track', 'track', 'hull', [1.42, -0.51, -0.05], [0.72, 0.93, 6.2]),
      { id: 'traverse', type: 'traverse', part: 'turret', center: [-0.3, -0.2, -0.2], size: [0.3, 0.3, 0.3] },
      { id: 'elevation', type: 'elevation', part: 'turret', center: [-0.35, 0.3, -1.0], size: [0.25, 0.3, 0.25] },
      { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, 1.0], size: [0.35, 0.35, 1.2] },
      { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -1.925], size: [0.2, 0.2, 3.85] },
    ],
    crew: [
      crew('driver', 'hull', -0.6, -0.05, -2.3),
      crew('radio', 'hull', 0.6, -0.05, -2.3),
      crew('gunner', 'turret', -0.55, 0.05, -0.55),
      crew('commander', 'turret', -0.65, 0.35, 0.6),
      crew('loader', 'turret', 0.65, -0.05, 0.15),
    ],
  },
  color: 0xa89060,
};

/** 移动靶:T-34-85(1944)。倾斜装甲已换算为视线厚度。 */
export const T34_85: VehicleSpec = {
  id: 't34_85',
  name: 'T-34-85',
  nation: 'ussr',
  vehicleClass: 'medium',
  serviceYear: 1944, // Wikipedia: 1944 年 1 月正式列装并投入实战
  family: 't34',
  crewAce: {
    // 现有装填 8.0 s,War Thunder 新手 9.6 s → 王牌 7.4 s,按 WT 新手→王牌比例折算:8.0 × (7.4 / 9.6) ≈ 6.17 s
    reloadTime: 6.17,
    // 现有 24°/s,WT 新手 17.5°/s → 王牌 25.0°/s,按 WT 新手→王牌比例折算:24 × (25.0 / 17.5) = 24 × (10 / 7) ≈ 34.29°/s
    turretRotationSpeed: 34.29,
    // 现有 4°/s,WT 新手 2.8°/s → 王牌 4.0°/s,按 WT 新手→王牌比例折算:4 × (4.0 / 2.8) = 4 × (10 / 7) ≈ 5.71°/s(估算)
    elevationSpeed: 5.71,
  },
  // 首上 45@60° → 90;首下 45@53° ≈ 75(分界高度 0.71m);侧面下部 45 垂直(上部 45@40° ≈ 59);后部 45@45° ≈ 64
  armor: { front: 90, side: 45, rear: 64, lowerFront: { thickness: 75, height: 0.71 } },
  // 炮塔正面 90,侧面 75,后部 52
  turretArmor: { front: 90, side: 75, rear: 52 },
  maxSpeed: 53,
  turretRotationSpeed: 24, // 电动旋转,估算值
  weapons: [
    {
      id: 'zis_s_53',
      name: '85 mm ZiS-S-53',
      reloadTime: 8,
      ammo: [
        // 钝头 + 风帽,9.2 kg,164 g 炸药;125mm@500m、107mm@1000m。苏制钝头弹掉速快,阻力系数按穿深表拟合
        { id: 'br365', name: 'BR-365', type: 'APHEBC', caliber: 85, mass: 9.2, muzzleVelocity: 792, penetration: 145, explosiveMass: 164, fuseDelay: 1.2, fuseSensitivity: 15, dragCoefficient: 0.55 },
        // 尖头无帽,48 g 炸药,MD-8 引信;142mm@100m
        { id: 'br365k', name: 'BR-365K', type: 'APHE', caliber: 85, mass: 9.2, muzzleVelocity: 792, penetration: 146, explosiveMass: 48, fuseDelay: 1.2, fuseSensitivity: 15, dragCoefficient: 0.55 },
        // 线轴式硬芯弹,4.99 kg;175mm@100m,远距离衰减很快
        { id: 'br365p', name: 'BR-365P', type: 'APCR', caliber: 85, mass: 4.99, muzzleVelocity: 1050, penetration: 186, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0, dragCoefficient: 0.6 },
        // 9.54 kg,741 g 炸药
        { id: 'o365k', name: 'O-365K', type: 'HE', caliber: 85, mass: 9.54, muzzleVelocity: 785, penetration: hePenetration(0.741), explosiveMass: 741, fuseDelay: 0, fuseSensitivity: 0.1 },
      ],
    },
    {
      id: 'dt_coax',
      name: 'DT 同轴机枪',
      kind: 'mg',
      reloadTime: 6, // 换弹鼓
      rateOfFire: 600,
      beltSize: 63,
      rounds: 1008,
      mount: [0.3, 0.02, -0.3],
      // 7.62 mm B-32 穿甲燃烧弹:9.6 g,约 820 m/s,近距离穿深约 10 mm
      ammo: [
        { id: 'b32', name: '7.62 mm B-32', type: 'AP', caliber: 7.62, mass: 0.0096, muzzleVelocity: 820, penetration: 10, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0, dragCoefficient: 0.3 },
      ],
    },
  ],
  // 车体长 6.10 / 宽 3.00 / 全高约 2.6;转向速度为估算值
  hull: { length: 6.1, width: 3.0, height: 1.62, turnRate: 20, acceleration: 5.5 },
  // 俯仰 -5° / +22°;高低机为手摇,估算 4°/s
  turret: { length: 2.6, width: 2.3, height: 1.0, barrelLength: 3.9, elevation: [-5, 22], elevationSpeed: 4 },
  // TSh-16:4×,视场 16°
  sight: { magnifications: [4], reticle: 'soviet' },
  internals: {
    modules: [
      // V-2-34 柴油机,中置后部;尺寸按实车约 1.5×1.0×0.9m(估算)
      { id: 'engine', type: 'engine', part: 'hull', center: [0, -0.05, 1.3], size: [1.1, 0.85, 1.4] },
      // 5 速变速箱与最终传动,后置(苏式后驱);尺寸估算
      { id: 'transmission', type: 'transmission', part: 'hull', center: [0, -0.25, 2.5], size: [1.6, 0.6, 0.8] },
      // 内部侧油箱:战斗室两侧(pair)与发动机舱两侧(pair),避开履带与弹药(估算)
      ...pair('fuel_fighting', 'fuel', 'hull', [1.15, 0.15, -0.3], [0.3, 0.55, 1.2]),
      ...pair('fuel_engine', 'fuel', 'hull', [1.15, 0.15, 1.3], [0.3, 0.55, 1.4]),
      // 履带总成
      ...pair('track', 'track', 'hull', [1.25, -0.425, 0], [0.5, 0.77, 6.0]),
      // 共 55 发:
      // 1) 炮塔尾舱 12 发(最先取空,drawOrder 1)
      rack('ammo_bustle', 'turret', [0, 0.5, 0.95], [1.1, 0.35, 0.3], 12, 1),
      // 2) 炮塔右壁 4 发(装填手侧待发弹,drawOrder 2)
      rack('ammo_turret_r', 'turret', [0.85, 0.35, 0.35], [0.25, 0.4, 0.45], 4, 2),
      // 3) 车体右侧壁 4 发(drawOrder 3)
      rack('ammo_hull_r', 'hull', [1.15, 0.2, -1.4], [0.3, 0.45, 0.65], 4, 3),
      // 4) 车底 6 个橡胶密封弹药箱共 35 发(拆为左 18 发 / 右 17 发,drawOrder 4/5)
      rack('ammo_floor_l', 'hull', [-0.4, -0.55, -0.5], [0.65, 0.28, 1.2], 18, 4),
      rack('ammo_floor_r', 'hull', [0.4, -0.55, -0.5], [0.65, 0.28, 1.2], 17, 5),
      // 炮塔电动/手动方向机:炮塔座圈左前方,炮手操纵(估算)
      { id: 'traverse', type: 'traverse', part: 'turret', center: [-0.45, 0.18, -0.75], size: [0.3, 0.3, 0.3] },
      // 高低机:主炮耳轴左侧,手轮与扇形齿轮(估算)
      { id: 'elevation', type: 'elevation', part: 'turret', center: [-0.25, 0.35, -0.9], size: [0.25, 0.25, 0.25] },
      // 85 mm ZiS-S-53 炮闩(gun 局部系)
      { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, 0.85], size: [0.32, 0.32, 1.05] },
      // 85 mm 炮管(gun 局部系,长 3.9 m)
      { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -1.95], size: [0.18, 0.18, 3.9] },
    ],
    crew: [
      // 5 人:驾驶员(车体前左)、航向机枪手兼无线电员(车体前右)、炮手(炮塔左前)、车长(炮塔左后车长塔下)、装填手(炮塔右侧)
      crew('driver', 'hull', -0.5, -0.05, -2.15),
      crew('radio', 'hull', 0.5, -0.05, -2.15),
      crew('gunner', 'turret', -0.55, 0.15, -0.45),
      crew('commander', 'turret', -0.5, 0.35, 0.5),
      crew('loader', 'turret', 0.55, 0.15, 0.05),
    ],
  },
  color: 0x4b5a2c,
};

/** 静止靶:虎式 II 型(亨舍尔炮塔)。正面 88mm L/56 打不穿,用来验证「绕侧面打」。 */
export const TIGER_II: VehicleSpec = {
  id: 'tiger_ii',
  name: '虎王(亨舍尔炮塔)',
  nation: 'germany',
  vehicleClass: 'heavy',
  serviceYear: 1944, // Wikipedia: 1944 年中投入实战
  family: 'tiger_ii',
  crewAce: {
    // 现有装填 7.5 s,War Thunder 新手 9.7 s → 王牌 7.5 s,按 WT 新手→王牌比例折算:7.5 × (7.5 / 9.7) ≈ 5.80 s
    reloadTime: 5.8,
    // 现有 19°/s,WT 新手 13.3°/s → 王牌 19.0°/s(瞄准技能 10/7),按 WT 新手→王牌比例折算:19 × (10 / 7) ≈ 27.14°/s
    turretRotationSpeed: 27.14,
    // 现有 4°/s,按方向机同一比例(10/7)折算估算:4 × (10 / 7) ≈ 5.71°/s(WT 新手 4.7°/s → 王牌 6.7°/s 亦为 10/7)
    elevationSpeed: 5.71,
  },
  // 首上 150@50° ≈ 233;首下 100@50° ≈ 156(分界高度 0.9m);侧面下部 80 垂直(上部 80@25° ≈ 88);后部 80@30° ≈ 92
  armor: { front: 233, side: 80, rear: 92, lowerFront: { thickness: 156, height: 0.9 } },
  // 炮塔正面 180@10° ≈ 183;侧面 80@21° ≈ 86;后部 80@20° ≈ 85
  turretArmor: { front: 183, side: 86, rear: 85 },
  maxSpeed: 41.5,
  turretRotationSpeed: 19,
  weapons: [
    {
      id: 'kwk43',
      name: '8.8 cm KwK 43 L/71',
      reloadTime: 7.5, // 6–10 发/分
      ammo: [
        // 10.4 kg,59 g 炸药;232mm@100m
        { id: 'pzgr39_43', name: 'Pzgr.39/43', type: 'APCBC-HE', caliber: 88, mass: 10.4, muzzleVelocity: 1000, penetration: 236, explosiveMass: 59, fuseDelay: 1.2, fuseSensitivity: 15 },
        // 7.3 kg 钨芯;304mm@100m
        { id: 'pzgr40_43', name: 'Pzgr.40/43', type: 'APCR', caliber: 88, mass: 7.3, muzzleVelocity: 1130, penetration: 310, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0, dragCoefficient: 0.27 },
        { id: 'gr39_3hl', name: 'Gr.39/3 HL', type: 'HEAT', caliber: 88, mass: 7.65, muzzleVelocity: 600, penetration: 110, explosiveMass: 680, fuseDelay: 0, fuseSensitivity: 0.3 },
        // 9.4 kg,1.0 kg 阿马托炸药;初速没找到可靠出处,按 750 m/s 估算
        { id: 'sprgr43', name: 'Sprgr.43', type: 'HE', caliber: 88, mass: 9.4, muzzleVelocity: 750, penetration: hePenetration(1.0), explosiveMass: 1000, fuseDelay: 0, fuseSensitivity: 0.1 },
      ],
    },
    {
      id: 'mg34_coax',
      name: 'MG 34 同轴机枪',
      kind: 'mg',
      reloadTime: 5, // 换弹链
      rateOfFire: 900,
      beltSize: 150,
      rounds: 2700,
      mount: [0.4, 0.02, -0.4],
      // 7.92 mm SmK 钢芯弹:12.8 g,约 755 m/s,近距离穿深约 12 mm
      ammo: [
        { id: 'smk', name: '7.92 mm SmK', type: 'AP', caliber: 7.92, mass: 0.0128, muzzleVelocity: 755, penetration: 12, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0, dragCoefficient: 0.3 },
      ],
    },
  ],
  // 车体长 7.38 / 宽 3.75 / 全高 3.09;转向速度为估算值
  hull: { length: 7.38, width: 3.75, height: 2.1, turnRate: 13, acceleration: 5.5 },
  // 俯仰 -8° / +15°;高低机为手摇,估算 4°/s
  turret: { length: 3.4, width: 2.8, height: 0.95, barrelLength: 4.9, elevation: [-8, 15], elevationSpeed: 4 },
  // TZF 9d:2.5× / 5×,视场 25° / 12.5°
  sight: { magnifications: [2.5, 5], reticle: 'german' },
  internals: {
    modules: [
      { id: 'engine', type: 'engine', part: 'hull', center: [0, 0.0, 2.3], size: [1.4, 1.1, 1.6] },
      { id: 'transmission', type: 'transmission', part: 'hull', center: [0, -0.3, -2.9], size: [1.1, 0.8, 1.0] },
      ...pair('fuel', 'fuel', 'hull', [1.15, 0.0, 2.4], [0.55, 0.9, 1.2]),
      // 共 86 发:炮塔尾舱 22 发(最先取空)、两侧侧裙各 24 发、车底 16 发
      rack('ammo_sponson_l', 'hull', [-1.5, 0.55, -0.5], [0.55, 0.6, 2.4], 24, 2),
      rack('ammo_sponson_r', 'hull', [1.5, 0.55, -0.5], [0.55, 0.6, 2.4], 24, 3),
      rack('ammo_floor', 'hull', [0, -0.7, -0.4], [1.2, 0.3, 1.0], 16, 4),
      ...pair('track', 'track', 'hull', [1.475, -0.575, -0.05], [0.8, 0.95, 7.1]),
      rack('ammo_bustle', 'turret', [0, 0.45, 1.35], [2.0, 0.5, 0.6], 22, 1),
      { id: 'traverse', type: 'traverse', part: 'turret', center: [-0.3, -0.2, -0.35], size: [0.3, 0.3, 0.3] },
      { id: 'elevation', type: 'elevation', part: 'turret', center: [-0.35, 0.3, -1.2], size: [0.25, 0.3, 0.25] },
      { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, 1.1], size: [0.38, 0.38, 1.3] },
      { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -2.45], size: [0.22, 0.22, 4.9] },
    ],
    crew: [
      crew('driver', 'hull', -0.6, -0.05, -2.75),
      crew('radio', 'hull', 0.6, -0.05, -2.75),
      crew('gunner', 'turret', -0.55, 0.05, -0.7),
      crew('commander', 'turret', -0.6, 0.35, 0.45),
      crew('loader', 'turret', 0.6, -0.05, -0.1),
    ],
  },
  color: 0x6b6e5e,
};

/**
 * 坦克歼击车:SU-100。T-34 底盘,固定战斗室,火炮左右各 8°(出处见 docs/physics-validation.md 第 9 节)。
 * 首上装甲一直延伸到战斗室顶,所以车体和战斗室正面用同一块板。
 */
export const SU_100: VehicleSpec = {
  id: 'su_100',
  name: 'SU-100',
  nation: 'ussr',
  vehicleClass: 'td',
  serviceYear: 1944, // Wikipedia: 1944 年 10 月投入使用
  family: 'su100',
  crewAce: {
    // 现有装填 13.7 s 与 WT 新手 13.7 s 一致,直接取 WT 王牌值
    reloadTime: 10.5, // War Thunder 值
    // 现有方向机 4.9°/s 与 WT 新手 4.9°/s 一致,直接取 WT 王牌值
    turretRotationSpeed: 7.0, // War Thunder 值
    // 现有高低机 2.8°/s 与 WT 新手 2.8°/s 一致,直接取 WT 王牌值
    elevationSpeed: 4.0, // War Thunder 值
  },
  // 首上 75@55° → 131;侧面 45、后部 45 倾角没核实,按竖直填
  armor: { front: 131, side: 45, rear: 45 },
  turretArmor: { front: 131, side: 45, rear: 45 },
  maxSpeed: 48,
  turretRotationSpeed: 4.9, // 火炮方向机,War Thunder 值(历史满改、新手乘员)
  weapons: [
    {
      id: 'd10s',
      name: '100 mm D-10S',
      reloadTime: 13.7, // War Thunder 值(新手乘员;满级 10.5 s)
      ammo: [
        // 15.6 kg;160mm@500m、150mm@1000m(苏方 80% 判据)→ 炮口 171,阻力系数按表拟合;装药量没查到,估算 80 g(见验证报告)
        { id: 'br412', name: 'BR-412', type: 'APHE', caliber: 100, mass: 15.6, muzzleVelocity: 895, penetration: 171, explosiveMass: 80, fuseDelay: 1.2, fuseSensitivity: 15, dragCoefficient: 0.3 },
        // 15.8 kg;装药量没查到,估算 1.23 kg(见验证报告)
        { id: 'of412', name: 'OF-412', type: 'HE', caliber: 100, mass: 15.8, muzzleVelocity: 900, penetration: hePenetration(1.23), explosiveMass: 1230, fuseDelay: 0, fuseSensitivity: 0.1 },
      ],
    },
  ],
  // 含炮全长 9.45 / 宽 3.00 / 全高 2.25;车体长、高沿用项目里同底盘的 T-34-85;转向、加速度同 T-34-85(估算)
  hull: { length: 6.1, width: 3.0, height: 1.62, turnRate: 20, acceleration: 5.5 },
  // 战斗室尺寸、位置估算(首上一直延伸到战斗室顶,战斗室在车体前半部);
  // 炮口伸出 9.45 − 6.1 = 3.35 m → barrelLength = 3.35 − 2.8/2 + (−0.7) + 6.1/2 = 4.3;俯仰 −3° / +20°、高低机 2.8°/s 为 War Thunder 值
  turret: { length: 2.8, width: 2.6, height: 0.63, barrelLength: 4.3, elevation: [-3, 20], elevationSpeed: 2.8, traverse: [8, 8], offset: -0.7 },
  // TSh-19;倍率用 War Thunder 值 3.4–4×
  sight: { magnifications: [3.4, 4], reticle: 'soviet' },
  internals: {
    modules: [
      // V-2-34 柴油机(T-34 底盘通用,估算)
      { id: 'engine', type: 'engine', part: 'hull', center: [0, -0.05, 1.3], size: [1.1, 0.85, 1.4] },
      // 5 速变速箱与最终传动,后置(估算)
      { id: 'transmission', type: 'transmission', part: 'hull', center: [0, -0.25, 2.5], size: [1.6, 0.6, 0.8] },
      // 内部侧油箱:战斗室两侧(pair)与发动机舱两侧(pair)(估算)
      ...pair('fuel_fighting', 'fuel', 'hull', [1.15, 0.15, -0.3], [0.3, 0.55, 1.2]),
      ...pair('fuel_engine', 'fuel', 'hull', [1.15, 0.15, 1.3], [0.3, 0.55, 1.4]),
      // 履带总成
      ...pair('track', 'track', 'hull', [1.25, -0.425, 0], [0.5, 0.77, 6.0]),
      // 共 33 发(100 mm D-10S):
      // 1) 战斗室左侧壁立式弹药架 8 发(drawOrder 1)
      rack('ammo_left', 'turret', [-1.05, 0.2, 0.35], [0.28, 0.38, 1.2], 8, 1),
      // 2) 战斗室后壁横置弹药架 8 发(drawOrder 2)
      rack('ammo_rear', 'turret', [0.1, 0.25, 1.15], [1.3, 0.38, 0.25], 8, 2),
      // 3) 车体底板弹药箱 17 发(拆为左 8 发 / 右 9 发,drawOrder 3/4)
      rack('ammo_floor_l', 'hull', [-0.4, -0.55, -0.5], [0.65, 0.28, 1.1], 8, 3),
      rack('ammo_floor_r', 'hull', [0.4, -0.55, -0.5], [0.65, 0.28, 1.1], 9, 4),
      // D-10S 方向机:主炮耳轴左侧,炮手操纵(实车方向机位于火炮左侧,校正旧数据右侧错误,估算)
      { id: 'traverse', type: 'traverse', part: 'turret', center: [-0.4, 0.18, -0.95], size: [0.28, 0.28, 0.28] },
      // D-10S 高低机:主炮耳轴左侧上部(估算)
      { id: 'elevation', type: 'elevation', part: 'turret', center: [-0.35, 0.35, -1.05], size: [0.24, 0.24, 0.24] },
      // 100 mm D-10S 炮闩(gun 局部系)
      { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, 0.9], size: [0.35, 0.35, 1.2] },
      // 100 mm 炮管(gun 局部系,长 4.3 m)
      { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -2.15], size: [0.2, 0.2, 4.3] },
    ],
    crew: [
      // 4 人:驾驶员(车体左前)、炮手(战斗室左前)、车长兼无线电员(战斗室右侧车长指挥塔)、装填手(战斗室右后)
      crew('driver', 'hull', -0.5, -0.05, -2.15),
      crew('gunner', 'turret', -0.6, 0.15, -0.65),
      crew('commander', 'turret', 0.65, 0.25, -0.15),
      crew('loader', 'turret', 0.55, 0.15, 0.65),
    ],
  },
  color: 0x4f5b31,
};

/**
 * 坦克歼击车:ISU-122。IS-2 底盘,固定战斗室,火炮左 3° / 右 7°(火炮偏在右侧;出处见 docs/physics-validation.md 第 10 节)。
 * 火炮在模型和物理里都按车体中线放置(数据结构没有横向偏移);装甲倾角没核实,按竖直填。
 */
export const ISU_122: VehicleSpec = {
  id: 'isu_122',
  name: 'ISU-122',
  nation: 'ussr',
  vehicleClass: 'td',
  serviceYear: 1944, // Wikipedia: 1944 年 3 月列装、4 月首批下线投入使用
  family: 'isu',
  crewAce: {
    // 现有装填 26.0 s 与 WT 新手 26.0 s 一致,直接取 WT 王牌值
    reloadTime: 20.0, // War Thunder 值
    // 现有方向机 4.9°/s 与 WT 新手 4.9°/s 一致,直接取 WT 王牌值
    turretRotationSpeed: 7.0, // War Thunder 值
    // 现有高低机 2.8°/s 与 WT 新手 2.8°/s 一致,直接取 WT 王牌值
    elevationSpeed: 4.0, // War Thunder 值
  },
  // 车体正面 90 / 侧面 90 / 后部 60,War Thunder 值(Wikipedia:正面 90、侧面 90)
  armor: { front: 90, side: 90, rear: 60 },
  // 战斗室正面 90 / 侧面 75 / 后部 60,War Thunder 值;防盾 120 mm(Wikipedia)没有单独建模
  turretArmor: { front: 90, side: 75, rear: 60 },
  maxSpeed: 37,
  turretRotationSpeed: 4.9, // 火炮方向机,War Thunder 值(历史满改、新手乘员)
  weapons: [
    {
      id: 'a19s',
      name: '122 mm A-19S',
      // War Thunder 值(新手乘员;满级 20 s)。Wikipedia 写射速 1.5 发/分(40 s),和其他车一样按 WT 取值
      reloadTime: 26,
      ammo: [
        // 25 kg,装药 156 g;150/130/115/100 mm @ 500/1000/1500/2000 m(Shirokorad,90°)→ 炮口 171,阻力系数按表拟合
        { id: 'br471', name: 'BR-471', type: 'APHE', caliber: 122, mass: 25, muzzleVelocity: 800, penetration: 171, explosiveMass: 156, fuseDelay: 1.2, fuseSensitivity: 19, dragCoefficient: 0.67 },
        // 1945 年初列装;25 kg;155/145/135/125 mm @ 500/1000/1500/2000 m(同上)→ 炮口 167;装药没查到,用 War Thunder 值 160 g
        { id: 'br471b', name: 'BR-471B', type: 'APHEBC', caliber: 122, mass: 25, muzzleVelocity: 800, penetration: 167, explosiveMass: 160, fuseDelay: 1.2, fuseSensitivity: 19, dragCoefficient: 0.36 },
        // 25 kg,装药 3.6 kg TNT
        { id: 'of471', name: 'OF-471', type: 'HE', caliber: 122, mass: 25, muzzleVelocity: 800, penetration: hePenetration(3.6), explosiveMass: 3600, fuseDelay: 0, fuseSensitivity: 0.1 },
      ],
    },
  ],
  // 含炮全长 9.85 / 宽 3.07 / 全高 2.48(Wikipedia);车体长 6.77 m 为 IS 系底盘的常见资料值(估算,没找到可引用的出处)
  // 车体盒高 1.55、战斗室 0.93 按侧面照片比例分(估算);转向比照虎式取 15°/s,加速度按功重比 11.4 hp/t 比照 T-34-85(估算)
  hull: { length: 6.77, width: 3.07, height: 1.55, turnRate: 15, acceleration: 4.0 },
  // 战斗室尺寸、位置估算(占车体前 60%);炮口伸出 9.85 − 6.77 = 3.08 m → barrelLength = 3.08 − 3.6/2 + (−1.1) + 6.77/2 = 3.57
  // 俯仰 −3° / +22°、高低机 2.8°/s、射界左 3° / 右 7° 为 War Thunder 值(Wikipedia 只写了仰角)
  turret: { length: 3.6, width: 2.7, height: 0.93, barrelLength: 3.57, elevation: [-3, 22], elevationSpeed: 2.8, traverse: [3, 7], offset: -1.1 },
  // ST-10 潜望式瞄准镜;倍率用 War Thunder 值 1.9–3.5×
  sight: { magnifications: [1.9, 3.5], reticle: 'soviet' },
  internals: {
    modules: [
      // V-2-IS 柴油机(IS-2 底盘,520 hp;估算)
      { id: 'engine', type: 'engine', part: 'hull', center: [0, -0.05, 1.7], size: [1.2, 0.85, 1.5] },
      // 行星转向传动机构与最终传动,后置(估算)
      { id: 'transmission', type: 'transmission', part: 'hull', center: [0, -0.2, 2.9], size: [1.8, 0.6, 0.7] },
      // 内部侧油箱:战斗室两侧(pair)与动力舱两侧(pair)(估算)
      ...pair('fuel_fighting', 'fuel', 'hull', [1.15, 0.15, 0.2], [0.35, 0.6, 1.1]),
      ...pair('fuel_engine', 'fuel', 'hull', [1.15, 0.15, 1.7], [0.35, 0.6, 1.4]),
      // 行走机构重型履带总成
      ...pair('track', 'track', 'hull', [1.21, -0.375, 0], [0.65, 0.8, 6.3]),
      // 共 30 发(122 mm A-19S 分装弹药,30 弹头 + 30 药筒):
      // 1) 战斗室左壁弹架 12 发(第一装填手侧,drawOrder 1)
      rack('ammo_left', 'turret', [-1.1, 0.25, 0.25], [0.3, 0.48, 1.5], 12, 1),
      // 2) 战斗室右壁弹架 8 发(第二装填手侧,drawOrder 2)
      rack('ammo_right', 'turret', [1.1, 0.25, 0.25], [0.3, 0.48, 1.2], 8, 2),
      // 3) 战斗室底板弹箱 10 发(拆为左 5 发 / 右 5 发,drawOrder 3/4)
      rack('ammo_floor_l', 'hull', [-0.45, -0.5, -0.6], [0.65, 0.28, 1.2], 5, 3),
      rack('ammo_floor_r', 'hull', [0.45, -0.5, -0.6], [0.65, 0.28, 1.2], 5, 4),
      // A-19S 方向机:火炮左侧,炮手手轮操纵(估算)
      { id: 'traverse', type: 'traverse', part: 'turret', center: [-0.38, 0.18, -1.2], size: [0.28, 0.28, 0.28] },
      // A-19S 高低机:火炮左侧上部扇形齿轮(估算)
      { id: 'elevation', type: 'elevation', part: 'turret', center: [-0.38, 0.38, -1.3], size: [0.25, 0.25, 0.25] },
      // 122 mm A-19S 螺式炮闩(gun 局部系)
      { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, 1.2], size: [0.42, 0.42, 1.6] },
      // 122 mm 炮管(gun 局部系,长 3.57 m)
      { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -1.785], size: [0.22, 0.22, 3.57] },
    ],
    crew: [
      // 5 人:驾驶员(车体前左)、炮手(战斗室左前)、车长(战斗室右前)、第一装填手(战斗室左后)、第二装填手兼闩手(战斗室右后)
      crew('driver', 'hull', -0.6, -0.05, -2.45),
      crew('gunner', 'turret', -0.7, 0.2, -0.75),
      crew('commander', 'turret', 0.7, 0.25, -0.75),
      crew('loader', 'turret', -0.65, 0.15, 0.65),
      crew('loader', 'turret', 0.65, 0.15, 0.65),
    ],
  },
  color: 0x535e36,
};

/*
 * 谢尔曼 M4A3 系列(三辆共用 47° 单块首上的焊接车体,数据与出处见 docs/physics-validation.md 第 11 节、docs/research/m4a3-76w.md):
 *   M4A3(76)W  —— T23 炮塔 + 76 mm M1A1(无制退器),VVSS 悬挂
 *   M4A3E8     —— 同上的车体和炮塔,76 mm M1A2(带制退器),HVSS 悬挂(Easy Eight)
 *   M4A3E2     —— 「Jumbo」突击坦克:车体加焊附加装甲、厚壁炮塔,75 mm M3,VVSS 悬挂
 * 车体盒高 1.93 + 炮塔盒高 0.72:炮耳轴离地 1.93 + 0.36 = 2.29 m,等于资料的火线高;炮塔顶 2.65 m,加指挥塔约 0.3 m 等于全高 2.97 m。
 * 炮塔盒以座圈中心为中心、座圈在车体中部(offset 0),炮塔盒长 2.5 m 按座圈 1.75 m 估算。
 */

/** 76 mm M1 系列火炮(M4A3(76)W / M4A3E8 共用) */
function gun76(name: string): WeaponSpec {
  return {
    id: 'm1_76',
    name,
    reloadTime: 7.6, // War Thunder 值(新手乘员;满级 5.9 s);公开资料没查到实测射速
    ammo: [
      // 被帽 + 风帽,7.00 kg;装药 77 g Explosive D(TM 9-1904,按 TNT 1:1);BD M66A1 延时引信,延时距离沿用 1.2 m(估算)
      // 125/116/106/89 mm @ 100/500/1000/2000 m(Bird & Livingston,90° RHA)→ 炮口 127,阻力系数按表拟合
      { id: 'm62', name: 'M62', type: 'APCBC-HE', caliber: 76.2, mass: 7.0, muzzleVelocity: 792, penetration: 127, explosiveMass: 77, fuseDelay: 1.2, fuseSensitivity: 15, dragCoefficient: 0.32 },
      // 整体实心弹,6.80 kg;154/131/107/72 mm @ 100/500/1000/2000 m,掉得快 → 炮口 160,阻力系数 0.70
      { id: 'm79', name: 'M79', type: 'AP', caliber: 76.2, mass: 6.8, muzzleVelocity: 792, penetration: 160, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0, dragCoefficient: 0.7 },
      // 钨芯硬芯弹,3.45 kg(另说 4.24 kg,未核实);239/208/175/124 mm @ 100/500/1000/2000 m → 炮口 247
      { id: 'm93', name: 'M93', type: 'APCR', caliber: 76.2, mass: 3.45, muzzleVelocity: 1036, penetration: 247, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0, dragCoefficient: 0.31 },
      // 5.84 kg,390 g TNT
      { id: 'm42a1', name: 'M42A1', type: 'HE', caliber: 76.2, mass: 5.84, muzzleVelocity: 823, penetration: hePenetration(0.39), explosiveMass: 390, fuseDelay: 0, fuseSensitivity: 0.1 },
    ],
  };
}

/** M1919A4 同轴机枪(三辆共用) */
function m1919a4Coax(): WeaponSpec {
  return {
    id: 'm1919a4_coax',
    name: 'M1919A4 同轴机枪',
    kind: 'mg',
    reloadTime: 10.4, // 换弹链,War Thunder 值(新手乘员;满级 8 s)
    rateOfFire: 500, // 400–600
    beltSize: 250,
    rounds: 3000, // 全车 .30 弹与航向机枪共用(76 mm 车 6,250 发、E2 4,750 发),同轴份额用 War Thunder 的 3,000
    // .30-06 穿甲弹 M2:弹头约 10.8 g;穿深 13 mm@10m 为 War Thunder 值;初速暂用 M2 普通弹的 853 m/s
    ammo: [
      { id: 'm2_ap', name: '.30 M2 AP', type: 'AP', caliber: 7.62, mass: 0.0108, muzzleVelocity: 853, penetration: 13, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0, dragCoefficient: 0.3 },
    ],
  };
}

/**
 * 三辆共用的内部布局(位置全部估算,见 docs/research/m4a3-76w.md 第 9 节):
 * 后置发动机、前置变速箱;弹药在车底传动轴两侧的湿式弹药箱里,炮塔地板上有待发弹架。
 * 谢尔曼从左侧装填:装填手在左,炮手、车长在右。
 */
function shermanInternals(o: {
  ready: number;
  floor: readonly [left: number, right: number];
  floorLength: readonly [left: number, right: number];
  track: { x: number; width: number };
  barrelLength: number;
  breech: { z: number; length: number };
}): VehicleSpec['internals'] {
  const bl = o.barrelLength;
  return {
    modules: [
      { id: 'engine', type: 'engine', part: 'hull', center: [0, 0.05, 2.0], size: [1.2, 1.0, 1.5] },
      { id: 'transmission', type: 'transmission', part: 'hull', center: [0, -0.2, -2.7], size: [1.6, 0.6, 0.7] },
      ...pair('fuel', 'fuel', 'hull', [1.0, 0.4, 1.8], [0.35, 0.6, 1.4]),
      // 炮塔里的待发弹架没有水套(湿式改进只针对车体底板的弹药箱),按干式算——估算,待核实
      rack('ammo_ready', 'turret', [-0.6, 0.0, 0.5], [0.4, 0.4, 0.5], o.ready, 1),
      rack('ammo_floor_l', 'hull', [-0.45, -0.2, -0.6], [0.6, 0.5, o.floorLength[0]], o.floor[0], 2, true),
      rack('ammo_floor_r', 'hull', [0.45, -0.2, -0.6], [0.6, 0.5, o.floorLength[1]], o.floor[1], 3, true),
      // 履带盒底边贴地(车体盒高 1.93 → 地面 y = −0.965),从前主动轮到后诱导轮约 5.6 m
      ...pair('track', 'track', 'hull', [o.track.x, -0.59, 0], [o.track.width, 0.75, 5.6]),
      { id: 'traverse', type: 'traverse', part: 'turret', center: [0.3, -0.2, -0.2], size: [0.3, 0.3, 0.3] },
      { id: 'elevation', type: 'elevation', part: 'turret', center: [0.3, 0.3, -0.8], size: [0.25, 0.3, 0.25] },
      { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, o.breech.z], size: [0.3, 0.3, o.breech.length] },
      { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -bl / 2], size: [0.16, 0.16, bl] },
    ],
    crew: [
      crew('driver', 'hull', -0.55, 0.05, -2.3),
      crew('radio', 'hull', 0.55, 0.05, -2.3),
      crew('gunner', 'turret', 0.45, 0.05, -0.45),
      crew('commander', 'turret', 0.5, 0.35, 0.45),
      crew('loader', 'turret', -0.5, 0.0, 0.2),
    ],
  };
}

/** M4A3(76)W(VVSS,1944 年 3 月起):T23 炮塔、76 mm M1A1、湿式弹药架 */
export const M4A3_76W: VehicleSpec = {
  id: 'm4a3_76w',
  name: 'M4A3(76)W',
  nation: 'usa',
  vehicleClass: 'medium',
  serviceYear: 1944, // Hunnicutt 1994: 1944 年 3 月验收、夏欧战投入使用
  family: 'm4a3',
  crewAce: {
    // 现有装填 7.6 s 与 WT 新手 7.6 s 一致,直接取 WT 王牌值
    reloadTime: 5.9, // War Thunder 值
    // 现有 24°/s(史料液压),WT 新手 14.7°/s → 王牌 21.0°/s,按 WT 新手→王牌比例折算:24 × (21.0 / 14.7) = 24 × (10 / 7) ≈ 34.29°/s
    turretRotationSpeed: 34.29,
    // 现有高低机 2.8°/s 与 WT 新手 2.8°/s 一致,直接取 WT 王牌值
    elevationSpeed: 4.0, // War Thunder 值
  },
  // 首上 63.5@47° → 93(首下铸造传动罩 108,分界高度 1.0m);侧面 38.1 垂直;后部 38.1@10–22° ≈ 40
  armor: { front: 93, side: 38, rear: 40, lowerFront: { thickness: 108, height: 1.0 } },
  // 炮盾 88.9 垂直(炮盾外的正面 63.5@40–45° ≈ 83–90);侧面 63.5@0–13° ≈ 64;后部 63.5 垂直
  turretArmor: { front: 89, side: 64, rear: 64 },
  maxSpeed: 42, // 26 mph 持续公路速度
  turretRotationSpeed: 24, // 液压方向机
  weapons: [gun76('76 mm M1A1'), m1919a4Coax()],
  // 车长 6.29(不含炮)/ 宽 2.68(带挡泥板)/ 全高 2.97,战斗全重 32.3 t(《Catalogue of Standard Ordnance Items》)
  // 转向按固定半径转向估算;加速度按功重比 13.9 hp/t 比照 T-34-85 估算(5.5 × 13.9 / 15.6)
  hull: { length: 6.29, width: 2.68, height: 1.93, turnRate: 15, turnRadius: 9.5, acceleration: 4.9 },
  // 俯仰 −12° / +25°;炮口伸出车首 47 in = 1.19 m → barrelLength = 1.19 − 2.5/2 + 6.29/2 ≈ 3.09(真实身管 52 倍径 3.96 m)
  // 高低机 2.8°/s 为 War Thunder 值(历史满改、新手乘员)
  turret: { length: 2.5, width: 2.2, height: 0.72, barrelLength: 3.09, elevation: [-12, 25], elevationSpeed: 2.8 },
  // M71D 望远镜:倍率用 War Thunder 值 4.3–5×
  sight: { magnifications: [4.3, 5], reticle: 'us' },
  // 共 71 发:炮塔待发弹架 6 发(最先取空),传动轴两侧湿式弹药箱 35 + 30 发;T48 / T51 履带宽 0.42,履带中心距 2.11
  internals: shermanInternals({
    ready: 6,
    floor: [35, 30],
    floorLength: [1.4, 1.2],
    track: { x: 1.055, width: 0.42 },
    barrelLength: 3.09,
    breech: { z: 0.9, length: 1.0 },
  }),
  color: 0x544f3d, // 二战美军 Olive Drab No. 9 / No. 319(FS 595 色号 FS 33070)
};

/** M4A3E8(M4A3(76)W HVSS,1944 年 8 月起):车体、炮塔同 M4A3(76)W,换水平螺旋弹簧悬挂和宽履带,76 mm M1A2 带制退器 */
export const M4A3E8: VehicleSpec = {
  id: 'm4a3e8',
  name: 'M4A3E8',
  nation: 'usa',
  vehicleClass: 'medium',
  serviceYear: 1944, // Hunnicutt 1994: 1944 年 8 月验收、12 月阿登战役实战
  family: 'm4a3',
  crewAce: {
    // 现有装填 7.6 s 与 WT 新手 7.6 s 一致,直接取 WT 王牌值
    reloadTime: 5.9, // War Thunder 值
    // 现有 24°/s,按 WT 新手→王牌比例折算:24 × (10 / 7) ≈ 34.29°/s
    turretRotationSpeed: 34.29,
    // 现有高低机 2.8°/s 与 WT 新手 2.8°/s 一致,直接取 WT 王牌值
    elevationSpeed: 4.0, // War Thunder 值
  },
  armor: { front: 93, side: 38, rear: 40, lowerFront: { thickness: 108, height: 1.0 } },
  turretArmor: { front: 89, side: 64, rear: 64 },
  maxSpeed: 42,
  turretRotationSpeed: 24,
  weapons: [gun76('76 mm M1A2'), m1919a4Coax()],
  // 车长 6.27(不含炮)/ 宽 3.00(带挡泥板)/ 全高 2.97,战斗全重 33.7 t(Hunnicutt 1994)
  // 加速度按功重比 13.4 hp/t 比照 T-34-85 估算(5.5 × 13.4 / 15.6)
  hull: { length: 6.27, width: 3.0, height: 1.93, turnRate: 15, turnRadius: 9.5, acceleration: 4.7 },
  // 炮口伸出车首 50 in = 1.27 m(比 VVSS 型多出的 3 in 是制退器)→ barrelLength = 1.27 − 2.5/2 + 6.27/2 ≈ 3.16
  turret: { length: 2.5, width: 2.2, height: 0.72, barrelLength: 3.16, elevation: [-12, 25], elevationSpeed: 2.8 },
  sight: { magnifications: [4.3, 5], reticle: 'us' },
  // 共 71 发,布局同 M4A3(76)W;T66 履带宽 0.58,履带中心距 2.26
  internals: shermanInternals({
    ready: 6,
    floor: [35, 30],
    floorLength: [1.4, 1.2],
    track: { x: 1.13, width: 0.58 },
    barrelLength: 3.16,
    breech: { z: 0.9, length: 1.0 },
  }),
  color: 0x544f3d, // Olive Drab No. 9 / No. 319(FS 33070)
};

/**
 * M4A3E2「Jumbo」突击坦克(1944 年 6 月起,254 辆):首上、侧面加焊附加装甲,单块加厚传动罩,厚壁炮塔(T23 改),
 * 75 mm M3(T110 炮架)。按出厂状态做 75 mm 型;战地换装 76 mm 的车不做。
 */
export const M4A3E2: VehicleSpec = {
  id: 'm4a3e2',
  name: 'M4A3E2',
  nation: 'usa',
  vehicleClass: 'medium',
  serviceYear: 1944, // Hunnicutt 1994: 1944 年 5–6 月制造、秋欧战投入使用
  family: 'm4a3',
  crewAce: {
    // 现有装填 6.5 s 与 WT 新手 6.5 s 一致,直接取 WT 王牌值
    reloadTime: 5.0, // War Thunder 值
    // 现有 24°/s,按 WT 新手→王牌比例折算:24 × (10 / 7) ≈ 34.29°/s
    turretRotationSpeed: 34.29,
    // 现有高低机 2.8°/s 与 WT 新手 2.8°/s 一致,直接取 WT 王牌值
    elevationSpeed: 4.0, // War Thunder 值
  },
  // 首上 101.6@47° → 149(首下加厚传动罩 140,分界高度 1.0m);上部侧面 76.2 垂直(下部 38.1,藏在行走机构后面);后部 38.1@10–22° ≈ 40
  armor: { front: 149, side: 76, rear: 40, lowerFront: { thickness: 140, height: 1.0 } },
  // 炮盾 177.8 垂直;炮塔正面 152.4@12° ≈ 156(炮盾覆盖大部分,取炮盾值);侧面 152.4@6° ≈ 153;后部 152.4@2° ≈ 152
  turretArmor: { front: 178, side: 153, rear: 152 },
  maxSpeed: 35, // 22 mph 持续公路速度(改了最终传动比)
  turretRotationSpeed: 24,
  weapons: [
    {
      id: 'm3_75',
      name: '75 mm M3',
      reloadTime: 6.5, // War Thunder 值(新手乘员;满级 5 s)
      ammo: [
        // 被帽 + 风帽,6.63 kg;装药没查到,用 War Thunder 值 65 g Explosive D(TNT 当量 64 g)、引信延时 1.2 m、灵敏度 14 mm
        // 88/81/73/59 mm @ 100/500/1000/2000 m(Bird & Livingston,90° RHA)→ 炮口 90,阻力系数按表拟合
        { id: 'm61', name: 'M61', type: 'APCBC-HE', caliber: 75, mass: 6.63, muzzleVelocity: 618, penetration: 90, explosiveMass: 64, fuseDelay: 1.2, fuseSensitivity: 14, dragCoefficient: 0.37 },
        // 整体实心弹,6.32 kg;109/92/76/51 mm @ 100/500/1000/2000 m → 炮口 113,阻力系数 0.67
        { id: 'm72', name: 'M72', type: 'AP', caliber: 75, mass: 6.32, muzzleVelocity: 619, penetration: 113, explosiveMass: 0, fuseDelay: 0, fuseSensitivity: 0, dragCoefficient: 0.67 },
        // 6.76 kg,680 g TNT;初速按普通装药 463 m/s(加强装药 594 m/s,War Thunder 也取 463)
        { id: 'm48', name: 'M48', type: 'HE', caliber: 75, mass: 6.76, muzzleVelocity: 463, penetration: hePenetration(0.68), explosiveMass: 680, fuseDelay: 0, fuseSensitivity: 0.1 },
      ],
    },
    m1919a4Coax(),
  ],
  // 车长 6.27(不含炮)/ 宽 2.94(带挡泥板)/ 全高 2.95,战斗全重 38.0 t(Hunnicutt 1994)
  // 最小转向直径 74 ft(76 mm 车 62 ft),转向速度按同样方法缩小到 13°/s;加速度按功重比 11.8 hp/t 比照 T-34-85 估算(5.5 × 11.8 / 15.6)
  hull: { length: 6.27, width: 2.94, height: 1.93, turnRate: 13, turnRadius: 11.25, acceleration: 4.2 },
  // 俯仰 −10° / +25°;炮口伸出车首 0 in → barrelLength = 0 − 2.5/2 + 6.27/2 ≈ 1.89(真实身管 40 倍径 3.0 m)
  // 炮塔盒比 T23 宽 0.15 m(侧壁 152 mm 对 64 mm);火线高资料为 2.24 m,模型按同一车体 / 炮塔盒高取 2.29 m
  // 高低机 2.8°/s 为 War Thunder 值
  turret: { length: 2.5, width: 2.35, height: 0.72, barrelLength: 1.89, elevation: [-10, 25], elevationSpeed: 2.8 },
  // M71G 望远镜:倍率用 War Thunder 值 4.3–5×
  sight: { magnifications: [4.3, 5], reticle: 'us' },
  // 共 104 发:炮塔待发弹架 4 发,车底 10 个湿式弹药箱 100 发(按同厂 M4A3(75)W 的布局,两侧各算 50 发)
  // T48 履带加宽端联器(鸭嘴)后宽 0.51,履带中心距 2.11;鸭嘴装在外侧,履带盒中心外移 0.045
  internals: shermanInternals({
    ready: 4,
    floor: [50, 50],
    floorLength: [1.6, 1.6],
    track: { x: 1.1, width: 0.51 },
    barrelLength: 1.89,
    breech: { z: 0.7, length: 0.8 },
  }),
  color: 0x544f3d, // Olive Drab No. 9 / No. 319(FS 33070)
};

export const VEHICLES: Readonly<Record<string, VehicleSpec>> = {
  [TIGER_I.id]: TIGER_I,
  [T34_85.id]: T34_85,
  [TIGER_II.id]: TIGER_II,
  [SU_100.id]: SU_100,
  [ISU_122.id]: ISU_122,
  [M4A3_76W.id]: M4A3_76W,
  [M4A3E8.id]: M4A3E8,
  [M4A3E2.id]: M4A3E2,
};
