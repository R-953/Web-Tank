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
    if (!hasOccupant && !hasSwap) {
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
