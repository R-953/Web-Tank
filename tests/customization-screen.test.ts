import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomizationScreen } from '../src/ui/menu/CustomizationScreen';
import { TIGER_I, T34_85 } from '../src/data/vehicles';
import * as thumbnailsModule from '../src/ui/menu/thumbnails';
import type { VehicleSpec } from '../src/data/types';

describe('涂装界面 (CustomizationScreen)', () => {
  let parent: HTMLElement;
  let mockGetPaint: ReturnType<typeof vi.fn<(vehicleId: string) => string | null>>;
  let mockSetPaint: ReturnType<typeof vi.fn<(vehicleId: string, paintId: string | null) => void>>;
  let mockOnPreview: ReturnType<typeof vi.fn<(spec: VehicleSpec) => void>>;
  let mockOnClose: ReturnType<typeof vi.fn<() => void>>;
  let mockOnUiSound: ReturnType<typeof vi.fn<() => void>>;
  let screen: CustomizationScreen;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);

    mockGetPaint = vi.fn((_vehicleId: string) => null as string | null);
    mockSetPaint = vi.fn((_vehicleId: string, _paintId: string | null) => {});
    mockOnPreview = vi.fn((_spec: VehicleSpec) => {});
    mockOnClose = vi.fn(() => {});
    mockOnUiSound = vi.fn(() => {});

    screen = new CustomizationScreen({
      parent,
      getPaint: mockGetPaint,
      setPaint: mockSetPaint,
      onPreview: mockOnPreview,
      onClose: mockOnClose,
      onUiSound: mockOnUiSound,
    });
  });

  afterEach(() => {
    screen.dispose();
    parent.remove();
    vi.restoreAllMocks();
  });

  it('初始为关闭状态, 调用 open 后显示全屏弹层并正确渲染标题与列表', () => {
    expect(screen.isOpen).toBe(false);
    expect(screen.root.classList.contains('hidden')).toBe(true);

    screen.open(TIGER_I);

    expect(screen.isOpen).toBe(true);
    expect(screen.root.classList.contains('hidden')).toBe(false);

    // 检查标题
    const titleEl = screen.root.querySelector('.cs-title');
    expect(titleEl?.textContent).toBe(`涂装 · ${TIGER_I.name}`);

    // 检查左侧方案列表
    const items = screen.root.querySelectorAll('.cs-scheme-item');
    expect(items.length).toBeGreaterThanOrEqual(4); // 虎式有 4 个方案

    // 默认未保存时, 出厂方案应该处于选中状态 (带 selected 样式/金边)
    const selectedItem = screen.root.querySelector('.cs-scheme-item.selected') as HTMLElement;
    expect(selectedItem).not.toBeNull();
    expect(selectedItem.dataset.paintId).toBe('default');

    // 检查每个方案展示了色块、名称、出处
    items.forEach((item) => {
      expect(item.querySelector('.cs-swatch')).not.toBeNull();
      expect(item.querySelector('.cs-scheme-name')?.textContent).toBeTruthy();
      expect(item.querySelector('.cs-scheme-source')?.textContent).toBeTruthy();
    });
  });

  it('若已保存自定义涂装, 打开时初始选中该涂装', () => {
    mockGetPaint.mockReturnValue('panzergrau');
    screen.open(TIGER_I);

    const selectedItem = screen.root.querySelector('.cs-scheme-item.selected') as HTMLElement;
    expect(selectedItem?.dataset.paintId).toBe('panzergrau');
  });

  it('点选方案立即触发 onPreview 回调并播放声音, 方案高亮与右侧预览联动更新', () => {
    screen.open(TIGER_I);

    // 找到装甲灰方案项
    const items = screen.root.querySelectorAll('.cs-scheme-item');
    const panzergrauItem = Array.from(items).find(
      (el) => (el as HTMLElement).dataset.paintId === 'panzergrau',
    ) as HTMLElement;
    expect(panzergrauItem).toBeDefined();

    panzergrauItem.click();

    expect(mockOnUiSound).toHaveBeenCalled();
    expect(panzergrauItem.classList.contains('selected')).toBe(true);

    // 触发 onPreview 回调, 传入已套用装甲灰的 spec
    expect(mockOnPreview).toHaveBeenCalledTimes(1);
    const previewArg = mockOnPreview.mock.calls[0][0] as VehicleSpec;
    expect(previewArg.color).toBe(0x3b3f42); // RAL 7021 装甲灰色值
  });

  it('点击「确定」保存涂装并关闭, 触发 setPaint 且不还原预览', () => {
    screen.open(TIGER_I);

    // 选择橄榄绿
    const items = screen.root.querySelectorAll('.cs-scheme-item');
    const greenItem = Array.from(items).find(
      (el) => (el as HTMLElement).dataset.paintId === 'olivgruen',
    ) as HTMLElement;
    greenItem.click();

    const confirmBtn = screen.root.querySelector('.cs-btn-confirm') as HTMLButtonElement;
    confirmBtn.click();

    expect(mockSetPaint).toHaveBeenCalledWith(TIGER_I.id, 'olivgruen');
    expect(screen.isOpen).toBe(false);
    expect(mockOnClose).toHaveBeenCalled();

    // 点击确定后不应再次调用 onPreview 还原旧涂装
    expect(mockOnPreview).toHaveBeenCalledTimes(1);
  });

  it('选中出厂方案并点确定时, 传给 setPaint 的 paintId 为 null', () => {
    mockGetPaint.mockReturnValue('winter_white');
    screen.open(TIGER_I);

    // 切回出厂
    const defaultItem = Array.from(screen.root.querySelectorAll('.cs-scheme-item')).find(
      (el) => (el as HTMLElement).dataset.paintId === 'default',
    ) as HTMLElement;
    defaultItem.click();

    const confirmBtn = screen.root.querySelector('.cs-btn-confirm') as HTMLButtonElement;
    confirmBtn.click();

    expect(mockSetPaint).toHaveBeenCalledWith(TIGER_I.id, null);
    expect(screen.isOpen).toBe(false);
  });

  it('点击「取消」恢复原涂装并关闭, 不调用 setPaint', () => {
    mockGetPaint.mockReturnValue('panzergrau');
    screen.open(TIGER_I);

    // 切换到冬季涂装预览
    const items = screen.root.querySelectorAll('.cs-scheme-item');
    const winterItem = Array.from(items).find(
      (el) => (el as HTMLElement).dataset.paintId === 'winter_white',
    ) as HTMLElement;
    winterItem.click();

    expect(mockOnPreview).toHaveBeenCalledTimes(1);
    expect(mockOnPreview.mock.calls[0][0].color).toBe(0xd8dcd6);

    // 点取消
    const cancelBtn = screen.root.querySelector('.cs-btn-cancel') as HTMLButtonElement;
    cancelBtn.click();

    expect(mockSetPaint).not.toHaveBeenCalled();
    expect(screen.isOpen).toBe(false);
    expect(mockOnClose).toHaveBeenCalled();

    // 恢复原来的涂装 (panzergrau)
    expect(mockOnPreview).toHaveBeenCalledTimes(2);
    expect(mockOnPreview.mock.calls[1][0].color).toBe(0x3b3f42);
  });

  it('点击右上角「✕」恢复原涂装并关闭', () => {
    mockGetPaint.mockReturnValue(null);
    screen.open(TIGER_I);

    const items = screen.root.querySelectorAll('.cs-scheme-item');
    const winterItem = Array.from(items).find(
      (el) => (el as HTMLElement).dataset.paintId === 'winter_white',
    ) as HTMLElement;
    winterItem.click();

    const closeBtn = screen.root.querySelector('.cs-close-btn') as HTMLButtonElement;
    closeBtn.click();

    expect(screen.isOpen).toBe(false);
    expect(mockSetPaint).not.toHaveBeenCalled();

    // 恢复出厂
    expect(mockOnPreview).toHaveBeenCalledTimes(2);
    expect(mockOnPreview.mock.calls[1][0].color).toBe(TIGER_I.color);
  });

  it('按 Esc 键恢复原涂装并关闭', () => {
    mockGetPaint.mockReturnValue(null);
    screen.open(T34_85);

    const items = screen.root.querySelectorAll('.cs-scheme-item');
    const winterItem = Array.from(items).find(
      (el) => (el as HTMLElement).dataset.paintId === 'winter_white',
    ) as HTMLElement;
    winterItem.click();

    // 按 Esc
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

    expect(screen.isOpen).toBe(false);
    expect(mockSetPaint).not.toHaveBeenCalled();
    expect(mockOnPreview).toHaveBeenCalledTimes(2);
    expect(mockOnPreview.mock.calls[1][0].color).toBe(T34_85.color);
  });

  it('点击遮罩空白区域恢复原涂装并关闭', () => {
    screen.open(T34_85);

    const items = screen.root.querySelectorAll('.cs-scheme-item');
    const winterItem = Array.from(items).find(
      (el) => (el as HTMLElement).dataset.paintId === 'winter_white',
    ) as HTMLElement;
    winterItem.click();

    // 在 root 遮罩上触发 mousedown
    screen.root.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(screen.isOpen).toBe(false);
    expect(mockSetPaint).not.toHaveBeenCalled();
    expect(mockOnPreview).toHaveBeenCalledTimes(2);
  });

  it('缩略图可用时显示 <img>, 失败/不可用时显示色块与色值', () => {
    // 1. mock 缩略图成功返回
    const mockThumb = 'data:image/png;base64,mocked_paint_preview';
    const thumbSpy = vi.spyOn(thumbnailsModule, 'vehicleThumbnail').mockReturnValue(mockThumb);

    screen.open(TIGER_I);
    const img = screen.root.querySelector('.cs-preview-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.src).toBe(mockThumb);

    // 2. mock 缩略图返回 null
    thumbSpy.mockReturnValue(null);
    screen.open(TIGER_I);
    const imgNull = screen.root.querySelector('.cs-preview-img');
    expect(imgNull).toBeNull();

    const colorBlock = screen.root.querySelector('.cs-preview-color-block') as HTMLElement | null;
    expect(colorBlock).not.toBeNull();
    expect(colorBlock?.textContent).toContain('#');
  });

  it('调用 dispose 能够移除 DOM 与键盘事件监听', () => {
    screen.open(TIGER_I);
    expect(parent.contains(screen.root)).toBe(true);

    screen.dispose();
    expect(parent.contains(screen.root)).toBe(false);

    // 按 Esc 不应报错
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    }).not.toThrow();
  });
});
