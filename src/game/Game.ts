import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Loadout, MapSpec, ShellSpec, SpawnSpec, VehicleSpec } from '../data/types';
import { GameMap } from './Map';
import { Vehicle, idleControls, type FireRequest, type VehicleControls, type VehiclePart } from './Vehicle';
import { Projectile, type ProjectileHit } from './Projectile';
import { Effects } from './Effects';
import { resolveHit, type HitResolution } from './Damage';
import { GunnerAI, PatrolController, StaticController, type AIContext, type VehicleController } from './Controllers';
import type { DamageEvent, HitRecord } from './damage/DamageModel';
import { makeRng } from './damage/geometry';
import { simulatePenetration, type PenetrationReport } from './damage/penetration';
import { DAMAGE } from '../data/damage';
import { MODULE_TYPES, CREW_ROLE_NAMES } from '../data/modules';
import { SHELL_TYPES } from '../data/shells';
import { SURFACES } from '../data/surfaces';
import { AI_PRESETS, type AIParams, type AIPresetId } from '../data/ai';
import { Vegetation } from './Vegetation';
import { defaultLoadout, randomLoadout } from './Loadout';
import { applyCrewSkill } from './crew/progress';
import type { AttachPart, CrewRole, Vec2, Vec3 } from '../data/types';

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
  /** 命中面的外法线(车体本地坐标,单位向量,朝车外);回放里画跳弹方向和弹着标记用 */
  normal: THREE.Vector3;
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
  /** 这一发把目标打起火了(命中前没着火、命中后着火);缺省 = 没有。命中回放的文字分级用 */
  ignited?: boolean;
}

/** 弹着的种类(音效 / 特效用) */
export type ImpactType = 'ground' | 'water' | 'penetration' | 'nonpen' | 'ricochet' | 'tree' | 'bush';

export type GameEvent =
  | { type: 'fired'; shooterId: string; weapon: 'main' | 'mg'; caliber: number; origin: THREE.Vector3 }
  | {
      /** 主炮级(口径 ≥ 20 mm)炮弹命中载具:带完整回放数据 */
      type: 'hit';
      shooterId: string;
      targetId: string;
      targetName: string;
      part: VehiclePart;
      replay: HitReplay;
    }
  /** 任意弹着(包括机枪子弹):位置、种类、口径 */
  | { type: 'impact'; shooterId: string; point: THREE.Vector3; kind: ImpactType; caliber: number; targetId?: string }
  /** 炮闩 / 炮管受损,这一发击发失败(没有打出炮弹) */
  | { type: 'misfire'; vehicleId: string; part: 'breech' | 'barrel' }
  | { type: 'destroyed'; vehicleId: string; name: string; cause: 'crew' | 'ammo' | 'fire'; position: THREE.Vector3 }
  | { type: 'ammo-lost'; vehicleId: string; rack: string; rounds: number }
  | { type: 'defeat' }
  | { type: 'repair'; vehicleId: string; state: 'start' | 'cancel' | 'done'; seconds: number }
  | { type: 'crew-swap'; vehicleId: string; crew: string; to: string; state: 'start' | 'done' }
  /**
   * 起火 / 灭火。start:module 为起火模块名;extinguishing:开始灭火,seconds 为所需时间;
   * extinguished:扑灭;burnt-out:烧完自行熄灭;no-extinguisher:没有灭火器了(或没人能灭火)
   */
  | {
      type: 'fire';
      vehicleId: string;
      name: string;
      state: 'start' | 'extinguishing' | 'extinguished' | 'burnt-out' | 'no-extinguisher';
      module?: string;
      seconds?: number;
    }
  /** 火烧到弹药架引发殉爆 */
  | { type: 'cook-off'; vehicleId: string; name: string }
  /** 树被撞倒 / 打断 */
  | { type: 'tree-felled'; point: THREE.Vector3 }
  | { type: 'victory' };

export interface GameConfig {
  map: MapSpec;
  vehicles: Readonly<Record<string, VehicleSpec>>;
  /** 随机种子(跳弹、殉爆、车内破片、起火、敌方携弹与瞄准);缺省随机 */
  seed?: number;
  /** 玩家载具(缺省用地图出生点里写的) */
  playerVehicleId?: string;
  /**
   * 玩家载具的数据覆盖(套了改装 / 涂装的版本;id 要和 playerVehicleId 一致)。
   * 只影响玩家这一辆,地图上同型号的靶车 / 敌车仍用 vehicles 里的原始数据。
   */
  playerSpec?: VehicleSpec;
  /** 玩家车组技能 ∈ [0, 1](= 车组成长进度 × 熟练度);缺省 0 = 新手数值(和现在一样) */
  playerCrewSkill?: number;
  /** 玩家携弹方案;缺省见 defaultLoadout */
  playerLoadout?: Loadout;
  /** 敌方是否还击(缺省 true;各出生点还可以单独关) */
  enemyAi?: boolean;
  /** 试驾:靶车全部被击毁也不判胜利,对局不会自己结束(配合 enemyAi: false 用) */
  practice?: boolean;
  /** 敌方 AI 强度预设(缺省 'training') */
  aiPreset?: AIPresetId;
  /** 植被:密度 0..1、草丛渲染半径 m;false = 完全不要植被(测试提速)。缺省 { density: 1, grassDistance: 100 } */
  vegetation?: { density: number; grassDistance: number } | false;
  /** 是否生成只用于显示的网格(植被等);测试里可以关掉。缺省 true */
  render?: boolean;
}

/** 玩家开主炮后这么多秒内,敌方 AI 的视线不受植被遮挡(炮口焰和扬尘暴露了位置),秒 */
export const REVEAL_AFTER_SHOT = 6;
/** 残骸冒烟多久,秒 */
const WRECK_SMOKE_TIME = 90;

/**
 * 一局游戏的全部状态:物理世界、地图、植被、载具、抛射体、特效。
 * 不碰 DOM / 渲染器,可以在测试里直接跑 fixedUpdate。
 */
export class Game {
  readonly world: RAPIER.World;
  readonly root = new THREE.Group();
  readonly map: GameMap;
  readonly vegetation: Vegetation | null;
  readonly player: Vehicle;
  readonly targets: Vehicle[] = [];
  readonly vehicles: Vehicle[] = [];
  readonly effects = new Effects();
  readonly aiParams: AIParams;
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
  /** 敌方 AI 计划在什么时候灭火 */
  private readonly aiExtinguishAt = new Map<Vehicle, number>();
  /** 已经报过「被摧毁」的车,以及摧毁时刻 */
  private readonly deadAt = new Map<Vehicle, number>();
  /** 玩家最近一次开主炮的时间 */
  private lastPlayerShot = -Infinity;
  private mgShotCount = 0;

  constructor(private readonly config: GameConfig) {
    this.rng = makeRng(config.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.map = new GameMap(config.map, this.world);
    this.aiParams = AI_PRESETS[config.aiPreset ?? 'training'].params;
    this.root.name = 'game';
    this.root.add(this.map.root, this.effects.root);

    const { player, targets } = config.map.spawns;
    const playerSpawn: SpawnSpec = { ...player, vehicleId: config.playerVehicleId ?? player.vehicleId };

    // 植被先生成(树干碰撞体进入物理世界),出生点和巡逻路线周围留空
    const veg = config.vegetation === undefined ? { density: 1, grassDistance: 100 } : config.vegetation;
    if (config.map.vegetation && veg !== false) {
      const clearPoints: Vec2[] = [player.position, ...targets.map((t) => t.position)];
      for (const t of targets) if (t.patrol) clearPoints.push(...patrolPoints(t.position, t.patrol.to));
      this.vegetation = new Vegetation(this.map, config.map.vegetation, this.world, {
        density: veg.density,
        grassDistance: veg.grassDistance,
        clearPoints,
        render: config.render !== false,
      });
      this.root.add(this.vegetation.root);
    } else {
      this.vegetation = null;
    }

    const playerSpec = config.vehicles[playerSpawn.vehicleId];
    this.player = this.spawn('player', playerSpawn, config.playerLoadout ?? (playerSpec ? defaultLoadout(playerSpec) : undefined));
    targets.forEach((s, i) => {
      const spec = config.vehicles[s.vehicleId];
      const v = this.spawn(`target-${i + 1}`, s, spec ? randomLoadout(spec, this.rng, s.ammoFraction) : undefined);
      this.targets.push(v);
      this.controllers.set(
        v,
        s.patrol ? new PatrolController(s.position, s.patrol.to, s.patrol.speed) : new StaticController(),
      );
      if (config.enemyAi !== false && s.ai !== false && (spec?.weapons[0]?.ammo.length ?? 0) > 0) {
        this.gunners.set(v, new GunnerAI(this.aiParams));
      }
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

  /** 切到下一种还有弹的弹种 */
  nextShell(): void {
    const ammo = this.player.primaryWeapon?.ammo ?? [];
    for (let k = 1; k <= ammo.length; k++) {
      const i = (this.player.selectedShell + k) % ammo.length;
      if (this.player.damage.rounds(ammo[i].id) > 0 || this.player.loaded?.shell.id === ammo[i].id) {
        this.player.selectShell(i);
        return;
      }
    }
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

  /** 玩家按下灭火键 */
  extinguish(): void {
    this.tryExtinguish(this.player);
  }

  fixedUpdate(dt: number): void {
    // 1. 模块 / 乘员状态:换位、维修、燃烧
    for (const v of this.vehicles) {
      if (v.isDead) continue;
      for (const e of v.damage.update(dt, this.rng)) this.onDamageEvent(v, e);
      const at = this.aiExtinguishAt.get(v);
      if (at !== undefined && this.time >= at) {
        this.aiExtinguishAt.delete(v);
        this.tryExtinguish(v);
      }
    }
    this.checkDeaths('fire');

    // 2. AI 与玩家控制
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

    // 3. 载具:驾驶、炮塔、装填、开火
    for (const v of this.vehicles) {
      for (const req of v.fixedUpdate(dt, this.world)) this.fire(v, req);
    }

    // 4. 车辆压灌木、撞树、压草;倒下的树在物理步之前去掉碰撞体
    if (this.vegetation) {
      for (const v of this.vehicles) {
        const pushing = !v.isDead && v.damage.canDrive ? Math.sign(v.controls.throttle) : 0;
        const felled = this.vegetation.interactVehicle({
          position: v.physicsPosition(),
          quaternion: v.physicsQuaternion(),
          length: v.spec.hull.length,
          width: v.spec.hull.width,
          mass: v.body.mass(),
          forwardSpeed: v.forwardSpeed,
          pushing,
        });
        for (const t of felled) this.events.push({ type: 'tree-felled', point: new THREE.Vector3(t.x, t.y, t.z) });
      }
      this.vegetation.flush();
    }

    this.world.timestep = dt;
    this.world.step();
    for (const v of this.vehicles) v.capturePose();

    // 5. 抛射体
    const from = new THREE.Vector3();
    for (const p of this.projectiles) {
      from.copy(p.position);
      const hit = p.step(dt, this.world);
      if (this.vegetation) this.throughBushes(p, from, p.position);
      if (hit) this.handleHit(p, hit);
    }
    this.vegetation?.flush();
    this.projectiles = this.projectiles.filter((p) => {
      if (!p.alive) this.root.remove(p.mesh);
      return p.alive;
    });

    this.checkDeaths('crew');
    this.updateEmitters();
    this.effects.update(dt);

    if (this.state === 'playing' && this.player.isDead) {
      this.state = 'defeat';
      this.events.push({ type: 'defeat' });
    } else if (this.state === 'playing' && !this.config.practice && this.targets.length > 0 && this.targets.every((t) => t.isDead)) {
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

  /** 每个渲染帧调用:倒树动画、草丛按镜头位置加载 / 恢复 */
  updateVisuals(dt: number, cameraPosition: THREE.Vector3): void {
    this.vegetation?.update(dt, cameraPosition);
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
    this.vegetation?.dispose();
    this.effects.dispose();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
        if (o instanceof THREE.InstancedMesh) o.dispose();
      }
    });
    this.world.free();
  }

  /**
   * from 的炮塔顶能否看到 to:从 from 的瞄准镜位置向 to 的炮塔中心打一条射线,
   * 先碰到的是 to 自己才算看得见(地形、障碍物、树干、其他车都会挡);
   * 再看中间有没有完好的灌木 / 树冠挡着。玩家刚开过炮时暴露位置,植被挡不住敌方的视线。
   */
  lineOfSight(from: Vehicle, to: Vehicle): boolean {
    const a = from.muzzle().origin;
    const b = to.physicsPosition().add(new THREE.Vector3(0, to.spec.hull.height / 2 + to.spec.turret.height / 2, to.spec.turret.offset ?? 0).applyQuaternion(to.physicsQuaternion()));
    const d = b.clone().sub(a);
    const dist = d.length();
    if (dist < 1) return true;
    d.divideScalar(dist);
    const hit = this.world.castRay(new RAPIER.Ray(a, d), dist, true, undefined, undefined, undefined, from.body);
    if (hit && this.colliderOwners.get(hit.collider.handle)?.vehicle !== to) return false;
    if (!this.vegetation) return true;
    const revealed = to === this.player && this.time - this.lastPlayerShot < REVEAL_AFTER_SHOT;
    return revealed || !this.vegetation.blocksSight(a, b);
  }

  private spawn(id: string, s: SpawnSpec, loadout?: Loadout): Vehicle {
    let spec = this.config.vehicles[s.vehicleId];
    if (!spec) throw new Error(`地图 ${this.config.map.id} 引用了不存在的载具 ${s.vehicleId}`);
    if (id === 'player') {
      if (this.config.playerSpec?.id === spec.id) spec = this.config.playerSpec;
      spec = applyCrewSkill(spec, spec.crewAce, this.config.playerCrewSkill ?? 0);
    }
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
    const mg = p.isBullet;
    // 机枪每隔几发才画一次炮口焰,省特效
    if (!mg) this.effects.muzzleFlash(req.origin);
    else if (this.mgShotCount++ % 3 === 0) this.effects.muzzleFlash(req.origin, 0.35);
    if (shooter === this.player && !mg) this.lastPlayerShot = this.time;
    this.events.push({ type: 'fired', shooterId: shooter.id, weapon: mg ? 'mg' : 'main', caliber: req.shell.caliber, origin: req.origin.clone() });
  }

  /** 把 DamageModel 的事件翻译成对局事件;敌方起火后安排灭火 */
  private onDamageEvent(v: Vehicle, e: DamageEvent): void {
    switch (e.type) {
      case 'repaired':
        this.events.push({ type: 'repair', vehicleId: v.id, state: 'done', seconds: 0 });
        break;
      case 'ammo-lost':
        this.events.push({ type: 'ammo-lost', vehicleId: v.id, rack: e.rack, rounds: e.rounds });
        break;
      case 'swap-start':
      case 'swap-done':
        this.events.push({
          type: 'crew-swap',
          vehicleId: v.id,
          crew: CREW_ROLE_NAMES[e.member.homeRole],
          to: CREW_ROLE_NAMES[e.to],
          state: e.type === 'swap-start' ? 'start' : 'done',
        });
        break;
      case 'fire-start': {
        const module = v.damage.module(e.module)?.name ?? e.module;
        this.events.push({ type: 'fire', vehicleId: v.id, name: v.spec.name, state: 'start', module });
        if (v !== this.player) {
          const [lo, hi] = DAMAGE.fire.aiReaction;
          this.aiExtinguishAt.set(v, this.time + lo + (hi - lo) * this.rng());
        }
        break;
      }
      case 'fire-out':
        this.aiExtinguishAt.delete(v);
        this.events.push({ type: 'fire', vehicleId: v.id, name: v.spec.name, state: e.reason });
        break;
      case 'cook-off':
        this.events.push({ type: 'cook-off', vehicleId: v.id, name: v.spec.name });
        break;
    }
  }

  private tryExtinguish(v: Vehicle): void {
    const d = v.damage;
    if (!d.fire || d.fire.extinguishing !== null || v.isDead) return;
    if (d.extinguish()) {
      this.events.push({ type: 'fire', vehicleId: v.id, name: v.spec.name, state: 'extinguishing', seconds: DAMAGE.fire.extinguishTime });
    } else {
      this.events.push({ type: 'fire', vehicleId: v.id, name: v.spec.name, state: 'no-extinguisher' });
    }
  }

  /** 新被摧毁的车:报一次「被摧毁」,放爆炸特效。hint = 这次检查之前刚发生了什么(燃烧 / 命中) */
  private checkDeaths(hint: 'fire' | 'crew'): void {
    for (const v of this.vehicles) {
      if (!v.isDead || this.deadAt.has(v)) continue;
      this.deadAt.set(v, this.time);
      this.aiExtinguishAt.delete(v);
      const cause = v.damage.detonated ? 'ammo' : hint;
      const position = v.physicsPosition();
      this.effects.explosion(position);
      this.events.push({ type: 'destroyed', vehicleId: v.id, name: v.spec.name, cause, position });
    }
  }

  /** 起火的车冒火冒烟(火在起火模块的位置),残骸冒一阵细烟 */
  private updateEmitters(): void {
    for (const v of this.vehicles) {
      const fire = v.damage.fire;
      if (fire && !v.isDead) {
        const m = v.damage.module(fire.source);
        const local = m ? v.frames().pointToHull(m.box.part, m.box.center) : new THREE.Vector3();
        local.y = v.spec.hull.height / 2; // 火苗从车顶冒出来
        this.effects.setEmitter(v.id, local.applyQuaternion(v.physicsQuaternion()).add(v.physicsPosition()), 'fire');
      } else if (v.isDead && this.time - (this.deadAt.get(v) ?? this.time) < WRECK_SMOKE_TIME) {
        const top = new THREE.Vector3(0, v.spec.hull.height / 2, v.spec.hull.length * 0.25);
        this.effects.setEmitter(v.id, top.applyQuaternion(v.physicsQuaternion()).add(v.physicsPosition()), 'smoke');
      }
    }
  }

  /** 这一步弹道穿过的灌木:主炮炮弹打碎,子弹一发一发地削 */
  private throughBushes(p: Projectile, a: THREE.Vector3, b: THREE.Vector3): void {
    for (const bush of this.vegetation!.bushesOnSegment(a, b)) {
      const destroyed = this.vegetation!.hitBush(bush, p.shell.caliber);
      const point = new THREE.Vector3(bush.x, bush.y + bush.crownY, bush.z);
      if (destroyed || !p.isBullet) this.effects.impact(point, 'leaves');
      this.events.push({ type: 'impact', shooterId: p.ownerId, point, kind: 'bush', caliber: p.shell.caliber });
    }
  }

  private handleHit(p: Projectile, hit: ProjectileHit): void {
    const tree = this.vegetation?.treeByCollider(hit.collider.handle);
    if (tree) {
      this.hitTree(p, hit, tree);
      return;
    }
    const owner = this.colliderOwners.get(hit.collider.handle);
    if (!owner || owner.vehicle.isDead) {
      const water = this.map.spec.waterLevel !== undefined && hit.point.y < this.map.spec.waterLevel + 0.05;
      if (p.isBullet) this.effects.impact(hit.point, water ? 'splash' : 'dust');
      else this.effects.impact(hit.point, 'ground');
      this.events.push({ type: 'impact', shooterId: p.ownerId, point: hit.point.clone(), kind: water ? 'water' : 'ground', caliber: p.shell.caliber });
      this.alertNearMiss(p, hit.point);
      return;
    }
    if (p.isBullet) {
      this.bulletHit(p, hit, owner.vehicle, owner.part);
      return;
    }
    const { vehicle, part } = owner;
    if (p.ownerId === this.player.id) this.gunners.get(vehicle)?.alert();
    const damage = vehicle.damage;
    const wasFire = damage.fire !== null;
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
      // 车体正面按命中点高度分首上 / 首下(碰撞盒以车体原点为中心,底面在 -height / 2)
      armor = part === 'hull'
        ? resolveHit(shellAtImpact, plates, localDir, localNormal, this.rng, entry.y, -vehicle.spec.hull.height / 2)
        : resolveHit(shellAtImpact, plates, localDir, localNormal, this.rng);
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

    const replay: HitReplay = {
      spec: vehicle.spec,
      shell,
      turretYaw: vehicle.turretYaw,
      gunPitch: vehicle.gunPitch,
      part,
      entry,
      dir,
      normal: vehicle.worldDirToHull(hit.normal).normalize(),
      armor,
      external,
      penetration,
      before,
      after: this.healthSnapshot(vehicle),
      layout,
      destroyed: damage.knockedOut,
      detonated: damage.detonated,
      ignited: !wasFire && damage.fire !== null,
    };
    const impactKind: ImpactType = !armor ? 'nonpen' : armor.penetrated ? 'penetration' : armor.ricochet ? 'ricochet' : 'nonpen';
    this.events.push({ type: 'impact', shooterId: p.ownerId, point: hit.point.clone(), kind: impactKind, caliber: shell.caliber, targetId: vehicle.id });
    this.events.push({ type: 'hit', shooterId: p.ownerId, targetId: vehicle.id, targetName: vehicle.spec.name, part, replay });
    // 被摧毁的事件和爆炸特效统一由 checkDeaths 在这一步末尾发出
  }

  /**
   * 枪弹打在车上:只做装甲判定(决定跳弹还是嵌在装甲上),不伤外挂模块、不进车内、不出回放。
   * 这几辆坦克最薄的装甲也有 15 mm 以上,7.62 / 7.92 mm 普通枪弹(穿深约 10–12 mm)打不穿;
   * 就算极端角度下判定为击穿,也按没有伤害处理——枪弹打不坏坦克,是本游戏的设计约定。
   */
  private bulletHit(p: Projectile, hit: ProjectileHit, vehicle: Vehicle, part: VehiclePart): void {
    if (p.ownerId === this.player.id) this.gunners.get(vehicle)?.alert();
    let kind: ImpactType = 'nonpen';
    if (part !== 'barrel') {
      const inv = vehicle.partQuaternion(part).invert();
      const plates = part === 'turret' ? vehicle.spec.turretArmor : vehicle.spec.armor;
      const armor = resolveHit({ ...p.shell, penetration: p.penetration }, plates, hit.dir.clone().applyQuaternion(inv), hit.normal.clone().applyQuaternion(inv), this.rng);
      if (armor.ricochet) kind = 'ricochet';
    }
    this.effects.impact(hit.point, 'spark');
    this.events.push({ type: 'impact', shooterId: p.ownerId, point: hit.point.clone(), kind, caliber: p.shell.caliber, targetId: vehicle.id });
  }

  /** 打中树干:主炮动能弹打断树继续飞,化学能弹在树上起爆,枪弹被挡下 */
  private hitTree(p: Projectile, hit: ProjectileHit, tree: NonNullable<ReturnType<Vegetation['treeByCollider']>>): void {
    const chemical = SHELL_TYPES[p.shell.type].family === 'chemical';
    const r = this.vegetation!.hitTree(tree, hit.dir.x, hit.dir.z, p.shell.caliber, chemical);
    this.events.push({ type: 'impact', shooterId: p.ownerId, point: hit.point.clone(), kind: 'tree', caliber: p.shell.caliber });
    if (r.felled) this.events.push({ type: 'tree-felled', point: new THREE.Vector3(tree.x, tree.y, tree.z) });
    if (r.stopped) {
      this.effects.impact(hit.point, p.isBullet ? 'dust' : 'ground');
      this.alertNearMiss(p, hit.point);
      return;
    }
    // 穿过树干(或已经倒下、碰撞体还没移除的树):从树干另一侧继续飞,损失一点速度
    p.passThrough(tree.radius * 2 + 0.1, r.felled ? 0.92 : 1);
    if (r.felled) this.effects.impact(hit.point, 'leaves');
  }

  /** 玩家的炮弹 / 子弹落在敌车附近:惊动它 */
  private alertNearMiss(p: Projectile, point: THREE.Vector3): void {
    if (p.ownerId !== this.player.id) return;
    for (const [v, g] of this.gunners) {
      if (!v.isDead && v.physicsPosition().distanceTo(point) < this.aiParams.nearMissRadius) g.alert();
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

/** 巡逻路线上每隔 20 m 取一个点(植被在这些点周围留空) */
function patrolPoints(a: Vec2, b: Vec2): Vec2[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / 20));
  return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as Vec2);
}
