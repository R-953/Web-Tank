import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VehicleSpec } from '../src/data/types';
import type { ModificationSpec } from '../src/data/modifications';
import {
  ModificationsScreen,
  type ModificationsScreenOptions,
  getModIconSvg,
} from '../src/ui/menu/ModificationsScreen';
import * as modsModule from '../src/data/modifications';
import * as thumbsModule from '../src/ui/menu/thumbnails';

describe('ModificationsScreen (改装界面)', () => {
  const dummySpec: VehicleSpec = {
    id: 'tiger_1',
    name: 'Tiger I',
    nation: 'germany',
    vehicleClass: 'heavy',
    maxSpeed: 38,
    turretRotationSpeed: 19,
    armor: { front: 100, side: 80, rear: 80 },
    turretArmor: { front: 100, side: 80, rear: 80 },
    weapons: [],
    hull: { length: 6.3, width: 3.7, height: 3.0, turnRate: 25, acceleration: 1.8 },
    turret: {
      length: 2.8,
      width: 2.3,
      height: 1.2,
      barrelLength: 4.9,
      elevation: [-8, 16],
      elevationSpeed: 4.0,
    },
    sight: { magnifications: [2.5, 5], reticle: 'german' },
    internals: { modules: [], crew: [] },
    color: 0x887755,
  };

  const mockModList: ModificationSpec[] = [
    // 机动
    {
      id: 'mob_tracks',
      name: '履带',
      branch: 'mobility',
      tier: 1,
      description: '更换新型履带，提升车体转向能力。',
      effects: [{ kind: 'turnRate', mult: 1.1 }],
      source: 'War Thunder 值',
    },
    {
      id: 'mob_suspension',
      name: '悬挂',
      branch: 'mobility',
      tier: 2,
      requires: ['mob_tracks'],
      description: '强化悬挂减震，改善牵引加速度。',
      effects: [{ kind: 'acceleration', mult: 1.15 }],
      source: 'War Thunder 值',
    },
    {
      id: 'mob_engine',
      name: '发动机',
      branch: 'mobility',
      tier: 4,
      requires: ['mob_suspension'],
      description: '发动机大修翻新，提高最大速度。',
      effects: [{ kind: 'maxSpeed', mult: 1.05 }],
      source: 'War Thunder 值',
    },
    // 防护
    {
      id: 'prot_parts',
      name: '维修备件',
      branch: 'protection',
      tier: 1,
      description: '随车携带基本维修器材。',
      effects: [],
      source: 'War Thunder 值',
    },
    {
      id: 'prot_fpe',
      name: '灭火器材',
      branch: 'protection',
      tier: 2,
      requires: ['prot_parts'],
      description: '配备自动或手动抑爆灭火器。',
      effects: [],
      source: 'War Thunder 值',
    },
    // 火力
    {
      id: 'fire_horizontal',
      name: '水平方向机',
      branch: 'firepower',
      tier: 1,
      description: '润滑齿圈、强化方向机电机，提升炮塔转向速度。',
      effects: [{ kind: 'turretRotationSpeed', mult: 1.1 }],
      source: 'War Thunder 值',
    },
    {
      id: 'fire_elevation',
      name: '高低机',
      branch: 'firepower',
      tier: 2,
      requires: ['fire_horizontal'],
      description: '调整耳轴与高低机齿弧，提高火炮俯仰速度。',
      effects: [{ kind: 'elevationSpeed', mult: 1.1 }],
      source: 'War Thunder 值',
    },
  ];

  let parent: HTMLElement;
  let enabledStore: Record<string, string[]>;
  let getEnabledMock: ReturnType<typeof vi.fn<(vehicleId: string) => string[]>>;
  let setEnabledMock: ReturnType<typeof vi.fn<(vehicleId: string, ids: string[]) => void>>;
  let onCloseMock: ReturnType<typeof vi.fn<() => void>>;
  let onUiSoundMock: ReturnType<typeof vi.fn<() => void>>;
  let modificationsForSpy: ReturnType<typeof vi.spyOn>;
  let toggleModificationSpy: ReturnType<typeof vi.spyOn>;
  let applyModificationsSpy: ReturnType<typeof vi.spyOn>;
  let vehicleThumbnailSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);

    enabledStore = {
      tiger_1: [],
    };

    getEnabledMock = vi.fn((vehicleId: string): string[] => enabledStore[vehicleId] ?? []);
    setEnabledMock = vi.fn((vehicleId: string, ids: string[]): void => {
      enabledStore[vehicleId] = [...ids];
    });
    onCloseMock = vi.fn((): void => {});
    onUiSoundMock = vi.fn((): void => {});

    // Mock data functions
    modificationsForSpy = vi
      .spyOn(modsModule, 'modificationsFor')
      .mockImplementation((_spec) => mockModList);

    toggleModificationSpy = vi
      .spyOn(modsModule, 'toggleModification')
      .mockImplementation((_spec, enabled, id) => {
        const cur = new Set(enabled);
        if (cur.has(id)) {
          // 关闭时移除该 id 以及所有依赖它的项
          cur.delete(id);
          let changed = true;
          while (changed) {
            changed = false;
            for (const m of mockModList) {
              if (cur.has(m.id) && m.requires?.some((r) => !cur.has(r))) {
                cur.delete(m.id);
                changed = true;
              }
            }
          }
        } else {
          // 启用时要求前置已满足
          const target = mockModList.find((m) => m.id === id);
          if (!target || !target.requires || target.requires.every((r) => cur.has(r))) {
            cur.add(id);
          }
        }
        return Array.from(cur);
      });

    applyModificationsSpy = vi
      .spyOn(modsModule, 'applyModifications')
      .mockImplementation((spec, enabled) => {
        const res: VehicleSpec = JSON.parse(JSON.stringify(spec));
        const set = new Set(enabled);
        for (const modId of set) {
          const mod = mockModList.find((m) => m.id === modId);
          if (!mod) continue;
          for (const eff of mod.effects) {
            if (eff.kind === 'turretRotationSpeed') {
              res.turretRotationSpeed *= eff.mult;
            } else if (eff.kind === 'elevationSpeed') {
              res.turret.elevationSpeed *= eff.mult;
            } else if (eff.kind === 'turnRate') {
              res.hull.turnRate *= eff.mult;
            } else if (eff.kind === 'acceleration') {
              res.hull.acceleration *= eff.mult;
            } else if (eff.kind === 'maxSpeed') {
              res.maxSpeed *= eff.mult;
            }
          }
        }
        return res;
      });

    vehicleThumbnailSpy = vi
      .spyOn(thumbsModule, 'vehicleThumbnail')
      .mockReturnValue(null);
  });

  afterEach(() => {
    modificationsForSpy.mockRestore();
    toggleModificationSpy.mockRestore();
    applyModificationsSpy.mockRestore();
    vehicleThumbnailSpy.mockRestore();
    parent.remove();
  });

  function createScreen(customOpts: Partial<ModificationsScreenOptions> = {}): ModificationsScreen {
    return new ModificationsScreen({
      parent,
      getEnabled: getEnabledMock,
      setEnabled: setEnabledMock,
      onClose: onCloseMock,
      onUiSound: onUiSoundMock,
      ...customOpts,
    });
  }

  it('渲染三栏(机动/防护/火力)和等级标尺(I-IV)', () => {
    const screen = createScreen();
    screen.open(dummySpec);

    expect(screen.isOpen).toBe(true);

    // 检查标题包含「改装 · Tiger I」
    const titleEl = screen.root.querySelector('.mod-title');
    expect(titleEl?.textContent).toBe('改装 · Tiger I');

    // 检查第一排车辆卡片: 车名、类型图标降级
    const vehicleName = screen.root.querySelector('.mod-vehicle-name');
    expect(vehicleName?.textContent).toBe('Tiger I');
    const vehicleIcon = screen.root.querySelector('.mod-vehicle-icon');
    expect(vehicleIcon).not.toBeNull();

    // 检查三栏标题: 机动、防护、火力
    const headers = Array.from(screen.root.querySelectorAll('.mod-col-header')).map(
      (el) => el.textContent,
    );
    expect(headers).toContain('机动');
    expect(headers).toContain('防护');
    expect(headers).toContain('火力');

    // 检查最左侧标尺项: I, II, III, IV
    const rulerItems = Array.from(screen.root.querySelectorAll('.mod-ruler-item')).map(
      (el) => el.textContent?.replace('▼', '').trim(),
    );
    expect(rulerItems).toEqual(['I', 'II', 'III', 'IV']);

    // 检查改装卡片已渲染
    const cardTracks = screen.root.querySelector('[data-mod-id="mob_tracks"]');
    expect(cardTracks).not.toBeNull();
    expect(cardTracks?.textContent).toContain('履带');

    screen.dispose();
  });

  it('缩略图有返回值时显示缩略图 img', () => {
    vehicleThumbnailSpy.mockReturnValue('data:image/png;base64,fake-thumb');
    const screen = createScreen();
    screen.open(dummySpec);

    const thumbImg = screen.root.querySelector('img.mod-vehicle-thumb') as HTMLImageElement;
    expect(thumbImg).not.toBeNull();
    expect(thumbImg.src).toBe('data:image/png;base64,fake-thumb');

    screen.dispose();
  });

  it('getEnabled / setEnabled 的正确调用', () => {
    enabledStore['tiger_1'] = ['mob_tracks'];
    const screen = createScreen();
    screen.open(dummySpec);

    expect(getEnabledMock).toHaveBeenCalledWith('tiger_1');

    // 已启用的卡片应该具备 .enabled 类和勾选标记
    const cardTracks = screen.root.querySelector('[data-mod-id="mob_tracks"]');
    expect(cardTracks?.classList.contains('enabled')).toBe(true);
    expect(cardTracks?.querySelector('.mod-checkbox')?.textContent).toBe('✓');

    screen.dispose();
  });

  it('点击启用与关闭改装', () => {
    const screen = createScreen();
    screen.open(dummySpec);

    // 1. 点击启用 Tier 1 的履带
    const cardTracks = screen.root.querySelector('[data-mod-id="mob_tracks"]') as HTMLElement;
    cardTracks.click();

    expect(toggleModificationSpy).toHaveBeenCalledWith(dummySpec, [], 'mob_tracks');
    expect(setEnabledMock).toHaveBeenCalledWith('tiger_1', ['mob_tracks']);
    expect(onUiSoundMock).toHaveBeenCalled();

    // 界面更新为已启用
    const updatedCard = screen.root.querySelector('[data-mod-id="mob_tracks"]');
    expect(updatedCard?.classList.contains('enabled')).toBe(true);

    // 2. 再次点击关闭履带
    (updatedCard as HTMLElement).click();
    expect(toggleModificationSpy).toHaveBeenCalledWith(dummySpec, ['mob_tracks'], 'mob_tracks');
    expect(setEnabledMock).toHaveBeenCalledWith('tiger_1', []);

    const closedCard = screen.root.querySelector('[data-mod-id="mob_tracks"]');
    expect(closedCard?.classList.contains('enabled')).toBe(false);

    screen.dispose();
  });

  it('缺前置的方块变暗不可点', () => {
    const screen = createScreen();
    screen.open(dummySpec);

    // 悬挂需要履带前置，初始状态未启用履带，悬挂应为 locked/disabled
    const cardSuspension = screen.root.querySelector(
      '[data-mod-id="mob_suspension"]',
    ) as HTMLElement;
    expect(cardSuspension.classList.contains('locked')).toBe(true);
    expect(cardSuspension.classList.contains('disabled')).toBe(true);
    expect(cardSuspension.getAttribute('aria-disabled')).toBe('true');

    // 点击未满足前置的方块不可点，不触发 setEnabled
    setEnabledMock.mockClear();
    cardSuspension.click();
    expect(setEnabledMock).not.toHaveBeenCalled();

    // 先启用前置履带
    const cardTracks = screen.root.querySelector('[data-mod-id="mob_tracks"]') as HTMLElement;
    cardTracks.click();
    expect(setEnabledMock).toHaveBeenCalledWith('tiger_1', ['mob_tracks']);

    // 此时悬挂前置满足，不再 locked
    const unlockedSuspension = screen.root.querySelector(
      '[data-mod-id="mob_suspension"]',
    ) as HTMLElement;
    expect(unlockedSuspension.classList.contains('locked')).toBe(false);

    // 点击悬挂可以启用
    setEnabledMock.mockClear();
    unlockedSuspension.click();
    expect(setEnabledMock).toHaveBeenCalledWith('tiger_1', ['mob_tracks', 'mob_suspension']);

    screen.dispose();
  });

  it('effects 为空的改装显示「效果暂未接入」小字与悬停提示', () => {
    const screen = createScreen();
    screen.open(dummySpec);

    // 维修备件的 effects 为空
    const cardParts = screen.root.querySelector('[data-mod-id="prot_parts"]') as HTMLElement;
    expect(cardParts).not.toBeNull();

    const noEffectEl = cardParts.querySelector('.mod-card-no-effects');
    expect(noEffectEl?.textContent).toBe('效果暂未接入');

    // Tooltip 也包含 description 与「效果暂未接入」
    const tooltipDesc = cardParts.querySelector('.mod-tooltip-desc');
    expect(tooltipDesc?.textContent).toBe('随车携带基本维修器材。');

    const tooltipEff = cardParts.querySelector('.mod-tooltip-effects');
    expect(tooltipEff?.textContent).toBe('效果暂未接入');

    screen.dispose();
  });

  it('全部启用与全部关闭', () => {
    const screen = createScreen();
    screen.open(dummySpec);

    const progressLabel = screen.root.querySelector('.mod-progress-label');
    expect(progressLabel?.textContent).toBe('已启用 0 / 7');

    // 1. 全部启用
    const btnAll = screen.root.querySelector('.mod-btn-enable-all') as HTMLButtonElement;
    btnAll.click();

    const allModIds = mockModList.map((m) => m.id);
    expect(setEnabledMock).toHaveBeenCalledWith('tiger_1', allModIds);
    expect(onUiSoundMock).toHaveBeenCalled();

    const updatedProgress = screen.root.querySelector('.mod-progress-label');
    expect(updatedProgress?.textContent).toBe('已启用 7 / 7');

    const progressBar = screen.root.querySelector('.mod-progress-bar') as HTMLElement;
    expect(progressBar.style.width).toBe('100%');

    // 2. 全部关闭
    const btnNone = screen.root.querySelector('.mod-btn-disable-all') as HTMLButtonElement;
    btnNone.click();

    expect(setEnabledMock).toHaveBeenCalledWith('tiger_1', []);
    const clearedProgress = screen.root.querySelector('.mod-progress-label');
    expect(clearedProgress?.textContent).toBe('已启用 0 / 7');
    const clearedBar = screen.root.querySelector('.mod-progress-bar') as HTMLElement;
    expect(clearedBar.style.width).toBe('0%');

    screen.dispose();
  });

  it('效果汇总展示启用后变化的数值对比行', () => {
    const screen = createScreen();
    screen.open(dummySpec);

    // 初始没有变动
    let emptySummary = screen.root.querySelector('.mod-summary-empty');
    expect(emptySummary?.textContent).toBe('暂无属性变动');

    // 启用方向机 (19 * 1.1 = 20.9)
    const cardFire = screen.root.querySelector('[data-mod-id="fire_horizontal"]') as HTMLElement;
    cardFire.click();

    // 汇总中出现变化行
    const summaryItems = Array.from(screen.root.querySelectorAll('.mod-summary-item')).map(
      (el) => el.textContent,
    );
    expect(summaryItems.some((t) => t?.includes('方向机 19°/s → 20.9°/s'))).toBe(true);

    screen.dispose();
  });

  it('Esc 键关闭界面', () => {
    const screen = createScreen();
    screen.open(dummySpec);
    expect(screen.isOpen).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(screen.isOpen).toBe(false);
    expect(screen.root.style.display).toBe('none');
    expect(onCloseMock).toHaveBeenCalled();
    expect(onUiSoundMock).toHaveBeenCalled();

    screen.dispose();
  });

  it('右上角 × 按钮关闭界面', () => {
    const screen = createScreen();
    screen.open(dummySpec);

    const closeBtn = screen.root.querySelector('.mod-close-btn') as HTMLButtonElement;
    closeBtn.click();

    expect(screen.isOpen).toBe(false);
    expect(screen.root.style.display).toBe('none');
    expect(onCloseMock).toHaveBeenCalled();

    screen.dispose();
  });

  it('点击遮罩关闭，点击面板内部不关闭', () => {
    const screen = createScreen();
    screen.open(dummySpec);

    // 点击面板内部: 不关闭
    const panel = screen.root.querySelector('.mod-panel') as HTMLElement;
    panel.click();
    expect(screen.isOpen).toBe(true);
    expect(onCloseMock).not.toHaveBeenCalled();

    // 点击遮罩 (screen.root): 关闭
    screen.root.click();
    expect(screen.isOpen).toBe(false);
    expect(onCloseMock).toHaveBeenCalled();

    screen.dispose();
  });

  it('getModIconSvg 图标种类判定覆盖', () => {
    expect(getModIconSvg(mockModList[0])).toContain('mod-icon-svg'); // 履带
    expect(getModIconSvg(mockModList[1])).toContain('mod-icon-svg'); // 悬挂
    expect(getModIconSvg(mockModList[2])).toContain('mod-icon-svg'); // 发动机
    expect(getModIconSvg(mockModList[3])).toContain('mod-icon-svg'); // 备件
    expect(getModIconSvg(mockModList[4])).toContain('mod-icon-svg'); // 灭火
    expect(getModIconSvg(mockModList[5])).toContain('mod-icon-svg'); // 方向机
    expect(getModIconSvg(mockModList[6])).toContain('mod-icon-svg'); // 高低机

    // 变速箱与通用
    const transMod: ModificationSpec = {
      id: 'mob_transmission',
      name: '变速箱',
      branch: 'mobility',
      tier: 3,
      description: '变速箱',
      effects: [{ kind: 'maxSpeed', mult: 1.05 }],
      source: 'test',
    };
    expect(getModIconSvg(transMod)).toContain('mod-icon-svg');

    const genericMod: ModificationSpec = {
      id: 'other_custom',
      name: '自定义项',
      branch: 'firepower',
      tier: 3,
      description: '通用',
      effects: [],
      source: 'test',
    };
    expect(getModIconSvg(genericMod)).toContain('mod-icon-svg');
  });
});
