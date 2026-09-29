import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InputManager, MOUSE_SPIKE, isMouseSpike, type InputEventSource } from '../src/engine/Input';
import { ActionInput } from '../src/engine/ActionInput';
import { OrbitCamera } from '../src/engine/OrbitCamera';
import { defaultBindings } from '../src/data/controls';
import { readPlayerControls } from '../src/game/PlayerController';

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
  const actions = new ActionInput(input, defaultBindings());
  return { src, input, actions };
}

describe('ActionInput:按操作读输入', () => {
  it('默认键位:W 前进、左键主炮、空格机枪、下滚两格 = 表尺加远两次', () => {
    const { src, input, actions } = setup();
    src.emit('keydown', { code: 'KeyW' });
    src.emit('mousedown', { button: 0 });
    src.emit('keydown', { code: 'Space' });
    src.emit('wheel', { deltaY: 100 });
    src.emit('wheel', { deltaY: 100 });
    actions.beginFrame();
    expect(actions.isDown('forward')).toBe(true);
    expect(actions.isDown('back')).toBe(false);
    expect(actions.pressed('fireMain')).toBe(true);
    expect(actions.isDown('fireMg')).toBe(true);
    expect(actions.count('rangeUp')).toBe(2);
    expect(actions.count('rangeDown')).toBe(0);
    const c = readPlayerControls(actions, null, true, 400);
    expect(c.throttle).toBe(1);
    expect(c.fire).toBe(true);
    expect(c.fireMg).toBe(true);
    expect(c.sightRange).toBe(400);
    input.endFrame();
    actions.beginFrame();
    expect(actions.pressed('fireMain')).toBe(false);
    expect(actions.isDown('fireMain')).toBe(true);
    expect(actions.count('rangeUp')).toBe(0);
  });

  it('改键后旧键失效,新键生效;鼠标侧键也能绑', () => {
    const { src, actions } = setup();
    const b = defaultBindings();
    b.forward = ['KeyI', null];
    b.repair = ['MouseBack', null];
    actions.setBindings(b);
    src.emit('keydown', { code: 'KeyW' });
    src.emit('mousedown', { button: 3 });
    actions.beginFrame();
    expect(actions.isDown('forward')).toBe(false);
    expect(actions.pressed('repair')).toBe(true);
    src.emit('keydown', { code: 'KeyI' });
    expect(actions.isDown('forward')).toBe(true);
  });

  it('光标模式(mouseEnabled = false):鼠标按键和滚轮操作失效,键盘照常,滚轮原始格数仍可读', () => {
    const { src, actions } = setup();
    actions.mouseEnabled = false;
    src.emit('mousedown', { button: 0 });
    src.emit('keydown', { code: 'KeyW' });
    src.emit('wheel', { deltaY: -100 });
    actions.beginFrame();
    expect(actions.isDown('fireMain')).toBe(false);
    expect(actions.pressed('fireMain')).toBe(false);
    expect(actions.count('rangeDown')).toBe(0);
    expect(actions.isDown('forward')).toBe(true);
    expect(actions.wheel()).toEqual({ up: 1, down: 0 });
  });

  it('只拦截绑定了的按键的浏览器默认行为(包括鼠标侧键的后退)', () => {
    const { src, input, actions } = setup();
    input.setPreventDefault((code) => actions.isBound(code));
    let prevented = 0;
    const ev = (extra: object) => ({ ...extra, preventDefault: () => prevented++ });
    src.emit('keydown', ev({ code: 'Space' }));
    src.emit('keyup', ev({ code: 'Space' }));
    expect(prevented).toBe(2);
    src.emit('keydown', ev({ code: 'KeyJ' }));
    expect(prevented).toBe(2);
    src.emit('mouseup', ev({ button: 3 }));
    expect(prevented).toBe(2);
    const b = defaultBindings();
    b.repair = ['MouseBack', null];
    actions.setBindings(b);
    src.emit('mouseup', ev({ button: 3 }));
    expect(prevented).toBe(3);
  });
});

describe('鼠标位移尖峰过滤(视角突然转 180° 的问题)', () => {
  it('isMouseSpike:静止时的单个几百像素事件是尖峰;平均值大时不是', () => {
    expect(isMouseSpike(900, 0, 0)).toBe(true);
    expect(isMouseSpike(0, -700, 5)).toBe(true);
    expect(isMouseSpike(200, 0, 0)).toBe(false);
    expect(isMouseSpike(500, 0, 150)).toBe(false);
  });

  it('慢速移动中夹着一个孤立的尖峰:尖峰被丢弃,其余照常累加', () => {
    const { src, input } = setup();
    for (let i = 0; i < 10; i++) src.emit('mousemove', { movementX: 8, movementY: 2 });
    src.emit('mousemove', { movementX: -1200, movementY: 40 });
    src.emit('mousemove', { movementX: 8, movementY: 2 });
    expect(input.consumeMouseDelta()).toEqual({ dx: 88, dy: 22 });
    expect(input.droppedSpikes).toBe(1);
  });

  it('逐渐加速的快速甩动不会被误伤', () => {
    const { src, input } = setup();
    const moves = [40, 120, 250, 400, 600, 700, 500];
    for (const m of moves) src.emit('mousemove', { movementX: m, movementY: 0 });
    expect(input.consumeMouseDelta().dx).toBe(moves.reduce((a, b) => a + b, 0));
    expect(input.droppedSpikes).toBe(0);
  });

  it(`连续 ${MOUSE_SPIKE.maxRun} 个以上的大位移(超高灵敏度)按真实移动处理`, () => {
    const { src, input } = setup();
    for (let i = 0; i < 5; i++) src.emit('mousemove', { movementX: 800, movementY: 0 });
    expect(input.consumeMouseDelta().dx).toBe(4000);
  });
});

describe('视角灵敏度设置', () => {
  const cam = () => new OrbitCamera(new THREE.PerspectiveCamera());

  it('第三人称:灵敏度倍数线性放大;反转 Y 轴', () => {
    const a = cam();
    const b = cam();
    b.setSensitivity({ mouse: 2, sight: 1, scaleWithZoom: true, invertY: true });
    const pa = a.pitch;
    const pb = b.pitch;
    a.rotate(10, 5);
    b.rotate(10, 5);
    expect(b.yaw).toBeCloseTo(a.yaw * 2, 6);
    expect(b.pitch - pb).toBeCloseTo(-(a.pitch - pa) * 2, 6);
  });

  it('开镜:随倍率缩放时 5× 比 2.5× 转得慢一半;关掉缩放后只按 1/√倍率', () => {
    const turn = (mag: number, scale: boolean) => {
      const c = cam();
      c.setSensitivity({ mouse: 1, sight: 1, scaleWithZoom: scale, invertY: false });
      c.setSight(mag);
      c.rotate(10, 0);
      return -c.yaw;
    };
    expect(turn(5, true) / turn(2.5, true)).toBeCloseTo(0.5, 6);
    expect(turn(4, false) / turn(1, false)).toBeCloseTo(0.5, 6);
  });

  it('单次转动有上限:异常的巨大位移最多转 0.5 rad', () => {
    const c = cam();
    c.rotate(100000, 0);
    expect(Math.abs(c.yaw)).toBeLessThanOrEqual(0.5 + 1e-9);
  });
});
