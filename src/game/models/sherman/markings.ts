import * as THREE from 'three';
import { DEG, type GeoBatch, type Palette, type Tuple3 } from '../kit';
import type { ShermanLayout } from './layout';

/**
 * 平光暖白漆颜色(二战美军标识使用平光白漆 Lusterless White,
 * 略带暖调避免纯白在场景中过度刺眼, 模拟平光漆质感)。
 */
export const STAR_COLOR = 0xede8dc;

/** 辅助生成三维点坐标 */
type V3 = [number, number, number];

/**
 * 在任意指定基底平面生成平面的五角星网格:
 * - center: 五角星几何中心(已包含法线方向 5 mm 偏移)
 * - uAxis: 本地横向单位向量
 * - vAxis: 本地纵向单位向量(顶角方向)
 * - radius: 外接圆半径
 */
function createPlanarStar(
  center: Tuple3,
  uAxis: Tuple3,
  vAxis: Tuple3,
  radius: number,
  invertWinding = false,
): THREE.BufferGeometry {
  const innerR = radius * 0.382; // 0.381966... 黄金分割比内尖半径
  const positions: number[] = [];

  // 计算 10 个外沿顶点的 (u, v) 偏移(顶点 0 在正上方 v 方向)
  const pts: Array<[number, number]> = [];
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 === 0 ? radius : innerR;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }

  const toWorld = (u: number, v: number): V3 => [
    center[0] + u * uAxis[0] + v * vAxis[0],
    center[1] + u * uAxis[1] + v * vAxis[1],
    center[2] + u * uAxis[2] + v * vAxis[2],
  ];

  const cWorld = center;

  // 生成 10 个三角形扇面
  for (let k = 0; k < 10; k++) {
    const kNext = (k + 1) % 10;
    const p1 = toWorld(pts[k][0], pts[k][1]);
    const p2 = toWorld(pts[kNext][0], pts[kNext][1]);

    if (invertWinding) {
      positions.push(cWorld[0], cWorld[1], cWorld[2], p2[0], p2[1], p2[2], p1[0], p1[1], p1[2]);
    } else {
      positions.push(cWorld[0], cWorld[1], cWorld[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 在任意指定基底平面生成对空识别星圆环:
 * segments 段, 每段 2 个三角形(共 32 个面)。
 */
function createPlanarRing(
  center: Tuple3,
  uAxis: Tuple3,
  vAxis: Tuple3,
  innerR: number,
  outerR: number,
  segments = 16,
): THREE.BufferGeometry {
  const positions: number[] = [];

  const toWorld = (u: number, v: number): V3 => [
    center[0] + u * uAxis[0] + v * vAxis[0],
    center[1] + u * uAxis[1] + v * vAxis[1],
    center[2] + u * uAxis[2] + v * vAxis[2],
  ];

  for (let k = 0; k < segments; k++) {
    const a0 = (k * 2 * Math.PI) / segments;
    const a1 = ((k + 1) * 2 * Math.PI) / segments;

    const in0 = toWorld(innerR * Math.cos(a0), innerR * Math.sin(a0));
    const in1 = toWorld(innerR * Math.cos(a1), innerR * Math.sin(a1));
    const out0 = toWorld(outerR * Math.cos(a0), outerR * Math.sin(a0));
    const out1 = toWorld(outerR * Math.cos(a1), outerR * Math.sin(a1));

    // (in0, out0, out1)
    positions.push(...in0, ...out0, ...out1);
    // (in0, out1, in1)
    positions.push(...in0, ...out1, ...in1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 谢尔曼的白星等标识:贴在车体 / 炮塔表面外 5 mm 处的平面多边形,顶点色,不参与碰撞和伤害判定。
 *
 * 标识布设(依据 AR 850-5 与 1944–45 年 ETO 历史照片):
 * 1. 车体两侧白星: 贴在两侧上部车体(或 E2 附加装甲板)外侧 5 mm 处。
 * 2. 对空识别星(带圆环): 贴在发动机舱盖上方 5 mm 处。
 * 3. 首上白星: 贴在 47° 倾斜首上装甲外侧 5 mm 处(76W 与 E8 有; E2 按史料首上不刷白星避免敌方瞄准)。
 *
 * 合计三角面 ≤ 300 面(每颗星 10 面, 圆环 32 面, 每辆车 62~72 面)。
 */
export function buildShermanMarkings(L: ShermanLayout, H: GeoBatch, _T: GeoBatch, _C: Palette): void {
  const OFFSET = 0.005; // 贴在表面外侧 5 mm

  // =========================================================================
  // 1. 车体两侧白星(三辆车均有)
  // =========================================================================
  // 外表面 |x|: 标准车体为 upperHalfW, E2 为 upperHalfW + applique
  const sideFaceDist = L.upperHalfW + L.applique;
  const isJumbo = L.variant.applique;

  // 侧面五角星几何参数(半径 0.20 m ≈ 直径 16 英寸)
  const sideStarRadius = 0.20;

  // 垂直与纵向位置:
  // E2 贴在侧面附加装甲长方块中心
  // 76W 与 E8 贴在上部车体垂直侧板中心
  const glacisSponsonZ = L.glacisZ(L.sponsonY);
  const sideMidY = isJumbo ? L.sponsonY + 0.04 + (L.top - L.sponsonY - 0.08) / 2 : (L.sponsonY + L.top) / 2;
  const sideMidZ = isJumbo
    ? (glacisSponsonZ + 0.35 + L.bogieZ[2] + 0.35) / 2
    : (glacisSponsonZ + L.rearZ) / 2;

  // 1.1 左侧车体白星(法线朝 -X)
  // u 沿 +Z(后), v 沿 +Y(上), u × v = -X(外法线朝左)
  const leftCenter: Tuple3 = [- (sideFaceDist + OFFSET), sideMidY, sideMidZ];
  H.add(createPlanarStar(leftCenter, [0, 0, 1], [0, 1, 0], sideStarRadius), STAR_COLOR);

  // 1.2 右侧车体白星(法线朝 +X)
  // u 沿 -Z(前), v 沿 +Y(上), u × v = +X(外法线朝右)
  const rightCenter: Tuple3 = [sideFaceDist + OFFSET, sideMidY, sideMidZ];
  H.add(createPlanarStar(rightCenter, [0, 0, -1], [0, 1, 0], sideStarRadius), STAR_COLOR);

  // =========================================================================
  // 2. 发动机舱盖对空识别星(带圆环, 三辆车均有)
  // =========================================================================
  // 表面高度为 L.top, 抬升 5 mm
  // u 沿 +X(右), v 沿 -Z(前), u × v = +Y(外法线朝上)
  const deckCenter: Tuple3 = [0, L.top + OFFSET, 1.62];
  const aerialStarR = 0.28;
  const ringInnerR = 0.32;
  const ringOuterR = 0.38;

  H.add(createPlanarStar(deckCenter, [1, 0, 0], [0, 0, -1], aerialStarR), STAR_COLOR);
  H.add(createPlanarRing(deckCenter, [1, 0, 0], [0, 0, -1], ringInnerR, ringOuterR, 16), STAR_COLOR);

  // =========================================================================
  // 3. 首上白星(M4A3(76)W 与 M4A3E8 有, M4A3E2 Jumbo 无)
  // =========================================================================
  if (!isJumbo) {
    const starR = 0.17; // 直径约 13.5 英寸
    const y0 = L.sponsonY + 0.48;
    const z0 = L.glacisZ(y0);

    // 47° 首上外法线向量 N = (0, sin 47°, -cos 47°)
    // 沿斜坡向上向量 V = (0, cos 47°, sin 47°)
    // 横向向右向量 U = (1, 0, 0)
    // 注意: U × V = (0, -sin 47°, cos 47°) = -N
    // 为了使法线朝向外侧 N, 取 invertWinding = true, 或互换两轴
    const sin47 = Math.sin(47 * DEG);
    const cos47 = Math.cos(47 * DEG);

    const normalOffset = L.applique + OFFSET;
    const glacisCenter: Tuple3 = [
      0,
      y0 + normalOffset * sin47,
      z0 - normalOffset * cos47,
    ];

    H.add(
      createPlanarStar(
        glacisCenter,
        [1, 0, 0],
        [0, cos47, sin47],
        starR,
        true, // invertWinding 使得法线沿 N 朝外
      ),
      STAR_COLOR,
    );
  }
}
