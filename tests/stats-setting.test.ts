import { describe, expect, it } from 'vitest';
import { SettingsStore, defaultSettings, sanitize } from '../src/settings/Settings';
import { SettingsPanel } from '../src/ui/menu/SettingsPanel';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('帧率和对局信息设置', () => {
  it('缺省为显示,旧存档和非法值回退到缺省', () => {
    expect(defaultSettings().game.showStats).toBe(true);
    expect(sanitize({}).game.showStats).toBe(true);
    expect(sanitize({ game: { showStats: 'yes' } }).game.showStats).toBe(true);
    expect(sanitize({ game: { showStats: false } }).game.showStats).toBe(false);
  });

  it('设置面板可修改并保存选项', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const storage = new MemoryStorage();
    const settings = new SettingsStore(storage);
    const panel = new SettingsPanel(parent, settings);
    panel.open('game');

    const row = Array.from(parent.querySelectorAll<HTMLElement>('.mm-row'))
      .find((item) => item.querySelector('.lbl')?.textContent?.includes('显示帧率和对局信息'))!;
    const checkbox = row.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(true);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    expect(settings.value.game.showStats).toBe(false);
    expect(new SettingsStore(storage).value.game.showStats).toBe(false);
    parent.remove();
  });
});
