import type { GameMap } from '../game/Map';
import type { Loadout, VehicleSpec } from '../data/types';
import type { Profile } from '../settings/Profile';
import { crewLevel } from '../game/crew/progress';
import { renderMapBackground, type MinimapMarker } from './Minimap';
import { AmmoPanel } from './menu/AmmoPanel';
import { classIcon } from './menu/classIcons';
import { h, injectMapScreenStyles } from './menu/styles';

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
}

export interface MapScreenFrame {
  player?: { x: number; z: number; heading: number };
  markers: MinimapMarker[];
  /** 画一个标记;不传就画小圆点 */
  drawMarker?(ctx: CanvasRenderingContext2D, m: MinimapMarker, px: number, py: number): void;
}

export class MapScreen {
  readonly root: HTMLElement;
  private readonly topBar: HTMLElement;
  private readonly leftCol: HTMLElement;
  private readonly ammoContainer: HTMLElement;
  private readonly ammoPanel: AmmoPanel;
  private readonly mapInfoEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly symbologySelect: HTMLSelectElement;
  private readonly confirmBtn: HTMLButtonElement;

  private map: GameMap | null = null;
  private background: HTMLCanvasElement | null = null;
  private selectedSlotIndex = 0;
  private lastFrame: MapScreenFrame = { markers: [] };
  private symbology: 'nato' | 'warsaw';

  private readonly mapSizePx = 600;
  private readonly labelOffset = 24;

  constructor(private readonly opts: MapScreenOptions) {
    injectMapScreenStyles();
    this.symbology = opts.symbology;
    this.root = h('div', 'ms-root hidden', opts.parent);

    // 顶部: 编组卡片栏
    this.topBar = h('div', 'ms-top', this.root);

    // 主体: 左侧携弹 + 中间大地图 + 右侧工具栏
    const body = h('div', 'ms-body', this.root);

    // 左侧 (宽约 480 px)
    this.leftCol = h('div', 'ms-left', body);
    this.ammoContainer = h('div', 'ms-ammo-wrap', this.leftCol);
    this.ammoPanel = new AmmoPanel(this.ammoContainer, {
      onChange: (spec, loadout) => {
        this.opts.saveLoadout(spec, loadout);
      },
      onUiSound: opts.onUiSound,
    });
    this.mapInfoEl = h('div', 'ms-map-info', this.leftCol);

    // 中间正方形大地图
    const mapWrap = h('div', 'ms-map-wrap', body);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ms-canvas';
    const total = this.mapSizePx + this.labelOffset;
    this.canvas.width = total;
    this.canvas.height = total;
    this.canvas.style.width = `${total}px`;
    this.canvas.style.height = `${total}px`;
    mapWrap.appendChild(this.canvas);

    // 右侧工具一列
    const rightCol = h('div', 'ms-right', body);
    const tools = h('div', 'ms-tools', rightCol);

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
    });

    // 右下按钮
    const bottomActions = h('div', 'ms-bottom-actions', rightCol);
    this.confirmBtn = h('button', 'mm-btn primary ms-confirm-btn', bottomActions, '出战') as HTMLButtonElement;
    this.confirmBtn.addEventListener('click', () => {
      this.opts.onUiSound?.();
      this.opts.onConfirm();
    });
  }

  open(map: GameMap, mode: 'spawn' | 'battle'): void {
    this.map = map;
    this.confirmBtn.textContent = mode === 'spawn' ? '出战' : '返回战斗';
    this.mapInfoEl.textContent = `地图: ${map.spec.name} · 尺寸: ${map.spec.size >= 1000 ? `${map.spec.size / 1000} km` : `${map.spec.size} m`} (${map.spec.size} × ${map.spec.size} m)`;
    this.background = renderMapBackground(map, this.mapSizePx);
    this.symbology = this.opts.symbology;
    this.symbologySelect.value = this.symbology;

    this.renderTopBar();

    this.root.classList.remove('hidden');
    this.draw(this.lastFrame);
  }

  close(): void {
    this.root.classList.add('hidden');
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  draw(frame: MapScreenFrame): void {
    this.lastFrame = frame;
    if (!this.isOpen || !this.map) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const size = this.mapSizePx;
    const label = this.labelOffset;
    const total = size + label;
    const mapSize = this.map.spec.size;
    const half = mapSize / 2;

    ctx.clearRect(0, 0, total, total);

    // 坐标标注边距底色
    ctx.fillStyle = 'rgba(12, 15, 18, 0.72)';
    ctx.fillRect(0, 0, total, label);
    ctx.fillRect(0, label, label, size);

    // 10 × 10 网格标号 (数字 1..10 顶边, 字母 A..J 左边)
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(235, 235, 235, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cellPx = size / 10;
    for (let k = 0; k < 10; k++) {
      const mid = label + (k + 0.5) * cellPx;
      ctx.fillText(String(k + 1), mid, label / 2 + 0.5);
      ctx.fillText(String.fromCharCode(65 + k), label / 2, mid);
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

    if (this.background) {
      ctx.drawImage(this.background, label, label, size, size);
    }

    // 网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const pos = Math.round(label + k * cellPx) + 0.5;
      ctx.moveTo(pos, label);
      ctx.lineTo(pos, label + size);
      ctx.moveTo(label, pos);
      ctx.lineTo(label + size, pos);
    }
    ctx.stroke();

    const toPx = (x: number, z: number): [number, number] => [
      label + ((x + half) / mapSize) * size,
      label + ((z + half) / mapSize) * size,
    ];

    // 比例尺 (左下角)
    const scaleM = mapSize / 10;
    const scaleText = scaleM >= 1000 ? `${scaleM / 1000} km` : `${Math.round(scaleM)} m`;
    const barX = label + 10;
    const barY = label + size - 14;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barY - 4);
    ctx.lineTo(barX, barY);
    ctx.lineTo(barX + cellPx, barY);
    ctx.lineTo(barX + cellPx, barY - 4);
    ctx.stroke();
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(scaleText, barX + cellPx / 2, barY - 6);
    ctx.textAlign = 'left';

    // 标记
    for (const m of frame.markers) {
      const [px, py] = toPx(m.x, m.z);
      if (frame.drawMarker) {
        frame.drawMarker(ctx, m, px, py);
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

    // 玩家位置与朝向
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

    ctx.restore();

    // 地图外边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(label + 0.5, label + 0.5, size - 1, size - 1);
  }

  dispose(): void {
    this.root.remove();
  }

  private renderTopBar(): void {
    this.topBar.innerHTML = '';
    const p = this.opts.getProfile();
    const np = p.nations[p.activeNation];
    const lineup = np?.lineups.find((l) => l.id === np.activeLineup) ?? np?.lineups[0];
    const crews = np?.crews ?? [];
    const slotCount = lineup ? lineup.slots.length : crews.length;

    // 选出默认高亮的车组
    const activeSelected = lineup ? lineup.selected : 0;
    this.selectedSlotIndex = activeSelected;

    for (let i = 0; i < slotCount; i++) {
      const vehId = lineup?.slots[i] ?? null;
      const veh = vehId ? this.opts.vehicles.find((v) => v.id === vehId) : undefined;
      const crew = crews[i];
      const lvl = crewLevel(crew?.progress ?? 0);
      const isSelected = i === this.selectedSlotIndex;

      const card = h('div', `ms-card mm-lineup-slot ms-slot${isSelected ? ' sel active' : ''}`, this.topBar);
      card.dataset.slotIndex = String(i);

      const nameEl = h('div', 'ms-card-name', card);
      const iconHtml = veh?.vehicleClass ? classIcon(veh.vehicleClass) : '';
      nameEl.innerHTML = `${iconHtml}${veh?.name ?? (vehId ? vehId : '未分车')}`;

      h('div', 'ms-card-level', card, `Lv ${lvl}`);

      if (veh) {
        card.addEventListener('click', () => {
          this.opts.onUiSound?.();
          this.selectedSlotIndex = i;
          this.ammoPanel.setVehicle(veh, this.opts.loadLoadout(veh));
          // 更新高亮
          const cards = this.topBar.querySelectorAll('.ms-card');
          cards.forEach((c, idx) => {
            if (idx === i) {
              c.classList.add('sel', 'active');
            } else {
              c.classList.remove('sel', 'active');
            }
          });
        });
      }
    }

    const initialVehId = lineup?.slots[this.selectedSlotIndex] ?? null;
    const initialVeh = (initialVehId ? this.opts.vehicles.find((v) => v.id === initialVehId) : undefined) ?? this.opts.vehicles[0];
    if (initialVeh) {
      this.ammoPanel.setVehicle(initialVeh, this.opts.loadLoadout(initialVeh));
    }
  }
}
