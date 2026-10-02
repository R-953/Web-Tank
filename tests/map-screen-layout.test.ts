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
import {
  MapScreen,
  zoomMapView,
  panMapView,
  MAP_ZOOM_MAX,
  type MapView,
  type MapScreenOptions,
} from '../src/ui/MapScreen';
import * as ThumbnailsModule from '../src/ui/menu/thumbnails';
import * as SymbolsModule from '../src/ui/symbols';

const vehicleList = Object.values(VEHICLES);
const profileVehicles: ProfileVehicle[] = vehicleList.map((v) => ({
  id: v.id,
  nation: v.nation ?? '',
  family: v.family ?? v.id,
}));

function createMockMap(size = 3000, name = '波兰', aiPreset?: string): GameMap {
  const resolution = 4;
  return {
    spec: {
      id: 'poland',
      name,
      size,
      waterLevel: 0,
      aiPreset,
      spawns: {
        player: { vehicleId: 'tiger_i', position: [100, 200], heading: 0 },
        targets: [],
      },
    },
    grid: {
      resolution,
      cellSize: size / (resolution - 1),
      heights: new Float32Array(resolution * resolution),
      surfaces: new Uint8Array(resolution * resolution),
    },
  } as unknown as GameMap;
}

function createMockContext() {
  return {
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
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('zoomMapView & panMapView 纯函数 (048-map-screen-wt-layout)', () => {
  const mapSize = 2000;

  it('zoomMapView 限制在 [1, MAP_ZOOM_MAX]', () => {
    const initial: MapView = { zoom: 1, cx: 0, cz: 0 };
    // 缩小不可小于 1
    const zoomedOut = zoomMapView(initial, mapSize, 0.5, { u: 0.5, v: 0.5 });
    expect(zoomedOut.zoom).toBe(1);

    // 放大倍数夹在上限
    const zoomedMax = zoomMapView(initial, mapSize, 100, { u: 0.5, v: 0.5 });
    expect(zoomedMax.zoom).toBe(MAP_ZOOM_MAX);
  });

  it('zoomMapView 锚点不动: 未触碰边界时锚点世界坐标保持不变', () => {
    const v: MapView = { zoom: 2, cx: 100, cz: -100 };
    const anchor = { u: 0.7, v: 0.3 };

    // 计算缩放前锚点的世界坐标
    const oldViewSize = mapSize / v.zoom;
    const wxBefore = v.cx + (anchor.u - 0.5) * oldViewSize;
    const wzBefore = v.cz + (anchor.v - 0.5) * oldViewSize;

    const next = zoomMapView(v, mapSize, 1.5, anchor);

    // 计算缩放后锚点的世界坐标
    const newViewSize = mapSize / next.zoom;
    const wxAfter = next.cx + (anchor.u - 0.5) * newViewSize;
    const wzAfter = next.cz + (anchor.v - 0.5) * newViewSize;

    expect(wxAfter).toBeCloseTo(wxBefore, 5);
    expect(wzAfter).toBeCloseTo(wzBefore, 5);
  });

  it('zoomMapView 边界夹取: 缩放中心不会超出视口允许范围', () => {
    const v: MapView = { zoom: 2, cx: 0, cz: 0 };
    // 靠近右下角极值缩放
    const next = zoomMapView(v, mapSize, 2, { u: 1.0, v: 1.0 });
    const lim = (mapSize / 2) * (1 - 1 / next.zoom);
    expect(next.cx).toBeLessThanOrEqual(lim + 1e-6);
    expect(next.cz).toBeLessThanOrEqual(lim + 1e-6);
    expect(next.cx).toBeGreaterThanOrEqual(-lim - 1e-6);
    expect(next.cz).toBeGreaterThanOrEqual(-lim - 1e-6);
  });

  it('panMapView 按画面比例平移且受边界夹取保护', () => {
    const v: MapView = { zoom: 2, cx: 0, cz: 0 };
    const viewSize = mapSize / v.zoom; // 1000m
    const lim = (mapSize / 2) * (1 - 1 / v.zoom); // 500m

    // 正常平移 du = 0.1 (向右 100m)
    const p1 = panMapView(v, mapSize, 0.1, -0.2);
    expect(p1.cx).toBeCloseTo(0.1 * viewSize, 5);
    expect(p1.cz).toBeCloseTo(-0.2 * viewSize, 5);
    expect(p1.zoom).toBe(2);

    // 极大平移超出边界会被 clamp
    const pFar = panMapView(v, mapSize, 2.0, 3.0);
    expect(pFar.cx).toBeCloseTo(lim, 5);
    expect(pFar.cz).toBeCloseTo(lim, 5);

    // zoom = 1 时中心始终为 0
    const pZoom1 = panMapView({ zoom: 1, cx: 0, cz: 0 }, mapSize, 0.5, 0.5);
    expect(pZoom1.cx).toBe(0);
    expect(pZoom1.cz).toBe(0);
  });
});

describe('MapScreen WT 布局与交互 (048-map-screen-wt-layout)', () => {
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
    mockMap = createMockMap(3000, '波兰', 'training');
    return () => {
      container.remove();
    };
  });

  function createScreen(customOpts?: Partial<MapScreenOptions>) {
    const onSymbologyChange = vi.fn();
    const onConfirm = vi.fn();
    const onUiSound = vi.fn();
    const onSelectCrew = vi.fn();
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
      onSelectCrew,
      ...customOpts,
    });

    return { screen, onSymbologyChange, onConfirm, onUiSound, onSelectCrew, saveLoadout };
  }

  it('顶部正中与右下角两个确认按钮都触发 onConfirm', () => {
    const { screen, onConfirm, onUiSound } = createScreen();
    screen.open(mockMap, 'spawn');

    const confirmBtns = screen.root.querySelectorAll<HTMLButtonElement>('.ms-confirm-btn');
    expect(confirmBtns.length).toBe(2);

    // 顶部正中按钮
    expect(confirmBtns[0].textContent).toBe('出战');
    confirmBtns[0].click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onUiSound).toHaveBeenCalledTimes(1);

    // 右下角按钮
    expect(confirmBtns[1].textContent).toBe('出战');
    confirmBtns[1].click();
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onUiSound).toHaveBeenCalledTimes(2);

    // battle 模式下两者文本变为「返回战斗」
    screen.open(mockMap, 'battle');
    expect(confirmBtns[0].textContent).toBe('返回战斗');
    expect(confirmBtns[1].textContent).toBe('返回战斗');
  });

  it('顶栏卡片有缩略图时渲染 <img>，没有时退回类型符号', () => {
    const thumbSpy = vi.spyOn(ThumbnailsModule, 'vehicleThumbnail').mockImplementation((spec) => {
      if (spec.id === 'tiger_i') return 'data:image/png;base64,mockThumbnailData';
      return null;
    });

    currentProfile = recruitCrew(currentProfile, 'germany');
    currentProfile = assignVehicle(currentProfile, 'germany', 'lineup-1', 1, 'tiger_ii', profileVehicles);

    const { screen } = createScreen();
    screen.open(mockMap, 'spawn');

    const cards = screen.root.querySelectorAll<HTMLElement>('.ms-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);

    // 第 1 张卡片 (tiger_i): 有缩略图 -> 包含 img.ms-card-thumb
    const img0 = cards[0].querySelector<HTMLImageElement>('img.ms-card-thumb');
    expect(img0).not.toBeNull();
    expect(img0?.src).toBe('data:image/png;base64,mockThumbnailData');
    expect(cards[0].querySelector('.ms-card-thumb-fallback')).toBeNull();

    // 第 2 张卡片 (tiger_ii): 无缩略图 -> 包含 .ms-card-thumb-fallback
    const img1 = cards[1].querySelector<HTMLImageElement>('img.ms-card-thumb');
    expect(img1).toBeNull();
    const fallback1 = cards[1].querySelector<HTMLElement>('.ms-card-thumb-fallback');
    expect(fallback1).not.toBeNull();
    expect(fallback1?.querySelector('svg')).not.toBeNull();

    thumbSpy.mockRestore();
  });

  it('左上角显示地图名与边长，以及模式信息', () => {
    const { screen } = createScreen();

    // 1. aiPreset = training
    screen.open(mockMap, 'spawn');
    const titleEl = screen.root.querySelector<HTMLElement>('.ms-header-title');
    const modeEl = screen.root.querySelector<HTMLElement>('.ms-header-mode');
    expect(titleEl?.textContent).toContain('波兰 · 3 km');
    expect(modeEl?.textContent).toBe('模式:训练');
    expect(modeEl?.style.display).not.toBe('none');

    // 2. aiPreset = guard
    const guardMap = createMockMap(1500, '西奈', 'guard');
    screen.open(guardMap, 'spawn');
    expect(titleEl?.textContent).toContain('西奈 · 1.5 km');
    expect(modeEl?.textContent).toBe('模式:守卫');

    // 3. 无 aiPreset -> 模式隐藏
    const noPresetMap = createMockMap(800, '城镇', undefined);
    screen.open(noPresetMap, 'spawn');
    expect(titleEl?.textContent).toContain('城镇 · 800 m');
    expect(modeEl?.style.display).toBe('none');
  });

  it('左列正确显示主炮标题、携弹面板与任务目标 objective', () => {
    const { screen } = createScreen();
    screen.open(mockMap, 'spawn');

    // 主炮标题: 虎式为 88 mm KwK36
    const gunTitle = screen.root.querySelector<HTMLElement>('.ms-gun-title');
    expect(gunTitle?.textContent).toContain('主炮 · 88 mm');

    // 任务目标缺省文本
    const objectiveEl = screen.root.querySelector<HTMLElement>('.ms-objective-text');
    expect(objectiveEl?.textContent).toBe('摧毁全部靶车');

    // 传入自定义 objective
    screen.draw({
      markers: [],
      objective: '占领并守卫据点 A',
    });
    expect(objectiveEl?.textContent).toBe('占领并守卫据点 A');
  });

  it('spawn 模式在玩家出生点画黄色四角括号加军标，battle 模式不画出生点括号', () => {
    const { screen } = createScreen();
    const canvas = screen.root.querySelector<HTMLCanvasElement>('.ms-canvas')!;
    const mockCtx = createMockContext();
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);
    const drawSymbolSpy = vi.spyOn(SymbolsModule, 'drawSymbol').mockImplementation(() => {});

    // 1. spawn 模式
    screen.open(mockMap, 'spawn');
    screen.draw({ markers: [] });

    // spawn 模式下绘制四角括号调用了 stroke
    expect(mockCtx.stroke).toHaveBeenCalled();
    // 括号内绘制了友方军标
    expect(drawSymbolSpy).toHaveBeenCalledWith(
      mockCtx,
      expect.any(String),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ affiliation: 'friend', dead: false, size: 18 }),
    );

    // 2. battle 模式
    drawSymbolSpy.mockClear();
    screen.open(mockMap, 'battle');
    screen.draw({ markers: [] });
    // battle 模式且无 markers 时不调用 drawSymbol
    expect(drawSymbolSpy).not.toHaveBeenCalled();

    drawSymbolSpy.mockRestore();
  });

  it('地图滚轮缩放与复位按钮交互正常', () => {
    const { screen } = createScreen();
    screen.open(mockMap, 'spawn');

    const canvas = screen.root.querySelector<HTMLCanvasElement>('.ms-canvas')!;
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 500, height: 500 }),
    });

    // 向上滚动 (放大)
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 250, clientY: 250 }));
    // 缩放后触发了重绘
    expect(screen.isOpen).toBe(true);

    // 点击复位按钮
    const resetBtn = screen.root.querySelector<HTMLButtonElement>('.ms-reset-btn')!;
    expect(resetBtn).not.toBeNull();
    resetBtn.click();
  });

  it('jsdom 无 2D 上下文时 open 与 draw 正常运行不报错', () => {
    const { screen } = createScreen();
    expect(() => {
      screen.open(mockMap, 'spawn');
      screen.draw({
        markers: [{ x: 50, z: 50, team: 'enemy', dead: false }],
        objective: '测试目标',
      });
      screen.open(mockMap, 'battle');
      screen.draw({
        player: { x: 0, z: 0, heading: 0 },
        markers: [],
      });
    }).not.toThrow();
  });
});
