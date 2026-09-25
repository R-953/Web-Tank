import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { TIGER_I, T34_85, VEHICLES } from '../src/data/vehicles';
import { SHELL_TYPES, dragK, hePenetration } from '../src/data/shells';
import { DAMAGE } from '../src/data/damage';
import { CREW, MODULE_TYPES } from '../src/data/modules';
import type { ShellSpec } from '../src/data/types';
import { effectiveArmor, resolveHit, ricochetChance, shellPenetration } from '../src/game/Damage';
import { DamageModel } from '../src/game/damage/DamageModel';
import { VehicleFrames, makeRng } from '../src/game/damage/geometry';
import { simulatePenetration } from '../src/game/damage/penetration';
import { Vehicle } from '../src/game/Vehicle';
import { ammoCapacity, clampLoadout, defaultLoadout, loadoutTotal, randomLoadout } from '../src/game/Loadout';
import { flyShell } from './sim';

const DEG = Math.PI / 180;
const shellOf = (vehicleId: string, id: string): ShellSpec => VEHICLES[vehicleId].weapons[0].ammo.find((a) => a.id === id)!;
const crewOf = (m: DamageModel, role: string) => m.crew.find((c) => c.homeRole === role)!;
const tick = (m: DamageModel, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) m.update(1 / 60);
};

beforeAll(async () => {
  await RAPIER.init();
});

describe('弹种通用规则:入射角、跳弹、穿深', () => {
  const front = { x: 0, y: 0, z: -1 };
  const at = (deg: number) => ({ x: Math.sin(deg * DEG), y: 0, z: Math.cos(deg * DEG) });

  it('硬芯弹斜面惩罚更重:30° 时等效厚度 t / cos^1.5,被帽弹是 t / cos', () => {
    expect(effectiveArmor(100, 30, SHELL_TYPES.APCR)).toBeCloseTo(100 / Math.pow(Math.cos(30 * DEG), 1.5), 6);
    expect(effectiveArmor(100, 30, SHELL_TYPES['APCBC-HE'])).toBeCloseTo(100 / Math.cos(30 * DEG), 6);
    // 钝头弹有 4° 转正
    expect(effectiveArmor(100, 30, SHELL_TYPES.APHEBC)).toBeCloseTo(100 / Math.cos(26 * DEG), 6);
  });

  it('碎甲弹不计入射角:60° 斜面上 90mm 穿深照样打穿 80mm;被帽弹要面对 160mm', () => {
    expect(resolveHit({ type: 'HESH', penetration: 90 }, { front: 80, side: 80, rear: 80 }, at(55), front).penetrated).toBe(true);
    const ap = resolveHit({ type: 'APCBC', penetration: 90 }, { front: 80, side: 80, rear: 80 }, at(55), front);
    expect(ap.penetrated).toBe(false);
  });

  it('跳弹概率在三个角度之间线性变化;高入射角必跳', () => {
    const capped = SHELL_TYPES.APCBC.ricochet;
    expect(ricochetChance(40, capped)).toBe(0);
    expect(ricochetChance(63, capped)).toBeCloseTo(0.5, 6);
    expect(ricochetChance(80, capped)).toBe(1);
    // 同样 65°:硬芯弹还不会跳,被帽弹大概率跳
    expect(ricochetChance(65, SHELL_TYPES.APCR.ricochet)).toBe(0);
    expect(ricochetChance(65, capped)).toBeGreaterThan(0.5);
    const r = resolveHit({ type: 'APCBC', penetration: 500 }, { front: 20, side: 20, rear: 20 }, at(75), front);
    expect(r.ricochet).toBe(true);
    expect(r.penetrated).toBe(false);
  });

  it('化学能弹穿深与弹速无关;动能弹随弹速下降', () => {
    const heat = shellOf('tiger_i', 'gr39hl');
    const ap = shellOf('tiger_i', 'pzgr39');
    expect(shellPenetration(heat, 300)).toBe(heat.penetration);
    expect(shellPenetration(ap, ap.muzzleVelocity * 0.8)).toBeLessThan(ap.penetration);
    const [near, far] = flyShell(heat, [100, 1500]);
    expect(far.penetration).toBe(near.penetration);
  });

  it('高爆弹穿深按装药量查表(War Thunder 公开表),单调递增', () => {
    expect(hePenetration(0.1)).toBe(4);
    expect(hePenetration(2)).toBe(25);
    expect(hePenetration(0.86)).toBeCloseTo(5 + (20 * 0.66) / 1.8, 6);
    let last = 0;
    for (let kg = 0.05; kg < 12; kg += 0.25) {
      expect(hePenetration(kg)).toBeGreaterThanOrEqual(last);
      last = hePenetration(kg);
    }
  });

  it('阻力由弹重、口径、阻力系数算出:同口径的硬芯弹比被帽弹掉速快,远距离穿深衰减更多', () => {
    const apcr = shellOf('tiger_i', 'pzgr40');
    const apcbc = shellOf('tiger_i', 'pzgr39');
    expect(dragK(apcr)).toBeGreaterThan(dragK(apcbc));
    const [a100, a2000] = flyShell(apcr, [100, 2000]);
    const [b100, b2000] = flyShell(apcbc, [100, 2000]);
    expect(a2000.penetration / a100.penetration).toBeLessThan(b2000.penetration / b100.penetration);
  });
});

describe('击穿后效:各弹种的差异', () => {
  const turretSide = (spec: typeof TIGER_I, up: number, z: number) => ({
    entry: new THREE.Vector3(-spec.turret.width / 2, spec.hull.height / 2 + up, z),
    dir: new THREE.Vector3(1, 0, 0),
  });
  const run = (shell: ShellSpec, seed: number, armor = 75) => {
    const m = new DamageModel(T34_85, {});
    const r = simulatePenetration(m, new VehicleFrames(T34_85, 0, 0), {
      ...turretSide(T34_85, 0.3, -0.2),
      shell,
      remainingPen: 60,
      effectiveArmor: armor,
      armorThickness: armor,
      rng: makeRng(seed),
    });
    return { m, r };
  };

  it('破甲弹:金属射流只钻进车内一小段(≤ 2.5 m),没有车内爆炸', () => {
    const { r } = run(shellOf('tiger_i', 'gr39hl'), 1);
    const jet = r.segments.find((s) => s.kind === 'shell')!;
    expect(jet.from.distanceTo(jet.to)).toBeLessThanOrEqual(SHELL_TYPES.HEAT.bodyRange + 1e-6);
    expect(r.explosion).toBeNull();
  });

  it('高爆弹击穿薄装甲:在装甲内侧立即起爆', () => {
    const he = shellOf('tiger_i', 'sprgr');
    const { r } = run(he, 2, 10);
    expect(r.explosion).not.toBeNull();
    expect(r.explosion!.center.distanceTo(r.entry)).toBeLessThan(0.2);
    expect(r.segments.some((s) => s.kind === 'shell')).toBe(false);
  });

  it('碎甲弹:没有弹体进入,崩落破片是被帽弹的两倍、锥角更宽', () => {
    const hesh: ShellSpec = { ...shellOf('tiger_i', 'sprgr'), id: 'hesh', type: 'HESH', penetration: 120 };
    const { r } = run(hesh, 3);
    const { r: ap } = run(shellOf('tiger_i', 'pzgr39'), 3);
    const count = (x: typeof r) => x.segments.filter((s) => s.kind === 'spall').length;
    expect(r.segments.some((s) => s.kind === 'shell')).toBe(false);
    expect(count(r)).toBe(2 * count(ap));
  });

  it('硬芯弹击穿后杀伤明显弱于带装药的穿甲弹(20 个随机种子统计)', () => {
    const kills = (shell: ShellSpec) => {
      let n = 0;
      for (let seed = 1; seed <= 20; seed++) n += run(shell, seed).r.hits.filter((h) => h.kind === 'crew' && h.destroyed).length;
      return n;
    };
    expect(kills(shellOf('tiger_i', 'pzgr40'))).toBeLessThan(kills(shellOf('tiger_i', 'pzgr39')));
  });
});

describe('弹药架:容量、取弹顺序、按余量殉爆', () => {
  it('缺省装满默认弹种,总数等于容量', () => {
    const m = new DamageModel(TIGER_I);
    expect(m.ammoCapacity).toBe(92);
    expect(m.rounds()).toBe(92);
    expect(m.rounds('pzgr39')).toBe(92);
  });

  it('少带弹时,最先取空的弹药架空着(虎式带 28 发:四个侧裙弹箱全空)', () => {
    const m = new DamageModel(TIGER_I, { pzgr39: 28 });
    for (const r of m.racks) {
      const n = m.rackRounds(r);
      if (r.module.id.startsWith('ammo_sponson')) expect(n).toBe(0);
      else expect(n).toBe(r.capacity);
    }
    // 空弹药架不在车内目标里
    expect(m.internalTargets().some((t) => t.kind === 'module' && t.module.id.startsWith('ammo_sponson'))).toBe(false);
  });

  it('取弹从取弹顺序最靠前、有这种弹的弹药架取;换弹时退回原架', () => {
    const m = new DamageModel(TIGER_I, { pzgr39: 10, sprgr: 10 });
    // 20 发都在车底弹药架(最后才取空的那个),先放的 10 发 Pzgr.39
    expect(m.rounds()).toBe(20);
    const rack = m.takeRound('sprgr');
    expect(rack).toBe('ammo_floor');
    expect(m.rounds('sprgr')).toBe(9);
    m.returnRound('sprgr', rack);
    expect(m.rounds('sprgr')).toBe(10);
    expect(m.takeRound('pzgr40')).toBeNull();
  });

  it('殉爆概率 = 0.9 × 剩余弹数 / 容量;没炸的弹药报废并报出事件', () => {
    const trials = 2000;
    let booms = 0;
    const rng = makeRng(9);
    for (let i = 0; i < trials; i++) {
      // 虎式带 32 发:车底 22 + 前部 6 + 右后侧裙 4(容量 16)
      const m = new DamageModel(TIGER_I, { pzgr39: 32 });
      const rack = m.module('ammo_sponson_rr')!;
      m.applyDamage({ kind: 'module', module: rack }, 999, 'fragment', 0, rng);
      if (m.detonated) booms++;
    }
    expect(booms / trials).toBeCloseTo(DAMAGE.ammo.detonationChance * (4 / 16), 1);

    const m = new DamageModel(TIGER_I, { pzgr39: 32 });
    m.applyDamage({ kind: 'module', module: m.module('ammo_sponson_rr')! }, 999, 'fragment', 0, () => 0.99);
    expect(m.detonated).toBe(false);
    expect(m.rounds()).toBe(28);
    expect(m.update(1 / 60).filter((e) => e.type === 'ammo-lost')).toEqual([{ type: 'ammo-lost', rack: 'ammo_sponson_rr', rounds: 4 }]);
  });

  it('携弹方案工具:缺省约 2/3 容量;随机方案在 30%–100% 之间;超出容量会被截断', () => {
    const cap = ammoCapacity(TIGER_I);
    expect(loadoutTotal(defaultLoadout(TIGER_I))).toBe(Math.round(cap * 0.65));
    const rng = makeRng(5);
    for (let i = 0; i < 50; i++) {
      const n = loadoutTotal(randomLoadout(T34_85, rng));
      expect(n).toBeGreaterThanOrEqual(Math.round(ammoCapacity(T34_85) * 0.3));
      expect(n).toBeLessThanOrEqual(ammoCapacity(T34_85));
    }
    const clamped = clampLoadout(TIGER_I, { pzgr39: 80, pzgr40: 30, bogus: 5 });
    expect(clamped).toEqual({ pzgr39: 80, pzgr40: 12, gr39hl: 0, sprgr: 0 });
  });
});

describe('乘员受伤降低工作效率(与模块相同的比例公式)', () => {
  const hurt = (m: DamageModel, role: string, hp: number) =>
    m.applyDamage({ kind: 'crew', member: crewOf(m, role) }, CREW.hp - hp, 'spall', 0);

  it('装填手 40% → 装填速度 40%;装填手阵亡后由炮手兼任,再乘炮手效率的一半', () => {
    const m = new DamageModel(TIGER_I);
    hurt(m, 'loader', 40);
    expect(m.reloadRate).toBeCloseTo(0.4, 6);
    const m2 = new DamageModel(TIGER_I);
    for (const role of ['loader', 'radio', 'commander']) m2.applyDamage({ kind: 'crew', member: crewOf(m2, role) }, 999, 'spall', 0);
    hurt(m2, 'gunner', 60);
    expect(m2.reloadRate).toBeCloseTo(0.5 * 0.6, 6);
  });

  it('炮手 50% → 方向机、高低机速度减半;驾驶员 30% → 功率只剩 30%', () => {
    const m = new DamageModel(TIGER_I);
    hurt(m, 'gunner', 50);
    hurt(m, 'driver', 30);
    expect(m.traverseFactor).toBeCloseTo(0.5, 6);
    expect(m.elevationFactor).toBeCloseTo(0.5, 6);
    expect(m.mobilityFactor).toBeCloseTo(0.3, 6);
  });

  it('维修速度 = 存活乘员平均效率;车长阵亡后换位慢一倍', () => {
    const m = new DamageModel(TIGER_I);
    m.applyDamage({ kind: 'module', module: m.module('track_l')! }, 999, 'external', 0);
    for (const role of ['driver', 'radio', 'gunner', 'commander', 'loader']) hurt(m, role, 50);
    expect(m.repairRate).toBeCloseTo(0.5, 6);
    m.startRepair();
    tick(m, MODULE_TYPES.track.repairTime! + 1);
    expect(m.module('track_l')!.hp).toBe(0); // 只修了一半
    tick(m, MODULE_TYPES.track.repairTime!);
    expect(m.module('track_l')!.hp).toBe(m.module('track_l')!.maxHp);

    const m2 = new DamageModel(TIGER_I);
    m2.applyDamage({ kind: 'crew', member: crewOf(m2, 'commander') }, 999, 'spall', 0);
    m2.applyDamage({ kind: 'crew', member: crewOf(m2, 'gunner') }, 999, 'spall', 0);
    expect(m2.swapRate).toBe(0.5);
    tick(m2, CREW.swapTime + 0.5);
    expect(m2.canFire).toBe(false);
    tick(m2, CREW.swapTime);
    expect(m2.canFire).toBe(true);
  });
});

describe('装填与换弹(整车)', () => {
  function spawn(loadout: Record<string, number>) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(100, 1, 100).setTranslation(0, -1, 0));
    const v = new Vehicle('v', TIGER_I, world, new THREE.Vector3(0, 2, 0), 0, loadout);
    const step = (seconds: number, fire = false) => {
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        v.controls = { ...v.controls, fire };
        const req = v.fixedUpdate(1 / 60, world);
        world.step();
        v.capturePose();
        if (req) return req;
      }
      return null;
    };
    return { v, step };
  }

  it('出发时膛里已有一发默认弹;按数字键换弹:退回弹药架,重新装填后装的是新弹种', () => {
    const { v, step } = spawn({ pzgr39: 10, sprgr: 5 });
    expect(v.loaded?.shell.id).toBe('pzgr39');
    expect(v.damage.rounds('pzgr39')).toBe(9);
    v.selectShell(3);
    expect(v.loaded).toBeNull();
    expect(v.damage.rounds('pzgr39')).toBe(10);
    step(TIGER_I.weapons[0].reloadTime + 0.1);
    expect(v.loaded?.shell.id).toBe('sprgr');
    expect(v.damage.rounds('sprgr')).toBe(4);
    const req = step(0.1, true);
    expect(req?.shell.id).toBe('sprgr');
  });

  it('打光了就不能再开火', () => {
    const { v, step } = spawn({ pzgr39: 1 });
    expect(step(0.1, true)).not.toBeNull();
    expect(step(TIGER_I.weapons[0].reloadTime + 1, true)).toBeNull();
    expect(v.loaded).toBeNull();
  });
});
