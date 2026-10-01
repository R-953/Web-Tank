import type { VehicleSpec } from '../../../data/types';
import { palette, type ModelKit, type ModelParts } from '../kit';
import { shermanLayout, type ShermanVariant } from './layout';
import { buildShermanHull } from './hull';
import { buildSuspension } from './suspension';
import { buildShermanTurret } from './turret';

/**
 * 谢尔曼 M4A3 系列:同一个车体 + 两种悬挂 + 两种炮塔拼出三辆车(主程维护)。
 * 关键尺寸在 layout.ts;零件分在 hull.ts / suspension.ts / turret.ts,各由一张任务卡负责。
 */
function buildSherman(variant: ShermanVariant) {
  return (spec: VehicleSpec, { root, turretPivot, gunPivot }: ModelParts, kit: ModelKit): void => {
    const L = shermanLayout(spec, variant);
    const C = palette(spec.color);
    const H = kit.batch(root);
    buildShermanHull(L, H, C);
    buildSuspension(L, kit, root, H, C);
    buildShermanTurret(L, kit.batch(turretPivot), kit.batch(gunPivot), C);
  };
}

/** M4A3(76)W:VVSS、T23 炮塔、76 mm M1A1(无制退器) */
export const buildM4A3_76W = buildSherman({ suspension: 'vvss', turret: 't23', gun: 'm1a1', applique: false });
/** M4A3E8:HVSS、T23 炮塔、76 mm M1A2(带制退器) */
export const buildM4A3E8 = buildSherman({ suspension: 'hvss', turret: 't23', gun: 'm1a2', applique: false });
/** M4A3E2:VVSS(加宽端联器)、Jumbo 炮塔、75 mm M3、附加装甲 */
export const buildM4A3E2 = buildSherman({ suspension: 'vvss', turret: 'jumbo', gun: 'm3', applique: true });
