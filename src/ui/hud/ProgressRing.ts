export type RingIcon = 'driver' | 'gunner' | 'loader' | 'commander' | 'radio' | 'machinegunner' | 'repair' | 'ammo';

export interface ProgressRingOptions {
  /** 进度 0..1 */
  progress: number;
  /** 中间图标类型 */
  icon: RingIcon;
  /** 圆环下方的文字说明;省略时不显示文字 */
  label?: string;
  /** 色调,默认 amber */
  tone?: 'amber' | 'blue';
}

const RING_RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const REPAIR_ICON_SVG =
  '<path d="M14.5 4.5 C13 3 11 3.5 9.5 4.5 L11.5 6.5 L10 8 L8 6.5 C7 8 6.5 10 8 11.5 L4.5 15 C4 15.5 4 16.5 4.5 17 C5 17.5 6 17.5 6.5 17 L10 13.5 C11.5 15 13.5 14.5 15 13.5 L13.5 12 L15 10.5 L17 12 C18 10.5 18 8.5 16.5 7 L14.5 9 L13 7.5 Z" stroke="currentColor" fill="none" stroke-width="1.4" stroke-linejoin="round"/>';

const ICON_SVGS: Record<RingIcon, string> = {
  // 方向盘
  driver:
    '<circle cx="10" cy="10" r="7" stroke="currentColor" fill="none" stroke-width="1.5"/>' +
    '<circle cx="10" cy="10" r="1.8" fill="currentColor"/>' +
    '<path d="M10 12 L10 17 M8.5 9 L4 7 M11.5 9 L16 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',

  // 瞄准镜(圆 + 十字线)
  gunner:
    '<circle cx="10" cy="10" r="7" stroke="currentColor" fill="none" stroke-width="1.5"/>' +
    '<path d="M10 2 L10 6 M10 14 L10 18 M2 10 L6 10 M14 10 L18 10 M9 10 L11 10 M10 9 L10 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',

  // 装填手(炮弹)
  loader:
    '<path d="M7 17 L7 9 C7 5 10 3 10 3 C10 3 13 5 13 9 L13 17 Z M6 17 L14 17" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',

  // 车长(双筒望远镜)
  commander:
    '<circle cx="6" cy="13" r="3.2" stroke="currentColor" fill="none" stroke-width="1.5"/>' +
    '<circle cx="14" cy="13" r="3.2" stroke="currentColor" fill="none" stroke-width="1.5"/>' +
    '<path d="M4.5 6 L7.5 6 L7 10 M15.5 6 L12.5 6 L13 10 M7 6 L13 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',

  // 机电员 / 电台
  radio:
    '<path d="M10 18 L10 8 M10 8 L6 4 M10 8 L14 4 M6 11 A5 5 0 0 1 6 7 M14 11 A5 5 0 0 0 14 7" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round"/>',

  // 机枪手(机枪子弹)
  machinegunner:
    '<path d="M8 17 L8 8 C8 6 10 4 10 4 C10 4 12 6 12 8 L12 17 Z M7 17 L13 17 M8 13 L12 13" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round"/>',

  // 扳手
  repair: REPAIR_ICON_SVG,

  // 补给(炮弹)
  ammo:
    '<path d="M7 17 L7 9 C7 5 10 3 10 3 C10 3 13 5 13 9 L13 17 Z M6 17 L14 17" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 圆环进度组件(ProgressRing):
 * 直径约 44px 的圆环,中间绘制功能图标,下方可选一行文字提示。
 */
export class ProgressRing {
  readonly root: HTMLDivElement;
  readonly svg: SVGSVGElement;
  readonly bgCircle: SVGCircleElement;
  readonly fgCircle: SVGCircleElement;
  readonly iconGroup: SVGGElement;
  readonly labelEl: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud-progress-ring';
    this.root.style.display = 'none';

    this.svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    this.svg.setAttribute('class', 'progress-ring-svg');
    this.svg.setAttribute('width', '44');
    this.svg.setAttribute('height', '44');
    this.svg.setAttribute('viewBox', '0 0 44 44');

    this.bgCircle = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
    this.bgCircle.setAttribute('class', 'progress-ring-bg');
    this.bgCircle.setAttribute('cx', '22');
    this.bgCircle.setAttribute('cy', '22');
    this.bgCircle.setAttribute('r', String(RING_RADIUS));
    this.bgCircle.setAttribute('fill', 'none');
    this.bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.18)');
    this.bgCircle.setAttribute('stroke-width', '3');
    this.svg.appendChild(this.bgCircle);

    this.fgCircle = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
    this.fgCircle.setAttribute('class', 'progress-ring-fg');
    this.fgCircle.setAttribute('cx', '22');
    this.fgCircle.setAttribute('cy', '22');
    this.fgCircle.setAttribute('r', String(RING_RADIUS));
    this.fgCircle.setAttribute('fill', 'none');
    this.fgCircle.setAttribute('stroke', '#ffcf5a');
    this.fgCircle.setAttribute('stroke-width', '3');
    this.fgCircle.setAttribute('stroke-linecap', 'round');
    this.fgCircle.setAttribute('stroke-dasharray', CIRCUMFERENCE.toFixed(3));
    this.fgCircle.setAttribute('stroke-dashoffset', CIRCUMFERENCE.toFixed(3));
    this.fgCircle.setAttribute('transform', 'rotate(-90 22 22)');
    this.svg.appendChild(this.fgCircle);

    this.iconGroup = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    this.iconGroup.setAttribute('class', 'progress-ring-icon');
    this.iconGroup.setAttribute('transform', 'translate(12, 12)');
    this.iconGroup.setAttribute('color', '#f2f2f2');
    this.svg.appendChild(this.iconGroup);

    this.root.appendChild(this.svg);

    this.labelEl = document.createElement('div');
    this.labelEl.className = 'progress-ring-label';
    this.labelEl.style.display = 'none';
    this.root.appendChild(this.labelEl);

    parent.appendChild(this.root);
  }

  set(opts: ProgressRingOptions): void {
    this.root.style.display = 'flex';

    const p = Math.max(0, Math.min(1, opts.progress));
    const offset = CIRCUMFERENCE * (1 - p);
    this.fgCircle.setAttribute('stroke-dashoffset', offset.toFixed(3));

    const color = opts.tone === 'blue' ? '#7cc4ff' : '#ffcf5a';
    this.fgCircle.setAttribute('stroke', color);

    this.iconGroup.innerHTML = ICON_SVGS[opts.icon] ?? '';

    if (opts.label && opts.label.trim().length > 0) {
      this.labelEl.textContent = opts.label;
      this.labelEl.style.display = 'block';
    } else {
      this.labelEl.textContent = '';
      this.labelEl.style.display = 'none';
    }
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
