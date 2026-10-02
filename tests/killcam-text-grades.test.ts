import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, type HitReplay } from '../src/game/Game';
import { Projectile } from '../src/game/Projectile';
import { hitOutcome, killcamCaption } from '../src/ui/killcamOverlay';
import { flatMap, SHOOTER, TARGET, TEST_VEHICLES } from './fixtures';

beforeAll(async () => {
  await RAPIER.init();
});

function makeBaseReplay(): HitReplay {
  return {
    spec: TARGET,
    shell: SHOOTER.weapons[0].ammo[0],
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
      knockedOut: false,
      duration: 0.3,
    },
    before: {
      engine: 1,
      transmission: 1,
      barrel: 1,
      breech: 1,
      traverse: 1,
      elevation: 1,
      ammo_bustle: 1,
      'crew:0': 1,
      'crew:1': 1,
      'crew:2': 1,
    },
    after: {
      engine: 1,
      transmission: 1,
      barrel: 1,
      breech: 1,
      traverse: 1,
      elevation: 1,
      ammo_bustle: 1,
      'crew:0': 1,
      'crew:1': 1,
      'crew:2': 1,
    },
    layout: {
      modules: [
        { id: 'engine', type: 'engine', part: 'hull', center: [0, 0, 1], size: [1, 1, 1] },
        { id: 'transmission', type: 'transmission', part: 'hull', center: [0, 0, -1], size: [1, 1, 1] },
        { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -2], size: [0.2, 0.2, 2] },
        { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, 0], size: [0.4, 0.4, 0.6] },
        { id: 'traverse', type: 'traverse', part: 'turret', center: [0, 0, 0], size: [0.3, 0.3, 0.3] },
        { id: 'elevation', type: 'elevation', part: 'turret', center: [0, 0, 0], size: [0.3, 0.3, 0.3] },
        { id: 'ammo_bustle', type: 'ammo', part: 'turret', center: [0, 0, 1], size: [1, 0.5, 0.5] },
        { id: 'track_l', type: 'track', part: 'hull', center: [-1, 0, 0], size: [0.5, 0.5, 4] },
      ],
      crew: [
        { id: 'crew:0', role: 'driver', part: 'hull', center: [0, 0, -1] },
        { id: 'crew:1', role: 'gunner', part: 'turret', center: [0, 0, 0] },
        { id: 'crew:2', role: 'commander', part: 'turret', center: [0, 0, 0.5] },
      ],
    },
    destroyed: false,
    detonated: false,
  };
}

describe('hitOutcome 完整分级覆盖', () => {
  it('1. 跳弹时返回 ricochet', () => {
    const replay = makeBaseReplay();
    replay.armor = {
      face: 'front',
      armor: 80,
      angleDeg: 75,
      effectiveArmor: 200,
      penetration: 100,
      penetrated: false,
      ricochet: true,
    };
    expect(hitOutcome(replay)).toBe('ricochet');
  });

  it('2. 未击穿时返回 nopen', () => {
    const replay = makeBaseReplay();
    replay.armor = {
      face: 'front',
      armor: 120,
      angleDeg: 0,
      effectiveArmor: 120,
      penetration: 100,
      penetrated: false,
      ricochet: false,
    };
    expect(hitOutcome(replay)).toBe('nopen');
  });

  it('3. 击穿但没伤到成员和模块时返回 penetrated', () => {
    const replay = makeBaseReplay();
    expect(hitOutcome(replay)).toBe('penetrated');
  });

  it('4a. 击伤成员没起火时返回 hit', () => {
    const replay = makeBaseReplay();
    replay.penetration!.hits = [
      {
        kind: 'crew',
        id: 'crew:0',
        name: '驾驶员',
        source: 'shell',
        damage: 50,
        hpBefore: 100,
        hpAfter: 50,
        maxHp: 100,
        destroyed: false,
        time: 0.1,
      },
    ];
    replay.after['crew:0'] = 0.5;
    expect(hitOutcome(replay)).toBe('hit');
  });

  it('4b. 损坏模块没起火时返回 hit', () => {
    const replay = makeBaseReplay();
    replay.penetration!.hits = [
      {
        kind: 'module',
        id: 'engine',
        name: '发动机',
        source: 'shell',
        damage: 40,
        hpBefore: 100,
        hpAfter: 60,
        maxHp: 100,
        destroyed: false,
        time: 0.1,
      },
    ];
    replay.after['engine'] = 0.6;
    expect(hitOutcome(replay)).toBe('hit');
  });

  it('5. 点着火没伤人时返回 ignited', () => {
    const replay = makeBaseReplay();
    replay.ignited = true;
    replay.penetration!.hits = [
      {
        kind: 'module',
        id: 'engine',
        name: '发动机',
        source: 'shell',
        damage: 60,
        hpBefore: 100,
        hpAfter: 40,
        maxHp: 100,
        destroyed: false,
        time: 0.1,
      },
    ];
    replay.after['engine'] = 0.4;
    expect(hitOutcome(replay)).toBe('ignited');
  });

  it('6. 点着火且击伤成员时返回 critical', () => {
    const replay = makeBaseReplay();
    replay.ignited = true;
    replay.penetration!.hits = [
      {
        kind: 'module',
        id: 'engine',
        name: '发动机',
        source: 'shell',
        damage: 60,
        hpBefore: 100,
        hpAfter: 40,
        maxHp: 100,
        destroyed: false,
        time: 0.1,
      },
      {
        kind: 'crew',
        id: 'crew:0',
        name: '驾驶员',
        source: 'shell',
        damage: 50,
        hpBefore: 100,
        hpAfter: 50,
        maxHp: 100,
        destroyed: false,
        time: 0.15,
      },
    ];
    replay.after['engine'] = 0.4;
    replay.after['crew:0'] = 0.5;
    expect(hitOutcome(replay)).toBe('critical');
  });

  it('7. 击毁:乘员组失去战斗力时返回 crew-out', () => {
    const replay = makeBaseReplay();
    replay.destroyed = true;
    replay.penetration!.hits = [
      {
        kind: 'crew',
        id: 'crew:0',
        name: '驾驶员',
        source: 'shell',
        damage: 100,
        hpBefore: 100,
        hpAfter: 0,
        maxHp: 100,
        destroyed: true,
        time: 0.1,
      },
    ];
    replay.after['crew:0'] = 0;
    expect(hitOutcome(replay)).toBe('crew-out');
  });

  it('8. 击毁:弹药殉爆时返回 ammo-exploded(优先级高于乘员组)', () => {
    const replay = makeBaseReplay();
    replay.destroyed = true;
    replay.detonated = true;
    replay.ignited = true;
    replay.after['crew:0'] = 0;
    expect(hitOutcome(replay)).toBe('ammo-exploded');
  });
});

describe('killcamCaption 纯函数分级与时间线', () => {
  const tContact = 0.8;

  it('接触前(t < tContact)返回 null', () => {
    const replay = makeBaseReplay();
    expect(killcamCaption(replay, 0, tContact)).toBeNull();
    expect(killcamCaption(replay, tContact - 0.01, tContact)).toBeNull();
  });

  it('跳弹返回 跳弹 (tone: info)', () => {
    const replay = makeBaseReplay();
    replay.armor = {
      face: 'front',
      armor: 80,
      angleDeg: 75,
      effectiveArmor: 200,
      penetration: 100,
      penetrated: false,
      ricochet: true,
    };
    expect(killcamCaption(replay, tContact, tContact)).toEqual({ text: '跳弹', tone: 'info' });
  });

  it('未击穿返回 未击穿 (tone: info)', () => {
    const replay = makeBaseReplay();
    replay.armor = {
      face: 'front',
      armor: 120,
      angleDeg: 0,
      effectiveArmor: 120,
      penetration: 100,
      penetrated: false,
      ricochet: false,
    };
    expect(killcamCaption(replay, tContact, tContact)).toEqual({ text: '未击穿', tone: 'info' });
  });

  it('击穿但没伤到成员和模块返回 命中 (tone: hit)', () => {
    const replay = makeBaseReplay();
    expect(killcamCaption(replay, tContact, tContact)).toEqual({ text: '命中', tone: 'hit' });
  });

  it('击伤成员没起火返回 命中 (tone: hit)', () => {
    const replay = makeBaseReplay();
    replay.penetration!.hits = [
      {
        kind: 'crew',
        id: 'crew:0',
        name: '驾驶员',
        source: 'shell',
        damage: 50,
        hpBefore: 100,
        hpAfter: 50,
        maxHp: 100,
        destroyed: false,
        time: 0.1,
      },
    ];
    expect(killcamCaption(replay, tContact, tContact)).toEqual({ text: '命中', tone: 'hit' });
    expect(killcamCaption(replay, tContact + 0.1, tContact)).toEqual({ text: '命中', tone: 'hit' });
  });

  it('损坏模块没起火返回 命中 (tone: hit)', () => {
    const replay = makeBaseReplay();
    replay.penetration!.hits = [
      {
        kind: 'module',
        id: 'transmission',
        name: '变速箱',
        source: 'shell',
        damage: 60,
        hpBefore: 100,
        hpAfter: 40,
        maxHp: 100,
        destroyed: false,
        time: 0.1,
      },
    ];
    expect(killcamCaption(replay, tContact + 0.1, tContact)).toEqual({ text: '命中', tone: 'hit' });
  });

  it('点着火没伤人返回 引燃 (tone: fire)', () => {
    const replay = makeBaseReplay();
    replay.ignited = true;
    replay.penetration!.hits = [
      {
        kind: 'module',
        id: 'engine',
        name: '发动机',
        source: 'shell',
        damage: 60,
        hpBefore: 100,
        hpAfter: 40,
        maxHp: 100,
        destroyed: false,
        time: 0.15,
      },
    ];
    // 接触时但未到发动机命中时间
    expect(killcamCaption(replay, tContact + 0.05, tContact)).toEqual({ text: '命中', tone: 'hit' });
    // 到发动机被击中起火的时间点
    expect(killcamCaption(replay, tContact + 0.15, tContact)).toEqual({ text: '引燃', tone: 'fire' });
    expect(killcamCaption(replay, tContact + 0.3, tContact)).toEqual({ text: '引燃', tone: 'fire' });
  });

  it('点着火 + 击伤成员返回 重创 (tone: severe)', () => {
    const replay = makeBaseReplay();
    replay.ignited = true;
    replay.penetration!.hits = [
      {
        kind: 'module',
        id: 'fuel',
        name: '油箱',
        source: 'shell',
        damage: 50,
        hpBefore: 100,
        hpAfter: 50,
        maxHp: 100,
        destroyed: false,
        time: 0.1,
      },
      {
        kind: 'crew',
        id: 'crew:0',
        name: '驾驶员',
        source: 'shell',
        damage: 40,
        hpBefore: 100,
        hpAfter: 60,
        maxHp: 100,
        destroyed: false,
        time: 0.2,
      },
    ];
    // 0.05s: 击穿但尚未有损伤反馈
    expect(killcamCaption(replay, tContact + 0.05, tContact)).toEqual({ text: '命中', tone: 'hit' });
    // 0.1s: 油箱起火但乘员尚未受伤 -> 引燃
    expect(killcamCaption(replay, tContact + 0.1, tContact)).toEqual({ text: '引燃', tone: 'fire' });
    // 0.2s: 乘员受伤且已起火 -> 重创
    expect(killcamCaption(replay, tContact + 0.2, tContact)).toEqual({ text: '重创', tone: 'severe' });
  });

  it('完整升级时间线只升不降:击穿 / 命中 → 命中 → 引燃 → 重创 → 乘员昏迷 → 弹药殉爆', () => {
    const replay = makeBaseReplay();
    replay.ignited = true;
    replay.destroyed = true;
    replay.detonated = true;
    replay.penetration = {
      entry: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [],
      explosion: { center: new THREE.Vector3(), radius: 1, time: 0.5 },
      hits: [
        {
          kind: 'module',
          id: 'transmission',
          name: '变速箱',
          source: 'shell',
          damage: 50,
          hpBefore: 100,
          hpAfter: 50,
          maxHp: 100,
          destroyed: false,
          time: 0.1,
        },
        {
          kind: 'module',
          id: 'engine',
          name: '发动机',
          source: 'shell',
          damage: 80,
          hpBefore: 100,
          hpAfter: 20,
          maxHp: 100,
          destroyed: false,
          time: 0.2,
        },
        {
          kind: 'crew',
          id: 'crew:1',
          name: '炮手',
          source: 'spall',
          damage: 50,
          hpBefore: 100,
          hpAfter: 50,
          maxHp: 100,
          destroyed: false,
          time: 0.3,
        },
        {
          kind: 'crew',
          id: 'crew:0',
          name: '驾驶员',
          source: 'shell',
          damage: 100,
          hpBefore: 100,
          hpAfter: 0,
          maxHp: 100,
          destroyed: true,
          time: 0.4,
        },
      ],
      fuseArmed: true,
      detonated: true,
      knockedOut: true,
      duration: 0.6,
    };

    // 1. 接触瞬间: 击穿档显示「命中」(hit)
    expect(killcamCaption(replay, tContact, tContact)).toEqual({ text: '命中', tone: 'hit' });
    expect(killcamCaption(replay, tContact + 0.05, tContact)).toEqual({ text: '命中', tone: 'hit' });

    // 2. 0.1s 损坏变速箱: 命中 (hit)
    expect(killcamCaption(replay, tContact + 0.1, tContact)).toEqual({ text: '命中', tone: 'hit' });
    expect(killcamCaption(replay, tContact + 0.15, tContact)).toEqual({ text: '命中', tone: 'hit' });

    // 3. 0.2s 伤到发动机起火: 引燃 (fire)
    expect(killcamCaption(replay, tContact + 0.2, tContact)).toEqual({ text: '引燃', tone: 'fire' });
    expect(killcamCaption(replay, tContact + 0.25, tContact)).toEqual({ text: '引燃', tone: 'fire' });

    // 4. 0.3s 伤及乘员: 重创 (severe)
    expect(killcamCaption(replay, tContact + 0.3, tContact)).toEqual({ text: '重创', tone: 'severe' });
    expect(killcamCaption(replay, tContact + 0.35, tContact)).toEqual({ text: '重创', tone: 'severe' });

    // 5. 0.4s 乘员阵亡导致失去战斗力: 乘员昏迷 (severe)
    expect(killcamCaption(replay, tContact + 0.4, tContact)).toEqual({ text: '乘员昏迷', tone: 'severe' });
    expect(killcamCaption(replay, tContact + 0.45, tContact)).toEqual({ text: '乘员昏迷', tone: 'severe' });

    // 6. 0.5s 弹药殉爆: 弹药殉爆 (severe)
    expect(killcamCaption(replay, tContact + 0.5, tContact)).toEqual({ text: '弹药殉爆', tone: 'severe' });
    expect(killcamCaption(replay, tContact + 0.6, tContact)).toEqual({ text: '弹药殉爆', tone: 'severe' });
  });

  it('先伤乘员后引燃:命中 → 重创 (跳过纯引燃)', () => {
    const replay = makeBaseReplay();
    replay.ignited = true;
    replay.penetration!.hits = [
      {
        kind: 'crew',
        id: 'crew:0',
        name: '驾驶员',
        source: 'shell',
        damage: 40,
        hpBefore: 100,
        hpAfter: 60,
        maxHp: 100,
        destroyed: false,
        time: 0.1,
      },
      {
        kind: 'module',
        id: 'engine',
        name: '发动机',
        source: 'shell',
        damage: 80,
        hpBefore: 100,
        hpAfter: 20,
        maxHp: 100,
        destroyed: false,
        time: 0.2,
      },
    ];

    expect(killcamCaption(replay, tContact + 0.1, tContact)).toEqual({ text: '命中', tone: 'hit' });
    expect(killcamCaption(replay, tContact + 0.2, tContact)).toEqual({ text: '重创', tone: 'severe' });
  });

  it('起火但无发动机/油箱/弹药架记录时，引燃时间取接触时刻', () => {
    const replay = makeBaseReplay();
    replay.ignited = true;
    // hits 为空
    expect(killcamCaption(replay, tContact, tContact)).toEqual({ text: '引燃', tone: 'fire' });
  });
});

describe('Game 里 ignited 字段构造测试', () => {
  function setupGame(seed = 1) {
    const map = flatMap(
      { vehicleId: 'shooter', position: [0, 5], heading: 0 },
      [{ vehicleId: 'target', position: [0, -5], heading: 0 }],
      100
    );
    return new Game({ map, vehicles: TEST_VEHICLES, seed, enemyAi: false });
  }

  it('没点着火时: HitReplay.ignited === false', () => {
    const game = setupGame(42);
    const target = game.targets[0];
    const shell = SHOOTER.weapons[0].ammo[0]; // APHE 75mm
    // 从前方打靶车炮塔正面(乘员/炮闩位置, 不会碰到发动机/油箱)
    const origin = new THREE.Vector3(0, target.physicsPosition().y + 0.7, -1);
    const dir = new THREE.Vector3(0, 0, -1);
    const p = new Projectile(game.player.id, game.player.body, shell, origin, dir);
    game.projectiles.push(p);

    let hitReplay: HitReplay | null = null;
    for (let step = 0; step < 10 && !hitReplay; step++) {
      game.fixedUpdate(1 / 60);
      for (const e of game.drainEvents()) {
        if (e.type === 'hit' && e.targetId === target.id) {
          hitReplay = e.replay;
        }
      }
    }

    expect(hitReplay).not.toBeNull();
    expect(target.damage.fire).toBeNull();
    expect(hitReplay!.ignited).toBe(false);
  });

  it('打发动机/油箱并成功点着火时: HitReplay.ignited === true', () => {
    // 寻找一个必定起火的 seed
    let hitReplay: HitReplay | null = null;
    for (let seed = 1; seed <= 50; seed++) {
      const game = setupGame(seed);
      const target = game.targets[0];
      const shell = SHOOTER.weapons[0].ammo[0];
      // 靶车在 [0, -5], heading 0: 车头朝 -Z, 车尾在 +Z.
      // engine 模块在车尾: center [0, -0.05, 2.0]
      const origin = new THREE.Vector3(0, target.physicsPosition().y, -2.5);
      const dir = new THREE.Vector3(0, 0, -1);
      const p = new Projectile(game.player.id, game.player.body, shell, origin, dir);
      game.projectiles.push(p);

      for (let step = 0; step < 10; step++) {
        game.fixedUpdate(1 / 60);
        for (const e of game.drainEvents()) {
          if (e.type === 'hit' && e.targetId === target.id) {
            hitReplay = e.replay;
          }
        }
      }
      if (hitReplay?.ignited) {
        break;
      }
      hitReplay = null;
    }

    expect(hitReplay).not.toBeNull();
    expect(hitReplay!.ignited).toBe(true);
  });

  it('命中前目标就已经着火时: HitReplay.ignited === false', () => {
    const game = setupGame(1);
    const target = game.targets[0];
    // 命中前就给目标点火
    target.damage.ignite('engine');
    expect(target.damage.fire).not.toBeNull();

    const shell = SHOOTER.weapons[0].ammo[0];
    const origin = new THREE.Vector3(0, target.physicsPosition().y, -2.5);
    const dir = new THREE.Vector3(0, 0, -1);
    const p = new Projectile(game.player.id, game.player.body, shell, origin, dir);
    game.projectiles.push(p);

    let hitReplay: HitReplay | null = null;
    for (let step = 0; step < 10 && !hitReplay; step++) {
      game.fixedUpdate(1 / 60);
      for (const e of game.drainEvents()) {
        if (e.type === 'hit' && e.targetId === target.id) {
          hitReplay = e.replay;
        }
      }
    }

    expect(hitReplay).not.toBeNull();
    expect(hitReplay!.ignited).toBe(false);
  });
});
