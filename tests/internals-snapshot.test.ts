import { describe, it, expect } from 'vitest';
import { TIGER_I } from '../src/data/vehicles';
import { DamageModel } from '../src/game/damage/DamageModel';
import { internalsSnapshot } from '../src/game/internalsSnapshot';

describe('internalsSnapshot 内构快照生成', () => {
  it('正确提取车辆姿态、模块与乘员完整数据', () => {
    const damage = new DamageModel(TIGER_I);
    const snap = internalsSnapshot({
      spec: TIGER_I,
      turretYaw: 0.35,
      gunPitch: -0.12,
      damage,
    });

    expect(snap.spec.id).toBe('tiger_i');
    expect(snap.turretYaw).toBeCloseTo(0.35);
    expect(snap.gunPitch).toBeCloseTo(-0.12);

    expect(snap.modules.length).toBe(damage.modules.length);
    expect(snap.crew.length).toBe(damage.crew.length);

    // 满血初始状态
    for (const m of snap.modules) {
      expect(m.ratio).toBe(1);
      expect(m.size.length).toBe(3);
      expect(m.center.length).toBe(3);
      expect(['hull', 'turret', 'gun']).toContain(m.part);
    }

    for (const c of snap.crew) {
      expect(c.ratio).toBe(1);
      expect(c.alive).toBe(true);
      expect(c.center.length).toBe(3);
      expect(['hull', 'turret']).toContain(c.part);
    }
  });

  it('模块受损与打坏时 ratio 准确对应', () => {
    const damage = new DamageModel(TIGER_I);
    const engine = damage.modules.find((m) => m.type === 'engine')!;
    engine.hp = engine.maxHp * 0.4;

    const ammo = damage.modules.find((m) => m.type === 'ammo')!;
    ammo.hp = 0;

    const snap = internalsSnapshot({
      spec: TIGER_I,
      turretYaw: 0,
      gunPitch: 0,
      damage,
    });

    const snapEngine = snap.modules.find((m) => m.id === engine.id)!;
    expect(snapEngine.ratio).toBeCloseTo(0.4, 5);

    const snapAmmo = snap.modules.find((m) => m.id === ammo.id)!;
    expect(snapAmmo.ratio).toBe(0);
  });

  it('乘员受伤与阵亡时 ratio 与 alive 字段正确', () => {
    const damage = new DamageModel(TIGER_I);
    const driver = damage.crew.find((c) => c.homeRole === 'driver')!;
    driver.hp = 60; // 60 / 100 = 0.6

    const gunner = damage.crew.find((c) => c.homeRole === 'gunner')!;
    gunner.hp = 0;
    gunner.alive = false;
    gunner.seat = null;

    const snap = internalsSnapshot({
      spec: TIGER_I,
      turretYaw: 0,
      gunPitch: 0,
      damage,
    });

    const snapDriver = snap.crew.find((c) => c.id === `crew:${driver.index}`)!;
    expect(snapDriver.alive).toBe(true);
    expect(snapDriver.ratio).toBeCloseTo(0.6, 5);

    const snapGunner = snap.crew.find((c) => c.id === `crew:${gunner.index}`)!;
    expect(snapGunner.alive).toBe(false);
    expect(snapGunner.ratio).toBe(0);
    // 阵亡后 seat 为 null,岗位退回 homeRole
    expect(snapGunner.role).toBe('gunner');
  });

  it('乘员换位后岗位采用当前座位的岗位(seat)', () => {
    const damage = new DamageModel(TIGER_I);
    const loader = damage.crew.find((c) => c.homeRole === 'loader')!;
    // 模拟装填手完成换位,顶替炮手
    loader.seat = 'gunner';

    const snap = internalsSnapshot({
      spec: TIGER_I,
      turretYaw: 0,
      gunPitch: 0,
      damage,
    });

    const snapLoader = snap.crew.find((c) => c.id === `crew:${loader.index}`)!;
    expect(snapLoader.role).toBe('gunner');
  });
});
