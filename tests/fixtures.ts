import type { InternalsSpec, MapSpec, SpawnSpec, VehicleSpec } from '../src/data/types';

/** 平地测试地图(无障碍物),出生点由各测试指定 */
export function flatMap(player: SpawnSpec, targets: SpawnSpec[] = [], size = 300): MapSpec {
  return {
    id: 'test_flat',
    name: '测试平地',
    size,
    terrain: { cellSize: size / 2, base: 0, features: [] },
    obstacles: [],
    spawns: { player, targets },
  };
}

/**
 * 测试车的内部布局(车体 6 × 3 × 1.4 m,炮塔 2.6 × 2.2 × 0.9 m):
 * 发动机在后、传动在前、弹药只放在炮塔尾舱——
 * 这样打车体侧面正中不会一发殉爆,便于测试乘员 / 模块的逐步损伤。
 */
export const TEST_INTERNALS: InternalsSpec = {
  modules: [
    { id: 'engine', type: 'engine', part: 'hull', center: [0, -0.05, 2.0], size: [1.3, 0.9, 1.4] },
    { id: 'transmission', type: 'transmission', part: 'hull', center: [0, -0.2, -2.4], size: [1, 0.7, 0.8] },
    { id: 'track_l', type: 'track', part: 'hull', center: [-1.25, -0.45, 0], size: [0.5, 0.6, 5.8] },
    { id: 'track_r', type: 'track', part: 'hull', center: [1.25, -0.45, 0], size: [0.5, 0.6, 5.8] },
    { id: 'ammo_bustle', type: 'ammo', part: 'turret', center: [0, 0.4, 0.95], size: [1.6, 0.45, 0.5], capacity: 60, drawOrder: 1 },
    { id: 'traverse', type: 'traverse', part: 'turret', center: [-0.3, -0.2, -0.2], size: [0.35, 0.35, 0.35] },
    { id: 'elevation', type: 'elevation', part: 'turret', center: [-0.35, 0.3, -0.9], size: [0.3, 0.3, 0.3] },
    { id: 'breech', type: 'breech', part: 'gun', center: [0, 0, 0.9], size: [0.3, 0.3, 1.0] },
    { id: 'barrel', type: 'barrel', part: 'gun', center: [0, 0, -1.5], size: [0.18, 0.18, 3] },
  ],
  crew: [
    { role: 'driver', part: 'hull', center: [-0.6, -0.05, -2.0] },
    { role: 'radio', part: 'hull', center: [0.6, -0.05, -2.0] },
    { role: 'gunner', part: 'turret', center: [-0.5, 0.05, -0.4] },
    { role: 'commander', part: 'turret', center: [-0.55, 0.35, 0.5] },
    { role: 'loader', part: 'turret', center: [0.55, -0.05, 0.1] },
  ],
};

export const SHOOTER: VehicleSpec = {
  id: 'shooter',
  name: '测试射手',
  armor: { front: 80, side: 40, rear: 30 },
  turretArmor: { front: 80, side: 40, rear: 30 },
  maxSpeed: 36,
  turretRotationSpeed: 40,
  weapons: [
    {
      id: 'gun',
      name: '测试炮',
      reloadTime: 0.5,
      ammo: [
        { id: 'aphe', name: '测试穿甲弹', type: 'APHE', caliber: 75, mass: 6.8, muzzleVelocity: 600, penetration: 100, explosiveMass: 30, fuseDelay: 1.2, fuseSensitivity: 15 },
        { id: 'he', name: '测试高爆弹', type: 'HE', caliber: 75, mass: 6.8, muzzleVelocity: 600, penetration: 10, explosiveMass: 700, fuseDelay: 0, fuseSensitivity: 0.1 },
        { id: 'heat', name: '测试破甲弹', type: 'HEAT', caliber: 75, mass: 4.4, muzzleVelocity: 450, penetration: 80, explosiveMass: 500, fuseDelay: 0, fuseSensitivity: 0.3 },
        { id: 'hesh', name: '测试碎甲弹', type: 'HESH', caliber: 75, mass: 6.8, muzzleVelocity: 600, penetration: 90, explosiveMass: 1500, fuseDelay: 0, fuseSensitivity: 0.1 },
      ],
    },
  ],
  hull: { length: 6, width: 3, height: 1.4, turnRate: 45, acceleration: 4 },
  turret: { length: 2.6, width: 2.2, height: 0.9, barrelLength: 3, elevation: [-10, 20], elevationSpeed: 20 },
  sight: { magnifications: [2, 4], reticle: 'german' },
  internals: TEST_INTERNALS,
  color: 0x777777,
};

/** 正面 150mm 打不穿,侧面 50mm 能打穿 */
export const TARGET: VehicleSpec = {
  ...SHOOTER,
  id: 'target',
  name: '测试靶',
  armor: { front: 150, side: 50, rear: 30 },
  turretArmor: { front: 150, side: 50, rear: 30 },
  maxSpeed: 30,
  weapons: [],
};

export const TEST_VEHICLES: Record<string, VehicleSpec> = { shooter: SHOOTER, target: TARGET };
