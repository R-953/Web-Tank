import { VehicleFrames } from '../../game/damage/geometry';
import { isCasemate } from '../../game/casemate';
import type { DamageModel, ModuleState } from '../../game/damage/DamageModel';
import type { VehicleSpec } from '../../data/types';

/** 车辆状态图的画布尺寸(CSS 像素) */
export const STATUS_SIZE = 190;

/** 模块血量 → 颜色;满血返回 null(只画淡轮廓) */
export function moduleColor(ratio: number): string | null {
  if (ratio >= 0.999) return null;
  if (ratio <= 0) return '#e23b2e';
  if (ratio < 0.5) return '#f08a1e';
  return '#f0cf3a';
}

/** 乘员血量 → 颜色 */
export function crewColor(alive: boolean, hp: number): string {
  if (!alive) return '#2a2a2a';
  if (hp >= 99.9) return '#e9eef2';
  if (hp >= 50) return '#f0cf3a';
  return '#f08a1e';
}

export interface VehicleStatusState {
  spec: VehicleSpec;
  damage: DamageModel;
  /** 炮塔相对车体,弧度,正值 = 向左 */
  turretYaw: number;
  /** 视线相对车体,同上 */
  viewYaw: number;
  /** 游戏时间,秒(闪烁动画用) */
  time: number;
}

/**
 * 左下角的车辆状态图(俯视):车体、履带、炮塔(随炮塔角转动)、炮管、各模块按血量着色、乘员圆点、视线扇形、起火标记。
 * 模块满血时只画淡轮廓(弹药架 / 油箱满血时不画),受损黄、重伤橙、损坏红;乘员白 → 黄 → 橙,阵亡黑。
 */
export class VehicleStatus {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hud-vstatus';
    this.canvas.style.width = `${STATUS_SIZE}px`;
    this.canvas.style.height = `${STATUS_SIZE}px`;
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  draw(s: VehicleStatusState): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (dpr !== this.dpr || this.canvas.width !== Math.round(STATUS_SIZE * dpr)) {
      this.dpr = dpr;
      this.canvas.width = Math.round(STATUS_SIZE * dpr);
      this.canvas.height = Math.round(STATUS_SIZE * dpr);
    }
    const c = this.ctx;
    const { spec, damage } = s;
    const { hull, turret } = spec;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, STATUS_SIZE, STATUS_SIZE);

    // 比例:车长 + 伸出车头的炮管都要装得下(炮管转到别的方向时伸出画面也没关系);整体下移,让车头前的炮管留在画面里
    const overhang = Math.max(0, turret.barrelLength + turret.length / 2 - (turret.offset ?? 0) - hull.length / 2);
    const k = (STATUS_SIZE - 16) / Math.max(hull.length + overhang, hull.width * 1.6);
    const cx = STATUS_SIZE / 2;
    const cy = STATUS_SIZE / 2 + (overhang * k) / 2;
    // 车体坐标(x 右,z 后)→ 画布:前方朝上
    const P = (x: number, z: number): [number, number] => [cx + x * k, cy + z * k];

    // 视线扇形
    c.save();
    c.translate(cx, cy);
    c.rotate(-s.viewYaw);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, STATUS_SIZE * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, STATUS_SIZE * 0.55, -Math.PI / 2 - 0.3, -Math.PI / 2 + 0.3);
    c.closePath();
    c.fill();
    c.restore();

    // 车体轮廓
    const [hx, hy] = P(-hull.width / 2, -hull.length / 2);
    c.fillStyle = 'rgba(20,24,28,.55)';
    c.strokeStyle = 'rgba(235,240,245,.75)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.rect(hx, hy, hull.width * k, hull.length * k);
    c.fill();
    c.stroke();

    const frames = new VehicleFrames(spec, s.turretYaw, 0);
    const pulse = 0.55 + 0.45 * Math.sin(s.time * 8);
    const fireSource = damage.fire?.source ?? null;

    // 车体上的模块(履带画在两侧)
    for (const m of damage.modules) {
      if (m.box.part !== 'hull') continue;
      this.drawModule(m, P, k, fireSource === m.id, pulse);
    }

    // 炮塔:绕座圈中心按炮塔角旋转;固定战斗室不转,只有火炮绕炮耳轴在射界内转
    const casemate = isCasemate(spec);
    c.save();
    const [tx, ty] = P(0, turret.offset ?? 0);
    c.translate(tx, ty);
    if (!casemate) c.rotate(-s.turretYaw);
    const T = (x: number, z: number): [number, number] => [x * k, z * k];
    c.fillStyle = 'rgba(28,33,38,.8)';
    c.strokeStyle = 'rgba(235,240,245,.85)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.rect(-(turret.width / 2) * k, -(turret.length / 2) * k, turret.width * k, turret.length * k);
    c.fill();
    c.stroke();
    for (const m of damage.modules) {
      if (m.box.part !== 'turret') continue;
      this.drawModuleAt(m, m.box.center.x, m.box.center.z, T, k, fireSource === m.id, pulse);
    }
    // 火炮坐标系:原点在炮耳轴(炮塔正面中部),不计俯仰
    c.save();
    c.translate(...T(0, -turret.length / 2));
    if (casemate) c.rotate(-s.turretYaw);
    const barrel = damage.modules.find((m) => m.type === 'barrel');
    const barrelColor = barrel ? moduleColor(barrel.hp / barrel.maxHp) : null;
    c.strokeStyle = barrelColor ?? 'rgba(235,240,245,.85)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(...T(0, -turret.barrelLength));
    c.stroke();
    for (const m of damage.modules) {
      if (m.box.part !== 'gun' || m.type === 'barrel') continue;
      this.drawModuleAt(m, m.box.center.x, m.box.center.z, T, k, fireSource === m.id, pulse);
    }
    c.restore();
    c.restore();

    // 乘员:按当前座位的位置(换位中画虚线圈)
    for (const cm of damage.crew) {
      const pos = frames.pointToHull(cm.box.part, cm.box.center);
      const [x, y] = P(pos.x, pos.z);
      c.beginPath();
      c.arc(x, y, 5, 0, Math.PI * 2);
      c.fillStyle = crewColor(cm.alive, cm.hp);
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(0,0,0,.85)';
      c.stroke();
      if (!cm.alive) {
        c.strokeStyle = '#e23b2e';
        c.beginPath();
        c.moveTo(x - 3, y - 3);
        c.lineTo(x + 3, y + 3);
        c.moveTo(x + 3, y - 3);
        c.lineTo(x - 3, y + 3);
        c.stroke();
      } else if (cm.swap) {
        c.setLineDash([2, 2]);
        c.strokeStyle = `rgba(240,207,58,${pulse})`;
        c.beginPath();
        c.arc(x, y, 8, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
      }
    }
  }

  private drawModule(m: ModuleState, P: (x: number, z: number) => [number, number], k: number, burning: boolean, pulse: number): void {
    const [x, y] = P(m.box.center.x - m.box.half.x, m.box.center.z - m.box.half.z);
    this.fillModule(m, x, y, m.box.half.x * 2 * k, m.box.half.z * 2 * k, burning, pulse);
  }

  private drawModuleAt(
    m: ModuleState,
    cx: number,
    cz: number,
    T: (x: number, z: number) => [number, number],
    k: number,
    burning: boolean,
    pulse: number,
  ): void {
    const [x, y] = T(cx - m.box.half.x, cz - m.box.half.z);
    this.fillModule(m, x, y, m.box.half.x * 2 * k, m.box.half.z * 2 * k, burning, pulse);
  }

  private fillModule(m: ModuleState, x: number, y: number, w: number, h: number, burning: boolean, pulse: number): void {
    const c = this.ctx;
    const color = moduleColor(m.hp / m.maxHp);
    const quiet = m.type === 'ammo' || m.type === 'fuel';
    if (color) {
      c.fillStyle = color;
      c.globalAlpha = 0.85;
      c.fillRect(x, y, w, h);
      c.globalAlpha = 1;
    } else if (!quiet) {
      c.strokeStyle = 'rgba(235,240,245,.28)';
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
    }
    if (burning) {
      c.fillStyle = `rgba(255,${Math.round(90 + 80 * pulse)},20,${0.55 + 0.4 * pulse})`;
      c.fillRect(x, y, w, h);
      c.fillStyle = '#fff3c0';
      c.font = 'bold 12px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('火', x + w / 2, y + h / 2);
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
    }
  }
}
