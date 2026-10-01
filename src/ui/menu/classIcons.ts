import type { VehicleClass } from '../../data/types';
import { injectClassIconStyles } from './styles';
import { currentSymbology, symbolSvg } from '../symbols';

/**
 * 类型图标的内联 SVG 字符串。颜色用 currentColor(跟随文字颜色),带 role="img" 和中文 aria-label。
 * 内部委托给 symbolSvg，符号体系跟随 currentSymbology()。
 * size:像素边长,缺省 14。
 */
export function classIcon(vehicleClass: VehicleClass, size: number = 14): string {
  injectClassIconStyles();
  if (!vehicleClass) {
    return '';
  }
  return symbolSvg(vehicleClass, { set: currentSymbology(), size });
}
