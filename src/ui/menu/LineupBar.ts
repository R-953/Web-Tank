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
import { classIcon } from './classIcons';
import { h, injectLineupBarStyles } from './styles';
import { nationFlag } from './flags';
import { vehicleThumbnail } from './thumbnails';

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
  /** 鼠标移到有车的卡片上 / 移开 */
  onHoverVehicle?(vehicleId: string | null, rect: DOMRect | null): void;
  /** 右键菜单里点了「载具信息」 */
  onShowInfo?(vehicleId: string, rect: DOMRect): void;
  /** 点了「科技树」把手 */
  onOpenTechTree?(nation: string): void;
}

/** 载具侧视剪影(按车体 / 炮塔尺寸画的示意图, 与 MainMenu 保持一致) */
export function silhouette(v: VehicleSpec, width = 150): string {
  const W = width;
  const H = Math.round((W * 34) / 150);
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
  private gearMenuOpen = false;
  private activeContextMenu: HTMLElement | null = null;
  private readonly handleDocClick: (e: MouseEvent) => void;

  constructor(parent: HTMLElement, private readonly opts: LineupBarOptions) {
    injectLineupBarStyles();
    this.root = h('div', 'mm-panel mm-lineup-bar', parent);

    this.handleDocClick = () => {
      this.closeMenus();
    };
    document.addEventListener('click', this.handleDocClick);

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

  private closeMenus(): void {
    this.gearMenuOpen = false;
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
    const oldMenus = this.root.querySelectorAll('.mm-lineup-context-menu, .mm-lineup-gear-menu');
    oldMenus.forEach((el) => el.remove());
  }

  refresh(): void {
    this.closeMenus();
    this.root.innerHTML = '';

    const p = this.opts.getProfile();
    const activeNation = p.activeNation;
    const nationProfile = p.nations[activeNation];
    if (!nationProfile) return;

    const currentLineup =
      nationProfile.lineups.find((l) => l.id === nationProfile.activeLineup) ?? nationProfile.lineups[0];
    if (!currentLineup) return;

    const crews = nationProfile.crews;

    // --- 1. 科技树把手 (编组栏左上方)
    const topBar = h('div', 'mm-lineup-top-bar', this.root);
    const techTreeBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-techtree-btn', topBar, '︽ 科技树');
    techTreeBtn.title = '打开科技树';
    techTreeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.opts.onUiSound?.();
      this.opts.onOpenTechTree?.(activeNation);
    });

    // --- 2. 国旗页签行
    const flagsRow = h('div', 'mm-lineup-flags-row mm-lineup-nations', this.root);
    const nationKeys = Object.keys(p.nations).sort((a, b) => {
      const ia = PREFERRED_NATIONS.indexOf(a);
      const ib = PREFERRED_NATIONS.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const nation of nationKeys) {
      const isAct = nation === activeNation;
      const tabBtn = h(
        'button',
        `mm-lineup-flag-tab mm-lineup-nation-tab${isAct ? ' on' : ''}`,
        flagsRow,
      );
      tabBtn.dataset.nation = nation;
      tabBtn.title = NATION_NAMES[nation] ?? nation;
      const flagSvg = nationFlag(nation, 28);
      if (flagSvg) {
        tabBtn.innerHTML = flagSvg;
      } else {
        tabBtn.textContent = NATION_NAMES[nation] ?? nation;
      }

      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
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

    // 提示错误栏
    this.errorEl = h('div', 'mm-lineup-error', this.root);
    if (this.currentError) {
      this.errorEl.textContent = this.currentError;
      this.errorEl.style.display = 'block';
    } else {
      this.errorEl.style.display = 'none';
    }

    // --- 3. 车组卡片行 (横排: 每个车组一张卡 + 行末招募卡)
    const slotsWrap = h('div', 'mm-lineup-slots', this.root);

    for (let i = 0; i < crews.length; i++) {
      const crew = crews[i];
      const vehId = currentLineup.slots[i] ?? null;
      const isSelected = currentLineup.selected === i;
      const lvl = crewLevel(crew.progress);
      const slot = h(
        'div',
        `mm-lineup-slot${vehId ? '' : ' empty'}${isSelected ? ' sel' : ''}`,
        slotsWrap,
      );
      slot.dataset.crewIndex = String(i);

      if (vehId !== null) {
        const veh = this.opts.vehicles.find((v) => v.id === vehId);

        // 顶部: 车名一行占满卡片宽度, 右上角小 ▾ 按钮
        const topRow = h('div', 'mm-lineup-slot-top', slot);
        const nameEl = h('div', 'mm-lineup-slot-name', topRow, veh?.name ?? vehId);
        nameEl.title = veh?.name ?? vehId;

        // 右上角小 ▾ 按钮
        const menuBtn = h('button', 'mm-lineup-slot-menu-btn', topRow, '▾');
        menuBtn.title = '菜单';

        // 中间: 剪影在左(约 100px), 类型符号 + Lv 在右下
        const midRow = h('div', 'mm-lineup-slot-mid', slot);
        const silWrap = h('div', 'mm-lineup-slot-sil', midRow);
        if (veh) {
          const thumb = vehicleThumbnail(veh);
          if (thumb) {
            const img = h('img', 'mm-lineup-slot-thumb', silWrap);
            img.src = thumb;
            img.alt = veh.name;
          } else {
            silWrap.innerHTML = silhouette(veh, 100);
          }
        }

        const metaRow = h('div', 'mm-lineup-slot-meta', midRow);
        const iconHtml = veh?.vehicleClass ? classIcon(veh.vehicleClass) : '';
        metaRow.innerHTML = `${iconHtml}<span class="mm-lineup-slot-level">Lv ${lvl}</span>`;

        // 卡片下方一条窄底栏: 左边「👤 N」, 右边留空
        const footer = h('div', 'mm-lineup-slot-footer', slot);
        h('div', 'mm-lineup-slot-crew-num', footer, `👤 ${i + 1}`);
        h('div', 'mm-lineup-slot-crew-skill', footer);

        // 交互: 左键选这个车组出战
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

        // 鼠标移到有车的卡片上 / 移开
        slot.addEventListener('mouseenter', () => {
          this.opts.onHoverVehicle?.(vehId, slot.getBoundingClientRect());
        });
        slot.addEventListener('mouseleave', () => {
          this.opts.onHoverVehicle?.(null, null);
        });

        // 右键点卡片: 弹出菜单
        slot.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu(slot, vehId, i, e.clientX, e.clientY);
        });

        // 点击 ▾ 按钮: 弹出菜单
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = menuBtn.getBoundingClientRect();
          this.showContextMenu(slot, vehId, i, rect.left, rect.bottom);
        });
      } else {
        // 空车组是空白卡片, 中间一个淡色「+」
        const topRow = h('div', 'mm-lineup-slot-top', slot);
        h('div', 'mm-lineup-slot-name mm-dim', topRow, '未分车');

        const midRow = h('div', 'mm-lineup-slot-mid empty', slot);
        h('div', 'mm-lineup-slot-add-btn mm-lineup-slot-plus', midRow, '+');

        // 底栏: 左边「👤 N」, 右边留空
        const footer = h('div', 'mm-lineup-slot-footer', slot);
        h('div', 'mm-lineup-slot-crew-num', footer, `👤 ${i + 1}`);
        h('div', 'mm-lineup-slot-crew-skill', footer);

        // 空卡片左键 = 更换载具
        slot.addEventListener('click', () => {
          this.opts.onUiSound?.();
          this.opts.onPickVehicle(activeNation, i);
        });
      }
    }

    // 行末一张「招募车组」卡片: 车组人像位置放简单人形图标, 文字「招募车组 n/8」, 到上限置灰
    const recruitCard = h(
      'button',
      'mm-lineup-recruit-card mm-lineup-btn-recruit',
      slotsWrap,
    ) as HTMLButtonElement;
    const recruitIcon = h('div', 'mm-lineup-recruit-icon', recruitCard);
    recruitIcon.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>`;
    h('div', 'mm-lineup-recruit-text', recruitCard, `招募车组 ${crews.length}/${CREW_SLOT_LIMIT}`);
    if (crews.length >= CREW_SLOT_LIMIT) {
      recruitCard.disabled = true;
    }
    recruitCard.addEventListener('click', (e) => {
      e.stopPropagation();
      if (crews.length >= CREW_SLOT_LIMIT) return;
      this.opts.onUiSound?.();
      try {
        const nextP = recruitCrew(p, activeNation);
        this.opts.setProfile(nextP);
        this.refresh();
      } catch (err: unknown) {
        this.showError((err as Error).message);
      }
    });

    // --- 4. 编组页签行 (最左 ⚙ 按钮, 后面各个编组名字)
    const presetsRow = h('div', 'mm-lineup-presets-row', this.root);
    const gearWrap = h('div', 'mm-lineup-gear-wrap', presetsRow);
    const gearBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-gear-btn', gearWrap, '⚙');
    gearBtn.title = '编组操作';
    gearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleGearMenu(gearWrap, p, activeNation, currentLineup.id);
    });

    const presetsList = h('div', 'mm-lineup-presets-list', presetsRow);
    for (const l of nationProfile.lineups) {
      if (this.renamingLineupId === l.id) {
        // 行内改名输入框
        const renameWrap = h('div', 'mm-lineup-rename-wrap', presetsList);
        const input = h('input', 'mm-lineup-rename-input', renameWrap) as HTMLInputElement;
        input.type = 'text';
        input.value = l.name;

        const confirmBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-rename-confirm', renameWrap, '确定');
        const cancelBtn = h('button', 'mm-btn mm-btn-sm mm-lineup-rename-cancel', renameWrap, '取消');

        const doRename = () => {
          const newName = input.value.trim();
          try {
            const nextP = renameLineup(p, activeNation, l.id, newName);
            this.opts.setProfile(nextP);
            this.renamingLineupId = null;
            this.refresh();
          } catch (err: unknown) {
            this.showError((err as Error).message);
          }
        };

        confirmBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.opts.onUiSound?.();
          doRename();
        });

        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
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
        const isAct = l.id === currentLineup.id;
        const tabBtn = h(
          'button',
          `mm-btn mm-btn-sm mm-lineup-preset-tab${isAct ? ' on' : ''}`,
          presetsList,
          l.name,
        );
        tabBtn.dataset.lineupId = l.id;
        tabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (l.id !== currentLineup.id) {
            this.opts.onUiSound?.();
            try {
              const nextP = setActiveLineup(p, activeNation, l.id);
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
    }
  }

  private showContextMenu(
    slot: HTMLElement,
    vehicleId: string,
    crewIndex: number,
    clientX?: number,
    clientY?: number,
  ): void {
    this.closeMenus();

    const menu = h('div', 'mm-panel mm-lineup-context-menu', this.root);
    this.activeContextMenu = menu;

    const rootRect = this.root.getBoundingClientRect();
    let left = clientX !== undefined && rootRect.left ? clientX - rootRect.left : slot.offsetLeft;
    let top = clientY !== undefined && rootRect.top ? clientY - rootRect.top : slot.offsetTop;

    if (rootRect.width > 0 && left + 120 > rootRect.width) {
      left = Math.max(0, rootRect.width - 125);
    }
    if (rootRect.height > 0 && top + 90 > rootRect.height) {
      top = Math.max(0, top - 90);
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    // 1. 更换载具
    const changeBtn = h('button', 'mm-lineup-menu-item mm-lineup-menu-change', menu, '更换载具');
    changeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenus();
      this.opts.onUiSound?.();
      const p = this.opts.getProfile();
      this.opts.onPickVehicle(p.activeNation, crewIndex);
    });

    // 2. 清空
    const clearBtn = h('button', 'mm-lineup-menu-item mm-lineup-menu-clear', menu, '清空');
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenus();
      this.opts.onUiSound?.();
      const p = this.opts.getProfile();
      const nation = p.activeNation;
      const currentLineupId = p.nations[nation]?.activeLineup;
      if (!currentLineupId) return;
      try {
        const prevActive = activeVehicleId(p);
        const nextP = assignVehicle(
          p,
          nation,
          currentLineupId,
          crewIndex,
          null,
          toProfileVehicles(this.opts.vehicles),
        );
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

    // 3. 载具信息
    const infoBtn = h('button', 'mm-lineup-menu-item mm-lineup-menu-info', menu, '载具信息');
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenus();
      this.opts.onUiSound?.();
      this.opts.onShowInfo?.(vehicleId, slot.getBoundingClientRect());
    });
  }

  private toggleGearMenu(
    gearWrap: HTMLElement,
    p: Profile,
    nation: string,
    lineupId: string,
  ): void {
    if (this.gearMenuOpen) {
      this.closeMenus();
      return;
    }
    this.closeMenus();
    this.gearMenuOpen = true;

    const menu = h('div', 'mm-panel mm-lineup-gear-menu', gearWrap);
    this.activeContextMenu = menu;

    // 1. 新建编组
    const addBtn = h(
      'button',
      'mm-lineup-gear-item mm-lineup-gear-item-add mm-lineup-btn-add',
      menu,
      '新建编组',
    );
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenus();
      this.opts.onUiSound?.();
      try {
        let nextP = addLineup(p, nation);
        const list = nextP.nations[nation].lineups;
        const created = list[list.length - 1];
        nextP = setActiveLineup(nextP, nation, created.id);
        this.opts.setProfile(nextP);
        const newActive = activeVehicleId(nextP);
        this.opts.onActiveVehicle(newActive);
        this.refresh();
      } catch (err: unknown) {
        this.showError((err as Error).message);
      }
    });

    // 2. 改名
    const renameBtn = h(
      'button',
      'mm-lineup-gear-item mm-lineup-gear-item-rename mm-lineup-btn-rename',
      menu,
      '改名',
    );
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenus();
      this.opts.onUiSound?.();
      this.renamingLineupId = lineupId;
      this.refresh();
    });

    // 3. 删除
    const deleteBtn = h(
      'button',
      'mm-lineup-gear-item mm-lineup-gear-item-delete mm-lineup-btn-delete',
      menu,
      '删除',
    );
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenus();
      this.opts.onUiSound?.();
      try {
        const nextP = removeLineup(p, nation, lineupId);
        this.opts.setProfile(nextP);
        const newActive = activeVehicleId(nextP);
        this.opts.onActiveVehicle(newActive);
        this.refresh();
      } catch (err: unknown) {
        this.showError((err as Error).message);
      }
    });
  }

  dispose(): void {
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
      this.errorTimeout = null;
    }
    document.removeEventListener('click', this.handleDocClick);
    this.closeMenus();
    this.root.remove();
  }
}
