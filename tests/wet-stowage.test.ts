import { describe, it, expect } from 'vitest';
import { DamageModel } from '../src/game/damage/DamageModel';
import { DAMAGE } from '../src/data/damage';
import {
  ISU_122,
  M4A3E2,
  M4A3E8,
  M4A3_76W,
  SU_100,
  T34_85,
  TIGER_I,
  TIGER_II,
} from '../src/data/vehicles';
import { makeRng } from '../src/game/damage/geometry';

describe('湿式弹药架配置', () => {
  it('三辆谢尔曼的所有弹药架均标记为 wet: true', () => {
    for (const spec of [M4A3_76W, M4A3E8, M4A3E2]) {
      const ammoModules = spec.internals.modules.filter((m) => m.type === 'ammo');
      expect(ammoModules.length).toBeGreaterThan(0);
      for (const m of ammoModules) {
        expect(m.wet).toBe(true);
      }
    }
  });

  it('其余干式弹药架车辆没有 wet 标记', () => {
    for (const spec of [TIGER_I, T34_85, TIGER_II, SU_100, ISU_122]) {
      const ammoModules = spec.internals.modules.filter((m) => m.type === 'ammo');
      expect(ammoModules.length).toBeGreaterThan(0);
      for (const m of ammoModules) {
        expect(m.wet).toBeFalsy();
      }
    }
  });

  it('DAMAGE.ammo.wetFactor 折扣系数为 0.18', () => {
    expect(DAMAGE.ammo.wetFactor).toBe(0.18);
  });
});

describe('打坏弹药架殉爆概率(湿式 vs 干式)', () => {
  it('无随机数(确定性模式):干式满载满算 0.9 >= 0.5 殉爆,湿式 0.162 < 0.5 不殉爆且仅损失弹药', () => {
    // 干式
    const dryModel = new DamageModel(TIGER_I);
    const dryRackModule = dryModel.modules.find((m) => m.type === 'ammo')!;
    dryModel.applyDamage({ kind: 'module', module: dryRackModule }, dryRackModule.hp, 'shell', 0);
    expect(dryModel.detonated).toBe(true);
    expect(dryModel.knockedOut).toBe(true);

    // 湿式
    const wetModel = new DamageModel(M4A3_76W);
    const wetRackModule = wetModel.modules.find((m) => m.type === 'ammo')!;
    const roundsBefore = wetModel.rackRounds(wetModel.rackOf(wetRackModule)!);
    expect(roundsBefore).toBeGreaterThan(0);

    const res = wetModel.applyDamage({ kind: 'module', module: wetRackModule }, wetRackModule.hp, 'shell', 0);
    expect(res?.destroyed).toBe(true);
    expect(wetModel.detonated).toBe(false);
    expect(wetModel.knockedOut).toBe(false);
    expect(wetModel.rackRounds(wetModel.rackOf(wetRackModule)!)).toBe(0);

    // 弹药报废事件已产生
    const events = wetModel.update(1 / 60);
    expect(events.some((e) => e.type === 'ammo-lost' && e.rack === wetRackModule.id && e.rounds === roundsBefore)).toBe(true);
  });

  it('固定随机数验证:湿式殉爆概率阈值严格等于 干式阈值 × wetFactor', () => {
    const pDry = DAMAGE.ammo.detonationChance; // 0.9
    const pWet = pDry * DAMAGE.ammo.wetFactor; // 0.162

    // 1. rng < pWet (例如 pWet * 0.5): 两者都殉爆
    {
      const dry = new DamageModel(TIGER_I);
      const dryM = dry.modules.find((m) => m.type === 'ammo')!;
      dry.applyDamage({ kind: 'module', module: dryM }, dryM.hp, 'shell', 0, () => pWet * 0.5);
      expect(dry.detonated).toBe(true);

      const wet = new DamageModel(M4A3_76W);
      const wetM = wet.modules.find((m) => m.type === 'ammo')!;
      wet.applyDamage({ kind: 'module', module: wetM }, wetM.hp, 'shell', 0, () => pWet * 0.5);
      expect(wet.detonated).toBe(true);
    }

    // 2. pWet <= rng < pDry (例如 (pWet + pDry) / 2): 干式殉爆,湿式不殉爆
    {
      const dry = new DamageModel(TIGER_I);
      const dryM = dry.modules.find((m) => m.type === 'ammo')!;
      dry.applyDamage({ kind: 'module', module: dryM }, dryM.hp, 'shell', 0, () => (pWet + pDry) / 2);
      expect(dry.detonated).toBe(true);

      const wet = new DamageModel(M4A3_76W);
      const wetM = wet.modules.find((m) => m.type === 'ammo')!;
      wet.applyDamage({ kind: 'module', module: wetM }, wetM.hp, 'shell', 0, () => (pWet + pDry) / 2);
      expect(wet.detonated).toBe(false);
    }

    // 3. rng >= pDry (例如 pDry + 0.05): 两者均不殉爆
    {
      const dry = new DamageModel(TIGER_I);
      const dryM = dry.modules.find((m) => m.type === 'ammo')!;
      dry.applyDamage({ kind: 'module', module: dryM }, dryM.hp, 'shell', 0, () => pDry + 0.05);
      expect(dry.detonated).toBe(false);

      const wet = new DamageModel(M4A3_76W);
      const wetM = wet.modules.find((m) => m.type === 'ammo')!;
      wet.applyDamage({ kind: 'module', module: wetM }, wetM.hp, 'shell', 0, () => pDry + 0.05);
      expect(wet.detonated).toBe(false);
    }
  });

  it('蒙特卡洛统计检验:同样满载打坏 10000 次,湿式殉爆率 / 干式殉爆率 ≈ wetFactor', () => {
    const N = 10000;
    const rngDry = makeRng(12345);
    const rngWet = makeRng(12345);

    let dryDetonations = 0;
    for (let i = 0; i < N; i++) {
      const model = new DamageModel(TIGER_I);
      const m = model.modules.find((mod) => mod.type === 'ammo')!;
      model.applyDamage({ kind: 'module', module: m }, m.hp, 'shell', 0, rngDry);
      if (model.detonated) dryDetonations++;
    }

    let wetDetonations = 0;
    for (let i = 0; i < N; i++) {
      const model = new DamageModel(M4A3_76W);
      const m = model.modules.find((mod) => mod.type === 'ammo')!;
      model.applyDamage({ kind: 'module', module: m }, m.hp, 'shell', 0, rngWet);
      if (model.detonated) wetDetonations++;
    }

    const dryRate = dryDetonations / N;
    const wetRate = wetDetonations / N;

    // 理论值:干式 0.90,湿式 0.90 × 0.18 = 0.162
    expect(dryRate).toBeGreaterThan(0.885);
    expect(dryRate).toBeLessThan(0.915);

    expect(wetRate).toBeGreaterThan(0.147);
    expect(wetRate).toBeLessThan(0.177);

    const ratio = wetRate / dryRate;
    expect(Math.abs(ratio - DAMAGE.ammo.wetFactor)).toBeLessThan(0.015);
  });
});

describe('起火灼烧 cook-off 殉爆概率(湿式 vs 干式)', () => {
  const DT = 1 / 60;

  it('固定随机数验证:烧够 cookOffDelay 后,湿式弹药架每步掷骰判定阈值乘以 wetFactor', () => {
    const f = DAMAGE.fire;
    // 满载时干式每步 cookOff 概率 = f.cookOffChance * 1 * DT
    const pStepDry = f.cookOffChance * 1 * DT;
    const pStepWet = pStepDry * DAMAGE.ammo.wetFactor;

    // 1. rng < pStepWet: 湿式也能在这一步 cook-off
    {
      const wet = new DamageModel(M4A3_76W);
      const rack = wet.racks.find((r) => wet.rackRounds(r) > 0)!;
      wet.ignite(rack.module.id);
      wet.fire!.remaining = 1000;
      wet.fire!.burning = f.cookOffDelay + 1; // 已烤够时间

      let cooked = false;
      const rng = () => pStepWet * 0.5;
      const events = wet.update(DT, rng);
      cooked = events.some((e) => e.type === 'cook-off');
      expect(cooked).toBe(true);
      expect(wet.detonated).toBe(true);
    }

    // 2. pStepWet <= rng < pStepDry: 干式发生 cook-off,湿式不发生
    {
      const dry = new DamageModel(TIGER_I);
      const rackDry = dry.racks.find((r) => dry.rackRounds(r) > 0)!;
      dry.ignite(rackDry.module.id);
      dry.fire!.remaining = 1000;
      dry.fire!.burning = f.cookOffDelay + 1;

      const wet = new DamageModel(M4A3_76W);
      const rackWet = wet.racks.find((r) => wet.rackRounds(r) > 0)!;
      wet.ignite(rackWet.module.id);
      wet.fire!.remaining = 1000;
      wet.fire!.burning = f.cookOffDelay + 1;

      // 取两者之间的阈值
      const midVal = (pStepDry + pStepWet) / 2;
      const rngMid = () => midVal;

      const dryCooked = dry.update(DT, rngMid).some((e) => e.type === 'cook-off');
      const wetCooked = wet.update(DT, rngMid).some((e) => e.type === 'cook-off');

      expect(dryCooked).toBe(true);
      expect(dry.detonated).toBe(true);

      expect(wetCooked).toBe(false);
      expect(wet.detonated).toBe(false);
    }
  });
});
