import { describe, it, expect } from 'vitest';
import { InputManager, type InputEventSource } from '../src/engine/Input';

class FakeSource implements InputEventSource {
  private readonly listeners = new Map<string, Set<(e: Event) => void>>();
  addEventListener(type: string, fn: (e: Event) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: (e: Event) => void): void {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type: string, data: object = {}): void {
    this.listeners.get(type)?.forEach((fn) => fn(data as unknown as Event));
  }
}

function setup() {
  const src = new FakeSource();
  const input = new InputManager();
  input.attach(src);
  return { src, input };
}

describe('InputManager', () => {
  it('按下与松开', () => {
    const { src, input } = setup();
    src.emit('keydown', { code: 'KeyW' });
    expect(input.isDown('KeyW')).toBe(true);
    src.emit('keyup', { code: 'KeyW' });
    expect(input.isDown('KeyW')).toBe(false);
  });

  it('wasPressed 只在按下的那一帧为真,按住自动重复不算', () => {
    const { src, input } = setup();
    src.emit('keydown', { code: 'KeyR' });
    expect(input.wasPressed('KeyR')).toBe(true);
    input.endFrame();
    src.emit('keydown', { code: 'KeyR', repeat: true });
    expect(input.wasPressed('KeyR')).toBe(false);
    expect(input.isDown('KeyR')).toBe(true);
  });

  it('滚轮:一格算一步,向前滚为负;按行滚动(Firefox)也换算成格;触控板小增量攒够半格才算', () => {
    const { src, input } = setup();
    expect(input.consumeWheelSteps()).toBe(0);
    src.emit('wheel', { deltaY: -100 });
    src.emit('wheel', { deltaY: -100 });
    expect(input.consumeWheelSteps()).toBe(-2);
    expect(input.consumeWheelSteps()).toBe(0);
    src.emit('wheel', { deltaY: 3, deltaMode: 1 });
    expect(input.consumeWheelSteps()).toBe(1);
    src.emit('wheel', { deltaY: 20 });
    expect(input.consumeWheelSteps()).toBe(0);
    src.emit('wheel', { deltaY: 20 });
    src.emit('wheel', { deltaY: 20 });
    expect(input.consumeWheelSteps()).toBe(1);
  });

  it('窗口失焦时清空所有按键,避免按键卡住', () => {
    const { src, input } = setup();
    src.emit('keydown', { code: 'KeyW' });
    src.emit('mousedown', { button: 0 });
    src.emit('blur');
    expect(input.isDown('KeyW')).toBe(false);
    expect(input.isMouseDown(0)).toBe(false);
  });

  it('鼠标位移累加,取走后清零', () => {
    const { src, input } = setup();
    src.emit('mousemove', { movementX: 3, movementY: -2 });
    src.emit('mousemove', { movementX: 4, movementY: 1 });
    expect(input.consumeMouseDelta()).toEqual({ dx: 7, dy: -1 });
    expect(input.consumeMouseDelta()).toEqual({ dx: 0, dy: 0 });
  });

  it('detach 之后不再响应事件', () => {
    const { src, input } = setup();
    input.detach();
    src.emit('keydown', { code: 'KeyW' });
    expect(input.isDown('KeyW')).toBe(false);
  });
});
