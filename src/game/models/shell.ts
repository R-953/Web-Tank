import * as THREE from 'three';
import type { ShellSpec } from '../../data/types';

const STEEL = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.55, metalness: 0.6 });
const CAP = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 });
const BAND = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.4, metalness: 0.8 });
const cache = new Map<string, THREE.BufferGeometry[]>();

/**
 * 被帽穿甲弹(APCBC)的实体模型,按真实口径缩放:
 *   弹体(圆柱)→ 穿甲帽(弧形)→ 风帽(细长尖锥),尾部一圈铜弹带。
 * 弹头朝 +Z(与曳光、飞行方向对齐的约定一致)。
 */
export function buildShellModel(shell: ShellSpec): THREE.Group {
  const d = shell.caliber / 1000;
  const key = `${shell.caliber}`;
  let geos = cache.get(key);
  if (!geos) {
    const r = d / 2;
    const seg = 16;
    // 弹体:底部到弹带再到圆柱段(沿 Y 轴建模,最后转到 Z)
    const bodyLen = 2.2 * d;
    const body = new THREE.CylinderGeometry(r, r * 0.97, bodyLen, seg).translate(0, bodyLen / 2, 0);
    // 穿甲帽:弧形收口
    const capPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      capPts.push(new THREE.Vector2(r * Math.cos((t * Math.PI) / 2.6), bodyLen + 0.7 * d * Math.sin((t * Math.PI) / 2)));
    }
    const cap = new THREE.LatheGeometry(capPts, seg);
    // 风帽:细长尖锥
    const tipR = capPts[capPts.length - 1].x;
    const ballistic = new THREE.ConeGeometry(tipR * 1.05, 1.1 * d, seg).translate(0, bodyLen + 0.7 * d + 0.55 * d, 0);
    const band = new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.12 * d, seg).translate(0, 0.25 * d, 0);
    geos = [body, cap, ballistic, band].map((g) => g.rotateX(Math.PI / 2));
    cache.set(key, geos);
  }
  const g = new THREE.Group();
  const [body, cap, ballistic, band] = geos;
  g.add(new THREE.Mesh(body, STEEL), new THREE.Mesh(cap, STEEL), new THREE.Mesh(ballistic, CAP), new THREE.Mesh(band, BAND));
  g.name = 'shell';
  return g;
}

/** 模型总长,m(弹底到风帽尖) */
export function shellModelLength(shell: ShellSpec): number {
  return (2.2 + 0.7 + 1.1) * (shell.caliber / 1000);
}
