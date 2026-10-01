import type { Loadout, VehicleSpec } from '../../data/types';
import { SHELL_SHORT, SHELL_TYPES } from '../../data/shells';
import { ammoCapacity, clampLoadout, loadoutTotal } from '../../game/Loadout';
import { h } from './styles';

export interface AmmoPanelOptions {
  /** 携弹改了:调用方负责保存 */
  onChange(spec: VehicleSpec, loadout: Loadout): void;
  onUiSound?(): void;
}

export class AmmoPanel {
  readonly root: HTMLElement;
  private vehicle?: VehicleSpec;
  private loadout: Loadout = {};

  constructor(parent: HTMLElement, private readonly opts: AmmoPanelOptions) {
    this.root = h('div', 'mm-panel mm-ammo', parent);
  }

  /** 换载具或外面改了携弹时调用 */
  setVehicle(spec: VehicleSpec, loadout: Loadout): void {
    this.vehicle = spec;
    this.loadout = clampLoadout(spec, loadout);
    this.render();
  }

  private render(): void {
    this.root.innerHTML = '';
    if (!this.vehicle) return;
    const v = this.vehicle;
    const cap = ammoCapacity(v);
    const ammo = v.weapons[0]?.ammo ?? [];
    const total = loadoutTotal(this.loadout);

    h('h2', '', this.root, '携弹');
    h('div', 'mm-note', this.root, `弹药架共 ${cap} 发;少带弹时最先取空的弹药架会空着,被击穿时更不容易殉爆。`);
    const table = h('table', '', this.root);
    for (const a of ammo) {
      const tr = h('tr', '', table);
      const name = h('td', '', tr, a.name);
      h('div', 'type', name, `${SHELL_SHORT[a.type]} · ${SHELL_TYPES[a.type].name} · 穿深 ${Math.round(a.penetration)} mm`);
      const minus = h('button', 'mm-btn small', h('td', '', tr), '−');
      h('td', 'n', tr, String(this.loadout[a.id] ?? 0));
      const plus = h('button', 'mm-btn small', h('td', '', tr), '+');
      const change = (delta: number) => {
        this.opts.onUiSound?.();
        const cur = this.loadout[a.id] ?? 0;
        let next = Math.max(0, cur + delta);
        // 超出容量时只加到满为止
        if (delta > 0) next = Math.min(next, cur + (cap - loadoutTotal(this.loadout)));
        this.loadout = clampLoadout(v, { ...this.loadout, [a.id]: next });
        this.opts.onChange(v, this.loadout);
        this.render();
      };
      minus.addEventListener('click', () => change(-5));
      plus.addEventListener('click', () => change(5));
      minus.disabled = (this.loadout[a.id] ?? 0) === 0;
      plus.disabled = total >= cap;
    }
    const sum = h('div', 'total', this.root, `合计 ${total} / ${cap} 发`);
    const bar = h('div', 'bar', sum);
    h('div', '', bar).style.width = `${Math.round((total / Math.max(1, cap)) * 100)}%`;
    const mg = v.weapons.find((w) => w.kind === 'mg');
    if (mg) h('div', 'mm-note', this.root, `同轴机枪 ${mg.name}:${mg.rounds ?? 0} 发(每条弹链 ${mg.beltSize ?? '?'} 发),不占弹药架`);
  }
}
