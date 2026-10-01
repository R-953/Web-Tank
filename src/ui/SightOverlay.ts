export interface SightState {
  active: boolean;
  /** 相机垂直视场,度(用于把密位换算成像素) */
  fovDeg: number;
  magnification: number;
  /** 表尺距离,m */
  range: number;
  /** 视线方位角,度,0–360,0 = 小地图正上方,顺时针增加 */
  azimuth?: number;
  reticle: 'german' | 'soviet';
  /** 需要挖空的屏幕矩形(像素,例如右上角的击杀回放窗口),不被瞄准镜的黑色遮罩盖住 */
  cutout?: { x: number; y: number; w: number; h: number } | null;
}

/** 德制 1 密位(Strich)= 1/6400 圆周 */
const STRICH = (2 * Math.PI) / 6400;

/** 相机 yaw(弧度,0 = 看向 -Z,正值向左)→ 方位角(度,0–360) */
export function azimuthFromYaw(yaw: number): number {
  const deg = ((-yaw * 180) / Math.PI) % 360;
  const norm = (deg + 360) % 360;
  return norm >= 360 || norm === 0 ? 0 : norm;
}

/** 顶部方位刻度带上要画的刻度:center 为当前方位角,halfSpan 为左右各显示多少度 */
export function azimuthTicks(
  center: number,
  halfSpan: number,
): Array<{ deg: number; offset: number; major: boolean; label: string | null }> {
  const result: Array<{ deg: number; offset: number; major: boolean; label: string | null }> = [];
  const minT = Math.ceil((center - halfSpan - 1e-6) / 5) * 5;
  const maxT = Math.floor((center + halfSpan + 1e-6) / 5) * 5;

  for (let t = minT; t <= maxT + 1e-6; t += 5) {
    const rawOffset = t - center;
    const offset = Math.round(rawOffset * 1e6) / 1e6;
    const roundedT = Math.round(t);
    const modDeg = ((roundedT % 360) + 360) % 360;
    const deg = modDeg === 360 || modDeg === 0 ? 0 : modDeg;
    // War Thunder 值:每 5° 一个短刻度,每 15° 一个长刻度并标数字(0..345)
    const major = deg % 15 === 0;
    result.push({
      deg,
      offset,
      major,
      label: major ? String(deg) : null,
    });
  }

  return result;
}

/**
 * 炮手瞄准镜画面:圆形视场外涂黑,中间是分划,顶部是随表尺转动的距离刻度。
 * 德制分划(TZF 系列):中央大三角的尖是瞄准点,两侧小三角间隔 4 密位,可用来估距
 * (目标高度 m ÷ 占据的密位 × 1000 ≈ 距离 m;例如 3 m 高的坦克占 4 密位 ≈ 750 m)。
 */
export class SightOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private last = '';

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position: 'fixed', inset: '0', pointerEvents: 'none', display: 'none' });
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  draw(s: SightState): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cut = s.cutout ? `${s.cutout.x},${s.cutout.y},${s.cutout.w},${s.cutout.h}` : '';
    const az = (s.azimuth ?? 0).toFixed(1);
    const key = `${s.active}|${s.fovDeg}|${s.magnification}|${s.range}|${az}|${w}x${h}|${s.reticle}|${cut}`;
    if (key === this.last) return;
    this.last = key;
    this.canvas.style.display = s.active ? 'block' : 'none';
    if (!s.active) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.47;
    // 视场外涂黑
    c.fillStyle = '#000';
    c.beginPath();
    c.rect(0, 0, w, h);
    c.arc(cx, cy, radius, 0, Math.PI * 2, true);
    c.fill('evenodd');
    // 镜筒边缘暗角
    const vignette = c.createRadialGradient(cx, cy, radius * 0.75, cx, cy, radius);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vignette;
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.fill();

    const pxPerRad = h / 2 / Math.tan(((s.fovDeg / 2) * Math.PI) / 180);
    const mil = pxPerRad * STRICH;
    c.fillStyle = '#111';
    c.strokeStyle = '#111';
    c.lineWidth = 1.5;
    if (s.reticle === 'german') this.drawGerman(cx, cy, mil);
    else this.drawSoviet(cx, cy, mil);

    // 顶部方位角刻度带
    this.drawAzimuthScale(cx, cy - radius, radius, s.azimuth ?? 0);

    // 表尺距离文字读数:放在瞄准点右下方约 (+3 密位, +3 密位) 处,换倍率时跟着 mil 缩放位置但字号不变
    c.font = '12px system-ui, sans-serif';
    c.fillStyle = '#111';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText(`距离：${Math.round(s.range)}`, cx + 3 * mil, cy + 3 * mil);

    if (s.cutout) c.clearRect(s.cutout.x, s.cutout.y, s.cutout.w, s.cutout.h);
  }

  private tri(x: number, apexY: number, halfBase: number, height: number): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x, apexY);
    c.lineTo(x - halfBase, apexY + height);
    c.lineTo(x + halfBase, apexY + height);
    c.closePath();
    c.fill();
  }

  private drawGerman(cx: number, cy: number, mil: number): void {
    // 中央大三角:尖端 = 瞄准点,高 4 密位
    this.tri(cx, cy, 2 * mil, 4 * mil);
    // 两侧各 3 个小三角,间隔 4 密位,高 2 密位
    for (let k = 1; k <= 3; k++) {
      this.tri(cx - 4 * k * mil, cy, mil, 2 * mil);
      this.tri(cx + 4 * k * mil, cy, mil, 2 * mil);
    }
    // 中央竖线(下方)
    const c = this.ctx;
    c.beginPath();
    c.moveTo(cx, cy + 5 * mil);
    c.lineTo(cx, cy + 12 * mil);
    c.stroke();
  }

  private drawSoviet(cx: number, cy: number, mil: number): void {
    const c = this.ctx;
    // 中央倒 V(尖端 = 瞄准点)+ 两侧水平刻度,每格 4 密位
    c.beginPath();
    c.moveTo(cx - 2 * mil, cy + 2.5 * mil);
    c.lineTo(cx, cy);
    c.lineTo(cx + 2 * mil, cy + 2.5 * mil);
    c.stroke();
    for (let k = 1; k <= 4; k++) {
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.moveTo(cx + sgn * 4 * k * mil, cy);
        c.lineTo(cx + sgn * 4 * k * mil, cy + (k % 2 ? 1.5 : 3) * mil);
        c.stroke();
      }
    }
    c.beginPath();
    c.moveTo(cx - 18 * mil, cy);
    c.lineTo(cx - 4 * mil, cy);
    c.moveTo(cx + 4 * mil, cy);
    c.lineTo(cx + 18 * mil, cy);
    c.stroke();
  }

  /** 顶部的方位角刻度带:数字为方位角度数,中间的固定指针指示当前视线方位角 */
  private drawAzimuthScale(cx: number, top: number, radius: number, azimuth: number): void {
    const c = this.ctx;
    const y = top + 38;
    const halfSpanDeg = 30;
    const halfSpanPx = radius * 0.6;
    const pxPerDeg = halfSpanPx / halfSpanDeg;
    c.save();
    c.beginPath();
    c.rect(cx - halfSpanPx, y - 26, halfSpanPx * 2, 40);
    c.clip();
    c.strokeStyle = '#111';
    c.fillStyle = '#111';
    c.font = '12px system-ui, sans-serif';
    c.textAlign = 'center';

    const ticks = azimuthTicks(azimuth, halfSpanDeg);
    for (const t of ticks) {
      const x = cx + t.offset * pxPerDeg;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + (t.major ? 10 : 5));
      c.stroke();
      if (t.label !== null) c.fillText(t.label, x, y - 6);
    }
    c.restore();

    // 固定指针(War Thunder 风格红色三角指针)
    c.fillStyle = '#b01010';
    c.beginPath();
    c.moveTo(cx, y + 12);
    c.lineTo(cx - 6, y + 22);
    c.lineTo(cx + 6, y + 22);
    c.closePath();
    c.fill();
  }
}
