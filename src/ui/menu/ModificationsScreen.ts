import type { VehicleSpec } from '../../data/types';
import {
  modificationsFor,
  toggleModification,
  applyModifications,
  type ModificationSpec,
  type ModBranch,
  type ModTier,
  type ModEffect,
} from '../../data/modifications';
import { vehicleThumbnail } from './thumbnails';
import { classIcon } from './classIcons';

export interface ModificationsScreenOptions {
  parent: HTMLElement;
  getEnabled(vehicleId: string): string[];
  setEnabled(vehicleId: string, ids: string[]): void; // 调用方负责保存
  onClose?(): void;
  onUiSound?(): void;
}

let stylesInjected = false;

const MODIFICATIONS_CSS = `
/* 改装界面遮罩与容器 */
.mod-screen-root {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 10, 14, 0.75);
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #e6e8ea;
  user-select: none;
}
.mod-screen-root.hidden {
  display: none !important;
}

/* 居中大面板 (约占屏幕宽 65%, 深色底) */
.mod-panel {
  width: min(880px, 92vw);
  max-width: 65vw;
  min-width: 580px;
  max-height: min(680px, 90vh);
  background: rgba(20, 25, 30, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

/* 顶栏: 标题与关闭按钮 */
.mod-header {
  height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(14, 18, 22, 0.95);
  flex-shrink: 0;
}
.mod-title {
  font-size: 16px;
  font-weight: 700;
  color: #f3d27f;
  letter-spacing: 0.5px;
}
.mod-close-btn {
  font: inherit;
  font-size: 18px;
  color: #cfd3d6;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s ease;
}
.mod-close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

/* 内部内容滚动区 (避免屏幕尺寸 1280x720 / 961x541 下出现外层滚动条) */
.mod-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 第一排: 左边当前车辆卡片, 右边留空 */
.mod-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.mod-vehicle-card {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(28, 35, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 4px 12px 4px 6px;
}
.mod-vehicle-thumb {
  max-width: 90px;
  max-height: 48px;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}
.mod-vehicle-icon {
  width: 44px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f3d27f;
}
.mod-vehicle-name {
  font-size: 14px;
  font-weight: 700;
  color: #e6e8ea;
}

/* 主体网格: 标尺 + 三栏 (机动 / 防护 / 火力) */
.mod-grid {
  display: grid;
  grid-template-columns: 44px 1fr 1fr 1fr;
  gap: 8px;
  align-items: start;
}

/* 标尺 */
.mod-ruler-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mod-ruler-header {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
}
.mod-ruler-item {
  min-height: 82px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #f3d27f;
  font-weight: 700;
  font-size: 14px;
}
.mod-ruler-arrow {
  font-size: 9px;
  color: rgba(243, 210, 127, 0.5);
}

/* 分支栏目 */
.mod-branch-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(24, 30, 36, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  padding: 4px;
}
.mod-col-header {
  height: 28px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  color: #cfd3d6;
}
.mod-tier-cell {
  min-height: 82px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
}

/* 改装小方块 */
.mod-card {
  position: relative;
  width: 92px;
  height: 74px;
  background: rgba(30, 37, 45, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px;
  padding: 4px 6px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.15s ease;
}
.mod-card:hover:not(.locked) {
  background: #36404a;
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
}
.mod-card.enabled {
  border-color: #e0b44c;
  box-shadow: inset 0 0 0 1px #e0b44c, 0 0 8px rgba(224, 180, 76, 0.25);
  background: rgba(58, 48, 25, 0.9);
}
.mod-card.enabled .mod-card-name {
  color: #f3d27f;
}
.mod-card.locked {
  opacity: 0.38;
  filter: grayscale(60%);
  cursor: not-allowed;
}

.mod-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.mod-icon-wrap {
  color: #cfd3d6;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mod-card.enabled .mod-icon-wrap {
  color: #f3d27f;
}

.mod-card-name {
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  line-height: 1.25;
  color: #e6e8ea;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mod-card-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  width: 100%;
}
.mod-card-no-effects {
  font-size: 9px;
  color: #8f969e;
  line-height: 1;
  white-space: nowrap;
}

/* 右下角勾选框 */
.mod-checkbox {
  width: 14px;
  height: 14px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: rgba(0, 0, 0, 0.25);
  color: transparent;
  margin-left: auto;
}
.mod-card.enabled .mod-checkbox {
  border-color: #e0b44c;
  background: #e0b44c;
  color: #1a1a1a;
}

/* 悬停详细 Tooltip */
.mod-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  padding: 8px 10px;
  background: rgba(18, 22, 28, 0.98);
  border: 1px solid rgba(224, 180, 76, 0.7);
  border-radius: 4px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7);
  color: #e6e8ea;
  font-size: 11px;
  line-height: 1.4;
  pointer-events: none;
  z-index: 100;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, visibility 0.15s ease;
}
.mod-card:hover .mod-tooltip {
  opacity: 1;
  visibility: visible;
}
.mod-tooltip-name {
  font-weight: 700;
  font-size: 12px;
  color: #f3d27f;
  margin-bottom: 4px;
}
.mod-tooltip-desc {
  color: #cfd3d6;
  margin-bottom: 6px;
}
.mod-tooltip-effects {
  color: #9fe39f;
  font-weight: 600;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 4px;
}
.mod-tooltip-effects.empty {
  color: #8f969e;
  font-style: italic;
}
.mod-tooltip-req {
  color: #ff9e80;
  font-size: 10px;
  margin-top: 4px;
}

/* 效果汇总 */
.mod-summary {
  background: rgba(24, 30, 36, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 8px 12px;
}
.mod-summary-header {
  font-size: 12px;
  font-weight: 700;
  color: #f3d27f;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}
.mod-summary-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.mod-summary-item {
  font-size: 12px;
  color: #9fe39f;
  background: rgba(159, 227, 159, 0.08);
  border: 1px solid rgba(159, 227, 159, 0.2);
  padding: 2px 8px;
  border-radius: 3px;
  font-variant-numeric: tabular-nums;
}
.mod-summary-empty {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}

/* 底部操作与进度 */
.mod-footer {
  height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(14, 18, 22, 0.95);
  flex-shrink: 0;
}
.mod-progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mod-progress-label {
  font-size: 12px;
  font-weight: 600;
  color: #cfd3d6;
  white-space: nowrap;
}
.mod-progress-track {
  width: 140px;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}
.mod-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #e7bd57, #f3d27f);
  border-radius: 4px;
  transition: width 0.2s ease;
}

.mod-footer-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mod-btn {
  font: inherit;
  color: #e6e8ea;
  background: #2b333b;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 3px;
  padding: 5px 14px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s ease;
}
.mod-btn:hover {
  background: #36404a;
  border-color: rgba(255, 255, 255, 0.28);
}
.mod-btn:active {
  transform: translateY(1px);
}
`;

export function injectModificationsStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'modifications-screen-styles';
  style.textContent = MODIFICATIONS_CSS;
  document.head.appendChild(style);
}

/** 格式化数字, 最多保留 2 位小数 */
function formatNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

/** 载具通用退回图标 */
function defaultVehicleIconSvg(): string {
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <rect x="2" y="8" width="20" height="10" rx="3" fill="#9aa39a"/>
    <rect x="7" y="5" width="8" height="4" rx="1" fill="#b3bbb2"/>
    <rect x="1" y="6" width="7" height="2" fill="#b3bbb2"/>
  </svg>`;
}

/**
 * 按 effects 的种类选图标:
 * 履带 / 悬挂 / 变速箱 / 发动机 / 方向机 / 高低机 / 维修 / 灭火 / 乘员 / 其他通用
 */
export function getModIconSvg(mod: ModificationSpec): string {
  const id = mod.id.toLowerCase();
  const name = mod.name.toLowerCase();

  // 1. 方向机 (turretRotationSpeed)
  if (
    mod.effects.some((e) => e.kind === 'turretRotationSpeed') ||
    id.includes('traverse') ||
    id.includes('rotation') ||
    name.includes('方向机') ||
    name.includes('水平')
  ) {
    return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M4 12h3M17 12h3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l3 3"/>
    </svg>`;
  }

  // 2. 高低机 (elevationSpeed)
  if (
    mod.effects.some((e) => e.kind === 'elevationSpeed') ||
    id.includes('elevation') ||
    name.includes('高低机') ||
    name.includes('俯仰')
  ) {
    return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 19h14M6 19l11-11M12 8h5v5"/>
      <circle cx="6" cy="19" r="2" fill="currentColor"/>
    </svg>`;
  }

  // 3. 履带 (turnRate)
  if (
    mod.effects.some((e) => e.kind === 'turnRate') ||
    id.includes('track') ||
    name.includes('履带')
  ) {
    return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="20" height="10" rx="5"/>
      <circle cx="7" cy="12" r="2" fill="currentColor"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
      <circle cx="17" cy="12" r="2" fill="currentColor"/>
    </svg>`;
  }

  // 4. 悬挂 (suspension)
  if (id.includes('suspension') || name.includes('悬挂')) {
    return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v3l-4 2 8 3-8 3 8 3-4 2v4"/>
      <circle cx="12" cy="2" r="1.5" fill="currentColor"/>
    </svg>`;
  }

  // 5. 变速箱 (transmission / gearbox)
  if (
    id.includes('transmission') ||
    id.includes('gear') ||
    name.includes('变速箱') ||
    name.includes('传动')
  ) {
    return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="9" r="4"/>
      <circle cx="16" cy="15" r="4"/>
      <path d="M8 9l8 6"/>
    </svg>`;
  }

  // 6. 发动机 (acceleration / maxSpeed / engine)
  if (
    mod.effects.some((e) => e.kind === 'acceleration' || e.kind === 'maxSpeed') ||
    id.includes('engine') ||
    name.includes('发动机')
  ) {
    return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="8" width="14" height="10" rx="1.5"/>
      <path d="M2 11h3M19 11h3M8 5h8v3H8zM5 14v3M19 14v3M9 18v2M15 18v2"/>
    </svg>`;
  }

  // 7. 维修备件 (repair parts)
  if (
    id.includes('parts') ||
    id.includes('repair') ||
    name.includes('备件') ||
    name.includes('维修')
  ) {
    return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>`;
  }

  // 8. 灭火器 (fire extinguisher / fpe)
  if (id.includes('fpe') || id.includes('fire') || name.includes('灭火')) {
    return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="8" y="7" width="8" height="13" rx="3"/>
      <path d="M10 7V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3M7 6h4M16 9l3 2"/>
    </svg>`;
  }

  // 9. 乘员 (crew)
  if (id.includes('crew') || name.includes('乘员')) {
    return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3a5 5 0 0 0-5 5v3h10V8a5 5 0 0 0-5-5zM6 14a6 6 0 0 0 12 0v5H6v-5z"/>
    </svg>`;
  }

  // 10. 通用齿轮图标
  return `<svg class="mod-icon-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`;
}

/** 格式化效果详情 */
function formatEffectText(eff: ModEffect): string {
  const pct = Math.round((eff.mult - 1) * 100);
  const sign = pct >= 0 ? '+' : '';
  const pctStr = `${sign}${pct}%`;
  switch (eff.kind) {
    case 'turretRotationSpeed':
      return `水平方向机速度 ×${eff.mult} (${pctStr})`;
    case 'elevationSpeed':
      return `高低机俯仰速度 ×${eff.mult} (${pctStr})`;
    case 'turnRate':
      return `车体转向角速度 ×${eff.mult} (${pctStr})`;
    case 'acceleration':
      return `起步牵引加速度 ×${eff.mult} (${pctStr})`;
    case 'maxSpeed':
      return `最大前进速度 ×${eff.mult} (${pctStr})`;
  }
}

export class ModificationsScreen {
  private readonly opts: ModificationsScreenOptions;
  public readonly root: HTMLElement;
  private _isOpen = false;
  private currentSpec: VehicleSpec | null = null;
  private currentEnabled: string[] = [];
  private mods: readonly ModificationSpec[] = [];
  private readonly handleKeyDown: (e: KeyboardEvent) => void;

  constructor(opts: ModificationsScreenOptions) {
    this.opts = opts;
    injectModificationsStyles();

    this.root = document.createElement('div');
    this.root.className = 'mod-screen-root hidden';
    this.root.style.display = 'none';

    // 点面板外的遮罩也关闭
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) {
        this.opts.onUiSound?.();
        this.close();
      }
    });

    this.handleKeyDown = (e: KeyboardEvent) => {
      if (this._isOpen && e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        this.opts.onUiSound?.();
        this.close();
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);

    this.opts.parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(spec: VehicleSpec): void {
    this.currentSpec = spec;
    this.currentEnabled = [...(this.opts.getEnabled(spec.id) ?? [])];
    this.mods = modificationsFor(spec);
    this._isOpen = true;
    this.root.classList.remove('hidden');
    this.root.style.display = 'flex';
    this.render();
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.root.classList.add('hidden');
    this.root.style.display = 'none';
    this.opts.onClose?.();
  }

  dispose(): void {
    this._isOpen = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
  }

  private render(): void {
    if (!this.currentSpec) return;
    const spec = this.currentSpec;
    this.root.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'mod-panel';
    panel.addEventListener('click', (e) => e.stopPropagation());

    // 1. 顶栏: 标题「改装 · <车名>」, 右上角 ×
    const header = document.createElement('div');
    header.className = 'mod-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'mod-title';
    titleEl.textContent = `改装 · ${spec.name}`;
    header.appendChild(titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'mod-close-btn';
    closeBtn.title = '关闭 (Esc)';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.opts.onUiSound?.();
      this.close();
    });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // 内部滚动体
    const body = document.createElement('div');
    body.className = 'mod-body';

    // 2. 第一排: 左边当前车辆卡片(缩略图 vehicleThumbnail(spec), 没有时退回类型符号; 车名); 右边留空
    const topRow = document.createElement('div');
    topRow.className = 'mod-top-row';

    const vehicleCard = document.createElement('div');
    vehicleCard.className = 'mod-vehicle-card';

    const thumbUrl = vehicleThumbnail(spec);
    if (thumbUrl) {
      const img = document.createElement('img');
      img.className = 'mod-vehicle-thumb';
      img.src = thumbUrl;
      img.alt = spec.name;
      vehicleCard.appendChild(img);
    } else {
      const iconWrap = document.createElement('div');
      iconWrap.className = 'mod-vehicle-icon';
      if (spec.vehicleClass) {
        iconWrap.innerHTML = classIcon(spec.vehicleClass, 28);
      } else {
        iconWrap.innerHTML = defaultVehicleIconSvg();
      }
      vehicleCard.appendChild(iconWrap);
    }

    const nameEl = document.createElement('span');
    nameEl.className = 'mod-vehicle-name';
    nameEl.textContent = spec.name;
    vehicleCard.appendChild(nameEl);

    topRow.appendChild(vehicleCard);
    body.appendChild(topRow);

    // 3. 主体三栏:「机动」「防护」「火力」, 最左边竖着一条带 I / II / III / IV 的箭头标尺
    const grid = document.createElement('div');
    grid.className = 'mod-grid';

    // 标尺列
    const rulerCol = document.createElement('div');
    rulerCol.className = 'mod-ruler-col';

    const rulerHeader = document.createElement('div');
    rulerHeader.className = 'mod-ruler-header';
    rulerHeader.textContent = '等级';
    rulerCol.appendChild(rulerHeader);

    const romanTiers = ['I', 'II', 'III', 'IV'] as const;
    const tierNums: ModTier[] = [1, 2, 3, 4];

    for (let i = 0; i < tierNums.length; i++) {
      const item = document.createElement('div');
      item.className = 'mod-ruler-item';
      item.dataset.tier = String(tierNums[i]);

      const label = document.createElement('span');
      label.textContent = romanTiers[i];
      item.appendChild(label);

      if (i < tierNums.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'mod-ruler-arrow';
        arrow.textContent = '▼';
        item.appendChild(arrow);
      }

      rulerCol.appendChild(item);
    }
    grid.appendChild(rulerCol);

    // 三个分支列: 机动 / 防护 / 火力
    const branches: Array<{ branch: ModBranch; label: string }> = [
      { branch: 'mobility', label: '机动' },
      { branch: 'protection', label: '防护' },
      { branch: 'firepower', label: '火力' },
    ];

    const enabledSet = new Set(this.currentEnabled);

    for (const b of branches) {
      const branchCol = document.createElement('div');
      branchCol.className = 'mod-branch-col';
      branchCol.dataset.branch = b.branch;

      const colHeader = document.createElement('div');
      colHeader.className = 'mod-col-header';
      colHeader.textContent = b.label;
      branchCol.appendChild(colHeader);

      // 按等级 I–IV 分行
      for (let t = 1; t <= 4; t++) {
        const tier = t as ModTier;
        const cell = document.createElement('div');
        cell.className = 'mod-tier-cell';
        cell.dataset.tier = String(tier);
        cell.dataset.branch = b.branch;

        const cellMods = this.mods.filter(
          (m) => m.branch === b.branch && m.tier === tier,
        );

        for (const mod of cellMods) {
          const isEnabled = enabledSet.has(mod.id);
          const hasPrereqs =
            !mod.requires ||
            mod.requires.length === 0 ||
            mod.requires.every((reqId) => enabledSet.has(reqId));
          const isLocked = !isEnabled && !hasPrereqs;

          const card = document.createElement('div');
          card.className = `mod-card ${isEnabled ? 'enabled' : ''} ${isLocked ? 'locked disabled' : ''}`;
          card.dataset.modId = mod.id;
          card.dataset.tier = String(mod.tier);
          card.dataset.branch = mod.branch;
          if (isLocked) {
            card.setAttribute('aria-disabled', 'true');
          }

          // 卡片顶部: 左上图标
          const topWrap = document.createElement('div');
          topWrap.className = 'mod-card-top';

          const iconWrap = document.createElement('div');
          iconWrap.className = 'mod-icon-wrap';
          iconWrap.innerHTML = getModIconSvg(mod);
          topWrap.appendChild(iconWrap);
          card.appendChild(topWrap);

          // 卡片名称
          const nameLabel = document.createElement('div');
          nameLabel.className = 'mod-card-name';
          nameLabel.textContent = mod.name;
          card.appendChild(nameLabel);

          // 卡片底部: effects 为空小字 + 右下勾选框
          const bottomWrap = document.createElement('div');
          bottomWrap.className = 'mod-card-bottom';

          if (!mod.effects || mod.effects.length === 0) {
            const noEff = document.createElement('div');
            noEff.className = 'mod-card-no-effects';
            noEff.textContent = '效果暂未接入';
            bottomWrap.appendChild(noEff);
          } else {
            const spacer = document.createElement('div');
            bottomWrap.appendChild(spacer);
          }

          const checkbox = document.createElement('div');
          checkbox.className = `mod-checkbox ${isEnabled ? 'checked' : ''}`;
          checkbox.textContent = isEnabled ? '✓' : '';
          bottomWrap.appendChild(checkbox);

          card.appendChild(bottomWrap);

          // 悬停显示 description 和 effects 的具体变化
          const tooltip = document.createElement('div');
          tooltip.className = 'mod-tooltip';

          const tipName = document.createElement('div');
          tipName.className = 'mod-tooltip-name';
          tipName.textContent = mod.name;
          tooltip.appendChild(tipName);

          const tipDesc = document.createElement('div');
          tipDesc.className = 'mod-tooltip-desc';
          tipDesc.textContent = mod.description;
          tooltip.appendChild(tipDesc);

          const tipEff = document.createElement('div');
          if (!mod.effects || mod.effects.length === 0) {
            tipEff.className = 'mod-tooltip-effects empty';
            tipEff.textContent = '效果暂未接入';
          } else {
            tipEff.className = 'mod-tooltip-effects';
            tipEff.innerHTML = mod.effects.map((e) => formatEffectText(e)).join('<br/>');
          }
          tooltip.appendChild(tipEff);

          if (mod.requires && mod.requires.length > 0) {
            const tipReq = document.createElement('div');
            tipReq.className = 'mod-tooltip-req';
            tipReq.textContent = `前置需求: ${mod.requires.join(', ')}`;
            tooltip.appendChild(tipReq);
          }

          card.appendChild(tooltip);

          // 点方块调用 toggleModification
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isLocked) {
              return; // 缺前置不可点
            }
            this.opts.onUiSound?.();
            const next = toggleModification(this.currentSpec!, this.currentEnabled, mod.id);
            this.currentEnabled = next;
            this.opts.setEnabled(this.currentSpec!.id, next);
            this.render();
          });

          cell.appendChild(card);
        }

        branchCol.appendChild(cell);
      }

      grid.appendChild(branchCol);
    }
    body.appendChild(grid);

    // 4. 效果汇总: 把启用后和原版相比有变化的数值列出来
    const summary = document.createElement('div');
    summary.className = 'mod-summary';

    const summaryHeader = document.createElement('div');
    summaryHeader.className = 'mod-summary-header';
    summaryHeader.textContent = '效果汇总';
    summary.appendChild(summaryHeader);

    const summaryList = document.createElement('div');
    summaryList.className = 'mod-summary-list';

    const appliedSpec = applyModifications(spec, this.currentEnabled);
    const diffs: string[] = [];

    // 对比 turretRotationSpeed: 方向机
    if (Math.abs(appliedSpec.turretRotationSpeed - spec.turretRotationSpeed) > 1e-4) {
      diffs.push(
        `方向机 ${formatNum(spec.turretRotationSpeed)}°/s → ${formatNum(appliedSpec.turretRotationSpeed)}°/s`,
      );
    }

    // 对比 turret.elevationSpeed: 高低机
    if (Math.abs(appliedSpec.turret.elevationSpeed - spec.turret.elevationSpeed) > 1e-4) {
      diffs.push(
        `高低机 ${formatNum(spec.turret.elevationSpeed)}°/s → ${formatNum(appliedSpec.turret.elevationSpeed)}°/s`,
      );
    }

    // 对比 hull.turnRate: 车体转向
    if (Math.abs(appliedSpec.hull.turnRate - spec.hull.turnRate) > 1e-4) {
      diffs.push(
        `车体转向 ${formatNum(spec.hull.turnRate)}°/s → ${formatNum(appliedSpec.hull.turnRate)}°/s`,
      );
    }

    // 对比 hull.acceleration: 起步加速度
    if (Math.abs(appliedSpec.hull.acceleration - spec.hull.acceleration) > 1e-4) {
      diffs.push(
        `起步加速度 ${formatNum(spec.hull.acceleration)} m/s² → ${formatNum(appliedSpec.hull.acceleration)} m/s²`,
      );
    }

    // 对比 maxSpeed: 最大速度
    if (Math.abs(appliedSpec.maxSpeed - spec.maxSpeed) > 1e-4) {
      diffs.push(
        `最大速度 ${formatNum(spec.maxSpeed)} → ${formatNum(appliedSpec.maxSpeed)} km/h`,
      );
    }

    if (diffs.length > 0) {
      for (const d of diffs) {
        const item = document.createElement('div');
        item.className = 'mod-summary-item';
        item.textContent = d;
        summaryList.appendChild(item);
      }
    } else {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'mod-summary-empty';
      emptyItem.textContent = '暂无属性变动';
      summaryList.appendChild(emptyItem);
    }

    summary.appendChild(summaryList);
    body.appendChild(summary);

    panel.appendChild(body);

    // 5. 底部: 进度条「已启用 n / m」, 右边按钮「全部启用」「全部关闭」
    const footer = document.createElement('div');
    footer.className = 'mod-footer';

    const progressWrap = document.createElement('div');
    progressWrap.className = 'mod-progress-wrap';

    const enabledCount = this.mods.filter((m) => enabledSet.has(m.id)).length;
    const totalCount = this.mods.length;
    const pct = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;

    const progressLabel = document.createElement('span');
    progressLabel.className = 'mod-progress-label';
    progressLabel.textContent = `已启用 ${enabledCount} / ${totalCount}`;
    progressWrap.appendChild(progressLabel);

    const progressTrack = document.createElement('div');
    progressTrack.className = 'mod-progress-track';

    const progressBar = document.createElement('div');
    progressBar.className = 'mod-progress-bar';
    progressBar.style.width = `${pct}%`;
    progressTrack.appendChild(progressBar);

    progressWrap.appendChild(progressTrack);
    footer.appendChild(progressWrap);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'mod-footer-buttons';

    const btnAll = document.createElement('button');
    btnAll.className = 'mod-btn mod-btn-enable-all';
    btnAll.textContent = '全部启用';
    btnAll.addEventListener('click', (e) => {
      e.stopPropagation();
      this.opts.onUiSound?.();
      const allIds = this.mods.map((m) => m.id);
      this.currentEnabled = allIds;
      this.opts.setEnabled(this.currentSpec!.id, allIds);
      this.render();
    });
    btnGroup.appendChild(btnAll);

    const btnNone = document.createElement('button');
    btnNone.className = 'mod-btn mod-btn-disable-all';
    btnNone.textContent = '全部关闭';
    btnNone.addEventListener('click', (e) => {
      e.stopPropagation();
      this.opts.onUiSound?.();
      this.currentEnabled = [];
      this.opts.setEnabled(this.currentSpec!.id, []);
      this.render();
    });
    btnGroup.appendChild(btnNone);

    footer.appendChild(btnGroup);
    panel.appendChild(footer);

    this.root.appendChild(panel);
  }
}
