import { describe, it, expect } from 'vitest';
import {
  xrayContrastFor,
  xrayShellStyle,
  DARK_GROUND_CONTRAST,
  BRIGHT_GROUND_CONTRAST,
} from '../src/ui/WorldXray';
import {
  relativeLuminance,
  SURFACE_LUMINANCE,
  surfaceLuminance,
} from '../src/ui/surfaceLuminance';
import type { SurfaceType } from '../src/data/types';

describe('surfaceLuminance 地面相对亮度表与计算', () => {
  it('relativeLuminance 相对亮度纯函数符合 sRGB 公式 (0.2126 R + 0.7152 G + 0.0722 B)', () => {
    // 纯黑为 0, 纯白为 1
    expect(relativeLuminance(0x000000)).toBeCloseTo(0, 5);
    expect(relativeLuminance(0xffffff)).toBeCloseTo(1, 5);
    // 单通道
    expect(relativeLuminance(0xff0000)).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance(0x00ff00)).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance(0x0000ff)).toBeCloseTo(0.0722, 4);
  });

  it('每个 SurfaceType 都在 SURFACE_LUMINANCE 表中且取值在 [0, 1] 内', () => {
    const allSurfaces: SurfaceType[] = ['grass', 'dirt', 'sand', 'rock', 'mud', 'water', 'snow'];
    for (const s of allSurfaces) {
      expect(s in SURFACE_LUMINANCE).toBe(true);
      const lum = SURFACE_LUMINANCE[s];
      expect(lum).toBeGreaterThanOrEqual(0);
      expect(lum).toBeLessThanOrEqual(1);
      expect(surfaceLuminance(s)).toBe(lum);
    }
  });

  it('SURFACES 中的雪地为高亮(>= 0.75), 草地/泥地等为暗/中等地面(< 0.55)', () => {
    expect(surfaceLuminance('snow')).toBeGreaterThanOrEqual(0.75);
    expect(surfaceLuminance('grass')).toBeLessThan(0.55);
    expect(surfaceLuminance('dirt')).toBeLessThan(0.55);
    expect(surfaceLuminance('rock')).toBeLessThan(0.55);
    expect(surfaceLuminance('mud')).toBeLessThan(0.55);
    expect(surfaceLuminance('water')).toBeLessThan(0.55);
  });
});

describe('xrayContrastFor 纯函数: 三段与连续性', () => {
  it('暗段 (地面亮度 <= 0.55): 保持基准样式 (灰壳 0x8a9399、白轮廓线)', () => {
    const darkSampleValues = [-0.1, 0, 0.2, 0.4, 0.54, 0.55];
    for (const lum of darkSampleValues) {
      const c = xrayContrastFor(lum);
      expect(c.grayHex).toBe(DARK_GROUND_CONTRAST.grayHex);
      expect(c.shellOpacity).toBeCloseTo(DARK_GROUND_CONTRAST.shellOpacity, 5);
      expect(c.edgeHex).toBe(DARK_GROUND_CONTRAST.edgeHex);
      expect(c.edgeOpacity).toBeCloseTo(DARK_GROUND_CONTRAST.edgeOpacity, 5);
    }
  });

  it('亮段 (地面亮度 >= 0.75): 不增强对比度 (灰壳压暗、轮廓线深灰)', () => {
    const brightSampleValues = [0.75, 0.8, 0.914, 1.0, 1.2];
    for (const lum of brightSampleValues) {
      const c = xrayContrastFor(lum);
      expect(c.grayHex).toBe(BRIGHT_GROUND_CONTRAST.grayHex);
      expect(c.shellOpacity).toBeCloseTo(BRIGHT_GROUND_CONTRAST.shellOpacity, 5);
      expect(c.edgeHex).toBe(BRIGHT_GROUND_CONTRAST.edgeHex);
      expect(c.edgeOpacity).toBeCloseTo(BRIGHT_GROUND_CONTRAST.edgeOpacity, 5);
    }
  });

  it('过渡段 (0.55 < 地面亮度 < 0.75): 平滑单调线性插值', () => {
    const c055 = xrayContrastFor(0.55);
    const c060 = xrayContrastFor(0.60);
    const c065 = xrayContrastFor(0.65);
    const c070 = xrayContrastFor(0.70);
    const c075 = xrayContrastFor(0.75);

    // 不透明度严格单调
    expect(c060.shellOpacity).toBeGreaterThan(c055.shellOpacity);
    expect(c065.shellOpacity).toBeGreaterThan(c060.shellOpacity);
    expect(c070.shellOpacity).toBeGreaterThan(c065.shellOpacity);
    expect(c075.shellOpacity).toBeGreaterThan(c070.shellOpacity);

    expect(c065.edgeOpacity).toBeCloseTo((c055.edgeOpacity + c075.edgeOpacity) / 2, 4);

    // 轮廓线由白 (0xffffff) 逐步变为深灰 (0x222222)
    const getEdgeR = (hex: number) => (hex >> 16) & 0xff;
    expect(getEdgeR(c060.edgeHex)).toBeLessThan(getEdgeR(c055.edgeHex));
    expect(getEdgeR(c065.edgeHex)).toBeLessThan(getEdgeR(c060.edgeHex));
    expect(getEdgeR(c070.edgeHex)).toBeLessThan(getEdgeR(c065.edgeHex));
    expect(getEdgeR(c075.edgeHex)).toBeLessThan(getEdgeR(c070.edgeHex));
  });

  it('边界无跳变(连续性): 在 0.55 和 0.75 临界点左右极限相等', () => {
    const eps = 1e-4;
    const cLeft55 = xrayContrastFor(0.55 - eps);
    const cRight55 = xrayContrastFor(0.55 + eps);
    expect(cRight55.shellOpacity).toBeCloseTo(cLeft55.shellOpacity, 3);
    expect(cRight55.edgeOpacity).toBeCloseTo(cLeft55.edgeOpacity, 3);

    const cLeft75 = xrayContrastFor(0.75 - eps);
    const cRight75 = xrayContrastFor(0.75 + eps);
    expect(cRight75.shellOpacity).toBeCloseTo(cLeft75.shellOpacity, 3);
    expect(cRight75.edgeOpacity).toBeCloseTo(cLeft75.edgeOpacity, 3);
  });
});

describe('xrayShellStyle 纯函数带 contrast 表现', () => {
  it('缺省参数下 xrayShellStyle 与原来严格一致', () => {
    // k = 0
    expect(xrayShellStyle(0)).toEqual({
      opacity: 1.0,
      grayMix: 0.0,
      edgeOpacity: 0.0,
    });
    // k = 1
    expect(xrayShellStyle(1)).toEqual({
      opacity: 0.12,
      grayMix: 1.0,
      edgeOpacity: 0.35,
    });
    // k = 0.5
    const styleHalf = xrayShellStyle(0.5);
    expect(styleHalf.opacity).toBeCloseTo(0.56, 5);
    expect(styleHalf.grayMix).toBeCloseTo(0.5, 5);
    expect(styleHalf.edgeOpacity).toBeCloseTo(0.175, 5);
  });

  it('传入 contrast 时按 contrast 目标调整透明度与颜色', () => {
    const snowContrast = xrayContrastFor(0.9);
    const style1 = xrayShellStyle(1, snowContrast);
    expect(style1.opacity).toBeCloseTo(snowContrast.shellOpacity, 5);
    expect(style1.grayMix).toBeCloseTo(1.0, 5);
    expect(style1.edgeOpacity).toBeCloseTo(snowContrast.edgeOpacity, 5);
    expect(style1.grayHex).toBe(snowContrast.grayHex);
    expect(style1.edgeHex).toBe(snowContrast.edgeHex);

    const style0 = xrayShellStyle(0, snowContrast);
    expect(style0.opacity).toBeCloseTo(1.0, 5);
    expect(style0.grayMix).toBeCloseTo(0.0, 5);
    expect(style0.edgeOpacity).toBeCloseTo(0.0, 5);
  });
});
