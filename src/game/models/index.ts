import * as THREE from 'three';
import type { VehicleSpec } from '../../data/types';
import { ModelKit, bothSides, box, extrude, palette, prism, rect, revolve, type ModelParts } from './kit';
import { discWheel, rubberRoadWheel, runningGear, toothedSprocket } from './running';
import { periscope, roundHatch } from './parts';
import { buildTigerI } from './tigerI';
import { buildT3485 } from './t34_85';
import { buildTigerII } from './tigerII';
import { isCasemate } from '../casemate';

export type { ModelParts } from './kit';

export interface VehicleModel {
  /** Every MeshStandardMaterial used (the game tints them for hit flashes and darkens them for wrecks) */
  materials: THREE.MeshStandardMaterial[];
  /**
   * Running-gear animation. leftTravel / rightTravel = total distance travelled by the left / right
   * track so far, in metres (forward positive, can decrease when reversing). Call every frame.
   * Road wheels / sprockets / idlers rotate by travel / radius, and the track links visibly move along the track loop.
   */
  animate(leftTravel: number, rightTravel: number): void;
}

type ModelBuilder = (spec: VehicleSpec, parts: ModelParts, kit: ModelKit) => void;

/** 按载具 id 注册的程序化模型;没有专属模型的载具用通用模型 */
const BUILDERS: Record<string, ModelBuilder> = {
  tiger_i: buildTigerI,
  t34_85: buildT3485,
  tiger_ii: buildTigerII,
};

/**
 * 往 parts 里挂上模型网格。返回用到的材质(受伤闪烁 / 击毁变黑时统一处理)和行走机构动画函数。
 * 静态部分每个节点合并成一个网格;车轮与履带板是 InstancedMesh,animate 只在行驶距离变化时才改写实例矩阵。
 */
export function buildVehicleModel(spec: VehicleSpec, parts: ModelParts): VehicleModel {
  const kit = new ModelKit();
  (BUILDERS[spec.id] ?? buildGeneric)(spec, parts, kit);
  kit.finish();
  return { materials: kit.materials, animate: (left, right) => kit.animate(left, right) };
}

export function hasCustomModel(vehicleId: string): boolean {
  return vehicleId in BUILDERS;
}

/**
 * 按火炮水平角 / 俯仰角摆放模型节点(游戏、击杀回放、机库共用)。
 * 炮塔车:水平角转炮塔节点;固定战斗室车:战斗室不动,火炮节点先转水平角再俯仰。
 */
export function applyGunPose(spec: VehicleSpec, parts: Pick<ModelParts, 'turretPivot' | 'gunPivot'>, yaw: number, pitch: number): void {
  const casemate = isCasemate(spec);
  parts.turretPivot.rotation.y = casemate ? 0 : yaw;
  parts.gunPivot.rotation.set(pitch, casemate ? yaw : 0, 0, 'YXZ');
}

/** 通用模型:车体(倾斜首上)+ 两侧会动的履带与负重轮 + 方形炮塔 + 炮管 */
function buildGeneric(spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void {
  const { hull, turret } = spec;
  const hh = hull.height / 2;
  const hl = hull.length / 2;
  const hw = hull.width / 2;
  const C = palette(spec.color);
  const H = kit.batch(root);
  const T = kit.batch(turretPivot);
  const G = kit.batch(gunPivot);

  const trackW = hull.width * 0.22;
  const trackT = 0.06;
  const trackX = hw - trackW / 2;
  const ground = -hh;
  const wheelR = Math.min(0.36, hull.height * 0.2);
  const wheelY = ground + trackT + wheelR;
  const deck = wheelY + wheelR + trackT + 0.04;
  const n = Math.max(4, Math.round((hull.length * 0.62) / (wheelR * 2.3)));
  const span = hull.length * 0.62;
  const wc = { face: C.shade, rim: C.rubber, hub: C.deep, tyre: C.rubber };
  const sprR = wheelR * 0.8;
  runningGear(kit, root, { x: trackX, width: trackW, thickness: trackT, pitch: 0.17, color: C.track }, [
    {
      geo: rubberRoadWheel(wheelR, trackW * 0.4, wc, 10),
      radius: wheelR,
      wheels: Array.from({ length: n }, (_, i) => ({ x: hw - trackW * 0.25, y: wheelY, z: -span / 2 + (i * span) / (n - 1) })),
    },
    {
      geo: toothedSprocket(sprR, 12, trackW * 0.8, trackT, wc),
      radius: sprR,
      teeth: 12,
      wheels: [{ x: trackX, y: wheelY + wheelR * 0.5, z: -hl + sprR + trackT + 0.05 }],
    },
    {
      geo: discWheel(sprR, trackW * 0.7, { ...wc, hole: C.dark }),
      radius: sprR,
      tensioner: true,
      wheels: [{ x: trackX, y: wheelY + wheelR * 0.3, z: hl - sprR - trackT - 0.1 }],
    },
  ]);

  const tubW = hw - trackW - 0.02;
  const belly = ground + hull.height * 0.25;
  H.add(extrude([[-hl + 0.4, belly], [hl - 0.2, belly], [hl - 0.05, deck], [-hl, deck - 0.1]], 'x', -tubW, tubW), C.shade);
  const upperH = hh - deck;
  H.add(prism(deck, hh, rect(hull.width - 0.1, -hl + 0.05, hl - 0.05), rect(hull.width - 0.4, -hl + 0.05 + upperH * 1.2, hl - 0.25)), C.paint);
  bothSides((s) => H.add(box(0.12, 0.025, hull.length - 0.1), C.shade, [s * (hw - 0.04), deck - 0.0125, 0]));
  H.add(box(0.8, 0.04, 1.0), C.shade, [0, hh + 0.02, hl - 0.8]);

  const th = turret.height;
  const tl = turret.length / 2;
  const tw = turret.width / 2;
  T.add(prism(0, th, rect(turret.width, -tl, tl), rect(turret.width - 0.3, -tl + 0.2, tl - 0.1)), C.paint);
  T.add(revolve([[0.3, th - 0.05], [0.3, th + 0.15], [0.26, th + 0.18]], 'y', 12), C.shade, [-tw * 0.45, 0, tl * 0.35]);
  T.add(roundHatch(C, 0.25), null, [tw * 0.45, th, tl * 0.2]);
  T.add(periscope(C), null, [0, th, -tl * 0.5]);
  G.add(box(Math.min(1.0, turret.width * 0.45), 0.45, 0.3), C.shade, [0, 0, -0.1]);
  G.add(revolve([[0.11, -0.2], [0.09, -turret.barrelLength + 0.1], [0.11, -turret.barrelLength + 0.08], [0.11, -turret.barrelLength]], 'z', 8, { colors: [C.shade], endCap: C.dark }), null);
}
