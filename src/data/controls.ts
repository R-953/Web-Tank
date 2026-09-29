/**
 * 操作设置:所有可绑定的操作、默认键位和显示名。
 *
 * 键位用字符串表示,一个操作最多两个键位(主 / 副):
 *   - 键盘:KeyboardEvent.code,例如 'KeyW'、'Space'、'ShiftLeft'、'Digit1'(与键盘布局无关)
 *   - 鼠标:'MouseLeft' / 'MouseRight' / 'MouseMiddle' / 'MouseBack' / 'MouseForward'
 *   - 滚轮:'WheelUp' / 'WheelDown'(每滚一格触发一次)
 * 设置界面改的就是这份数据的副本(存在本机浏览器里),游戏逻辑只通过操作 id 读输入。
 */

export type ActionId =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'fireMain'
  | 'fireMg'
  | 'shell1'
  | 'shell2'
  | 'shell3'
  | 'shell4'
  | 'nextShell'
  | 'scope'
  | 'zoomCycle'
  | 'zoomIn'
  | 'zoomOut'
  | 'rangeUp'
  | 'rangeDown'
  | 'repair'
  | 'extinguish'
  | 'cursor'
  | 'minimapShape'
  | 'restart';

export type Binding = string | null;
export type BindingPair = [Binding, Binding];
export type Bindings = Record<ActionId, BindingPair>;

export type ActionGroup = '驾驶' | '武器' | '瞄准' | '车辆' | '界面';

export interface ActionDef {
  id: ActionId;
  name: string;
  group: ActionGroup;
  /** 补充说明(设置界面的小字) */
  hint?: string;
  /** War Thunder 键位文件里对应的操作 id(用于导入 .blk) */
  wt?: string;
  defaults: BindingPair;
}

export const ACTIONS: readonly ActionDef[] = [
  { id: 'forward', name: '前进', group: '驾驶', wt: 'gm_throttle_rangeMax', defaults: ['KeyW', 'ArrowUp'] },
  { id: 'back', name: '后退 / 刹车', group: '驾驶', wt: 'gm_throttle_rangeMin', defaults: ['KeyS', 'ArrowDown'] },
  { id: 'left', name: '左转', group: '驾驶', wt: 'gm_steering_rangeMin', defaults: ['KeyA', 'ArrowLeft'] },
  { id: 'right', name: '右转', group: '驾驶', wt: 'gm_steering_rangeMax', defaults: ['KeyD', 'ArrowRight'] },

  { id: 'fireMain', name: '主炮开火', group: '武器', wt: 'ID_FIRE_GM', defaults: ['MouseLeft', null] },
  { id: 'fireMg', name: '同轴机枪开火', group: '武器', wt: 'ID_FIRE_GM_MACHINE_GUN', defaults: ['Space', null] },
  { id: 'shell1', name: '选择弹种 1', group: '武器', defaults: ['Digit1', null] },
  { id: 'shell2', name: '选择弹种 2', group: '武器', defaults: ['Digit2', null] },
  { id: 'shell3', name: '选择弹种 3', group: '武器', defaults: ['Digit3', null] },
  { id: 'shell4', name: '选择弹种 4', group: '武器', defaults: ['Digit4', null] },
  { id: 'nextShell', name: '切换到下一种弹', group: '武器', wt: 'ID_NEXT_BULLET_TYPE', defaults: ['CapsLock', null] },

  { id: 'scope', name: '开镜 / 关镜', group: '瞄准', wt: 'ID_TOGGLE_VIEW_GM', defaults: ['ShiftLeft', 'ShiftRight'] },
  { id: 'zoomCycle', name: '循环切换瞄准镜倍率', group: '瞄准', defaults: ['KeyZ', null] },
  { id: 'zoomIn', name: '瞄准镜放大', group: '瞄准', wt: 'gm_zoom_rangeMax', defaults: ['PageUp', null] },
  { id: 'zoomOut', name: '瞄准镜缩小', group: '瞄准', wt: 'gm_zoom_rangeMin', defaults: ['PageDown', null] },
  { id: 'rangeUp', name: '表尺加远', group: '瞄准', hint: '每次 +50 m', wt: 'gm_sight_distance_rangeMax', defaults: ['WheelDown', null] },
  { id: 'rangeDown', name: '表尺减近', group: '瞄准', hint: '每次 −50 m', wt: 'gm_sight_distance_rangeMin', defaults: ['WheelUp', null] },

  { id: 'repair', name: '维修 / 取消维修', group: '车辆', wt: 'ID_REPAIR_TANK', defaults: ['KeyF', null] },
  { id: 'extinguish', name: '灭火', group: '车辆', defaults: ['Digit6', null] },

  { id: 'cursor', name: '显示光标(按住,操作小地图)', group: '界面', hint: '此时鼠标不再控制视角和开火', defaults: ['AltLeft', null] },
  { id: 'minimapShape', name: '小地图:方形 / 圆形', group: '界面', defaults: ['KeyM', null] },
  { id: 'restart', name: '重新开始本局', group: '界面', hint: '也可以在 Esc 菜单里选', defaults: [null, null] },
];

export const ACTION_BY_ID: Readonly<Record<ActionId, ActionDef>> = Object.fromEntries(ACTIONS.map((a) => [a.id, a])) as Record<
  ActionId,
  ActionDef
>;

export function defaultBindings(): Bindings {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, [...a.defaults] as BindingPair])) as Bindings;
}

/** DOM MouseEvent.button → 键位名 */
export const MOUSE_BUTTON_NAMES = ['MouseLeft', 'MouseMiddle', 'MouseRight', 'MouseBack', 'MouseForward'] as const;

const KEY_LABELS: Record<string, string> = {
  Space: '空格',
  ShiftLeft: '左 Shift',
  ShiftRight: '右 Shift',
  ControlLeft: '左 Ctrl',
  ControlRight: '右 Ctrl',
  AltLeft: '左 Alt',
  AltRight: '右 Alt',
  CapsLock: 'Caps Lock',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Escape: 'Esc',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Home: 'Home',
  End: 'End',
  Insert: 'Ins',
  Delete: 'Del',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  MouseLeft: '鼠标左键',
  MouseRight: '鼠标右键',
  MouseMiddle: '鼠标中键',
  MouseBack: '鼠标侧键 4',
  MouseForward: '鼠标侧键 5',
  WheelUp: '滚轮上',
  WheelDown: '滚轮下',
};

/** 键位的显示名 */
export function bindingLabel(b: Binding): string {
  if (!b) return '—';
  if (KEY_LABELS[b]) return KEY_LABELS[b];
  if (b.startsWith('Key')) return b.slice(3);
  if (b.startsWith('Digit')) return b.slice(5);
  if (b.startsWith('Numpad')) return `小键盘 ${b.slice(6)}`;
  if (/^F\d+$/.test(b)) return b;
  return b;
}

/** 键位的简短显示名(HUD 快捷栏用) */
export function bindingShort(b: Binding): string {
  if (!b) return '';
  const short: Record<string, string> = {
    MouseLeft: 'LMB',
    MouseRight: 'RMB',
    MouseMiddle: 'MMB',
    MouseBack: 'M4',
    MouseForward: 'M5',
    WheelUp: '滚↑',
    WheelDown: '滚↓',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    AltLeft: 'Alt',
    AltRight: 'Alt',
    Space: 'Space',
    CapsLock: 'Caps',
  };
  return short[b] ?? bindingLabel(b);
}

/** 哪些操作用到了同一个键位(设置界面标红提示冲突) */
export function findConflicts(bindings: Bindings): Map<string, ActionId[]> {
  const byKey = new Map<string, ActionId[]>();
  for (const a of ACTIONS) {
    for (const b of bindings[a.id]) {
      if (!b) continue;
      const list = byKey.get(b) ?? [];
      if (!list.includes(a.id)) list.push(a.id);
      byKey.set(b, list);
    }
  }
  for (const [k, list] of byKey) if (list.length < 2) byKey.delete(k);
  return byKey;
}
