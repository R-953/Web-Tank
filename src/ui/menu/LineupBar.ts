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
  /** 打开改装界面 (053/055) */
  onOpenModifications?(vehicleId: string, crewIndex: number): void;
  /** 打开涂装界面 (053/056) */
  onOpenCustomization?(vehicleId: string, crewIndex: number): void;
  /** 开始试驾 (053) */
  onTestDrive?(vehicleId: string, crewIndex: number): void;
  /** 打开乘员界面 (053/057) */
  onOpenCrew?(nation: string, crewIndex: number): void;
}

export interface ContextMenuRootRect {
  width: number;
  height: number;
  left?: number;
  top?: number;
}

/**
 * 计算右键菜单在根元素内的位置:
 * 默认显示在鼠标右下方; 若右边或下边越界, 则翻到鼠标另一侧, 且最终位置限制在根元素内部.
 */
export function contextMenuPosition(
  clickX: number,
  clickY: number,
  menuW: number,
  menuH: number,
  rootRect: ContextMenuRootRect,
): { left: number; top: number } {
  let left = clickX;
  let top = clickY;

  // 右边越界时翻到鼠标另一侧
  if (rootRect.width > 0 && clickX + menuW > rootRect.width) {
    left = clickX - menuW;
  }
  // 下边越界时翻到鼠标另一侧
  if (rootRect.height > 0 && clickY + menuH > rootRect.height) {
    top = clickY - menuH;
  }

  // 不超出根元素边界
  if (rootRect.width > 0) {
    if (left + menuW > rootRect.width) {
      left = Math.max(0, rootRect.width - menuW);
    }
    if (left < 0) {
      left = 0;
    }
  } else {
    left = Math.max(0, left);
  }

  if (rootRect.height > 0) {
    if (top + menuH > rootRect.height) {
      top = Math.max(0, rootRect.height - menuH);
    }
    if (top < 0) {
      top = 0;
    }
  } else {
    top = Math.max(0, top);
  }

  return { left, top };
}

const ICON_ARROWS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mm-lineup-menu-icon"><path d="M7 3v14M3 7l4-4 4 4M17 21V7m4 10-4 4-4-4"/></svg>`;
const ICON_WRENCH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mm-lineup-menu-icon"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
const ICON_BRUSH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="mm-lineup-menu-icon"><path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.71-2-2a1 1 0 0 0-1.41 0L8.71 8.88l3.41 3.41 8.59-8.58a1 1 0 0 0 0-1.42z"/></svg>`;
const ICON_TANK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mm-lineup-menu-icon"><rect x="2" y="14" width="20" height="6" rx="3"/><path d="M6 14l2-5h7l2 5M2 8h7"/></svg>`;
const ICON_CREW = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="mm-lineup-menu-icon"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
const ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="mm-lineup-menu-icon"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

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

    const p = this.opts.getProfile();
    const activeNation = p.activeNation;
    const nationProfile = p.nations[activeNation];
    const crew = nationProfile?.crews[crewIndex];

    // 1. 换车 (+)
    const changeBtn = h('button', 'mm-lineup-menu-item mm-lineup-menu-change', menu);
    changeBtn.innerHTML = `${ICON_ARROWS}<span class="mm-lineup-menu-text">换车 (+)</span>`;
    changeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenus();
      this.opts.onUiSound?.();
      const currentP = this.opts.getProfile();
      this.opts.onPickVehicle(currentP.activeNation, crewIndex);
    });

    // 2. 改装
    const modsBtn = h(
      'button',
      'mm-lineup-menu-item mm-lineup-menu-modifications mm-lineup-menu-mods',
      menu,
    );
    modsBtn.innerHTML = `${ICON_WRENCH}<span class="mm-lineup-menu-text">改装</span>`;
    if (this.opts.onOpenModifications) {
      modsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenus();
        this.opts.onUiSound?.();
        this.opts.onOpenModifications?.(vehicleId, crewIndex);
      });
    } else {
      modsBtn.disabled = true;
      modsBtn.classList.add('disabled');
      modsBtn.title = '暂未开放';
    }

    // 3. 涂装
    const customBtn = h(
      'button',
      'mm-lineup-menu-item mm-lineup-menu-customization mm-lineup-menu-custom',
      menu,
    );
    customBtn.innerHTML = `${ICON_BRUSH}<span class="mm-lineup-menu-text">涂装</span>`;
    if (this.opts.onOpenCustomization) {
      customBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenus();
        this.opts.onUiSound?.();
        this.opts.onOpenCustomization?.(vehicleId, crewIndex);
      });
    } else {
      customBtn.disabled = true;
      customBtn.classList.add('disabled');
      customBtn.title = '暂未开放';
    }

    // 4. 试驾
    const testDriveBtn = h(
      'button',
      'mm-lineup-menu-item mm-lineup-menu-testdrive mm-lineup-menu-test-drive',
      menu,
    );
    testDriveBtn.innerHTML = `${ICON_TANK}<span class="mm-lineup-menu-text">试驾</span>`;
    if (this.opts.onTestDrive) {
      testDriveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenus();
        this.opts.onUiSound?.();
        this.opts.onTestDrive?.(vehicleId, crewIndex);
      });
    } else {
      testDriveBtn.disabled = true;
      testDriveBtn.classList.add('disabled');
      testDriveBtn.title = '暂未开放';
    }

    // 5. 乘员
    const crewBtn = h('button', 'mm-lineup-menu-item mm-lineup-menu-crew', menu);
    const isRookie = (crew?.progress ?? 0) === 0;
    const alertHtml = isRookie
      ? `<span class="mm-lineup-menu-alert" title="新手车组:挂机成长或在线游玩后会提升">!</span>`
      : '';
    crewBtn.innerHTML = `${ICON_CREW}<span class="mm-lineup-menu-text">乘员</span>${alertHtml}`;
    if (this.opts.onOpenCrew) {
      crewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenus();
        this.opts.onUiSound?.();
        const currentP = this.opts.getProfile();
        this.opts.onOpenCrew?.(currentP.activeNation, crewIndex);
      });
    } else {
      crewBtn.disabled = true;
      crewBtn.classList.add('disabled');
      crewBtn.title = '暂未开放';
    }

    // 细分隔线
    h('div', 'mm-lineup-menu-sep', menu);

    // 6. 清空
    const clearBtn = h('button', 'mm-lineup-menu-item mm-lineup-menu-clear', menu);
    clearBtn.innerHTML = `${ICON_CLOSE}<span class="mm-lineup-menu-text">清空</span>`;
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMenus();
      this.opts.onUiSound?.();
      const currentP = this.opts.getProfile();
      const nation = currentP.activeNation;
      const currentLineupId = currentP.nations[nation]?.activeLineup;
      if (!currentLineupId) return;
      try {
        const prevActive = activeVehicleId(currentP);
        const nextP = assignVehicle(
          currentP,
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

    // 计算实际位置并防越界
    const rootRect = this.root.getBoundingClientRect();
    const clickX = clientX !== undefined ? clientX - rootRect.left : slot.offsetLeft;
    const clickY = clientY !== undefined ? clientY - rootRect.top : slot.offsetTop;
    const menuW = menu.offsetWidth || 140;
    const menuH = menu.offsetHeight || 190;
    const pos = contextMenuPosition(clickX, clickY, menuW, menuH, rootRect);
    menu.style.left = `${pos.left}px`;
    menu.style.top = `${pos.top}px`;
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
