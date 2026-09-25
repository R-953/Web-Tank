import type { GameMap } from '../game/Map';
import { SURFACE_ORDER } from '../game/terrain';
import { SURFACES } from '../data/surfaces';

export const MINIMAP = { size: 200, margin: 16 };

export interface MinimapMarker {
  x: number;
  z: number;
  dead: boolean;
  /** 已进入交战状态(会还击) */
  alerted: boolean;
}

/**
 * 右下角小地图:地表颜色 + 山体阴影 + 水面,标出玩家(车体朝向箭头 + 视线方向)和靶车。
 * 背景每张地图只画一次,标记每帧重画。
 */
export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement | null = null;
  private mapSize = 1;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    const { size, margin } = MINIMAP;
    this.canvas.width = size;
    this.canvas.height = size;
    Object.assign(this.canvas.style, {
      position: 'fixed',
      right: `${margin}px`,
      bottom: `${margin}px`,
      width: `${size}px`,
      height: `${size}px`,
      border: '1px solid rgba(255,255,255,.35)',
      borderRadius: '4px',
      pointerEvents: 'none',
    });
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  setVisible(v: boolean): void {
    this.canvas.style.display = v ? 'block' : 'none';
  }

  setMap(map: GameMap): void {
    const { size } = MINIMAP;
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
    // 每 500 m 一条浅色网格线
    c.strokeStyle = 'rgba(255,255,255,.15)';
    c.lineWidth = 1;
    const step = (500 / map.spec.size) * size;
    for (let v = step; v < size; v += step) {
      c.beginPath();
      c.moveTo(v, 0);
      c.lineTo(v, size);
      c.moveTo(0, v);
      c.lineTo(size, v);
      c.stroke();
    }
    this.background = bg;
    this.mapSize = map.spec.size;
  }

  /**
   * @param heading 车体朝向(弧度,0 = 朝 -Z / 北,正值向左)
   * @param view    视线方向(同上)
   */
  draw(player: { x: number; z: number; heading: number; view: number }, markers: MinimapMarker[]): void {
    const { size } = MINIMAP;
    const c = this.ctx;
    if (this.background) c.drawImage(this.background, 0, 0);
    const toPx = (x: number, z: number) => [((x / this.mapSize) + 0.5) * size, ((z / this.mapSize) + 0.5) * size] as const;
    for (const m of markers) {
      const [x, y] = toPx(m.x, m.z);
      c.fillStyle = m.dead ? '#444' : m.alerted ? '#ff3b30' : '#ff9f0a';
      c.strokeStyle = '#000';
      c.beginPath();
      c.rect(x - 3, y - 3, 6, 6);
      c.fill();
      c.stroke();
    }
    const [px, py] = toPx(player.x, player.z);
    // 视线方向
    c.strokeStyle = 'rgba(255,255,255,.7)';
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px - Math.sin(player.view) * 40, py - Math.cos(player.view) * 40);
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
  }
}
