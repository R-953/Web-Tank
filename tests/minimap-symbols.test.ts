import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VehicleSpec, Loadout } from '../src/data/types';
import { VEHICLES } from '../src/data/vehicles';
import { RIVER_VALLEY } from '../src/data/maps';
import { defaultProfile, recruitCrew, assignVehicle, type Profile, type ProfileVehicle } from '../src/settings/Profile';
import { defaultSettings, sanitize } from '../src/settings/Settings';
import { Minimap, renderMapBackground, type MapLike, type MinimapMarker } from '../src/ui/Minimap';
import { MapScreen, type MapScreenOptions } from '../src/ui/MapScreen';
import * as SymbolsModule from '../src/ui/symbols';

const vehicleList = Object.values(VEHICLES);
const profileVehicles: ProfileVehicle[] = vehicleList.map((v) => ({
  id: v.id,
  nation: v.nation ?? '',
  family: v.family ?? v.id,
}));

function createMockMapLike(size = 3000, name = '试验场'): MapLike {
  const resolution = 4;
  return {
    spec: { ...RIVER_VALLEY, name, size },
    grid: {
      resolution,
      cellSize: size / (resolution - 1),
      half: size / 2,
      heights: new Float32Array(resolution * resolution),
      surfaces: new Uint8Array(resolution * resolution),
    },
  };
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

describe('小地图军标 (044-mapscreen-key-and-symbols)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    SymbolsModule.setSymbology('nato');
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  });

  it('设置项 minimapMarkers 缺省为 symbol，旧值保留', () => {
    expect(defaultSettings().game.minimapMarkers).toBe('symbol');
    expect(sanitize({}).game.minimapMarkers).toBe('symbol');
    expect(sanitize({ game: { minimapMarkers: 'dot' } }).game.minimapMarkers).toBe('dot');
    expect(sanitize({ game: { minimapMarkers: 'arrow' } }).game.minimapMarkers).toBe('arrow');
    expect(sanitize({ game: { minimapMarkers: 'symbol' } }).game.minimapMarkers).toBe('symbol');
  });

  it('renderMapBackground 与 Minimap.setMap 接受 MapLike 参数', () => {
    const mapLike = createMockMapLike();
    const bg = renderMapBackground(mapLike, 120);
    expect(bg).toBeDefined();

    const minimap = new Minimap(container);
    expect(() => minimap.setMap(mapLike)).not.toThrow();
  });

  it('Minimap.draw 在 markerStyle=symbol 且 marker 有 vehicleClass 时调用 drawSymbol(size: 14)', () => {
    const mockCtx = createMockContext();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => mockCtx);
    const minimap = new Minimap(container);

    const drawSymbolSpy = vi.spyOn(SymbolsModule, 'drawSymbol').mockImplementation(() => {});

    minimap.setMarkerStyle('symbol');
    SymbolsModule.setSymbology('warsaw');

    const markers: MinimapMarker[] = [
      { x: 100, z: 200, team: 'enemy', dead: false, vehicleClass: 'medium' },
      { x: -100, z: -200, team: 'ally', dead: true, vehicleClass: 'heavy' },
      { x: 300, z: 400, team: 'enemy', dead: false }, // 没有 vehicleClass，退回圆点
    ];

    minimap.draw({ x: 0, z: 0, heading: 0, view: 0 }, markers);

    expect(drawSymbolSpy).toHaveBeenCalledTimes(2);
    expect(drawSymbolSpy).toHaveBeenNthCalledWith(
      1,
      mockCtx,
      'medium',
      expect.any(Number),
      expect.any(Number),
      {
        set: 'warsaw',
        affiliation: 'hostile',
        dead: false,
        size: 14,
      },
    );
    expect(drawSymbolSpy).toHaveBeenNthCalledWith(
      2,
      mockCtx,
      'heavy',
      expect.any(Number),
      expect.any(Number),
      {
        set: 'warsaw',
        affiliation: 'friend',
        dead: true,
        size: 14,
      },
    );

    // 第 3 个标记没有 vehicleClass，退回圆点，调用 arc
    expect(mockCtx.arc).toHaveBeenCalled();

    drawSymbolSpy.mockRestore();
    getContextSpy.mockRestore();
  });
});

describe('地图界面军标与车组选择回调 (044-mapscreen-key-and-symbols)', () => {
  let container: HTMLElement;
  let currentProfile: Profile;
  let loadoutStore: Record<string, Loadout>;
  let mockMapLike: MapLike;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    currentProfile = defaultProfile(profileVehicles, 1000);
    // 招募第二个车组并分车
    currentProfile = recruitCrew(currentProfile, 'germany');
    currentProfile = assignVehicle(currentProfile, 'germany', 'lineup-1', 1, 'tiger_ii', profileVehicles);

    loadoutStore = {
      tiger_i: { pzgr39: 20 },
      tiger_ii: { pzgr39_43: 15 },
    };
    mockMapLike = createMockMapLike(3000, '西奈半岛');
    return () => {
      container.remove();
    };
  });

  function createScreen(customOpts?: Partial<MapScreenOptions>) {
    const onSymbologyChange = vi.fn();
    const onConfirm = vi.fn();
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
      onSelectCrew,
      ...customOpts,
    });

    return { screen, onSymbologyChange, onConfirm, onSelectCrew, saveLoadout };
  }

  it('spawn 模式下点有车卡片调用 onSelectCrew 并更新高亮；battle 模式下点卡片只切携弹不调用 onSelectCrew 也不改高亮', () => {
    const { screen, onSelectCrew } = createScreen();

    // 1. spawn 模式
    screen.open(mockMapLike, 'spawn');
    const cards = screen.root.querySelectorAll<HTMLElement>('.ms-card');
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards[0].classList.contains('sel')).toBe(true);
    expect(cards[1].classList.contains('sel')).toBe(false);

    // 点击第二个有车的车组卡片 (虎王)
    cards[1].click();
    expect(onSelectCrew).toHaveBeenCalledTimes(1);
    expect(onSelectCrew).toHaveBeenCalledWith(1);
    expect(cards[1].classList.contains('sel')).toBe(true);
    expect(cards[0].classList.contains('sel')).toBe(false);

    // 2. battle 模式
    screen.open(mockMapLike, 'battle');
    onSelectCrew.mockClear();
    const battleCards = screen.root.querySelectorAll<HTMLElement>('.ms-card');
    // 重新打开后默认高亮 card[0]
    expect(battleCards[0].classList.contains('sel')).toBe(true);

    // 在 battle 模式下点击 card[1]
    battleCards[1].click();
    // 不应调用 onSelectCrew
    expect(onSelectCrew).not.toHaveBeenCalled();
    // 高亮不应变动 (battle 模式点卡片只切携弹面板)
    expect(battleCards[0].classList.contains('sel')).toBe(true);
    expect(battleCards[1].classList.contains('sel')).toBe(false);
  });

  it('不传 drawMarker 时: 标记带 vehicleClass 就按当前下拉框符号体系画军标(size: 18)，否则画圆点', () => {
    const { screen } = createScreen({ symbology: 'warsaw' });
    screen.open(mockMapLike, 'battle');

    const canvas = screen.root.querySelector<HTMLCanvasElement>('.ms-canvas')!;
    const mockCtx = createMockContext();
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);

    const drawSymbolSpy = vi.spyOn(SymbolsModule, 'drawSymbol').mockImplementation(() => {});

    const markers: MinimapMarker[] = [
      { x: 200, z: 400, team: 'enemy', dead: false, vehicleClass: 'td' },
      { x: -300, z: 500, team: 'ally', dead: true, vehicleClass: 'medium' },
      { x: 0, z: 0, team: 'enemy', dead: false }, // 没有 vehicleClass
    ];

    screen.draw({ markers });

    expect(drawSymbolSpy).toHaveBeenCalledTimes(2);
    expect(drawSymbolSpy).toHaveBeenNthCalledWith(
      1,
      mockCtx,
      'td',
      expect.any(Number),
      expect.any(Number),
      {
        set: 'warsaw',
        affiliation: 'hostile',
        dead: false,
        size: 18,
      },
    );
    expect(drawSymbolSpy).toHaveBeenNthCalledWith(
      2,
      mockCtx,
      'medium',
      expect.any(Number),
      expect.any(Number),
      {
        set: 'warsaw',
        affiliation: 'friend',
        dead: true,
        size: 18,
      },
    );

    // 无 vehicleClass 的画圆点
    expect(mockCtx.arc).toHaveBeenCalled();

    drawSymbolSpy.mockRestore();
  });

  it('符号体系下拉框变更后立即重画上一帧', () => {
    const { screen } = createScreen({ symbology: 'nato' });
    screen.open(mockMapLike, 'battle');

    const canvas = screen.root.querySelector<HTMLCanvasElement>('.ms-canvas')!;
    const mockCtx = createMockContext();
    vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx);

    const drawSymbolSpy = vi.spyOn(SymbolsModule, 'drawSymbol').mockImplementation(() => {});

    const markers: MinimapMarker[] = [
      { x: 100, z: 200, team: 'ally', dead: false, vehicleClass: 'light' },
    ];
    screen.draw({ markers });
    expect(drawSymbolSpy).toHaveBeenLastCalledWith(
      mockCtx,
      'light',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ set: 'nato' }),
    );

    // 切换下拉框到华约
    const select = screen.root.querySelector<HTMLSelectElement>('.ms-symbology-select')!;
    select.value = 'warsaw';
    select.dispatchEvent(new Event('change'));

    // 立即重画了，使用 warsaw
    expect(drawSymbolSpy).toHaveBeenLastCalledWith(
      mockCtx,
      'light',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ set: 'warsaw' }),
    );

    drawSymbolSpy.mockRestore();
  });

  it('jsdom 中 canvas 没有 2D 上下文时 open 与 draw 不报错', () => {
    const { screen } = createScreen();
    expect(() => {
      screen.open(mockMapLike, 'spawn');
      screen.draw({
        markers: [
          { x: 100, z: 200, team: 'enemy', dead: false, vehicleClass: 'heavy' },
        ],
      });
    }).not.toThrow();
  });
});
