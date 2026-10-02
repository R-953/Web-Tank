import type { Loadout, VehicleSpec } from '../../data/types';
import { SHELL_SHORT, SHELL_TYPES } from '../../data/shells';
import { ammoCapacity, clampLoadout, loadoutTotal } from '../../game/Loadout';
import { h } from './styles';

export interface AmmoPanelOptions {
  /** 携弹改了:调用方负责保存 */
  onChange(spec: VehicleSpec, loadout: Loadout): void;
  onUiSound?(): void;
}

/** 某个弹种在当前携弹和容量限制下能设的最大数量 */
export function maxForShell(loadout: Loadout, shellId: string, capacity: number): number {
  const cap = Math.max(0, Math.floor(capacity));
  let otherTotal = 0;
  for (const [id, count] of Object.entries(loadout)) {
    if (id !== shellId && typeof count === 'number' && !Number.isNaN(count) && count > 0) {
      otherTotal += Math.floor(count);
    }
  }
  return Math.max(0, cap - otherTotal);
}

/** 夹到 [0, maxForShell] 并取整,其他弹种不变 */
export function setShellCount(
  spec: VehicleSpec,
  loadout: Loadout,
  shellId: string,
  count: number,
): Loadout {
  const cap = ammoCapacity(spec);
  const max = maxForShell(loadout, shellId, cap);
  const intCount = Number.isFinite(count) ? Math.round(count) : 0;
  const clamped = Math.max(0, Math.min(max, intCount));
  return { ...loadout, [shellId]: clamped };
}

interface ShellItem {
  shellId: string;
  card: HTMLElement;
  numInput: HTMLInputElement;
  slider: HTMLInputElement;
  minusBtn: HTMLButtonElement;
  plusBtn: HTMLButtonElement;
}

export class AmmoPanel {
  readonly root: HTMLElement;
  private vehicle?: VehicleSpec;
  private loadout: Loadout = {};
  private items: ShellItem[] = [];
  private totalLabelNode?: Text;
  private totalBarFillEl?: HTMLElement;
  private rafId: number | null = null;
  private pendingChange = false;

  constructor(parent: HTMLElement, private readonly opts: AmmoPanelOptions) {
    this.root = h('div', 'mm-panel mm-ammo', parent);
  }

  /** 换载具或外面改了携弹时调用 */
  setVehicle(spec: VehicleSpec, loadout: Loadout): void {
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId);
      }
      this.rafId = null;
    }
    this.pendingChange = false;
    this.vehicle = spec;
    this.loadout = clampLoadout(spec, loadout);
    this.render();
  }

  private render(): void {
    this.root.innerHTML = '';
    this.items = [];
    this.totalLabelNode = undefined;
    this.totalBarFillEl = undefined;

    if (!this.vehicle) return;
    const v = this.vehicle;
    const cap = ammoCapacity(v);
    const ammo = v.weapons[0]?.ammo ?? [];

    h('h2', '', this.root, '携弹');
    h('div', 'mm-note', this.root, `弹药架共 ${cap} 发;少带弹时最先取空的弹药架会空着,被击穿时更不容易殉爆。`);

    const list = h('div', 'mm-ammo-list', this.root);

    for (const a of ammo) {
      const card = h('div', 'mm-ammo-card', list);

      // 上部: 弹种名、穿深说明、数量数字框
      const header = h('div', 'mm-ammo-card-header', card);
      const titleCol = h('div', 'mm-ammo-card-title', header);
      h('span', 'mm-ammo-name', titleCol, a.name);
      h('div', 'type', titleCol, `${SHELL_SHORT[a.type]} · ${SHELL_TYPES[a.type].name} · 穿深 ${Math.round(a.penetration)} mm`);

      const numInput = h('input', 'mm-ammo-num', header) as HTMLInputElement;
      numInput.type = 'number';
      numInput.min = '0';
      numInput.step = '1';

      // 下部: 减号、滑块、加号
      const sliderRow = h('div', 'mm-ammo-slider-row', card);
      const minus = h('button', 'mm-btn small', sliderRow, '−') as HTMLButtonElement;
      minus.type = 'button';

      const slider = h('input', 'mm-ammo-range', sliderRow) as HTMLInputElement;
      slider.type = 'range';
      slider.min = '0';
      slider.step = '1';

      const plus = h('button', 'mm-btn small', sliderRow, '+') as HTMLButtonElement;
      plus.type = 'button';

      // 事件绑定
      const changeByDelta = (delta: number) => {
        const cur = this.loadout[a.id] ?? 0;
        const next = cur + delta;
        const nextLoadout = setShellCount(v, this.loadout, a.id, next);
        if ((nextLoadout[a.id] ?? 0) !== cur) {
          this.opts.onUiSound?.();
          this.applyShellCount(a.id, next, true);
        }
      };

      minus.addEventListener('click', (e) => {
        const step = e.shiftKey ? 5 : 1;
        changeByDelta(-step);
      });

      plus.addEventListener('click', (e) => {
        const step = e.shiftKey ? 5 : 1;
        changeByDelta(step);
      });

      slider.addEventListener('input', () => {
        const val = Number(slider.value);
        this.applyShellCount(a.id, val, false);
      });

      slider.addEventListener('change', () => {
        this.commitPendingChange();
        this.opts.onUiSound?.();
      });

      const commitInput = () => {
        const raw = numInput.value.trim();
        const parsed = raw === '' ? 0 : Number(raw);
        const valid = Number.isFinite(parsed) ? parsed : (this.loadout[a.id] ?? 0);
        const cur = this.loadout[a.id] ?? 0;
        const nextLoadout = setShellCount(v, this.loadout, a.id, valid);
        const next = nextLoadout[a.id] ?? 0;
        this.loadout = nextLoadout;
        this.syncControls();
        if (cur !== next) {
          this.opts.onUiSound?.();
          this.commitPendingChange();
        }
      };

      numInput.addEventListener('change', commitInput);
      numInput.addEventListener('blur', commitInput);
      numInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          commitInput();
        }
      });

      this.items.push({
        shellId: a.id,
        card,
        numInput,
        slider,
        minusBtn: minus,
        plusBtn: plus,
      });
    }

    // 底部合计与进度条
    const sum = h('div', 'total', this.root);
    this.totalLabelNode = document.createTextNode('');
    sum.appendChild(this.totalLabelNode);
    const bar = h('div', 'bar', sum);
    this.totalBarFillEl = h('div', '', bar);

    const mg = v.weapons.find((w) => w.kind === 'mg');
    if (mg) {
      h('div', 'mm-note', this.root, `同轴机枪 ${mg.name}:${mg.rounds ?? 0} 发(每条弹链 ${mg.beltSize ?? '?'} 发),不占弹药架`);
    }

    this.syncControls();
  }

  private applyShellCount(shellId: string, count: number, immediate: boolean): void {
    if (!this.vehicle) return;
    const v = this.vehicle;
    this.loadout = setShellCount(v, this.loadout, shellId, count);
    this.syncControls();
    if (immediate) {
      this.commitPendingChange();
    } else {
      this.scheduleThrottledChange();
    }
  }

  private commitPendingChange(): void {
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId);
      }
      this.rafId = null;
    }
    this.pendingChange = false;
    if (this.vehicle) {
      this.opts.onChange(this.vehicle, this.loadout);
    }
  }

  private scheduleThrottledChange(): void {
    if (!this.vehicle) return;
    const v = this.vehicle;

    if (this.rafId === null) {
      this.opts.onChange(v, this.loadout);

      const requestRaf = typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number;

      this.rafId = requestRaf(() => {
        this.rafId = null;
        if (this.pendingChange) {
          this.pendingChange = false;
          if (this.vehicle) {
            this.opts.onChange(this.vehicle, this.loadout);
          }
        }
      });
    } else {
      this.pendingChange = true;
    }
  }

  private syncControls(): void {
    if (!this.vehicle) return;
    const v = this.vehicle;
    const cap = ammoCapacity(v);
    const total = loadoutTotal(this.loadout);

    for (const item of this.items) {
      const cur = this.loadout[item.shellId] ?? 0;
      const max = maxForShell(this.loadout, item.shellId, cap);

      item.slider.max = String(max);
      item.slider.value = String(cur);
      item.numInput.max = String(max);
      item.numInput.value = String(cur);

      const pct = max > 0 ? Math.round((cur / max) * 100) : 0;
      item.slider.style.background = `linear-gradient(to right, #e0b44c ${pct}%, rgba(255,255,255,.15) ${pct}%)`;

      item.minusBtn.disabled = cur <= 0;
      item.plusBtn.disabled = total >= cap || cur >= max;
    }

    if (this.totalLabelNode) {
      this.totalLabelNode.textContent = `合计 ${total} / ${cap} 发`;
    }
    if (this.totalBarFillEl) {
      this.totalBarFillEl.style.width = `${Math.round((total / Math.max(1, cap)) * 100)}%`;
    }
  }
}
