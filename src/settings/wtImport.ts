import { ACTIONS, type ActionId, type Binding, type Bindings } from '../data/controls';

/**
 * 从 War Thunder 的操作设置文件(.blk,例如「Gaijin Live.blk」)导入坦克相关的键位。
 *
 * .blk 的 hotkeys 段里,每个 `ID_XXX{ ... }` 块是一组组合键,同一个 ID 可以出现多次(多个备选键位):
 *   keyboardKey:i=N  DirectInput 扫描码(DIK)
 *   mouseButton:i=N  0 左键、1 右键、2 中键、3 / 4 侧键、5 滚轮上、6 滚轮下
 * 本游戏每个操作只支持单键,所以多键组合(如 Alt + X)会被跳过并计数。
 * 文件里没写的操作沿用 War Thunder 默认值,这里也就保持本游戏当前的键位不变。
 */

/** DirectInput 扫描码 → KeyboardEvent.code */
export const DIK_TO_CODE: Readonly<Record<number, string>> = {
  1: 'Escape',
  2: 'Digit1',
  3: 'Digit2',
  4: 'Digit3',
  5: 'Digit4',
  6: 'Digit5',
  7: 'Digit6',
  8: 'Digit7',
  9: 'Digit8',
  10: 'Digit9',
  11: 'Digit0',
  12: 'Minus',
  13: 'Equal',
  14: 'Backspace',
  15: 'Tab',
  16: 'KeyQ',
  17: 'KeyW',
  18: 'KeyE',
  19: 'KeyR',
  20: 'KeyT',
  21: 'KeyY',
  22: 'KeyU',
  23: 'KeyI',
  24: 'KeyO',
  25: 'KeyP',
  26: 'BracketLeft',
  27: 'BracketRight',
  28: 'Enter',
  29: 'ControlLeft',
  30: 'KeyA',
  31: 'KeyS',
  32: 'KeyD',
  33: 'KeyF',
  34: 'KeyG',
  35: 'KeyH',
  36: 'KeyJ',
  37: 'KeyK',
  38: 'KeyL',
  39: 'Semicolon',
  40: 'Quote',
  41: 'Backquote',
  42: 'ShiftLeft',
  43: 'Backslash',
  44: 'KeyZ',
  45: 'KeyX',
  46: 'KeyC',
  47: 'KeyV',
  48: 'KeyB',
  49: 'KeyN',
  50: 'KeyM',
  51: 'Comma',
  52: 'Period',
  53: 'Slash',
  54: 'ShiftRight',
  55: 'NumpadMultiply',
  56: 'AltLeft',
  57: 'Space',
  58: 'CapsLock',
  59: 'F1',
  60: 'F2',
  61: 'F3',
  62: 'F4',
  63: 'F5',
  64: 'F6',
  65: 'F7',
  66: 'F8',
  67: 'F9',
  68: 'F10',
  69: 'NumLock',
  70: 'ScrollLock',
  71: 'Numpad7',
  72: 'Numpad8',
  73: 'Numpad9',
  74: 'NumpadSubtract',
  75: 'Numpad4',
  76: 'Numpad5',
  77: 'Numpad6',
  78: 'NumpadAdd',
  79: 'Numpad1',
  80: 'Numpad2',
  81: 'Numpad3',
  82: 'Numpad0',
  83: 'NumpadDecimal',
  87: 'F11',
  88: 'F12',
  156: 'NumpadEnter',
  157: 'ControlRight',
  181: 'NumpadDivide',
  183: 'PrintScreen',
  184: 'AltRight',
  197: 'Pause',
  199: 'Home',
  200: 'ArrowUp',
  201: 'PageUp',
  203: 'ArrowLeft',
  205: 'ArrowRight',
  207: 'End',
  208: 'ArrowDown',
  209: 'PageDown',
  210: 'Insert',
  211: 'Delete',
};

/** War Thunder 鼠标按键编号 → 本游戏键位名 */
export const WT_MOUSE_TO_BINDING: Readonly<Record<number, string>> = {
  0: 'MouseLeft',
  1: 'MouseRight',
  2: 'MouseMiddle',
  3: 'MouseBack',
  4: 'MouseForward',
  5: 'WheelUp',
  6: 'WheelDown',
};

export interface WtHotkey {
  id: string;
  /** 这一组里的键位(多于一个即组合键) */
  keys: string[];
  /** 有无法识别的扫描码 */
  unknown: boolean;
}

/** 解析 .blk 的 hotkeys 段,按出现顺序返回每个键位块 */
export function parseWtHotkeys(text: string): WtHotkey[] {
  const start = text.indexOf('hotkeys{');
  if (start < 0) return [];
  // 找到 hotkeys{ 对应的右括号
  let depth = 0;
  let end = text.length;
  for (let i = start + 'hotkeys'.length; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = text.slice(start + 'hotkeys{'.length, end);
  const out: WtHotkey[] = [];
  const re = /([A-Za-z0-9_]+)\s*\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const keys: string[] = [];
    let unknown = false;
    const inner = m[2];
    const keyRe = /(keyboardKey|mouseButton):i=(\d+)/g;
    let k: RegExpExecArray | null;
    while ((k = keyRe.exec(inner))) {
      const n = Number(k[2]);
      const code = k[1] === 'keyboardKey' ? DIK_TO_CODE[n] : WT_MOUSE_TO_BINDING[n];
      if (code) keys.push(code);
      else unknown = true;
    }
    out.push({ id: m[1], keys, unknown });
  }
  return out;
}

export interface WtImportResult {
  bindings: Bindings;
  /** 被导入(改动)的操作及其新键位 */
  applied: { action: ActionId; bindings: Binding[] }[];
  /** 跳过的组合键数量(本游戏只支持单键) */
  skippedCombos: number;
  /** 文件里认识的坦克操作数量(包括空的) */
  recognized: number;
}

/**
 * 把 War Thunder 键位合并到当前键位上:文件里给出了单键的操作,用文件里的键位(最多两个)替换;
 * 其它操作保持不变。文件里写了空块(清空了默认键)的操作也保持不变,因为本游戏的默认键不一定和 WT 相同。
 */
export function importWtBindings(text: string, current: Bindings): WtImportResult {
  const hotkeys = parseWtHotkeys(text);
  const byWt = new Map(ACTIONS.filter((a) => a.wt).map((a) => [a.wt!, a.id] as const));
  const collected = new Map<ActionId, string[]>();
  let skippedCombos = 0;
  let recognized = 0;
  const seen = new Set<string>();
  for (const h of hotkeys) {
    const action = byWt.get(h.id);
    if (!action) continue;
    if (!seen.has(h.id)) recognized++;
    seen.add(h.id);
    if (h.keys.length > 1) {
      skippedCombos++;
      continue;
    }
    if (h.keys.length === 1 && !h.unknown) {
      const list = collected.get(action) ?? [];
      if (!list.includes(h.keys[0])) list.push(h.keys[0]);
      collected.set(action, list);
    }
  }
  const bindings = structuredCloneBindings(current);
  const applied: WtImportResult['applied'] = [];
  for (const [action, keys] of collected) {
    const pair: [Binding, Binding] = [keys[0] ?? null, keys[1] ?? null];
    bindings[action] = pair;
    applied.push({ action, bindings: pair });
  }
  return { bindings, applied, skippedCombos, recognized };
}

function structuredCloneBindings(b: Bindings): Bindings {
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, [...v]])) as Bindings;
}
