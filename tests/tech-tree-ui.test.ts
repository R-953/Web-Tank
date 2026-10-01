import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TechTree } from '../src/ui/menu/TechTree';
import type { TechTreeEntry } from '../src/ui/menu/techTreeLayout';

describe('TechTree UI Component', () => {
  let container: HTMLElement;
  const sampleEntries: TechTreeEntry[] = [
    { id: 'tiger_i', name: '虎式 Ausf. E', nation: 'germany', vehicleClass: 'heavy', serviceYear: 1944, family: 'tiger' },
    { id: 't34_85', name: 'T-34-85', nation: 'ussr', vehicleClass: 'medium', serviceYear: 1944, family: 't34_85' },
    { id: 'su_100', name: 'SU-100', nation: 'ussr', vehicleClass: 'td', serviceYear: 1944, family: 'su100' },
    { id: 'm4a3_76w', name: 'M4A3(76)W', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
    { id: 'm4a3e8', name: 'M4A3E8', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  });

  it('正确渲染全屏组件DOM结构与年份刻度', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const tree = new TechTree(container, {
      entries: sampleEntries,
      onPick,
      onClose,
    });

    const root = container.querySelector('.tt-root');
    expect(root).not.toBeNull();

    // 顶栏
    const title = root?.querySelector('.tt-title');
    expect(title?.textContent).toBe('科技树');

    // 国家 tabs
    const tabs = root?.querySelectorAll('.tt-nation-tab');
    expect(tabs?.length).toBe(3); // germany, ussr, usa

    // 年份栏
    const ticks = root?.querySelectorAll('.tt-year-tick');
    expect(ticks?.length).toBe(1);
    expect(ticks?.[0].textContent).toBe('1944');

    // 国家块
    const nations = root?.querySelectorAll('.tt-nation');
    expect(nations?.length).toBe(3);

    tree.dispose();
  });

  it('点击单车卡片触发 onPick', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const tree = new TechTree(container, {
      entries: sampleEntries,
      onPick,
      onClose,
    });

    const tigerCard = container.querySelector<HTMLElement>('.tt-vehicle-card[data-vehicle-id="tiger_i"]');
    expect(tigerCard).not.toBeNull();

    tigerCard?.click();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('tiger_i');

    tree.dispose();
  });

  it('多车组显示「×N」,点击组头部展开/收起,点击组内车辆触发 onPick', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const tree = new TechTree(container, {
      entries: sampleEntries,
      onPick,
      onClose,
    });

    const groupCard = container.querySelector<HTMLElement>('.tt-group-card[data-family="m4a3"]');
    expect(groupCard).not.toBeNull();

    const count = groupCard?.querySelector('.tt-group-count');
    expect(count?.textContent).toBe('×2');

    const header = groupCard?.querySelector<HTMLElement>('.tt-group-header');
    const list = groupCard?.querySelector<HTMLElement>('.tt-group-list');
    expect(list?.style.display).toBe('none');

    // 点击展开
    header?.click();
    expect(groupCard?.classList.contains('open')).toBe(true);
    expect(list?.style.display).toBe('flex');
    expect(groupCard?.querySelector('.tt-group-arrow')?.textContent).toBe('▲');

    // 点击组内车辆
    const e8Item = list?.querySelector<HTMLElement>('.tt-vehicle-item[data-vehicle-id="m4a3e8"]');
    expect(e8Item).not.toBeNull();
    e8Item?.click();
    expect(onPick).toHaveBeenCalledWith('m4a3e8');

    // 再次点击收起
    header?.click();
    expect(groupCard?.classList.contains('open')).toBe(false);
    expect(list?.style.display).toBe('none');
    expect(groupCard?.querySelector('.tt-group-arrow')?.textContent).toBe('▼');

    tree.dispose();
  });

  it('点击空白处自动收起已展开的车组', () => {
    const tree = new TechTree(container, {
      entries: sampleEntries,
      onPick: vi.fn(),
      onClose: vi.fn(),
    });

    const groupCard = container.querySelector<HTMLElement>('.tt-group-card[data-family="m4a3"]');
    const header = groupCard?.querySelector<HTMLElement>('.tt-group-header');
    header?.click();
    expect(groupCard?.classList.contains('open')).toBe(true);

    // 点击页面空白处
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(groupCard?.classList.contains('open')).toBe(false);

    tree.dispose();
  });

  it('点击关闭按钮或按 Esc 触发 onClose', () => {
    const onClose = vi.fn();
    const tree = new TechTree(container, {
      entries: sampleEntries,
      onPick: vi.fn(),
      onClose,
    });

    const closeBtn = container.querySelector<HTMLElement>('.tt-close');
    closeBtn?.click();
    expect(onClose).toHaveBeenCalledTimes(1);

    // 触发 Esc 按键
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    // 其他按键不触发
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    tree.dispose();
  });

  it('currentId 高亮与 inLineup 标记', () => {
    const tree = new TechTree(container, {
      entries: sampleEntries,
      currentId: 'tiger_i',
      inLineup: new Set(['tiger_i', 'm4a3e8']),
      onPick: vi.fn(),
      onClose: vi.fn(),
    });

    // 虎式:单车卡片高亮且有编组标记
    const tigerCard = container.querySelector<HTMLElement>('.tt-vehicle-card[data-vehicle-id="tiger_i"]');
    expect(tigerCard?.classList.contains('tt-current')).toBe(true);
    expect(tigerCard?.classList.contains('tt-in-lineup')).toBe(true);
    expect(tigerCard?.querySelector('.tt-badge-lineup')?.textContent).toBe('已编组');

    // T-34-85:没有高亮和编组标记
    const t34Card = container.querySelector<HTMLElement>('.tt-vehicle-card[data-vehicle-id="t34_85"]');
    expect(t34Card?.classList.contains('tt-current')).toBe(false);
    expect(t34Card?.classList.contains('tt-in-lineup')).toBe(false);

    // M4A3 车族组:组卡片包含在编组中的车辆,有 tt-has-lineup
    const m4Group = container.querySelector<HTMLElement>('.tt-group-card[data-family="m4a3"]');
    expect(m4Group?.classList.contains('tt-has-lineup')).toBe(true);

    // 展开并检查成员标记
    const header = m4Group?.querySelector<HTMLElement>('.tt-group-header');
    header?.click();
    const e8Item = m4Group?.querySelector<HTMLElement>('.tt-vehicle-item[data-vehicle-id="m4a3e8"]');
    expect(e8Item?.classList.contains('tt-in-lineup')).toBe(true);
    expect(e8Item?.querySelector('.tt-badge-lineup')?.textContent).toBe('已编组');

    tree.dispose();
  });

  it('showNation 滚到指定国家并更新 tab 样式', () => {
    const tree = new TechTree(container, {
      entries: sampleEntries,
      onPick: vi.fn(),
      onClose: vi.fn(),
    });

    const scrollContainer = container.querySelector<HTMLElement>('.tt-scroll')!;
    const ussrEl = container.querySelector<HTMLElement>('.tt-nation[data-nation="ussr"]')!;
    Object.defineProperty(ussrEl, 'offsetTop', { value: 600, configurable: true });
    ussrEl.scrollIntoView = vi.fn();

    tree.showNation('ussr');

    expect(scrollContainer.scrollTop).toBe(600);
    expect(ussrEl.scrollIntoView).toHaveBeenCalled();

    // 检查 tab 激活状态
    const tabs = container.querySelectorAll('.tt-nation-tab');
    // tabs: germany, ussr, usa -> 第 1 个是 ussr
    expect(tabs[1].classList.contains('on')).toBe(true);
    expect(tabs[0].classList.contains('on')).toBe(false);

    tree.dispose();
  });

  it('dispose 正常移除 DOM 与键盘事件监听', () => {
    const onClose = vi.fn();
    const tree = new TechTree(container, {
      entries: sampleEntries,
      onPick: vi.fn(),
      onClose,
    });

    expect(container.querySelector('.tt-root')).not.toBeNull();
    tree.dispose();

    // DOM 已移除
    expect(container.querySelector('.tt-root')).toBeNull();

    // Esc 按键不再触发 onClose
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
