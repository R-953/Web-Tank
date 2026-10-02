import type { SurfaceType } from './types';

export interface SurfaceSpec {
  name: string;
  /** 地面颜色(顶点色) */
  color: number;
  /**
   * 履带车辆的滚动阻力系数(阻力 = 系数 × 重力)。硬地面取 0.05,与载具功率反推时用的基准一致,
   * 所以在草地上跑的是资料极速;沙地 0.10 时极速减半。量级参考履带车辆地面力学的常用取值范围,属估算。
   */
  rollingResistance: number;
  /** 附着系数倍数:限制起步牵引和侧向抓地 */
  grip: number;
}

export const SURFACES: Readonly<Record<SurfaceType, SurfaceSpec>> = {
  grass: { name: '草地', color: 0x6d8a3e, rollingResistance: 0.05, grip: 1 },
  dirt: { name: '土地', color: 0x8c7b4f, rollingResistance: 0.06, grip: 0.95 },
  sand: { name: '沙地', color: 0xcdb57e, rollingResistance: 0.1, grip: 0.8 },
  rock: { name: '岩地', color: 0x857d70, rollingResistance: 0.045, grip: 1 },
  mud: { name: '泥滩', color: 0x5d523a, rollingResistance: 0.12, grip: 0.7 },
  water: { name: '浅水', color: 0x4b6d63, rollingResistance: 0.15, grip: 0.7 },
  // 积雪(20–30 cm 的压实雪原):估算。阻力取草地 0.05 与沙地 0.10 之间的 0.08(履带车在这个厚度的雪里比硬地费力、
  // 但不像沙地那样陷),抓地取 0.75(雪面比泥滩 0.7 略好、比草地差)。颜色是微带蓝的雪白。
  snow: { name: '雪地', color: 0xe4eaee, rollingResistance: 0.08, grip: 0.75 },
};

/** 基准滚动阻力(载具功率按它和 maxSpeed 反推) */
export const REFERENCE_ROLLING_RESISTANCE = 0.05;
