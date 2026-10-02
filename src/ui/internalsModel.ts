import * as THREE from 'three';
import type { InternalsSnapshot } from '../game/internalsSnapshot';

/**
 * 车内 X 光的 3D 模型(模块盒子 + 坐姿人形乘员),InternalsView / KillCam / WorldXray / WorldReplay 共用。
 * 接口由主程放好(下面是占位实现),071 负责把真正的实现从 InternalsView / KillCam 里抽过来。
 */

export interface InternalsModelOptions {
  /** 模块盒子的基础不透明度,缺省 0.55 */
  moduleOpacity?: number;
  /** 乘员的基础不透明度,缺省 0.7 */
  crewOpacity?: number;
  /** 是否画轮廓线,缺省 true */
  edges?: boolean;
}

export interface InternalsModel {
  /** 车体坐标系下的内容(part = 'hull' 的模块和乘员);调用方把它放进车体坐标系的节点下 */
  readonly hullMount: THREE.Group;
  /** part = 'turret' 的内容,坐标是炮塔旋转中心的本地坐标;调用方放进炮塔转轴节点下 */
  readonly turretMount: THREE.Group;
  /** part = 'gun' 的内容,坐标是火炮耳轴的本地坐标;调用方放进火炮转轴节点下 */
  readonly gunMount: THREE.Group;
  /** 按快照给模块 / 乘员着色(按类型着色、血量比例越低越红、报废近黑、阵亡乘员近黑)并摆放乘员 */
  update(s: InternalsSnapshot): void;
  /** 整体不透明度乘数 0..1(淡入淡出用,不改变各自的基础不透明度比例) */
  setOpacity(k: number): void;
  /** 释放几何体和材质,并把三个挂载点从父节点上摘掉 */
  dispose(): void;
}

/** 占位实现:返回三个空的挂载点。071 替换成真实实现,签名不变 */
export function buildInternalsModel(_s: InternalsSnapshot, _opts: InternalsModelOptions = {}): InternalsModel {
  const hullMount = new THREE.Group();
  const turretMount = new THREE.Group();
  const gunMount = new THREE.Group();
  return {
    hullMount,
    turretMount,
    gunMount,
    update() {},
    setOpacity() {},
    dispose() {
      hullMount.removeFromParent();
      turretMount.removeFromParent();
      gunMount.removeFromParent();
    },
  };
}
