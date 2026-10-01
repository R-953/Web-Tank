import type * as THREE from 'three';
import { bothSides, box, cyl, GeoBatch, rod, tube, wheel, type ModelKit, type Palette } from '../kit';
import { discWheel, rubberRoadWheel, runningGear, toothedSprocket } from '../running';
import type { ShermanLayout } from './layout';

/**
 * 谢尔曼行走机构:
 *   - VVSS(垂直螺旋弹簧):M4A3(76)W、M4A3E2(Jumbo)使用
 *     每侧 3 个负重轮架,每个架 2 个单负重轮(20 in / 0.508 m,冲压辐板挂胶轮);
 *     外侧可见竖直螺旋弹簧与两根摆臂;每个负重轮架后上方设 1 个托带轮;后置单诱导轮;
 *     T48 橡胶履带(平履带板,VVSS 无现成外侧诱导齿样式,用 'plain')。
 *   - HVSS(水平螺旋弹簧):M4A3E8(Easy Eight)使用
 *     每侧 3 个负重轮架,每个架 2 对双负重轮(20.5 in / 0.52 m 挂胶轮,两片之间留诱导齿缝隙);
 *     两对轮之间设 1 根水平螺旋弹簧,每个架设 1 根斜置减震器;
 *     每侧 2 个双托带轮(装在负重轮架之间车体侧面)+ 3 个单托带轮(装在负重轮架上方车体侧面);
 *     后置双诱导轮;T66 履带(带中央诱导齿 'guide')。
 */
export function buildSuspension(L: ShermanLayout, kit: ModelKit, root: THREE.Object3D, H: GeoBatch, C: Palette): void {
  const { ground, track, sprocket, bogieZ, lowerHalfW } = L;
  const T = track.thickness;
  const hvss = L.variant.suspension === 'hvss';
  const wc = { face: C.paint, rim: C.rubber, hub: C.shade, tyre: C.rubber, spoke: C.deep };

  // 诱导轮与后部张紧轮位置(初始 z 设在 2.41,配合 runningGear 张紧微调锁定 79 块履带板)
  const idlerZ = bogieZ[2] + 0.85;
  const idlerY = ground + 0.38;

  if (!hvss) {
    // =========================================================================
    // VVSS (垂直螺旋弹簧悬挂)
    // =========================================================================
    const wheelR = 0.254; // 直径 20 in
    const wheelW = 0.23; // 宽约 9 in
    const wheelY = ground + T + wheelR;
    const half = 0.265; // 每个轮架前后两轮半间距
    const rollerR = 0.1;
    const rollerW = 0.16;
    const rollerY = ground + 0.86;
    const idlerR = 0.25;
    const idlerW = 0.26;

    // 旋转部件:单负重轮、后置托带轮、主动轮、诱导轮、履带板
    runningGear(
      kit,
      root,
      { x: track.x, width: track.width, thickness: T, pitch: track.pitch, color: C.track, style: 'plain' },
      [
        {
          geo: rubberRoadWheel(wheelR, wheelW, wc, 8),
          radius: wheelR,
          wheels: bogieZ.flatMap((z) => [z - half, z + half]).map((z) => ({ x: track.x, y: wheelY, z })),
        },
        // 托带轮:每个负重轮架后上方一个(装在轮架伸出的支架上)
        {
          geo: rubberRoadWheel(rollerR, rollerW, { face: C.shade, rim: C.rubber, hub: C.deep, tyre: C.rubber }, 6),
          radius: rollerR,
          wheels: bogieZ.map((z) => ({ x: track.x, y: rollerY, z: z + 0.29 })),
        },
        {
          geo: toothedSprocket(sprocket.r, sprocket.teeth, 0.36, T, wc),
          radius: sprocket.r,
          teeth: sprocket.teeth,
          wheels: [{ x: track.x, y: sprocket.y, z: sprocket.z }],
        },
        {
          geo: discWheel(idlerR, idlerW, { ...wc, hole: C.dark }, 6, 8),
          radius: idlerR,
          tensioner: true,
          wheels: [{ x: track.x, y: idlerY, z: idlerZ }],
        },
      ],
    );

    // 非旋转部件:负重轮架、竖直螺旋弹簧、摆臂、托带轮支架、主动轮与诱导轮支架
    const bracketW = Math.max(0.08, track.x - 0.08 - lowerHalfW);
    const bracketCenterX = lowerHalfW + bracketW / 2 + 0.005;

    bothSides((s) => {
      // 主动轮终传动壳
      const sprMountW = Math.max(0.06, track.x - 0.18 - lowerHalfW);
      H.add(box(sprMountW, 0.22, 0.22), C.shade, [s * (lowerHalfW + sprMountW / 2 + 0.005), sprocket.y, sprocket.z]);

      // 诱导轮张紧曲柄与支架
      H.add(rod([s * (lowerHalfW + 0.04), ground + 0.44, bogieZ[2] + 0.55], [s * track.x, idlerY, idlerZ], 0.035, 4), C.shade);

      for (const z of bogieZ) {
        // 1. 负重轮架主体(紧贴车体侧壁 lowerHalfW,向外延伸至车轮内缘)
        H.add(box(bracketW, 0.28, 0.36), C.shade, [s * bracketCenterX, ground + 0.54, z]);

        // 2. 负重轮架顶部铸造外壳(横跨车轮上方)
        H.add(box(0.24, 0.1, 0.42), C.paint, [s * track.x, ground + 0.67, z]);

        // 3. 竖直螺旋弹簧(VVSS 标志:外侧可见两个立式弹簧)
        const springX = s * (track.x + 0.095);
        H.add(cyl(0.045, 0.045, 0.18, 6), C.deep, [springX, ground + 0.56, z - 0.09]);
        H.add(cyl(0.045, 0.045, 0.18, 6), C.deep, [springX, ground + 0.56, z + 0.09]);
        // 弹簧顶盖
        H.add(box(0.06, 0.025, 0.26), C.shade, [springX, ground + 0.66, z]);

        // 4. 两根摆臂(从中心支点向下分别连至前后负重轮轴心)
        const pivotX = s * (track.x + 0.08);
        H.add(rod([pivotX, ground + 0.48, z], [pivotX, wheelY, z - half], 0.03, 4), C.shade);
        H.add(rod([pivotX, ground + 0.48, z], [pivotX, wheelY, z + half], 0.03, 4), C.shade);

        // 5. 托带轮支架(从负重轮架后上方斜向伸出至托带轮轴心)
        H.add(rod([s * (track.x - 0.02), ground + 0.72, z + 0.12], [s * track.x, rollerY, z + 0.29], 0.028, 4), C.shade);
      }
    });
  } else {
    // =========================================================================
    // HVSS (水平螺旋弹簧悬挂)
    // =========================================================================
    const wheelR = 0.26; // 直径约 20.5 in
    const wheelY = ground + T + wheelR;
    const half = 0.3; // 前后两对双轮半间距
    const rollerR = 0.09;
    const rollerY = ground + 0.86;
    const idlerR = 0.26;

    // 双负重轮:两片挂胶轮夹着中央诱导齿缝隙(4 分段控制全系统总三角面在 6,000 以内)
    const roadDisc = rubberRoadWheel(wheelR, 0.13, wc, 4);
    const twinRoadWheel = new GeoBatch()
      .add(roadDisc, null, [0.12, 0, 0])
      .add(roadDisc, null, [-0.12, 0, 0], undefined, [-1, 1, 1])
      .build();

    // 单托带轮(装在 3 个负重轮架正上方车体侧面)
    const singleRoller = wheel(rollerR, 0.13, 4);

    // 双托带轮(装在负重轮架之间的车体侧面,跨过中央诱导齿)
    const rollerHalf = wheel(rollerR, 0.08, 4);
    const twinRoller = new GeoBatch()
      .add(rollerHalf, C.shade, [0.1, 0, 0])
      .add(rollerHalf, C.shade, [-0.1, 0, 0])
      .build();

    // 双诱导轮(4 分段盘面)
    const idlerDisc = discWheel(idlerR, 0.13, { ...wc, hole: C.dark }, 0, 4);
    const twinIdler = new GeoBatch()
      .add(idlerDisc, null, [0.12, 0, 0])
      .add(idlerDisc, null, [-0.12, 0, 0], undefined, [-1, 1, 1])
      .build();

    // 两个双托带轮的 z 位置(介于 bogie 0-1 与 1-2 之间)
    const midRollerZ = [(bogieZ[0] + bogieZ[1]) / 2, (bogieZ[1] + bogieZ[2]) / 2];

    runningGear(
      kit,
      root,
      { x: track.x, width: track.width, thickness: T, pitch: track.pitch, color: C.track, style: 'guide' },
      [
        {
          geo: twinRoadWheel,
          radius: wheelR,
          wheels: bogieZ.flatMap((z) => [z - half, z + half]).map((z) => ({ x: track.x, y: wheelY, z })),
        },
        // 3 个单托带轮:装在负重轮架上方车体侧面
        {
          geo: singleRoller,
          radius: rollerR,
          wheels: bogieZ.map((z) => ({ x: track.x, y: rollerY, z })),
        },
        // 2 个双托带轮:装在负重轮架之间车体侧面
        {
          geo: twinRoller,
          radius: rollerR,
          wheels: midRollerZ.map((z) => ({ x: track.x, y: rollerY, z })),
        },
        {
          geo: toothedSprocket(sprocket.r, sprocket.teeth, 0.42, T, wc),
          radius: sprocket.r,
          teeth: sprocket.teeth,
          wheels: [{ x: track.x, y: sprocket.y, z: sprocket.z }],
        },
        {
          geo: twinIdler,
          radius: idlerR,
          tensioner: true,
          wheels: [{ x: track.x, y: idlerY, z: idlerZ }],
        },
      ],
    );

    // 非旋转部件:HVSS 轮架、横置水平螺旋弹簧、斜置减震器、摆臂、托带轮支架
    const bracketW = Math.max(0.08, track.x - 0.14 - lowerHalfW);
    const bracketCenterX = lowerHalfW + bracketW / 2 + 0.005;

    bothSides((s) => {
      // 主动轮终传动壳
      const sprMountW = Math.max(0.06, track.x - 0.22 - lowerHalfW);
      H.add(box(sprMountW, 0.22, 0.22), C.shade, [s * (lowerHalfW + sprMountW / 2 + 0.005), sprocket.y, sprocket.z]);

      // 诱导轮支架
      H.add(rod([s * (lowerHalfW + 0.04), ground + 0.44, bogieZ[2] + 0.55], [s * track.x, idlerY, idlerZ], 0.035, 3), C.shade);

      for (const z of bogieZ) {
        // 1. 负重轮架安装座(装在下部车体侧面 lowerHalfW 上)
        H.add(box(bracketW, 0.26, 0.44), C.shade, [s * bracketCenterX, ground + 0.53, z]);

        // 2. 水平螺旋弹簧(HVSS 核心特征:两对双轮之间的水平弹簧筒)
        H.add(tube(0.055, 0.055, 0.16, -0.16, 4), C.deep, [s * (track.x + 0.02), ground + 0.54, z]);

        // 3. 斜置减震器(每个架 1 个斜置筒)
        H.add(rod([s * (track.x + 0.08), ground + 0.66, z - 0.15], [s * (track.x + 0.08), ground + 0.44, z + 0.15], 0.022, 3), C.steel);

        // 4. 摆臂
        const pivotX = s * (track.x + 0.06);
        H.add(rod([pivotX, ground + 0.5, z - 0.08], [pivotX, wheelY, z - half], 0.028, 3), C.shade);
        H.add(rod([pivotX, ground + 0.5, z + 0.08], [pivotX, wheelY, z + half], 0.028, 3), C.shade);

        // 单托带轮支架
        H.add(rod([s * (lowerHalfW + 0.02), rollerY, z], [s * (track.x - 0.06), rollerY, z], 0.025, 3), C.shade);
      }

      // 车体侧面 2 个双托带轮支架
      for (const z of midRollerZ) {
        H.add(rod([s * (lowerHalfW + 0.02), rollerY, z], [s * (track.x - 0.1), rollerY, z], 0.028, 3), C.shade);
      }
    });
  }
}
