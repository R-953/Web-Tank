/**
 * 改装的本机存储与变更通知 (localStorage 键 webtank.mods.v1)
 * 结构: { [vehicleId]: string[] }
 */

export const MODS_STORAGE_KEY = 'webtank.mods.v1';

export type ModificationData = Record<string, string[]>;
export type ModificationListener = (data: ModificationData) => void;

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** 修正存档数据:不是对象、坏数据回到空对象;每个条目去重并只保留字符串 */
export function sanitizeModificationData(raw: unknown): ModificationData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: ModificationData = {};
  for (const [vehicleId, val] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(val)) {
      result[vehicleId] = Array.from(new Set(val.filter((x): x is string => typeof x === 'string')));
    }
  }
  return result;
}

export class ModificationStore {
  private current: ModificationData;
  private readonly listeners = new Set<ModificationListener>();

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage()) {
    let raw: unknown = null;
    try {
      const text = this.storage?.getItem(MODS_STORAGE_KEY);
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = null;
    }
    this.current = sanitizeModificationData(raw);
  }

  get(vehicleId: string): string[] {
    const list = this.current[vehicleId];
    return list ? [...list] : [];
  }

  set(vehicleId: string, ids: readonly string[]): void {
    const nextIds = Array.from(new Set(ids.filter((x): x is string => typeof x === 'string')));
    this.current = {
      ...this.current,
      [vehicleId]: nextIds,
    };
    try {
      this.storage?.setItem(MODS_STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      /* 存不了就只在内存里生效(无痕模式等) */
    }
    this.listeners.forEach((fn) => fn(this.current));
  }

  subscribe(fn: ModificationListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
