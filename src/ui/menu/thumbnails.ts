import * as THREE from 'three';
import type { Vec3, VehicleSpec } from '../../data/types';
import { applyGunPose, buildVehicleModel } from '../../game/models';
import { turretRingOffset } from '../../game/damage/geometry';

export const THUMB_SIZE: { readonly width: 320; readonly height: 180 } = {
  width: 320,
  height: 180,
} as const;

/** 缩略图缓存(按 spec.id 和车色:涂装换了颜色要重新渲染) */
const thumbnailCache = new Map<string, string | null>();

const thumbnailKey = (spec: VehicleSpec): string => `${spec.id}:${spec.color}`;

let renderer: THREE.WebGLRenderer | null = null;
let webglFailed = false;

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const m = o.material as THREE.Material | THREE.Material[] | undefined;
      if (m) {
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
    }
  });
}

function getRenderer(): THREE.WebGLRenderer | null {
  if (webglFailed) return null;
  if (!renderer) {
    if (typeof document === 'undefined') {
      webglFailed = true;
      return null;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_SIZE.width;
      canvas.height = THUMB_SIZE.height;
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(THUMB_SIZE.width, THUMB_SIZE.height, false);
    } catch {
      webglFailed = true;
      renderer = null;
      return null;
    }
  }
  return renderer;
}

/**
 * 纯函数:计算包围盒最佳视角的相机位置与目标点。
 * 保证整车完整落在画面内,左右各留约 4% 边距。
 */
export function thumbnailFraming(
  bounds: { min: Vec3; max: Vec3 },
  aspect: number,
  fovDeg: number,
  azimuthDeg: number,
  pitchDeg: number,
): { position: Vec3; target: Vec3 } {
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const azimuthRad = (azimuthDeg * Math.PI) / 180;
  const halfFovY = ((fovDeg * Math.PI) / 180) / 2;
  const tanY = Math.tan(halfFovY);
  const tanX = aspect * tanY;

  // 相机视线方向(由 target 指向 camera 的单位向量)
  // 车头朝 -Z, 车体左侧为 -X; 俯角 pitchDeg > 0 表示从上方看下
  const dir: [number, number, number] = [
    -Math.sin(azimuthRad) * Math.cos(pitchRad),
    Math.sin(pitchRad),
    -Math.cos(azimuthRad) * Math.cos(pitchRad),
  ];

  // 相机坐标基(标准右手系)
  const forward: [number, number, number] = [-dir[0], -dir[1], -dir[2]];
  const right: [number, number, number] = [-Math.cos(azimuthRad), 0, Math.sin(azimuthRad)];
  const up: [number, number, number] = [
    Math.sin(azimuthRad) * Math.sin(pitchRad),
    Math.cos(pitchRad),
    Math.cos(azimuthRad) * Math.sin(pitchRad),
  ];

  const center: [number, number, number] = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];

  const corners: [number, number, number][] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        corners.push([x, y, z]);
      }
    }
  }

  const relCorners = corners.map(([x, y, z]) => {
    const vx = x - center[0];
    const vy = y - center[1];
    const vz = z - center[2];
    return {
      u: vx * right[0] + vy * right[1] + vz * right[2],
      v: vx * up[0] + vy * up[1] + vz * up[2],
      w: vx * forward[0] + vy * forward[1] + vz * forward[2],
    };
  });

  const minW = Math.min(...relCorners.map((r) => r.w));
  const maxDim = Math.max(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
    0.5,
  );

  // 左右各留 4% 边距 -> NDC 目标半宽 0.92
  const targetHalfNdc = 0.92;

  function evaluateDistance(D: number): {
    shiftU: number;
    shiftV: number;
    halfSpanX: number;
    halfSpanY: number;
  } {
    // 二分搜索最佳 shiftU 使 min(ndc_x) = -max(ndc_x)
    let lowU = -maxDim;
    let highU = maxDim;
    let shiftU = 0;
    let halfSpanX = 0;
    for (let iter = 0; iter < 16; iter++) {
      const midU = (lowU + highU) / 2;
      let minX = Infinity;
      let maxX = -Infinity;
      for (const r of relCorners) {
        const ndc = (r.u - midU) / ((D + r.w) * tanX);
        if (ndc < minX) minX = ndc;
        if (ndc > maxX) maxX = ndc;
      }
      shiftU = midU;
      halfSpanX = (maxX - minX) / 2;
      if (minX + maxX > 0) {
        lowU = midU;
      } else {
        highU = midU;
      }
    }

    // 二分搜索最佳 shiftV 使 min(ndc_y) = -max(ndc_y)
    let lowV = -maxDim;
    let highV = maxDim;
    let shiftV = 0;
    let halfSpanY = 0;
    for (let iter = 0; iter < 16; iter++) {
      const midV = (lowV + highV) / 2;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const r of relCorners) {
        const ndc = (r.v - midV) / ((D + r.w) * tanY);
        if (ndc < minY) minY = ndc;
        if (ndc > maxY) maxY = ndc;
      }
      shiftV = midV;
      halfSpanY = (maxY - minY) / 2;
      if (minY + maxY > 0) {
        lowV = midV;
      } else {
        highV = midV;
      }
    }

    return { shiftU, shiftV, halfSpanX, halfSpanY };
  }

  let lowD = Math.max(0.1, -minW + 0.1);
  let highD = Math.max(10, maxDim * 20);
  let bestD = highD;
  let finalShiftU = 0;
  let finalShiftV = 0;

  for (let iter = 0; iter < 24; iter++) {
    const midD = (lowD + highD) / 2;
    const res = evaluateDistance(midD);
    bestD = midD;
    finalShiftU = res.shiftU;
    finalShiftV = res.shiftV;

    // 当且仅当两轴的半跨度都不超过 0.92 时说明距离足够放得下
    if (res.halfSpanX <= targetHalfNdc && res.halfSpanY <= targetHalfNdc) {
      highD = midD;
    } else {
      lowD = midD;
    }
  }

  const target: [number, number, number] = [
    center[0] + finalShiftU * right[0] + finalShiftV * up[0],
    center[1] + finalShiftU * right[1] + finalShiftV * up[1],
    center[2] + finalShiftU * right[2] + finalShiftV * up[2],
  ];

  const position: [number, number, number] = [
    target[0] + dir[0] * bestD,
    target[1] + dir[1] * bestD,
    target[2] + dir[2] * bestD,
  ];

  return { position, target };
}

/**
 * 载具缩略图(PNG data URL,透明背景)。
 * 返回 PNG data URL(透明背景),同一辆车只渲染一次(按 spec.id 缓存);
 * 没有 WebGL(jsdom、无 GPU)或渲染失败时返回 null,不抛错,也不重复尝试。
 */
export function vehicleThumbnail(spec: VehicleSpec): string | null {
  if (thumbnailCache.has(thumbnailKey(spec))) {
    return thumbnailCache.get(thumbnailKey(spec))!;
  }

  const r = getRenderer();
  if (!r) {
    thumbnailCache.set(thumbnailKey(spec), null);
    return null;
  }

  try {
    const root = new THREE.Group();
    const turretPivot = new THREE.Group();
    const gunPivot = new THREE.Group();
    turretPivot.position.copy(turretRingOffset(spec));
    gunPivot.position.set(0, spec.turret.height / 2, -spec.turret.length / 2);
    root.add(turretPivot);
    turretPivot.add(gunPivot);
    buildVehicleModel(spec, { root, turretPivot, gunPivot });
    applyGunPose(spec, { turretPivot, gunPivot }, 0, 0);

    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const bounds = {
      min: [box.min.x, box.min.y, box.min.z] as const,
      max: [box.max.x, box.max.y, box.max.z] as const,
    };

    const aspect = THUMB_SIZE.width / THUMB_SIZE.height;
    const fovDeg = 28;
    const azimuthDeg = 45;
    const pitchDeg = 12;

    const framing = thumbnailFraming(bounds, aspect, fovDeg, azimuthDeg, pitchDeg);

    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(framing.target[0] - 8, framing.target[1] + 12, framing.target[2] - 8);
    key.target.position.set(framing.target[0], framing.target[1], framing.target[2]);

    const fill = new THREE.DirectionalLight(0x90b0d0, 1.0);
    fill.position.set(framing.target[0] + 8, framing.target[1] + 6, framing.target[2] + 8);
    fill.target.position.set(framing.target[0], framing.target[1], framing.target[2]);

    scene.add(hemi, key, key.target, fill, fill.target, root);

    const camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, 100);
    camera.position.set(framing.position[0], framing.position[1], framing.position[2]);
    camera.lookAt(framing.target[0], framing.target[1], framing.target[2]);
    camera.updateMatrixWorld(true);

    r.setClearColor(0x000000, 0);
    r.render(scene, camera);

    const dataUrl = r.domElement.toDataURL('image/png');

    scene.remove(root);
    disposeTree(root);
    hemi.dispose();
    key.dispose();
    fill.dispose();

    thumbnailCache.set(thumbnailKey(spec), dataUrl);
    return dataUrl;
  } catch {
    thumbnailCache.set(thumbnailKey(spec), null);
    return null;
  }
}

/** 测试和释放用 */
export function clearThumbnails(): void {
  thumbnailCache.clear();
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  webglFailed = false;
}
