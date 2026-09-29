import type { VehicleSpec } from '../data/types';

/**
 * 固定战斗室(无炮塔)车辆的瞄准规则。角度约定和 Vehicle.turretYaw 一致:
 * 火炮相对车体的水平角,弧度,0 = 朝车头,正值 = 向左。
 */

const DEG2RAD = Math.PI / 180;
/** 自动转向:瞄准点超出射界这么多角度时打满方向,少于这个值按比例转(避免来回摆) */
const AUTO_STEER_FULL = 6 * DEG2RAD;

/** 是否固定战斗室(火炮只能在射界内转) */
export function isCasemate(spec: VehicleSpec): boolean {
  return spec.turret.traverse !== undefined;
}

/** 火炮水平角的允许范围 [最小(向右,负), 最大(向左,正)],弧度;360° 炮塔返回 null */
export function yawLimits(spec: VehicleSpec): readonly [min: number, max: number] | null {
  const t = spec.turret.traverse;
  return t ? [-t[1] * DEG2RAD, t[0] * DEG2RAD] : null;
}

/** 把想要的水平角夹进射界;360° 炮塔原样返回 */
export function clampYaw(spec: VehicleSpec, yaw: number): number {
  const lim = yawLimits(spec);
  return lim ? Math.min(lim[1], Math.max(lim[0], yaw)) : yaw;
}

/**
 * 瞄准点超出射界时的自动转向量(与 VehicleControls.steer 同号:正值 = 向左转),-1..1。
 * 在射界内返回 0;超出越多转得越快,超出 AUTO_STEER_FULL 以上打满。
 * desiredYaw 是瞄准点相对车体的水平角(−π..π),所以目标在正后方时也按近的一侧转。
 */
export function autoSteer(spec: VehicleSpec, desiredYaw: number): number {
  const lim = yawLimits(spec);
  if (!lim) return 0;
  const excess = desiredYaw - Math.min(lim[1], Math.max(lim[0], desiredYaw));
  return Math.max(-1, Math.min(1, excess / AUTO_STEER_FULL));
}
