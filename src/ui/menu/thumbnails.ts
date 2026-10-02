import type { VehicleSpec } from '../../data/types';

/**
 * 载具缩略图(PNG data URL,透明背景)。
 * 占位实现:永远返回 null,调用方退回剪影。真正的离屏渲染见任务卡 047。
 * 没有 WebGL(jsdom、无 GPU)或渲染失败时也返回 null,调用方要能处理。
 */
export function vehicleThumbnail(_spec: VehicleSpec): string | null {
  return null;
}
