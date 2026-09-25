import type { CrewRole, ModuleType } from './types';

/**
 * 模块 / 乘员的固定参数(按类型,所有载具通用)。
 * 血量单位是抽象的「耐久」,与 data/damage.ts 里的伤害值配套调。
 */
export interface ModuleTypeSpec {
  name: string;
  hp: number;
  /** 被打坏(血量归零)后的维修时间,秒;null = 不可维修 */
  repairTime: number | null;
  /** 炮弹本体穿过该模块时损失的穿深,mm(模块自身的「内部装甲」) */
  absorb: number;
}

export const MODULE_TYPES: Readonly<Record<ModuleType, ModuleTypeSpec>> = {
  engine: { name: '发动机', hp: 160, repairTime: 20, absorb: 30 },
  transmission: { name: '传动', hp: 160, repairTime: 20, absorb: 30 },
  track: { name: '履带', hp: 120, repairTime: 10, absorb: 20 },
  barrel: { name: '炮管', hp: 100, repairTime: 15, absorb: 0 },
  breech: { name: '炮闩', hp: 150, repairTime: 15, absorb: 40 },
  // 弹药架被打坏即殉爆,车辆直接被摧毁,所以不可维修
  ammo: { name: '弹药架', hp: 60, repairTime: null, absorb: 10 },
  fuel: { name: '油箱', hp: 100, repairTime: 10, absorb: 10 },
  traverse: { name: '方向机', hp: 60, repairTime: 10, absorb: 10 },
  elevation: { name: '高低机', hp: 60, repairTime: 10, absorb: 10 },
};

export const CREW_ROLE_NAMES: Readonly<Record<CrewRole, string>> = {
  commander: '车长',
  gunner: '炮手',
  loader: '装填手',
  driver: '驾驶员',
  radio: '机电员',
};

export const CREW = {
  /** 每名乘员的血量 */
  hp: 100,
  /** 乘员的「躯干」碰撞盒尺寸 [宽, 高, 深],m */
  size: [0.45, 0.85, 0.45] as const,
  /** 炮弹本体穿过乘员时损失的穿深,mm */
  absorb: 5,
  /** 顶替阵亡乘员岗位所需时间,秒 */
  swapTime: 5,
  /** 存活人数低于该值即判定载具被摧毁(一人开车、一人开火装填) */
  minAlive: 2,
};
