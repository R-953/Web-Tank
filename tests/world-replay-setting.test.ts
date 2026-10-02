import { beforeEach, describe, expect, it } from 'vitest';
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

describe('内构显示与死亡回放方式设置', () => {
  it('缺省为世界内显示', () => {
    expect(defaultSettings().game.internalsStyle).toBe('world');
    expect(defaultSettings().game.deathReplayStyle).toBe('world');
  });

  it('旧存档缺少两项时使用缺省值', () => {
    expect(sanitize({}).game.internalsStyle).toBe('world');
    expect(sanitize({}).game.deathReplayStyle).toBe('world');
    const saved = sanitize({ game: { killCam: false } });
    expect(saved.game.internalsStyle).toBe('world');
    expect(saved.game.deathReplayStyle).toBe('world');
    expect(saved.game.killCam).toBe(false);
  });

  it('非法值回退到缺省,合法值保留', () => {
    expect(sanitize({ game: { internalsStyle: 'window', deathReplayStyle: 'panel' } }).game.internalsStyle).toBe('world');
    expect(sanitize({ game: { internalsStyle: 1, deathReplayStyle: null } }).game.deathReplayStyle).toBe('world');
    const saved = sanitize({ game: { internalsStyle: 'panel', deathReplayStyle: 'window' } });
    expect(saved.game.internalsStyle).toBe('panel');
    expect(saved.game.deathReplayStyle).toBe('window');
  });
});

describe('SettingsPanel 内构与死亡回放方式下拉框', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => container.remove();
  });

  it('更改两个下拉选项后更新并保存设置', () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    const panel = new SettingsPanel(container, store);
    panel.open('game');

    const rows = Array.from(container.querySelectorAll<HTMLElement>('.mm-row'));
    const internalsRow = rows.find((row) => row.querySelector('.lbl')?.textContent?.includes('内构显示方式'))!;
    const replayRow = rows.find((row) => row.querySelector('.lbl')?.textContent?.includes('死亡回放方式'))!;
    const internals = internalsRow.querySelector<HTMLSelectElement>('select')!;
    const replay = replayRow.querySelector<HTMLSelectElement>('select')!;

    expect(Array.from(internals.options, (option) => option.textContent)).toEqual(['在载具上显示 X 光', '左侧面板']);
    expect(Array.from(replay.options, (option) => option.textContent)).toEqual(['叠在游戏画面里', '全屏窗口']);
    expect(internals.value).toBe('world');
    expect(replay.value).toBe('world');

    internals.value = 'panel';
    internals.dispatchEvent(new Event('change'));
    replay.value = 'window';
    replay.dispatchEvent(new Event('change'));

    expect(store.value.game.internalsStyle).toBe('panel');
    expect(store.value.game.deathReplayStyle).toBe('window');
    const reloaded = new SettingsStore(storage);
    expect(reloaded.value.game.internalsStyle).toBe('panel');
    expect(reloaded.value.game.deathReplayStyle).toBe('window');
  });
});
