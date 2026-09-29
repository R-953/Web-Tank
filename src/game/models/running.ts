import * as THREE from 'three';
import { GeoBatch, extrude, prism, revolve, type ModelKit, type Vec2 } from './kit';

/**
 * 行走机构:负重轮 / 主动轮 / 诱导轮 + 一圈会走动的履带板。
 *
 * 侧视平面用 (z, y) 表示。履带环 = 所有车轮外圆(半径 + 半个履带厚)的凸包,
 * 按「前进时下段向 +Z 走」的方向(在 (z, y) 平面里逆时针)参数化。
 * 行驶距离 travel(前进为正):
 *   - 履带板沿环移动 travel —— 下段相对车体向后(相对地面静止),上段向前;
 *   - 车轮绕 X 轴转 -travel / 半径 —— 顶部向 -Z(前),底部向 +Z,与前进一致;
 *   - 主动轮齿数与履带节距对齐,齿始终卡在履带板之间(张紧轮前后微调使环长为整数块)。
 */

export interface WheelPos {
  /** 车轮中心的 |x|(左右对称放置) */
  x: number;
  y: number;
  z: number;
}

export interface WheelGroup {
  /** 右侧车轮几何:轴线沿 X、外侧面朝 +X、中心在原点、带顶点色;左侧自动镜像 */
  geo: THREE.BufferGeometry;
  /** 履带内表面贴合的半径(负重轮的轮缘、主动轮的节圆) */
  radius: number;
  wheels: WheelPos[];
  /** 主动轮齿数:给出时履带节距 = 节圆周长 / 齿数,齿与履带板啮合 */
  teeth?: number;
  /** 张紧轮(诱导轮):前后微调位置,让履带环长正好是整数块履带板 */
  tensioner?: boolean;
  /** 是否参与履带环轮廓(默认参与) */
  onTrack?: boolean;
}

export interface TrackSpec {
  /** 履带中心线的 |x| */
  x: number;
  width: number;
  thickness: number;
  /** 期望的履带板节距(有主动轮齿数时以齿数为准) */
  pitch: number;
  color: number;
  /** 履带板形状:'plain' 平板带防滑棱;'guide' 额外带中央诱导齿(T-34 式) */
  style?: 'plain' | 'guide';
}

interface Circle {
  z: number;
  y: number;
  r: number;
}

/** 履带环:凸包折线,按弧长取点 */
class LoopPath {
  readonly z: number[] = [];
  readonly y: number[] = [];
  readonly cum: number[] = [0];
  readonly length: number;

  constructor(circles: readonly Circle[], samples = 96) {
    const pts: Array<[number, number]> = [];
    for (const c of circles) {
      for (let k = 0; k < samples; k++) {
        const t = (k / samples) * Math.PI * 2;
        pts.push([c.z + c.r * Math.cos(t), c.y + c.r * Math.sin(t)]);
      }
    }
    // Andrew 单调链凸包:结果为逆时针(下段 z 递增 → 前进时下段向 +Z 走)
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: Array<[number, number]> = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop();
      lower.push(p);
    }
    const upper: Array<[number, number]> = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop();
      upper.push(p);
    }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    for (const [z, y] of hull) {
      this.z.push(z);
      this.y.push(y);
    }
    let s = 0;
    for (let i = 0; i < hull.length; i++) {
      const j = (i + 1) % hull.length;
      s += Math.hypot(this.z[j] - this.z[i], this.y[j] - this.y[i]);
      this.cum.push(s);
    }
    this.length = s;
  }

  at(s: number, out: { z: number; y: number }): void {
    const L = this.length;
    s = ((s % L) + L) % L;
    let lo = 0;
    let hi = this.z.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    const j = (lo + 1) % this.z.length;
    const seg = this.cum[lo + 1] - this.cum[lo];
    const t = seg > 0 ? (s - this.cum[lo]) / seg : 0;
    out.z = this.z[lo] + (this.z[j] - this.z[lo]) * t;
    out.y = this.y[lo] + (this.y[j] - this.y[lo]) * t;
  }
}

/** 默认履带板:外侧(接地面)带斜切的防滑棱,局部 +Z 为行进方向、+Y 朝履带环内侧 */
function linkGeometry(track: TrackSpec, pitch: number): THREE.BufferGeometry {
  const w = track.width;
  const T = track.thickness;
  const len = pitch * 0.9;
  const b = new GeoBatch();
  // 板体:外侧(接地面)收窄成防滑棱,板与板之间留缝
  b.add(prism(-T / 2, T / 2, { x0: -w / 2, x1: w / 2, z0: -len * 0.4, z1: len * 0.4 }, { x0: -w / 2, x1: w / 2, z0: -len / 2, z1: len / 2 }), track.color);
  if (track.style === 'guide') {
    // 中央诱导齿
    b.add(prism(T / 2, T / 2 + 0.07, { x0: -0.04, x1: 0.04, z0: -len * 0.3, z1: len * 0.3 }, { x0: -0.03, x1: 0.03, z0: -len * 0.15, z1: len * 0.15 }), track.color);
  }
  return b.build();
}

/**
 * 在 parent(车体 root)下生成两侧行走机构并注册动画。
 */
export function runningGear(kit: ModelKit, parent: THREE.Object3D, track: TrackSpec, groupsIn: readonly WheelGroup[]): void {
  const T = track.thickness;
  const groups = groupsIn.map((g) => ({ ...g, wheels: g.wheels.map((w) => ({ ...w })) }));
  const circles = () =>
    groups.filter((g) => g.onTrack !== false).flatMap((g) => g.wheels.map((w) => ({ z: w.z, y: w.y, r: g.radius + T / 2 })));

  let path = new LoopPath(circles());
  const toothed = groups.find((g) => g.teeth);
  let pitch = track.pitch;
  if (toothed?.teeth) {
    pitch = (2 * Math.PI * (toothed.radius + T / 2)) / toothed.teeth;
    const tens = groups.find((g) => g.tensioner);
    for (let iter = 0; tens && iter < 8; iter++) {
      const err = Math.round(path.length / pitch) * pitch - path.length;
      if (Math.abs(err) < 1e-5) break;
      // 张紧轮沿远离车体中心的方向移动 err / 2(上下两段各变长 err / 2)
      for (const w of tens.wheels) w.z += (Math.sign(w.z) || 1) * (err / 2);
      path = new LoopPath(circles());
    }
  }
  const count = Math.max(8, Math.round(path.length / pitch));
  pitch = path.length / count;

  // --- 履带板
  const links = kit.instancedMesh(parent, linkGeometry(track, pitch), kit.steel, count * 2);

  // --- 车轮(每组左右各一个 InstancedMesh)
  interface WheelSet {
    mesh: THREE.InstancedMesh;
    side: 0 | 1;
    radius: number;
    phase: number;
    wheels: WheelPos[];
  }
  const sets: WheelSet[] = [];
  const pin = { z: 0, y: 0 };
  for (const g of groups) {
    let phase = 0;
    if (g.teeth) {
      // 齿与履带板铰链(相邻两板的分缝)对齐:找一个落在主动轮节圆上的铰链点
      const c = g.wheels[0];
      const rc = g.radius + T / 2;
      let best = Infinity;
      for (let k = 0; k < count; k++) {
        path.at((k + 0.5) * pitch, pin);
        const d = Math.abs(Math.hypot(pin.z - c.z, pin.y - c.y) - rc);
        if (d < best) {
          best = d;
          phase = -Math.atan2(pin.y - c.y, pin.z - c.z);
        }
      }
    }
    const radius = g.teeth ? g.radius + T / 2 : g.radius;
    const right = new GeoBatch().add(g.geo, null).build();
    const left = new GeoBatch().add(g.geo, null, undefined, undefined, [-1, 1, 1]).build();
    sets.push({ mesh: kit.instancedMesh(parent, left, kit.paint, g.wheels.length), side: 0, radius, phase, wheels: g.wheels });
    sets.push({ mesh: kit.instancedMesh(parent, right, kit.paint, g.wheels.length), side: 1, radius, phase, wheels: g.wheels });
  }

  const m = new THREE.Matrix4();
  const a = { z: 0, y: 0 };
  const b = { z: 0, y: 0 };
  const last = [NaN, NaN];
  kit.onAnimate((leftTravel, rightTravel) => {
    for (const side of [0, 1] as const) {
      const t = side === 0 ? leftTravel : rightTravel;
      if (t === last[side]) continue;
      last[side] = t;
      const x = side === 0 ? -track.x : track.x;
      // 履带板:两端铰链落在环上,板体取两铰链连线(绕主动轮时呈真实的多边形折线)
      for (let i = 0; i < count; i++) {
        const s = i * pitch + t;
        path.at(s - pitch / 2, a);
        path.at(s + pitch / 2, b);
        m.makeRotationX(Math.atan2(a.y - b.y, b.z - a.z));
        m.setPosition(x, (a.y + b.y) / 2, (a.z + b.z) / 2);
        links.setMatrixAt(side * count + i, m);
      }
      links.instanceMatrix.needsUpdate = true;
      for (const set of sets) {
        if (set.side !== side) continue;
        const angle = set.phase - t / set.radius;
        set.wheels.forEach((w, i) => {
          m.makeRotationX(angle);
          m.setPosition(side === 0 ? -w.x : w.x, w.y, w.z);
          set.mesh.setMatrixAt(i, m);
        });
        set.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 车轮几何(右侧:外侧面朝 +X)
// ---------------------------------------------------------------------------

export interface WheelColors {
  face: number;
  rim: number;
  hub: number;
  tyre: number;
  /** 盘面上的深色楔形(辐板间凹坑),让转动一眼可见 */
  spoke?: number;
}

/** 德式钢缘负重轮(虎式后期 / 虎王):钢轮缘 + 内置橡胶圈 + 盘面 + 轮毂盖 */
export function steelRoadWheel(r: number, w: number, c: WheelColors, segments = 10): THREE.BufferGeometry {
  const h = w / 2;
  const profile: Vec2[] = [
    [r, -h],
    [r, h],
    [r * 0.8, h - 0.012],
    [r * 0.36, h + 0.01],
    [r * 0.22, h + 0.06],
  ];
  const stripes = c.spoke === undefined ? undefined : [{ band: 2, color: c.spoke, every: 2 }];
  return revolve(profile, 'x', segments, { colors: [c.rim, c.hub, c.face, c.hub], startCap: c.face, endCap: c.hub, stripes }, Math.PI / segments);
}

/** 挂胶负重轮(T-34):粗橡胶轮胎 + 凹进去的盘面 + 轮毂 */
export function rubberRoadWheel(r: number, w: number, c: WheelColors, segments = 12): THREE.BufferGeometry {
  const h = w / 2;
  const profile: Vec2[] = [
    [r, -h],
    [r * 0.97, h],
    [r * 0.76, h - 0.04],
    [r * 0.3, h - 0.015],
    [r * 0.2, h + 0.045],
  ];
  const stripes = c.spoke === undefined ? undefined : [{ band: 2, color: c.spoke, every: 2 }];
  return revolve(profile, 'x', segments, { colors: [c.tyre, c.tyre, c.face, c.hub], startCap: c.tyre, endCap: c.hub, stripes }, Math.PI / segments);
}

/**
 * 带齿主动轮:外侧齿圈(teeth 个齿,第 0 个齿在 (z, y) 平面 +Z 方向)+ 轮体 + 轮毂。
 * r 为节圆半径(履带内表面贴合处),齿尖伸进履带板之间。
 */
export function toothedSprocket(r: number, teeth: number, w: number, T: number, c: WheelColors): THREE.BufferGeometry {
  const b = new GeoBatch();
  const outline: Vec2[] = [];
  const step = (Math.PI * 2) / teeth;
  const tip = r + T * 0.85;
  const root = r - 0.03;
  for (let k = 0; k < teeth; k++) {
    const a = k * step;
    outline.push([tip * Math.cos(a), tip * Math.sin(a)]);
    outline.push([root * Math.cos(a + step / 2), root * Math.sin(a + step / 2)]);
  }
  const h = w / 2;
  // 外侧齿圈(内侧齿圈被履带和车体挡住,省略)
  b.add(extrude(outline, 'x', h - 0.08, h, c.rim), null);
  // 轮鼓 + 外侧盘面 + 轮毂
  b.add(
    revolve(
      [
        [r * 0.9, -h],
        [r * 0.9, h - 0.08],
        [r * 0.4, h + 0.03],
        [r * 0.28, h + 0.1],
        [r * 0.15, h + 0.12],
      ],
      'x',
      10,
      { colors: [c.face, c.face, c.hub, c.hub] },
    ),
    null,
  );
  return b.build();
}

/** 盘式诱导轮 / 主动轮(无齿):轮缘 + 带减重孔的盘面 + 轮毂 */
export function discWheel(r: number, w: number, c: WheelColors & { hole: number }, holes = 5, segments = 10): THREE.BufferGeometry {
  const h = w / 2;
  const b = new GeoBatch();
  b.add(
    revolve(
      [
        [r, -h],
        [r, h],
        [r * 0.84, h],
        [r * 0.8, h - 0.03],
        [r * 0.34, h - 0.02],
        [r * 0.24, h + 0.05],
      ],
      'x',
      segments,
      { colors: [c.rim, c.rim, c.face, c.face, c.hub], startCap: c.face, endCap: c.hub },
      Math.PI / segments,
    ),
    null,
  );
  // 减重孔(深色小盘贴在盘面上,转动时一眼能看出来)
  const hole = revolve(
    [
      [r * 0.13, 0],
      [r * 0.13, 0.03],
    ],
    'x',
    6,
    { startCap: null },
  );
  for (let k = 0; k < holes; k++) {
    const a = (k / holes) * Math.PI * 2;
    b.add(hole, c.hole, [h - 0.045, r * 0.56 * Math.sin(a), r * 0.56 * Math.cos(a)]);
  }
  return b.build();
}
