/**
 * 载具涂装方案存档存储。
 * localStorage 键: webtank.paints.v1
 * 格式: { [vehicleId: string]: paintId: string }
 * 坏数据回到空, 存储不可用(无痕模式/报错)不抛错。
 */

export const PAINT_STORAGE_KEY = 'webtank.paints.v1';

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** 校验并清理原始存档数据, 非法或损坏数据平滑退回空对象 */
export function sanitizePaints(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === 'string' && k.length > 0 && typeof v === 'string' && v.length > 0) {
      clean[k] = v;
    }
  }
  return clean;
}

export class PaintStore {
  private paints: Record<string, string>;
  private readonly listeners = new Set<(paints?: Readonly<Record<string, string>>) => void>();

  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage(),
  ) {
    let raw: unknown = null;
    try {
      const text = this.storage?.getItem(PAINT_STORAGE_KEY);
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = null;
    }
    this.paints = sanitizePaints(raw);
  }

  /** 获取指定载具保存的涂装 id, 未设置或出厂涂装返回 null */
  get(vehicleId: string): string | null {
    return this.paints[vehicleId] ?? null;
  }

  /**
   * 设置指定载具的涂装 id。
   * 传入 null 或 'default' 时移除自定义设定(恢复出厂)。
   */
  set(vehicleId: string, paintId: string | null): void {
    if (paintId === null || paintId === 'default' || paintId === '') {
      delete this.paints[vehicleId];
    } else {
      this.paints[vehicleId] = paintId;
    }

    try {
      this.storage?.setItem(PAINT_STORAGE_KEY, JSON.stringify(this.paints));
    } catch {
      /* 存储不可用时仅在内存中生效, 不抛错 */
    }

    const snapshot = { ...this.paints };
    this.listeners.forEach((fn) => fn(snapshot));
  }

  /** 订阅涂装变更, 返回取消订阅的函数 */
  subscribe(fn: (paints?: Readonly<Record<string, string>>) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
