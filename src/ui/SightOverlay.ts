export interface SightState {
  active: boolean;
  /** 相机垂直视场,度(用于把密位换算成像素) */
  fovDeg: number;
  magnification: number;
  /** 表尺距离,m */
  range: number;
  /** 视线方位角,度,0–360,0 = 小地图正上方,顺时针增加 */
  azimuth?: number;
  reticle: 'german' | 'soviet' | 'us';
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
 * 美式分划刻度定义(出处见 TM 9-759 Fig. 220 与 FM 17-12):
 * 对应 76 mm M62 APCBC 穿甲弹(792 m/s)各距离的弹道落差角(密位)。
 */
export interface UsReticleMark {
  /** 距离,米 */
  range: number;
  /** 弹道下坠角,密位 */
  dropMil: number;
  /** 距离标签(百米/百码),未设置表示无数字短线 */
  label?: string;
}

export const US_RETICLE_MARKS: readonly UsReticleMark[] = [
  { range: 200, dropMil: 1.6 },
  { range: 400, dropMil: 3.3, label: '4' },
  { range: 600, dropMil: 5.0 },
  { range: 800, dropMil: 6.8, label: '8' },
  { range: 1000, dropMil: 8.7 },
  { range: 1200, dropMil: 10.6, label: '12' },
  { range: 1400, dropMil: 12.6 },
  { range: 1600, dropMil: 14.6, label: '16' },
  { range: 1800, dropMil: 16.8 },
  { range: 2000, dropMil: 19.0, label: '20' },
  { range: 2400, dropMil: 23.6, label: '24' },
  { range: 2800, dropMil: 28.6, label: '28' },
];

/**
 * 炮手瞄准镜画面:圆形视场外涂黑,中间是分划,顶部是方位角刻度带,瞄准点右下方是表尺距离读数。
 * 德制分划(TZF 系列):中央大三角的尖是瞄准点,两侧小三角间隔 4 密位,可用来估距
 * (目标高度 m ÷ 占据的密位 × 1000 ≈ 距离 m;例如 3 m 高的坦克占 4 密位 ≈ 750 m)。
 * 美式分划(Telescope M70 / M71 系列,如 M71D / M83D,出处见 TM 9-759 Fig. 220 与 FM 17-12):
 * 中央小十字瞄准点,水平密位刻度线每 5 密位一格用来估提前量,下方竖排表尺线标注各距离落差。
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
    else if (s.reticle === 'us') this.drawUS(cx, cy, mil);
    else this.drawSoviet(cx, cy, mil);

    // 顶部方位角刻度带
    this.drawAzimuthScale(cx, cy - radius, radius, s.azimuth ?? 0);

    // 表尺距离文字读数:放在瞄准点右下方约 (+3 密位, +3 密位) 处,换倍率时跟着 mil 缩放位置但字号不变;
    // 低倍镜下 3 密位只有十来个像素,会压住美式分划竖排的距离数字,所以至少离开 44 / 16 像素
    c.font = '12px system-ui, sans-serif';
    c.fillStyle = '#111';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText(`距离：${Math.round(s.range)}`, cx + Math.max(3 * mil, 44), cy + Math.max(3 * mil, 16));

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

  /**
   * 美式分划(Telescope M70 / M71 系列,如 M71D / M83D 用于 76 mm 炮谢尔曼、M71G 用于 Jumbo,
   * 出处见 TM 9-759 Fig. 220「Reticle Pattern for Telescope M71D」与陆军野战条令 FM 17-12「Tank Gunnery」):
   * 1. 中央瞄准小十字:0 距离 / 0 偏角基准点,用于校炮(boresight);
   * 2. 水平密位基准线:左右各延伸 32 密位,每 5 密位设刻度线(10、20、30 密位设长线并标数字),用于估测目标提前量与修正偏角;
   * 3. 中央下方竖排表尺线:按 76 mm M62 APCBC 穿甲弹(792 m/s)弹道落差标出 200–2800 m 刻度线,
   *    并在 400、800、1200、1600、2000、2400、2800 m 两侧标注百米/百码数字(4、8、12、16、20、24、28)。
   */
  private drawUS(cx: number, cy: number, mil: number): void {
    const c = this.ctx;
    c.save();

    // 1. 中央瞄准小十字(0 距离基准)
    c.beginPath();
    c.moveTo(cx - 1.2 * mil, cy);
    c.lineTo(cx + 1.2 * mil, cy);
    c.moveTo(cx, cy - 1.2 * mil);
    c.lineTo(cx, cy + 1.2 * mil);
    c.stroke();

    // 2. 水平密位基准线(左右延伸至 32 密位,中间留空 2.2 密位避免遮盖十字)
    c.beginPath();
    c.moveTo(cx - 32 * mil, cy);
    c.lineTo(cx - 2.2 * mil, cy);
    c.moveTo(cx + 2.2 * mil, cy);
    c.lineTo(cx + 32 * mil, cy);
    c.stroke();

    // 3. 水平方向密位提前量刻度:每 5 密位短刻度、每 10 密位长刻度并标数字
    c.font = '10px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    for (let k = 1; k <= 6; k++) {
      const dMil = k * 5;
      const isMajor = k % 2 === 0;
      const tickH = (isMajor ? 2.5 : 1.2) * mil;
      for (const sgn of [-1, 1]) {
        const x = cx + sgn * dMil * mil;
        c.beginPath();
        c.moveTo(x, cy - tickH);
        c.lineTo(x, cy + tickH);
        c.stroke();
        if (isMajor) {
          c.fillText(String(dMil), x, cy - tickH - 1);
        }
      }
    }

    // 4. 中央下方竖排表尺线与两侧距离数字
    const maxDrop = US_RETICLE_MARKS[US_RETICLE_MARKS.length - 1].dropMil;
    c.beginPath();
    c.moveTo(cx, cy + 2.2 * mil);
    c.lineTo(cx, cy + (maxDrop + 2) * mil);
    c.stroke();

    for (const m of US_RETICLE_MARKS) {
      const y = cy + m.dropMil * mil;
      const halfW = (m.label ? 2.5 : 1.2) * mil;
      c.beginPath();
      c.moveTo(cx - halfW, y);
      c.lineTo(cx + halfW, y);
      c.stroke();

      if (m.label) {
        c.textBaseline = 'middle';
        c.textAlign = 'right';
        c.fillText(m.label, cx - halfW - 4, y);
        c.textAlign = 'left';
        c.fillText(m.label, cx + halfW + 4, y);
      }
    }

    c.restore();
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
    // 刻度带贴着镜筒上沿,那里有暗角,用浅色加深色描边(和 War Thunder 的方位刻度一样是浅色)
    c.strokeStyle = 'rgba(235,235,225,0.9)';
    c.fillStyle = 'rgba(235,235,225,0.9)';
    c.shadowColor = 'rgba(0,0,0,0.8)';
    c.shadowBlur = 2;
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
