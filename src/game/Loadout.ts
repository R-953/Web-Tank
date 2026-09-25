import type { Loadout, VehicleSpec } from '../data/types';

/** 弹药架总容量(发) */
export function ammoCapacity(spec: VehicleSpec): number {
  return spec.internals.modules.reduce((n, m) => n + (m.type === 'ammo' ? (m.capacity ?? 0) : 0), 0);
}

/** 按权重把 total 发分给各弹种(最大余数法,总数不变) */
function split(ids: string[], weights: number[], total: number): Loadout {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const exact = weights.map((w) => (w / sum) * total);
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    counts[i]++;
    left--;
  }
  const out: Loadout = {};
  ids.forEach((id, i) => (out[id] = counts[i]));
  return out;
}

/**
 * 玩家的缺省携弹:约 2/3 容量(最先取空的弹药架因此空着),
 * 默认弹 60%,高爆弹 20%,其余弹种平分剩下的 20%。
 */
export function defaultLoadout(spec: VehicleSpec, fraction = 0.65): Loadout {
  const ammo = spec.weapons[0]?.ammo ?? [];
  const total = Math.round(ammoCapacity(spec) * fraction);
  const others = ammo.filter((a, i) => i > 0 && a.type !== 'HE').length;
  const weights = ammo.map((a, i) => (i === 0 ? 0.6 : a.type === 'HE' ? 0.2 : others ? 0.2 / others : 0));
  return split(
    ammo.map((a) => a.id),
    weights,
    total,
  );
}

/**
 * 敌方携弹:总量在容量的 min–max 之间随机(谁也不知道碰到的是满弹还是快打光的),
 * 默认弹约占 3/4,其余弹种随机分配。
 */
export function randomLoadout(spec: VehicleSpec, rng: () => number, fraction?: number, min = 0.3, max = 1): Loadout {
  const ammo = spec.weapons[0]?.ammo ?? [];
  const f = fraction ?? min + (max - min) * rng();
  const total = Math.round(ammoCapacity(spec) * f);
  const weights = ammo.map((_, i) => (i === 0 ? 3 : rng() / Math.max(1, ammo.length - 1)));
  return split(
    ammo.map((a) => a.id),
    weights,
    total,
  );
}

/** 把携弹方案修正到合法范围:只保留该炮的弹种,非负整数,总数不超过容量(超出的从后面的弹种扣) */
export function clampLoadout(spec: VehicleSpec, loadout: Loadout): Loadout {
  const ammo = spec.weapons[0]?.ammo ?? [];
  let room = ammoCapacity(spec);
  const out: Loadout = {};
  for (const a of ammo) {
    const n = Math.max(0, Math.min(room, Math.floor(loadout[a.id] ?? 0)));
    out[a.id] = n;
    room -= n;
  }
  return out;
}

export function loadoutTotal(loadout: Loadout): number {
  return Object.values(loadout).reduce((a, b) => a + b, 0);
}
