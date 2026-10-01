import type { VehicleClass } from '../data/types';

export type Symbology = 'nato' | 'warsaw';
export type Affiliation = 'friend' | 'hostile' | 'neutral';

export interface SymbolOptions {
  set: Symbology;
  /** 不传 = 只画类型符号,不画敌我识别框(机库、科技树里用) */
  affiliation?: Affiliation;
  /** 像素边长,缺省 16 */
  size?: number;
  /** 被击毁:灰色,叠一个 × */
  dead?: boolean;
}

export interface SymbolPath {
  d: string;
  fill: string;
  stroke: string;
  width?: number;
}

/** 纯数据:viewBox 0 0 32 32 里的若干路径;frame 只在传了 affiliation 时有 */
export interface SymbolShape {
  frame?: SymbolPath;
  parts: SymbolPath[];
}

/** APP-6 / MIL-STD-2525 标准色值与游戏统一配色 */
export const SYMBOL_COLORS = {
  friend: '#00a8f0', // 友军蓝 (APP-6 标准友军蓝)
  hostile: '#ff4d4d', // 敌军红 (APP-6 标准敌军红)
  neutral: '#00c800', // 中立绿 (APP-6 标准中立绿)
  dead: '#888888', // 击毁灰
} as const;

const SET_NAMES: Record<Symbology, string> = {
  nato: '北约',
  warsaw: '华约',
};

const CLASS_NAMES: Record<VehicleClass, string> = {
  light: '轻型坦克',
  medium: '中型坦克',
  heavy: '重型坦克',
  td: '坦克歼击车 / 突击炮',
};

const AFFILIATION_NAMES: Record<Affiliation, string> = {
  friend: '友军',
  hostile: '敌军',
  neutral: '中立',
};

let activeSymbology: Symbology = 'nato';

/** 当前使用的符号体系(main.ts 读设置后调用 setSymbology;classIcon 用 currentSymbology) */
export function setSymbology(set: Symbology): void {
  activeSymbology = set;
}

export function currentSymbology(): Symbology {
  return activeSymbology;
}

/**
 * 依据阵营、类型与被击毁状态生成 32x32 坐标系下的矢量路径。
 */
export function symbolShape(vehicleClass: VehicleClass, opts: SymbolOptions): SymbolShape {
  if (!CLASS_NAMES[vehicleClass]) {
    return { parts: [] };
  }

  // 1. 颜色决策: 被击毁用灰色, 传了 affiliation 时用对应阵营色, 不传时默认用 currentColor
  let strokeColor: string;
  if (opts.dead) {
    strokeColor = SYMBOL_COLORS.dead;
  } else if (opts.affiliation) {
    strokeColor = SYMBOL_COLORS[opts.affiliation];
  } else {
    strokeColor = 'currentColor';
  }

  // 2. 敌我识别框(只有传了 affiliation 时才有)
  let frame: SymbolPath | undefined;
  if (opts.affiliation) {
    switch (opts.affiliation) {
      case 'friend':
        // 北约/统一友军: 矩形 (宽 26, 高 18, 居中 (16, 16))
        frame = {
          d: 'M 3 7 H 29 V 25 H 3 Z',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        };
        break;
      case 'hostile':
        // 北约/统一敌军: 菱形
        frame = {
          d: 'M 16 2 L 30 16 L 16 30 L 2 16 Z',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        };
        break;
      case 'neutral':
        // 北约/统一中立: 正方形 (边长 22, 居中 (16, 16))
        frame = {
          d: 'M 5 5 H 27 V 27 H 5 Z',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        };
        break;
    }
  }

  // 3. 内部载具类型路径 (parts)
  const parts: SymbolPath[] = [];

  if (opts.set === 'nato') {
    // -------------------------------------------------------------
    // 北约 (APP-6 / MIL-STD-2525): 椭圆履带底盘 + 内部修饰线 / 反坦克倒 V
    // -------------------------------------------------------------
    // 基础装甲履带横椭圆 (宽 16, 高 8, 中心 (16, 16))
    parts.push({
      d: 'M 12 12 H 20 C 22.2 12 24 13.8 24 16 C 24 18.2 22.2 20 20 20 H 12 C 9.8 20 8 18.2 8 16 C 8 13.8 9.8 12 12 12 Z',
      fill: 'none',
      stroke: strokeColor,
      width: 2,
    });

    switch (vehicleClass) {
      case 'light':
        // 轻型坦克: 单道垂直分划线 (|)
        parts.push({
          d: 'M 16 12 V 20',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        });
        break;
      case 'medium':
        // 中型坦克: 双道垂直分划线 (||)
        parts.push({
          d: 'M 13.5 12.5 V 19.5 M 18.5 12.5 V 19.5',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        });
        break;
      case 'heavy':
        // 重型坦克: 三道垂直分划线 (|||)
        parts.push({
          d: 'M 12 12 V 20 M 16 12 V 20 M 20 12 V 20',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        });
        break;
      case 'td':
        // 坦克歼击车: 履带内嵌反坦克倒 V 楔形 (∧)
        parts.push({
          d: 'M 11.5 19 L 16 13.5 L 20.5 19',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        });
        break;
    }
  } else {
    // -------------------------------------------------------------
    // 华约 / 苏军 (苏军条令《Рабочая карта командира》战术标号):
    // 俯视几何构型: 车体 + 炮塔(或固定战斗室) + 延伸火炮身管
    // -------------------------------------------------------------
    switch (vehicleClass) {
      case 'medium':
        // 中型坦克 (如 T-34 标准战术标号):
        // 标准车体 + 居中圆炮塔 + 延伸身管
        parts.push({
          d: 'M 12 14 H 20 C 21.7 14 23 15.3 23 17 V 19 C 23 20.7 21.7 22 20 22 H 12 C 10.3 22 9 20.7 9 19 V 17 C 9 15.3 10.3 14 12 14 Z',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        });
        parts.push({
          d: 'M 16 15 A 3 3 0 1 0 16 21 A 3 3 0 1 0 16 15 Z',
          fill: strokeColor,
          stroke: strokeColor,
          width: 1,
        });
        parts.push({
          d: 'M 16 15 V 7',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        });
        break;

      case 'light':
        // 轻型坦克 (如 PT-76 / T-26):
        // 紧凑轻质车体 + 空心小炮塔 + 较短身管 + 单道分划
        parts.push({
          d: 'M 12 15 H 20 C 21.1 15 22 15.9 22 17 V 19 C 22 20.1 21.1 21 20 21 H 12 C 10.9 21 10 20.1 10 19 V 17 C 10 15.9 10.9 15 12 15 Z',
          fill: 'none',
          stroke: strokeColor,
          width: 1.8,
        });
        parts.push({
          d: 'M 16 15.8 A 2.2 2.2 0 1 0 16 20.2 A 2.2 2.2 0 1 0 16 15.8 Z',
          fill: 'none',
          stroke: strokeColor,
          width: 1.8,
        });
        parts.push({
          d: 'M 16 15.8 V 9.5',
          fill: 'none',
          stroke: strokeColor,
          width: 1.8,
        });
        parts.push({
          d: 'M 16 15 V 21',
          fill: 'none',
          stroke: strokeColor,
          width: 1.5,
        });
        break;

      case 'heavy':
        // 重型坦克 (如 KV / IS 系列):
        // 双线重装甲底盘 + 大圆炮塔 + 带制退器重炮管
        parts.push({
          d: 'M 11 13 H 21 C 22.7 13 24 14.3 24 16 V 20 C 24 21.7 22.7 23 21 23 H 11 C 9.3 23 8 21.7 8 20 V 16 C 8 14.3 9.3 13 11 13 Z',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        });
        parts.push({
          d: 'M 8.5 16 H 23.5 M 8.5 20 H 23.5',
          fill: 'none',
          stroke: strokeColor,
          width: 1.2,
        });
        parts.push({
          d: 'M 16 14.2 A 3.8 3.8 0 1 0 16 21.8 A 3.8 3.8 0 1 0 16 14.2 Z',
          fill: strokeColor,
          stroke: strokeColor,
          width: 1,
        });
        parts.push({
          d: 'M 16 14.2 V 5.5 M 14 5.5 H 18',
          fill: 'none',
          stroke: strokeColor,
          width: 2.2,
        });
        break;

      case 'td':
        // 坦克歼击车 / 突击炮 (САУ / ПТ-САУ 如 SU-85 / SU-100):
        // 无旋转炮塔, 固定式梯形战斗室(рубка) + 前伸反坦克火炮与制退器
        parts.push({
          d: 'M 11 14 H 21 C 22.7 14 24 15.3 24 17 V 20 C 24 21.7 22.7 23 21 23 H 11 C 9.3 23 8 21.7 8 20 V 17 C 8 15.3 9.3 14 11 14 Z',
          fill: 'none',
          stroke: strokeColor,
          width: 1.8,
        });
        parts.push({
          d: 'M 11 21 L 13 15 H 19 L 21 21 Z',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        });
        parts.push({
          d: 'M 16 15 V 5.5 M 14 5.5 H 18',
          fill: 'none',
          stroke: strokeColor,
          width: 2,
        });
        break;
    }
  }

  // 4. 被击毁叠加 ×
  if (opts.dead) {
    parts.push({
      d: 'M 9 9 L 23 23 M 23 9 L 9 23',
      fill: 'none',
      stroke: SYMBOL_COLORS.dead,
      width: 2.2,
    });
  }

  return { frame, parts };
}

function buildAriaLabel(vehicleClass: VehicleClass, opts: SymbolOptions): string {
  const setStr = SET_NAMES[opts.set] ?? opts.set;
  const classStr = CLASS_NAMES[vehicleClass] ?? vehicleClass;
  const labelParts = [setStr, classStr];
  if (opts.affiliation && AFFILIATION_NAMES[opts.affiliation]) {
    labelParts.push(AFFILIATION_NAMES[opts.affiliation]);
  }
  if (opts.dead) {
    labelParts.push('被击毁');
  }
  return labelParts.join(' · ');
}

function renderPathSvg(p: SymbolPath): string {
  const w = p.width !== undefined ? ` stroke-width="${p.width}"` : '';
  return `<path d="${p.d}" fill="${p.fill}" stroke="${p.stroke}"${w} stroke-linejoin="round" stroke-linecap="round"/>`;
}

/** 内联 SVG 字符串,带 role="img"、中文 aria-label(例如「北约 · 中型坦克 · 友军」) */
export function symbolSvg(vehicleClass: VehicleClass, opts: SymbolOptions): string {
  const shape = symbolShape(vehicleClass, opts);
  if (!shape.parts || shape.parts.length === 0) {
    return '';
  }

  const size = opts.size ?? 16;
  const label = buildAriaLabel(vehicleClass, opts);

  let inner = '';
  if (shape.frame) {
    inner += renderPathSvg(shape.frame);
  }
  for (const part of shape.parts) {
    inner += renderPathSvg(part);
  }

  return `<svg class="vehicle-class-icon" viewBox="0 0 32 32" width="${size}" height="${size}" role="img" aria-label="${label}">${inner}</svg>`;
}

/** 画到 canvas(小地图、地图界面用),(x, y) 是符号中心;用 Path2D */
export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  vehicleClass: VehicleClass,
  x: number,
  y: number,
  opts: SymbolOptions,
): void {
  const shape = symbolShape(vehicleClass, opts);
  if (!shape.parts || shape.parts.length === 0) {
    return;
  }

  const size = opts.size ?? 16;
  ctx.save();
  ctx.translate(x, y);
  const scale = size / 32;
  ctx.scale(scale, scale);
  ctx.translate(-16, -16);

  const drawPath = (p: SymbolPath) => {
    const path = typeof Path2D !== 'undefined' ? new Path2D(p.d) : null;
    if (path) {
      if (p.fill && p.fill !== 'none') {
        ctx.fillStyle = p.fill;
        ctx.fill(path);
      }
      if (p.stroke && p.stroke !== 'none') {
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.width ?? 1;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke(path);
      }
    }
  };

  if (shape.frame) {
    drawPath(shape.frame);
  }
  for (const part of shape.parts) {
    drawPath(part);
  }

  ctx.restore();
}
