import type { CrewRole, ModuleType } from '../../data/types';
import type { HitReplay } from '../../game/Game';
import { CREW_ROLE_NAMES } from '../../data/modules';

export type StatusCls = 'red' | 'amber' | 'white';

export interface StatusMsg {
  text: string;
  cls: StatusCls;
}

export interface DamageStatusSource {
  modules: Array<{ id: string; type: ModuleType; hp: number; maxHp: number; name?: string }>;
  crew: Array<{
    alive: boolean;
    homeRole: CrewRole;
    seat: CrewRole | null;
    swap: { to: CrewRole; remaining: number } | null;
  }>;
  fire: { extinguishing: number | null; source?: string; burning?: number; remaining?: number } | null;
  extinguishers: number;
}

/** 乘员岗位显示名 */
export function getCrewRoleName(role: string): string {
  if (role in CREW_ROLE_NAMES) {
    return CREW_ROLE_NAMES[role as CrewRole];
  }
  return role;
}

/**
 * 岗位无人时的提示文案:
 * - 驾驶员 → 无法驾驶
 * - 炮手 → 无法瞄准和开火
 * - 装填手 → 无法装填
 * - 车长 → 车长昏迷,无法使用超越控制
 * - 无线电员 / 机枪手 / 机电员 → 无法操作机枪 / 电台
 * - 兜底 → 无法操作{岗位名}负责的装置
 */
export function getCrewIncapacitatedMessage(role: string, roleName?: string): string {
  const name = roleName ?? getCrewRoleName(role);
  if (role === 'commander' || name === '车长') {
    return '车长昏迷,无法使用超越控制';
  }
  if (role === 'driver' || name === '驾驶员') {
    return `${name}昏迷,无法驾驶`;
  }
  if (role === 'gunner' || name === '炮手') {
    return `${name}昏迷,无法瞄准和开火`;
  }
  if (role === 'loader' || name === '装填手') {
    return `${name}昏迷,无法装填`;
  }
  if (role === 'radio' || name === '机电员' || name === '无线电员' || name === '机枪手') {
    return `${name}昏迷,无法操作机枪 / 电台`;
  }
  return `${name}昏迷,无法操作${name}负责的装置`;
}

/** 状态型提示的优先级检查顺序 */
const ROLE_CHECK_ORDER: CrewRole[] = ['driver', 'gunner', 'loader', 'commander', 'radio'];

/**
 * 状态型提示:按优先级排序,最多返回 limit 条(默认 3 条)
 *
 * 优先级:
 * 1. 着火(红「起火!」/ 黄「正在灭火 3.2s」/ 红「起火!没有灭火器了」)
 * 2. 发动机 hp <= 0(红「发动机受损,无法移动」)
 * 3. 变速箱 hp <= 0(红「传动装置受损,无法移动」)
 * 4. 发动机 / 变速箱受损但没报废(黄「发动机受损」/「传动装置受损」)
 * 5. 炮闩 hp <= 0(红「炮闩损坏,无法开火」)
 * 6. 炮管 hp <= 0(红「炮管损坏,无法开火」)
 * 7. 履带断裂(红「履带断裂」)
 * 8. 某岗位没人(红「{岗位名}昏迷,无法{功能}」;正在被顶替时不显示)
 */
export function statusMessages(damage: DamageStatusSource, limit = 3): StatusMsg[] {
  const out: StatusMsg[] = [];

  // 1. 着火
  if (damage.fire) {
    if (damage.fire.extinguishing !== null) {
      out.push({ text: `正在灭火 ${Math.max(0, damage.fire.extinguishing).toFixed(1)}s`, cls: 'amber' });
    } else if (damage.extinguishers <= 0) {
      out.push({ text: '起火!没有灭火器了', cls: 'red' });
    } else {
      out.push({ text: '起火!', cls: 'red' });
    }
  }

  const isBroken = (type: ModuleType) => damage.modules.some((m) => m.type === type && m.hp <= 0);
  const isDamaged = (type: ModuleType) => damage.modules.some((m) => m.type === type && m.hp > 0 && m.hp < m.maxHp);

  // 2. 发动机 hp <= 0
  if (isBroken('engine')) {
    out.push({ text: '发动机受损,无法移动', cls: 'red' });
  }

  // 3. 变速箱 hp <= 0
  if (isBroken('transmission')) {
    out.push({ text: '传动装置受损,无法移动', cls: 'red' });
  }

  // 4. 发动机 / 变速箱受损但没报废
  if (!isBroken('engine') && isDamaged('engine')) {
    out.push({ text: '发动机受损', cls: 'amber' });
  }
  if (!isBroken('transmission') && isDamaged('transmission')) {
    out.push({ text: '传动装置受损', cls: 'amber' });
  }

  // 5. 炮闩 hp <= 0
  if (isBroken('breech')) {
    out.push({ text: '炮闩损坏,无法开火', cls: 'red' });
  }

  // 6. 炮管 hp <= 0
  if (isBroken('barrel')) {
    out.push({ text: '炮管损坏,无法开火', cls: 'red' });
  }

  // 7. 履带断裂
  if (isBroken('track')) {
    out.push({ text: '履带断裂', cls: 'red' });
  }

  // 8. 某岗位没人(乘员阵亡且没人顶替、也没有正在进行的顶替)
  const presentRoles = new Set(damage.crew.map((c) => c.homeRole));
  const order: CrewRole[] = [...ROLE_CHECK_ORDER];
  for (const r of presentRoles) {
    if (!order.includes(r)) order.push(r);
  }

  for (const role of order) {
    if (!presentRoles.has(role)) continue;
    const hasOccupant = damage.crew.some((c) => c.alive && c.seat === role);
    const hasSwap = damage.crew.some((c) => c.alive && c.swap?.to === role);
    // 只有这个岗位原来的乘员阵亡才算「昏迷」;乘员活着只是去顶替别的岗位时,原岗位空着不报
    const homeDead = damage.crew.some((c) => !c.alive && c.homeRole === role);
    if (!hasOccupant && !hasSwap && homeDead) {
      out.push({ text: getCrewIncapacitatedMessage(role), cls: 'red' });
    }
  }

  return out.slice(0, limit);
}

/** 状态表里已经包含的报废模块名称关键字,在瞬时提示中不再重复报「损坏」 */
const TABLE_MODULE_KEYWORDS = ['发动机', '传动', '炮闩', '炮管', '履带'];

function isModuleOnTable(name: string): boolean {
  return TABLE_MODULE_KEYWORDS.some((kw) => name.includes(kw));
}

/**
 * 从击中回放数据生成己方瞬时提示:
 * - 每个受伤但没死的乘员「{岗位名}受伤」(黄)
 * - 受损但没报废的模块「{模块名}受损」(黄)
 * - 报废的模块里不在上表的「{模块名}损坏」(红)
 * - 同一发里重复的名字去重
 */
export function transientFromHit(replay: HitReplay): StatusMsg[] {
  const hits = replay.penetration?.hits ?? [];
  if (!hits.length) return [];

  const crewInjuredNames = new Set<string>();
  const crewDeadNames = new Set<string>();
  const moduleDamagedNames = new Set<string>();
  const moduleBrokenNames = new Set<string>();

  // 先统计各部位的最终状态
  for (const h of hits) {
    if (h.kind === 'crew') {
      if (h.destroyed || h.hpAfter <= 0) {
        crewDeadNames.add(h.name);
      } else if (h.damage > 0) {
        crewInjuredNames.add(h.name);
      }
    } else if (h.kind === 'module') {
      if (h.destroyed || h.hpAfter <= 0) {
        moduleBrokenNames.add(h.name);
      } else if (h.damage > 0) {
        moduleDamagedNames.add(h.name);
      }
    }
  }

  const out: StatusMsg[] = [];
  const emittedNames = new Set<string>();

  // 1. 受伤但没死的乘员 (黄)
  for (const name of crewInjuredNames) {
    if (crewDeadNames.has(name) || emittedNames.has(name)) continue;
    emittedNames.add(name);
    out.push({ text: `${name}受伤`, cls: 'amber' });
  }

  // 2. 受损但没报废的模块 (黄)
  for (const name of moduleDamagedNames) {
    if (moduleBrokenNames.has(name) || emittedNames.has(name)) continue;
    emittedNames.add(name);
    out.push({ text: `${name}受损`, cls: 'amber' });
  }

  // 3. 报废的模块里不在上表的「{模块名}损坏」(红)
  for (const name of moduleBrokenNames) {
    if (emittedNames.has(name)) continue;
    emittedNames.add(name);
    if (!isModuleOnTable(name)) {
      out.push({ text: `${name}损坏`, cls: 'red' });
    }
  }

  return out;
}

/** 管理 3.5 秒过期的瞬时消息队列 */
export class MessageQueue {
  private items: Array<{ msg: StatusMsg; expiresAt: number }> = [];

  constructor(readonly lifetime = 3.5) {}

  push(msg: StatusMsg, now: number): void {
    const existing = this.items.find((i) => i.msg.text === msg.text);
    if (existing) {
      existing.msg = msg;
      existing.expiresAt = now + this.lifetime;
    } else {
      this.items.push({ msg, expiresAt: now + this.lifetime });
    }
  }

  get(now: number): StatusMsg[] {
    this.items = this.items.filter((item) => now < item.expiresAt);
    return this.items.map((i) => i.msg);
  }

  clear(): void {
    this.items = [];
  }
}

/** 将秒数格式化为 mm:ss */
export function formatClock(seconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

/** 维修倒计时文案 */
export function repairLabel(remainingSec: number): string {
  return `修复车辆还需 ${formatClock(remainingSec)}`;
}

/** 倒计时独占一行,不计入普通状态提示的行数上限 */
export function statusDisplayRows(
  messages: StatusMsg[],
  repairCountdown: StatusMsg | null,
  limit = 4
): { messages: StatusMsg[]; repairCountdown: StatusMsg | null } {
  return { messages: messages.slice(0, limit), repairCountdown };
}

export interface ActionHint {
  key: string;
  text: string;
}

export interface HintConditions {
  /** 是否着火,以及灭火状态(extinguishing !== null 为正在灭火中) */
  fire: { extinguishing: number | null } | null;
  /** 灭火器剩余数量 */
  extinguishers: number;
  /** 是否正在维修中 */
  isRepairing: boolean;
  /** 是否有损坏的可维修模块 */
  hasRepairable: boolean;
}

export interface HintKeys {
  repair: string;
  extinguish: string;
}

/**
 * 操作提示行纯函数:
 * - 优先级 1: 灭火提示。着火且有灭火器且未在灭火中 -> `[keys.extinguish] 灭火`
 * - 优先级 2: 维修提示。没在维修、没着火、有可修模块 -> `[keys.repair] 开始维修车辆`
 * - 其余情况返回 null
 */
export function hintLine(cond: HintConditions, keys: HintKeys): ActionHint | null {
  if (cond.fire && cond.fire.extinguishing === null && cond.extinguishers > 0) {
    return { key: keys.extinguish, text: '灭火' };
  }
  if (!cond.isRepairing && !cond.fire && cond.hasRepairable) {
    return { key: keys.repair, text: '开始维修车辆' };
  }
  return null;
}

export function formatActionHintHtml(hint: ActionHint): string {
  return `<span class="hud-hint-key">${hint.key}</span><span>${hint.text}</span>`;
}

export function formatActionHintText(hint: ActionHint): string {
  return `[${hint.key}] ${hint.text}`;
}

/** 车型太长时使用短名: 去掉中英文括号及其中内容(如「虎式 Ausf. E(1944 后期型)」→「虎式 Ausf. E」) */
export function killFeedName(name: string): string {
  if (!name || !name.trim()) return '未知';
  return name.replace(/\s*(\([^)]*\)|（[^）]*）)/g, '').trim();
}

export type Affiliation = 'friendly' | 'enemy';

export interface KillFeedShooterInput {
  shooterName: string;
  shooterAffiliation: Affiliation;
  shellName: string;
  targetName: string;
  targetAffiliation: Affiliation;
}

export interface KillFeedNoShooterInput {
  targetName: string;
  targetAffiliation: Affiliation;
  cause: 'crew' | 'ammo' | 'fire';
}

export const KILL_CAUSE_TEXT: Record<'crew' | 'ammo' | 'fire', string> = {
  ammo: '弹药殉爆',
  crew: '乘员不足',
  fire: '烧毁',
};

export function isFriendly(vehicleId: string): boolean {
  return vehicleId === 'player' || vehicleId.startsWith('friendly');
}

export function formatKillFeedShooter(input: KillFeedShooterInput): string {
  const shooterCls = input.shooterAffiliation === 'friendly' ? 'feed-friendly' : 'feed-enemy';
  const targetCls = input.targetAffiliation === 'friendly' ? 'feed-friendly' : 'feed-enemy';
  const shooter = killFeedName(input.shooterName);
  const target = killFeedName(input.targetName);
  return `<span class="${shooterCls}">${shooter}</span> ➡${input.shellName} <span class="${targetCls}">${target}</span>`;
}

export function formatKillFeedNoShooter(input: KillFeedNoShooterInput): string {
  const targetCls = input.targetAffiliation === 'friendly' ? 'feed-friendly' : 'feed-enemy';
  const target = killFeedName(input.targetName);
  const causeText = KILL_CAUSE_TEXT[input.cause] ?? '已摧毁';
  return `<span class="${targetCls}">${target}</span> ${causeText}`;
}

export function createKillFeedFromHit(e: {
  shooterId: string;
  shooterName?: string;
  targetId: string;
  targetName: string;
  replay: HitReplay;
}): string {
  return formatKillFeedShooter({
    shooterName: e.shooterName || '未知',
    shooterAffiliation: isFriendly(e.shooterId) ? 'friendly' : 'enemy',
    shellName: e.replay.shell.name,
    targetName: e.targetName || '未知',
    targetAffiliation: isFriendly(e.targetId) ? 'friendly' : 'enemy',
  });
}

export function createKillFeedFromDestroyed(e: {
  vehicleId: string;
  name: string;
  cause: 'crew' | 'ammo' | 'fire';
}): string {
  return formatKillFeedNoShooter({
    targetName: e.name || '未知',
    targetAffiliation: isFriendly(e.vehicleId) ? 'friendly' : 'enemy',
    cause: e.cause,
  });
}

/**
 * 击毁流同目标去重器:
 * 0.5 秒内同一目标不能出现两行 (一发击毁时 hit 和 destroyed 事件都会来, 按目标 id 去重)
 */
export class KillFeedTracker {
  private recentKills = new Map<string, number>();

  constructor(readonly windowSeconds = 0.5) {}

  /**
   * 记录或检查某目标是否应该在击毁流中输出。
   * 如果在 windowSeconds 内该目标已有击毁记录，则返回 false（去重）；
   * 否则记录当前时间并返回 true。
   */
  recordKill(targetId: string, now: number): boolean {
    const last = this.recentKills.get(targetId);
    if (last !== undefined && now - last < this.windowSeconds) {
      return false;
    }
    this.recentKills.set(targetId, now);
    return true;
  }

  hasRecentKill(targetId: string, now: number): boolean {
    const last = this.recentKills.get(targetId);
    return last !== undefined && now - last < this.windowSeconds;
  }

  clear(): void {
    this.recentKills.clear();
  }
}
