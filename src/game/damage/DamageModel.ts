import type { CrewRole, Loadout, ModuleSpec, ModuleType, VehicleSpec } from '../../data/types';
import { CREW, CREW_ROLE_NAMES, MODULE_TYPES } from '../../data/modules';
import { DAMAGE } from '../../data/damage';
import { localBox, type LocalBox } from './geometry';

export interface ModuleState {
  id: string;
  type: ModuleType;
  name: string;
  spec: ModuleSpec;
  box: LocalBox;
  hp: number;
  maxHp: number;
  repairTime: number | null;
  /** 外挂模块(炮管、履带)不参与车内破片计算,只会被直接命中 */
  external: boolean;
}

export interface CrewMember {
  index: number;
  /** 初始岗位,用于显示「炮手阵亡」这类信息 */
  homeRole: CrewRole;
  /** 当前所在岗位;换位途中为 null */
  seat: CrewRole | null;
  hp: number;
  alive: boolean;
  box: LocalBox;
  swap: { to: CrewRole; remaining: number } | null;
}

export type DamageTarget = { kind: 'module'; module: ModuleState } | { kind: 'crew'; member: CrewMember };

export type DamageSource = 'shell' | 'spall' | 'blast' | 'fragment' | 'external' | 'detonation' | 'fire';

export interface HitRecord {
  kind: 'module' | 'crew';
  /** 模块 id 或 `crew:序号` */
  id: string;
  /** 显示名,例如「发动机」「炮手」 */
  name: string;
  source: DamageSource;
  damage: number;
  hpBefore: number;
  hpAfter: number;
  maxHp: number;
  /** 这一下把它打坏 / 打死了 */
  destroyed: boolean;
  /** 回放时间轴上的时刻,秒 */
  time: number;
}

/** 弹药架:容量、取弹顺序和当前存放的弹药 */
export interface AmmoRack {
  module: ModuleState;
  capacity: number;
  /** 1 最先取空 */
  drawOrder: number;
  /** 弹种 id → 发数 */
  contents: Map<string, number>;
}

export type DamageEvent =
  | { type: 'swap-start'; member: CrewMember; to: CrewRole }
  | { type: 'swap-done'; member: CrewMember; to: CrewRole }
  | { type: 'repaired'; modules: string[] }
  | { type: 'ammo-lost'; rack: string; rounds: number }
  | { type: 'fire-start'; module: string }
  | { type: 'fire-out'; reason: 'extinguished' | 'burnt-out' }
  | { type: 'cook-off' };

/** 起火状态 */
export interface FireState {
  /** 起火的模块 id */
  source: string;
  /** 已经烧了多久,秒 */
  burning: number;
  /** 燃料还能烧多久,秒 */
  remaining: number;
  /** 正在灭火:还剩多少秒扑灭;null = 没在灭 */
  extinguishing: number | null;
}

/** 岗位优先级:越靠前越要先补上 */
const SEAT_PRIORITY: CrewRole[] = ['gunner', 'driver', 'loader', 'commander', 'radio'];
const EXTERNAL: ReadonlySet<ModuleType> = new Set(['barrel', 'track']);

/**
 * 一辆车的模块 + 乘员状态:血量、换位、维修,以及由此得到的性能系数。
 * 不依赖渲染和物理,只关心数据,方便单测。
 */
export class DamageModel {
  readonly modules: ModuleState[];
  readonly crew: CrewMember[];
  /** 弹药架,按取弹顺序排列 */
  readonly racks: AmmoRack[];
  /** 被打坏但没殉爆的弹药架(弹药报废),由 update() 以事件形式报出 */
  private lostAmmo: { rack: string; rounds: number }[] = [];
  /** 起火;null = 没着火 */
  fire: FireState | null = null;
  /** 剩余灭火器次数 */
  extinguishers: number = DAMAGE.fire.extinguishers;
  private pendingFireEvents: DamageEvent[] = [];
  private readonly seats = new Map<CrewRole, { part: 'hull' | 'turret'; center: readonly [number, number, number] }>();
  knockedOut = false;
  /** 弹药殉爆 */
  detonated = false;
  repair: { remaining: number; total: number } | null = null;

  /**
   * @param loadout 携弹方案(弹种 id → 发数);缺省为默认弹种装满
   */
  constructor(readonly spec: VehicleSpec, loadout?: Loadout) {
    this.modules = spec.internals.modules.map((m) => {
      const t = MODULE_TYPES[m.type];
      return {
        id: m.id,
        type: m.type,
        name: moduleDisplayName(m),
        spec: m,
        box: localBox(m.part, m.center, m.size),
        hp: t.hp,
        maxHp: t.hp,
        repairTime: t.repairTime,
        external: EXTERNAL.has(m.type),
      };
    });
    this.crew = spec.internals.crew.map((c, index) => {
      this.seats.set(c.role, { part: c.part, center: c.center });
      return {
        index,
        homeRole: c.role,
        seat: c.role,
        hp: CREW.hp,
        alive: true,
        box: localBox(c.part, c.center, CREW.size),
        swap: null,
      };
    });
    this.racks = this.modules
      .filter((m) => m.type === 'ammo')
      .map((m) => ({ module: m, capacity: m.spec.capacity ?? 1, drawOrder: m.spec.drawOrder ?? 99, contents: new Map<string, number>() }))
      .sort((a, b) => a.drawOrder - b.drawOrder);
    const firstShell = spec.weapons[0]?.ammo[0];
    this.loadAmmo(loadout ?? (firstShell ? { [firstShell.id]: this.ammoCapacity } : {}));
  }

  // ---- 弹药 ----

  /** 所有弹药架的总容量 */
  get ammoCapacity(): number {
    return this.racks.reduce((n, r) => n + r.capacity, 0);
  }

  /** 某个弹种(缺省为全部)剩余发数 */
  rounds(shellId?: string): number {
    let n = 0;
    for (const r of this.racks) {
      if (shellId === undefined) for (const c of r.contents.values()) n += c;
      else n += r.contents.get(shellId) ?? 0;
    }
    return n;
  }

  rackRounds(rack: AmmoRack): number {
    let n = 0;
    for (const c of rack.contents.values()) n += c;
    return n;
  }

  rackOf(m: ModuleState): AmmoRack | undefined {
    return this.racks.find((r) => r.module === m);
  }

  /**
   * 按携弹方案装弹。与 War Thunder 相同:弹药架按取弹顺序排成一列「弹位」,少带弹时先空出最前面的弹位,
   * 所以最先取空的弹药架也最先空着;弹种按方案里的顺序依次往后排。
   */
  loadAmmo(loadout: Loadout): void {
    for (const r of this.racks) r.contents.clear();
    const rounds: string[] = [];
    for (const [id, n] of Object.entries(loadout)) for (let i = 0; i < Math.max(0, Math.floor(n)); i++) rounds.push(id);
    const total = Math.min(rounds.length, this.ammoCapacity);
    let skip = this.ammoCapacity - total;
    let next = 0;
    for (const r of this.racks) {
      for (let slot = 0; slot < r.capacity; slot++) {
        if (skip > 0) {
          skip--;
          continue;
        }
        const id = rounds[next++];
        r.contents.set(id, (r.contents.get(id) ?? 0) + 1);
      }
    }
  }

  /** 从取弹顺序最靠前、还有该弹种的弹药架取一发;返回弹药架 id,没有则 null */
  takeRound(shellId: string): string | null {
    for (const r of this.racks) {
      const n = r.contents.get(shellId) ?? 0;
      if (n > 0 && r.module.hp > 0) {
        if (n === 1) r.contents.delete(shellId);
        else r.contents.set(shellId, n - 1);
        return r.module.id;
      }
    }
    return null;
  }

  /** 把炮膛里的弹退回原来的弹药架(换弹种时);原架已毁则放进第一个有空位的架 */
  returnRound(shellId: string, rackId: string | null): void {
    const fits = (r: AmmoRack) => r.module.hp > 0 && this.rackRounds(r) < r.capacity;
    const rack = this.racks.find((r) => r.module.id === rackId && fits(r)) ?? [...this.racks].reverse().find(fits);
    if (rack) rack.contents.set(shellId, (rack.contents.get(shellId) ?? 0) + 1);
  }

  module(id: string): ModuleState | undefined {
    return this.modules.find((m) => m.id === id);
  }

  /** 单个模块的效率:归零为 0,否则按血量比例(见 DAMAGE.minEfficiency) */
  moduleEfficiency(m: ModuleState): number {
    if (m.hp <= 0) return 0;
    const k = DAMAGE.minEfficiency;
    return k + (1 - k) * (m.hp / m.maxHp);
  }

  /** 某类模块的效率,取最差的那一个;没有该类模块时为 1 */
  efficiency(type: ModuleType): number {
    let e = 1;
    for (const m of this.modules) if (m.type === type) e = Math.min(e, this.moduleEfficiency(m));
    return e;
  }

  occupant(role: CrewRole): CrewMember | undefined {
    return this.crew.find((c) => c.alive && c.seat === role);
  }

  get aliveCount(): number {
    return this.crew.filter((c) => c.alive).length;
  }

  /** 乘员工作效率:阵亡为 0,否则按血量比例(公式与模块相同,见 DAMAGE.crewMinEfficiency) */
  crewEfficiency(c: CrewMember): number {
    if (!c.alive || c.hp <= 0) return 0;
    const k = DAMAGE.crewMinEfficiency;
    return k + (1 - k) * (c.hp / CREW.hp);
  }

  /** 某个岗位上的人的效率;岗位空着为 0 */
  seatEfficiency(role: CrewRole): number {
    const c = this.occupant(role);
    return c ? this.crewEfficiency(c) : 0;
  }

  // ---- 性能系数(Vehicle 每步读取) ----

  /** 发动机 × 传动:决定可用功率(极速、加速) */
  get powerFactor(): number {
    return this.efficiency('engine') * this.efficiency('transmission');
  }

  /** 驾驶员效率:受伤后功率和转向都按比例下降 */
  get driverFactor(): number {
    return this.seatEfficiency('driver');
  }

  /** 实际可用的机动能力 = 发动机 × 传动 × 驾驶员 */
  get mobilityFactor(): number {
    return this.powerFactor * this.driverFactor;
  }

  /** 履带:取两条中较差的,决定速度上限;0 = 断履带 */
  get trackFactor(): number {
    return this.efficiency('track');
  }

  get canDrive(): boolean {
    return !this.knockedOut && !this.repair && this.mobilityFactor > 0 && this.trackFactor > 0;
  }

  /** 方向机速度倍数 = 方向机效率 × 炮手效率 */
  get traverseFactor(): number {
    return this.knockedOut ? 0 : this.efficiency('traverse') * this.seatEfficiency('gunner');
  }

  /** 高低机速度倍数 = 高低机效率 × 炮手效率 */
  get elevationFactor(): number {
    return this.knockedOut ? 0 : this.efficiency('elevation') * this.seatEfficiency('gunner');
  }

  get canFire(): boolean {
    return !this.knockedOut && !!this.occupant('gunner') && this.efficiency('barrel') > 0 && this.efficiency('breech') > 0;
  }

  /**
   * 装填速率倍数 = 炮闩效率 × 装填手效率;装填手不在位时由炮手兼任,速度再减半。
   */
  get reloadRate(): number {
    if (!this.canFire) return 0;
    const hands = this.occupant('loader') ? this.seatEfficiency('loader') : 0.5 * this.seatEfficiency('gunner');
    return this.efficiency('breech') * hands;
  }

  /** 维修速度倍数:所有存活乘员一起修,取平均效率 */
  get repairRate(): number {
    const alive = this.crew.filter((c) => c.alive);
    if (alive.length === 0) return 0;
    return alive.reduce((sum, c) => sum + this.crewEfficiency(c), 0) / alive.length;
  }

  /** 换位速度倍数:车长指挥,0.5 + 0.5 × 车长效率(车长缺位时 0.5) */
  get swapRate(): number {
    return 0.5 + 0.5 * this.seatEfficiency('commander');
  }

  /** 炮管效率,受损后散布变大 */
  get barrelFactor(): number {
    return this.efficiency('barrel');
  }

  /** 车内破片 / 冲击波能打到的目标:内部模块 + 存活乘员 */
  internalTargets(): DamageTarget[] {
    const out: DamageTarget[] = [];
    for (const m of this.modules) {
      if (m.external) continue;
      // 空的弹药架相当于不存在(与 War Thunder 相同),打不坏也不会殉爆
      if (m.type === 'ammo' && this.rackRounds(this.rackOf(m)!) === 0) continue;
      out.push({ kind: 'module', module: m });
    }
    for (const c of this.crew) if (c.alive) out.push({ kind: 'crew', member: c });
    return out;
  }

  /**
   * 扣血;打坏弹药架时按剩余弹量掷骰决定是否殉爆(没炸的弹药报废)。返回命中记录(对已阵亡乘员返回 null)。
   * @param rng 殉爆掷骰;不传时取中位结果(概率 ≥ 50% 才殉爆),便于确定性测试
   */
  applyDamage(target: DamageTarget, amount: number, source: DamageSource, time: number, rng?: () => number): HitRecord | null {
    if (amount <= 0) return null;
    if (target.kind === 'crew') {
      const c = target.member;
      if (!c.alive) return null;
      const before = c.hp;
      c.hp = Math.max(0, c.hp - amount);
      const killed = c.hp <= 0;
      if (killed) this.killCrew(c);
      this.checkKnockout();
      return {
        kind: 'crew',
        id: `crew:${c.index}`,
        name: CREW_ROLE_NAMES[c.homeRole],
        source,
        damage: amount,
        hpBefore: before,
        hpAfter: c.hp,
        maxHp: CREW.hp,
        destroyed: killed,
        time,
      };
    }
    const m = target.module;
    const before = m.hp;
    m.hp = Math.max(0, m.hp - amount);
    const destroyed = before > 0 && m.hp <= 0;
    if ((m.type === 'fuel' || m.type === 'engine') && source !== 'fire' && !this.fire && !this.knockedOut) {
      const f = DAMAGE.fire;
      const p = destroyed ? f.destroyedChance[m.type] : f.chance[m.type];
      if (rng ? rng() < p : p >= 0.5) this.ignite(m.id, rng);
    }
    if (destroyed && m.type === 'ammo' && !this.detonated) {
      const rack = this.rackOf(m);
      const rounds = rack ? this.rackRounds(rack) : 1;
      const fill = rack ? rounds / rack.capacity : 1;
      const p = DAMAGE.ammo.detonationChance * fill;
      if (rounds > 0 && (rng ? rng() < p : p >= 0.5)) {
        this.detonated = true;
        for (const c of this.crew) if (c.alive) this.killCrew(c);
      } else if (rack && rounds > 0) {
        rack.contents.clear();
        this.lostAmmo.push({ rack: m.id, rounds });
      }
    }
    this.checkKnockout();
    return {
      kind: 'module',
      id: m.id,
      name: m.name,
      source,
      damage: amount,
      hpBefore: before,
      hpAfter: m.hp,
      maxHp: m.maxHp,
      destroyed,
      time,
    };
  }

  /** 已打坏(血量归零)、可以维修的模块 */
  brokenRepairable(): ModuleState[] {
    return this.modules.filter((m) => m.hp <= 0 && m.repairTime !== null);
  }

  /** 所有受损、可以维修的模块(包括没打坏、只是掉了血的) */
  damagedRepairable(): ModuleState[] {
    return this.modules.filter((m) => m.hp < m.maxHp && m.repairTime !== null);
  }

  /**
   * 开始维修(按键触发);维修期间不能移动。
   * 一次修好全部受损模块,时长取其中最长的:打坏的模块要完整的 repairTime,
   * 只掉了血的按损失比例折算(发动机掉 40% 血 → 0.4 × 20 s)。
   */
  startRepair(): boolean {
    if (this.knockedOut || this.repair) return false;
    const damaged = this.damagedRepairable();
    if (damaged.length === 0) return false;
    const total = Math.max(...damaged.map((m) => (m.repairTime as number) * (1 - Math.max(0, m.hp) / m.maxHp)));
    this.repair = { remaining: total, total };
    return true;
  }

  cancelRepair(): void {
    this.repair = null;
  }

  /** 每个固定步调用:推进换位与维修 */
  update(dt: number, rng?: () => number): DamageEvent[] {
    const events: DamageEvent[] = [];
    this.burn(dt, rng);
    events.push(...this.pendingFireEvents);
    this.pendingFireEvents = [];
    if (this.knockedOut) {
      if (this.fire) this.fire = null;
      return events;
    }

    for (const lost of this.lostAmmo) events.push({ type: 'ammo-lost', ...lost });
    this.lostAmmo = [];

    const swapRate = this.swapRate;
    for (const c of this.crew) {
      if (!c.alive || !c.swap) continue;
      c.swap.remaining -= dt * swapRate;
      if (c.swap.remaining <= 0) {
        const to = c.swap.to;
        c.swap = null;
        if (this.occupant(to)) continue; // 已有人补上
        c.seat = to;
        const seat = this.seats.get(to)!;
        c.box = localBox(seat.part, seat.center, CREW.size);
        events.push({ type: 'swap-done', member: c, to });
      }
    }
    for (const role of SEAT_PRIORITY) {
      if (!this.seats.has(role) || this.occupant(role) || this.crew.some((c) => c.alive && c.swap?.to === role)) continue;
      const donor = this.findDonor(role);
      if (!donor) continue;
      donor.seat = null;
      donor.swap = { to: role, remaining: CREW.swapTime };
      events.push({ type: 'swap-start', member: donor, to: role });
    }

    if (this.repair) {
      this.repair.remaining -= dt * this.repairRate;
      if (this.repair.remaining <= 0) {
        const fixed = this.damagedRepairable();
        fixed.forEach((m) => (m.hp = m.maxHp));
        this.repair = null;
        events.push({ type: 'repaired', modules: fixed.map((m) => m.id) });
      }
    }
    return events;
  }

  /** 点火(已经着火或已被摧毁时无效) */
  ignite(moduleId: string, rng?: () => number): void {
    if (this.fire || this.knockedOut) return;
    const [lo, hi] = DAMAGE.fire.burnTime;
    const t = rng ? rng() : 0.5;
    this.fire = { source: moduleId, burning: 0, remaining: lo + (hi - lo) * t, extinguishing: null };
    this.pendingFireEvents.push({ type: 'fire-start', module: moduleId });
  }

  /** 开始灭火(按键);没着火、正在灭、灭火器用完或没有活着的乘员时返回 false */
  extinguish(): boolean {
    if (!this.fire || this.fire.extinguishing !== null || this.extinguishers <= 0 || this.aliveCount === 0 || this.knockedOut) return false;
    this.fire.extinguishing = DAMAGE.fire.extinguishTime;
    return true;
  }

  /** 燃烧一步:伤害起火点附近的模块 / 乘员,推进灭火和殉爆判定 */
  private burn(dt: number, rng?: () => number): void {
    const fire = this.fire;
    if (!fire) return;
    const f = DAMAGE.fire;
    fire.burning += dt;
    fire.remaining -= dt;
    if (fire.extinguishing !== null) {
      fire.extinguishing -= dt;
      if (fire.extinguishing <= 0) {
        this.extinguishers--;
        this.fire = null;
        this.pendingFireEvents.push({ type: 'fire-out', reason: 'extinguished' });
        return;
      }
    }
    if (fire.remaining <= 0) {
      this.fire = null;
      this.pendingFireEvents.push({ type: 'fire-out', reason: 'burnt-out' });
      return;
    }
    const src = this.module(fire.source);
    if (!src) return;
    const center = hullPoint(this.spec, src.box.part, src.box.center);
    for (const m of this.modules) {
      if (m.external || m.hp <= 0) continue;
      const d = distanceToBox(this.spec, m, center);
      if (d > f.radius) continue;
      if (m.type === 'ammo') {
        // 弹药架被烤:烧够一段时间后按剩余弹量掷骰殉爆
        const rack = this.rackOf(m);
        const rounds = rack ? this.rackRounds(rack) : 0;
        if (rounds > 0 && fire.burning >= f.cookOffDelay) {
          const p = f.cookOffChance * (rounds / (rack?.capacity ?? 1)) * dt;
          if (rng ? rng() < p : false) {
            this.detonated = true;
            for (const c of this.crew) if (c.alive) this.killCrew(c);
            this.pendingFireEvents.push({ type: 'cook-off' });
            this.checkKnockout();
            this.fire = null;
            return;
          }
        }
        continue;
      }
      this.applyDamage({ kind: 'module', module: m }, f.moduleDps * dt, 'fire', 0);
    }
    for (const c of this.crew) {
      if (!c.alive) continue;
      if (distanceToCrew(this.spec, c, center) <= f.radius) this.applyDamage({ kind: 'crew', member: c }, f.crewDps * dt, 'fire', 0);
    }
  }

  /** 找一个岗位优先级更低、没在换位的活着的乘员来顶替 role */
  private findDonor(role: CrewRole): CrewMember | undefined {
    const need = SEAT_PRIORITY.indexOf(role);
    let best: CrewMember | undefined;
    let bestRank = need;
    for (const c of this.crew) {
      if (!c.alive || c.swap || c.seat === null) continue;
      const rank = SEAT_PRIORITY.indexOf(c.seat);
      if (rank > bestRank) {
        best = c;
        bestRank = rank;
      }
    }
    return best;
  }

  private killCrew(c: CrewMember): void {
    c.alive = false;
    c.hp = 0;
    c.seat = null;
    c.swap = null;
  }

  private checkKnockout(): void {
    if (this.detonated || this.aliveCount < CREW.minAlive) {
      this.knockedOut = true;
      this.repair = null;
    }
  }
}

function moduleDisplayName(m: ModuleSpec): string {
  const base = MODULE_TYPES[m.type].name;
  const parts = m.id.split('_');
  const suffix = parts[parts.length - 1];
  const side = /^l[fr]?$/.test(suffix) ? '左' : /^r[fr]?$/.test(suffix) ? '右' : '';
  const pos = suffix.length === 2 ? (suffix[1] === 'f' ? '前' : '后') : '';
  const where = m.id.includes('bustle')
    ? '尾舱'
    : m.id.includes('floor')
      ? '车底'
      : m.id.includes('turret')
        ? '炮塔'
        : m.id.includes('front')
          ? '前部'
          : '';
  return `${side}${pos}${where}${base}`;
}

/**
 * 模块 / 乘员盒子中心换到车体坐标(忽略炮塔转角:起火点都在车体里,炮塔绕中心转,距离误差很小)。
 * 火炮坐标系的原点在炮塔正面耳轴处。
 */
function hullPoint(spec: VehicleSpec, part: 'hull' | 'turret' | 'gun', c: { x: number; y: number; z: number }) {
  const p = { x: c.x, y: c.y, z: c.z };
  if (part === 'turret' || part === 'gun') p.y += spec.hull.height / 2;
  if (part === 'gun') {
    p.y += spec.turret.height / 2;
    p.z -= spec.turret.length / 2;
  }
  return p;
}

function distanceToBox(spec: VehicleSpec, m: ModuleState, p: { x: number; y: number; z: number }): number {
  const c = hullPoint(spec, m.box.part, m.box.center);
  const h = m.box.half;
  const dx = Math.max(0, Math.abs(p.x - c.x) - h.x);
  const dy = Math.max(0, Math.abs(p.y - c.y) - h.y);
  const dz = Math.max(0, Math.abs(p.z - c.z) - h.z);
  return Math.hypot(dx, dy, dz);
}

function distanceToCrew(spec: VehicleSpec, c: CrewMember, p: { x: number; y: number; z: number }): number {
  const q = hullPoint(spec, c.box.part, c.box.center);
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
}
