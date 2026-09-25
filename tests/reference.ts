/**
 * 公开资料里的真实数据,只给物理校验测试用。出处见 docs/physics-validation.md。
 * 穿深表:对均质装甲板、50% 击穿判据;flat = 垂直板(0°),at30 = 30° 倾角板。
 */

export interface PenetrationTable {
  /** 炮弹 id(见 data/vehicles.ts 各炮的 ammo) */
  shellId: string;
  vehicleId: string;
  flat: Record<number, number>;
  at30?: Record<number, number>;
}

export const PENETRATION_TABLES: PenetrationTable[] = [
  {
    shellId: 'pzgr39',
    vehicleId: 'tiger_i',
    flat: { 100: 162, 500: 151, 1000: 138, 1500: 126, 2000: 116 },
    at30: { 100: 132, 500: 110, 1000: 99, 1500: 91, 2000: 83 },
  },
  {
    shellId: 'pzgr39_43',
    vehicleId: 'tiger_ii',
    flat: { 100: 233, 500: 219, 1000: 204, 1500: 190, 2000: 176 },
    at30: { 100: 202, 500: 185, 1000: 165, 1500: 148, 2000: 132 },
  },
  {
    shellId: 'br365',
    vehicleId: 't34_85',
    flat: { 500: 125, 1000: 107 },
  },
  // 硬芯弹:美方计算值(240 BHN 均质板,50% 判据),出处见 docs/physics-validation.md 第 8 节
  {
    shellId: 'pzgr40',
    vehicleId: 'tiger_i',
    flat: { 100: 219, 500: 200, 1000: 179, 1500: 160, 2000: 143 },
  },
  {
    shellId: 'pzgr40_43',
    vehicleId: 'tiger_ii',
    flat: { 100: 304, 500: 282, 1000: 257, 1500: 234, 2000: 213 },
  },
  {
    shellId: 'br365p',
    vehicleId: 't34_85',
    flat: { 100: 175, 500: 136, 1000: 100, 1500: 73 },
  },
];

/** 战斗全重、发动机功率(有效值取总功率,传动损失由测试里的效率区间体现) */
export const REAL_VEHICLES: Record<string, { massT: number; engineKW: number }> = {
  tiger_i: { massT: 57, engineKW: 515 },
  t34_85: { massT: 32.4, engineKW: 370 },
  tiger_ii: { massT: 69.8, engineKW: 510 },
};
