import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { KillCam, killcamRect, KILLCAM } from '../src/ui/KillCam';
import type { HitReplay } from '../src/game/Game';
import { SHOOTER, TARGET } from './fixtures';

function makeReplay(spec = SHOOTER, destroyed = true): HitReplay {
  return {
    spec,
    shell: spec.weapons[0]?.ammo[0] ?? SHOOTER.weapons[0].ammo[0],
    turretYaw: 0,
    gunPitch: 0,
    part: 'hull',
    entry: new THREE.Vector3(0, 0.5, -1),
    dir: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 0, -1),
    armor: {
      face: 'front',
      armor: 80,
      angleDeg: 0,
      effectiveArmor: 80,
      penetration: 100,
      penetrated: true,
      ricochet: false,
    },
    external: [],
    penetration: {
      entry: new THREE.Vector3(0, 0.5, -1),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [],
      explosion: null,
      hits: [],
      fuseArmed: true,
      detonated: false,
      knockedOut: true,
      duration: 0.2,
    },
    before: {},
    after: {},
    layout: {
      modules: [],
      crew: [],
    },
    destroyed,
    detonated: false,
  };
}

describe('killcamRect 视口位置与尺寸', () => {
  it('killcamRect("corner", …) 和右上角传统位置一致', () => {
    const rect1920 = killcamRect('corner', 1920, 1080);
    expect(rect1920).toEqual({
      x: 1920 - KILLCAM.width - KILLCAM.margin,
      y: KILLCAM.margin,
      w: KILLCAM.width,
      h: KILLCAM.height,
    });

    const rect1280 = killcamRect('corner', 1280, 720);
    expect(rect1280).toEqual({
      x: 1280 - KILLCAM.width - KILLCAM.margin,
      y: KILLCAM.margin,
      w: KILLCAM.width,
      h: KILLCAM.height,
    });
  });

  it('killcamRect("full", 1920, 1080) 覆盖画面中心、宽度至少占 80%', () => {
    const rect = killcamRect('full', 1920, 1080);
    // 宽度至少占 80%
    expect(rect.w).toBeGreaterThanOrEqual(1920 * 0.8);
    // 水平与垂直对称覆盖画面中心
    expect(rect.x + rect.w / 2).toBeCloseTo(1920 / 2, 1);
    expect(rect.y + rect.h / 2).toBeCloseTo(1080 / 2, 1);
    // 中心点位于矩形内部
    expect(rect.x).toBeLessThanOrEqual(1920 / 2);
    expect(rect.x + rect.w).toBeGreaterThanOrEqual(1920 / 2);
    expect(rect.y).toBeLessThanOrEqual(1080 / 2);
    expect(rect.y + rect.h).toBeGreaterThanOrEqual(1080 / 2);
  });

  it('killcamRect 在不同分辨率下均保持中心对称与合理的边界', () => {
    for (const [w, h] of [[800, 600], [1366, 768], [2560, 1440]]) {
      const full = killcamRect('full', w, h);
      expect(full.w).toBeGreaterThanOrEqual(w * 0.8);
      expect(full.x + full.w / 2).toBeCloseTo(w / 2, 1);
      expect(full.y + full.h / 2).toBeCloseTo(h / 2, 1);
    }
  });
});

describe('KillCam 回放与布局管理', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('初始状态: layout 为 corner, active 为 false', () => {
    const killcam = new KillCam(container);
    expect(killcam.layout).toBe('corner');
    expect(killcam.active).toBe(false);
  });

  it('播放 corner 回放: layout 为 corner, active 为 true', () => {
    const killcam = new KillCam(container);
    const r1 = makeReplay(TARGET);
    killcam.play(r1, { layout: 'corner' });

    expect(killcam.active).toBe(true);
    expect(killcam.layout).toBe('corner');
    expect(container.classList.contains('killcam-full')).toBe(false);
  });

  it('播 corner 时再播 full: layout 变成 full、队列清空、打断 corner 回放', () => {
    const killcam = new KillCam(container);
    const r1 = makeReplay(TARGET);
    const r2 = makeReplay(TARGET);
    const r3 = makeReplay(SHOOTER);

    // 播放 r1(corner), 并排队 r2(corner)
    killcam.play(r1, { layout: 'corner' });
    killcam.play(r2, { layout: 'corner' });
    expect(killcam.layout).toBe('corner');

    // 玩家被击毁, 播 r3(full)
    killcam.play(r3, { layout: 'full', title: '被 测试靶 击毁' });

    // 立即被打断并切换为 full 布局
    expect(killcam.layout).toBe('full');
    expect(killcam.active).toBe(true);
    expect(container.classList.contains('killcam-full')).toBe(true);

    // 检查自定义标题渲染
    const frame = container.querySelector('div');
    expect(frame).not.toBeNull();
    expect(frame?.innerHTML).toContain('被 测试靶 击毁');

    // r3 播完后队列应为空(r2 已被清空), 直接结束回放
    killcam.update(performance.now() + 10000);
    expect(killcam.active).toBe(false);
    expect(killcam.layout).toBe('corner');
    expect(container.classList.contains('killcam-full')).toBe(false);
  });

  it('full 回放未传 title 时使用默认击毁回放标题', () => {
    const killcam = new KillCam(container);
    const r = makeReplay(TARGET);
    killcam.play(r, { layout: 'full' });

    expect(killcam.layout).toBe('full');
    const frame = container.querySelector('div');
    expect(frame?.innerHTML).toContain(`击毁回放 · ${TARGET.name}`);
  });

  it('stop() 会清空队列并恢复 corner 布局', () => {
    const killcam = new KillCam(container);
    const r1 = makeReplay(TARGET);
    killcam.play(r1, { layout: 'full', title: '被击毁' });
    expect(killcam.active).toBe(true);
    expect(killcam.layout).toBe('full');
    expect(container.classList.contains('killcam-full')).toBe(true);

    killcam.stop();
    expect(killcam.active).toBe(false);
    expect(killcam.layout).toBe('corner');
    expect(container.classList.contains('killcam-full')).toBe(false);
  });
});
