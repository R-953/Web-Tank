import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VehicleClass, VehicleSpec } from '../src/data/types';
import { VEHICLES } from '../src/data/vehicles';
import { defaultProfile, recruitCrew, assignVehicle } from '../src/settings/Profile';
import { classIcon } from '../src/ui/menu/classIcons';
import { TechTree } from '../src/ui/menu/TechTree';
import { LineupBar } from '../src/ui/menu/LineupBar';
import { MainMenu, type MainMenuOptions } from '../src/ui/menu/MainMenu';
import { MAPS } from '../src/data/maps';

const vehicleList = Object.values(VEHICLES);
const profileVehicles = vehicleList.map((v) => ({
  id: v.id,
  nation: v.nation ?? '',
  family: v.family ?? v.id,
}));

describe('classIcon 基础单元测试', () => {
  it('四种类型生成的 SVG 互不相同', () => {
    const classes: VehicleClass[] = ['light', 'medium', 'heavy', 'td'];
    const svgs = classes.map((c) => classIcon(c));
    const unique = new Set(svgs);
    expect(unique.size).toBe(4);
    for (const svg of svgs) {
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
    }
  });

  it('都含 currentColor、role="img" 以及正确的中文 aria-label', () => {
    const expectedLabels: Record<VehicleClass, string> = {
      light: '轻型坦克',
      medium: '中型坦克',
      heavy: '重型坦克',
      td: '坦克歼击车 / 突击炮',
    };

    for (const [cls, label] of Object.entries(expectedLabels) as [VehicleClass, string][]) {
      const svg = classIcon(cls);
      expect(svg).toContain('currentColor');
      expect(svg).toContain('role="img"');
      expect(svg).toContain(`aria-label="${label}"`);
    }
  });

  it('size 参数生效，且缺省为 14', () => {
    const defaultSvg = classIcon('medium');
    expect(defaultSvg).toContain('width="14"');
    expect(defaultSvg).toContain('height="14"');

    const customSvg = classIcon('heavy', 20);
    expect(customSvg).toContain('width="20"');
    expect(customSvg).toContain('height="20"');

    const smallSvg = classIcon('light', 10);
    expect(smallSvg).toContain('width="10"');
    expect(smallSvg).toContain('height="10"');
  });

  it('没有 vehicleClass 或未知类型时返回空字符串且不报错', () => {
    expect(classIcon(undefined as unknown as VehicleClass)).toBe('');
    expect(classIcon('' as unknown as VehicleClass)).toBe('');
    expect(classIcon('unknown_class' as unknown as VehicleClass)).toBe('');
  });
});

describe('jsdom 集成测试: 科技树、编组栏、机库信息面板', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  });

  it('科技树: 类别行首、单车卡片、车族组标题及组内单车都能按 aria-label 找到图标', () => {
    const entries = [
      { id: 'l1', name: '轻坦一号', nation: 'germany', vehicleClass: 'light' as const, serviceYear: 1940, family: 'l1' },
      { id: 'm1', name: '中坦一号', nation: 'germany', vehicleClass: 'medium' as const, serviceYear: 1942, family: 'm_fam' },
      { id: 'm2', name: '中坦二号', nation: 'germany', vehicleClass: 'medium' as const, serviceYear: 1943, family: 'm_fam' },
      { id: 'h1', name: '重坦一号', nation: 'germany', vehicleClass: 'heavy' as const, serviceYear: 1944, family: 'h1' },
      { id: 't1', name: '歼击一号', nation: 'germany', vehicleClass: 'td' as const, serviceYear: 1943, family: 't1' },
    ];

    const tt = new TechTree(container, {
      entries,
      currentId: 'h1',
      onPick: vi.fn(),
      onClose: vi.fn(),
    });

    // 1. 类别行首
    const lightHeader = container.querySelector('.tt-lane[data-class="light"] .tt-lane-header');
    expect(lightHeader?.querySelector('svg[aria-label="轻型坦克"]')).not.toBeNull();

    const mediumHeader = container.querySelector('.tt-lane[data-class="medium"] .tt-lane-header');
    expect(mediumHeader?.querySelector('svg[aria-label="中型坦克"]')).not.toBeNull();

    const heavyHeader = container.querySelector('.tt-lane[data-class="heavy"] .tt-lane-header');
    expect(heavyHeader?.querySelector('svg[aria-label="重型坦克"]')).not.toBeNull();

    const tdHeader = container.querySelector('.tt-lane[data-class="td"] .tt-lane-header');
    expect(tdHeader?.querySelector('svg[aria-label="坦克歼击车 / 突击炮"]')).not.toBeNull();

    // 2. 单车卡片
    const l1Card = container.querySelector('.tt-vehicle-card[data-vehicle-id="l1"]');
    expect(l1Card?.querySelector('svg[aria-label="轻型坦克"]')).not.toBeNull();

    const h1Card = container.querySelector('.tt-vehicle-card[data-vehicle-id="h1"]');
    expect(h1Card?.querySelector('svg[aria-label="重型坦克"]')).not.toBeNull();

    const t1Card = container.querySelector('.tt-vehicle-card[data-vehicle-id="t1"]');
    expect(t1Card?.querySelector('svg[aria-label="坦克歼击车 / 突击炮"]')).not.toBeNull();

    // 3. 多车组标题与组内单车
    const groupCard = container.querySelector('.tt-group-card[data-family="m_fam"]');
    expect(groupCard).not.toBeNull();
    const groupHeader = groupCard?.querySelector('.tt-group-header');
    expect(groupHeader?.querySelector('svg[aria-label="中型坦克"]')).not.toBeNull();

    const m1Item = groupCard?.querySelector('.tt-vehicle-item[data-vehicle-id="m1"]');
    expect(m1Item?.querySelector('svg[aria-label="中型坦克"]')).not.toBeNull();

    const m2Item = groupCard?.querySelector('.tt-vehicle-item[data-vehicle-id="m2"]');
    expect(m2Item?.querySelector('svg[aria-label="中型坦克"]')).not.toBeNull();

    tt.dispose();
  });

  it('科技树卡片布局: 卡片有 title = 完整车名，「已编组」标记和年份在同一个父元素中', () => {
    const longName = '虎式 Ausf. E(1944 后期型)';
    const entries = [
      { id: 'tiger_late', name: longName, nation: 'germany', vehicleClass: 'heavy' as const, serviceYear: 1944, family: 'tiger' },
    ];

    const tt = new TechTree(container, {
      entries,
      currentId: 'tiger_late',
      inLineup: new Set(['tiger_late']),
      onPick: vi.fn(),
      onClose: vi.fn(),
    });

    const card = container.querySelector<HTMLElement>('.tt-vehicle-card[data-vehicle-id="tiger_late"]');
    expect(card).not.toBeNull();
    expect(card?.title).toBe(longName);

    const yearEl = card?.querySelector('.tt-vehicle-year');
    const badgeEl = card?.querySelector('.tt-badge-lineup');
    expect(yearEl).not.toBeNull();
    expect(badgeEl).not.toBeNull();
    expect(badgeEl?.parentElement).toBe(yearEl?.parentElement);

    tt.dispose();
  });

  it('编组栏: 车组格子里载具名前能按 aria-label 找到对应类型的图标', () => {
    let profile = defaultProfile(profileVehicles, 1000);
    // 默认德国第一个格子是 tiger_i (heavy)
    const bar = new LineupBar(container, {
      vehicles: vehicleList,
      getProfile: () => profile,
      setProfile: (p) => {
        profile = p;
      },
      onActiveVehicle: vi.fn(),
      onPickVehicle: vi.fn(),
    });

    const slots = container.querySelectorAll('.mm-lineup-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);

    const slot0 = slots[0];
    const heavyIcon = slot0.querySelector('svg[aria-label="重型坦克"]');
    expect(heavyIcon).not.toBeNull();

    // 招募并分一辆 T-34-85 (medium) 或 SU-100 (td) 到苏联
    profile = recruitCrew(profile, 'ussr');
    profile = assignVehicle(profile, 'ussr', 'lineup-1', 0, 't34_85', profileVehicles);
    profile = assignVehicle(profile, 'ussr', 'lineup-1', 1, 'su_100', profileVehicles);
    profile = { ...profile, activeNation: 'ussr' };
    bar.refresh();

    const ussrSlots = container.querySelectorAll('.mm-lineup-slot');
    expect(ussrSlots[0].querySelector('svg[aria-label="中型坦克"]')).not.toBeNull();
    expect(ussrSlots[1].querySelector('svg[aria-label="坦克歼击车 / 突击炮"]')).not.toBeNull();

    bar.dispose();
  });

  it('机库信息面板: 左侧信息面板按 aria-label 能查到载具类型图标，旧载具栏亦能查到', () => {
    const mockSettings = {
      get: vi.fn(),
      set: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    } as unknown as MainMenuOptions['settings'];

    const mockSettingsPanel = {
      open: vi.fn(),
    } as unknown as MainMenuOptions['settingsPanel'];

    const mapList = Object.values(MAPS);

    // 1. 测试旧载具栏与信息面板（无 profile 选项）
    const tigerSpec = VEHICLES.tiger_i;
    expect(tigerSpec.vehicleClass).toBe('heavy');

    const menu = new MainMenu({
      parent: container,
      settings: mockSettings,
      settingsPanel: mockSettingsPanel,
      vehicles: [VEHICLES.tiger_i, VEHICLES.t34_85, VEHICLES.su_100],
      maps: mapList,
      initial: { vehicleId: 'tiger_i', mapId: mapList[0].id },
      loadLoadout: () => ({ pzgr39: 50 }),
      saveLoadout: vi.fn(),
      onVehicleChange: vi.fn(),
      onStart: vi.fn(),
    });
    expect(menu).toBeDefined();

    // 检查左侧信息面板 h2
    const infoPanel = container.querySelector('.mm-info');
    expect(infoPanel).not.toBeNull();
    const infoIcon = infoPanel?.querySelector('h2 svg[aria-label="重型坦克"]');
    expect(infoIcon).not.toBeNull();

    // 检查旧载具栏 renderSlots
    const slots = container.querySelectorAll('.mm-slot');
    expect(slots.length).toBe(3);
    expect(slots[0].querySelector('.name svg[aria-label="重型坦克"]')).not.toBeNull();
    expect(slots[1].querySelector('.name svg[aria-label="中型坦克"]')).not.toBeNull();
    expect(slots[2].querySelector('.name svg[aria-label="坦克歼击车 / 突击炮"]')).not.toBeNull();

    // 2. 无 vehicleClass 的车辆测试，不报错且不显示图标
    const noClassSpec: VehicleSpec = {
      ...VEHICLES.tiger_i,
      id: 'test_custom',
      name: '自定义测试车',
      vehicleClass: undefined,
    };

    const customContainer = document.createElement('div');
    document.body.appendChild(customContainer);
    const customMenu = new MainMenu({
      parent: customContainer,
      settings: mockSettings,
      settingsPanel: mockSettingsPanel,
      vehicles: [noClassSpec],
      maps: mapList,
      initial: { vehicleId: 'test_custom', mapId: mapList[0].id },
      loadLoadout: () => ({ pzgr39: 50 }),
      saveLoadout: vi.fn(),
      onVehicleChange: vi.fn(),
      onStart: vi.fn(),
    });
    expect(customMenu).toBeDefined();

    const customH2 = customContainer.querySelector('.mm-info h2');
    expect(customH2?.querySelector('svg[aria-label]')).toBeNull();
    expect(customH2?.textContent).toContain('自定义测试车');

    customContainer.remove();
  });
});
