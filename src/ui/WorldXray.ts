import * as THREE from 'three';
import type { InternalsSnapshot } from '../game/internalsSnapshot';
import { buildInternalsModel, type InternalsModel } from './internalsModel';

/** Vehicle 满足这个形状(只用这三个节点) */
export interface XrayVehicle {
  root: THREE.Group;
  turretPivot: THREE.Group;
  gunPivot: THREE.Group;
}

export interface XrayShellStyle {
  opacity: number;
  grayMix: number;
  edgeOpacity: number;
}

export const XRAY_GRAY_COLOR = 0x8a9399;

/**
 * 纯函数: 根据淡入淡出系数 k (0..1) 计算外壳样式:
 * - k = 0: 真实外壳(不透明度 1.0, 灰色混合 0, 轮廓线不透明度 0)
 * - k = 1: 完全 X 光(不透明度 0.12, 灰色混合 1.0, 轮廓线不透明度 0.35)
 */
export function xrayShellStyle(k: number): XrayShellStyle {
  const clamped = Math.max(0, Math.min(1, k));
  return {
    opacity: THREE.MathUtils.lerp(1.0, 0.12, clamped),
    grayMix: clamped,
    edgeOpacity: THREE.MathUtils.lerp(0.0, 0.35, clamped),
  };
}

interface MeshMaterialEntry {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  clonedMaterials: Array<{
    cloned: THREE.Material;
    origColor: THREE.Color | null;
  }>;
}

export class WorldXray {
  private _enabled = false;
  private internalsModel: InternalsModel | null = null;
  private meshEntries: MeshMaterialEntry[] = [];
  private edgeLines: THREE.LineSegments[] = [];
  private edgeMaterial: THREE.LineBasicMaterial | null = null;
  private readonly grayColor = new THREE.Color(XRAY_GRAY_COLOR);

  constructor(private readonly vehicle: XrayVehicle) {}

  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * 外壳变半透明灰壳 + 轮廓线,内构挂到车上并显示
   */
  enable(s: InternalsSnapshot): void {
    if (this._enabled) {
      this.disable();
    }

    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const meshEntries: MeshMaterialEntry[] = [];
    const edgeLines: THREE.LineSegments[] = [];

    this.vehicle.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const origMat = o.material as THREE.Material | THREE.Material[];
        const isArray = Array.isArray(origMat);
        const mats = isArray ? origMat : [origMat];

        const clonedItems: Array<{ cloned: THREE.Material; origColor: THREE.Color | null }> = [];
        const newMats: THREE.Material[] = [];

        for (const m of mats) {
          const cloned = m.clone();
          cloned.transparent = true;
          cloned.depthWrite = false;
          const origColor =
            'color' in m && (m as THREE.MeshStandardMaterial).color
              ? (m as THREE.MeshStandardMaterial).color.clone()
              : null;
          clonedItems.push({ cloned, origColor });
          newMats.push(cloned);
        }

        o.material = isArray ? newMats : newMats[0];

        meshEntries.push({
          mesh: o,
          originalMaterial: origMat,
          clonedMaterials: clonedItems,
        });

        // 主要大部件加白色半透明轮廓线(面数过多的网格如高精度履带等不加,控制帧耗)
        if (!(o instanceof THREE.InstancedMesh) && o.geometry) {
          const posAttr = o.geometry.getAttribute('position');
          const vertexCount = posAttr ? posAttr.count : 0;
          if (vertexCount > 0 && vertexCount <= 4000) {
            const edgeGeo = new THREE.EdgesGeometry(o.geometry, 25);
            const edgeLine = new THREE.LineSegments(edgeGeo, this.edgeMaterial!);
            edgeLine.name = 'xray-edge';
            o.add(edgeLine);
            edgeLines.push(edgeLine);
          }
        }
      }
    });

    this.meshEntries = meshEntries;
    this.edgeLines = edgeLines;

    // 挂载内构模型
    this.internalsModel = buildInternalsModel(s);
    this.vehicle.root.add(this.internalsModel.hullMount);
    this.vehicle.turretPivot.add(this.internalsModel.turretMount);
    this.vehicle.gunPivot.add(this.internalsModel.gunMount);

    this._enabled = true;
    this.setFade(1);
    this.internalsModel.update(s);
  }

  /**
   * 每帧调用: 内构着色、乘员位置
   */
  update(s: InternalsSnapshot): void {
    if (!this._enabled || !this.internalsModel) return;
    this.internalsModel.update(s);
  }

  /**
   * 设置透明度与灰壳过渡 (0 = 真实外壳、无内构; 1 = 完全 X 光)
   */
  setFade(k: number): void {
    if (!this._enabled) return;
    const style = xrayShellStyle(k);

    for (const entry of this.meshEntries) {
      for (const item of entry.clonedMaterials) {
        item.cloned.opacity = style.opacity;
        if (item.origColor && 'color' in item.cloned) {
          (item.cloned as THREE.MeshStandardMaterial).color
            .copy(item.origColor)
            .lerp(this.grayColor, style.grayMix);
        }
      }
    }

    if (this.edgeMaterial) {
      this.edgeMaterial.opacity = style.edgeOpacity;
      this.edgeMaterial.visible = style.edgeOpacity > 0.001;
    }

    if (this.internalsModel) {
      this.internalsModel.setOpacity(k);
    }
  }

  /**
   * 还原所有材质、摘掉内构、释放克隆
   */
  disable(): void {
    if (!this._enabled) return;

    // 1. 还原材质并释放克隆
    for (const entry of this.meshEntries) {
      entry.mesh.material = entry.originalMaterial;
      for (const item of entry.clonedMaterials) {
        item.cloned.dispose();
      }
    }
    this.meshEntries = [];

    // 2. 移除并释放轮廓线
    for (const edgeLine of this.edgeLines) {
      edgeLine.removeFromParent();
      edgeLine.geometry.dispose();
    }
    this.edgeLines = [];
    if (this.edgeMaterial) {
      this.edgeMaterial.dispose();
      this.edgeMaterial = null;
    }

    // 3. 释放内构模型
    if (this.internalsModel) {
      this.internalsModel.dispose();
      this.internalsModel = null;
    }

    this._enabled = false;
  }
}
