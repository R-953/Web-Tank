import type { Loadout, VehicleClass, VehicleSpec } from '../data/types';
import type { Profile } from '../settings/Profile';
import { crewLevel } from '../game/crew/progress';
import { renderMapBackground, type MapLike, type MinimapMarker } from './Minimap';
import { drawSymbol } from './symbols';
import { AmmoPanel } from './menu/AmmoPanel';
import { classIcon } from './menu/classIcons';
import { nationFlag } from './menu/flags';
import { vehicleThumbnail } from './menu/thumbnails';
import { h, injectMapScreenStyles } from './menu/styles';

/**
 * 计算大地图画布的正方形边长(含 24 px 标号边距)。
 * 取可用宽高的较小值，下限 240、上限 1000，取整。
 */
export function mapCanvasSize(availWidth: number, availHeight: number): number {
  const minDimension = Math.min(availWidth, availHeight);
  return Math.floor(Math.max(240, Math.min(1000, minDimension)));
}

export interface MapView {
  zoom: number;
  cx: number;
  cz: number;
}

export const MAP_ZOOM_MAX = 6;

/**
 * 以鼠标位置 (0..1 的画面比例) 为锚点缩放,
 * zoom 夹在 [1, MAP_ZOOM_MAX], 视口夹在地图内
 */
export function zoomMapView(
  v: MapView,
  mapSize: number,
  factor: number,
  anchor: { u: number; v: number },
): MapView {
  const newZoom = Math.min(MAP_ZOOM_MAX, Math.max(1, v.zoom * factor));
  const oldViewSize = mapSize / v.zoom;
  const newViewSize = mapSize / newZoom;

  const wx = v.cx + (anchor.u - 0.5) * oldViewSize;
  const wz = v.cz + (anchor.v - 0.5) * oldViewSize;

  const newCx = wx - (anchor.u - 0.5) * newViewSize;
  const newCz = wz - (anchor.v - 0.5) * newViewSize;

  const lim = Math.max(0, (mapSize / 2) * (1 - 1 / newZoom));
  const clampedCx = Math.min(lim, Math.max(-lim, newCx));
  const clampedCz = Math.min(lim, Math.max(-lim, newCz));

  return {
    zoom: newZoom,
    cx: clampedCx,
    cz: clampedCz,
  };
}

/**
 * 按画面比例平移视口, du / dv 为画面比例的平移量, 结果夹在地图内
 */
export function panMapView(
  v: MapView,
  mapSize: number,
  du: number,
  dv: number,
): MapView {
  const viewSize = mapSize / v.zoom;
  const newCx = v.cx + du * viewSize;
  const newCz = v.cz + dv * viewSize;

  const lim = Math.max(0, (mapSize / 2) * (1 - 1 / v.zoom));
  const clampedCx = Math.min(lim, Math.max(-lim, newCx));
  const clampedCz = Math.min(lim, Math.max(-lim, newCz));

  return {
    zoom: v.zoom,
    cx: clampedCx,
    cz: clampedCz,
  };
}

export interface MapScreenOptions {
  parent: HTMLElement;
  vehicles: readonly VehicleSpec[];
  getProfile(): Profile;
  loadLoadout(spec: VehicleSpec): Loadout;
  saveLoadout(spec: VehicleSpec, loadout: Loadout): void;
  /** 当前符号体系;改了回调(039 的 Symbology,这里先写成字面量联合,避免依赖) */
  symbology: 'nato' | 'warsaw';
  onSymbologyChange(set: 'nato' | 'warsaw'): void;
  onConfirm(): void;
  onUiSound?(): void;
  onSelectCrew?(index: number): void;
}

export interface MapScreenFrame {
  player?: { x: number; z: number; heading: number };
  markers: MinimapMarker[];
  objective?: string;
  /** 画一个标记;不传就画小圆点 */
  drawMarker?(ctx: CanvasRenderingContext2D, m: MinimapMarker, px: number, py: number): void;
}

export class MapScreen {
  readonly root: HTMLElement;
  private readonly headerEl: HTMLElement;
  private readonly headerTitleEl: HTMLElement;
  private readonly headerModeEl: HTMLElement;
  private readonly topConfirmBtn: HTMLButtonElement;

  private readonly topBar: HTMLElement;
  private readonly topFlagEl: HTMLElement;
  private readonly cardsTrack: HTMLElement;

  private readonly leftCol: HTMLElement;
  private readonly gunTitleEl: HTMLElement;
  private readonly ammoContainer: HTMLElement;
  private readonly ammoPanel: AmmoPanel;
  private readonly objectiveTextEl: HTMLElement;
  private readonly mapInfoEl: HTMLElement;

  private readonly mapWrap: HTMLElement;
  private readonly canvas: HTMLCanvasElement;

  private readonly rightCol: HTMLElement;
  private readonly symbologySelect: HTMLSelectElement;
  private readonly bottomConfirmBtn: HTMLButtonElement;

  private map: MapLike | null = null;
  private mode: 'spawn' | 'battle' = 'spawn';
  private view: MapView = { zoom: 1, cx: 0, cz: 0 };
  private background: HTMLCanvasElement | null = null;
  private selectedSlotIndex = 0;
  private lastFrame: MapScreenFrame = { markers: [] };
  private symbology: 'nato' | 'warsaw';

  private currentCanvasSize = 0;
  private lastBgPixels = 0;
  private readonly labelOffset = 24;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  private readonly onResize = (): void => {
    if (!this.isOpen) return;
    this.updateDimensions();
    this.draw(this.lastFrame);
  };

  private readonly onWindowMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging || !this.map || !this.isOpen) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    const size = this.currentCanvasSize - this.labelOffset;
    if (size <= 0) return;
    // 鼠标向右拖(dx > 0)，地图内容向右移，视口中心向左移 (cx 变小)
    const du = -dx / size;
    const dv = -dy / size;
    this.view = panMapView(this.view, this.map.spec.size, du, dv);
    this.draw(this.lastFrame);
  };

  private readonly onWindowMouseUp = (): void => {
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    }
  };

  constructor(private readonly opts: MapScreenOptions) {
    injectMapScreenStyles();
    this.symbology = opts.symbology;
    this.root = h('div', 'ms-root hidden', opts.parent);

    // 1. 顶部 Header 栏: 左上两行小字 + 顶部正中出战按钮
    this.headerEl = h('div', 'ms-header', this.root);
    const headerInfo = h('div', 'ms-header-info', this.headerEl);
    this.headerTitleEl = h('div', 'ms-header-title', headerInfo);
    this.headerModeEl = h('div', 'ms-header-mode', headerInfo);
    this.headerModeEl.style.display = 'none';

    const headerCenter = h('div', 'ms-header-center', this.headerEl);
    this.topConfirmBtn = h(
      'button',
      'mm-btn primary ms-confirm-btn',
      headerCenter,
      '出战',
    ) as HTMLButtonElement;
    this.topConfirmBtn.addEventListener('click', () => {
      this.opts.onUiSound?.();
      this.opts.onConfirm();
    });
    h('div', 'ms-header-right', this.headerEl);

    // 2. 顶部整条横带: 国旗 + 车组卡片横排
    this.topBar = h('div', 'ms-top', this.root);
    this.topFlagEl = h('div', 'ms-top-flag', this.topBar);
    this.cardsTrack = h('div', 'ms-cards-track', this.topBar);

    // 3. 主体: 左侧携弹 + 中间大地图 + 右侧工具栏
    const body = h('div', 'ms-body', this.root);

    // 左侧 (约占宽度 25%)
    this.leftCol = h('div', 'ms-left', body);
    this.gunTitleEl = h('div', 'ms-gun-title', this.leftCol, '主炮');
    this.ammoContainer = h('div', 'ms-ammo-wrap', this.leftCol);
    this.ammoPanel = new AmmoPanel(this.ammoContainer, {
      onChange: (spec, loadout) => {
        this.opts.saveLoadout(spec, loadout);
      },
      onUiSound: opts.onUiSound,
    });

    const objectiveWrap = h('div', 'ms-objective-wrap', this.leftCol);
    h('div', 'ms-objective-label', objectiveWrap, '任务目标');
    this.objectiveTextEl = h('div', 'ms-objective-text', objectiveWrap, '摧毁全部靶车');

    // 保留隐藏的 ms-map-info 元素以防外部依赖
    this.mapInfoEl = h('div', 'ms-map-info', this.leftCol);

    // 中间正方形大地图
    this.mapWrap = h('div', 'ms-map-wrap', body);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ms-canvas';
    this.mapWrap.appendChild(this.canvas);

    // 鼠标缩放与拖拽平移交互
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.map) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - this.labelOffset;
      const y = e.clientY - rect.top - this.labelOffset;
      const size = this.currentCanvasSize - this.labelOffset;
      if (size <= 0) return;
      const u = Math.min(1, Math.max(0, x / size));
      const v = Math.min(1, Math.max(0, y / size));
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      this.view = zoomMapView(this.view, this.map.spec.size, factor, { u, v });
      this.draw(this.lastFrame);
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.onWindowMouseMove);
      window.addEventListener('mouseup', this.onWindowMouseUp);
    }

    // 右侧工具一列 (窄, 约 100 px)
    this.rightCol = h('div', 'ms-right', body);
    const tools = h('div', 'ms-tools', this.rightCol);

    // 符号体系下拉框「北约 / 华约」
    const symRow = h('div', 'ms-tool-item', tools);
    h('div', 'mm-dim', symRow, '符号体系');
    this.symbologySelect = h('select', 'ms-symbology-select', symRow) as HTMLSelectElement;
    const optNato = h('option', '', this.symbologySelect, '北约') as HTMLOptionElement;
    optNato.value = 'nato';
    const optWarsaw = h('option', '', this.symbologySelect, '华约') as HTMLOptionElement;
    optWarsaw.value = 'warsaw';
    this.symbologySelect.value = this.symbology;
    this.symbologySelect.addEventListener('change', () => {
      this.opts.onUiSound?.();
      const val = this.symbologySelect.value as 'nato' | 'warsaw';
      this.symbology = val;
      this.opts.onSymbologyChange(val);
      this.refreshCardIcons();
      this.draw(this.lastFrame);
    });

    // 图标按钮排: 🔍(滚轮缩放), ✚(拖动平移), ↺(复位)
    const iconTools = h('div', 'ms-icon-tools', tools);
    const zoomIcon = h('button', 'mm-btn ms-tool-btn', iconTools, '🔍');
    zoomIcon.title = '滚轮缩放';
    const panIcon = h('button', 'mm-btn ms-tool-btn', iconTools, '✚');
    panIcon.title = '拖动平移';
    const resetIcon = h('button', 'mm-btn ms-tool-btn ms-reset-btn', iconTools, '↺');
    resetIcon.title = '复位';
    resetIcon.addEventListener('click', () => {
      this.opts.onUiSound?.();
      this.resetView();
      this.draw(this.lastFrame);
    });

    // 右下角出战按钮
    const bottomActions = h('div', 'ms-bottom-actions', this.rightCol);
    this.bottomConfirmBtn = h(
      'button',
      'mm-btn primary ms-confirm-btn',
      bottomActions,
      '出战',
    ) as HTMLButtonElement;
    this.bottomConfirmBtn.addEventListener('click', () => {
      this.opts.onUiSound?.();
      this.opts.onConfirm();
    });
  }

  resetView(): void {
    this.view = { zoom: 1, cx: 0, cz: 0 };
  }

  open(map: MapLike, mode: 'spawn' | 'battle'): void {
    if (this.map !== map) {
      this.background = null;
      this.lastBgPixels = 0;
    }
    this.map = map;
    this.mode = mode;
    this.resetView();

    const btnText = mode === 'spawn' ? '出战' : '返回战斗';
    this.topConfirmBtn.textContent = btnText;
    this.bottomConfirmBtn.textContent = btnText;

    // 左上角小字: 第一行「地图名 · 边长」
    const sizeStr = map.spec.size >= 1000 ? `${map.spec.size / 1000} km` : `${map.spec.size} m`;
    this.headerTitleEl.textContent = `${map.spec.name} · ${sizeStr}`;

    // 第二行: 「模式:训练」或「模式:守卫」
    const aiPreset = (map.spec as { aiPreset?: string }).aiPreset;
    if (aiPreset === 'training') {
      this.headerModeEl.textContent = '模式:训练';
      this.headerModeEl.style.display = 'block';
    } else if (aiPreset === 'guard') {
      this.headerModeEl.textContent = '模式:守卫';
      this.headerModeEl.style.display = 'block';
    } else {
      this.headerModeEl.style.display = 'none';
    }

    this.mapInfoEl.textContent = `地图: ${map.spec.name} · 尺寸: ${sizeStr} (${map.spec.size} × ${map.spec.size} m)`;

    this.symbology = this.opts.symbology;
    this.symbologySelect.value = this.symbology;

    const p = this.opts.getProfile();
    this.topFlagEl.innerHTML = nationFlag(p.activeNation, 28);

    this.renderTopBar();

    this.root.classList.remove('hidden');

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
      window.addEventListener('resize', this.onResize);
    }

    this.updateDimensions();
    this.draw(this.lastFrame);
  }

  close(): void {
    this.root.classList.add('hidden');
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
    }
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  draw(frame: MapScreenFrame): void {
    this.lastFrame = frame;
    if (frame.objective !== undefined) {
      this.objectiveTextEl.textContent = frame.objective || '摧毁全部靶车';
    }

    if (!this.isOpen || !this.map) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const total = this.currentCanvasSize;
    const label = this.labelOffset;
    const size = total - label;
    const mapSize = this.map.spec.size;
    const half = mapSize / 2;

    ctx.clearRect(0, 0, total, total);

    // 坐标标注边距底色
    ctx.fillStyle = 'rgba(12, 15, 18, 0.72)';
    ctx.fillRect(0, 0, total, label);
    ctx.fillRect(0, label, label, size);

    // 世界坐标 -> 画面像素坐标转换函数
    const toPx = (x: number, z: number): [number, number] => {
      const viewSize = mapSize / this.view.zoom;
      const u = (x - (this.view.cx - viewSize / 2)) / viewSize;
      const v = (z - (this.view.cz - viewSize / 2)) / viewSize;
      return [label + u * size, label + v * size];
    };

    // 10 × 10 网格标号 (数字 1..10 顶边, 小写字母 a..j 左边，跟着可见格子走)
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(235, 235, 235, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cellM = mapSize / 10;
    for (let k = 0; k < 10; k++) {
      const midCoord = -half + (k + 0.5) * cellM;
      const [midPx] = toPx(midCoord, 0);
      const [, midPz] = toPx(0, midCoord);
      if (midPx >= label + 4 && midPx <= label + size - 4) {
        ctx.fillText(String(k + 1), midPx, label / 2 + 0.5);
      }
      if (midPz >= label + 4 && midPz <= label + size - 4) {
        ctx.fillText(String.fromCharCode(97 + k), label / 2, midPz);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 地图内容区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(label, label, size, size);
    ctx.clip();

    ctx.fillStyle = '#1b2227';
    ctx.fillRect(label, label, size, size);

    // 底图绘制 (按视口裁剪源矩形)
    if (this.background) {
      const bg = this.background;
      const k = bg.width / mapSize;
      const viewSize = mapSize / this.view.zoom;
      const sx = (this.view.cx - viewSize / 2 + half) * k;
      const sy = (this.view.cz - viewSize / 2 + half) * k;
      const sw = viewSize * k;
      const sh = viewSize * k;
      ctx.drawImage(bg, sx, sy, sw, sh, label, label, size, size);
    }

    // 网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const lineWorld = -half + k * cellM;
      const [lx] = toPx(lineWorld, 0);
      const [, ly] = toPx(0, lineWorld);
      if (lx >= label - 1 && lx <= label + size + 1) {
        const px = Math.round(lx) + 0.5;
        ctx.moveTo(px, label);
        ctx.lineTo(px, label + size);
      }
      if (ly >= label - 1 && ly <= label + size + 1) {
        const py = Math.round(ly) + 0.5;
        ctx.moveTo(label, py);
        ctx.lineTo(label + size, py);
      }
    }
    ctx.stroke();

    // 比例尺 (右下角)
    let scaleM = mapSize / 10;
    let barW = (size / 10) * this.view.zoom;
    while (barW > 120 && scaleM > 10) {
      barW /= 2;
      scaleM /= 2;
    }
    while (barW < 40) {
      barW *= 2;
      scaleM *= 2;
    }
    const scaleText = scaleM >= 1000 ? `${scaleM / 1000} km` : `${Math.round(scaleM)} m`;
    const barX = label + size - barW - 14;
    const barY = label + size - 14;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barY - 4);
    ctx.lineTo(barX, barY);
    ctx.lineTo(barX + barW, barY);
    ctx.lineTo(barX + barW, barY - 4);
    ctx.stroke();
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(scaleText, barX + barW / 2, barY - 6);
    ctx.textAlign = 'left';

    // 标记
    for (const m of frame.markers) {
      const [px, py] = toPx(m.x, m.z);
      if (frame.drawMarker) {
        frame.drawMarker(ctx, m, px, py);
      } else if (m.vehicleClass) {
        drawSymbol(ctx, m.vehicleClass, px, py, {
          set: this.symbology,
          affiliation: m.team === 'enemy' ? 'hostile' : 'friend',
          dead: m.dead,
          size: 18,
        });
      } else {
        const color = m.team === 'enemy' ? '#ff3b30' : '#3aa0ff';
        ctx.beginPath();
        ctx.arc(px, py, m.dead ? 3 : 4, 0, Math.PI * 2);
        ctx.fillStyle = m.dead ? '#5a5a5a' : color;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.stroke();
        if (m.dead) {
          ctx.strokeStyle = '#c8c8c8';
          ctx.beginPath();
          ctx.moveTo(px - 2.5, py - 2.5);
          ctx.lineTo(px + 2.5, py + 2.5);
          ctx.moveTo(px + 2.5, py - 2.5);
          ctx.lineTo(px - 2.5, py + 2.5);
          ctx.stroke();
        }
      }
    }

    if (this.mode === 'spawn') {
      // 出战前(spawn 模式)在玩家出生点画黄色四角括号加该车的军标
      const spawnPos = this.map.spec.spawns?.player?.position;
      if (spawnPos) {
        const [spx, spy] = toPx(spawnPos[0], spawnPos[1]);
        const boxSize = 14;
        const arm = 5;
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // 左上角
        ctx.moveTo(spx - boxSize, spy - boxSize + arm);
        ctx.lineTo(spx - boxSize, spy - boxSize);
        ctx.lineTo(spx - boxSize + arm, spy - boxSize);
        // 右上角
        ctx.moveTo(spx + boxSize - arm, spy - boxSize);
        ctx.lineTo(spx + boxSize, spy - boxSize);
        ctx.lineTo(spx + boxSize, spy - boxSize + arm);
        // 右下角
        ctx.moveTo(spx + boxSize, spy + boxSize - arm);
        ctx.lineTo(spx + boxSize, spy + boxSize);
        ctx.lineTo(spx + boxSize - arm, spy + boxSize);
        // 左下角
        ctx.moveTo(spx - boxSize + arm, spy + boxSize);
        ctx.lineTo(spx - boxSize, spy + boxSize);
        ctx.lineTo(spx - boxSize, spy + boxSize - arm);
        ctx.stroke();

        const currentVeh = this.selectedVehicle();
        const vehClass = currentVeh?.vehicleClass ?? 'medium';
        drawSymbol(ctx, vehClass, spx, spy, {
          set: this.symbology,
          affiliation: 'friend',
          dead: false,
          size: 18,
        });
      }
    } else {
      // 战斗中(battle 模式)画玩家位置与朝向箭头
      if (frame.player) {
        const [px, py] = toPx(frame.player.x, frame.player.z);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-frame.player.heading);
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(6, 6);
        ctx.lineTo(0, 2);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();

    // 地图外边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(label + 0.5, label + 0.5, size - 1, size - 1);
  }

  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('mousemove', this.onWindowMouseMove);
      window.removeEventListener('mouseup', this.onWindowMouseUp);
    }
    this.root.remove();
  }

  private updateDimensions(): void {
    if (!this.map) return;
    const availW = this.mapWrap.clientWidth;
    const availH = this.mapWrap.clientHeight;
    let size: number;
    if (availW > 0 && availH > 0) {
      size = mapCanvasSize(availW, availH);
    } else {
      const winW = (typeof window !== 'undefined' && window.innerWidth) || 1280;
      const winH = (typeof window !== 'undefined' && window.innerHeight) || 720;
      const headerH = this.headerEl.offsetHeight || 46;
      const topH = this.topBar.offsetHeight || 74;
      const leftW = this.leftCol.offsetWidth || Math.round(winW * 0.25);
      const rightW = this.rightCol.offsetWidth || 100;
      const fallbackW = Math.max(0, winW - leftW - rightW - 48);
      const fallbackH = Math.max(0, winH - headerH - topH - 24);
      size = mapCanvasSize(fallbackW, fallbackH);
    }

    if (this.currentCanvasSize !== size) {
      this.currentCanvasSize = size;
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
    }

    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const pixelTotal = Math.round(size * dpr);
    if (this.canvas.width !== pixelTotal || this.canvas.height !== pixelTotal) {
      this.canvas.width = pixelTotal;
      this.canvas.height = pixelTotal;
    }

    const contentPixels = Math.round((size - this.labelOffset) * dpr);
    if (this.lastBgPixels !== contentPixels || !this.background) {
      this.background = renderMapBackground(this.map, contentPixels);
      this.lastBgPixels = contentPixels;
    }
  }

  /** 获取当前选中的载具 */
  private selectedVehicle(): VehicleSpec | undefined {
    const p = this.opts.getProfile();
    const np = p.nations[p.activeNation];
    const lineup = np?.lineups.find((l) => l.id === np.activeLineup) ?? np?.lineups[0];
    const vehId = lineup?.slots[this.selectedSlotIndex] ?? null;
    return (vehId ? this.opts.vehicles.find((v) => v.id === vehId) : undefined) ?? this.opts.vehicles[0];
  }

  private updateGunTitle(veh?: VehicleSpec): void {
    if (!veh) {
      this.gunTitleEl.textContent = '主炮';
      return;
    }
    const mainGun = veh.weapons.find((w) => w.kind === 'cannon' || !w.kind) ?? veh.weapons[0];
    if (mainGun) {
      const caliber = (mainGun as { caliber?: number }).caliber ?? mainGun.ammo[0]?.caliber;
      if (caliber) {
        this.gunTitleEl.textContent = `主炮 · ${caliber} mm (${mainGun.name})`;
      } else {
        this.gunTitleEl.textContent = `主炮 · ${mainGun.name}`;
      }
    } else {
      this.gunTitleEl.textContent = '主炮';
    }
  }

  /** 符号体系换了: 重画车组卡片类型图标 */
  private refreshCardIcons(): void {
    for (const card of Array.from(this.cardsTrack.querySelectorAll<HTMLElement>('.ms-card'))) {
      const cls = card.dataset.vehicleClass as VehicleClass | undefined;
      if (!cls) continue;
      const rightIcon = card.querySelector('.ms-card-type-icon');
      if (rightIcon) {
        rightIcon.innerHTML = classIcon(cls);
      }
      const thumbFallback = card.querySelector('.ms-card-thumb-fallback');
      if (thumbFallback) {
        thumbFallback.innerHTML = classIcon(cls);
      }
    }
  }

  private renderTopBar(): void {
    this.cardsTrack.innerHTML = '';
    const p = this.opts.getProfile();
    const np = p.nations[p.activeNation];
    const lineup = np?.lineups.find((l) => l.id === np.activeLineup) ?? np?.lineups[0];
    const crews = np?.crews ?? [];
    const slotCount = lineup ? lineup.slots.length : crews.length;

    // 默认高亮的车组
    const activeSelected = lineup ? lineup.selected : 0;
    this.selectedSlotIndex = activeSelected;

    for (let i = 0; i < slotCount; i++) {
      const vehId = lineup?.slots[i] ?? null;
      const veh = vehId ? this.opts.vehicles.find((v) => v.id === vehId) : undefined;
      const crew = crews[i];
      const lvl = crewLevel(crew?.progress ?? 0);
      const isSelected = i === this.selectedSlotIndex;

      const card = h('div', `ms-card mm-lineup-slot ms-slot${isSelected ? ' sel active' : ''}`, this.cardsTrack);
      card.dataset.slotIndex = String(i);
      if (veh?.vehicleClass) card.dataset.vehicleClass = veh.vehicleClass;

      // 上半: 缩略图/车名/类型符号
      const mainRow = h('div', 'ms-card-main', card);
      const thumbWrap = h('div', 'ms-card-thumb-wrap', mainRow);

      if (veh) {
        const thumb = vehicleThumbnail(veh);
        if (thumb) {
          const img = h('img', 'ms-card-thumb', thumbWrap) as HTMLImageElement;
          img.src = thumb;
          img.alt = veh.name;
        } else if (veh.vehicleClass) {
          const fallback = h('div', 'ms-card-thumb-fallback', thumbWrap);
          fallback.innerHTML = classIcon(veh.vehicleClass);
        }

        const nameEl = h('div', 'ms-card-name', mainRow);
        nameEl.textContent = veh.name;

        if (veh.vehicleClass) {
          const typeIcon = h('div', 'ms-card-type-icon', mainRow);
          typeIcon.innerHTML = classIcon(veh.vehicleClass);
        }
      } else {
        h('div', 'ms-card-empty-plus', mainRow, '+');
        const nameEl = h('div', 'ms-card-name mm-dim', mainRow);
        nameEl.textContent = vehId ? vehId : '未分车';
      }

      // 下半: 细栏(车组编号与等级)
      const footer = h('div', 'ms-card-footer', card);
      h('div', 'ms-card-crew-num', footer, `👤 ${i + 1}`);
      h('div', 'ms-card-level', footer, `Lv ${lvl}`);

      card.addEventListener('click', () => {
        this.opts.onUiSound?.();
        if (veh) {
          this.ammoPanel.setVehicle(veh, this.opts.loadLoadout(veh));
          this.updateGunTitle(veh);
        }
        if (this.mode === 'spawn') {
          this.selectedSlotIndex = i;
          this.opts.onSelectCrew?.(i);
          // 更新高亮
          const cards = this.cardsTrack.querySelectorAll('.ms-card');
          cards.forEach((c, idx) => {
            if (idx === i) {
              c.classList.add('sel', 'active');
            } else {
              c.classList.remove('sel', 'active');
            }
          });
          this.draw(this.lastFrame);
        }
      });
    }

    const initialVeh = this.selectedVehicle();
    if (initialVeh) {
      this.ammoPanel.setVehicle(initialVeh, this.opts.loadLoadout(initialVeh));
      this.updateGunTitle(initialVeh);
    }
  }
}
