import * as THREE from 'three';
import { GeoBatch, box, extrude, revolve, rod, type Palette, type Tuple3, type Vec2 } from './kit';

/*
 * 通用小零件。每个函数返回一个带顶点色的「组件」几何(局部坐标),
 * 调用方用 batch.add(geo, null, 位置, 旋转) 摆放。
 */

/** 潜望镜:装甲罩 + 深色镜面(镜面朝局部 -Z),底面在 y = 0 */
export function periscope(c: Palette, w = 0.16, h = 0.09, d = 0.12): THREE.BufferGeometry {
  return new GeoBatch()
    .add(box(w, h, d), c.shade, [0, h / 2, 0])
    .add(box(w + 0.02, 0.02, d + 0.04), c.shade, [0, h + 0.01, -0.01])
    .add(box(w * 0.8, h * 0.45, 0.02), c.dark, [0, h * 0.45, -d / 2 - 0.004])
    .build();
}

/** 圆形舱盖:盖板 + 边缘斜面 + 铰链 + 把手,底面在 y = 0(铰链在 +Z 一侧) */
export function roundHatch(c: Palette, r: number, t = 0.05, color = c.paint): THREE.BufferGeometry {
  return new GeoBatch()
    .add(revolve([[r, 0], [r, t * 0.6], [r * 0.9, t]], 'y', 10, { colors: [color, color], startCap: null }), null)
    .add(box(r * 0.9, t * 0.8, 0.1), c.shade, [0, t * 0.4, r * 0.95])
    .add(box(0.16, 0.03, 0.03), c.steel, [0, t + 0.015, -r * 0.5])
    .build();
}

/** 矩形舱盖(带铰链),底面在 y = 0 */
export function rectHatch(c: Palette, w: number, l: number, t = 0.05, color = c.paint): THREE.BufferGeometry {
  return new GeoBatch()
    .add(box(w, t, l), color, [0, t / 2, 0])
    .add(box(w - 0.06, 0.02, l - 0.06), c.shade, [0, t + 0.01, 0])
    .add(box(w * 0.9, t * 0.8, 0.08), c.shade, [0, t * 0.4, l / 2 + 0.03])
    .build();
}

/** 散热格栅:外框 + 深色网孔 + 横向百叶,底面在 y = 0,百叶沿 X */
export function grille(c: Palette, w: number, l: number, slats = 4, frame = c.shade): THREE.BufferGeometry {
  const b = new GeoBatch();
  const ft = 0.06;
  // 外框(整块)上面盖一块略小的深色网面,网面四周露出一圈外框
  b.add(box(w, 0.035, l), frame, [0, 0.0175, 0]);
  b.add(box(w - 2 * ft, 0.01, l - 2 * ft), c.dark, [0, 0.04, 0]);
  const inner = l - 2 * ft;
  for (let i = 0; i < slats; i++) {
    const z = -inner / 2 + ((i + 0.5) / slats) * inner;
    b.add(box(w - 2 * ft, 0.03, 0.04), c.deep, [0, 0.05, z]);
  }
  return b.build();
}

/** 圆形风扇格栅:环形外框 + 深色网面 + 十字撑条,底面在 y = 0 */
export function fanGrille(c: Palette, r: number): THREE.BufferGeometry {
  return new GeoBatch()
    .add(revolve([[r, 0], [r, 0.035]], 'y', 10, { colors: [c.shade], startCap: null }), null)
    .add(revolve([[r - 0.05, 0], [r - 0.05, 0.045]], 'y', 10, { colors: [c.dark], startCap: null }), null)
    .add(box((r - 0.05) * 2, 0.03, 0.045), c.deep, [0, 0.05, 0])
    .add(box(0.045, 0.03, (r - 0.05) * 2), c.deep, [0, 0.05, 0])
    .build();
}

/**
 * 双室炮口制退器(88 炮):从 z = 0 向 -Z 延伸 len,两侧开深色导气孔,炮口端面为深色膛口。
 */
export function doubleBaffleBrake(c: Palette, len: number, r: number, rBarrel: number, color = c.shade): THREE.BufferGeometry {
  const a = len * 0.44; // 后室长
  const gap = len * 0.12;
  const b = new GeoBatch();
  const p: Vec2[] = [
    [rBarrel, 0.02],
    [r, 0],
    [r, -a],
    [r * 0.78, -a - 0.015],
    [r * 0.78, -a - gap + 0.015],
    [r, -a - gap],
    [r, -len + 0.02],
    [r * 0.9, -len],
  ];
  b.add(revolve(p, 'z', 8, { colors: [color], endCap: c.dark }), null);
  // 两侧导气孔
  for (const s of [-1, 1]) {
    b.add(box(0.05, r * 1.05, a * 0.75), c.dark, [s * (r - 0.02), 0, -a / 2]);
    b.add(box(0.05, r * 1.05, (len - a - gap) * 0.75), c.dark, [s * (r - 0.02), 0, -a - gap - (len - a - gap) / 2]);
  }
  return b.build();
}

/**
 * 德式后期铸造指挥塔(虎式后期 / 虎王):矮圆筒 + 7 具潜望镜 + 顶部舱盖 + 防空机枪环。
 * 原点在塔底中心,base 为塔底埋入炮塔顶的深度。
 */
export function lateCupola(c: Palette, r = 0.37, base = 0.06): THREE.BufferGeometry {
  const b = new GeoBatch();
  b.add(
    revolve(
      [
        [r + 0.02, -base],
        [r + 0.02, 0.08],
        [r - 0.03, 0.19],
        [r - 0.01, 0.2],
        [r - 0.02, 0.24],
      ],
      'y',
      12,
      { colors: [c.paint, c.shade, c.paint, c.paint] },
    ),
    null,
  );
  // 7 具潜望镜,埋在顶沿下
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + Math.PI / 2;
    const rr = r - 0.02;
    b.add(box(0.13, 0.065, 0.06), c.dark, [rr * Math.cos(a), 0.14, rr * Math.sin(a)], [0, Math.PI / 2 - a, 0]);
  }
  // 舱盖(旋转式,略偏后)
  b.add(revolve([[r - 0.06, 0.24], [r - 0.06, 0.27], [r - 0.12, 0.29]], 'y', 10, { colors: [c.paint, c.paint] }), null, [0, 0, 0.02]);
  b.add(box(0.1, 0.05, 0.1), c.shade, [0, 0.27, r - 0.08]);
  // 防空机枪环
  b.add(revolve([[r - 0.03, 0.235], [r + 0.04, 0.235], [r + 0.04, 0.255], [r - 0.03, 0.255], [r - 0.03, 0.235]], 'y', 10, { colors: [c.steel], startCap: null, endCap: null }), null);
  return b.build();
}

/** 车头大灯:灯座 + 灯筒(朝 -Z)+ 浅色灯玻璃,原点在灯座底 */
export function headlight(c: Palette, r = 0.09): THREE.BufferGeometry {
  return new GeoBatch()
    .add(box(0.05, 0.1, 0.05), c.steel, [0, 0.05, 0])
    .add(revolve([[r * 0.5, r + 0.04], [r, 0.02], [r, -0.06], [r * 0.9, -0.07]], 'z', 8, { colors: [c.steel, c.steel, c.steel], endCap: c.lens }), null, [0, 0.1 + r, 0])
    .build();
}

/** 备用履带板(平贴在装甲上):板宽 w 沿 X,长 l 沿 Z,厚度方向为 +Y */
export function spareLink(c: Palette, w: number, l: number): THREE.BufferGeometry {
  return new GeoBatch().add(box(w, 0.04, l), c.track, [0, 0.02, 0]).build();
}

/** 铁锹:木柄沿 -Z,锹头在 -Z 端,平放(厚度方向 X) */
export function shovel(c: Palette, len = 1.0): THREE.BufferGeometry {
  return new GeoBatch()
    .add(rod([0, 0, 0], [0, 0, -len * 0.72], 0.022, 5), c.wood)
    .add(box(0.025, 0.2, len * 0.28), c.steel, [0, 0, -len * 0.86])
    .add(box(0.03, 0.12, 0.04), c.steel, [0, 0, 0.02])
    .build();
}

/** 斧子 / 大锤:木柄沿 -Z,头部在 -Z 端 */
export function axe(c: Palette, len = 0.85, hammer = false): THREE.BufferGeometry {
  return new GeoBatch()
    .add(rod([0, 0, 0], [0, 0, -len], 0.022, 5), c.wood)
    .add(hammer ? box(0.08, 0.2, 0.08) : box(0.03, 0.2, 0.12), c.steel, [0, hammer ? 0 : 0.04, -len + 0.04])
    .build();
}

/** 两股拖车钢缆(沿 a→b),两端带钢缆眼,间距 gap 沿 up 方向 */
export function towCables(c: Palette, a: Tuple3, b: Tuple3, up: Tuple3, gap = 0.07): THREE.BufferGeometry {
  const g = new GeoBatch();
  for (let k = 0; k < 2; k++) {
    const o = k * gap;
    const pa: Tuple3 = [a[0] + up[0] * o, a[1] + up[1] * o, a[2] + up[2] * o];
    const pb: Tuple3 = [b[0] + up[0] * o, b[1] + up[1] * o, b[2] + up[2] * o];
    g.add(rod(pa, pb, 0.024, 5), c.steel);
  }
  // 钢缆眼 + 卡箍
  const eye = (p: Tuple3) => g.add(box(0.05, gap + 0.08, 0.12), c.steel, [p[0] + up[0] * gap * 0.5, p[1] + up[1] * gap * 0.5, p[2] + up[2] * gap * 0.5]);
  eye(a);
  eye(b);
  const mid: Tuple3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  eye(mid);
  return g.build();
}

/** 拖车钩 / 耳板:侧视轮廓沿 X 拉伸,带深色钩孔 */
export function towLug(c: Palette, outline: readonly Vec2[], x0: number, x1: number, hole: Vec2, holeR = 0.06): THREE.BufferGeometry {
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  return new GeoBatch()
    .add(extrude(outline, 'x', lo, hi), c.paint)
    .add(revolve([[holeR, lo - 0.005], [holeR, hi + 0.005]], 'x', 6), c.dark, [0, hole[1], hole[0]])
    .build();
}
