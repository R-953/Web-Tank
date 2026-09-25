import * as THREE from 'three';
import type { ShellSpec } from '../data/types';
import { dragK } from '../data/shells';
import { integrateBallistic } from './Projectile';

const STEP = 1 / 60;
const TABLE_STEP = 50;
const TABLE_MAX = 4000;

/**
 * 表尺射表:每种炮弹一张「距离 → 需要的抬高角」表(不同弹种初速、阻力不同,表尺分划也不同)。
 * 用和游戏里炮弹完全相同的积分(60Hz、空气阻力、重力)算出来,所以表尺设在多远,
 * 准星压在同一距离的目标上就能打中。
 */
const tables = new Map<string, Float64Array>();

type BallisticShell = Pick<ShellSpec, 'id' | 'type' | 'caliber' | 'mass' | 'muzzleVelocity' | 'dragCoefficient'>;

/** 以仰角 angle 从原点发射,飞到水平距离 range 时相对视线(水平线)的高度,m */
function heightAtRange(shell: BallisticShell, k: number, angle: number, range: number): number {
  const v = new THREE.Vector3(0, Math.sin(angle), -Math.cos(angle)).multiplyScalar(shell.muzzleVelocity);
  const p = new THREE.Vector3();
  let prev = p.clone();
  for (let i = 0; i < 30 / STEP; i++) {
    prev = p.clone();
    p.add(integrateBallistic(v, STEP, k));
    if (-p.z >= range) {
      const f = (range + prev.z) / (prev.z - p.z);
      return prev.y + (p.y - prev.y) * f;
    }
  }
  return -Infinity;
}

function buildTable(shell: BallisticShell, k: number): Float64Array {
  const n = TABLE_MAX / TABLE_STEP + 1;
  const table = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const r = i * TABLE_STEP;
    let angle = table[i - 1];
    // 不动点迭代:按落点偏差修正仰角
    for (let it = 0; it < 4; it++) angle -= heightAtRange(shell, k, angle, r) / r;
    table[i] = angle;
  }
  return table;
}

/** 表尺设为 range 米时,火炮相对瞄准线需要抬高的角度,弧度 */
export function superelevation(shell: BallisticShell, range: number): number {
  if (range <= 0) return 0;
  const k = dragK(shell);
  const key = `${shell.id}|${shell.muzzleVelocity}|${k}`;
  let table = tables.get(key);
  if (!table) {
    table = buildTable(shell, k);
    tables.set(key, table);
  }
  const x = Math.min(range, TABLE_MAX) / TABLE_STEP;
  const i = Math.floor(x);
  if (i >= table.length - 1) return table[table.length - 1];
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

/** 表尺范围与滚轮每格的步长,m */
export const SIGHT_RANGE = { step: 50, max: 3000 };
