import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VEHICLES, TIGER_I, T34_85 } from '../src/data/vehicles';
import { CREW, MODULE_TYPES } from '../src/data/modules';
import { DamageModel } from '../src/game/damage/DamageModel';
import { VehicleFrames, makeRng, rayBox } from '../src/game/damage/geometry';
import { simulatePenetration } from '../src/game/damage/penetration';

const crewOf = (m: DamageModel, role: string) => m.crew.find((c) => c.homeRole === role)!;
const moduleTarget = (m: DamageModel, id: string) => ({ kind: 'module' as const, module: m.module(id)! });
const crewTarget = (m: DamageModel, role: string) => ({ kind: 'crew' as const, member: crewOf(m, role) });
const tick = (m: DamageModel, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) m.update(1 / 60);
};

describe('几何', () => {
  it('射线与盒求交:进出点正确,打偏返回 null', () => {
    const hit = rayBox(new THREE.Vector3(-5, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
    expect(hit!.tEnter).toBeCloseTo(4, 6);
    expect(hit!.tExit).toBeCloseTo(6, 6);
    expect(rayBox(new THREE.Vector3(-5, 3, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1))).toBeNull();
  });

  it('车内空间 = 车体 ∪ 炮塔:从车体往上的射线会穿进炮塔再出去', () => {
    const f = new VehicleFrames(TIGER_I, 0, 0);
    const exit = f.interiorExit(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 10);
    // 车体半高 0.975 + 炮塔高 0.95
    expect(exit).toBeCloseTo(TIGER_I.hull.height / 2 + TIGER_I.turret.height, 2);
  });

  it('所有载具的内部模块和乘员都在车内空间里(外挂的履带、炮管除外)', () => {
    for (const spec of Object.values(VEHICLES)) {
      const f = new VehicleFrames(spec, 0, 0);
      const boxes = f.interiorBoxes();
      const model = new DamageModel(spec);
      for (const t of model.internalTargets()) {
        const box = t.kind === 'module' ? t.module.box : t.member.box;
        const center = f.pointToHull(box.part, box.center);
        expect(boxes.some((b) => f.contains(b, center, 0.05))).toBe(true);
      }
    }
  });
});

describe('模块与乘员状态', () => {
  it('初始:5 名乘员在位,能开车能开火,所有效率为 1', () => {
    const m = new DamageModel(TIGER_I);
    expect(m.aliveCount).toBe(5);
    expect(m.canDrive).toBe(true);
    expect(m.canFire).toBe(true);
    expect(m.powerFactor).toBe(1);
    expect(m.reloadRate).toBe(1);
  });

  it('模块受损时性能按血量比例下降:发动机剩一半血 → 功率一半', () => {
    const m = new DamageModel(TIGER_I);
    m.applyDamage(moduleTarget(m, 'engine'), MODULE_TYPES.engine.hp / 2, 'shell', 0);
    expect(m.powerFactor).toBeCloseTo(0.5, 6);
    m.applyDamage(moduleTarget(m, 'traverse'), MODULE_TYPES.traverse.hp * 0.75, 'spall', 0);
    expect(m.traverseFactor).toBeCloseTo(0.25, 6);
  });

  it('打断履带:不能开车;按键维修期间仍不能开,修好后恢复满血', () => {
    const m = new DamageModel(TIGER_I);
    m.applyDamage(moduleTarget(m, 'track_l'), 999, 'external', 0);
    expect(m.canDrive).toBe(false);
    expect(m.startRepair()).toBe(true);
    tick(m, MODULE_TYPES.track.repairTime! - 1);
    expect(m.canDrive).toBe(false);
    tick(m, 1.1);
    expect(m.module('track_l')!.hp).toBe(MODULE_TYPES.track.hp);
    expect(m.canDrive).toBe(true);
  });

  it('维修时长取所有已坏模块中最长的那个,一次修好全部', () => {
    const m = new DamageModel(TIGER_I);
    m.applyDamage(moduleTarget(m, 'track_r'), 999, 'external', 0);
    m.applyDamage(moduleTarget(m, 'engine'), 999, 'shell', 0);
    m.startRepair();
    expect(m.repair!.total).toBe(Math.max(MODULE_TYPES.track.repairTime!, MODULE_TYPES.engine.repairTime!));
    tick(m, m.repair!.total + 0.1);
    expect(m.powerFactor).toBe(1);
    expect(m.trackFactor).toBe(1);
  });

  it('只掉了血的模块也能修:时长按损失比例折算,修完回满', () => {
    const m = new DamageModel(TIGER_I);
    const engine = m.module('engine')!;
    m.applyDamage(moduleTarget(m, 'engine'), engine.maxHp * 0.4, 'shell', 0);
    expect(m.powerFactor).toBeCloseTo(0.6, 6);
    expect(m.startRepair()).toBe(true);
    expect(m.repair!.total).toBeCloseTo(MODULE_TYPES.engine.repairTime! * 0.4, 6);
    tick(m, m.repair!.total + 0.1);
    expect(engine.hp).toBe(engine.maxHp);
    expect(m.powerFactor).toBe(1);
  });

  it('没有受损模块时按 F 不会进入维修', () => {
    const m = new DamageModel(TIGER_I);
    expect(m.startRepair()).toBe(false);
    expect(m.repair).toBeNull();
  });

  it('炮手阵亡:立即不能开火;机电员在换位时间后顶上,恢复开火', () => {
    const m = new DamageModel(TIGER_I);
    m.applyDamage(crewTarget(m, 'gunner'), 999, 'spall', 0);
    expect(m.canFire).toBe(false);
    tick(m, CREW.swapTime - 0.5);
    expect(m.canFire).toBe(false);
    tick(m, 1);
    expect(m.canFire).toBe(true);
    const radio = crewOf(m, 'radio');
    expect(radio.seat).toBe('gunner');
    expect(radio.box.part).toBe('turret');
  });

  it('装填手阵亡且没人可顶替时,炮手自己装填,速度减半', () => {
    const m = new DamageModel(TIGER_I);
    for (const role of ['loader', 'radio', 'commander']) m.applyDamage(crewTarget(m, role), 999, 'spall', 0);
    tick(m, CREW.swapTime + 1);
    expect(m.aliveCount).toBe(2);
    expect(m.knockedOut).toBe(false);
    expect(m.canFire).toBe(true);
    expect(m.reloadRate).toBeCloseTo(0.5, 6);
  });

  it('存活乘员少于 2 人即判定击毁', () => {
    const m = new DamageModel(T34_85);
    for (const role of ['loader', 'radio', 'commander', 'driver']) m.applyDamage(crewTarget(m, role), 999, 'spall', 0);
    expect(m.aliveCount).toBe(1);
    expect(m.knockedOut).toBe(true);
    expect(m.canFire).toBe(false);
    expect(m.canDrive).toBe(false);
  });

  it('弹药架被打坏 → 殉爆,全员阵亡', () => {
    const m = new DamageModel(TIGER_I);
    m.applyDamage(moduleTarget(m, 'ammo_sponson_lf'), 999, 'fragment', 0);
    expect(m.detonated).toBe(true);
    expect(m.aliveCount).toBe(0);
    expect(m.knockedOut).toBe(true);
  });
});

describe('击穿后效', () => {
  const shell = TIGER_I.weapons[0].ammo[0];
  const side = (spec: typeof TIGER_I, y: number, z: number) => ({
    entry: new THREE.Vector3(-spec.hull.width / 2, y, z),
    dir: new THREE.Vector3(1, 0, 0),
  });
  /** 炮塔左侧面(炮塔朝前时),高度为车顶以上 up 米 */
  const turretSide = (spec: typeof TIGER_I, up: number, z: number) => ({
    entry: new THREE.Vector3(-spec.turret.width / 2, spec.hull.height / 2 + up, z),
    dir: new THREE.Vector3(1, 0, 0),
  });

  it('APHE 从炮塔侧面打进乘员舱:引信触发、车内起爆,至少杀伤一名乘员', () => {
    const m = new DamageModel(T34_85);
    const f = new VehicleFrames(T34_85, 0, 0);
    // 炮塔座圈高度、炮手 / 车长所在的纵向位置
    const r = simulatePenetration(m, f, {
      ...turretSide(T34_85, 0.3, -0.2),
      shell,
      remainingPen: 90,
      effectiveArmor: 75,
      armorThickness: 75,
      rng: makeRng(1),
    });
    expect(r.fuseArmed).toBe(true);
    expect(r.explosion).not.toBeNull();
    expect(r.hits.some((h) => h.kind === 'crew' && h.destroyed)).toBe(true);
    expect(r.segments.some((s) => s.kind === 'spall')).toBe(true);
  });

  it('打穿的装甲比引信灵敏度还薄:引信不触发,不爆炸', () => {
    const m = new DamageModel(T34_85);
    const f = new VehicleFrames(T34_85, 0, 0);
    const r = simulatePenetration(m, f, {
      ...side(T34_85, 0, 1.3),
      shell,
      remainingPen: 150,
      effectiveArmor: shell.fuseSensitivity - 5,
      armorThickness: 10,
      rng: makeRng(2),
    });
    expect(r.fuseArmed).toBe(false);
    expect(r.explosion).toBeNull();
  });

  it('实心穿甲弹(AP)没有装药爆炸,杀伤明显弱于 APHE', () => {
    const run = (type: 'AP' | 'APHE') => {
      let kills = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const m = new DamageModel(T34_85);
        const r = simulatePenetration(m, new VehicleFrames(T34_85, 0, 0), {
          ...turretSide(T34_85, 0.3, -0.2),
          shell: { ...shell, type, explosiveMass: type === 'AP' ? 0 : shell.explosiveMass },
          remainingPen: 90,
          effectiveArmor: 75,
          armorThickness: 75,
          rng: makeRng(seed),
        });
        kills += r.hits.filter((h) => h.kind === 'crew' && h.destroyed).length;
      }
      return kills;
    };
    expect(run('APHE')).toBeGreaterThan(run('AP'));
  });

  it('打在车尾发动机舱:发动机受损,乘员无伤', () => {
    const m = new DamageModel(TIGER_I);
    const f = new VehicleFrames(TIGER_I, 0, 0);
    const r = simulatePenetration(m, f, {
      entry: new THREE.Vector3(0, 0, TIGER_I.hull.length / 2),
      dir: new THREE.Vector3(0, 0, -1),
      shell,
      remainingPen: 60,
      effectiveArmor: 80,
      armorThickness: 80,
      rng: makeRng(3),
    });
    expect(r.hits.some((h) => h.id === 'engine')).toBe(true);
    expect(m.module('engine')!.hp).toBeLessThan(MODULE_TYPES.engine.hp);
    expect(m.aliveCount).toBe(5);
  });

  it('打中弹药架引发殉爆:报告里带上全体阵亡乘员,车辆被摧毁', () => {
    const m = new DamageModel(TIGER_I);
    const f = new VehicleFrames(TIGER_I, 0, 0);
    // 左前侧裙弹药架(满载)中心高度 / 纵向位置
    const r = simulatePenetration(m, f, {
      ...side(TIGER_I, 0.5, -0.9),
      shell,
      remainingPen: 80,
      effectiveArmor: 80,
      armorThickness: 80,
      rng: makeRng(4),
    });
    expect(r.detonated).toBe(true);
    expect(r.knockedOut).toBe(true);
    expect(r.hits.filter((h) => h.kind === 'crew' && h.destroyed).length).toBe(5);
  });

  it('同一个随机种子结果完全一致(回放可复现)', () => {
    const run = () => {
      const m = new DamageModel(TIGER_I);
      return simulatePenetration(m, new VehicleFrames(TIGER_I, 0.4, 0.05), {
        ...side(TIGER_I, 1.1, -0.5),
        shell,
        remainingPen: 70,
        effectiveArmor: 80,
        armorThickness: 80,
        rng: makeRng(42),
      }).hits.map((h) => `${h.id}:${h.hpAfter.toFixed(2)}`);
    };
    expect(run()).toEqual(run());
  });
});
