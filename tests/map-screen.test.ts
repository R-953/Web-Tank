import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameMap } from '../src/game/Map';
import type { Loadout, VehicleSpec } from '../src/data/types';
import { VEHICLES } from '../src/data/vehicles';
import {
  defaultProfile,
  recruitCrew,
  assignVehicle,
  type Profile,
  type ProfileVehicle,
} from '../src/settings/Profile';
import { MapScreen, type MapScreenOptions } from '../src/ui/MapScreen';
import { AmmoPanel } from '../src/ui/menu/AmmoPanel';
import { renderMapBackground } from '../src/ui/Minimap';

const vehicleList = Object.values(VEHICLES);
const profileVehicles: ProfileVehicle[] = vehicleList.map((v) => ({
  id: v.id,
  nation: v.nation ?? '',
  family: v.family ?? v.id,
}));

function createMockMap(size = 3000, name = '波兰'): GameMap {
  const resolution = 4;
  return {
    spec: {
      id: 'poland',
      name,
      size,
      waterLevel: 0,
    },
    grid: {
      resolution,
      cellSize: size / (resolution - 1),
      heights: new Float32Array(resolution * resolution),
      surfaces: new Uint8Array(resolution * resolution),
    },
  } as unknown as GameMap;
}

describe('AmmoPanel 携弹组件', () => {
  let container: HTMLElement;
  const tiger = VEHICLES.tiger_i;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  });

  it('正确渲染携弹表格与合计，修改数量触发 onChange', () => {
    const onChange = vi.fn();
    const onUiSound = vi.fn();
    const panel = new AmmoPanel(container, { onChange, onUiSound });

    panel.setVehicle(tiger, { pzgr39: 20 });
    expect(panel.root.textContent).toContain('携弹');
    expect(panel.root.textContent).toContain('合计 20 / 92 发');

    // 查找加号按钮
    const plusBtns = panel.root.querySelectorAll<HTMLButtonElement>('button.mm-btn.small');
    expect(plusBtns.length).toBeGreaterThanOrEqual(2); // 每个弹种有一对加减
    // 第二个按钮是第一种弹的 + 按钮
    const firstPlus = plusBtns[1];
    firstPlus.click();

    expect(onUiSound).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(tiger, expect.objectContaining({ pzgr39: 25 }));
  });

  it('数量为 0 时减号禁用', () => {
    const onChange = vi.fn();
    const panel = new AmmoPanel(container, { onChange });
    panel.setVehicle(tiger, { pzgr39: 0 });

    const btns = panel.root.querySelectorAll<HTMLButtonElement>('button.mm-btn.small');
    const firstMinus = btns[0];
    expect(firstMinus.disabled).toBe(true);
  });
});

describe('MapScreen 地图界面组件', () => {
  let container: HTMLElement;
  let currentProfile: Profile;
  let loadoutStore: Record<string, Loadout>;
  let mockMap: GameMap;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    currentProfile = defaultProfile(profileVehicles, 1000);
    loadoutStore = {
      tiger_i: { pzgr39: 20 },
      tiger_ii: { pzgr39_43: 15 },
    };
    mockMap = createMockMap(3000, '波兰');
    return () => {
      container.remove();
    };
  });

  function createScreen(customOpts?: Partial<MapScreenOptions>) {
    const onSymbologyChange = vi.fn();
    const onConfirm = vi.fn();
    const onUiSound = vi.fn();
    const saveLoadout = vi.fn((spec: VehicleSpec, l: Loadout) => {
      loadoutStore[spec.id] = l;
    });

    const screen = new MapScreen({
      parent: container,
      vehicles: vehicleList,
      getProfile: () => currentProfile,
      loadLoadout: (spec) => loadoutStore[spec.id] ?? {},
      saveLoadout,
      symbology: 'nato',
      onSymbologyChange,
      onConfirm,
      onUiSound,
      ...customOpts,
    });

    return { screen, onSymbologyChange, onConfirm, onUiSound, saveLoadout };
  }

  it('open 后可见，close 后隐藏，isOpen 状态正确', () => {
    const { screen } = createScreen();
    expect(screen.isOpen).toBe(false);
    expect(screen.root.classList.contains('hidden')).toBe(true);

    screen.open(mockMap, 'spawn');
    expect(screen.isOpen).toBe(true);
    expect(screen.root.classList.contains('hidden')).toBe(false);

    screen.close();
    expect(screen.isOpen).toBe(false);
    expect(screen.root.classList.contains('hidden')).toBe(true);
  });

  it('顶部卡片数 = 编组车组数且高亮当前车组', () => {
    // 招募到 3 个车位，并分配车辆
    currentProfile = recruitCrew(currentProfile, 'germany');
    currentProfile = recruitCrew(currentProfile, 'germany');
    currentProfile = assignVehicle(
      currentProfile,
      'germany',
      'lineup-1',
      1,
      'tiger_ii',
      profileVehicles,
    );

    const { screen } = createScreen();
    screen.open(mockMap, 'spawn');

    const cards = screen.root.querySelectorAll<HTMLElement>('.ms-card');
    expect(cards.length).toBe(3);

    // 默认德国第一个车组 selected = 0，高亮
    expect(cards[0].classList.contains('sel')).toBe(true);
    expect(cards[0].classList.contains('active')).toBe(true);
    expect(cards[0].textContent).toContain('虎式');

    // 第二个分配了虎王
    expect(cards[1].classList.contains('sel')).toBe(false);
    expect(cards[1].textContent).toContain('虎王');

    // 第三个未分车
    expect(cards[2].textContent).toContain('未分车');
  });

  it('左侧携弹面板改数量后调用 saveLoadout', () => {
    const { screen, saveLoadout } = createScreen();
    screen.open(mockMap, 'spawn');

    const plusBtns = screen.root.querySelectorAll<HTMLButtonElement>('.ms-left button.mm-btn.small');
    expect(plusBtns.length).toBeGreaterThanOrEqual(2);
    plusBtns[1].click();

    expect(saveLoadout).toHaveBeenCalled();
    expect(loadoutStore['tiger_i'].pzgr39).toBe(25);
  });

  it('spawn / battle 两种模式按钮文字正确并触发 onConfirm', () => {
    const { screen, onConfirm, onUiSound } = createScreen();

    // 1. spawn 模式 ->「出战」
    screen.open(mockMap, 'spawn');
    const confirmBtn = screen.root.querySelector<HTMLButtonElement>('.ms-confirm-btn')!;
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn.textContent).toBe('出战');

    confirmBtn.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onUiSound).toHaveBeenCalledTimes(1);

    // 2. battle 模式 ->「返回战斗」
    screen.open(mockMap, 'battle');
    expect(confirmBtn.textContent).toBe('返回战斗');

    confirmBtn.click();
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onUiSound).toHaveBeenCalledTimes(2);
  });

  it('符号下拉框触发 onSymbologyChange', () => {
    const { screen, onSymbologyChange } = createScreen();
    screen.open(mockMap, 'spawn');

    const select = screen.root.querySelector<HTMLSelectElement>('.ms-symbology-select')!;
    expect(select).not.toBeNull();
    expect(select.value).toBe('nato');

    select.value = 'warsaw';
    select.dispatchEvent(new Event('change'));

    expect(onSymbologyChange).toHaveBeenCalledWith('warsaw');
  });

  it('jsdom 里 canvas 没有 2D 上下文时不报错(跳过绘制)', () => {
    const { screen } = createScreen();
    screen.open(mockMap, 'spawn');

    // 在没有 2D 上下文的环境中调用 draw 不应抛出任何错误
    expect(() => {
      screen.draw({
        player: { x: 0, z: 1200, heading: 0 },
        markers: [
          { x: 100, z: 200, team: 'enemy', dead: false },
          { x: -300, z: 500, team: 'ally', dead: true },
        ],
      });
    }).not.toThrow();

    // renderMapBackground 也不应抛错
    expect(() => {
      const bg = renderMapBackground(mockMap, 240);
      expect(bg).toBeDefined();
    }).not.toThrow();
  });

  it('当提供 2D 上下文时支持 drawMarker 自定义绘制', () => {
    const { screen } = createScreen();
    screen.open(mockMap, 'spawn');

    const canvas = screen.root.querySelector<HTMLCanvasElement>('.ms-canvas')!;
    const mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);

    const drawMarker = vi.fn();
    const marker = { x: 0, z: 0, team: 'enemy' as const, dead: false };

    screen.draw({
      player: { x: 0, z: 0, heading: 0 },
      markers: [marker],
      drawMarker,
    });

    expect(drawMarker).toHaveBeenCalledWith(mockCtx, marker, expect.any(Number), expect.any(Number));
  });

  it('点击顶部其他载具卡片切换携弹面板所选载具', () => {
    currentProfile = recruitCrew(currentProfile, 'germany');
    currentProfile = assignVehicle(
      currentProfile,
      'germany',
      'lineup-1',
      1,
      'tiger_ii',
      profileVehicles,
    );

    const { screen, saveLoadout } = createScreen();
    screen.open(mockMap, 'spawn');

    const cards = screen.root.querySelectorAll<HTMLElement>('.ms-card');
    expect(cards.length).toBe(2);

    // 点击第二个卡片(虎王)
    cards[1].click();

    expect(cards[1].classList.contains('sel')).toBe(true);
    expect(cards[0].classList.contains('sel')).toBe(false);

    // 修改携弹应当是虎王
    const plusBtns = screen.root.querySelectorAll<HTMLButtonElement>('.ms-left button.mm-btn.small');
    plusBtns[1].click();

    expect(saveLoadout).toHaveBeenCalledWith(VEHICLES.tiger_ii, expect.any(Object));
  });

  it('dispose 后根节点从 DOM 移除', () => {
    const { screen } = createScreen();
    expect(container.contains(screen.root)).toBe(true);
    screen.dispose();
    expect(container.contains(screen.root)).toBe(false);
  });
});
