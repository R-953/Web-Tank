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

/** 纯数据:viewBox 0 0 32 32 里的若干路径;frame 只有北约且传了 affiliation 时有 */
export interface SymbolShape {
  frame?: SymbolPath;
  parts: SymbolPath[];
}

export const SYMBOL_COLORS = {
  friend: '#00a8f0', // 友军蓝
  hostile: '#ff4d4d', // 敌军红
  neutral: '#00c800', // 中立绿
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

/** 华约菱形(TM 30-430):横放的给坦克(宽约为高的 2 倍),竖放的给自行火炮;inner 是敌军双线的内圈 */
const WARSAW_H = { outer: 'M 16 9 L 29 16 L 16 23 L 3 16 Z', inner: 'M 16 11.8 L 23.7 16 L 16 20.2 L 8.3 16 Z' };
const WARSAW_V = { outer: 'M 16 3 L 23 16 L 16 29 L 9 16 Z', inner: 'M 16 8.3 L 20.2 16 L 16 23.7 L 11.8 16 Z' };

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
  let color: string;
  if (opts.dead) {
    color = SYMBOL_COLORS.dead;
  } else if (opts.affiliation) {
    color = SYMBOL_COLORS[opts.affiliation];
  } else {
    color = 'currentColor';
  }

  let frame: SymbolPath | undefined;
  const parts: SymbolPath[] = [];

  if (opts.set === 'nato') {
    // -------------------------------------------------------------
    // 北约: MIL-STD-2525C 地面装备 (Ground Equipment)
    // -------------------------------------------------------------
    // 2525C 地面装备识别框: 友军为圆, 敌军为菱形, 中立为正方形 (只有传了 affiliation 时才有)
    if (opts.affiliation) {
      switch (opts.affiliation) {
        case 'friend':
          // 友军圆框 (半径 12, 居中 (16, 16))
          frame = {
            d: 'M 16 4 A 12 12 0 1 0 16 28 A 12 12 0 1 0 16 4 Z',
            fill: 'none',
            stroke: color,
            width: 2,
          };
          break;
        case 'hostile':
          // 敌军菱形框
          frame = {
            d: 'M 16 2 L 30 16 L 16 30 L 2 16 Z',
            fill: 'none',
            stroke: color,
            width: 2,
          };
          break;
        case 'neutral':
          // 中立正方形框
          frame = {
            d: 'M 5 5 H 27 V 27 H 5 Z',
            fill: 'none',
            stroke: color,
            width: 2,
          };
          break;
      }
    }

    // 装备内部图形:
    // 坦克: 横置长方形, 左右两竖边向上、向下各伸出一截; 内部分别有 1 / 2 / 3 道竖线
    if (vehicleClass === 'light' || vehicleClass === 'medium' || vehicleClass === 'heavy') {
      parts.push({
        d: 'M 9.5 9.5 V 22.5 M 22.5 9.5 V 22.5 M 9.5 12 H 22.5 M 9.5 20 H 22.5',
        fill: 'none',
        stroke: color,
        width: 2,
      });

      if (vehicleClass === 'light') {
        // 1 道居中竖线 (S*GPEVATL-)
        parts.push({
          d: 'M 16 12 V 20',
          fill: 'none',
          stroke: color,
          width: 2,
        });
      } else if (vehicleClass === 'medium') {
        // 2 道均匀竖线 (S*GPEVATM-)
        parts.push({
          d: 'M 13.8 12 V 20 M 18.2 12 V 20',
          fill: 'none',
          stroke: color,
          width: 2,
        });
      } else {
        // 3 道均匀竖线 (S*GPEVATH-)
        parts.push({
          d: 'M 12.8 12 V 20 M 16 12 V 20 M 19.2 12 V 20',
          fill: 'none',
          stroke: color,
          width: 2,
        });
      }
    } else if (vehicleClass === 'td') {
      // 坦克歼击车/突击炮: 2525C S*GPEWDMS- (Direct Fire Gun, Medium, Self-Propelled)
      // 竖直炮身线(上部有 2 道短横线) + 底部横放小椭圆(履带, 表示自行)
      parts.push({
        d: 'M 16 7 V 20 M 13.5 10 H 18.5 M 13.5 13 H 18.5',
        fill: 'none',
        stroke: color,
        width: 2,
      });
      parts.push({
        d: 'M 13 20 H 19 C 20.7 20 21.5 20.9 21.5 22 C 21.5 23.1 20.7 24 19 24 H 13 C 11.3 24 10.5 23.1 10.5 22 C 10.5 20.9 11.3 20 13 20 Z',
        fill: 'none',
        stroke: color,
        width: 1.8,
      });
    }
  } else {
    // -------------------------------------------------------------
    // 华约: TM 30-430 (1946) Chapter XII Section II
    // -------------------------------------------------------------
    // 华约不画识别框: frame 始终为 undefined
    // 线条粗细与双线约定:
    // friend: 单道粗线 (线宽 2.4)
    // hostile: 双道细线 (外圈 + 内缩内圈, 线宽 1.2)
    // neutral: 单道细线 (线宽 1.2, 本项目补全)
    // 不传 affiliation: 单道中等粗细 (线宽 1.8, currentColor)
    const isHostile = opts.affiliation === 'hostile';
    const lineWidth = opts.affiliation === 'friend' ? 2.4 : isHostile || opts.affiliation === 'neutral' ? 1.2 : 1.8;
    // 菱形尽量占满 32×32,16 px 时也看得清;内圈按外圈向内缩约 2.5
    const outline = vehicleClass === 'td' ? WARSAW_V : WARSAW_H;
    parts.push({ d: outline.outer, fill: 'none', stroke: color, width: lineWidth });
    if (isHostile) {
      parts.push({ d: outline.inner, fill: 'none', stroke: color, width: lineWidth });
    }

    if (vehicleClass === 'medium') {
      // Medium tank: 一道竖线连接上下两顶点
      parts.push({ d: 'M 16 9 V 23', fill: 'none', stroke: color, width: lineWidth });
    } else if (vehicleClass === 'heavy') {
      // Heavy tank: 中心一个实心圆点
      parts.push({ d: 'M 16 13.8 A 2.2 2.2 0 1 0 16 18.2 A 2.2 2.2 0 1 0 16 13.8 Z', fill: color, stroke: color, width: 1 });
    } else if (vehicleClass === 'td') {
      // Self-propelled gun: 内部三道竖线,中间最长;用细线,免得粗线时三道糊成一条
      parts.push({ d: 'M 16 7 V 25 M 13.6 13 V 19 M 18.4 13 V 19', fill: 'none', stroke: color, width: 1.2 });
    }
  }

  // 4. 被击毁: 叠加 × (灰色)
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
