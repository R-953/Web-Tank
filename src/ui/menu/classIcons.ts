import type { VehicleClass } from '../../data/types';
import { injectClassIconStyles } from './styles';
import { CLASS_NAMES } from './techTreeLayout';

/**
 * 类型图标的内联 SVG 字符串。颜色用 currentColor(跟随文字颜色),带 role="img" 和 aria-label(中文类别名,取 CLASS_NAMES)。
 * size:像素边长,缺省 14。
 */
export function classIcon(vehicleClass: VehicleClass, size: number = 14): string {
  injectClassIconStyles();
  const label = CLASS_NAMES[vehicleClass];
  if (!label) {
    return '';
  }

  let body = '';
  switch (vehicleClass) {
    case 'light':
      body = '<path d="M8 2.5L13.5 8L8 13.5L2.5 8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
      break;
    case 'medium':
      body = '<path d="M8 2.5L13.5 8L8 13.5L2.5 8Z" fill="currentColor"/>';
      break;
    case 'heavy':
      body = '<path d="M8 2L14 8L8 14L2 8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 5.4L10.6 8L8 10.6L5.4 8Z" fill="currentColor"/>';
      break;
    case 'td':
      body = '<path d="M2.5 3.5L13.5 3.5L8 13.5Z" fill="currentColor"/>';
      break;
    default:
      return '';
  }

  return `<svg class="vehicle-class-icon" viewBox="0 0 16 16" width="${size}" height="${size}" role="img" aria-label="${label}">${body}</svg>`;
}
