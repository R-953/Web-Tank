import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Loadout, MapSpec, ShellSpec, SpawnSpec, VehicleSpec } from '../data/types';
import { GameMap } from './Map';
import { Vehicle, idleControls, type FireRequest, type VehicleControls, type VehiclePart } from './Vehicle';
import { Projectile, type ProjectileHit } from './Projectile';
import { Effects } from './Effects';
import { resolveHit, type HitResolution } from './Damage';
import { GunnerAI, PatrolController, StaticController, type AIContext, type VehicleController } from './Controllers';
import type { HitRecord } from './damage/DamageModel';
import { makeRng } from './damage/geometry';
import { simulatePenetration, type PenetrationReport } from './damage/penetration';
import { DAMAGE } from '../data/damage';
import { MODULE_TYPES, CREW_ROLE_NAMES } from '../data/modules';
import { SHELL_TYPES } from '../data/shells';
import { SURFACES } from '../data/surfaces';
import { AI } from '../data/ai';
import { defaultLoadout, randomLoadout } from './Loadout';
import type { AttachPart, CrewRole, Vec3 } from '../data/types';

const DEG2RAD = Math.PI / 180;

/**
 * 一次命中的完整记录(车体本地坐标),供命中记录和右上角回放使用。
 * before / after:这一发前后每个模块 / 乘员的血量比例(0..1),键为模块 id 或 `crew:序号`。
 */
export interface HitReplay {
  spec: VehicleSpec;
  /** 打进来的是哪种弹 */
  shell: ShellSpec;
  turretYaw: number;
  gunPitch: number;
  part: VehiclePart;
  entry: THREE.Vector3;
  dir: THREE.Vector3;
  /** 装甲判定;直接打中炮管时为 null */
  armor: HitResolution | null;
  /** 车外的伤害:直接打中的外挂模块(履带 / 炮管),以及化学能弹在车外起爆波及的外挂模块 */
  external: HitRecord[];
  penetration: PenetrationReport | null;
  before: Record<string, number>;
  after: Record<string, number>;
  /** 命中时刻的内构布局(乘员可能已经换过位) */
  layout: {
    modules: { id: string; type: string; part: AttachPart; center: Vec3; size: Vec3 }[];
    crew: { id: string; role: CrewRole; part: AttachPart; center: Vec3 }[];
  };
  destroyed: boolean;
  detonated: boolean;
}

export type GameEvent =
  | { type: 'fired'; shooterId: string }
  | {
      type: 'hit';
      shooterId: string;
      targetId: string;
      targetName: string;
      part: VehiclePart;
      replay: HitReplay;
    }
  | { type: 'destroyed'; vehicleId: string; name: string; cause: 'crew' | 'ammo' }
  | { type: 'ammo-lost'; vehicleId: string; rack: string; rounds: number }
  | { type: 'defeat' }
  | { type: 'repair'; vehicleId: string; state: 'start' | 'cancel' | 'done'; seconds: number }
  | { type: 'crew-swap'; vehicleId: string; crew: string; to: string; state: 'start' | 'done' }
  | { type: 'victory' };

export interface GameConfig {
  map: MapSpec;
  vehicles: Readonly<Record<string, VehicleSpec>>;
  /** 随机种子(跳弹、殉爆、车内破片、敌方携弹与瞄准);缺省随机 */
  seed?: number;
  /** 玩家携弹方案;缺省见 defaultLoadout */
  playerLoadout?: Loadout;
  /** 敌方是否还击(缺省 true;各出生点还可以单独关) */
  enemyAi?: boolean;
}

/**
 * 一局游戏的全部状态:物理世界、地图、载具、抛射体、特效。
 * 不碰 DOM / 渲染器,可以在测试里直接跑 fixedUpdate。
 */
export class Game {
  readonly world: RAPIER.World;
  readonly root = new THREE.Group();
  readonly map: GameMap;
  readonly player: Vehicle;
  readonly targets: Vehicle[] = [];
  readonly vehicles: Vehicle[] = [];
  readonly effects = new Effects();
  projectiles: Projectile[] = [];
  state: 'playing' | 'victory' | 'defeat' = 'playing';
  /** 本局的随机数源(可复现) */
  readonly rng: () => number;
  /** 已模拟的游戏时间,秒 */
  time = 0;

  private events: GameEvent[] = [];
  private playerControls: VehicleControls = idleControls();
  /** 两个物理步之间的一次点击也要算数(高刷新率下某些帧不跑物理步) */
  private fireLatch = false;
  private readonly controllers = new Map<Vehicle, VehicleController>();
  private readonly gunners = new Map<Vehicle, GunnerAI>();
  private readonly colliderOwners = new Map<number, { vehicle: Vehicle; part: VehiclePart }>();

  constructor(private readonly config: GameConfig) {
    this.rng = makeRng(config.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.map = new GameMap(config.map, this.world);
    this.root.name = 'game';
    this.root.add(this.map.root, this.effects.root);

    const { player, targets } = config.map.spawns;
    const playerSpec = config.vehicles[player.vehicleId];
    this.player = this.spawn('player', player, config.playerLoadout ?? (playerSpec ? defaultLoadout(playerSpec) : undefined));
    targets.forEach((s, i) => {
      const spec = config.vehicles[s.vehicleId];
      const v = this.spawn(`target-${i + 1}`, s, spec ? randomLoadout(spec, this.rng, s.ammoFraction) : undefined);
      this.targets.push(v);
      this.controllers.set(
        v,
        s.patrol ? new PatrolController(s.position, s.patrol.to, s.patrol.speed) : new StaticController(),
      );
      if (config.enemyAi !== false && s.ai !== false && (spec?.weapons[0]?.ammo.length ?? 0) > 0) this.gunners.set(v, new GunnerAI());
    });

    // 走一步让所有碰撞体进入查询结构
    this.world.step();
    for (const v of this.vehicles) {
      v.capturePose();
      v.capturePose();
      v.syncVisual(1);
    }
  }

  get targetsDestroyed(): number {
    return this.targets.filter((t) => t.isDead).length;
  }

  setPlayerControls(controls: VehicleControls): void {
    this.playerControls = controls;
    if (controls.fire) this.fireLatch = true;
  }

  /** 玩家按数字键切换弹种 */
  selectShell(index: number): void {
    this.player.selectShell(index);
  }

  /** 敌方是否已进入交战状态(调试 / HUD 用) */
  isAlerted(v: Vehicle): boolean {
    return this.gunners.get(v)?.alerted ?? false;
  }

  /** 玩家按下维修键:没在修就开始修,正在修就取消 */
  toggleRepair(): void {
    const d = this.player.damage;
    if (d.repair) {
      d.cancelRepair();
      this.events.push({ type: 'repair', vehicleId: this.player.id, state: 'cancel', seconds: 0 });
    } else if (d.startRepair()) {
      this.events.push({ type: 'repair', vehicleId: this.player.id, state: 'start', seconds: d.repair!.total });
    }
  }

  fixedUpdate(dt: number): void {
    for (const v of this.vehicles) {
      for (const e of v.damage.update(dt)) {
        if (e.type === 'repaired') this.events.push({ type: 'repair', vehicleId: v.id, state: 'done', seconds: 0 });
        else if (e.type === 'ammo-lost') this.events.push({ type: 'ammo-lost', vehicleId: v.id, rack: e.rack, rounds: e.rounds });
        else
          this.events.push({
            type: 'crew-swap',
            vehicleId: v.id,
            crew: CREW_ROLE_NAMES[e.member.homeRole],
            to: CREW_ROLE_NAMES[e.to as CrewRole],
            state: e.type === 'swap-start' ? 'start' : 'done',
          });
      }
    }
    const ctx: AIContext = { player: this.player, time: this.time, lineOfSight: (a, b) => this.lineOfSight(a, b), rng: this.rng };
    for (const [v, c] of this.controllers) {
      if (v.isDead) continue;
      const base = c.update(v);
      const gunner = this.gunners.get(v);
      v.controls = gunner ? gunner.update(v, ctx, base) : base;
    }
    // 脚下的地表决定滚动阻力和抓地
    for (const v of this.vehicles) {
      const p = v.physicsPosition();
      v.surface = SURFACES[this.map.surfaceAt(p.x, p.z)];
    }
    this.player.controls = this.player.isDead
      ? idleControls()
      : { ...this.playerControls, fire: this.playerControls.fire || this.fireLatch };
    this.fireLatch = false;

    for (const v of this.vehicles) {
      const req = v.fixedUpdate(dt, this.world);
      if (req) this.fire(v, req);
    }

    this.world.timestep = dt;
    this.world.step();
    for (const v of this.vehicles) v.capturePose();

    for (const p of this.projectiles) {
      const hit = p.step(dt, this.world);
      if (hit) this.handleHit(p, hit);
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (!p.alive) this.root.remove(p.mesh);
      return p.alive;
    });

    this.effects.update(dt);

    if (this.state === 'playing' && this.player.isDead) {
      this.state = 'defeat';
      this.events.push({ type: 'defeat' });
    } else if (this.state === 'playing' && this.targets.length > 0 && this.targets.every((t) => t.isDead)) {
      this.state = 'victory';
      this.events.push({ type: 'victory' });
    }
    this.time += dt;
  }

  /** 渲染前调用,alpha 为两次物理步之间的插值进度 */
  syncVisuals(alpha: number): void {
    for (const v of this.vehicles) v.syncVisual(alpha);
    for (const p of this.projectiles) p.syncVisual(alpha);
  }

  /** 取走本帧产生的事件(命中、击毁、胜利等) */
  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** 射线检测,返回命中点;exclude 用来忽略自己的车 */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, exclude?: Vehicle): THREE.Vector3 | null {
    const hit = this.world.castRay(
      new RAPIER.Ray(origin, dir),
      maxDist,
      true,
      undefined,
      undefined,
      undefined,
      exclude?.body,
    );
    return hit ? origin.clone().addScaledVector(dir, hit.timeOfImpact) : null;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
    });
    this.world.free();
  }

  /**
   * from 的炮塔顶能否看到 to:从 from 的瞄准镜位置向 to 的炮塔中心打一条射线,
   * 先碰到的是 to 自己才算看得见(地形、障碍物、其他车都会挡)。
   */
  lineOfSight(from: Vehicle, to: Vehicle): boolean {
    const a = from.muzzle().origin;
    const b = to.physicsPosition().add(new THREE.Vector3(0, to.spec.hull.height / 2 + to.spec.turret.height / 2, 0).applyQuaternion(to.physicsQuaternion()));
    const d = b.clone().sub(a);
    const dist = d.length();
    if (dist < 1) return true;
    d.divideScalar(dist);
    const hit = this.world.castRay(new RAPIER.Ray(a, d), dist, true, undefined, undefined, undefined, from.body);
    if (!hit) return true;
    return this.colliderOwners.get(hit.collider.handle)?.vehicle === to;
  }

  private spawn(id: string, s: SpawnSpec, loadout?: Loadout): Vehicle {
    const spec = this.config.vehicles[s.vehicleId];
    if (!spec) throw new Error(`地图 ${this.config.map.id} 引用了不存在的载具 ${s.vehicleId}`);
    const [x, z] = s.position;
    const y = this.map.heightAt(x, z) + spec.hull.height / 2 + 0.5;
    const v = new Vehicle(id, spec, this.world, new THREE.Vector3(x, y, z), s.heading * DEG2RAD, loadout);
    this.vehicles.push(v);
    this.root.add(v.root);
    this.colliderOwners.set(v.hullCollider.handle, { vehicle: v, part: 'hull' });
    this.colliderOwners.set(v.turretCollider.handle, { vehicle: v, part: 'turret' });
    this.colliderOwners.set(v.barrelCollider.handle, { vehicle: v, part: 'barrel' });
    return v;
  }

  private fire(shooter: Vehicle, req: FireRequest): void {
    const p = new Projectile(shooter.id, shooter.body, req.shell, req.origin, req.dir);
    this.projectiles.push(p);
    this.root.add(p.mesh);
    this.effects.muzzleFlash(req.origin);
    this.events.push({ type: 'fired', shooterId: shooter.id });
  }

  private handleHit(p: Projectile, hit: ProjectileHit): void {
    const owner = this.colliderOwners.get(hit.collider.handle);
    if (!owner || owner.vehicle.isDead) {
      this.effects.impact(hit.point, 'ground');
      this.alertNearMiss(p, hit.point);
      return;
    }
    const { vehicle, part } = owner;
    if (p.ownerId === this.player.id) this.gunners.get(vehicle)?.alert();
    const damage = vehicle.damage;
    const frames = vehicle.frames();
    const before = this.healthSnapshot(vehicle);
    const layout: HitReplay['layout'] = {
      modules: damage.modules.map((m) => ({ id: m.id, type: m.type, part: m.spec.part, center: m.spec.center, size: m.spec.size })),
      crew: damage.crew.map((c) => ({
        id: `crew:${c.index}`,
        role: c.homeRole,
        part: c.box.part,
        center: [c.box.center.x, c.box.center.y, c.box.center.z] as Vec3,
      })),
    };
    const entry = vehicle.worldToHull(hit.point);
    const dir = vehicle.worldDirToHull(hit.dir).normalize();
    const shell = p.shell;
    const kind = SHELL_TYPES[shell.type];
    const externalDamage = DAMAGE.externalHit.base + DAMAGE.externalHit.perKg * shell.mass;

    let armor: HitResolution | null = null;
    const external: HitRecord[] = [];
    let penetration: PenetrationReport | null = null;
    // 化学能弹没能钻进车内时,在车外起爆
    let blastOutside = false;

    if (part === 'barrel') {
      // 直接打中炮管:炮管受损,炮弹被挡下
      const barrel = damage.modules.find((m) => m.type === 'barrel');
      if (barrel) push(external, damage.applyDamage({ kind: 'module', module: barrel }, externalDamage, 'external', 0, this.rng));
      blastOutside = kind.externalBlast;
      this.effects.impact(hit.point, 'bounce');
    } else {
      // 车体侧面低处先打到履带:履带受损;动能弹和破甲射流被吃掉一部分穿深,高爆 / 碎甲弹直接在履带上起爆
      let penLoss = 0;
      let stopped = false;
      if (part === 'hull') {
        const track = damage.modules.find((m) => m.type === 'track' && frames.contains(m.box, entry, 0.05));
        if (track) {
          push(external, damage.applyDamage({ kind: 'module', module: track }, externalDamage, 'external', 0, this.rng));
          penLoss = MODULE_TYPES.track.absorb;
          stopped = shell.type === 'HE' || shell.type === 'HESH';
        }
      }
      const inv = vehicle.partQuaternion(part).invert();
      const localNormal = hit.normal.clone().applyQuaternion(inv);
      const localDir = hit.dir.clone().applyQuaternion(inv);
      const plates = part === 'turret' ? vehicle.spec.turretArmor : vehicle.spec.armor;
      const shellAtImpact = { ...shell, penetration: stopped ? 0 : Math.max(0, p.penetration - penLoss) };
      armor = resolveHit(shellAtImpact, plates, localDir, localNormal, this.rng);
      if (armor.penetrated) {
        penetration = simulatePenetration(damage, frames, {
          entry,
          dir,
          shell,
          remainingPen: armor.penetration - armor.effectiveArmor,
          effectiveArmor: armor.effectiveArmor,
          armorThickness: armor.armor,
          rng: makeRng(Math.floor(this.rng() * 2 ** 31)),
        });
        vehicle.flashHit();
      } else {
        blastOutside = kind.externalBlast && !armor.ricochet;
      }
      this.effects.impact(hit.point, armor.penetrated ? 'penetration' : 'bounce');
    }
    if (blastOutside && shell.explosiveMass > 0) {
      // 冲击波波及车外的履带、炮管(打中履带时履带已经吃过直接命中,这里不重复计)
      const b = DAMAGE.externalBlast;
      const radius = b.radiusK * Math.cbrt(shell.explosiveMass / 1000);
      for (const m of damage.modules) {
        if (!m.external || external.some((r) => r.id === m.id)) continue;
        const d = frames.distance(m.box, entry);
        if (d < radius) push(external, damage.applyDamage({ kind: 'module', module: m }, b.peak * (1 - d / radius), 'blast', 0, this.rng));
      }
    }

    const destroyed = damage.knockedOut;
    const replay: HitReplay = {
      spec: vehicle.spec,
      shell,
      turretYaw: vehicle.turretYaw,
      gunPitch: vehicle.gunPitch,
      part,
      entry,
      dir,
      armor,
      external,
      penetration,
      before,
      after: this.healthSnapshot(vehicle),
      layout,
      destroyed,
      detonated: damage.detonated,
    };
    this.events.push({ type: 'hit', shooterId: p.ownerId, targetId: vehicle.id, targetName: vehicle.spec.name, part, replay });
    if (destroyed) {
      this.effects.explosion(vehicle.physicsPosition());
      this.events.push({ type: 'destroyed', vehicleId: vehicle.id, name: vehicle.spec.name, cause: damage.detonated ? 'ammo' : 'crew' });
    }
  }

  /** 玩家的炮弹落在敌车附近:惊动它 */
  private alertNearMiss(p: Projectile, point: THREE.Vector3): void {
    if (p.ownerId !== this.player.id) return;
    for (const [v, g] of this.gunners) {
      if (!v.isDead && v.physicsPosition().distanceTo(point) < AI.nearMissRadius) g.alert();
    }
  }

  /** 每个模块 / 乘员当前的血量比例 */
  private healthSnapshot(v: Vehicle): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of v.damage.modules) out[m.id] = m.hp / m.maxHp;
    for (const c of v.damage.crew) out[`crew:${c.index}`] = c.alive ? c.hp / 100 : 0;
    return out;
  }
}

function push<T>(list: T[], item: T | null): void {
  if (item) list.push(item);
}
