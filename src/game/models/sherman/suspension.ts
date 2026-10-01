import type * as THREE from 'three';
import { box, type GeoBatch, type ModelKit, type Palette } from '../kit';
import { discWheel, rubberRoadWheel, runningGear, toothedSprocket } from '../running';
import type { ShermanLayout } from './layout';

/**
 * 行走机构:VVSS(垂直螺旋弹簧)或 HVSS(水平螺旋弹簧),由 L.variant.suspension 决定。
 *
 * 【占位】任务 014 会整个重写这个文件。现在每个负重轮架只有一个方块和两个单轮,诱导轮、主动轮是现成零件。
 * 会转的车轮和履带板用 runningGear(注册在 root 下);负重轮架、弹簧、托带轮支架这些不转的部分加到 H。
 */
export function buildSuspension(L: ShermanLayout, kit: ModelKit, root: THREE.Object3D, H: GeoBatch, C: Palette): void {
  const { ground, track, sprocket, bogieZ } = L;
  const T = track.thickness;
  const hvss = L.variant.suspension === 'hvss';
  const wheelR = hvss ? 0.26 : 0.254;
  const wheelY = ground + T + wheelR;
  const half = hvss ? 0.3 : 0.265;
  const wc = { face: C.paint, rim: C.rubber, hub: C.shade, tyre: C.rubber, spoke: C.deep };
  runningGear(kit, root, { x: track.x, width: track.width, thickness: T, pitch: track.pitch, color: C.track }, [
    {
      geo: rubberRoadWheel(wheelR, hvss ? 0.4 : 0.23, wc),
      radius: wheelR,
      wheels: bogieZ.flatMap((z) => [z - half, z + half]).map((z) => ({ x: track.x, y: wheelY, z })),
    },
    // 托带轮:每个负重轮架后上方一个
    { geo: rubberRoadWheel(0.1, 0.2, wc, 8), radius: 0.1, wheels: bogieZ.map((z) => ({ x: track.x, y: ground + 0.86, z: z + 0.3 })) },
    { geo: toothedSprocket(sprocket.r, sprocket.teeth, 0.36, T, wc), radius: sprocket.r, teeth: sprocket.teeth, wheels: [{ x: track.x, y: sprocket.y, z: sprocket.z }] },
    {
      geo: discWheel(0.24, 0.3, { ...wc, hole: C.dark }, 6),
      radius: 0.24,
      tensioner: true,
      wheels: [{ x: track.x, y: ground + 0.38, z: bogieZ[2] + 0.85 }],
    },
  ]);
  for (const s of [-1, 1]) {
    for (const z of bogieZ) H.add(box(0.3, 0.32, 0.5), C.shade, [s * (track.x - 0.05), ground + 0.5, z]);
  }
}
