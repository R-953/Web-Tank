import type { Loadout, MapSpec, VehicleSpec } from '../../data/types';
import { SHELL_SHORT, SHELL_TYPES } from '../../data/shells';
import { ammoCapacity, clampLoadout, loadoutTotal } from '../../game/Loadout';
import type { SettingsStore } from '../../settings/Settings';
import type { Profile, ProfileVehicle } from '../../settings/Profile';
import { activeVehicleId, assignVehicle } from '../../settings/Profile';
import type { SettingsPanel, SettingsTab } from './SettingsPanel';
import { h, injectMenuStyles } from './styles';
import { classIcon } from './classIcons';
import { LineupBar } from './LineupBar';
import { TechTree } from './TechTree';
import type { TechTreeEntry } from './techTreeLayout';

function toProfileVehicles(vehicles: readonly VehicleSpec[]): ProfileVehicle[] {
  return vehicles.map((v) => ({
    id: v.id,
    nation: v.nation ?? '',
    family: v.family ?? v.id,
  }));
}

export interface MenuSelection {
  vehicle: VehicleSpec;
  map: MapSpec;
  loadout: Loadout;
}

export interface MainMenuOptions {
  parent: HTMLElement;
  settings: SettingsStore;
  settingsPanel: SettingsPanel;
  vehicles: readonly VehicleSpec[];
  maps: readonly MapSpec[];
  initial: { vehicleId: string; mapId: string };
  loadLoadout(spec: VehicleSpec): Loadout;
  saveLoadout(spec: VehicleSpec, loadout: Loadout): void;
  /** 选了别的载具(main.ts 更新机库里的模型) */
  onVehicleChange(spec: VehicleSpec): void;
  /** 点「进入战斗」:在点击事件里同步调用(main.ts 在这里申请锁定鼠标) */
  onStart(sel: MenuSelection): void;
  onUiSound?(): void;
  /** 有这个就用编组栏 + 科技树取代旧的载具栏;没有就保持旧行为 */
  profile?: {
    get(): Profile;
    set(p: Profile): void;
  };
}

/**
 * 主界面(机库):参照 War Thunder 的布局——
 *   左上 ☰ 菜单(设置各页签、关于)· 顶部中间「进入战斗」和地图选择 · 右上标题;
 *   左侧载具信息 · 右侧携弹 · 底部载具栏;中间透明,拖动旋转机库镜头。
 */
export class MainMenu {
  /** 机库镜头拖动绑定在这个元素上(屏幕中间的透明区域) */
  readonly dragSurface: HTMLDivElement;
  private readonly root: HTMLDivElement;
  private readonly dropdown: HTMLDivElement;
  private readonly about: HTMLDivElement;
  private readonly info: HTMLDivElement;
  private readonly ammo: HTMLDivElement;
  private readonly slots?: HTMLDivElement;
  private readonly lineupBar?: LineupBar;
  private techTree: TechTree | null = null;
  private readonly mapSelect: HTMLSelectElement;
  private vehicle: VehicleSpec;
  private map: MapSpec;
  private loadout: Loadout;

  constructor(private readonly opts: MainMenuOptions) {
    injectMenuStyles();
    let initialVeh = opts.vehicles.find((v) => v.id === opts.initial.vehicleId) ?? opts.vehicles[0];
    if (opts.profile) {
      try {
        const p = opts.profile.get();
        const activeId = activeVehicleId(p);
        const found = opts.vehicles.find((v) => v.id === activeId);
        if (found) {
          initialVeh = found;
        }
      } catch {
        // fallback
      }
    }
    this.vehicle = initialVeh;
    this.map = opts.maps.find((m) => m.id === opts.initial.mapId) ?? opts.maps[0];
    this.loadout = clampLoadout(this.vehicle, opts.loadLoadout(this.vehicle));

    this.root = h('div', 'mm-root hidden', opts.parent);
    this.dragSurface = h('div', 'mm-drag', this.root);

    // --- 顶栏
    const top = h('div', 'mm-top', this.root);
    const menuWrap = h('div', 'mm-menuwrap', top);
    const burger = h('button', 'mm-btn mm-burger', menuWrap, '☰');
    burger.title = '菜单';
    this.dropdown = h('div', 'mm-panel mm-dropdown', menuWrap);
    const item = (text: string, fn: () => void) => {
      const b = h('button', '', this.dropdown, text);
      b.addEventListener('click', () => {
        this.click();
        this.dropdown.classList.remove('open');
        fn();
      });
    };
    const openTab = (tab: SettingsTab) => () => opts.settingsPanel.open(tab);
    item('设置', openTab('game'));
    item('图像', openTab('graphics'));
    item('声音', openTab('sound'));
    item('操作 / 键位', openTab('controls'));
    h('hr', '', this.dropdown);
    item('关于', () => this.about.classList.toggle('open'));
    burger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.click();
      this.dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => this.dropdown.classList.remove('open'));

    const battle = h('div', 'mm-battle', top);
    const start = h('button', 'mm-btn primary', battle, '进入战斗');
    start.addEventListener('click', () => {
      this.click();
      this.opts.onStart(this.selection());
    });
    const mapRow = h('div', '', battle);
    h('span', 'mm-dim', mapRow, '地图 ');
    this.mapSelect = h('select', '', mapRow);
    for (const m of opts.maps) {
      const o = h('option', '', this.mapSelect, `${m.name}(${m.size >= 1000 ? `${m.size / 1000} km` : `${m.size} m`})`);
      o.value = m.id;
    }
    this.mapSelect.value = this.map.id;
    this.mapSelect.addEventListener('change', () => {
      this.map = opts.maps.find((m) => m.id === this.mapSelect.value) ?? this.map;
    });
    h('div', 'mm-title', top, 'Web Tank');

    // --- 左:载具信息;右:携弹;底:载具栏 / 编组栏
    this.info = h('div', 'mm-panel mm-info', this.root);
    this.ammo = h('div', 'mm-panel mm-ammo', this.root);
    if (opts.profile) {
      this.lineupBar = new LineupBar(this.root, {
        vehicles: opts.vehicles,
        getProfile: () => opts.profile!.get(),
        setProfile: (p) => opts.profile!.set(p),
        onActiveVehicle: (vehicleId) => {
          const spec = opts.vehicles.find((v) => v.id === vehicleId);
          if (spec) {
            this.select(spec);
          }
        },
        onPickVehicle: (nation, crewIndex) => {
          this.openTechTree(nation, crewIndex);
        },
        onOpenTechTree: (nation) => {
          this.openTechTree(nation);
        },
        onUiSound: opts.onUiSound,
      });
    } else {
      this.slots = h('div', 'mm-panel mm-slots', this.root);
      this.renderSlots();
    }
    h('div', 'mm-hint', this.root, '拖动旋转视角 · 滚轮缩放 · 战斗中 Esc 暂停');

    this.about = h('div', 'mm-panel mm-about', this.root);
    this.about.innerHTML = `<h2>Web Tank</h2>
      <p>一个参考 War Thunder 陆战的网页坦克射击原型:装甲按入射角判定,击穿后模拟车内破片、模块和乘员损伤,
      弹药架殉爆、起火、维修、换位;瞄准镜分划测距 + 表尺。</p>
      <p class="mm-dim">载具、火炮、弹药数据的来源和取舍见项目的 Readme.md;没有出处的参数一律保留原值或采用公开资料。</p>
      <p class="mm-dim">战斗中:Esc 暂停 · 按住 Alt 显示光标操作小地图(滚轮缩放、双击标点)· 其余键位见「操作 / 键位」。</p>`;
    const closeAbout = h('button', 'mm-btn', this.about, '关闭');
    closeAbout.addEventListener('click', () => this.about.classList.remove('open'));

    this.renderInfo();
    this.renderAmmo();
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  show(): void {
    this.root.classList.remove('hidden');
    // 回到机库时刷新携弹(可能在别处改过)
    this.loadout = clampLoadout(this.vehicle, this.opts.loadLoadout(this.vehicle));
    this.renderAmmo();
    this.lineupBar?.refresh();
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.dropdown.classList.remove('open');
    this.about.classList.remove('open');
    if (this.techTree) {
      this.techTree.dispose();
      this.techTree = null;
    }
  }

  selection(): MenuSelection {
    return { vehicle: this.vehicle, map: this.map, loadout: { ...this.loadout } };
  }

  private click(): void {
    this.opts.onUiSound?.();
  }

  private select(spec: VehicleSpec): void {
    if (spec.id === this.vehicle.id) return;
    this.vehicle = spec;
    this.loadout = clampLoadout(spec, this.opts.loadLoadout(spec));
    if (this.lineupBar) {
      this.lineupBar.refresh();
    } else {
      this.renderSlots();
    }
    this.renderInfo();
    this.renderAmmo();
    this.opts.onVehicleChange(spec);
  }

  private openTechTree(nation: string, crewIndex?: number): void {
    if (!this.opts.profile) return;
    if (this.techTree) {
      this.techTree.dispose();
      this.techTree = null;
    }

    const p = this.opts.profile.get();
    const nationProfile = p.nations[nation];
    const activeLineupId = nationProfile?.activeLineup;
    const lineup = nationProfile?.lineups.find((l) => l.id === activeLineupId);
    const inLineup = new Set<string>();
    if (lineup) {
      for (const slot of lineup.slots) {
        if (slot) inLineup.add(slot);
      }
    }

    const nationVehicles = this.opts.vehicles.filter((v) => v.nation === nation);
    const entries: TechTreeEntry[] = nationVehicles.map((v) => ({
      id: v.id,
      name: v.name,
      nation: v.nation ?? nation,
      vehicleClass: v.vehicleClass ?? 'medium',
      serviceYear: v.serviceYear ?? 1944,
      family: v.family ?? v.id,
    }));

    this.techTree = new TechTree(this.root, {
      entries,
      currentId: this.vehicle.id,
      inLineup,
      onPick: (vehicleId) => {
        if (!this.opts.profile) return;
        try {
          const curP = this.opts.profile.get();
          const curLineupId = curP.nations[nation]?.activeLineup;
          if (curLineupId) {
            const curLineup = curP.nations[nation]?.lineups.find((l) => l.id === curLineupId);
            const targetCrewIndex = crewIndex ?? curLineup?.selected ?? 0;
            const prevActive = activeVehicleId(curP);
            const nextP = assignVehicle(curP, nation, curLineupId, targetCrewIndex, vehicleId, toProfileVehicles(this.opts.vehicles));
            this.opts.profile.set(nextP);
            const newActive = activeVehicleId(nextP);
            if (newActive !== prevActive) {
              const nextSpec = this.opts.vehicles.find((v) => v.id === newActive);
              if (nextSpec) {
                this.select(nextSpec);
              }
            }
          }
        } catch {
          // 规则校验失败时忽略
        }
        this.techTree?.dispose();
        this.techTree = null;
        this.lineupBar?.refresh();
      },
      onClose: () => {
        this.techTree?.dispose();
        this.techTree = null;
      },
    });
  }

  private renderSlots(): void {
    if (!this.slots) return;
    this.slots.innerHTML = '';
    for (const v of this.opts.vehicles) {
      const card = h('div', `mm-slot${v.id === this.vehicle.id ? ' sel' : ''}`, this.slots);
      const nameEl = h('div', 'name', card);
      const iconHtml = v.vehicleClass ? classIcon(v.vehicleClass) : '';
      nameEl.innerHTML = `${iconHtml}${v.name}`;
      card.insertAdjacentHTML('beforeend', silhouette(v));
      const gun = v.weapons[0];
      const cal = gun?.ammo[0]?.caliber;
      h('div', 'stats', card, `${cal ? `${cal} mm 炮` : '无主炮'} · ${v.maxSpeed} km/h · 乘员 ${v.internals.crew.length}`);
      card.addEventListener('click', () => {
        this.click();
        this.select(v);
      });
    }
  }

  private renderInfo(): void {
    const v = this.vehicle;
    const gun = v.weapons[0];
    const mg = v.weapons.find((w) => w.kind === 'mg');
    const first = gun?.ammo[0];
    const rows: [string, string][] = [];
    const armor = (a: { front: number; side: number; rear: number }) => `${a.front} / ${a.side} / ${a.rear} mm`;
    rows.push(['车体装甲', armor(v.armor)]);
    rows.push([v.turret.traverse ? '战斗室装甲' : '炮塔装甲', armor(v.turretArmor)]);
    const gunRows: [string, string][] = [];
    if (gun) {
      gunRows.push(['主炮', gun.name]);
      if (first) gunRows.push(['首发弹穿深', `${Math.round(first.penetration)} mm(${first.name})`]);
      gunRows.push(['装填', `${gun.reloadTime} s`]);
      gunRows.push(['俯仰', `${v.turret.elevation[0]}° / +${v.turret.elevation[1]}°`]);
      if (v.turret.traverse) {
        // 固定战斗室:火炮只能在射界内转
        gunRows.push(['射界', `左 ${v.turret.traverse[0]}° / 右 ${v.turret.traverse[1]}°`]);
        gunRows.push(['方向机', `${v.turretRotationSpeed}°/s`]);
      } else {
        gunRows.push(['炮塔转速', `${v.turretRotationSpeed}°/s`]);
      }
      gunRows.push(['瞄准镜', v.sight.magnifications.map((m) => `${m}×`).join(' / ')]);
    }
    if (mg) gunRows.push(['同轴机枪', `${mg.name} · ${mg.rateOfFire ?? '?'} 发/分`]);
    const mob: [string, string][] = [
      ['最大速度', `${v.maxSpeed} km/h`],
      ['原地转向', `${v.hull.turnRate}°/s`],
      ['乘员', `${v.internals.crew.length} 人`],
    ];
    const table = (list: [string, string][]) => `<table>${list.map(([k, val]) => `<tr><td>${k}</td><td>${val}</td></tr>`).join('')}</table>`;
    const infoIconHtml = v.vehicleClass ? classIcon(v.vehicleClass) : '';
    this.info.innerHTML = `<h2>${infoIconHtml}${v.name}</h2>
      <div class="sec">防护(前 / 侧 / 后)</div>${table(rows)}
      <div class="sec">火力</div>${table(gunRows)}
      <div class="sec">机动</div>${table(mob)}`;
  }

  private renderAmmo(): void {
    const v = this.vehicle;
    const cap = ammoCapacity(v);
    const ammo = v.weapons[0]?.ammo ?? [];
    const total = loadoutTotal(this.loadout);
    this.ammo.innerHTML = '';
    h('h2', '', this.ammo, '携弹');
    h('div', 'mm-note', this.ammo, `弹药架共 ${cap} 发;少带弹时最先取空的弹药架会空着,被击穿时更不容易殉爆。`);
    const table = h('table', '', this.ammo);
    for (const a of ammo) {
      const tr = h('tr', '', table);
      const name = h('td', '', tr, a.name);
      h('div', 'type', name, `${SHELL_SHORT[a.type]} · ${SHELL_TYPES[a.type].name} · 穿深 ${Math.round(a.penetration)} mm`);
      const minus = h('button', 'mm-btn small', h('td', '', tr), '−');
      h('td', 'n', tr, String(this.loadout[a.id] ?? 0));
      const plus = h('button', 'mm-btn small', h('td', '', tr), '+');
      const change = (delta: number) => {
        this.click();
        const cur = this.loadout[a.id] ?? 0;
        let next = Math.max(0, cur + delta);
        // 超出容量时只加到满为止
        if (delta > 0) next = Math.min(next, cur + (cap - loadoutTotal(this.loadout)));
        this.loadout = clampLoadout(v, { ...this.loadout, [a.id]: next });
        this.opts.saveLoadout(v, this.loadout);
        this.renderAmmo();
      };
      minus.addEventListener('click', () => change(-5));
      plus.addEventListener('click', () => change(5));
      minus.disabled = (this.loadout[a.id] ?? 0) === 0;
      plus.disabled = total >= cap;
    }
    const sum = h('div', 'total', this.ammo, `合计 ${total} / ${cap} 发`);
    const bar = h('div', 'bar', sum);
    h('div', '', bar).style.width = `${Math.round((total / Math.max(1, cap)) * 100)}%`;
    const mg = v.weapons.find((w) => w.kind === 'mg');
    if (mg) h('div', 'mm-note', this.ammo, `同轴机枪 ${mg.name}:${mg.rounds ?? 0} 发(每条弹链 ${mg.beltSize ?? '?'} 发),不占弹药架`);
  }
}

/** 载具侧视剪影(按车体 / 炮塔尺寸画的示意图) */
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
