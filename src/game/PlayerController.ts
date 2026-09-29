import type * as THREE from 'three';
import type { ActionInput } from '../engine/ActionInput';
import type { VehicleControls } from './Vehicle';

/**
 * 把操作输入翻译成载具控制。前进 / 后退 / 左右转控制车体,鼠标决定瞄准点(由相机射线算出),
 * 主炮 / 机枪按各自的键开火;sightRange 为表尺距离。active = false(未锁定鼠标 / 已结束)时不产生任何输入。
 * 按住,或本帧内按下又松开(快速点击)都算开火。
 */
export function readPlayerControls(
  actions: ActionInput,
  aimPoint: THREE.Vector3 | null,
  active: boolean,
  sightRange = 0,
): VehicleControls {
  if (!active) return { throttle: 0, steer: 0, aimPoint, fire: false, fireMg: false, sightRange };
  const held = (a: Parameters<ActionInput['isDown']>[0]) => actions.isDown(a) || actions.pressed(a);
  return {
    throttle: (actions.isDown('forward') ? 1 : 0) - (actions.isDown('back') ? 1 : 0),
    steer: (actions.isDown('left') ? 1 : 0) - (actions.isDown('right') ? 1 : 0),
    aimPoint,
    fire: held('fireMain'),
    fireMg: held('fireMg'),
    sightRange,
  };
}
