import type { SurfaceType } from '../data/types';
import { SURFACES } from '../data/surfaces';

/**
 * 纯函数: 根据 sRGB 颜色(十六进制 0xRRGGBB)计算相对亮度 (Relative Luminance)。
 * 标准系数: 0.2126 R + 0.7152 G + 0.0722 B, 分量归一化到 0..1。
 */
export function relativeLuminance(hex: number): number {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 地表类型对应的代表相对亮度表。
 * 复用 src/data/surfaces.ts 中各地表的基准显示颜色(SURFACES[type].color)计算相对亮度;
 * 数值与依据(估算, 取自游戏内实测地表顶点色):
 * - grass (草地 0x6d8a3e): 相对亮度约 0.495 (暗/中等地面, < 0.55)
 * - dirt  (土地 0x8c7b4f): 相对亮度约 0.484 (暗/中等地面, < 0.55)
 * - sand  (沙地 0xcdb57e): 相对亮度约 0.714 (浅色沙地过渡段)
 * - rock  (岩地 0x857d70): 相对亮度约 0.493 (暗/中等地面, < 0.55)
 * - mud   (泥滩 0x5d523a): 相对亮度约 0.324 (暗地面, < 0.55)
 * - water (浅水 0x4b6d63): 相对亮度约 0.396 (暗地面, < 0.55)
 * - snow  (雪地 0xe4eaee): 相对亮度约 0.914 (高亮雪地, ≥ 0.75)
 */
export const SURFACE_LUMINANCE: Readonly<Record<SurfaceType, number>> = {
  grass: relativeLuminance(SURFACES.grass.color),
  dirt: relativeLuminance(SURFACES.dirt.color),
  sand: relativeLuminance(SURFACES.sand.color),
  rock: relativeLuminance(SURFACES.rock.color),
  mud: relativeLuminance(SURFACES.mud.color),
  water: relativeLuminance(SURFACES.water.color),
  snow: relativeLuminance(SURFACES.snow.color),
};

/**
 * 查询指定地表类型的亮度 (0..1)
 */
export function surfaceLuminance(surface: SurfaceType): number {
  return SURFACE_LUMINANCE[surface] ?? 0.5;
}
