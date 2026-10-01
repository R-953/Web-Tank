import { extrude, prism, DEG, type GeoBatch, type Palette } from '../kit';
import type { ShermanLayout } from './layout';

/**
 * M4A3 焊接车体(47° 单块首上、大舱门)。
 *
 * 【占位】任务 013 会整个重写这个文件。现在只有下部车体 + 上部车体两个块,保证游戏里能显示、包围盒测试能过。
 * 只往 H(车体静态网格)里加东西;行走机构(负重轮架、主动轮、诱导轮、托带轮、履带)归 suspension.ts,不要在这里画。
 */
export function buildShermanHull(L: ShermanLayout, H: GeoBatch, C: Palette): void {
  const { ground, belly, sponsonY, top, noseZ, rearZ, lowerHalfW, upperHalfW, glacisBottom, glacisZ } = L;
  // 下部车体(两条履带之间):车鼻是铸造传动罩,车尾略向前收
  H.add(
    extrude(
      [
        [noseZ, ground + 0.65],
        [noseZ + 0.35, belly],
        [rearZ - 0.2, belly],
        [rearZ, ground + 0.6],
        [rearZ, sponsonY],
        [glacisBottom.z, sponsonY],
        [glacisBottom.z, glacisBottom.y],
      ],
      'x',
      -lowerHalfW,
      lowerHalfW,
    ),
    C.paint,
  );
  // 上部车体(含侧裙):47° 首上,车尾板下缘向前收 10°
  const rearLean = (top - sponsonY) * Math.tan(10 * DEG);
  const w = upperHalfW + L.applique;
  H.add(prism(sponsonY, top, { x0: -w, x1: w, z0: glacisZ(sponsonY), z1: rearZ - rearLean }, { x0: -w, x1: w, z0: glacisZ(top), z1: rearZ }), C.paint);
}
