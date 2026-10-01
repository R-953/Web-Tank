import type { VehicleSpec } from '../../data/types';
import type { Profile, ProfileVehicle } from '../../settings/Profile';
import {
  addLineup,
  assignVehicle,
  CREW_SLOT_LIMIT,
  recruitCrew,
  removeLineup,
  renameLineup,
  selectCrew,
  setActiveLineup,
  setActiveNation,
  activeVehicleId,
} from '../../settings/Profile';
import { crewLevel } from '../../game/crew/progress';
import { NATION_NAMES } from './techTreeLayout';
import { h, injectLineupBarStyles } from './styles';

export interface LineupBarOptions {
  vehicles: readonly VehicleSpec[];
  getProfile(): Profile;
  /** 存档改了:调用方负责保存(ProfileStore.set) */
  setProfile(p: Profile): void;
  /** 出战载具变了(选了别的车组、换了编组或国家、分车改了当前格子) */
  onActiveVehicle(vehicleId: string): void;
  /** 玩家要给某个车组分车:调用方打开科技树,选好后调 assign */
  onPickVehicle(nation: string, crewIndex: number): void;
  onUiSound?(): void;
}

/** 载具侧视剪影(按车体 / 炮塔尺寸画的示意图, 与 MainMenu 保持一致) */
export function silhouette(v: VehicleSpec): string {
  const W = 150;
  const H = 34;
  const len = v.hull.length + Math.max(0, v.turret.barrelLength - v.hull.length / 2 + v.turret.length / 2);
  const k = Math.min((W - 6) / len, (H - 4) / (v.hull.height + v.turret.height));
  const x0 = 3 + Math.max(0, v.turret.barrelLength - v.hull.length / 2 + v.turret.length / 2) * k;
  const hullW = v.hull.length * k;
  const hullH = v.hull.height * k;
  const y0 = H - 2 - hullH;
  const tW = v.turret.length * k;
  const tH = v.turret.height * k;
  const tx = x0 + hullW / 2 - tW / 2;
  const ty = y0 - tH;
  const gunY = ty + tH * 0.45;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect x="${x0}" y="${y0}" width="${hullW}" height="${hullH}" rx="${hullH * 0.35}" fill="#9aa39a"/>
    <rect x="${tx}" y="${ty}" width="${tW}" height="${tH}" rx="2" fill="#b3bbb2"/>
    <rect x="${tx - v.turret.barrelLength * k}" y="${gunY - 1}" width="${v.turret.barrelLength * k}" height="2.2" fill="#b3bbb2"/>
  </svg>`;
}

function toProfileVehicles(vehicles: readonly VehicleSpec[]): ProfileVehicle[] {
  return vehicles.map((v) => ({
    id: v.id,
    nation: v.nation ?? '',
    family: v.family ?? v.id,
  }));
}

const PREFERRED_NATIONS = ['germany', 'ussr', 'usa'];

export class LineupBar {
  private readonly root: HTMLElement;
  private errorEl: HTMLElement | null = null;
  private currentError: string | null = null;
  private errorTimeout: ReturnType<typeof setTimeout> | null = null;
  private renamingLineupId: string | null = null;

  constructor(parent: HTMLElement, private readonly opts: LineupBarOptions) {
    injectLineupBarStyles();
    this.root = h('div', 'mm-panel mm-lineup-bar', parent);
    this.refresh();
  }

  showError(msg: string): void {
    this.currentError = msg;
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
    }
    this.errorTimeout = setTimeout(() => {
      this.currentError = null;
      this.errorTimeout = null;
      if (this.errorEl) {
        this.errorEl.textContent = '';
        this.errorEl.style.display = 'none';
      }
    }, 3000);

    if (this.errorEl) {
      this.errorEl.textContent = msg;
      this.errorEl.style.display = 'block';
    }
  }

  refresh(): void {
    this.root.innerHTML = '';

    const p = this.opts.getProfile();
    const activeNation = p.activeNation;
    const nationProfile = p.nations[activeNation];
    if (!nationProfile) return;

    const currentLineup =
      nationProfile.lineups.find((l) => l.id === nationProfile.activeLineup) ?? nationProfile.lineups[0];
    if (!currentLineup) return;

    const crews = nationProfile.crews;

    // --- 第一行: 国家页签 · 编组下拉 · 新建/改名/删除 · 招募车组
    const row1 = h('div', 'mm-lineup-row1', this.root);

    // 1. 国家页签
    const nationsWrap = h('div', 'mm-lineup-nations', row1);
    const nationKeys = Object.keys(p.nations).sort((a, b) => {
      const ia = PREFERRED_NATIONS.indexOf(a);
      const ib = PREFERRED_NATIONS.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const nation of nationKeys) {
      const tabBtn = h(
        'button',
        `mm-btn mm-btn-sm mm-lineup-nation-tab${nation === activeNation ? ' on' : ''}`,
        nationsWrap,
        NATION_NAMES[nation] ?? nation,
      );
      tabBtn.dataset.nation = nation;
      tabBtn.addEventListener('click', () => {
        if (nation !== activeNation) {
          this.opts.onUiSound?.();
          try {
            const nextP = setActiveNation(p, nation);
            this.opts.setProfile(nextP);
            const newActive = activeVehicleId(nextP);
            this.opts.onActiveVehicle(newActive);
          } catch (err: unknown) {
            this.showError((err as Error).message);
          }
          this.refresh();
        }
      });
    }

    // 2. 编组控制区域
    const controlsWrap = h('div', 'mm-lineup-controls', row1);

    if (this.renamingLineupId === currentLineup.id) {
      // 行内改名输入框
      const renameWrap = h('div', 'mm-lineup-rename-wrap', controlsWrap);
      const input = h('input', 'mm-lineup-rename-input', renameWrap) as HTMLInputElement;
      input.type = 'text';
      input.value = currentLineup.name;

      const confirmBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-rename-confirm', renameWrap, '确定');
      const cancelBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-rename-cancel', renameWrap, '取消');

      const doRename = () => {
        const newName = input.value.trim();
        try {
          const nextP = renameLineup(p, activeNation, currentLineup.id, newName);
          this.opts.setProfile(nextP);
          this.renamingLineupId = null;
          this.refresh();
        } catch (err: unknown) {
          this.showError((err as Error).message);
        }
      };

      confirmBtn.addEventListener('click', () => {
        this.opts.onUiSound?.();
        doRename();
      });

      cancelBtn.addEventListener('click', () => {
        this.opts.onUiSound?.();
        this.renamingLineupId = null;
        this.refresh();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.opts.onUiSound?.();
          doRename();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.opts.onUiSound?.();
          this.renamingLineupId = null;
          this.refresh();
        }
      });

      setTimeout(() => input.focus(), 0);
    } else {
      // 编组下拉选择
      const select = h('select', 'mm-lineup-select', controlsWrap) as HTMLSelectElement;
      for (const l of nationProfile.lineups) {
        const opt = h('option', '', select, l.name);
        opt.value = l.id;
      }
      select.value = currentLineup.id;
      select.addEventListener('change', () => {
        this.opts.onUiSound?.();
        try {
          const nextP = setActiveLineup(p, activeNation, select.value);
          this.opts.setProfile(nextP);
          const newActive = activeVehicleId(nextP);
          this.opts.onActiveVehicle(newActive);
        } catch (err: unknown) {
          this.showError((err as Error).message);
        }
        this.refresh();
      });

      // 「新建」
      const addBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-btn-add', controlsWrap, '新建');
      addBtn.addEventListener('click', () => {
        this.opts.onUiSound?.();
        try {
          let nextP = addLineup(p, activeNation);
          const list = nextP.nations[activeNation].lineups;
          const created = list[list.length - 1];
          nextP = setActiveLineup(nextP, activeNation, created.id);
          this.opts.setProfile(nextP);
          const newActive = activeVehicleId(nextP);
          this.opts.onActiveVehicle(newActive);
          this.refresh();
        } catch (err: unknown) {
          this.showError((err as Error).message);
        }
      });

      // 「改名」
      const renameBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-btn-rename', controlsWrap, '改名');
      renameBtn.addEventListener('click', () => {
        this.opts.onUiSound?.();
        this.renamingLineupId = currentLineup.id;
        this.refresh();
      });

      // 「删除」
      const deleteBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-btn-delete', controlsWrap, '删除');
      deleteBtn.addEventListener('click', () => {
        this.opts.onUiSound?.();
        try {
          const nextP = removeLineup(p, activeNation, currentLineup.id);
          this.opts.setProfile(nextP);
          const newActive = activeVehicleId(nextP);
          this.opts.onActiveVehicle(newActive);
          this.refresh();
        } catch (err: unknown) {
          this.showError((err as Error).message);
        }
      });
    }

    // 「招募车组 n/8」(到上限置灰)
    const recruitBtn = h(
      'button',
      'mm-btn mm-btn-sm mm-lineup-btn-recruit',
      controlsWrap,
      `招募车组 ${crews.length}/${CREW_SLOT_LIMIT}`,
    ) as HTMLButtonElement;
    if (crews.length >= CREW_SLOT_LIMIT) {
      recruitBtn.disabled = true;
    }
    recruitBtn.addEventListener('click', () => {
      this.opts.onUiSound?.();
      try {
        const nextP = recruitCrew(p, activeNation);
        this.opts.setProfile(nextP);
        this.refresh();
      } catch (err: unknown) {
        this.showError((err as Error).message);
      }
    });

    // 提示错误栏
    this.errorEl = h('div', 'mm-lineup-error', this.root);
    if (this.currentError) {
      this.errorEl.textContent = this.currentError;
      this.errorEl.style.display = 'block';
    } else {
      this.errorEl.style.display = 'none';
    }

    // --- 第二行: 当前编组的车组格子, 数量 = 该国车组数
    const slotsWrap = h('div', 'mm-lineup-slots', this.root);

    for (let i = 0; i < crews.length; i++) {
      const crew = crews[i];
      const vehId = currentLineup.slots[i] ?? null;
      const isSelected = currentLineup.selected === i;
      const slot = h('div', `mm-lineup-slot${vehId ? '' : ' empty'}${isSelected ? ' sel' : ''}`, slotsWrap);
      slot.dataset.crewIndex = String(i);

      const lvl = crewLevel(crew.progress);

      if (vehId !== null) {
        const veh = this.opts.vehicles.find((v) => v.id === vehId);
        const topRow = h('div', 'mm-lineup-slot-top', slot);
        h('div', 'mm-lineup-slot-name', topRow, veh?.name ?? vehId);
        h('div', 'mm-lineup-slot-level', topRow, `Lv ${lvl}`);

        if (veh) {
          slot.insertAdjacentHTML('beforeend', silhouette(veh));
        }

        const actions = h('div', 'mm-lineup-slot-actions', slot);

        // 「换车」
        const changeBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-btn-change', actions, '换车');
        changeBtn.title = '换车';
        changeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.opts.onUiSound?.();
          this.opts.onPickVehicle(activeNation, i);
        });

        // 「×」(清空)
        const clearBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-btn-clear', actions, '×');
        clearBtn.title = '清空';
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.opts.onUiSound?.();
          try {
            const prevActive = activeVehicleId(p);
            const nextP = assignVehicle(p, activeNation, currentLineup.id, i, null, toProfileVehicles(this.opts.vehicles));
            this.opts.setProfile(nextP);
            const newActive = activeVehicleId(nextP);
            if (newActive !== prevActive) {
              this.opts.onActiveVehicle(newActive);
            }
            this.refresh();
          } catch (err: unknown) {
            this.showError((err as Error).message);
          }
        });

        // 点格子 = 选这个车组出战
        slot.addEventListener('click', () => {
          this.opts.onUiSound?.();
          if (currentLineup.selected !== i) {
            try {
              const nextP = selectCrew(p, activeNation, currentLineup.id, i);
              this.opts.setProfile(nextP);
              this.opts.onActiveVehicle(activeVehicleId(nextP));
              this.refresh();
            } catch (err: unknown) {
              this.showError((err as Error).message);
            }
          } else {
            this.opts.onActiveVehicle(vehId);
          }
        });
      } else {
        // 空格子: 留白, 中间一个「+」, 点了 = 给这个车组分车
        const topRow = h('div', 'mm-lineup-slot-top', slot);
        h('div', 'mm-lineup-slot-name mm-dim', topRow, '未分车');
        h('div', 'mm-lineup-slot-level', topRow, `Lv ${lvl}`);

        const addBtn = h('button', 'mm-lineup-slot-add-btn', slot, '+');
        addBtn.title = '分车';
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.opts.onUiSound?.();
          this.opts.onPickVehicle(activeNation, i);
        });

        h('div', 'mm-lineup-slot-empty-hint', slot, '点击分车');

        slot.addEventListener('click', () => {
          this.opts.onUiSound?.();
          this.opts.onPickVehicle(activeNation, i);
        });
      }
    }
  }

  dispose(): void {
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
      this.errorTimeout = null;
    }
    this.root.remove();
  }
}
