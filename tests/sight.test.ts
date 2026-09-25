import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, type GameEvent } from '../src/game/Game';
import { idleControls } from '../src/game/Vehicle';
import { integrateBallistic } from '../src/game/Projectile';
import { superelevation } from '../src/game/Ballistics';
import { VEHICLES } from '../src/data/vehicles';
import type { ShellSpec } from '../src/data/types';
import { dragK } from '../src/data/shells';
import { TEST_VEHICLES, flatMap } from './fixtures';

const DT = 1 / 60;

beforeAll(async () => {
  await RAPIER.init();
});

/** 以仰角 angle 水平发射,飞到水平距离 range 时的高度(相对发射点),m */
function heightAt(shell: ShellSpec, angle: number, range: number, dt = 1e-3): number {
  const v = new THREE.Vector3(0, Math.sin(angle), -Math.cos(angle)).multiplyScalar(shell.muzzleVelocity);
  const p = new THREE.Vector3();
  const k = dragK(shell);
  for (;;) {
    const prev = p.clone();
    p.add(integrateBallistic(v, dt, k));
    if (-p.z >= range) return prev.y + ((p.y - prev.y) * (range + prev.z)) / (prev.z - p.z);
  }
}

describe('表尺射表 superelevation', () => {
  // 每种炮弹一张射表(初速、阻力各不相同)
  const shells = Object.values(VEHICLES).flatMap((v) => v.weapons[0].ammo);

  it('按表尺抬高后,炮弹在该距离回到瞄准线上(误差 < 0.15 m,用 1ms 步长的独立积分检验)', () => {
    for (const w of shells) {
      for (const r of [200, 500, 1000, 1500, 2000, 2500]) {
        expect(Math.abs(heightAt(w, superelevation(w, r), r))).toBeLessThan(0.15);
      }
    }
  });

  it('不调表尺时远距离下坠很明显:KwK 36 在 1000 m 掉 5 m 以上', () => {
    const w = VEHICLES.tiger_i.weapons[0].ammo[0];
    expect(heightAt(w, 0, 1000)).toBeLessThan(-5);
  });

  it('距离越远抬得越多;初速越高抬得越少', () => {
    const tiger = VEHICLES.tiger_i.weapons[0].ammo[0];
    const kingTiger = VEHICLES.tiger_ii.weapons[0].ammo[0];
    let last = 0;
    for (let r = 100; r <= 3000; r += 100) {
      const a = superelevation(tiger, r);
      expect(a).toBeGreaterThan(last);
      last = a;
      expect(superelevation(kingTiger, r)).toBeLessThan(a);
    }
    expect(superelevation(tiger, 0)).toBe(0);
  });
});

describe('瞄准镜 + 表尺:远距离命中', () => {
  /** 玩家在原点朝 -Z;靶车侧面朝向玩家,距离 range */
  function longRange(range: number) {
    const game = new Game({
      map: flatMap({ vehicleId: 'shooter', position: [0, range / 2], heading: 0 }, [
        { vehicleId: 'target', position: [0, -range / 2], heading: 90 },
      ], range + 200),
      vehicles: TEST_VEHICLES,
    });
    const target = game.targets[0];
    // 先让车辆落地停稳,再取瞄准点
    for (let i = 0; i < 1 / DT; i++) game.fixedUpdate(DT);
    game.drainEvents();
    // 瞄炮塔中心:炮塔高 0.9 m,上下各有 0.45 m 余量
    const aim = target
      .physicsPosition()
      .add(new THREE.Vector3(0, target.spec.hull.height / 2 + target.spec.turret.height / 2, 0));
    const events: GameEvent[] = [];
    const shoot = (sightRange: number) => {
      for (let i = 0; i < 4 / DT; i++) {
        game.setPlayerControls({ ...idleControls(), aimPoint: aim, fire: i === Math.round(2 / DT), sightRange });
        game.fixedUpdate(DT);
        events.push(...game.drainEvents());
      }
      return events.filter((e): e is Extract<GameEvent, { type: 'hit' }> => e.type === 'hit');
    };
    return { shoot };
  }

  it('1000 m:表尺设 1000 m,瞄炮塔中心就能打中炮塔', () => {
    const hits = longRange(1000).shoot(1000);
    expect(hits).toHaveLength(1);
    expect(hits[0].part).toBe('turret');
  });

  it('1000 m:表尺留在 0 m,炮弹掉到目标前面的地上', () => {
    expect(longRange(1000).shoot(0)).toHaveLength(0);
  });

  it('表尺估错 200 m(设 800 m 打 1000 m)也打不中炮塔', () => {
    const hits = longRange(1000).shoot(800);
    expect(hits.every((h) => h.part !== 'turret')).toBe(true);
  });
});

describe('模块性能与维修(整车集成)', () => {
  function drivingSetup() {
    const game = new Game({
      map: flatMap({ vehicleId: 'shooter', position: [0, 120], heading: 0 }, [], 300),
      vehicles: TEST_VEHICLES,
    });
    const player = game.player;
    const events: GameEvent[] = [];
    const drive = (seconds: number, throttle = 1, fire = false) => {
      let top = 0;
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        game.setPlayerControls({ ...idleControls(), throttle, fire });
        game.fixedUpdate(DT);
        events.push(...game.drainEvents());
        top = Math.max(top, player.forwardSpeed * 3.6);
      }
      return top;
    };
    drive(0.5, 0);
    return { game, player, events, drive };
  }

  it('发动机剩一半血:极速只有一半', () => {
    const { player, drive } = drivingSetup();
    const engine = player.damage.module('engine')!;
    player.damage.applyDamage({ kind: 'module', module: engine }, engine.maxHp / 2, 'shell', 0);
    const top = drive(20);
    expect(top).toBeGreaterThan(player.spec.maxSpeed * 0.45);
    expect(top).toBeLessThan(player.spec.maxSpeed * 0.52);
  });

  it('履带被打断 → 开不动;按 F 维修期间仍开不动但能开火;修好后恢复', () => {
    const { game, player, events, drive } = drivingSetup();
    const track = player.damage.module('track_l')!;
    player.damage.applyDamage({ kind: 'module', module: track }, 999, 'external', 0);
    expect(drive(2)).toBeLessThan(0.5);

    game.toggleRepair();
    const start = events.length;
    drive(0.1);
    const repairStart = [...events, ...game.drainEvents()].find((e) => e.type === 'repair' && e.state === 'start');
    expect(repairStart).toBeDefined();
    // 维修中:油门无效,但能开火
    expect(drive(3, 1, true)).toBeLessThan(0.5);
    expect(events.slice(start).some((e) => e.type === 'fired')).toBe(true);

    drive(10, 0);
    expect(events.some((e) => e.type === 'repair' && e.state === 'done')).toBe(true);
    expect(track.hp).toBe(track.maxHp);
    expect(drive(5)).toBeGreaterThan(10);
  });

  it('再按一次 F 取消维修,进度清零', () => {
    const { game, player, events, drive } = drivingSetup();
    const track = player.damage.module('track_l')!;
    player.damage.applyDamage({ kind: 'module', module: track }, 999, 'external', 0);
    game.toggleRepair();
    drive(3, 0);
    game.toggleRepair();
    drive(0.1, 0);
    expect(events.some((e) => e.type === 'repair' && e.state === 'cancel')).toBe(true);
    expect(player.damage.repair).toBeNull();
    expect(track.hp).toBe(0);
  });
});
