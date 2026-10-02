import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  hitOutcome,
  ratioAt,
  killcamCaption,
  killcamIcons,
  killcamCrew,
  KillCamOverlay,
} from '../src/ui/killcamOverlay';
import type { HitReplay } from '../src/game/Game';
import { SHOOTER, TARGET } from './fixtures';

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

describe('hitOutcome 纯函数', () => {
  it('打中炮管时(armor 为 null)返回 nopen', () => {
    const replay = makeBaseReplay();
    replay.armor = null;
    replay.part = 'barrel';
    expect(hitOutcome(replay)).toBe('nopen');
  });

  it('未击穿且未跳弹时返回 nopen', () => {
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

  it('跳弹时返回 ricochet', () => {
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

  it('击穿但没有乘员死亡、没有殉爆时返回 penetrated', () => {
    const replay = makeBaseReplay();
    expect(hitOutcome(replay)).toBe('penetrated');
  });

  it('击穿且有乘员阵亡时返回 crew-out', () => {
    const replay = makeBaseReplay();
    replay.before['crew:0'] = 1;
    replay.after['crew:0'] = 0;
    expect(hitOutcome(replay)).toBe('crew-out');
  });

  it('击穿且弹药架殉爆时返回 ammo-exploded(优先级高于乘员阵亡)', () => {
    const replay = makeBaseReplay();
    replay.detonated = true;
    replay.before['crew:0'] = 1;
    replay.after['crew:0'] = 0;
    expect(hitOutcome(replay)).toBe('ammo-exploded');
  });
});

describe('ratioAt 纯函数', () => {
  const tContact = 0.8;

  it('接触前(t < tContact)返回 before[id]，缺省为 1', () => {
    const replay = makeBaseReplay();
    replay.before['engine'] = 0.75;
    expect(ratioAt(replay, 'engine', 0, tContact)).toBe(0.75);
    expect(ratioAt(replay, 'engine', 0.5, tContact)).toBe(0.75);
    expect(ratioAt(replay, 'engine', tContact - 0.001, tContact)).toBe(0.75);
    expect(ratioAt(replay, 'unknown_mod', 0.5, tContact)).toBe(1);
  });

  it('外挂记录在 tContact 瞬间跳变', () => {
    const replay = makeBaseReplay();
    replay.external = [
      {
        kind: 'module',
        id: 'track_l',
        name: '履带',
        source: 'external',
        damage: 100,
        hpBefore: 100,
        hpAfter: 0,
        maxHp: 100,
        destroyed: true,
        time: 0,
      },
    ];
    replay.before['track_l'] = 1;
    replay.after['track_l'] = 0;

    expect(ratioAt(replay, 'track_l', tContact - 0.01, tContact)).toBe(1);
    expect(ratioAt(replay, 'track_l', tContact, tContact)).toBe(0);
    expect(ratioAt(replay, 'track_l', tContact + 0.1, tContact)).toBe(0);
  });

  it('车内命中记录在 tContact + hit.time 跳变', () => {
    const replay = makeBaseReplay();
    replay.penetration = {
      entry: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [],
      explosion: null,
      hits: [
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
      ],
      fuseArmed: true,
      detonated: false,
      knockedOut: false,
      duration: 0.3,
    };
    replay.before['engine'] = 1;
    replay.after['engine'] = 0.4;

    expect(ratioAt(replay, 'engine', tContact, tContact)).toBe(1);
    expect(ratioAt(replay, 'engine', tContact + 0.149, tContact)).toBe(1);
    expect(ratioAt(replay, 'engine', tContact + 0.15, tContact)).toBe(0.4);
    expect(ratioAt(replay, 'engine', tContact + 0.25, tContact)).toBe(0.4);
  });

  it('回放最后时刻返回 after[id]', () => {
    const replay = makeBaseReplay();
    replay.penetration = {
      entry: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [],
      explosion: null,
      hits: [],
      fuseArmed: true,
      detonated: false,
      knockedOut: false,
      duration: 0.2,
    };
    replay.before['engine'] = 1;
    replay.after['engine'] = 0.2;

    expect(ratioAt(replay, 'engine', tContact + 0.5, tContact)).toBe(0.2);
  });
});

describe('killcamCaption 纯函数', () => {
  const tContact = 0.8;

  it('接触前(t < tContact)返回 null', () => {
    const replay = makeBaseReplay();
    expect(killcamCaption(replay, 0, tContact)).toBeNull();
    expect(killcamCaption(replay, tContact - 0.01, tContact)).toBeNull();
  });

  it('跳弹时返回「跳弹」(tone: info)', () => {
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
    expect(killcamCaption(replay, tContact + 0.5, tContact)).toEqual({ text: '跳弹', tone: 'info' });
  });

  it('未击穿时返回「未击穿」(tone: info)', () => {
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
    expect(killcamCaption(replay, tContact + 0.5, tContact)).toEqual({ text: '未击穿', tone: 'info' });
  });

  it('击穿过程标题升级只升不降:「击穿」→「乘员失去战斗力」→「弹药殉爆」', () => {
    const replay = makeBaseReplay();
    replay.detonated = true;
    replay.penetration = {
      entry: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [],
      explosion: { center: new THREE.Vector3(), radius: 1, time: 0.25 },
      hits: [
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
      ],
      fuseArmed: true,
      detonated: true,
      knockedOut: true,
      duration: 0.3,
    };

    // 1. 刚击穿时刻
    expect(killcamCaption(replay, tContact, tContact)).toEqual({ text: '击穿', tone: 'hit' });
    expect(killcamCaption(replay, tContact + 0.05, tContact)).toEqual({ text: '击穿', tone: 'hit' });

    // 2. 乘员阵亡时刻起升级为「乘员失去战斗力」
    expect(killcamCaption(replay, tContact + 0.1, tContact)).toEqual({ text: '乘员失去战斗力', tone: 'severe' });
    expect(killcamCaption(replay, tContact + 0.2, tContact)).toEqual({ text: '乘员失去战斗力', tone: 'severe' });

    // 3. 弹药殉爆时刻起升级为「弹药殉爆」
    expect(killcamCaption(replay, tContact + 0.25, tContact)).toEqual({ text: '弹药殉爆', tone: 'severe' });
    expect(killcamCaption(replay, tContact + 0.5, tContact)).toEqual({ text: '弹药殉爆', tone: 'severe' });
  });
});

describe('killcamIcons 纯函数', () => {
  const tContact = 0.8;

  it('track 履带受损不影响四个类别图标', () => {
    const replay = makeBaseReplay();
    replay.external = [
      {
        kind: 'module',
        id: 'track_l',
        name: '履带',
        source: 'external',
        damage: 100,
        hpBefore: 100,
        hpAfter: 0,
        maxHp: 100,
        destroyed: true,
        time: 0,
      },
    ];
    replay.before['track_l'] = 1;
    replay.after['track_l'] = 0;

    const icons = killcamIcons(replay, tContact, tContact);
    expect(icons).toEqual({
      engine: 'ok',
      gun: 'ok',
      turret: 'ok',
      ammo: 'ok',
    });
  });

  it('类别内任一模块受损为 damaged，全部报废为 destroyed', () => {
    const replay = makeBaseReplay();
    // engine 类别包含 engine 和 transmission
    replay.before['engine'] = 1;
    replay.before['transmission'] = 1;
    replay.after['engine'] = 0.5;
    replay.after['transmission'] = 1;

    // 接触前为 ok
    expect(killcamIcons(replay, tContact - 0.1, tContact).engine).toBe('ok');

    // 发动机受损，变速箱完好 -> damaged
    expect(killcamIcons(replay, tContact + 0.5, tContact).engine).toBe('damaged');

    // 两者均降为 0 -> destroyed
    replay.after['engine'] = 0;
    replay.after['transmission'] = 0;
    expect(killcamIcons(replay, tContact + 0.5, tContact).engine).toBe('destroyed');
  });

  it('各模块随时间轴依次受损亮起', () => {
    const replay = makeBaseReplay();
    replay.penetration = {
      entry: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [],
      explosion: null,
      hits: [
        {
          kind: 'module',
          id: 'barrel',
          name: '主炮炮管',
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
          id: 'ammo_bustle',
          name: '弹药架',
          source: 'fragment',
          damage: 100,
          hpBefore: 100,
          hpAfter: 0,
          maxHp: 100,
          destroyed: true,
          time: 0.2,
        },
      ],
      fuseArmed: true,
      detonated: false,
      knockedOut: false,
      duration: 0.3,
    };
    replay.after['barrel'] = 0.5;
    replay.after['ammo_bustle'] = 0;

    // tContact 时 gun 和 ammo 均为 ok
    let icons = killcamIcons(replay, tContact, tContact);
    expect(icons.gun).toBe('ok');
    expect(icons.ammo).toBe('ok');

    // tContact + 0.1 时 gun 变为 damaged
    icons = killcamIcons(replay, tContact + 0.1, tContact);
    expect(icons.gun).toBe('damaged');
    expect(icons.ammo).toBe('ok');

    // tContact + 0.2 时 ammo 变为 destroyed
    icons = killcamIcons(replay, tContact + 0.2, tContact);
    expect(icons.gun).toBe('damaged');
    expect(icons.ammo).toBe('destroyed');
  });
});

describe('killcamCrew 纯函数', () => {
  const tContact = 0.8;

  it('乘员存活数随时间减少', () => {
    const replay = makeBaseReplay();
    replay.penetration = {
      entry: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [],
      explosion: null,
      hits: [
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
        {
          kind: 'crew',
          id: 'crew:1',
          name: '炮手',
          source: 'fragment',
          damage: 100,
          hpBefore: 100,
          hpAfter: 0,
          maxHp: 100,
          destroyed: true,
          time: 0.2,
        },
      ],
      fuseArmed: true,
      detonated: false,
      knockedOut: false,
      duration: 0.3,
    };
    replay.after['crew:0'] = 0;
    replay.after['crew:1'] = 0;

    // 初始 3 人存活
    expect(killcamCrew(replay, tContact, tContact)).toEqual({ alive: 3, total: 3 });

    // 0.1s 后驾驶员阵亡
    expect(killcamCrew(replay, tContact + 0.1, tContact)).toEqual({ alive: 2, total: 3 });

    // 0.2s 后炮手阵亡
    expect(killcamCrew(replay, tContact + 0.2, tContact)).toEqual({ alive: 1, total: 3 });
  });
});

describe('KillCamOverlay DOM 组件集成', () => {
  let parent: HTMLDivElement;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  afterEach(() => {
    parent.remove();
  });

  it('重复创建只向 head 注入一份样式', () => {
    const o1 = new KillCamOverlay(parent);
    const o2 = new KillCamOverlay(parent);
    const styles = document.querySelectorAll('style#kco-style');
    expect(styles.length).toBe(1);
    o1.dispose();
    o2.dispose();
  });

  it('show / update 正确刷新文字、图标状态类名及乘员数', () => {
    const overlay = new KillCamOverlay(parent);
    const replay = makeBaseReplay();
    replay.penetration = {
      entry: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      segments: [],
      explosion: null,
      hits: [
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
          source: 'fragment',
          damage: 100,
          hpBefore: 100,
          hpAfter: 0,
          maxHp: 100,
          destroyed: true,
          time: 0.15,
        },
      ],
      fuseArmed: true,
      detonated: false,
      knockedOut: false,
      duration: 0.3,
    };
    replay.after['engine'] = 0.4;
    replay.after['crew:0'] = 0;

    overlay.show(replay);
    expect(overlay.root.style.display).toBe('block');

    const tContact = 0.8;
    // 接触时
    overlay.update(tContact, tContact);
    const captionEl = overlay.root.querySelector('.kco-caption') as HTMLDivElement;
    const crewEl = overlay.root.querySelector('.kco-crew') as HTMLDivElement;
    const crewTextEl = overlay.root.querySelector('.kco-crew-text') as HTMLSpanElement;
    const engineIcon = overlay.root.querySelector('.kco-icon-engine') as HTMLDivElement;

    expect(captionEl.textContent).toBe('击穿');
    expect(captionEl.className).toContain('kco-caption-hit');
    expect(crewTextEl.textContent).toBe('3 / 3');
    expect(crewEl.className).not.toContain('kco-crew-lost');
    expect(engineIcon.className).toContain('kco-icon-ok');

    // 0.15s 后乘员阵亡且发动机受损
    overlay.update(tContact + 0.15, tContact);
    expect(captionEl.textContent).toBe('乘员失去战斗力');
    expect(captionEl.className).toContain('kco-caption-severe');
    expect(crewTextEl.textContent).toBe('2 / 3');
    expect(crewEl.className).toContain('kco-crew-lost');
    expect(engineIcon.className).toContain('kco-icon-damaged');

    overlay.dispose();
  });

  it('反复 update 同一时刻或相同状态时不重新修改 DOM', async () => {
    const overlay = new KillCamOverlay(parent);
    const replay = makeBaseReplay();
    overlay.show(replay);

    const tContact = 0.8;
    overlay.update(tContact, tContact);

    const captionEl = overlay.root.querySelector('.kco-caption') as HTMLDivElement;
    const crewTextEl = overlay.root.querySelector('.kco-crew-text') as HTMLSpanElement;
    const initialCaptionTextNode = captionEl.firstChild;
    const initialCrewTextNode = crewTextEl.firstChild;

    // 使用 MutationObserver 监听
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => {
      mutations.push(...records);
    });
    observer.observe(overlay.root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    // 相同时刻反复调用
    overlay.update(tContact, tContact);
    overlay.update(tContact, tContact);
    overlay.update(tContact + 0.001, tContact);

    await Promise.resolve(); // 等待微任务
    expect(mutations).toHaveLength(0);

    // 确认文字节点引用未被重建
    expect(captionEl.firstChild).toBe(initialCaptionTextNode);
    expect(crewTextEl.firstChild).toBe(initialCrewTextNode);

    observer.disconnect();
    overlay.dispose();
  });

  it('hide 隐藏，dispose 移除 DOM', () => {
    const overlay = new KillCamOverlay(parent);
    overlay.show(makeBaseReplay());
    expect(overlay.root.style.display).toBe('block');

    overlay.hide();
    expect(overlay.root.style.display).toBe('none');

    expect(parent.contains(overlay.root)).toBe(true);
    overlay.dispose();
    expect(parent.contains(overlay.root)).toBe(false);
  });
});
