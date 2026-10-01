import type { GameMap } from '../game/Map';
import { SURFACE_ORDER } from '../game/terrain';
import { SURFACES } from '../data/surfaces';

/** 小地图:地图区域边长(CSS 像素)、坐标标注的边距、离屏幕边缘的距离 */
export const MINIMAP = { size: 240, label: 14, margin: 16 };

/** 网格:整张地图分成 GRID × GRID 格,横轴数字 1..GRID(西 → 东),纵轴字母 A..(北 → 南) */
export const GRID = 10;
/** 方形模式最大放大倍数;每格滚轮缩放 √2 倍 */
const MAX_ZOOM = 8;
const ZOOM_STEP = Math.SQRT2;
/** 圆形模式:以玩家为中心显示的半径(m)范围与缺省值 */
const CIRCLE_RADIUS = { min: 150, max: 1500, default: 400 };
const BG_SCALE = 2;

export interface MinimapMarker {
  x: number;
  z: number;
  team: 'enemy' | 'ally';
  dead: boolean;
  /** 车头朝向(弧度,约定同 draw() 的 heading);箭头样式要用,没有时画圆点 */
  heading?: number;
}

/** 小地图标记的填充色:被击毁 → 灰;敌军 → 红;友军 → 蓝。颜色值和现在的完全一样 */
export function markerColor(team: 'enemy' | 'ally', dead: boolean): string {
  if (dead) return '#5a5a5a';
  return team === 'enemy' ? '#ff3b30' : '#3aa0ff';
}

/** 其他车辆的标记样式:圆点 / 箭头(带朝向) */
export type MarkerStyle = 'dot' | 'arrow';

/**
 * 箭头样式的三角形顶点(小地图像素):[尖端, 右后, 左后]。
 * 以 (x, y) 为中心,尖端指向车头;heading 约定同 draw()(0 = 北 / 上,正值向左),与玩家箭头的 rotate(-heading) 一致。
 */
export function arrowVertices(x: number, y: number, heading: number): [number, number][] {
  const s = Math.sin(heading);
  const c = Math.cos(heading);
  const rot = (lx: number, ly: number): [number, number] => [x + lx * c + ly * s, y - lx * s + ly * c];
  return [rot(0, -6), rot(4, 4), rot(-4, 4)];
}

/** 小地图当前显示的世界范围:中心 (cx, cz)、半边长 half(m) */
export interface MapView {
  cx: number;
  cz: number;
  half: number;
}

/** 世界坐标所在的格子,如 'C4'(字母 = 行,北边是 A;数字 = 列,西边是 1);超出地图的点算最近的边格 */
export function gridLabel(x: number, z: number, mapSize: number): string {
  const cell = mapSize / GRID;
  const half = mapSize / 2;
  const col = Math.min(GRID - 1, Math.max(0, Math.floor((x + half) / cell)));
  const row = Math.min(GRID - 1, Math.max(0, Math.floor((z + half) / cell)));
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

/** 世界坐标 → 小地图像素(地图区域左上角为原点,边长 size) */
export function worldToView(v: MapView, size: number, x: number, z: number): [number, number] {
  return [((x - v.cx + v.half) / (2 * v.half)) * size, ((z - v.cz + v.half) / (2 * v.half)) * size];
}

/** 小地图像素 → 世界坐标 */
export function viewToWorld(v: MapView, size: number, px: number, py: number): { x: number; z: number } {
  return { x: v.cx - v.half + (px / size) * 2 * v.half, z: v.cz - v.half + (py / size) * 2 * v.half };
}

/** 方形模式:把视野限制在地图以内 */
export function clampView(v: MapView, mapHalf: number): MapView {
  const half = Math.min(mapHalf, v.half);
  const lim = mapHalf - half;
  return { cx: Math.min(lim, Math.max(-lim, v.cx)), cz: Math.min(lim, Math.max(-lim, v.cz)), half };
}

/**
 * 方形模式按滚轮缩放:以 (fx, fz) 为不动点,steps > 0(向下滚)缩小、< 0 放大;
 * 放大倍数 1..MAX_ZOOM,结果限制在地图以内。
 */
export function zoomSquare(v: MapView, mapHalf: number, fx: number, fz: number, steps: number): MapView {
  const half = Math.min(mapHalf, Math.max(mapHalf / MAX_ZOOM, v.half * ZOOM_STEP ** steps));
  const k = half / v.half;
  return clampView({ cx: fx + (v.cx - fx) * k, cz: fz + (v.cz - fz) * k, half }, mapHalf);
}

/** 圆形模式按滚轮缩放:显示半径在 CIRCLE_RADIUS 范围内 */
export function zoomCircle(radius: number, steps: number): number {
  return Math.min(CIRCLE_RADIUS.max, Math.max(CIRCLE_RADIUS.min, radius * ZOOM_STEP ** steps));
}

/**
 * 右下角小地图(War Thunder 风格):地表颜色 + 山体阴影 + 水面,10 × 10 网格,上边标数字、左边标字母。
 *   - 方形:北朝上,缺省显示整张地图;滚轮以光标处为中心放大(放大后玩家跑出视野会自动跟过去)。
 *   - 圆形:北朝上,以玩家为中心,滚轮改变显示半径。
 * 敌军红点、友军蓝点(可在设置里改成指向车头的箭头),被击毁的变灰;玩家是黄色箭头加一条视线。双击放的标记是黄色菱形。
 */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement | null = null;
  private mapSize = 1;
  private shapeValue: 'square' | 'circle' = 'square';
  private markerStyle: MarkerStyle = 'dot';
  private view: MapView = { cx: 0, cz: 0, half: 1 };
  private circleRadius = CIRCLE_RADIUS.default;
  private markerValue: { x: number; z: number } | null = null;
  private cursorMode = false;
  private lastPlayer = { x: 0, z: 0 };
  private dpr = 1;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    const total = MINIMAP.size + MINIMAP.label;
    Object.assign(this.canvas.style, {
      position: 'fixed',
      right: `${MINIMAP.margin}px`,
      bottom: `${MINIMAP.margin}px`,
      width: `${total}px`,
      height: `${total}px`,
      pointerEvents: 'none',
      zIndex: '5',
    });
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
  }

  get shape(): 'square' | 'circle' {
    return this.shapeValue;
  }

  setShape(shape: 'square' | 'circle'): void {
    this.shapeValue = shape;
  }

  setMarkerStyle(style: MarkerStyle): void {
    this.markerStyle = style;
  }

  setVisible(v: boolean): void {
    this.canvas.style.display = v ? 'block' : 'none';
  }

  setCursorMode(on: boolean): void {
    this.cursorMode = on;
  }

  get marker(): { x: number; z: number } | null {
    return this.markerValue;
  }

  setMarker(p: { x: number; z: number } | null): void {
    this.markerValue = p ? { ...p } : null;
  }

  resetView(): void {
    const h = this.mapSize / 2;
    this.view = { cx: 0, cz: 0, half: h };
    this.circleRadius = CIRCLE_RADIUS.default;
  }

  setMap(map: GameMap): void {
    const size = MINIMAP.size * BG_SCALE;
    const bg = document.createElement('canvas');
    bg.width = size;
    bg.height = size;
    const c = bg.getContext('2d')!;
    const img = c.createImageData(size, size);
    const g = map.grid;
    const n = g.resolution;
    const colors = SURFACE_ORDER.map((t) => SURFACES[t].color);
    const water = map.spec.waterLevel;
    for (let py = 0; py < size; py++) {
      const iz = Math.min(n - 1, Math.round((py / (size - 1)) * (n - 1)));
      for (let px = 0; px < size; px++) {
        const ix = Math.min(n - 1, Math.round((px / (size - 1)) * (n - 1)));
        const k = iz * n + ix;
        const h = g.heights[k];
        // 山体阴影:西北方向来光
        const hx = g.heights[iz * n + Math.min(n - 1, ix + 1)] - g.heights[iz * n + Math.max(0, ix - 1)];
        const hz = g.heights[Math.min(n - 1, iz + 1) * n + ix] - g.heights[Math.max(0, iz - 1) * n + ix];
        const shade = Math.max(0.55, Math.min(1.25, 1 - (hx + hz) / (4 * g.cellSize)));
        const col = water !== undefined && h < water ? 0x3d6e8c : colors[g.surfaces[k]];
        const o = (py * size + px) * 4;
        img.data[o] = Math.min(255, ((col >> 16) & 255) * shade);
        img.data[o + 1] = Math.min(255, ((col >> 8) & 255) * shade);
        img.data[o + 2] = Math.min(255, (col & 255) * shade);
        img.data[o + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    this.background = bg;
    this.mapSize = map.spec.size;
    this.markerValue = null;
    this.resetView();
  }

  /** 客户端坐标是否在小地图区域内 */
  contains(clientX: number, clientY: number): boolean {
    const p = this.localPoint(clientX, clientY);
    if (!p) return false;
    if (this.shapeValue === 'circle') {
      const r = MINIMAP.size / 2;
      return (p.x - r) ** 2 + (p.y - r) ** 2 <= r * r;
    }
    return true;
  }

  /** 客户端坐标对应的世界坐标;不在小地图区域内返回 null */
  screenToWorld(clientX: number, clientY: number): { x: number; z: number } | null {
    if (!this.contains(clientX, clientY)) return null;
    const p = this.localPoint(clientX, clientY)!;
    const w = viewToWorld(this.currentView(), MINIMAP.size, p.x, p.y);
    const half = this.mapSize / 2;
    if (Math.abs(w.x) > half || Math.abs(w.z) > half) return null;
    return w;
  }

  /** 滚轮缩放:steps > 0(向下滚)缩小,< 0 放大;方形模式以光标处为中心 */
  zoomAt(clientX: number, clientY: number, steps: number): void {
    if (steps === 0) return;
    if (this.shapeValue === 'circle') {
      this.circleRadius = zoomCircle(this.circleRadius, steps);
      return;
    }
    const p = this.localPoint(clientX, clientY);
    const f = p ? viewToWorld(this.view, MINIMAP.size, p.x, p.y) : { x: this.view.cx, z: this.view.cz };
    this.view = zoomSquare(this.view, this.mapSize / 2, f.x, f.z, steps);
  }

  /**
   * @param heading 车体朝向(弧度,0 = 朝北 / −Z,正值向左)
   * @param view    视线方向(同上)
   */
  draw(player: { x: number; z: number; heading: number; view: number }, markers: MinimapMarker[]): void {
    this.resizeCanvas();
    this.lastPlayer = { x: player.x, z: player.z };
    const { size, label } = MINIMAP;
    const c = this.ctx;
    const circle = this.shapeValue === 'circle';
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, size + label, size + label);

    // 方形模式放大后,玩家跑出视野中间 80% 就把视野移过去
    if (!circle && this.view.half < this.mapSize / 2) {
      const [px, py] = worldToView(this.view, size, player.x, player.z);
      if (px < size * 0.1 || px > size * 0.9 || py < size * 0.1 || py > size * 0.9) {
        this.view = clampView({ ...this.view, cx: player.x, cz: player.z }, this.mapSize / 2);
      }
    }
    const v = this.currentView();

    // 坐标标注(边距区域)
    c.fillStyle = 'rgba(12,15,18,.72)';
    c.fillRect(0, 0, size + label, label);
    c.fillRect(0, label, label, size);
    this.drawLabels(v);

    c.save();
    c.translate(label, label);
    c.beginPath();
    if (circle) c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    else c.rect(0, 0, size, size);
    c.clip();
    c.fillStyle = '#1b2227';
    c.fillRect(0, 0, size, size);
    if (this.background) {
      const bg = this.background;
      const k = bg.width / this.mapSize;
      const half = this.mapSize / 2;
      const sx = (v.cx - v.half + half) * k;
      const sy = (v.cz - v.half + half) * k;
      const sw = 2 * v.half * k;
      drawImageClipped(c, bg, sx, sy, sw, sw, size);
    }
    this.drawGrid(v);
    const toPx = (x: number, z: number) => worldToView(v, size, x, z);

    for (const m of markers) {
      const [x, y] = toPx(m.x, m.z);
      // 箭头样式:活着的车画指向车头的三角;被击毁的照旧画灰点加 ×
      if (this.markerStyle === 'arrow' && !m.dead && m.heading !== undefined) {
        const [tip, right, left] = arrowVertices(x, y, m.heading);
        c.beginPath();
        c.moveTo(tip[0], tip[1]);
        c.lineTo(right[0], right[1]);
        c.lineTo(left[0], left[1]);
        c.closePath();
        c.fillStyle = markerColor(m.team, m.dead);
        c.fill();
        c.lineWidth = 1;
        c.strokeStyle = 'rgba(0,0,0,.8)';
        c.stroke();
        continue;
      }
      c.beginPath();
      c.arc(x, y, m.dead ? 3 : 3.8, 0, Math.PI * 2);
      c.fillStyle = markerColor(m.team, m.dead);
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(0,0,0,.8)';
      c.stroke();
      if (m.dead) {
        c.strokeStyle = '#c8c8c8';
        c.beginPath();
        c.moveTo(x - 2.5, y - 2.5);
        c.lineTo(x + 2.5, y + 2.5);
        c.moveTo(x + 2.5, y - 2.5);
        c.lineTo(x - 2.5, y + 2.5);
        c.stroke();
      }
    }

    if (this.markerValue) {
      const [x, y] = toPx(this.markerValue.x, this.markerValue.z);
      c.save();
      c.translate(x, y);
      c.rotate(Math.PI / 4);
      c.fillStyle = '#ffd166';
      c.strokeStyle = '#000';
      c.lineWidth = 1;
      c.fillRect(-4, -4, 8, 8);
      c.strokeRect(-4, -4, 8, 8);
      c.restore();
      c.font = '10px system-ui, sans-serif';
      c.fillStyle = '#ffd166';
      c.fillText(gridLabel(this.markerValue.x, this.markerValue.z, this.mapSize), x + 7, y - 5);
    }

    const [px, py] = toPx(player.x, player.z);
    // 视线方向
    c.strokeStyle = 'rgba(255,255,255,.7)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px - Math.sin(player.view) * 36, py - Math.cos(player.view) * 36);
    c.stroke();
    // 车体箭头
    c.save();
    c.translate(px, py);
    c.rotate(-player.heading);
    c.fillStyle = '#ffd166';
    c.strokeStyle = '#000';
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(5, 5);
    c.lineTo(0, 2);
    c.lineTo(-5, 5);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
    c.restore();

    // 边框
    c.save();
    c.translate(label, label);
    c.lineWidth = this.cursorMode ? 2 : 1;
    c.strokeStyle = this.cursorMode ? '#e0b44c' : 'rgba(255,255,255,.4)';
    c.beginPath();
    if (circle) c.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2);
    else c.rect(0.5, 0.5, size - 1, size - 1);
    c.stroke();
    c.restore();
    if (circle) {
      // 圆形模式在右下角标出玩家所在的格子
      c.font = 'bold 11px system-ui, sans-serif';
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.textAlign = 'right';
      c.fillText(gridLabel(player.x, player.z, this.mapSize), label + size - 2, label + size - 4);
      c.textAlign = 'left';
    }
  }

  private currentView(): MapView {
    if (this.shapeValue === 'circle') return { cx: this.lastPlayer.x, cz: this.lastPlayer.z, half: this.circleRadius };
    return this.view;
  }

  /** 网格线:每格一条浅线 */
  private drawGrid(v: MapView): void {
    const c = this.ctx;
    const size = MINIMAP.size;
    const cell = this.mapSize / GRID;
    const half = this.mapSize / 2;
    c.strokeStyle = 'rgba(255,255,255,.18)';
    c.lineWidth = 1;
    c.beginPath();
    for (let k = 0; k <= GRID; k++) {
      const w = -half + k * cell;
      const [x] = worldToView(v, size, w, 0);
      const [, y] = worldToView(v, size, 0, w);
      if (x >= -1 && x <= size + 1) {
        c.moveTo(Math.round(x) + 0.5, 0);
        c.lineTo(Math.round(x) + 0.5, size);
      }
      if (y >= -1 && y <= size + 1) {
        c.moveTo(0, Math.round(y) + 0.5);
        c.lineTo(size, Math.round(y) + 0.5);
      }
    }
    c.stroke();
  }

  /** 上边标列号(数字),左边标行号(字母),标在当前可见的格子中间 */
  private drawLabels(v: MapView): void {
    const c = this.ctx;
    const { size, label } = MINIMAP;
    const cell = this.mapSize / GRID;
    const half = this.mapSize / 2;
    c.font = '10px system-ui, sans-serif';
    c.fillStyle = 'rgba(235,235,235,.9)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let k = 0; k < GRID; k++) {
      const mid = -half + (k + 0.5) * cell;
      const [x] = worldToView(v, size, mid, 0);
      const [, y] = worldToView(v, size, 0, mid);
      if (x >= 4 && x <= size - 4) c.fillText(String(k + 1), label + x, label / 2 + 0.5);
      if (y >= 4 && y <= size - 4) c.fillText(String.fromCharCode(65 + k), label / 2, label + y);
    }
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
  }

  private localPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const r = this.canvas.getBoundingClientRect();
    const x = clientX - r.left - MINIMAP.label;
    const y = clientY - r.top - MINIMAP.label;
    if (x < 0 || y < 0 || x > MINIMAP.size || y > MINIMAP.size) return null;
    return { x, y };
  }

  private resizeCanvas(): void {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const total = MINIMAP.size + MINIMAP.label;
    if (dpr === this.dpr && this.canvas.width === Math.round(total * dpr)) return;
    this.dpr = dpr;
    this.canvas.width = Math.round(total * dpr);
    this.canvas.height = Math.round(total * dpr);
  }
}

/**
 * drawImage 的源矩形超出图片时,按比例裁掉超出的部分再画(各浏览器对越界源矩形的处理不一致)。
 * 目标是边长 size 的正方形,源矩形 (sx, sy, sw, sh)。
 */
function drawImageClipped(c: CanvasRenderingContext2D, img: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, size: number): void {
  const x0 = Math.max(0, sx);
  const y0 = Math.max(0, sy);
  const x1 = Math.min(img.width, sx + sw);
  const y1 = Math.min(img.height, sy + sh);
  if (x1 <= x0 || y1 <= y0) return;
  const kx = size / sw;
  const ky = size / sh;
  c.drawImage(img, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * kx, (y0 - sy) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
}
