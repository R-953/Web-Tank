import { describe, it, expect } from 'vitest';
import {
  killFeedName,
  formatKillFeedShooter,
  formatKillFeedNoShooter,
  createKillFeedFromHit,
  createKillFeedFromDestroyed,
  KillFeedTracker,
  isFriendly,
} from '../src/ui/hud/hudStatus';
import type { HitReplay } from '../src/game/Game';

describe('击毁提示流 (Kill Feed) 单元测试', () => {
  describe('车型短名 killFeedName', () => {
    it('去除中文括号及其内容', () => {
      expect(killFeedName('虎式 Ausf. E（1944 后期型）')).toBe('虎式 Ausf. E');
      expect(killFeedName('T-34-85（D-5T）')).toBe('T-34-85');
    });

    it('去除英文括号及其内容', () => {
      expect(killFeedName('虎式 Ausf. E(1944 后期型)')).toBe('虎式 Ausf. E');
      expect(killFeedName('Panzer IV (H)')).toBe('Panzer IV');
      expect(killFeedName('Sherman (76) W')).toBe('Sherman W');
    });

    it('无括号的车型原样保留', () => {
      expect(killFeedName('T-80B')).toBe('T-80B');
      expect(killFeedName('Puma VJTF')).toBe('Puma VJTF');
      expect(killFeedName('IS-2')).toBe('IS-2');
    });

    it('空字符串或纯空白返回「未知」', () => {
      expect(killFeedName('')).toBe('未知');
      expect(killFeedName('   ')).toBe('未知');
    });
  });

  describe('阵营判定 isFriendly', () => {
    it('玩家及友军前缀判定为友军', () => {
      expect(isFriendly('player')).toBe(true);
      expect(isFriendly('friendly-1')).toBe(true);
    });

    it('靶车及其他载具判定为敌军', () => {
      expect(isFriendly('target-1')).toBe(false);
      expect(isFriendly('target-2')).toBe(false);
      expect(isFriendly('enemy-tank')).toBe(false);
    });
  });

  describe('击毁行格式 (有射击者一发击毁)', () => {
    it('玩家击毁敌方: 友军蓝 + ➡弹种 + 敌军红', () => {
      const html = formatKillFeedShooter({
        shooterName: 'T-80B',
        shooterAffiliation: 'friendly',
        shellName: '3BM42',
        targetName: 'Puma VJTF',
        targetAffiliation: 'enemy',
      });

      expect(html).toBe(
        '<span class="feed-friendly">T-80B</span> ➡3BM42 <span class="feed-enemy">Puma VJTF</span>'
      );
    });

    it('敌方击毁玩家(己方被击毁出现在流中): 敌军红 + ➡弹种 + 友军蓝', () => {
      const html = formatKillFeedShooter({
        shooterName: '虎式 Ausf. E(1944 后期型)',
        shooterAffiliation: 'enemy',
        shellName: 'PzGr 39',
        targetName: 'T-34-85（1944）',
        targetAffiliation: 'friendly',
      });

      expect(html).toBe(
        '<span class="feed-enemy">虎式 Ausf. E</span> ➡PzGr 39 <span class="feed-friendly">T-34-85</span>'
      );
    });

    it('敌方互射 / 靶车互毁: 均为敌军红', () => {
      const html = formatKillFeedShooter({
        shooterName: 'T-72A',
        shooterAffiliation: 'enemy',
        shellName: '3BM22',
        targetName: 'M60A1',
        targetAffiliation: 'enemy',
      });

      expect(html).toBe(
        '<span class="feed-enemy">T-72A</span> ➡3BM22 <span class="feed-enemy">M60A1</span>'
      );
    });

    it('射击者或被击毁者名字缺失时缺省显示「未知」', () => {
      const html = formatKillFeedShooter({
        shooterName: '',
        shooterAffiliation: 'enemy',
        shellName: 'HE',
        targetName: '',
        targetAffiliation: 'friendly',
      });

      expect(html).toBe(
        '<span class="feed-enemy">未知</span> ➡HE <span class="feed-friendly">未知</span>'
      );
    });

    it('通过 createKillFeedFromHit 从命中事件生成', () => {
      const fakeReplay = {
        shell: { name: 'BR-365A' },
      } as unknown as HitReplay;

      const html = createKillFeedFromHit({
        shooterId: 'player',
        shooterName: 'T-34-85',
        targetId: 'target-1',
        targetName: '虎式 Ausf. E(1944 后期型)',
        replay: fakeReplay,
      });

      expect(html).toBe(
        '<span class="feed-friendly">T-34-85</span> ➡BR-365A <span class="feed-enemy">虎式 Ausf. E</span>'
      );
    });
  });

  describe('击毁行格式 (无射击者: 起火 / 殉爆 / 乘员不足)', () => {
    it('敌方烧毁', () => {
      const html = formatKillFeedNoShooter({
        targetName: '豹式 G型',
        targetAffiliation: 'enemy',
        cause: 'fire',
      });
      expect(html).toBe('<span class="feed-enemy">豹式 G型</span> 烧毁');
    });

    it('敌方弹药殉爆', () => {
      const html = formatKillFeedNoShooter({
        targetName: '虎王 (H)',
        targetAffiliation: 'enemy',
        cause: 'ammo',
      });
      expect(html).toBe('<span class="feed-enemy">虎王</span> 弹药殉爆');
    });

    it('敌方乘员不足', () => {
      const html = formatKillFeedNoShooter({
        targetName: '四号坦克 H型',
        targetAffiliation: 'enemy',
        cause: 'crew',
      });
      expect(html).toBe('<span class="feed-enemy">四号坦克 H型</span> 乘员不足');
    });

    it('己方被击毁出现在流中(友军蓝)', () => {
      const html = formatKillFeedNoShooter({
        targetName: 'T-34-85',
        targetAffiliation: 'friendly',
        cause: 'fire',
      });
      expect(html).toBe('<span class="feed-friendly">T-34-85</span> 烧毁');
    });

    it('通过 createKillFeedFromDestroyed 从摧毁事件生成', () => {
      const html = createKillFeedFromDestroyed({
        vehicleId: 'target-2',
        name: '虎式 Ausf. E(1944 后期型)',
        cause: 'ammo',
      });
      expect(html).toBe('<span class="feed-enemy">虎式 Ausf. E</span> 弹药殉爆');
    });
  });

  describe('同目标去重 KillFeedTracker', () => {
    it('0.5s 内同一目标只允许记录一次 (一发击毁时 hit 和 destroyed 去重)', () => {
      const tracker = new KillFeedTracker(0.5);

      // t=10.0s 时由 hit 事件触发击毁记录
      expect(tracker.recordKill('target-1', 10.0)).toBe(true);

      // t=10.016s (同帧或下一帧) destroyed 事件到达, 应被去重拦截
      expect(tracker.recordKill('target-1', 10.016)).toBe(false);

      // t=10.49s 仍处于 0.5s 窗口期内
      expect(tracker.recordKill('target-1', 10.49)).toBe(false);

      // t=10.51s 窗口已过, 允许记录 (如后续复活或新事件)
      expect(tracker.recordKill('target-1', 10.51)).toBe(true);
    });

    it('不同目标之间互不干扰', () => {
      const tracker = new KillFeedTracker(0.5);

      expect(tracker.recordKill('target-1', 10.0)).toBe(true);
      expect(tracker.recordKill('target-2', 10.1)).toBe(true);
      expect(tracker.recordKill('player', 10.2)).toBe(true);

      // target-1 仍然在保护期
      expect(tracker.recordKill('target-1', 10.3)).toBe(false);
      // target-2 仍然在保护期
      expect(tracker.recordKill('target-2', 10.4)).toBe(false);
    });

    it('clear 清空所有去重记录', () => {
      const tracker = new KillFeedTracker(0.5);

      expect(tracker.recordKill('target-1', 10.0)).toBe(true);
      expect(tracker.recordKill('target-1', 10.1)).toBe(false);

      tracker.clear();
      expect(tracker.recordKill('target-1', 10.1)).toBe(true);
    });
  });
});
