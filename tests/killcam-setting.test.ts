import { describe, it, expect } from 'vitest';
import { SettingsStore, defaultSettings, sanitize } from '../src/settings/Settings';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

describe('命中回放设置(killCam / killCamAll)', () => {
  it('缺省:回放开着,所有命中都回放', () => {
    const g = defaultSettings().game;
    expect(g.killCam).toBe(true);
    expect(g.killCamAll).toBe(true);
  });

  it('老存档没有 killCamAll 时取缺省(true),已有的 killCam 不受影响', () => {
    const s = sanitize({ game: { killCam: false } });
    expect(s.game.killCam).toBe(false);
    expect(s.game.killCamAll).toBe(true);
  });

  it('非法值回到缺省,合法布尔值保留', () => {
    expect(sanitize({ game: { killCamAll: 'no' } }).game.killCamAll).toBe(true);
    expect(sanitize({ game: { killCamAll: 0 } }).game.killCamAll).toBe(true);
    expect(sanitize({ game: { killCamAll: false } }).game.killCamAll).toBe(false);
    expect(sanitize({ game: { killCamAll: true } }).game.killCamAll).toBe(true);
  });

  it('保存与读回往返一致', () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    store.update((d) => {
      d.game.killCamAll = false;
    });
    expect(new SettingsStore(storage).value.game.killCamAll).toBe(false);
  });
});
