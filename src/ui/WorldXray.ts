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
  grayHex?: number;
  edgeHex?: number;
}

export interface XrayContrast {
  grayHex: number;
  shellOpacity: number;
  edgeHex: number;
  edgeOpacity: number;
}

export const XRAY_GRAY_COLOR = 0x8a9399;

/** 暗 / 中等地面对比度(草地、泥地等, 相对亮度 <= 0.55) */
export const DARK_GROUND_CONTRAST: Readonly<XrayContrast> = {
  grayHex: XRAY_GRAY_COLOR,
  shellOpacity: 0.12,
  edgeHex: 0xffffff,
  edgeOpacity: 0.35,
};

/** 高亮地面对比度(雪地等, 相对亮度 >= 0.75): 不增强对比度, 外壳灰压暗, 轮廓线深灰免得白对白看不见 */
export const BRIGHT_GROUND_CONTRAST: Readonly<XrayContrast> = {
  grayHex: 0x4b5258,
  shellOpacity: 0.15,
  edgeHex: 0x222222,
  edgeOpacity: 0.40,
};

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpHex(hexA: number, hexB: number, t: number): number {
  const rA = (hexA >> 16) & 0xff;
  const gA = (hexA >> 8) & 0xff;
  const bA = hexA & 0xff;
  const rB = (hexB >> 16) & 0xff;
  const gB = (hexB >> 8) & 0xff;
  const bB = hexB & 0xff;
  const r = lerpChannel(rA, rB, t);
  const g = lerpChannel(gA, gB, t);
  const b = lerpChannel(bA, bB, t);
  return (r << 16) | (g << 8) | b;
}

/**
 * 纯函数: 输入 0..1 的地面相对亮度, 输出 X 光外壳与轮廓线样式对比度参数:
 * - 地面暗 / 中等(草地、泥地、岩地等, 亮度 <= 0.55): 保持基准样式(灰壳 0x8a9399、白轮廓线)
 * - 地面很亮(雪地等, 亮度 >= 0.75): 不加强对比度(灰壳压暗至 0x4b5258、轮廓线深灰 0x222222)
 * - 中间段平滑过渡(0.55..0.75 线性插值)
 */
export function xrayContrastFor(groundLuminance: number): XrayContrast {
  const clamped = THREE.MathUtils.clamp(groundLuminance, 0, 1);
  if (clamped <= 0.55) {
    return { ...DARK_GROUND_CONTRAST };
  }
  if (clamped >= 0.75) {
    return { ...BRIGHT_GROUND_CONTRAST };
  }
  const t = (clamped - 0.55) / 0.2;
  return {
    grayHex: lerpHex(DARK_GROUND_CONTRAST.grayHex, BRIGHT_GROUND_CONTRAST.grayHex, t),
    shellOpacity: THREE.MathUtils.lerp(DARK_GROUND_CONTRAST.shellOpacity, BRIGHT_GROUND_CONTRAST.shellOpacity, t),
    edgeHex: lerpHex(DARK_GROUND_CONTRAST.edgeHex, BRIGHT_GROUND_CONTRAST.edgeHex, t),
    edgeOpacity: THREE.MathUtils.lerp(DARK_GROUND_CONTRAST.edgeOpacity, BRIGHT_GROUND_CONTRAST.edgeOpacity, t),
  };
}

/**
 * 纯函数: 根据淡入淡出系数 k (0..1) 计算外壳样式:
 * - k = 0: 真实外壳(不透明度 1.0, 灰色混合 0, 轮廓线不透明度 0)
 * - k = 1: 完全 X 光(不透明度 shellOpacity, 灰色混合 1.0, 轮廓线不透明度 edgeOpacity)
 * 可选参数 contrast: 根据地面对比度调整的目标样式; 缺省时维持原有暗/中等地面样式。
 */
export function xrayShellStyle(k: number, contrast?: XrayContrast): XrayShellStyle {
  const clamped = Math.max(0, Math.min(1, k));
  const targetOpacity = contrast?.shellOpacity ?? 0.12;
  const targetEdgeOpacity = contrast?.edgeOpacity ?? 0.35;
  return {
    opacity: THREE.MathUtils.lerp(1.0, targetOpacity, clamped),
    grayMix: clamped,
    edgeOpacity: THREE.MathUtils.lerp(0.0, targetEdgeOpacity, clamped),
    ...(contrast ? { grayHex: contrast.grayHex, edgeHex: contrast.edgeHex } : {}),
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
  private readonly grayColor: THREE.Color;
  private contrast: XrayContrast;
  private currentFade = 1;

  constructor(private readonly vehicle: XrayVehicle, groundLuminance?: number) {
    this.contrast = xrayContrastFor(groundLuminance ?? 0);
    this.grayColor = new THREE.Color(this.contrast.grayHex);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * 动态设置地面相对亮度 (0..1), 实时更新外壳与轮廓线对比度
   */
  setGroundLuminance(groundLuminance: number): void {
    this.contrast = xrayContrastFor(groundLuminance);
    this.grayColor.setHex(this.contrast.grayHex);
    if (this.edgeMaterial) {
      this.edgeMaterial.color.setHex(this.contrast.edgeHex);
    }
    if (this._enabled) {
      this.setFade(this.currentFade);
    }
  }

  /**
   * 外壳变半透明灰壳 + 轮廓线,内构挂到车上并显示
   */
  enable(s: InternalsSnapshot): void {
    if (this._enabled) {
      this.disable();
    }

    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: this.contrast.edgeHex,
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
    this.currentFade = k;
    const style = xrayShellStyle(k, this.contrast);

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
      this.edgeMaterial.color.setHex(style.edgeHex ?? this.contrast.edgeHex);
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
