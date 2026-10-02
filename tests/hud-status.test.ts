import { describe, it, expect } from 'vitest';
import type { DamageStatusSource } from '../src/ui/hud/hudStatus';
import {
  statusMessages,
  transientFromHit,
  MessageQueue,
  getCrewIncapacitatedMessage,
  getCrewRoleName,
} from '../src/ui/hud/hudStatus';
import type { HitReplay } from '../src/game/Game';
import type { HitRecord } from '../src/game/damage/DamageModel';

function makeBaseStatus(): DamageStatusSource {
  return {
    modules: [
      { id: 'engine', type: 'engine', hp: 160, maxHp: 160, name: '发动机' },
      { id: 'transmission', type: 'transmission', hp: 160, maxHp: 160, name: '传动装置' },
      { id: 'breech', type: 'breech', hp: 150, maxHp: 150, name: '炮闩' },
      { id: 'barrel', type: 'barrel', hp: 100, maxHp: 100, name: '炮管' },
      { id: 'track_l', type: 'track', hp: 120, maxHp: 120, name: '左履带' },
      { id: 'track_r', type: 'track', hp: 120, maxHp: 120, name: '右履带' },
    ],
    crew: [
      { alive: true, homeRole: 'driver', seat: 'driver', swap: null },
      { alive: true, homeRole: 'gunner', seat: 'gunner', swap: null },
      { alive: true, homeRole: 'loader', seat: 'loader', swap: null },
      { alive: true, homeRole: 'commander', seat: 'commander', swap: null },
      { alive: true, homeRole: 'radio', seat: 'radio', swap: null },
    ],
    fire: null,
    extinguishers: 2,
  };
}

describe('hudStatus 单元测试', () => {
  describe('岗位文案与角色映射', () => {
    it('角色名称映射正确', () => {
      expect(getCrewRoleName('driver')).toBe('驾驶员');
      expect(getCrewRoleName('gunner')).toBe('炮手');
      expect(getCrewRoleName('loader')).toBe('装填手');
      expect(getCrewRoleName('commander')).toBe('车长');
      expect(getCrewRoleName('radio')).toBe('机电员');
      expect(getCrewRoleName('custom')).toBe('custom');
    });

    it('各岗位无人时的提示文案与车长特例', () => {
      expect(getCrewIncapacitatedMessage('driver')).toBe('驾驶员昏迷,无法驾驶');
      expect(getCrewIncapacitatedMessage('gunner')).toBe('炮手昏迷,无法瞄准和开火');
      expect(getCrewIncapacitatedMessage('loader')).toBe('装填手昏迷,无法装填');
      expect(getCrewIncapacitatedMessage('radio')).toBe('机电员昏迷,无法操作机枪 / 电台');
      expect(getCrewIncapacitatedMessage('radio', '无线电员')).toBe('无线电员昏迷,无法操作机枪 / 电台');
      expect(getCrewIncapacitatedMessage('radio', '机枪手')).toBe('机枪手昏迷,无法操作机枪 / 电台');
      // 车长特例
      expect(getCrewIncapacitatedMessage('commander')).toBe('车长昏迷,无法使用超越控制');
      // 未知岗位兜底
      expect(getCrewIncapacitatedMessage('scout', '侦察兵')).toBe('侦察兵昏迷,无法操作侦察兵负责的装置');
    });
  });

  describe('状态型提示触发条件', () => {
    it('完好状态下无状态提示', () => {
      const state = makeBaseStatus();
      expect(statusMessages(state)).toEqual([]);
    });

    it('起火文案:普通起火、正在灭火、无灭火器', () => {
      const state = makeBaseStatus();
      state.fire = { extinguishing: null, source: 'fuel', burning: 1, remaining: 10 };
      expect(statusMessages(state)).toEqual([{ text: '起火!', cls: 'red' }]);

      state.fire.extinguishing = 3.2;
      expect(statusMessages(state)).toEqual([{ text: '正在灭火 3.2s', cls: 'amber' }]);

      state.fire.extinguishing = null;
      state.extinguishers = 0;
      expect(statusMessages(state)).toEqual([{ text: '起火!没有灭火器了', cls: 'red' }]);
    });

    it('发动机 hp <= 0 提示红「发动机受损,无法移动」', () => {
      const state = makeBaseStatus();
      state.modules.find((m) => m.type === 'engine')!.hp = 0;
      expect(statusMessages(state)).toEqual([{ text: '发动机受损,无法移动', cls: 'red' }]);
    });

    it('变速箱 hp <= 0 提示红「传动装置受损,无法移动」', () => {
      const state = makeBaseStatus();
      state.modules.find((m) => m.type === 'transmission')!.hp = 0;
      expect(statusMessages(state)).toEqual([{ text: '传动装置受损,无法移动', cls: 'red' }]);
    });

    it('发动机 / 变速箱受损但未报废提示黄「发动机受损」/「传动装置受损」', () => {
      const state = makeBaseStatus();
      state.modules.find((m) => m.type === 'engine')!.hp = 80;
      expect(statusMessages(state)).toEqual([{ text: '发动机受损', cls: 'amber' }]);

      state.modules.find((m) => m.type === 'transmission')!.hp = 50;
      expect(statusMessages(state)).toEqual([
        { text: '发动机受损', cls: 'amber' },
        { text: '传动装置受损', cls: 'amber' },
      ]);
    });

    it('炮闩 hp <= 0 提示红「炮闩损坏,无法开火」', () => {
      const state = makeBaseStatus();
      state.modules.find((m) => m.type === 'breech')!.hp = 0;
      expect(statusMessages(state)).toEqual([{ text: '炮闩损坏,无法开火', cls: 'red' }]);
    });

    it('炮管 hp <= 0 提示红「炮管损坏,无法开火」', () => {
      const state = makeBaseStatus();
      state.modules.find((m) => m.type === 'barrel')!.hp = 0;
      expect(statusMessages(state)).toEqual([{ text: '炮管损坏,无法开火', cls: 'red' }]);
    });

    it('履带断裂提示红「履带断裂」', () => {
      const state = makeBaseStatus();
      state.modules.find((m) => m.id === 'track_l')!.hp = 0;
      expect(statusMessages(state)).toEqual([{ text: '履带断裂', cls: 'red' }]);
    });

    it('乘员昏迷文案', () => {
      const state = makeBaseStatus();
      state.crew.find((c) => c.homeRole === 'driver')!.alive = false;
      state.crew.find((c) => c.homeRole === 'driver')!.seat = null;
      expect(statusMessages(state)).toEqual([{ text: '驾驶员昏迷,无法驾驶', cls: 'red' }]);

      state.crew.find((c) => c.homeRole === 'commander')!.alive = false;
      state.crew.find((c) => c.homeRole === 'commander')!.seat = null;
      expect(statusMessages(state)).toEqual([
        { text: '驾驶员昏迷,无法驾驶', cls: 'red' },
        { text: '车长昏迷,无法使用超越控制', cls: 'red' },
      ]);
    });
  });

  describe('顶替中不出「昏迷」', () => {
    it('岗位正在被顶替时不出昏迷提示', () => {
      const state = makeBaseStatus();
      // 炮手阵亡
      const gunner = state.crew.find((c) => c.homeRole === 'gunner')!;
      gunner.alive = false;
      gunner.seat = null;

      // 机电员正在顶替炮手
      const radio = state.crew.find((c) => c.homeRole === 'radio')!;
      radio.seat = null;
      radio.swap = { to: 'gunner', remaining: 3.5 };

      const msgs = statusMessages(state);
      // 炮手正在被顶替, 不应出「炮手昏迷」; 机电员位置空出来, 会出「机电员昏迷」
      expect(msgs.some((m) => m.text.includes('炮手昏迷'))).toBe(false);
      expect(msgs.some((m) => m.text.includes('机电员昏迷'))).toBe(true);
    });

    it('顶替完成后不出昏迷提示', () => {
      const state = makeBaseStatus();
      // 炮手阵亡
      const gunner = state.crew.find((c) => c.homeRole === 'gunner')!;
      gunner.alive = false;
      gunner.seat = null;

      // 机电员已成功接管炮手岗位
      const radio = state.crew.find((c) => c.homeRole === 'radio')!;
      radio.seat = 'gunner';
      radio.swap = null;

      const msgs = statusMessages(state);
      expect(msgs.some((m) => m.text.includes('炮手昏迷'))).toBe(false);
    });
  });

  describe('状态提示优先级与 3 条上限', () => {
    it('按优先级排序并截断至最多 3 条', () => {
      const state = makeBaseStatus();
      // 同时触发着火、发动机报废、变速箱报废、炮管损坏、炮闩损坏、履带断裂、乘员昏迷
      state.fire = { extinguishing: null, source: 'engine', burning: 1, remaining: 10 };
      state.modules.find((m) => m.type === 'engine')!.hp = 0;
      state.modules.find((m) => m.type === 'transmission')!.hp = 0;
      state.modules.find((m) => m.type === 'breech')!.hp = 0;
      state.modules.find((m) => m.type === 'barrel')!.hp = 0;
      state.modules.find((m) => m.id === 'track_l')!.hp = 0;
      state.crew.find((c) => c.homeRole === 'driver')!.alive = false;
      state.crew.find((c) => c.homeRole === 'driver')!.seat = null;

      // 默认 limit = 3
      const msgs = statusMessages(state);
      expect(msgs).toHaveLength(3);
      expect(msgs[0]).toEqual({ text: '起火!', cls: 'red' });
      expect(msgs[1]).toEqual({ text: '发动机受损,无法移动', cls: 'red' });
      expect(msgs[2]).toEqual({ text: '传动装置受损,无法移动', cls: 'red' });

      // 如果发动机和传动修好, 则下一批高优先级的炮闩、炮管、履带显现
      state.modules.find((m) => m.type === 'engine')!.hp = 160;
      state.modules.find((m) => m.type === 'transmission')!.hp = 160;
      const msgs2 = statusMessages(state);
      expect(msgs2).toEqual([
        { text: '起火!', cls: 'red' },
        { text: '炮闩损坏,无法开火', cls: 'red' },
        { text: '炮管损坏,无法开火', cls: 'red' },
      ]);
    });
  });

  describe('瞬时提示 transientFromHit', () => {
    function makeHitRecord(partial: Partial<HitRecord>): HitRecord {
      return {
        kind: 'module',
        id: 'test',
        name: '测试模块',
        source: 'shell',
        damage: 50,
        hpBefore: 100,
        hpAfter: 50,
        maxHp: 100,
        destroyed: false,
        time: 0,
        ...partial,
      };
    }

    it('己方被击穿后:受伤但没死乘员黄字、受损模块黄字、不在表上的报废模块红字', () => {
      const replay = {
        penetration: {
          hits: [
            makeHitRecord({ kind: 'crew', name: '炮手', damage: 30, hpBefore: 100, hpAfter: 70, destroyed: false }),
            makeHitRecord({ kind: 'module', name: '油箱', damage: 40, hpBefore: 100, hpAfter: 60, destroyed: false }),
            makeHitRecord({ kind: 'module', name: '方向机', damage: 100, hpBefore: 60, hpAfter: 0, destroyed: true }),
            // 发动机是状态表模块, 报废时不在此生成红损坏
            makeHitRecord({ kind: 'module', name: '发动机', damage: 200, hpBefore: 160, hpAfter: 0, destroyed: true }),
            // 乘员阵亡不在此生成受伤提示
            makeHitRecord({ kind: 'crew', name: '驾驶员', damage: 100, hpBefore: 100, hpAfter: 0, destroyed: true }),
          ],
        },
      } as unknown as HitReplay;

      const results = transientFromHit(replay);
      expect(results).toEqual([
        { text: '炮手受伤', cls: 'amber' },
        { text: '油箱受损', cls: 'amber' },
        { text: '方向机损坏', cls: 'red' },
      ]);
    });

    it('同一发命中里重复名字去重', () => {
      const replay = {
        penetration: {
          hits: [
            makeHitRecord({ kind: 'crew', name: '炮手', damage: 20, hpBefore: 100, hpAfter: 80 }),
            makeHitRecord({ kind: 'crew', name: '炮手', damage: 30, hpBefore: 80, hpAfter: 50 }),
            makeHitRecord({ kind: 'module', name: '油箱', damage: 30, hpBefore: 100, hpAfter: 70 }),
            makeHitRecord({ kind: 'module', name: '油箱', damage: 20, hpBefore: 70, hpAfter: 50 }),
          ],
        },
      } as unknown as HitReplay;

      const results = transientFromHit(replay);
      expect(results).toEqual([
        { text: '炮手受伤', cls: 'amber' },
        { text: '油箱受损', cls: 'amber' },
      ]);
    });

    it('空回放返回空数组', () => {
      const replay = { penetration: null } as unknown as HitReplay;
      expect(transientFromHit(replay)).toEqual([]);
    });
  });

  describe('MessageQueue 过期与去重', () => {
    it('消息在 3.5 秒后过期消失', () => {
      const q = new MessageQueue(3.5);
      q.push({ text: '测试提示', cls: 'amber' }, 10.0);

      expect(q.get(10.0)).toEqual([{ text: '测试提示', cls: 'amber' }]);
      expect(q.get(13.4)).toEqual([{ text: '测试提示', cls: 'amber' }]);
      expect(q.get(13.5)).toEqual([]);
    });

    it('重复文案刷新有效时间', () => {
      const q = new MessageQueue(3.5);
      q.push({ text: '油箱受损', cls: 'amber' }, 10.0);
      q.push({ text: '油箱受损', cls: 'amber' }, 12.0);

      expect(q.get(14.0)).toEqual([{ text: '油箱受损', cls: 'amber' }]);
      expect(q.get(15.5)).toEqual([]);
    });

    it('clear 清空所有消息', () => {
      const q = new MessageQueue(3.5);
      q.push({ text: '消息1', cls: 'red' }, 1.0);
      q.push({ text: '消息2', cls: 'amber' }, 1.0);
      expect(q.get(1.0)).toHaveLength(2);
      q.clear();
      expect(q.get(1.0)).toEqual([]);
    });
  });
});
