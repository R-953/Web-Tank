import type * as THREE from 'three';
import type { InputManager } from '../engine/Input';
import type { VehicleControls } from './Vehicle';
import { DEFAULT_CONTROLS } from '../data/controls';

/** 当前键位(默认值见 data/controls.ts;以后的自定义按键界面改的就是那份数据) */
export const KEYS = DEFAULT_CONTROLS.keys;

const any = (input: InputManager, codes: readonly string[]) => codes.some((c) => input.isDown(c));
/** 按住,或本帧内按下又松开(快速点击)都算 */
const pressedOrHeld = (input: InputManager, codes: readonly string[]) =>
  codes.some((c) => input.isDown(c) || input.wasPressed(c));

/**
 * 把键鼠输入翻译成载具控制。WASD 控制车体,鼠标决定瞄准点(由相机射线算出),
 * 左键或空格开火;sightRange 为表尺距离(滚轮调)。active = false(未锁定鼠标 / 已结束)时不产生任何输入。
 */
export function readPlayerControls(
  input: InputManager,
  aimPoint: THREE.Vector3 | null,
  active: boolean,
  sightRange = 0,
): VehicleControls {
  if (!active) return { throttle: 0, steer: 0, aimPoint, fire: false, sightRange };
  return {
    throttle: (any(input, KEYS.forward) ? 1 : 0) - (any(input, KEYS.back) ? 1 : 0),
    steer: (any(input, KEYS.left) ? 1 : 0) - (any(input, KEYS.right) ? 1 : 0),
    aimPoint,
    fire: input.isMouseDown(0) || input.wasMousePressed(0) || pressedOrHeld(input, KEYS.fire),
    sightRange,
  };
}

/** 本帧是否刚按下某组键中的任意一个 */
export function pressed(input: InputManager, codes: readonly string[]): boolean {
  return codes.some((c) => input.wasPressed(c));
}
