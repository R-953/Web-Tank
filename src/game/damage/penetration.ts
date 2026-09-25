import * as THREE from 'three';
import type { ShellSpec } from '../../data/types';
import { DAMAGE } from '../../data/damage';
import { SHELL_TYPES } from '../../data/shells';
import { MODULE_TYPES, CREW, CREW_ROLE_NAMES } from '../../data/modules';
import type { DamageModel, DamageSource, DamageTarget, HitRecord } from './DamageModel';
import { VehicleFrames, randomInCone } from './geometry';

/** 回放里车内过程的「慢放速度」:弹体与破片每回放秒走多少米 */
export const REPLAY_SHELL_SPEED = 3;
export const REPLAY_FRAGMENT_SPEED = 2.5;

export interface Segment {
  kind: 'shell' | 'spall' | 'fragment';
  /** 车体坐标 */
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** 回放时间轴,秒 */
  t0: number;
  t1: number;
  /** 打中的目标 id(没打中为 null) */
  hitId: string | null;
}

export interface PenetrationInput {
  /** 击穿点,车体坐标 */
  entry: THREE.Vector3;
  /** 弹道方向,车体坐标,单位向量 */
  dir: THREE.Vector3;
  shell: ShellSpec;
  /** 击穿后剩余穿深,mm */
  remainingPen: number;
  /** 被击穿装甲的等效厚度(决定引信是否触发),mm */
  effectiveArmor: number;
  /** 被击穿装甲的厚度(决定崩落破片多少),mm */
  armorThickness: number;
  rng: () => number;
}

export interface PenetrationReport {
  entry: THREE.Vector3;
  dir: THREE.Vector3;
  segments: Segment[];
  explosion: { center: THREE.Vector3; radius: number; time: number } | null;
  /** 按时间排序的伤害记录(只含实际生效的) */
  hits: HitRecord[];
  fuseArmed: boolean;
  detonated: boolean;
  knockedOut: boolean;
  /** 回放车内部分的总时长,秒 */
  duration: number;
}

interface PendingHit {
  target: DamageTarget;
  damage: number;
  source: DamageSource;
  time: number;
}

function targetBox(t: DamageTarget) {
  return t.kind === 'module' ? t.module.box : t.member.box;
}

function targetId(t: DamageTarget): string {
  return t.kind === 'module' ? t.module.id : `crew:${t.member.index}`;
}

function targetAbsorb(t: DamageTarget): number {
  return t.kind === 'module' ? MODULE_TYPES[t.module.type].absorb : CREW.absorb;
}

/** 沿射线找第一个被打中的目标(tEnter ∈ [0, maxT]) */
function firstHit(frames: VehicleFrames, targets: DamageTarget[], origin: THREE.Vector3, dir: THREE.Vector3, maxT: number) {
  let best: { target: DamageTarget; t: number } | null = null;
  for (const target of targets) {
    const hit = frames.intersect(targetBox(target), origin, dir);
    if (!hit) continue;
    const t = Math.max(0, hit.tEnter);
    if (t <= maxT && (!best || t < best.t)) best = { target, t };
  }
  return best;
}

/**
 * 击穿后的车内过程(通用逻辑,弹种差异见 data/shells.ts):
 *   1. 弹体(动能弹)或金属射流(破甲弹)沿弹道继续前进,依次穿过模块 / 乘员(每穿过一个损失一些穿深和伤害);
 *      高爆弹、碎甲弹没有东西钻进车内;
 *   2. 击穿点向前喷出一圈装甲崩落破片(硬芯弹、破甲弹少而窄,碎甲弹多而宽);
 *   3. 带装药的穿甲弹在引信延迟距离(或弹体停下的地方)起爆,高爆弹在装甲内侧立即起爆:
 *      半径内冲击波伤害 + 向四周飞散的弹体破片。
 * 所有伤害按回放时间先后生效(弹药架殉爆、乘员不足判定都在其中处理)。
 */
export function simulatePenetration(model: DamageModel, frames: VehicleFrames, input: PenetrationInput): PenetrationReport {
  const { shell, rng } = input;
  const kind = SHELL_TYPES[shell.type];
  const dir = input.dir.clone().normalize();
  const start = input.entry.clone().addScaledVector(dir, 0.01);
  const targets = model.internalTargets();
  const segments: Segment[] = [];
  const pending: PendingHit[] = [];

  // --- 1. 弹体 / 射流
  const interiorT = frames.interiorExit(start, dir, 30);
  const fuseArmed = kind.delayedExplosive && shell.explosiveMass > 0 && input.effectiveArmor >= shell.fuseSensitivity;
  // 高爆弹着发:击穿后在装甲内侧起爆
  const instantBlast = shell.type === 'HE' && shell.explosiveMass > 0;
  const fuseT = fuseArmed ? shell.fuseDelay : Infinity;
  const bodyT = Math.min(interiorT, kind.bodyRange);
  const along =
    kind.body > 0
      ? targets
          .map((target) => {
            const hit = frames.intersect(targetBox(target), start, dir);
            return hit ? { target, t: Math.max(0, hit.tEnter) } : null;
          })
          .filter((x): x is { target: DamageTarget; t: number } => !!x && x.t <= bodyT)
          .sort((a, b) => a.t - b.t)
      : [];

  let pen = input.remainingPen;
  let bodyDamage = (DAMAGE.shellBody.base + DAMAGE.shellBody.perKg * shell.mass) * kind.body;
  let stopT = bodyT;
  let lastHitId: string | null = null;
  for (const { target, t } of along) {
    if (t > fuseT) break;
    pending.push({ target, damage: bodyDamage, source: 'shell', time: t / REPLAY_SHELL_SPEED });
    lastHitId = targetId(target);
    pen -= targetAbsorb(target);
    bodyDamage *= DAMAGE.shellBody.decay;
    if (pen <= 0) {
      stopT = t;
      break;
    }
  }
  const explodeT = fuseArmed ? Math.min(fuseT, stopT) : instantBlast ? 0.05 : null;
  if (kind.body > 0) {
    const shellEndT = explodeT ?? stopT;
    segments.push({
      kind: 'shell',
      from: start.clone(),
      to: start.clone().addScaledVector(dir, shellEndT),
      t0: 0,
      t1: shellEndT / REPLAY_SHELL_SPEED,
      hitId: lastHitId,
    });
  }

  // --- 2. 装甲崩落破片
  const sp = DAMAGE.spall;
  const baseCount = Math.min(sp.max, Math.max(sp.min, Math.round(sp.min + input.armorThickness / sp.mmPerFragment)));
  const spallCount = Math.round(baseCount * kind.spall);
  const spallDamage = (sp.damageBase + input.armorThickness * sp.damagePerMm) * Math.min(1.5, 0.5 + 0.5 * kind.spall);
  for (let i = 0; i < spallCount; i++) {
    const d = randomInCone(dir, (kind.spallCone * Math.PI) / 180, rng);
    const maxT = frames.interiorExit(start, d, sp.range);
    const hit = firstHit(frames, targets, start, d, maxT);
    const len = hit ? hit.t : maxT;
    if (hit) pending.push({ target: hit.target, damage: spallDamage, source: 'spall', time: len / REPLAY_FRAGMENT_SPEED });
    segments.push({
      kind: 'spall',
      from: start.clone(),
      to: start.clone().addScaledVector(d, len),
      t0: 0,
      t1: len / REPLAY_FRAGMENT_SPEED,
      hitId: hit ? targetId(hit.target) : null,
    });
  }

  // --- 3. 装药爆炸
  let explosion: PenetrationReport['explosion'] = null;
  if (explodeT !== null) {
    const ex = DAMAGE.explosion;
    const center = start.clone().addScaledVector(dir, explodeT);
    const radius = ex.radiusK * Math.cbrt(shell.explosiveMass / 1000);
    const tBoom = explodeT / REPLAY_SHELL_SPEED;
    explosion = { center, radius, time: tBoom };
    for (const target of targets) {
      const dist = frames.distance(targetBox(target), center);
      if (dist < radius) pending.push({ target, damage: ex.peak * (1 - dist / radius), source: 'blast', time: tBoom });
    }
    for (let i = 0; i < ex.fragments; i++) {
      const d = rng() < ex.forwardBias ? randomInCone(dir, Math.PI / 3, rng) : randomInCone(dir, Math.PI, rng);
      const maxT = frames.interiorExit(center, d, ex.fragmentRange);
      const hit = firstHit(frames, targets, center, d, maxT);
      const len = hit ? hit.t : maxT;
      const t1 = tBoom + len / REPLAY_FRAGMENT_SPEED;
      if (hit) pending.push({ target: hit.target, damage: ex.fragmentDamage, source: 'fragment', time: t1 });
      segments.push({
        kind: 'fragment',
        from: center.clone(),
        to: center.clone().addScaledVector(d, len),
        t0: tBoom,
        t1,
        hitId: hit ? targetId(hit.target) : null,
      });
    }
  }

  // --- 按时间顺序生效
  pending.sort((a, b) => a.time - b.time);
  const hits: HitRecord[] = [];
  for (const p of pending) {
    const wasDetonated = model.detonated;
    const hpBefore = new Map(model.crew.filter((c) => c.alive).map((c) => [c, c.hp]));
    const rec = model.applyDamage(p.target, p.damage, p.source, p.time, rng);
    if (rec) hits.push(rec);
    if (!wasDetonated && model.detonated) {
      // 弹药殉爆:记下被殉爆带走的乘员
      for (const [c, before] of hpBefore) {
        if (c.alive || rec?.id === `crew:${c.index}`) continue;
        hits.push({
          kind: 'crew',
          id: `crew:${c.index}`,
          name: CREW_ROLE_NAMES[c.homeRole],
          source: 'detonation',
          damage: before,
          hpBefore: before,
          hpAfter: 0,
          maxHp: CREW.hp,
          destroyed: true,
          time: p.time,
        });
      }
    }
  }

  const duration = Math.max(0, ...segments.map((s) => s.t1));
  return {
    entry: input.entry.clone(),
    dir,
    segments,
    explosion,
    hits,
    fuseArmed,
    detonated: model.detonated,
    knockedOut: model.knockedOut,
    duration,
  };
}
