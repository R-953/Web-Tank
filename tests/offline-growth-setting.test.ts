import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsStore, defaultSettings, sanitize } from '../src/settings/Settings';
import { SettingsPanel } from '../src/ui/menu/SettingsPanel';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

describe('离线挂机成长设置 (offlineGrowth)', () => {
  it('缺省值为 false', () => {
    expect(defaultSettings().game.offlineGrowth).toBe(false);
  });

  it('老存档(缺少 offlineGrowth 字段)修正为 false', () => {
    expect(sanitize({}).game.offlineGrowth).toBe(false);
    expect(sanitize({ game: {} }).game.offlineGrowth).toBe(false);
    expect(sanitize({ game: { killCam: true, showFps: true } }).game.offlineGrowth).toBe(false);
  });

  it('非法值自动回退为 false', () => {
    expect(sanitize({ game: { offlineGrowth: 'true' } }).game.offlineGrowth).toBe(false);
    expect(sanitize({ game: { offlineGrowth: 'false' } }).game.offlineGrowth).toBe(false);
    expect(sanitize({ game: { offlineGrowth: 1 } }).game.offlineGrowth).toBe(false);
    expect(sanitize({ game: { offlineGrowth: 0 } }).game.offlineGrowth).toBe(false);
    expect(sanitize({ game: { offlineGrowth: null } }).game.offlineGrowth).toBe(false);
    expect(sanitize({ game: { offlineGrowth: undefined } }).game.offlineGrowth).toBe(false);
    expect(sanitize({ game: { offlineGrowth: {} } }).game.offlineGrowth).toBe(false);
    expect(sanitize({ game: { offlineGrowth: [] } }).game.offlineGrowth).toBe(false);
  });

  it('合法布尔值正确保留', () => {
    expect(sanitize({ game: { offlineGrowth: true } }).game.offlineGrowth).toBe(true);
    expect(sanitize({ game: { offlineGrowth: false } }).game.offlineGrowth).toBe(false);
  });

  it('保存与读回往返一致', () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    expect(store.value.game.offlineGrowth).toBe(false);

    store.update((d) => {
      d.game.offlineGrowth = true;
    });
    expect(store.value.game.offlineGrowth).toBe(true);

    const reloaded = new SettingsStore(storage);
    expect(reloaded.value.game.offlineGrowth).toBe(true);

    reloaded.update((d) => {
      d.game.offlineGrowth = false;
    });
    expect(reloaded.value.game.offlineGrowth).toBe(false);

    const reloaded2 = new SettingsStore(storage);
    expect(reloaded2.value.game.offlineGrowth).toBe(false);
  });
});

describe('SettingsPanel 设置面板中的离线挂机成长开关', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  });

  it('正确渲染开关与提示文字，默认未勾选', () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    const panel = new SettingsPanel(container, store);
    panel.open('game');

    const rows = Array.from(container.querySelectorAll<HTMLElement>('.mm-row'));
    const row = rows.find((r) => r.querySelector('.lbl')?.textContent?.includes('离线挂机成长'));
    expect(row).toBeDefined();

    const lbl = row!.querySelector('.lbl')!;
    expect(lbl.textContent).toContain('离线挂机成长');
    expect(lbl.textContent).toContain('关闭页面期间');
    expect(lbl.textContent).toContain('默认关闭');

    const box = row!.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(box).not.toBeNull();
    expect(box!.checked).toBe(false);
  });

  it('点击复选框切换为开启，更新 SettingsStore 并触发 onUiSound', () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    const onUiSound = vi.fn();
    const panel = new SettingsPanel(container, store, { onUiSound });
    panel.open('game');

    const rows = Array.from(container.querySelectorAll<HTMLElement>('.mm-row'));
    const row = rows.find((r) => r.querySelector('.lbl')?.textContent?.includes('离线挂机成长'));
    const box = row!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;

    box.checked = true;
    box.dispatchEvent(new Event('change'));

    expect(store.value.game.offlineGrowth).toBe(true);
    expect(onUiSound).toHaveBeenCalled();

    // 重新从 storage 加载确认持久化
    const persisted = new SettingsStore(storage);
    expect(persisted.value.game.offlineGrowth).toBe(true);
  });

  it('初始为开启状态时面板正确显示已勾选，点击后切换为关闭', () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    store.update((d) => {
      d.game.offlineGrowth = true;
    });

    const panel = new SettingsPanel(container, store);
    panel.open('game');

    const rows = Array.from(container.querySelectorAll<HTMLElement>('.mm-row'));
    const row = rows.find((r) => r.querySelector('.lbl')?.textContent?.includes('离线挂机成长'));
    const box = row!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(box.checked).toBe(true);

    box.checked = false;
    box.dispatchEvent(new Event('change'));

    expect(store.value.game.offlineGrowth).toBe(false);

    const persisted = new SettingsStore(storage);
    expect(persisted.value.game.offlineGrowth).toBe(false);
  });
});
