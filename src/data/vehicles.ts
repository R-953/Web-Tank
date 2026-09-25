import type { CrewSpec, ModuleSpec, VehicleSpec } from './types';
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
function rack(id: string, part: ModuleSpec['part'], center: [number, number, number], size: [number, number, number], capacity: number, drawOrder: number): ModuleSpec {
  return { id, type: 'ammo', part, center, size, capacity, drawOrder };
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
  // 首上 45@60° → 90;侧面下部 45 垂直(上部 45@40° ≈ 59);后部 45@45° ≈ 64
  armor: { front: 90, side: 45, rear: 64 },
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
  ],
  // 车体长 6.10 / 宽 3.00 / 全高约 2.6;转向速度为估算值
  hull: { length: 6.1, width: 3.0, height: 1.62, turnRate: 20, acceleration: 5.5 },
  // 俯仰 -5° / +22°;高低机为手摇,估算 4°/s
  turret: { length: 2.6, width: 2.3, height: 1.0, barrelLength: 3.9, elevation: [-5, 22], elevationSpeed: 4 },
  // TSh-16:4×,视场 16°
  sight: { magnifications: [4], reticle: 'soviet' },
  internals: {
    modules: [
      { id: 'engine', type: 'engine', part: 'hull', center: [0, -0.05, 1.3], size: [1.1, 0.9, 1.4] },
      { id: 'transmission', type: 'transmission', part: 'hull', center: [0, -0.25, 2.5], size: [1.6, 0.6, 0.8] },
      ...pair('fuel', 'fuel', 'hull', [1.2, 0.2, 0.2], [0.35, 0.55, 2.2]),
      // 共 55 发:炮塔尾舱 12 发(最先取空)、炮塔右壁 4 发、车体右侧 4 发、车底 6 个弹箱 35 发
      rack('ammo_floor', 'hull', [0, -0.55, -0.5], [1.4, 0.3, 1.3], 35, 4),
      rack('ammo_hull_r', 'hull', [1.2, 0.25, -1.5], [0.3, 0.5, 0.6], 4, 3),
      ...pair('track', 'track', 'hull', [1.25, -0.425, 0], [0.5, 0.77, 6.0]),
      rack('ammo_bustle', 'turret', [0, 0.5, 1.05], [1.2, 0.35, 0.3], 12, 1),
      rack('ammo_turret_r', 'turret', [0.85, 0.35, 0.45], [0.2, 0.45, 0.45], 4, 2),
      { id: 'traverse', type: 'traverse', part: 'turret', center: [-0.3, -0.2, -0.15], size: [0.3, 0.3, 0.3] },
      { id: 'elevation', type: 'elevation', part: 'turret', center: [-0.3, 0.3, -0.85], size: [0.25, 0.3, 0.25] },
      { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, 0.9], size: [0.3, 0.3, 1.0] },
      { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -1.95], size: [0.18, 0.18, 3.9] },
    ],
    crew: [
      crew('driver', 'hull', -0.45, -0.1, -2.2),
      crew('radio', 'hull', 0.5, -0.1, -2.2),
      crew('gunner', 'turret', -0.5, 0.05, -0.45),
      crew('commander', 'turret', -0.5, 0.3, 0.5),
      crew('loader', 'turret', 0.55, 0.0, 0.05),
    ],
  },
  color: 0x4b5a2c,
};

/** 静止靶:虎式 II 型(亨舍尔炮塔)。正面 88mm L/56 打不穿,用来验证「绕侧面打」。 */
export const TIGER_II: VehicleSpec = {
  id: 'tiger_ii',
  name: '虎王(亨舍尔炮塔)',
  // 首上 150@50° ≈ 233(首下 100@50° ≈ 156 的弱点未建模);侧面下部 80 垂直(上部 80@25° ≈ 88);后部 80@30° ≈ 92
  armor: { front: 233, side: 80, rear: 92 },
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

export const VEHICLES: Readonly<Record<string, VehicleSpec>> = {
  [TIGER_I.id]: TIGER_I,
  [T34_85.id]: T34_85,
  [TIGER_II.id]: TIGER_II,
};
