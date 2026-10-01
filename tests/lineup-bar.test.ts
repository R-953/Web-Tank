import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLES } from '../src/data/vehicles';
import {
  defaultProfile,
  recruitCrew,
  assignVehicle,
  CREW_SLOT_LIMIT,
  type Profile,
} from '../src/settings/Profile';
import { LineupBar } from '../src/ui/menu/LineupBar';
import { MainMenu } from '../src/ui/menu/MainMenu';

const vehicleList = Object.values(VEHICLES);
const profileVehicles = vehicleList.map((v) => ({
  id: v.id,
  nation: v.nation ?? '',
  family: v.family ?? v.id,
}));

describe('LineupBar UI Component', () => {
  let container: HTMLElement;
  let currentProfile: Profile;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    currentProfile = defaultProfile(profileVehicles, 1000);
    return () => {
      container.remove();
    };
  });

  function createBar(opts?: {
    onActiveVehicle?: (id: string) => void;
    onPickVehicle?: (nation: string, crewIndex: number) => void;
  }) {
    const onActiveVehicle = opts?.onActiveVehicle ?? vi.fn();
    const onPickVehicle = opts?.onPickVehicle ?? vi.fn();
    const onUiSound = vi.fn();

    const bar = new LineupBar(container, {
      vehicles: vehicleList,
      getProfile: () => currentProfile,
      setProfile: (p) => {
        currentProfile = p;
      },
      onActiveVehicle,
      onPickVehicle,
      onUiSound,
    });

    return { bar, onActiveVehicle, onPickVehicle, onUiSound };
  }

  it('格子数 = 该国车组数，初始为 1 个格子', () => {
    const { bar } = createBar();
    const slots = container.querySelectorAll('.mm-lineup-slot');
    expect(slots.length).toBe(1);

    // 德国默认第 1 个车组分了 tiger_i，高亮 selected
    expect(slots[0].classList.contains('sel')).toBe(true);
    expect(slots[0].textContent).toContain('虎式');
    expect(slots[0].textContent).toContain('Lv 0');
    bar.dispose();
  });

  it('招募车组后，格子数随之增加，且空格显示「+」与「未分车」', () => {
    currentProfile = recruitCrew(currentProfile, 'germany');
    const { bar } = createBar();

    const slots = container.querySelectorAll('.mm-lineup-slot');
    expect(slots.length).toBe(2);

    // 第 1 格有车
    expect(slots[0].classList.contains('empty')).toBe(false);
    expect(slots[0].textContent).toContain('虎式');

    // 第 2 格为空格
    expect(slots[1].classList.contains('empty')).toBe(true);
    expect(slots[1].textContent).toContain('+');
    expect(slots[1].textContent).toContain('未分车');
    bar.dispose();
  });

  it('点格子触发 onActiveVehicle', () => {
    currentProfile = recruitCrew(currentProfile, 'germany');
    currentProfile = assignVehicle(
      currentProfile,
      'germany',
      'lineup-1',
      1,
      'tiger_ii',
      profileVehicles,
    );

    const onActiveVehicle = vi.fn();
    const { bar } = createBar({ onActiveVehicle });

    const slots = container.querySelectorAll<HTMLElement>('.mm-lineup-slot');
    expect(slots.length).toBe(2);

    // 当前选中的是 slot 0 (tiger_i)，点击 slot 1 (tiger_ii)
    slots[1].click();

    expect(onActiveVehicle).toHaveBeenCalledWith('tiger_ii');
    expect(currentProfile.nations.germany.lineups[0].selected).toBe(1);

    // 重新点击已经选中的 slot 1
    slots[1].click();
    expect(onActiveVehicle).toHaveBeenCalledWith('tiger_ii');

    bar.dispose();
  });

  it('点空格子的「+」或空格子本身触发 onPickVehicle', () => {
    currentProfile = recruitCrew(currentProfile, 'germany');
    const onPickVehicle = vi.fn();
    const { bar } = createBar({ onPickVehicle });

    const slots = container.querySelectorAll<HTMLElement>('.mm-lineup-slot');
    const emptySlot = slots[1];

    // 点击「+」按钮
    const plusBtn = emptySlot.querySelector<HTMLElement>('.mm-lineup-slot-add-btn');
    expect(plusBtn).not.toBeNull();
    plusBtn?.click();

    expect(onPickVehicle).toHaveBeenCalledTimes(1);
    expect(onPickVehicle).toHaveBeenCalledWith('germany', 1);

    // 点击空格子空白处
    emptySlot.click();
    expect(onPickVehicle).toHaveBeenCalledTimes(2);
    expect(onPickVehicle).toHaveBeenCalledWith('germany', 1);

    bar.dispose();
  });

  it('点有车格子的「换车」按钮触发 onPickVehicle', () => {
    const onPickVehicle = vi.fn();
    const { bar } = createBar({ onPickVehicle });

    const slot0 = container.querySelector<HTMLElement>('.mm-lineup-slot')!;
    const changeBtn = slot0.querySelector<HTMLElement>('.mm-lineup-btn-change');
    expect(changeBtn).not.toBeNull();

    changeBtn?.click();
    expect(onPickVehicle).toHaveBeenCalledWith('germany', 0);

    bar.dispose();
  });

  it('「×」清空最后一辆车时显示报错且存档不变', () => {
    const profileBefore = JSON.stringify(currentProfile);
    const { bar } = createBar();

    const slot0 = container.querySelector<HTMLElement>('.mm-lineup-slot')!;
    const clearBtn = slot0.querySelector<HTMLElement>('.mm-lineup-btn-clear');
    expect(clearBtn).not.toBeNull();

    // 点击清空唯一一辆车
    clearBtn?.click();

    // 界面显示报错
    const errEl = container.querySelector<HTMLElement>('.mm-lineup-error');
    expect(errEl?.textContent).toContain('编组不能为空');

    // 存档不变
    expect(JSON.stringify(currentProfile)).toBe(profileBefore);
    expect(currentProfile.nations.germany.lineups[0].slots[0]).toBe('tiger_i');

    bar.dispose();
  });

  it('多辆车时「×」清空成功，并自动改选出战载具', () => {
    currentProfile = recruitCrew(currentProfile, 'germany');
    currentProfile = assignVehicle(
      currentProfile,
      'germany',
      'lineup-1',
      1,
      'tiger_ii',
      profileVehicles,
    );
    // 当前 selected: 0 (tiger_i)

    const onActiveVehicle = vi.fn();
    const { bar } = createBar({ onActiveVehicle });

    const slots = container.querySelectorAll<HTMLElement>('.mm-lineup-slot');
    const clearBtn0 = slots[0].querySelector<HTMLElement>('.mm-lineup-btn-clear');

    // 清空 slot 0
    clearBtn0?.click();

    // slot 0 变为 null，selected 自动改选 slot 1 (tiger_ii)
    expect(currentProfile.nations.germany.lineups[0].slots[0]).toBeNull();
    expect(currentProfile.nations.germany.lineups[0].slots[1]).toBe('tiger_ii');
    expect(currentProfile.nations.germany.lineups[0].selected).toBe(1);
    expect(onActiveVehicle).toHaveBeenCalledWith('tiger_ii');

    bar.dispose();
  });

  it('招募到 8 个后按钮置灰，数量上限 8', () => {
    const { bar } = createBar();

    let recruitBtn = container.querySelector<HTMLButtonElement>('.mm-lineup-btn-recruit')!;
    expect(recruitBtn.textContent).toContain('招募车组 1/8');
    expect(recruitBtn.disabled).toBe(false);

    // 招募 7 次达到 8 个
    for (let i = 2; i <= CREW_SLOT_LIMIT; i++) {
      recruitBtn.click();
      recruitBtn = container.querySelector<HTMLButtonElement>('.mm-lineup-btn-recruit')!;
      expect(recruitBtn.textContent).toContain(`招募车组 ${i}/8`);
    }

    expect(currentProfile.nations.germany.crews.length).toBe(8);
    expect(recruitBtn.disabled).toBe(true);

    bar.dispose();
  });

  it('切换国家', () => {
    const onActiveVehicle = vi.fn();
    const { bar } = createBar({ onActiveVehicle });

    // 当前是德国
    expect(currentProfile.activeNation).toBe('germany');

    // 点击苏联页签
    const ussrTab = container.querySelector<HTMLElement>('.mm-lineup-nation-tab[data-nation="ussr"]')!;
    expect(ussrTab).not.toBeNull();
    ussrTab.click();

    expect(currentProfile.activeNation).toBe('ussr');
    expect(onActiveVehicle).toHaveBeenCalledWith('t34_85');

    // 重新渲染后苏联高亮且显示 T-34-85
    expect(container.querySelector('.mm-lineup-slot-name')?.textContent).toBe('T-34-85');

    bar.dispose();
  });

  it('编组管理: 新建、切换、改名、删除', () => {
    const { bar } = createBar();

    // 1. 新建编组
    const addBtn = container.querySelector<HTMLElement>('.mm-lineup-btn-add')!;
    addBtn.click();

    expect(currentProfile.nations.germany.lineups.length).toBe(2);
    expect(currentProfile.nations.germany.activeLineup).toBe('lineup-2');

    // 下拉框包含两个编组
    const select = container.querySelector<HTMLSelectElement>('.mm-lineup-select')!;
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('lineup-2');

    // 2. 切换编组
    select.value = 'lineup-1';
    select.dispatchEvent(new Event('change'));
    expect(currentProfile.nations.germany.activeLineup).toBe('lineup-1');

    // 3. 改名编组
    const renameBtn = container.querySelector<HTMLElement>('.mm-lineup-btn-rename')!;
    renameBtn.click();

    // 此时显示行内输入框
    const input = container.querySelector<HTMLInputElement>('.mm-lineup-rename-input')!;
    expect(input).not.toBeNull();
    input.value = '重装突击';

    const confirmBtn = container.querySelector<HTMLElement>('.mm-lineup-rename-confirm')!;
    confirmBtn.click();

    expect(currentProfile.nations.germany.lineups[0].name).toBe('重装突击');

    // 4. 删除编组
    // 当前有两个编组，删除当前编组
    const deleteBtn = container.querySelector<HTMLElement>('.mm-lineup-btn-delete')!;
    deleteBtn.click();

    expect(currentProfile.nations.germany.lineups.length).toBe(1);
    expect(currentProfile.nations.germany.activeLineup).toBe('lineup-2');

    // 再次点击删除，最后一个编组不能删除，应显示错误
    const deleteBtn2 = container.querySelector<HTMLElement>('.mm-lineup-btn-delete')!;
    deleteBtn2.click();

    const errEl = container.querySelector<HTMLElement>('.mm-lineup-error')!;
    expect(errEl.textContent).toContain('最后一个编组不能删除');
    expect(currentProfile.nations.germany.lineups.length).toBe(1);

    bar.dispose();
  });
});

describe('MainMenu 与 LineupBar / TechTree 集成', () => {
  let menuContainer: HTMLElement;
  let currentProfile: Profile;

  beforeEach(() => {
    menuContainer = document.createElement('div');
    document.body.appendChild(menuContainer);
    currentProfile = defaultProfile(profileVehicles, 1000);
    return () => {
      menuContainer.remove();
    };
  });

  const dummySettings = {
    get: vi.fn(),
    set: vi.fn(),
  } as unknown as any;

  const dummySettingsPanel = {
    open: vi.fn(),
  } as unknown as any;

  const dummyMaps = [
    {
      id: 'poland',
      name: '波兰',
      size: 2000,
      heightmap: { resolution: 10, heights: [], heightScale: 1 },
      features: [],
      spawns: { north: [], south: [] },
      captureZones: [],
    },
  ] as unknown as any;

  it('不传 profile 时保持原载具栏行为', () => {
    const onVehicleChange = vi.fn();
    const menu = new MainMenu({
      parent: menuContainer,
      settings: dummySettings,
      settingsPanel: dummySettingsPanel,
      vehicles: vehicleList,
      maps: dummyMaps,
      initial: { vehicleId: 'tiger_i', mapId: 'poland' },
      loadLoadout: () => ({ pzgr39: 20 }),
      saveLoadout: vi.fn(),
      onVehicleChange,
      onStart: vi.fn(),
    });

    // 应该渲染旧的 .mm-slots，不应该有 .mm-lineup-bar
    expect(menuContainer.querySelector('.mm-slots')).not.toBeNull();
    expect(menuContainer.querySelector('.mm-lineup-bar')).toBeNull();

    // 点击其他车辆卡片正常切换
    const cards = menuContainer.querySelectorAll<HTMLElement>('.mm-slot');
    expect(cards.length).toBe(vehicleList.length);
    cards[1].click();

    expect(onVehicleChange).toHaveBeenCalledWith(vehicleList[1]);
    expect(menu.visible).toBe(false);
  });

  it('传入 profile 时使用编组栏替代旧载具栏，并打通科技树分车流程', () => {
    // 增加一个车位给德国
    currentProfile = recruitCrew(currentProfile, 'germany');

    const onVehicleChange = vi.fn();
    const menu = new MainMenu({
      parent: menuContainer,
      settings: dummySettings,
      settingsPanel: dummySettingsPanel,
      vehicles: vehicleList,
      maps: dummyMaps,
      initial: { vehicleId: 'tiger_i', mapId: 'poland' },
      loadLoadout: () => ({ pzgr39: 20 }),
      saveLoadout: vi.fn(),
      onVehicleChange,
      onStart: vi.fn(),
      profile: {
        get: () => currentProfile,
        set: (p) => {
          currentProfile = p;
        },
      },
    });

    // 应该有 .mm-lineup-bar，没有旧的 .mm-slots
    expect(menuContainer.querySelector('.mm-lineup-bar')).not.toBeNull();
    expect(menuContainer.querySelector('.mm-slots')).toBeNull();

    // 点击第二个空格子的「+」，应打开科技树
    const slots = menuContainer.querySelectorAll<HTMLElement>('.mm-lineup-slot');
    expect(slots.length).toBe(2);
    const emptySlot = slots[1];
    emptySlot.click();

    // 科技树全屏弹出层出现
    const ttRoot = menuContainer.querySelector<HTMLElement>('.tt-root');
    expect(ttRoot).not.toBeNull();

    // 科技树中只含有德国的车辆 (tiger_i, tiger_ii)
    const ttCards = ttRoot?.querySelectorAll<HTMLElement>('.tt-vehicle-card');
    expect(ttCards?.length).toBe(2);
    expect(ttRoot?.querySelector('[data-vehicle-id="tiger_i"]')).not.toBeNull();
    expect(ttRoot?.querySelector('[data-vehicle-id="tiger_ii"]')).not.toBeNull();
    // 不应有其他国家载具
    expect(ttRoot?.querySelector('[data-vehicle-id="t34_85"]')).toBeNull();

    // 已在编组里的 tiger_i 应该被打上 tt-in-lineup 标记
    const tigerCard = ttRoot?.querySelector<HTMLElement>('[data-vehicle-id="tiger_i"]');
    expect(tigerCard?.classList.contains('tt-in-lineup')).toBe(true);

    // 在科技树中点击 tiger_ii，将 tiger_ii 分给 slot 1
    const tiger2Card = ttRoot?.querySelector<HTMLElement>('[data-vehicle-id="tiger_ii"]')!;
    tiger2Card.click();

    // 科技树应当关闭
    expect(menuContainer.querySelector('.tt-root')).toBeNull();

    // 存档中 slot 1 已被赋予 tiger_ii
    expect(currentProfile.nations.germany.lineups[0].slots[1]).toBe('tiger_ii');

    // 编组栏刷新，slot 1 呈现虎王
    const updatedSlots = menuContainer.querySelectorAll<HTMLElement>('.mm-lineup-slot');
    expect(updatedSlots[1].textContent).toContain('虎王');

    expect(menu.visible).toBe(false);
  });
});
