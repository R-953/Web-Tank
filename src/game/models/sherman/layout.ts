import type { VehicleSpec } from '../../../data/types';
import { DEG } from '../kit';

/**
 * 谢尔曼 M4A3 系列共用的关键尺寸(主程维护,零件作者只读)。
 *
 * 三辆车共用一个 47° 单块首上的焊接车体,按零件分给不同的人做:
 *   车体 hull.ts / 行走机构 suspension.ts / 炮塔与火炮 turret.ts。
 * 各零件只用这里的数,接缝处才对得上。确实需要改这里的数,在任务卡的「结果」里写明,由主程改。
 *
 * 坐标(与 kit.ts 一致):root 原点在车体盒中心,y ∈ [−hh, hh],−Z 车头,+X 右;
 * turretPivot 在座圈中心、车顶高度,炮塔从 y = 0 往上建;gunPivot 在炮耳轴,炮管沿 −Z 伸出 barrelLength。
 * 标「估算」的数没有公开出处,按照片比例和资料里的总尺寸推的。
 */

export type Suspension = 'vvss' | 'hvss';
export type ShermanTurret = 't23' | 'jumbo';
/** m1a1:76 mm 无制退器(炮口螺纹保护帽);m1a2:76 mm 带单室制退器;m3:75 mm */
export type ShermanGun = 'm1a1' | 'm1a2' | 'm3';

export interface ShermanVariant {
  suspension: Suspension;
  turret: ShermanTurret;
  gun: ShermanGun;
  /** M4A3E2:首上、上部侧面加焊附加装甲,单块加厚传动罩,没有大灯 */
  applique: boolean;
}

export interface Circle2 {
  z: number;
  y: number;
  r: number;
}

export interface ShermanLayout {
  readonly spec: VehicleSpec;
  readonly variant: ShermanVariant;
  /** 车体盒半高 / 半长 */
  readonly hh: number;
  readonly hl: number;
  /** 地面 */
  readonly ground: number;
  /** 车底(离地间隙 0.43 m,资料值) */
  readonly belly: number;
  /** 侧裙底面:上部车体从这里往上、向两侧伸出到履带上方(估算) */
  readonly sponsonY: number;
  /** 车顶 */
  readonly top: number;
  /** 下部车体(两条履带之间)半宽(估算:履带内缘以内) */
  readonly lowerHalfW: number;
  /** 上部车体(侧裙外表面)半宽,不含附加装甲(估算:上部车体宽 2.62 m) */
  readonly upperHalfW: number;
  /** 附加装甲厚度(E2 首上 1.5 in、上部侧面 1.5 in 的附加板;其他车为 0) */
  readonly applique: number;
  /** 车鼻:铸造传动罩最前端的 z(估算) */
  readonly noseZ: number;
  /** 首上 47°(与竖直):下缘与传动罩相接处 */
  readonly glacisBottom: { readonly y: number; readonly z: number };
  /** 首上在高度 y 处的 z(不含附加装甲) */
  glacisZ(y: number): number;
  /** 车尾板上缘的 z(车尾板与竖直 10°–22°,向下往前收) */
  readonly rearZ: number;
  /** 履带:中心线 |x|、宽、厚、节距(与 internals 的 track 模块一致) */
  readonly track: { readonly x: number; readonly width: number; readonly thickness: number; readonly pitch: number };
  /** 每侧履带板数(资料:79 块 × 6 in) */
  readonly trackShoes: number;
  /**
   * 前主动轮(13 齿):装在车体传动罩两侧,车体和行走机构都要用。
   * r 是履带内表面贴合的半径 = 节圆半径 − 履带厚 / 2(runningGear 按 r + 厚 / 2 算节距,这样节距正好 6 in)
   */
  readonly sprocket: Circle2 & { readonly teeth: number };
  /** 三个负重轮架的中心 z(VVSS 和 HVSS 装在车体同一位置,估算) */
  readonly bogieZ: readonly [number, number, number];
  /** 炮塔座圈:中心 z(root 坐标)、半径(69 in 座圈) */
  readonly ring: { readonly z: number; readonly r: number };
  /** 炮塔盒(turretPivot 坐标):炮耳轴在 (0, trunnionY, trunnionZ) */
  readonly turretBox: { readonly length: number; readonly width: number; readonly height: number; readonly trunnionY: number; readonly trunnionZ: number };
  /** 炮管从炮耳轴到炮口的长度(gunPivot 坐标,炮口在 z = −barrelLength) */
  readonly barrelLength: number;
}

const IN = 0.0254;

export function shermanLayout(spec: VehicleSpec, variant: ShermanVariant): ShermanLayout {
  const hh = spec.hull.height / 2;
  const hl = spec.hull.length / 2;
  const ground = -hh;
  const track = spec.internals.modules.find((m) => m.id === 'track_r');
  if (!track) throw new Error(`${spec.id}: internals 里没有 track_r`);
  const glacisBottom = { y: ground + 1.0, z: -hl + 0.2 };
  const { turret } = spec;
  const trackT = 0.06;
  return {
    spec,
    variant,
    hh,
    hl,
    ground,
    belly: ground + 17 * IN,
    sponsonY: ground + 1.05,
    top: hh,
    lowerHalfW: 0.83,
    upperHalfW: 1.31,
    applique: variant.applique ? 1.5 * IN : 0,
    noseZ: -hl + 0.12,
    glacisBottom,
    glacisZ: (y) => glacisBottom.z + (y - glacisBottom.y) * Math.tan(47 * DEG),
    rearZ: hl - 0.12,
    track: { x: track.center[0], width: track.size[0], thickness: trackT, pitch: 6 * IN },
    trackShoes: 79,
    // 13 齿 × 6 in 节距 → 节圆周长 1.98 m、节圆半径 0.315;中心离地 0.64 m(估算)
    sprocket: { z: -hl + 0.52, y: ground + 0.64, r: (13 * 6 * IN) / (2 * Math.PI) - trackT / 2, teeth: 13 },
    bogieZ: [-1.4, 0.08, 1.56],
    ring: { z: turret.offset ?? 0, r: (69 * IN) / 2 },
    turretBox: { length: turret.length, width: turret.width, height: turret.height, trunnionY: turret.height / 2, trunnionZ: -turret.length / 2 },
    barrelLength: turret.barrelLength,
  };
}
