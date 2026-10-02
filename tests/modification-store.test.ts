import { describe, it, expect, vi } from 'vitest';
import {
  ModificationStore,
  MODS_STORAGE_KEY,
  sanitizeModificationData,
} from '../src/settings/ModificationStore';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

describe('ModificationStore: 存档往返与多车隔离', () => {
  it('能够保存载具改装并在重新实例化后正确读出', () => {
    const storage = new MemoryStorage();
    const store = new ModificationStore(storage);

    expect(store.get('tiger_i')).toEqual([]);

    store.set('tiger_i', ['mobility_tracks', 'mobility_suspension']);
    expect(store.get('tiger_i')).toEqual(['mobility_tracks', 'mobility_suspension']);

    // 重新实例化读取同一 storage
    const reloaded = new ModificationStore(storage);
    expect(reloaded.get('tiger_i')).toEqual(['mobility_tracks', 'mobility_suspension']);
  });

  it('多辆载具的改装互相独立，各自持久化', () => {
    const storage = new MemoryStorage();
    const store = new ModificationStore(storage);

    store.set('tiger_i', ['mobility_tracks']);
    store.set('t_34_85', ['mobility_tracks', 'protection_parts']);
    store.set('su_100', ['firepower_vertical_drive']);

    expect(store.get('tiger_i')).toEqual(['mobility_tracks']);
    expect(store.get('t_34_85')).toEqual(['mobility_tracks', 'protection_parts']);
    expect(store.get('su_100')).toEqual(['firepower_vertical_drive']);
    expect(store.get('unknown_car')).toEqual([]);

    const reloaded = new ModificationStore(storage);
    expect(reloaded.get('tiger_i')).toEqual(['mobility_tracks']);
    expect(reloaded.get('t_34_85')).toEqual(['mobility_tracks', 'protection_parts']);
    expect(reloaded.get('su_100')).toEqual(['firepower_vertical_drive']);
  });

  it('set 会自动去重并过滤非字符串项', () => {
    const storage = new MemoryStorage();
    const store = new ModificationStore(storage);

    // @ts-expect-error 故意传入混合类型测试健壮性
    store.set('tiger_i', ['mobility_tracks', 'mobility_tracks', 123, null]);
    expect(store.get('tiger_i')).toEqual(['mobility_tracks']);
  });
});

describe('ModificationStore: 坏数据与损坏存档恢复', () => {
  it('sanitizeModificationData 容错处理', () => {
    expect(sanitizeModificationData(null)).toEqual({});
    expect(sanitizeModificationData(undefined)).toEqual({});
    expect(sanitizeModificationData('garbage')).toEqual({});
    expect(sanitizeModificationData(123)).toEqual({});
    expect(sanitizeModificationData(['array'])).toEqual({});

    // 条目不是数组或包含非法项
    const raw = {
      tiger_i: 'not-an-array',
      t_34_85: ['mobility_tracks', 456, 'protection_parts', 'mobility_tracks'],
      su_100: null,
    };
    const sanitized = sanitizeModificationData(raw);
    expect(sanitized.tiger_i).toBeUndefined();
    expect(sanitized.su_100).toBeUndefined();
    expect(sanitized.t_34_85).toEqual(['mobility_tracks', 'protection_parts']);
  });

  it('读取损坏的 JSON 时自动降级为空存档', () => {
    const storage = new MemoryStorage();
    storage.setItem(MODS_STORAGE_KEY, '{invalid json here');

    const store = new ModificationStore(storage);
    expect(store.get('tiger_i')).toEqual([]);
  });

  it('读取非对象 JSON 时降级为空存档', () => {
    const storage = new MemoryStorage();
    storage.setItem(MODS_STORAGE_KEY, JSON.stringify('simple string'));

    const store = new ModificationStore(storage);
    expect(store.get('tiger_i')).toEqual([]);
  });
});

describe('ModificationStore: 存储不可用(无痕模式/抛错)容错', () => {
  it('storage 为 null 时在内存中工作且不抛错', () => {
    const store = new ModificationStore(null);
    expect(store.get('tiger_i')).toEqual([]);
    expect(() => store.set('tiger_i', ['mobility_tracks'])).not.toThrow();
    expect(store.get('tiger_i')).toEqual(['mobility_tracks']);
  });

  it('storage 读写抛出异常时不崩溃，仍保持内存有效', () => {
    const brokenStorage = {
      getItem(): string | null {
        throw new Error('localStorage access denied');
      },
      setItem(): void {
        throw new Error('QuotaExceededError');
      },
    };

    const store = new ModificationStore(brokenStorage);
    expect(store.get('tiger_i')).toEqual([]);
    expect(() => store.set('tiger_i', ['mobility_tracks'])).not.toThrow();
    expect(store.get('tiger_i')).toEqual(['mobility_tracks']);
  });
});

describe('ModificationStore: 订阅通知机制 (subscribe)', () => {
  it('set 时通知订阅者，退订后不再触发', () => {
    const storage = new MemoryStorage();
    const store = new ModificationStore(storage);

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set('tiger_i', ['mobility_tracks']);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ tiger_i: ['mobility_tracks'] });

    store.set('t_34_85', ['protection_parts']);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.set('tiger_i', []);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
