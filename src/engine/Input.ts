import { MOUSE_BUTTON_NAMES } from '../data/controls';

/** 可挂载的事件源(window 或测试里的假对象) */
export interface InputEventSource {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

interface Cancelable {
  preventDefault?: () => void;
}
interface KeyLike extends Cancelable {
  code: string;
  repeat?: boolean;
}
interface MouseButtonLike extends Cancelable {
  button: number;
}
interface MouseMoveLike {
  movementX?: number;
  movementY?: number;
}
interface WheelLike {
  deltaY?: number;
  deltaMode?: number;
}

/**
 * 鼠标位移「尖峰」过滤参数。
 * Chrome 在指针锁定下偶尔会送来一个位移极大的 mousemove(几百到上千像素,方向常常是反的),
 * 视角就会突然转过去 180°。真实的鼠标移动是连续加速的,单个事件突然比最近的平均值大很多倍,基本可以断定是尖峰。
 *   absolute:单个事件的位移(x / y 取大者)超过它才可能被判为尖峰,像素
 *   ratio / floor:同时还要超过 ratio × (最近平均位移 + floor)
 *   emaAlpha:最近平均位移(指数滑动平均)的更新系数
 *   idleDecay:某一帧没有鼠标事件时,平均值按这个比例衰减(停下来之后阈值回落)
 *   maxRun:连续这么多个事件都被判为尖峰时,认为是真的在高速甩动(超高 DPI / 超高灵敏度),照单全收
 */
export const MOUSE_SPIKE = { absolute: 300, ratio: 8, floor: 30, emaAlpha: 0.25, idleDecay: 0.85, maxRun: 3 };

/** 这个鼠标事件是不是尖峰(纯函数,方便测试) */
export function isMouseSpike(dx: number, dy: number, recentAvg: number): boolean {
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  return m > MOUSE_SPIKE.absolute && m > MOUSE_SPIKE.ratio * (recentAvg + MOUSE_SPIKE.floor);
}

/**
 * 键盘 + 鼠标输入。按键用 KeyboardEvent.code(如 'KeyW'、'Space'),与键盘布局无关。
 * 不在 import 时挂监听,需要显式 attach(),方便测试。
 */
export class InputManager {
  private readonly keysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();
  private readonly buttonsDown = new Set<number>();
  private readonly buttonsPressed = new Set<number>();
  private mouseDX = 0;
  private mouseDY = 0;
  private wheel = 0;
  private detachers: Array<() => void> = [];
  /** 最近鼠标位移的滑动平均(像素 / 事件) */
  private mouseAvg = 0;
  private movedThisFrame = false;
  /** 连续被判为尖峰的事件(先扣下,凑够 maxRun 个才放行) */
  private spikeRun: Array<{ dx: number; dy: number }> = [];
  private preventFn: ((binding: string) => boolean) | null = null;
  /** 被丢弃的尖峰事件数(调试用) */
  droppedSpikes = 0;

  attach(source: InputEventSource): void {
    this.detach();
    const on = <E>(type: string, fn: (e: E) => void) => {
      const listener = (event: Event) => fn(event as unknown as E);
      source.addEventListener(type, listener);
      this.detachers.push(() => source.removeEventListener(type, listener));
    };
    on<KeyLike>('keydown', (e) => {
      if (this.preventFn?.(e.code)) e.preventDefault?.();
      if (!e.repeat && !this.keysDown.has(e.code)) this.keysPressed.add(e.code);
      this.keysDown.add(e.code);
    });
    on<KeyLike>('keyup', (e) => {
      if (this.preventFn?.(e.code)) e.preventDefault?.();
      this.keysDown.delete(e.code);
    });
    on<MouseButtonLike>('mousedown', (e) => {
      if (this.preventMouse(e.button)) e.preventDefault?.();
      if (!this.buttonsDown.has(e.button)) this.buttonsPressed.add(e.button);
      this.buttonsDown.add(e.button);
    });
    on<MouseButtonLike>('mouseup', (e) => {
      // 侧键的「后退 / 前进」在 mouseup 时触发浏览器导航,绑定了就要拦下来
      if (this.preventMouse(e.button)) e.preventDefault?.();
      this.buttonsDown.delete(e.button);
    });
    on<MouseMoveLike>('mousemove', (e) => this.onMouseMove(e.movementX ?? 0, e.movementY ?? 0));
    on<WheelLike>('wheel', (e) => {
      // deltaMode 1 = 行、2 = 页;统一换算成像素(Chrome 一格约 100 像素,Firefox 一格约 3 行)
      const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1;
      this.wheel += (e.deltaY ?? 0) * scale;
    });
    // 切窗口时 keyup 收不到,不清空的话按键会「卡住」
    on('blur', () => this.reset());
  }

  detach(): void {
    this.detachers.forEach((d) => d());
    this.detachers = [];
  }

  /**
   * 设置哪些按键要拦截浏览器默认行为(例如 Alt 聚焦菜单、Space 滚动页面、Tab 切焦点、侧键后退)。
   * fn 收到键位名(KeyboardEvent.code 或 'MouseBack' 等),返回 true 就 preventDefault;null = 都不拦。
   */
  setPreventDefault(fn: ((binding: string) => boolean) | null): void {
    this.preventFn = fn;
  }

  isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  /** 本帧(上次 endFrame 之后)是否刚按下 */
  wasPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  isMouseDown(button = 0): boolean {
    return this.buttonsDown.has(button);
  }

  wasMousePressed(button = 0): boolean {
    return this.buttonsPressed.has(button);
  }

  /** 取走累计的鼠标位移(已滤掉尖峰) */
  consumeMouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  /** 取走累计的滚轮格数(向下滚为正,约 1 格 = 1) */
  consumeWheelSteps(): number {
    // 一格滚轮 ≈ 100 像素;触控板的小增量先攒着,凑够半格再算一格
    const steps = Math.trunc(this.wheel / 100 + Math.sign(this.wheel) * 0.5);
    this.wheel -= steps * 100;
    return steps;
  }

  /** 取走累计的滚轮格数,按方向分开:up = 向上(远离自己)滚了几格,down = 向下滚了几格 */
  consumeWheel(): { up: number; down: number } {
    const steps = this.consumeWheelSteps();
    return { up: Math.max(0, -steps), down: Math.max(0, steps) };
  }

  /** 每帧末尾调用,清空「刚按下」状态 */
  endFrame(): void {
    this.keysPressed.clear();
    this.buttonsPressed.clear();
    if (!this.movedThisFrame) this.mouseAvg *= MOUSE_SPIKE.idleDecay;
    this.movedThisFrame = false;
  }

  reset(): void {
    this.keysDown.clear();
    this.keysPressed.clear();
    this.buttonsDown.clear();
    this.buttonsPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.mouseAvg = 0;
    this.spikeRun = [];
  }

  private preventMouse(button: number): boolean {
    const name = MOUSE_BUTTON_NAMES[button];
    return !!name && !!this.preventFn?.(name);
  }

  private onMouseMove(dx: number, dy: number): void {
    this.movedThisFrame = true;
    if (isMouseSpike(dx, dy, this.mouseAvg)) {
      this.spikeRun.push({ dx, dy });
      if (this.spikeRun.length < MOUSE_SPIKE.maxRun) return;
      // 连续多个「尖峰」:其实是真的在高速甩鼠标,全部补上
      for (const s of this.spikeRun) this.accept(s.dx, s.dy);
      this.spikeRun = [];
      return;
    }
    // 之前扣下的是孤立的尖峰:丢掉
    this.droppedSpikes += this.spikeRun.length;
    this.spikeRun = [];
    this.accept(dx, dy);
  }

  private accept(dx: number, dy: number): void {
    this.mouseDX += dx;
    this.mouseDY += dy;
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    this.mouseAvg += (m - this.mouseAvg) * MOUSE_SPIKE.emaAlpha;
  }
}
