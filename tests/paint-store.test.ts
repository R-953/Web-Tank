import { describe, it, expect, vi } from 'vitest';
import { PaintStore, PAINT_STORAGE_KEY, sanitizePaints } from '../src/settings/PaintStore';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

describe('涂装存储 (PaintStore)', () => {
  it('初始状态为空, 未设置涂装的载具返回 null', () => {
    const storage = new MemoryStorage();
    const store = new PaintStore(storage);
    expect(store.get('tiger_i')).toBeNull();
    expect(store.get('t34_85')).toBeNull();
  });

  it('能够正常写入并读取涂装 id, 重新实例化后依然能读取(往返)', () => {
    const storage = new MemoryStorage();
    const store1 = new PaintStore(storage);

    store1.set('tiger_i', 'panzergrau');
    store1.set('t34_85', 'winter_white');

    expect(store1.get('tiger_i')).toBe('panzergrau');
    expect(store1.get('t34_85')).toBe('winter_white');

    // 重新实例化
    const store2 = new PaintStore(storage);
    expect(store2.get('tiger_i')).toBe('panzergrau');
    expect(store2.get('t34_85')).toBe('winter_white');
  });

  it('传入 null 或 default 可以清除设置, 回到出厂状态', () => {
    const storage = new MemoryStorage();
    const store = new PaintStore(storage);

    store.set('tiger_i', 'panzergrau');
    expect(store.get('tiger_i')).toBe('panzergrau');

    // 设为 null
    store.set('tiger_i', null);
    expect(store.get('tiger_i')).toBeNull();

    // 设为 default
    store.set('t34_85', 'winter_white');
    store.set('t34_85', 'default');
    expect(store.get('t34_85')).toBeNull();
  });

  it('坏数据平滑退回空对象, 不抛出异常', () => {
    expect(sanitizePaints(null)).toEqual({});
    expect(sanitizePaints(undefined)).toEqual({});
    expect(sanitizePaints('corrupted string')).toEqual({});
    expect(sanitizePaints(12345)).toEqual({});
    expect(sanitizePaints([1, 2, 3])).toEqual({});

    // 部分坏数据过滤
    const partialBad = {
      tiger_i: 'panzergrau',
      invalid_num: 123,
      invalid_obj: {},
      invalid_null: null,
      '': 'empty_key',
      t34_85: 'winter_white',
    };
    expect(sanitizePaints(partialBad)).toEqual({
      tiger_i: 'panzergrau',
      t34_85: 'winter_white',
    });

    // 损坏的 JSON 文本
    const storage = new MemoryStorage();
    storage.setItem(PAINT_STORAGE_KEY, '{ invalid json syntax');
    const store = new PaintStore(storage);
    expect(store.get('tiger_i')).toBeNull();
  });

  it('存储不可用或写入报错(如无痕模式、QuotaExceeded)时不抛错, 内存继续生效', () => {
    const throwingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    const store = new PaintStore(throwingStorage);
    expect(() => {
      store.set('tiger_i', 'olivgruen');
    }).not.toThrow();

    expect(store.get('tiger_i')).toBe('olivgruen');
  });

  it('subscribe 能收到更新通知, 取消订阅后不再通知', () => {
    const storage = new MemoryStorage();
    const store = new PaintStore(storage);

    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.set('tiger_i', 'panzergrau');
    expect(listener).toHaveBeenCalledTimes(1);

    store.set('t34_85', 'winter_white');
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
    store.set('su_100', 'winter_white');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
