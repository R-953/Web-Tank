/**
 * 科技树全屏组件
 * 包含:
 * - 顶部固定年份刻度与关闭按钮、Esc 监听
 * - 每个国家占一个横带,高占满可是区,CSS scroll-snap 滚动对齐
 * - 按类别分线,车族成组,单车直接显示,多车叠成一组点击展开收起
 * - 当前车辆高亮,编组内车辆标记,点击车辆触发 onPick(vehicleId)
 */

import {
  CLASS_NAMES,
  NATION_NAMES,
  techTreeLayout,
  type TechTreeEntry,
  type TechTreeLayout,
} from './techTreeLayout';
import { classIcon } from './classIcons';
import { h, injectTechTreeStyles } from './styles';
import type { VehicleSpec } from '../../data/types';
import { VEHICLES } from '../../data/vehicles';
import { silhouette } from './LineupBar';
import { vehicleThumbnail } from './thumbnails';

export interface TechTreeOptions {
  entries: readonly TechTreeEntry[];
  /** 当前出战的载具,高亮 */
  currentId?: string;
  /** 已在当前编组里的载具,打一个小标记 */
  inLineup?: ReadonlySet<string>;
  onPick(vehicleId: string): void;
  onClose(): void;
  /** 鼠标移到载具卡片上 / 移开时调用 */
  onHoverVehicle?(vehicleId: string | null, rect: DOMRect | null): void;
}

export class TechTree {
  private readonly root: HTMLElement;
  private readonly scrollContainer: HTMLElement;
  private readonly nationEls = new Map<string, HTMLElement>();
  private readonly tabEls = new Map<string, HTMLButtonElement>();
  private readonly handleKeyDown: (e: KeyboardEvent) => void;
  private readonly handleDocClick: () => void;
  private readonly handleScroll: () => void;
  private readonly layout: TechTreeLayout;

  constructor(parent: HTMLElement, private readonly opts: TechTreeOptions) {
    injectTechTreeStyles();
    this.layout = techTreeLayout(opts.entries);

    this.root = h('div', 'tt-root', parent);

    // 1. 顶栏:左侧标题与国家切换快捷按钮,右侧关闭按钮
    const topbar = h('div', 'tt-topbar', this.root);
    const topLeft = h('div', 'tt-top-left', topbar);
    h('div', 'tt-title', topLeft, '科技树');

    if (this.layout.nations.length > 0) {
      const tabs = h('div', 'tt-nation-tabs', topLeft);
      for (const nation of this.layout.nations) {
        const tabBtn = h(
          'button',
          'mm-btn tt-nation-tab',
          tabs,
          NATION_NAMES[nation.nation] ?? nation.nation,
        );
        tabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showNation(nation.nation);
        });
        this.tabEls.set(nation.nation, tabBtn);
      }
    }

    const closeBtn = h('button', 'mm-btn tt-close', topbar, '✕');
    closeBtn.title = '关闭 (Esc)';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.opts.onClose();
    });

    // 2. 顶部固定年份刻度栏
    const yearsBar = h('div', 'tt-years-bar', this.root);
    h('div', 'tt-years-spacer', yearsBar, '服役年份');
    const yearsTrack = h('div', 'tt-years-track', yearsBar);
    if (this.layout.years.length > 0) {
      yearsTrack.style.gridTemplateColumns = `repeat(${this.layout.years.length}, minmax(160px, 1fr))`;
      for (const year of this.layout.years) {
        h('div', 'tt-year-tick', yearsTrack, String(year));
      }
    }

    // 3. 国家垂直滚动区(CSS scroll-snap)
    this.scrollContainer = h('div', 'tt-scroll', this.root);

    // 同步横向滚动
    this.handleScroll = () => {
      yearsBar.scrollLeft = this.scrollContainer.scrollLeft;
    };
    this.scrollContainer.addEventListener('scroll', this.handleScroll);

    // 构建每个国家的横带
    for (const nation of this.layout.nations) {
      const nationEl = h('div', 'tt-nation', this.scrollContainer);
      nationEl.dataset.nation = nation.nation;
      this.nationEls.set(nation.nation, nationEl);

      // 左侧国家名称侧边栏
      const sidebar = h('div', 'tt-nation-sidebar', nationEl);
      h('div', 'tt-nation-name', sidebar, NATION_NAMES[nation.nation] ?? nation.nation);

      // 右侧载具类别线
      const lanesEl = h('div', 'tt-lanes', nationEl);
      for (const lane of nation.lanes) {
        const laneEl = h('div', 'tt-lane', lanesEl);
        laneEl.dataset.class = lane.vehicleClass;

        // 类别名称
        const laneHeader = h('div', 'tt-lane-header', laneEl);
        laneHeader.innerHTML = `${classIcon(lane.vehicleClass)}${CLASS_NAMES[lane.vehicleClass] ?? lane.vehicleClass}`;

        // 网格区域:对应全局年份刻度
        const gridEl = h('div', 'tt-lane-grid', laneEl);
        if (this.layout.years.length > 0) {
          gridEl.style.gridTemplateColumns = `repeat(${this.layout.years.length}, minmax(160px, 1fr))`;

          // 按年份列创建单元格
          for (let col = 0; col < this.layout.years.length; col++) {
            const colEl = h('div', 'tt-grid-col', gridEl);
            colEl.dataset.col = String(col);

            const groupsInCol = lane.groups.filter((g) => g.column === col);
            for (const group of groupsInCol) {
              if (group.members.length === 1) {
                // 只有一辆车的组:直接显示该车辆卡片
                this.renderSingleVehicleCard(colEl, group.members[0]);
              } else {
                // 多辆车的组:显示组标题和「×N」,点击展开/收起
                this.renderMultiVehicleGroup(colEl, group);
              }
            }
          }
        }
      }
    }

    // 默认高亮第一个国家 tab
    if (this.layout.nations.length > 0) {
      this.updateActiveTab(this.layout.nations[0].nation);
    }

    // 键盘监听:Esc 关闭
    this.handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.opts.onClose();
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);

    // 点击空白处收起已展开的车组列表
    this.handleDocClick = () => {
      this.closeAllGroups();
    };
    document.addEventListener('click', this.handleDocClick);
  }

  private renderThumbOrSilhouette(parent: HTMLElement, entry: TechTreeEntry): void {
    const spec =
      VEHICLES[entry.id] ??
      ({
        id: entry.id,
        name: entry.name,
        nation: entry.nation,
        vehicleClass: entry.vehicleClass,
        serviceYear: entry.serviceYear,
        family: entry.family,
        armor: { front: 50, side: 30, rear: 20 },
        turretArmor: { front: 50, side: 30, rear: 20 },
        maxSpeed: 40,
        turretRotationSpeed: 20,
        weapons: [],
        hull: { length: 6, width: 3, height: 1.5 },
        turret: { length: 2.5, width: 2, height: 0.8, barrelLength: 2 },
        sight: { magnifications: [4] },
        internals: { modules: [], crew: [] },
        color: 0x555555,
      } as unknown as VehicleSpec);

    const thumb = vehicleThumbnail(spec);
    const wrap = h('div', 'tt-vehicle-thumb-wrap', parent);
    if (thumb) {
      const img = h('img', 'tt-vehicle-thumb', wrap);
      img.src = thumb;
      img.alt = entry.name;
    } else if (spec.hull) {
      wrap.innerHTML = silhouette(spec, 100);
    }
  }

  /**
   * 渲染单辆车卡片
   */
  private renderSingleVehicleCard(parent: HTMLElement, entry: TechTreeEntry): void {
    const card = h('div', 'tt-card tt-vehicle-card', parent);
    card.dataset.vehicleId = entry.id;
    card.title = entry.name;

    if (entry.id === this.opts.currentId) {
      card.classList.add('tt-current');
    }

    const isLineup = this.opts.inLineup?.has(entry.id);
    if (isLineup) {
      card.classList.add('tt-in-lineup');
    }

    this.renderThumbOrSilhouette(card, entry);

    const nameEl = h('div', 'tt-vehicle-name', card);
    nameEl.innerHTML = `${classIcon(entry.vehicleClass)}${entry.name}`;

    const meta = h('div', 'tt-vehicle-meta', card);
    h('div', 'tt-vehicle-year', meta, `${entry.serviceYear} 年`);
    if (isLineup) {
      h('span', 'tt-badge-lineup', meta, '已编组');
    }

    card.addEventListener('mouseenter', () => {
      this.opts.onHoverVehicle?.(entry.id, card.getBoundingClientRect());
    });
    card.addEventListener('mouseleave', () => {
      this.opts.onHoverVehicle?.(null, null);
    });

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.opts.onPick(entry.id);
    });
  }

  /**
   * 渲染多车组卡片(带 ×N 与折叠展开列表)
   */
  private renderMultiVehicleGroup(
    parent: HTMLElement,
    group: { family: string; title: string; members: TechTreeEntry[] },
  ): void {
    const groupCard = h('div', 'tt-card tt-group-card', parent);
    groupCard.dataset.family = group.family;

    const hasCurrent = group.members.some((m) => m.id === this.opts.currentId);
    if (hasCurrent) {
      groupCard.classList.add('tt-has-current');
    }

    const hasLineup = group.members.some((m) => this.opts.inLineup?.has(m.id));
    if (hasLineup) {
      groupCard.classList.add('tt-has-lineup');
    }

    const header = h('div', 'tt-group-header', groupCard);
    const titleEl = h('div', 'tt-group-title', header);
    const groupClass = group.members[0]?.vehicleClass;
    titleEl.innerHTML = `${groupClass ? classIcon(groupClass) : ''}${group.title}`;
    h('div', 'tt-group-count', header, `×${group.members.length}`);
    const arrow = h('div', 'tt-group-arrow', header, '▼');

    const list = h('div', 'tt-group-list', groupCard);
    list.style.display = 'none';

    for (const member of group.members) {
      const item = h('div', 'tt-vehicle-item', list);
      item.dataset.vehicleId = member.id;
      item.title = member.name;

      if (member.id === this.opts.currentId) {
        item.classList.add('tt-current');
      }

      const isLineup = this.opts.inLineup?.has(member.id);
      if (isLineup) {
        item.classList.add('tt-in-lineup');
      }

      this.renderThumbOrSilhouette(item, member);

      const nameEl = h('div', 'tt-vehicle-name', item);
      nameEl.innerHTML = `${classIcon(member.vehicleClass)}${member.name}`;

      const meta = h('div', 'tt-vehicle-meta', item);
      h('div', 'tt-vehicle-year', meta, `${member.serviceYear} 年`);
      if (isLineup) {
        h('span', 'tt-badge-lineup', meta, '已编组');
      }

      item.addEventListener('mouseenter', () => {
        this.opts.onHoverVehicle?.(member.id, item.getBoundingClientRect());
      });
      item.addEventListener('mouseleave', () => {
        this.opts.onHoverVehicle?.(null, null);
      });

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.opts.onPick(member.id);
      });
    }

    // 点击头部展开或收起
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !groupCard.classList.contains('open');
      this.closeAllGroups();
      if (willOpen) {
        groupCard.classList.add('open');
        list.style.display = 'flex';
        arrow.textContent = '▲';
      }
    });
  }

  /**
   * 收起所有已展开的车组
   */
  private closeAllGroups(): void {
    const openGroups = this.root.querySelectorAll<HTMLElement>('.tt-group-card.open');
    openGroups.forEach((card) => {
      card.classList.remove('open');
      const list = card.querySelector<HTMLElement>('.tt-group-list');
      if (list) list.style.display = 'none';
      const arrow = card.querySelector<HTMLElement>('.tt-group-arrow');
      if (arrow) arrow.textContent = '▼';
    });
  }

  /**
   * 更新顶栏激活的国家标签
   */
  private updateActiveTab(nation: string): void {
    for (const [nat, tab] of this.tabEls) {
      if (nat === nation) {
        tab.classList.add('on');
      } else {
        tab.classList.remove('on');
      }
    }
  }

  /**
   * 滚到某个国家(按国家对齐)
   */
  showNation(nation: string): void {
    const el = this.nationEls.get(nation);
    if (el) {
      this.scrollContainer.scrollTop = el.offsetTop;
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      this.updateActiveTab(nation);
    }
  }

  /**
   * 销毁组件与解绑事件
   */
  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleDocClick);
    this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    this.root.remove();
  }
}
