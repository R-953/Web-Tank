import * as THREE from 'three';
import type { InternalsSnapshot } from '../game/internalsSnapshot';

/** 模块种类轮廓颜色 */
export const MODULE_TYPE_COLORS: Record<string, number> = {
  ammo: 0xffaa00, // 弹药架: 橙黄
  engine: 0x33b5e5, // 发动机: 亮蓝
  transmission: 0xab47bc, // 变速箱: 紫色
  fuel: 0xff4081, // 油箱: 玫红
  breech: 0xe0e0e0, // 炮闩: 银灰
  traverse: 0x00e676, // 方向机: 翠绿
  elevation: 0x00e5ff, // 高低机: 青色
  barrel: 0x78909c, // 炮管: 蓝灰
  track: 0x8d6e63, // 履带: 棕褐
};

/** 血量比例 → 颜色(与 WT 的 X 光视图习惯一致:绿 → 黄 → 橙 → 黑,InternalsView 兼容导出) */
export function healthColor(ratio: number): number {
  if (ratio <= 0) return 0x1a1a1a;
  if (ratio < 0.5) return 0xf07b1e;
  if (ratio < 1) return 0xf0d23a;
  return 0x3ecf5a;
}

/**
 * 模块颜色:完好 = 类型色,血量比例 < 1 时按 (1 - 比例) 向红色 0xff3b30 插值,<= 0 = 0x1a1a1a
 */
export function killcamModuleColor(type: string, ratio: number): number {
  if (ratio <= 0) return 0x1a1a1a;
  const baseHex = MODULE_TYPE_COLORS[type] ?? 0xffffff;
  if (ratio >= 1) return baseHex;
  const c = new THREE.Color(baseHex);
  const red = new THREE.Color(0xff3b30);
  c.lerp(red, 1 - ratio);
  return c.getHex();
}

/**
 * 乘员颜色:完好 0x9fb6c7,血量比例 < 1 时向红色 0xff3b30 插值,<= 0 = 0x1a1a1a
 */
export function killcamCrewColor(ratio: number): number {
  if (ratio <= 0) return 0x1a1a1a;
  if (ratio >= 1) return 0x9fb6c7;
  const c = new THREE.Color(0x9fb6c7);
  const red = new THREE.Color(0xff3b30);
  c.lerp(red, 1 - ratio);
  return c.getHex();
}

/**
 * 坐姿人形乘员模型(纯几何,无 WebGL 依赖),总高约 1.0 m(坐姿):
 * 头 SphereGeometry(0.11)、躯干 BoxGeometry(0.34, 0.5, 0.22)、
 * 两条大腿 BoxGeometry(0.14, 0.14, 0.45) 向前(-Z)、两条小腿 BoxGeometry(0.12, 0.45, 0.12) 向下;
 * 每个部件一层半透明材质(共用一个材质方便改色) + EdgesGeometry 轮廓线;
 * 颜色:完好 0x9fb6c7(轮廓橙 0xff9a2e), ratio < 1 向红色插值, <= 0 近黑。
 */
export function buildCrewFigure(opts?: { opacity?: number; edges?: boolean }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'crew-figure';

  const bodyMat = new THREE.MeshBasicMaterial({
    color: 0x9fb6c7,
    transparent: true,
    opacity: opts?.opacity ?? 0.9,
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xff9a2e,
    transparent: true,
    opacity: opts?.edges === false ? 0 : 0.85,
  });

  function addPart(geom: THREE.BufferGeometry, pos: THREE.Vector3, name: string): THREE.Mesh {
    const mesh = new THREE.Mesh(geom, bodyMat);
    mesh.name = name;
    mesh.position.copy(pos);
    if (opts?.edges !== false) {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat);
      mesh.add(edges);
    }
    group.add(mesh);
    return mesh;
  }

  // 躯干 BoxGeometry(0.34, 0.5, 0.22)
  const torsoGeom = new THREE.BoxGeometry(0.34, 0.5, 0.22);
  addPart(torsoGeom, new THREE.Vector3(0, 0, 0), 'torso');

  // 头 SphereGeometry(0.11)
  const headGeom = new THREE.SphereGeometry(0.11, 12, 8);
  addPart(headGeom, new THREE.Vector3(0, 0.36, 0), 'head');

  // 两条大腿 BoxGeometry(0.14, 0.14, 0.45) 向前(-Z)
  const thighGeom = new THREE.BoxGeometry(0.14, 0.14, 0.45);
  addPart(thighGeom, new THREE.Vector3(-0.09, -0.18, -0.335), 'thigh_l');
  addPart(thighGeom, new THREE.Vector3(0.09, -0.18, -0.335), 'thigh_r');

  // 两条小腿 BoxGeometry(0.12, 0.45, 0.12) 向下
  const calfGeom = new THREE.BoxGeometry(0.12, 0.45, 0.12);
  addPart(calfGeom, new THREE.Vector3(-0.09, -0.305, -0.5), 'calf_l');
  addPart(calfGeom, new THREE.Vector3(0.09, -0.305, -0.5), 'calf_r');

  group.userData = { bodyMat, edgeMat };
  return group;
}

export interface InternalsModelOptions {
  /** 模块盒子的基础不透明度,缺省 0.55 */
  moduleOpacity?: number;
  /** 乘员的基础不透明度,缺省 0.7 */
  crewOpacity?: number;
  /** 是否画轮廓线,缺省 true */
  edges?: boolean;
  /** 着色模式:'type'(按模块类型着色,缺省) | 'health'(按绿黄橙黑血量着色,兼容 InternalsView) */
  colorMode?: 'type' | 'health';
}

export interface InternalsModuleItem {
  id: string;
  type: string;
  part: string;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  edges?: THREE.LineSegments;
  edgeMat?: THREE.LineBasicMaterial;
  baseOpacity: number;
}

export interface InternalsCrewItem {
  id: string;
  role: string;
  part: string;
  group: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  edgeMat?: THREE.LineBasicMaterial;
  torsoMesh: THREE.Mesh;
  baseOpacity: number;
}

export interface InternalsModel {
  /** 车体坐标系下的内容(part = 'hull' 的模块和乘员);调用方把它放进车体坐标系的节点下 */
  readonly hullMount: THREE.Group;
  /** part = 'turret' 的内容,坐标是炮塔旋转中心的本地坐标;调用方放进炮塔转轴节点下 */
  readonly turretMount: THREE.Group;
  /** part = 'gun' 的内容,坐标是火炮耳轴的本地坐标;调用方放进火炮转轴节点下 */
  readonly gunMount: THREE.Group;
  /** 模块映射(id -> item) */
  readonly modulesMap: Map<string, InternalsModuleItem>;
  /** 乘员映射(id -> item) */
  readonly crewMap: Map<string, InternalsCrewItem>;
  /** 按快照给模块 / 乘员着色(按类型着色、血量比例越低越红、报废近黑、阵亡乘员近黑)并摆放乘员 */
  update(s: InternalsSnapshot): void;
  /** 整体不透明度乘数 0..1(淡入淡出用,不改变各自的基础不透明度比例) */
  setOpacity(k: number): void;
  /** 释放几何体和材质,并把三个挂载点从父节点上摘掉 */
  dispose(): void;
}

/** 车内 X 光的 3D 模型(模块盒子 + 坐姿人形乘员) */
export function buildInternalsModel(s: InternalsSnapshot, opts: InternalsModelOptions = {}): InternalsModel {
  const hullMount = new THREE.Group();
  hullMount.name = 'internals-hull';
  const turretMount = new THREE.Group();
  turretMount.name = 'internals-turret';
  const gunMount = new THREE.Group();
  gunMount.name = 'internals-gun';

  const mountOf = (part: string) => (part === 'turret' ? turretMount : part === 'gun' ? gunMount : hullMount);

  const baseModuleOpacity = opts.moduleOpacity ?? 0.55;
  const baseCrewOpacity = opts.crewOpacity ?? 0.7;
  const drawEdges = opts.edges ?? true;
  const colorMode = opts.colorMode ?? 'type';

  const modulesMap = new Map<string, InternalsModuleItem>();
  for (const m of s.modules) {
    const initialColor = colorMode === 'health'
      ? healthColor(m.ratio)
      : killcamModuleColor(m.type, m.ratio);

    const mat = new THREE.MeshBasicMaterial({
      color: initialColor,
      transparent: true,
      opacity: baseModuleOpacity,
    });
    const geom = new THREE.BoxGeometry(m.size[0], m.size[1], m.size[2]);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `module-${m.id}`;
    mesh.position.set(m.center[0], m.center[1], m.center[2]);

    let edges: THREE.LineSegments | undefined;
    let edgeMat: THREE.LineBasicMaterial | undefined;
    if (drawEdges) {
      const edgeColor = colorMode === 'health' ? (MODULE_TYPE_COLORS[m.type] ?? 0xffffff) : 0xffffff;
      edgeMat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.85,
      });
      edges = new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat);
      mesh.add(edges);
    }

    mountOf(m.part).add(mesh);
    modulesMap.set(m.id, {
      id: m.id,
      type: m.type,
      part: m.part,
      mesh,
      mat,
      edges,
      edgeMat,
      baseOpacity: baseModuleOpacity,
    });
  }

  const crewMap = new Map<string, InternalsCrewItem>();
  for (const c of s.crew) {
    const fig = buildCrewFigure({ opacity: baseCrewOpacity, edges: drawEdges });
    fig.name = `crew-${c.id}`;
    fig.position.set(c.center[0], c.center[1], c.center[2]);

    const torsoMesh = (fig.getObjectByName('torso') as THREE.Mesh) ?? (fig.children[0] as THREE.Mesh);
    const { bodyMat, edgeMat } = fig.userData as {
      bodyMat: THREE.MeshBasicMaterial;
      edgeMat: THREE.LineBasicMaterial;
    };

    const crewRatio = c.alive ? c.ratio : 0;
    const initialColor = colorMode === 'health'
      ? healthColor(crewRatio)
      : killcamCrewColor(crewRatio);
    bodyMat.color.setHex(initialColor);
    bodyMat.opacity = baseCrewOpacity;

    mountOf(c.part).add(fig);
    crewMap.set(c.id, {
      id: c.id,
      role: c.role,
      part: c.part,
      group: fig,
      mat: bodyMat,
      edgeMat,
      torsoMesh,
      baseOpacity: baseCrewOpacity,
    });
  }

  return {
    hullMount,
    turretMount,
    gunMount,
    modulesMap,
    crewMap,
    update(nextSnap: InternalsSnapshot) {
      for (const m of nextSnap.modules) {
        const item = modulesMap.get(m.id);
        if (!item) continue;
        const color = colorMode === 'health'
          ? healthColor(m.ratio)
          : killcamModuleColor(m.type, m.ratio);
        item.mat.color.setHex(color);
        item.mesh.position.set(m.center[0], m.center[1], m.center[2]);
        const target = mountOf(m.part);
        if (item.mesh.parent !== target) {
          target.add(item.mesh);
          item.part = m.part;
        }
      }

      for (const c of nextSnap.crew) {
        const item = crewMap.get(c.id);
        if (!item) continue;
        const crewRatio = c.alive ? c.ratio : 0;
        const color = colorMode === 'health'
          ? healthColor(crewRatio)
          : killcamCrewColor(crewRatio);
        item.mat.color.setHex(color);
        item.group.position.set(c.center[0], c.center[1], c.center[2]);
        const target = mountOf(c.part);
        if (item.group.parent !== target) {
          target.add(item.group);
          item.part = c.part;
        }
      }
    },
    setOpacity(k: number) {
      const visible = k > 0;
      hullMount.visible = visible;
      turretMount.visible = visible;
      gunMount.visible = visible;

      for (const item of modulesMap.values()) {
        item.mat.opacity = item.baseOpacity * k;
        if (item.edgeMat) item.edgeMat.opacity = 0.85 * k;
        item.mesh.visible = visible;
      }

      for (const item of crewMap.values()) {
        item.mat.opacity = item.baseOpacity * k;
        if (item.edgeMat) item.edgeMat.opacity = 0.85 * k;
        item.group.visible = visible;
        item.torsoMesh.visible = visible;
      }
    },
    dispose() {
      hullMount.removeFromParent();
      turretMount.removeFromParent();
      gunMount.removeFromParent();

      const geoms = new Set<THREE.BufferGeometry>();
      const mats = new Set<THREE.Material>();

      const collect = (root: THREE.Object3D) => {
        root.traverse((o) => {
          if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Line) {
            if (o.geometry) geoms.add(o.geometry);
            const m = o.material;
            if (Array.isArray(m)) {
              m.forEach((mat) => mats.add(mat));
            } else if (m) {
              mats.add(m);
            }
          }
        });
      };

      collect(hullMount);
      collect(turretMount);
      collect(gunMount);

      geoms.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());

      hullMount.clear();
      turretMount.clear();
      gunMount.clear();
      modulesMap.clear();
      crewMap.clear();
    },
  };
}
