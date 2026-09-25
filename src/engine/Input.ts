/** 可挂载的事件源(window 或测试里的假对象) */
export interface InputEventSource {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

interface KeyLike {
  code: string;
  repeat?: boolean;
}
interface MouseButtonLike {
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

  attach(source: InputEventSource): void {
    this.detach();
    const on = <E>(type: string, fn: (e: E) => void) => {
      const listener = (event: Event) => fn(event as unknown as E);
      source.addEventListener(type, listener);
      this.detachers.push(() => source.removeEventListener(type, listener));
    };
    on<KeyLike>('keydown', (e) => {
      if (!e.repeat && !this.keysDown.has(e.code)) this.keysPressed.add(e.code);
      this.keysDown.add(e.code);
    });
    on<KeyLike>('keyup', (e) => this.keysDown.delete(e.code));
    on<MouseButtonLike>('mousedown', (e) => {
      if (!this.buttonsDown.has(e.button)) this.buttonsPressed.add(e.button);
      this.buttonsDown.add(e.button);
    });
    on<MouseButtonLike>('mouseup', (e) => this.buttonsDown.delete(e.button));
    on<MouseMoveLike>('mousemove', (e) => {
      this.mouseDX += e.movementX ?? 0;
      this.mouseDY += e.movementY ?? 0;
    });
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

  /** 取走累计的鼠标位移 */
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

  /** 每帧末尾调用,清空「刚按下」状态 */
  endFrame(): void {
    this.keysPressed.clear();
    this.buttonsPressed.clear();
  }

  reset(): void {
    this.keysDown.clear();
    this.keysPressed.clear();
    this.buttonsDown.clear();
    this.buttonsPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
