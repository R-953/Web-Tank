import * as THREE from 'three';
import type { VehicleSpec } from '../../data/types';
import { ModelKit, bothSides, darker, type ModelParts } from './kit';
import { buildTigerI } from './tigerI';
import { buildT3485 } from './t34_85';
import { buildTigerII } from './tigerII';

export type { ModelParts } from './kit';

type ModelBuilder = (spec: VehicleSpec, parts: ModelParts, kit: ModelKit) => void;

/** 按载具 id 注册的程序化模型;没有专属模型的载具用通用方盒模型 */
const BUILDERS: Record<string, ModelBuilder> = {
  tiger_i: buildTigerI,
  t34_85: buildT3485,
  tiger_ii: buildTigerII,
};

/** 往 parts 里挂上模型网格,返回用到的材质(受伤闪烁 / 击毁变黑时统一处理) */
export function buildVehicleModel(spec: VehicleSpec, parts: ModelParts): THREE.MeshStandardMaterial[] {
  const kit = new ModelKit();
  (BUILDERS[spec.id] ?? buildGeneric)(spec, parts, kit);
  return kit.materials;
}

export function hasCustomModel(vehicleId: string): boolean {
  return vehicleId in BUILDERS;
}

/** 通用方盒模型:车体 + 两侧履带 + 方形炮塔 + 炮管 */
function buildGeneric(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const body = kit.material(spec.color);
  const shade = kit.material(darker(spec.color, 0.55));
  const track = kit.material(0x2b2b2b);
  const trackW = hull.width * 0.24;
  kit.add(root, new THREE.BoxGeometry(hull.width * 0.78, hull.height * 0.62, hull.length * 0.96), body, [0, hull.height * 0.19, 0]);
  bothSides((s) =>
    kit.add(root, new THREE.BoxGeometry(trackW, hull.height * 0.7, hull.length), track, [s * (hull.width / 2 - trackW / 2), -hull.height * 0.15, 0]),
  );
  kit.add(turretPivot, new THREE.BoxGeometry(turret.width, turret.height, turret.length), shade, [0, turret.height / 2, 0]);
  const barrel = new THREE.CylinderGeometry(0.09, 0.12, turret.barrelLength, 8);
  barrel.rotateX(Math.PI / 2).translate(0, 0, -turret.barrelLength / 2);
  kit.add(gunPivot, barrel, shade);
}
