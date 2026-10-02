import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLES } from '../src/data/vehicles';
import {
  defaultProfile,
  recruitCrew,
  assignVehicle,
  type Profile,
} from '../src/settings/Profile';
import { LineupBar, contextMenuPosition } from '../src/ui/menu/LineupBar';

const vehicleList = Object.values(VEHICLES);
const profileVehicles = vehicleList.map((v) => ({
  id: v.id,
  nation: v.nation ?? '',
  family: v.family ?? v.id,
}));

describe('contextMenuPosition 纯函数测试', () => {
  const rootRect = { width: 800, height: 600, left: 0, top: 0 };
  const menuW = 140;
  const menuH = 190;

  it('鼠标在左上方不越界: 放在鼠标右下方', () => {
    const pos = contextMenuPosition(100, 100, menuW, menuH, rootRect);
    expect(pos).toEqual({ left: 100, top: 100 });
  });

  it('右侧越界: 翻到鼠标左侧', () => {
    const pos = contextMenuPosition(750, 100, menuW, menuH, rootRect);
    expect(pos.left).toBe(750 - menuW); // 610
    expect(pos.top).toBe(100);
  });

  it('下侧越界: 翻到鼠标上方', () => {
    const pos = contextMenuPosition(100, 500, menuW, menuH, rootRect);
    expect(pos.left).toBe(100);
    expect(pos.top).toBe(500 - menuH); // 310
  });

  it('右侧和下侧同时越界: 翻到鼠标左上方', () => {
    const pos = contextMenuPosition(750, 500, menuW, menuH, rootRect);
    expect(pos).toEqual({
      left: 750 - menuW,
      top: 500 - menuH,
    });
  });

  it('翻转后超出左上边界: 限制在根元素内 (不小于 0)', () => {
    // 容器很小，越界翻转后产生负坐标
    const smallRoot = { width: 100, height: 100 };
    const pos = contextMenuPosition(50, 50, menuW, menuH, smallRoot);
    expect(pos.left).toBe(0);
    expect(pos.top).toBe(0);
  });

  it('根元素尺寸为 0 时安全降级且不产生负数', () => {
    const zeroRoot = { width: 0, height: 0 };
    const pos = contextMenuPosition(50, 60, menuW, menuH, zeroRoot);
    expect(pos.left).toBe(50);
    expect(pos.top).toBe(60);
  });
});

describe('LineupBar 右键菜单完整交互与回调测试', () => {
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

  function createTestBar(opts?: {
    onOpenModifications?: (vehicleId: string, crewIndex: number) => void;
    onOpenCustomization?: (vehicleId: string, crewIndex: number) => void;
    onTestDrive?: (vehicleId: string, crewIndex: number) => void;
    onOpenCrew?: (nation: string, crewIndex: number) => void;
    onPickVehicle?: (nation: string, crewIndex: number) => void;
    onActiveVehicle?: (id: string) => void;
  }) {
    const onPickVehicle = opts?.onPickVehicle ?? vi.fn();
    const onActiveVehicle = opts?.onActiveVehicle ?? vi.fn();
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
      onOpenModifications: opts?.onOpenModifications,
      onOpenCustomization: opts?.onOpenCustomization,
      onTestDrive: opts?.onTestDrive,
      onOpenCrew: opts?.onOpenCrew,
    });

    return {
      bar,
      onPickVehicle,
      onActiveVehicle,
      onUiSound,
    };
  }

  it('菜单项顺序严格从上到下为: 换车 (+)、改装、涂装、试驾、乘员、清空, 且每项带内联 SVG, 不包含载具信息', () => {
    const onOpenModifications = vi.fn();
    const onOpenCustomization = vi.fn();
    const onTestDrive = vi.fn();
    const onOpenCrew = vi.fn();
    const { bar } = createTestBar({
      onOpenModifications,
      onOpenCustomization,
      onTestDrive,
      onOpenCrew,
    });

    const slot0 = container.querySelector<HTMLElement>('.mm-lineup-slot')!;
    slot0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    const menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu');
    expect(menu).not.toBeNull();

    const buttons = menu!.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons.length).toBe(6);

    // 顺序与文字检查
    expect(buttons[0].textContent).toContain('换车');
    expect(buttons[0].textContent).toContain('(+)');
    expect(buttons[1].textContent).toContain('改装');
    expect(buttons[2].textContent).toContain('涂装');
    expect(buttons[3].textContent).toContain('试驾');
    expect(buttons[4].textContent).toContain('乘员');
    expect(buttons[5].textContent).toContain('清空');

    // 每项包含内联 SVG
    buttons.forEach((btn) => {
      const svg = btn.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.classList.contains('mm-lineup-menu-icon')).toBe(true);
    });

    // 分隔线存在且在乘员和清空之间
    const sep = menu!.querySelector('.mm-lineup-menu-sep');
    expect(sep).not.toBeNull();
    expect(buttons[4].nextElementSibling).toBe(sep);
    expect(sep!.nextElementSibling).toBe(buttons[5]);

    // 不包含旧项「载具信息」
    expect(menu!.querySelector('.mm-lineup-menu-info')).toBeNull();

    bar.dispose();
  });

  it('传入回调时点击各个菜单项: 先关菜单、播放音效、再调用对应回调并传递正确参数', () => {
    const onOpenModifications = vi.fn();
    const onOpenCustomization = vi.fn();
    const onTestDrive = vi.fn();
    const onOpenCrew = vi.fn();
    const onPickVehicle = vi.fn();

    const { bar, onUiSound } = createTestBar({
      onOpenModifications,
      onOpenCustomization,
      onTestDrive,
      onOpenCrew,
      onPickVehicle,
    });

    const slot0 = container.querySelector<HTMLElement>('.mm-lineup-slot')!;

    // 1. 点击「换车 (+)」
    slot0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    let menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu')!;
    const changeBtn = menu.querySelector<HTMLButtonElement>('.mm-lineup-menu-change')!;
    changeBtn.click();
    expect(onUiSound).toHaveBeenCalledTimes(1);
    expect(onPickVehicle).toHaveBeenCalledWith('germany', 0);
    expect(container.querySelector('.mm-lineup-context-menu')).toBeNull();

    // 2. 点击「改装」
    slot0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu')!;
    const modsBtn = menu.querySelector<HTMLButtonElement>('.mm-lineup-menu-mods')!;
    modsBtn.click();
    expect(onUiSound).toHaveBeenCalledTimes(2);
    expect(onOpenModifications).toHaveBeenCalledWith('tiger_i', 0);
    expect(container.querySelector('.mm-lineup-context-menu')).toBeNull();

    // 3. 点击「涂装」
    slot0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu')!;
    const customBtn = menu.querySelector<HTMLButtonElement>('.mm-lineup-menu-custom')!;
    customBtn.click();
    expect(onUiSound).toHaveBeenCalledTimes(3);
    expect(onOpenCustomization).toHaveBeenCalledWith('tiger_i', 0);
    expect(container.querySelector('.mm-lineup-context-menu')).toBeNull();

    // 4. 点击「试驾」
    slot0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu')!;
    const testDriveBtn = menu.querySelector<HTMLButtonElement>('.mm-lineup-menu-testdrive')!;
    testDriveBtn.click();
    expect(onUiSound).toHaveBeenCalledTimes(4);
    expect(onTestDrive).toHaveBeenCalledWith('tiger_i', 0);
    expect(container.querySelector('.mm-lineup-context-menu')).toBeNull();

    // 5. 点击「乘员」
    slot0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu')!;
    const crewBtn = menu.querySelector<HTMLButtonElement>('.mm-lineup-menu-crew')!;
    crewBtn.click();
    expect(onUiSound).toHaveBeenCalledTimes(5);
    expect(onOpenCrew).toHaveBeenCalledWith('germany', 0);
    expect(container.querySelector('.mm-lineup-context-menu')).toBeNull();

    bar.dispose();
  });

  it('未传回调时, 对应菜单项置灰不可点, title 提示「暂未开放」, 点击无响应', () => {
    // 都不传可选回调
    const { bar, onUiSound } = createTestBar();

    const slot0 = container.querySelector<HTMLElement>('.mm-lineup-slot')!;
    slot0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    const menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu')!;
    const modsBtn = menu.querySelector<HTMLButtonElement>('.mm-lineup-menu-mods')!;
    const customBtn = menu.querySelector<HTMLButtonElement>('.mm-lineup-menu-custom')!;
    const testDriveBtn = menu.querySelector<HTMLButtonElement>('.mm-lineup-menu-testdrive')!;
    const crewBtn = menu.querySelector<HTMLButtonElement>('.mm-lineup-menu-crew')!;

    for (const btn of [modsBtn, customBtn, testDriveBtn, crewBtn]) {
      expect(btn.disabled).toBe(true);
      expect(btn.classList.contains('disabled')).toBe(true);
      expect(btn.title).toBe('暂未开放');

      // 点击置灰项不触发音效也不关闭菜单
      btn.click();
      expect(onUiSound).not.toHaveBeenCalled();
      expect(container.querySelector('.mm-lineup-context-menu')).not.toBeNull();
    }

    bar.dispose();
  });

  it('乘员行黄色感叹号: progress 为 0 时显示新手提示, progress > 0 时不显示', () => {
    // 1. 默认初级车组 progress 为 0
    expect(currentProfile.nations.germany.crews[0].progress).toBe(0);

    const { bar: bar1 } = createTestBar();
    const slot0 = container.querySelector<HTMLElement>('.mm-lineup-slot')!;
    slot0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    let menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu')!;
    let alertEl = menu.querySelector<HTMLElement>('.mm-lineup-menu-alert');
    expect(alertEl).not.toBeNull();
    expect(alertEl?.textContent).toBe('!');
    expect(alertEl?.getAttribute('title')).toBe('新手车组:挂机成长或在线游玩后会提升');
    bar1.dispose();

    // 2. 将车组 progress 改为 0.25 (成长过)
    currentProfile = {
      ...currentProfile,
      nations: {
        ...currentProfile.nations,
        germany: {
          ...currentProfile.nations.germany,
          crews: currentProfile.nations.germany.crews.map((c, i) =>
            i === 0 ? { ...c, progress: 0.25 } : c,
          ),
        },
      },
    };

    const { bar: bar2 } = createTestBar();
    const updatedSlot0 = container.querySelector<HTMLElement>('.mm-lineup-slot')!;
    updatedSlot0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu')!;
    alertEl = menu.querySelector<HTMLElement>('.mm-lineup-menu-alert');
    expect(alertEl).toBeNull();
    bar2.dispose();
  });

  it('清空行为: 唯有一辆车不可清空, 多车时可清空并改选有效载具', () => {
    const onActiveVehicle = vi.fn();
    // 招募第二个车组并分车
    currentProfile = recruitCrew(currentProfile, 'germany');
    currentProfile = assignVehicle(
      currentProfile,
      'germany',
      'lineup-1',
      1,
      'tiger_ii',
      profileVehicles,
    );

    const { bar } = createTestBar({ onActiveVehicle });
    const slots = container.querySelectorAll<HTMLElement>('.mm-lineup-slot');

    // 打开 slot 0 菜单并点击清空
    const menuBtn = slots[0].querySelector<HTMLElement>('.mm-lineup-slot-menu-btn')!;
    menuBtn.click();

    const menu = container.querySelector<HTMLElement>('.mm-lineup-context-menu')!;
    const clearBtn = menu.querySelector<HTMLElement>('.mm-lineup-menu-clear')!;
    clearBtn.click();

    // 菜单关闭，slot 0 变为空，自动选中 slot 1
    expect(container.querySelector('.mm-lineup-context-menu')).toBeNull();
    expect(currentProfile.nations.germany.lineups[0].slots[0]).toBeNull();
    expect(currentProfile.nations.germany.lineups[0].selected).toBe(1);
    expect(onActiveVehicle).toHaveBeenCalledWith('tiger_ii');

    bar.dispose();
  });
});
