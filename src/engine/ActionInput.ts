import { ACTIONS, MOUSE_BUTTON_NAMES, type ActionId, type Bindings } from '../data/controls';
import type { InputManager } from './Input';

const MOUSE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(MOUSE_BUTTON_NAMES.map((n, i) => [n, i]));
const isMouse = (b: string) => b in MOUSE_INDEX;
const isWheel = (b: string) => b === 'WheelUp' || b === 'WheelDown';

/**
 * 按「操作」读输入:键位表(data/controls.ts,玩家可在设置里改)把键盘 / 鼠标 / 滚轮映射到操作 id,
 * 游戏逻辑只问「前进键按着没有」「表尺加远触发了几次」,不关心具体是哪个键。
 * 每帧先调 beginFrame()(取走滚轮格数),再查询;帧末由 InputManager.endFrame() 清空「刚按下」。
 */
export class ActionInput {
  /** false = Alt 光标模式:绑定在鼠标按键和滚轮上的操作全部失效(键盘照常) */
  mouseEnabled = true;
  private bindings!: Bindings;
  private readonly bound = new Set<string>();
  private wheelFrame = { up: 0, down: 0 };

  constructor(
    private readonly input: InputManager,
    bindings: Bindings,
  ) {
    this.setBindings(bindings);
  }

  setBindings(b: Bindings): void {
    this.bindings = b;
    this.bound.clear();
    for (const a of ACTIONS) for (const k of b[a.id] ?? []) if (k) this.bound.add(k);
  }

  /** 每帧查询前调用一次:取走本帧的滚轮格数 */
  beginFrame(): void {
    this.wheelFrame = this.input.consumeWheel();
  }

  /** 按住(键盘 / 鼠标按键);滚轮操作没有「按住」 */
  isDown(a: ActionId): boolean {
    return this.keys(a).some((k) => {
      if (isWheel(k)) return false;
      if (isMouse(k)) return this.mouseEnabled && this.input.isMouseDown(MOUSE_INDEX[k]);
      return this.input.isDown(k);
    });
  }

  /** 本帧刚按下,或本帧滚到了绑定的滚轮方向 */
  pressed(a: ActionId): boolean {
    return this.count(a) > 0;
  }

  /** 本帧触发了几次:滚轮每格算一次,按键按下算一次 */
  count(a: ActionId): number {
    let n = 0;
    for (const k of this.keys(a)) {
      if (k === 'WheelUp') n += this.mouseEnabled ? this.wheelFrame.up : 0;
      else if (k === 'WheelDown') n += this.mouseEnabled ? this.wheelFrame.down : 0;
      else if (isMouse(k)) n += this.mouseEnabled && this.input.wasMousePressed(MOUSE_INDEX[k]) ? 1 : 0;
      else n += this.input.wasPressed(k) ? 1 : 0;
    }
    return n;
  }

  /** 本帧的滚轮格数(不受 mouseEnabled 影响,光标模式下给小地图缩放用) */
  wheel(): { up: number; down: number } {
    return { ...this.wheelFrame };
  }

  /** 这个键位(KeyboardEvent.code 或鼠标键名)有没有绑定到任何操作 */
  isBound(code: string): boolean {
    return this.bound.has(code);
  }

  private keys(a: ActionId): string[] {
    return (this.bindings[a] ?? []).filter((k): k is string => !!k);
  }
}
