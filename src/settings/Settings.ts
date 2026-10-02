import { ACTIONS, defaultBindings, type Bindings } from '../data/controls';
import { DEFAULT_SOUND_SETTINGS, sanitizeSettings, type SoundSettings } from '../audio/Sound';
import type { AIPresetId } from '../data/ai';
import type { Symbology } from '../ui/symbols';

/**
 * 玩家设置(游戏 / 图像 / 声音 / 操作),存在本机浏览器里(localStorage)。
 * 读写失败(无痕模式等)时只在内存里生效,不影响游戏。
 */

export type GraphicsPreset = 'low' | 'medium' | 'high';

export interface GameSettings {
  game: {
    /** 敌方 AI 强度:训练(宽松)/ 守卫(原第四轮参数,很准) */
    aiPreset: AIPresetId;
    /** 命中回放总开关:击中 / 被击中后在右上角回放这一发(自己被击毁时全屏) */
    killCam: boolean;
    /** 所有命中都回放(跳弹、未击穿、击穿没击毁);关掉后只回放击毁 */
    killCamAll: boolean;
    /** 内构显示方式:世界中的 X 光 / 左侧面板 */
    internalsStyle: 'world' | 'panel';
    /** 死亡回放方式:叠在游戏画面里 / 全屏窗口 */
    deathReplayStyle: 'world' | 'window';
    minimapShape: 'square' | 'circle';
    /** 小地图上其他车辆的标记:圆点 / 箭头(尖端指向车头)/ 军标 */
    minimapMarkers: 'dot' | 'arrow' | 'symbol';
    /** 地图符号规范:北约 / 华约 */
    symbology: Symbology;
    /** 显示操作提示条 */
    showHints: boolean;
    /** 显示帧率 */
    showFps: boolean;
    /** 离线挂机成长(关闭页面期间车组按时间成长,默认关闭) */
    offlineGrowth: boolean;
  };
  graphics: {
    preset: GraphicsPreset | 'custom';
    /** 阴影:关 / 低(1024)/ 高(2048) */
    shadows: 'off' | 'low' | 'high';
    /** 渲染分辨率倍数(乘在设备像素比上) */
    renderScale: number;
    /** 视距(雾的最远距离),m */
    viewDistance: number;
    /** 植被密度 0..1(下一局生效) */
    vegetation: number;
    /** 草丛渲染半径,m(下一局生效) */
    grassDistance: number;
    /** 抗锯齿(刷新页面后生效) */
    antialias: boolean;
  };
  sound: SoundSettings;
  controls: {
    /** 第三人称鼠标灵敏度倍数 */
    mouseSensitivity: number;
    /** 开镜后的灵敏度倍数(再乘上倍率带来的缩放) */
    sightSensitivity: number;
    /** 开镜后灵敏度按视场缩放(放大越多转得越慢) */
    scaleWithZoom: boolean;
    invertY: boolean;
    bindings: Bindings;
  };
}

export const GRAPHICS_PRESETS: Readonly<Record<GraphicsPreset, Omit<GameSettings['graphics'], 'preset' | 'antialias'>>> = {
  low: { shadows: 'off', renderScale: 0.75, viewDistance: 2500, vegetation: 0.4, grassDistance: 60 },
  medium: { shadows: 'low', renderScale: 1, viewDistance: 4000, vegetation: 0.7, grassDistance: 100 },
  high: { shadows: 'high', renderScale: 1, viewDistance: 6000, vegetation: 1, grassDistance: 150 },
};

export function defaultSettings(): GameSettings {
  return {
    game: { aiPreset: 'training', killCam: true, killCamAll: true, internalsStyle: 'world', deathReplayStyle: 'world', minimapShape: 'square', minimapMarkers: 'symbol', symbology: 'nato', showHints: true, showFps: false, offlineGrowth: false },
    graphics: { preset: 'medium', ...GRAPHICS_PRESETS.medium, antialias: true },
    sound: { ...DEFAULT_SOUND_SETTINGS },
    controls: { mouseSensitivity: 1, sightSensitivity: 1, scaleWithZoom: true, invertY: false, bindings: defaultBindings() },
  };
}

const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** 把任意来源(旧版本存档、手改的 JSON)的数据修正成合法设置,缺的字段用默认值 */
export function sanitize(raw: unknown): GameSettings {
  const d = defaultSettings();
  const r = (raw ?? {}) as Partial<Record<keyof GameSettings, Record<string, unknown>>>;
  const g = r.game ?? {};
  const gr = r.graphics ?? {};
  const c = r.controls ?? {};
  const bindings = defaultBindings();
  const rb = (c.bindings ?? {}) as Record<string, unknown>;
  const hasMapScreen = 'mapScreen' in rb && rb.mapScreen !== undefined;
  for (const a of ACTIONS) {
    const v = rb[a.id];
    if (Array.isArray(v)) {
      bindings[a.id] = [typeof v[0] === 'string' ? v[0] : null, typeof v[1] === 'string' ? v[1] : null];
    }
  }
  // 老存档迁移: bindings 里没有 mapScreen, 而 minimapShape 里有 KeyM 时,
  // 把 minimapShape 里的 KeyM 换成 null, 让 mapScreen 用默认的 M。
  if (!hasMapScreen) {
    const shape = bindings.minimapShape;
    bindings.minimapShape = [
      shape[0] === 'KeyM' ? null : shape[0],
      shape[1] === 'KeyM' ? null : shape[1],
    ];
  }
  return {
    game: {
      aiPreset: pick(g.aiPreset, ['training', 'guard'] as const, d.game.aiPreset),
      killCam: bool(g.killCam, d.game.killCam),
      killCamAll: bool(g.killCamAll, d.game.killCamAll),
      internalsStyle: pick(g.internalsStyle, ['world', 'panel'] as const, d.game.internalsStyle),
      deathReplayStyle: pick(g.deathReplayStyle, ['world', 'window'] as const, d.game.deathReplayStyle),
      minimapShape: pick(g.minimapShape, ['square', 'circle'] as const, d.game.minimapShape),
      minimapMarkers: pick(g.minimapMarkers, ['dot', 'arrow', 'symbol'] as const, d.game.minimapMarkers),
      symbology: pick(g.symbology, ['nato', 'warsaw'] as const, d.game.symbology),
      showHints: bool(g.showHints, d.game.showHints),
      showFps: bool(g.showFps, d.game.showFps),
      offlineGrowth: bool(g.offlineGrowth, d.game.offlineGrowth),
    },
    graphics: {
      preset: pick(gr.preset, ['low', 'medium', 'high', 'custom'] as const, d.graphics.preset),
      shadows: pick(gr.shadows, ['off', 'low', 'high'] as const, d.graphics.shadows),
      renderScale: clamp(gr.renderScale, 0.5, 1.5, d.graphics.renderScale),
      viewDistance: clamp(gr.viewDistance, 1000, 6000, d.graphics.viewDistance),
      vegetation: clamp(gr.vegetation, 0, 1, d.graphics.vegetation),
      grassDistance: clamp(gr.grassDistance, 0, 200, d.graphics.grassDistance),
      antialias: bool(gr.antialias, d.graphics.antialias),
    },
    sound: sanitizeSettings(r.sound as Partial<SoundSettings> | undefined, d.sound),
    controls: {
      mouseSensitivity: clamp(c.mouseSensitivity, 0.1, 5, d.controls.mouseSensitivity),
      sightSensitivity: clamp(c.sightSensitivity, 0.1, 5, d.controls.sightSensitivity),
      scaleWithZoom: bool(c.scaleWithZoom, d.controls.scaleWithZoom),
      invertY: bool(c.invertY, d.controls.invertY),
      bindings,
    },
  };
}

const STORAGE_KEY = 'webtank.settings.v1';

/** 设置的读写与变更通知 */
export class SettingsStore {
  private current: GameSettings;
  private readonly listeners = new Set<(s: GameSettings) => void>();

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage()) {
    let raw: unknown = null;
    try {
      const text = this.storage?.getItem(STORAGE_KEY);
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = null;
    }
    this.current = sanitize(raw);
  }

  get value(): GameSettings {
    return this.current;
  }

  /** 修改设置:传入一个修改函数(直接改草稿对象),完成后修正、保存并通知 */
  update(mutate: (draft: GameSettings) => void): void {
    const draft = JSON.parse(JSON.stringify(this.current)) as GameSettings;
    mutate(draft);
    this.current = sanitize(draft);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      /* 存不了就只在内存里生效 */
    }
    this.listeners.forEach((fn) => fn(this.current));
  }

  subscribe(fn: (s: GameSettings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
