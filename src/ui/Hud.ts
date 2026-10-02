import type { GameEvent } from '../game/Game';
import type { DamageModel } from '../game/damage/DamageModel';
import type { VehicleSpec } from '../data/types';
import { CREW } from '../data/modules';
import { KILLCAM } from './KillCam';
import { MINIMAP } from './Minimap';
import { VehicleStatus, STATUS_SIZE } from './hud/VehicleStatus';
import {
  statusMessages,
  transientFromHit,
  MessageQueue,
  repairLabel,
  hintLine,
  formatActionHintHtml,
  killFeedName,
  createKillFeedFromHit,
  createKillFeedFromDestroyed,
  KillFeedTracker,
  type StatusMsg,
} from './hud/hudStatus';
import { ProgressRing, type RingIcon } from './hud/ProgressRing';
import { shellIconKind, slotIconSvg, type SlotIconKind } from './hud/slotIcons';

/** 一种弹在快捷栏里的显示 */
export interface AmmoLine {
  id: string;
  name: string;
  /** 弹种简称,如 APCBC */
  type: string;
  /** 车内剩余(含膛内) */
  count: number;
  selected: boolean;
  /** 膛里装的是这种 */
  loaded: boolean;
  /** 快捷键简称 */
  key: string;
}

export interface HudState {
  spec: VehicleSpec;
  damage: DamageModel;
  /** 炮塔相对车体,弧度,0 = 朝车头,正值 = 向左 */
  turretYaw: number;
  /** 视线相对车体,同上 */
  viewYaw: number;
  /** 视线的世界朝向,弧度,0 = 北(−Z),正值 = 向左(西) */
  compassYaw: number;
  /** 带符号,倒车为负 */
  speedKmh: number;
  /** 0..1 */
  engineRpm: number;
  /** −1..1 */
  throttle: number;
  surface: string;
  /** 按满编装填计的剩余秒数(实际 = / damage.reloadRate) */
  reloadRemaining: number;
  reloadTime: number;
  /** 膛里的弹名;null = 空膛 */
  loaded: string | null;
  ammo: AmmoLine[];
  mg: { name: string; inBelt: number; beltSize: number; reserve: number; reloading: number; reloadTime: number; firing: boolean; key: string } | null;
  keys: { fire: string; repair: string; extinguish: string; nextShell: string; scope: string; zoom: string; cursor: string };
  targetsDestroyed: number;
  targetsTotal: number;
  /** 炮管实际指向在屏幕上的位置(像素),null = 不在画面内 */
  gunMarker: { x: number; y: number } | null;
  scoped: boolean;
  sightRange: number;
  magnification: number;
  /** 操作提示;null = 不显示 */
  hints: string | null;
  /** 帧率;null = 不显示 */
  fps: number | null;
  /** Alt 光标位置(客户端像素);null = 不在光标模式 */
  cursor: { x: number; y: number } | null;
  /** 地图标记:距离与屏幕位置(null = 在身后) */
  marker: { distance: number; screen: { x: number; y: number } | null } | null;
  alive: boolean;
}

const FEED_LIFETIME = 6;
const FEED_MAX = 5;

const CSS = `
.hud { position: fixed; inset: 0; pointer-events: none; font: 13px/1.35 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #f2f2f2; text-shadow: 0 1px 2px rgba(0,0,0,.85); user-select: none; z-index: 4; }
.hud.hidden, body.killcam-full .hud, .killcam-full .hud, body.killcam-full .minimap, .killcam-full .minimap { display: none !important; }
.hud-crosshair { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; }
.hud-crosshair::before, .hud-crosshair::after { content: ""; position: absolute; background: rgba(255,255,255,.9); box-shadow: 0 0 2px #000; }
.hud-crosshair::before { left: 8px; top: 0; width: 2px; height: 18px; }
.hud-crosshair::after { top: 8px; left: 0; height: 2px; width: 18px; }
.hud.scoped .hud-crosshair { display: none; }
.hud-gun { position: absolute; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; border: 2px solid #7cfc9a; border-radius: 50%; box-shadow: 0 0 3px #000; transition: border-color .1s; }
.hud-gun.reloading { border-color: #ffb347; border-style: dashed; }
.hud-gun.disabled { border-color: #ff4d4d; }
.hud-box { position: absolute; background: rgba(14,17,20,.5); border: 1px solid rgba(255,255,255,.08); border-radius: 4px; }
.hud.scoped .hud-box { background: rgba(14,17,20,.35); }
.hud-top { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; }
.hud-compass { display: block; }
.hud-objective { font-size: 12px; opacity: .92; }
.hud-topleft { position: absolute; left: 12px; top: 10px; font-size: 12px; display: flex; flex-direction: column; gap: 4px; max-width: calc(50vw - 200px); }
.hud-fps { font-variant-numeric: tabular-nums; opacity: .85; }
.hud-hint { opacity: .8; }
.hud.scoped .hud-hint { display: none; }
.hud-status { left: 12px; bottom: 12px; padding: 6px 8px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.hud-vstatus { display: block; }
.hud-drive { display: grid; grid-template-columns: auto 1fr; gap: 1px 8px; width: ${STATUS_SIZE}px; font-size: 12px; font-variant-numeric: tabular-nums; align-items: center; }
.hud-drive .speed { font-size: 18px; font-weight: 600; }
.hud-drive .speed small { font-size: 11px; font-weight: 400; opacity: .8; margin-left: 2px; }
.hud-rpm { height: 5px; background: rgba(255,255,255,.15); border-radius: 3px; overflow: hidden; }
.hud-rpm > div { height: 100%; background: #9fd3ff; width: 0; }
.hud-rpm.bad > div { background: #f08a1e; }
.hud-drive .dim { opacity: .75; }
.hud-bottom { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; }
.hud-action-hint { display: flex; align-items: center; gap: 6px; min-height: 24px; font-size: 15px; font-weight: 600; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,.9); pointer-events: none; }
.hud-action-hint .hud-hint-key { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 5px; background: rgba(14,17,20,.7); border: 1px solid rgba(255,255,255,.6); border-radius: 3px; font-size: 13px; font-weight: 700; color: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.8); }
.hud-msgs { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 18px; font-size: 14px; font-weight: 600; }
.hud-msgs .red { color: #ff5a4a; }
.hud-msgs .amber { color: #ffcf5a; }
.hud-msgs .white { color: #f2f2f2; font-weight: 500; }
.hud-rings { display: flex; gap: 16px; align-items: flex-start; justify-content: center; }
.hud-progress-ring { display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none; }
.hud-progress-ring .progress-ring-label { font-size: 12px; font-weight: 600; color: #ffd166; text-shadow: 0 1px 2px rgba(0,0,0,.9); white-space: nowrap; }
.hud-bar { position: relative; display: flex; gap: 4px; align-items: stretch; padding: 4px; }
.hud-slot { position: relative; width: 64px; height: 64px; background: rgba(30,36,42,.75); border: 1px solid rgba(255,255,255,.14); border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
.hud-slot .key { position: absolute; left: 3px; top: 1px; font-size: 10px; opacity: .7; }
.hud-slot .ico { font-size: 11px; font-weight: 600; white-space: nowrap; }
.hud-slot .slot-icon { display: block; width: 24px; height: 24px; flex: none; margin-top: 7px; color: #f2f2f2; }
.hud-slot .slot-icon svg { display: block; width: 100%; height: 100%; }
.hud-slot .val { font-size: 12px; font-variant-numeric: tabular-nums; opacity: .92; }
.hud-slot .prog { position: absolute; left: 0; bottom: 0; height: 3px; background: #ffb347; width: 0; }
.hud-slot.sel { border-color: #e0b44c; box-shadow: inset 0 0 0 1px #e0b44c; }
.hud-slot.loaded .slot-icon { color: #7cfc9a; }
.hud-slot.sel .slot-icon { color: #ffcf5a; }
.hud-slot.loaded::after { content: ""; position: absolute; right: 4px; top: 4px; width: 6px; height: 6px; border-radius: 50%; background: #7cfc9a; box-shadow: 0 0 3px #000; }
.hud-slot.empty { opacity: .45; }
.hud-slot.alert { border-color: #ff5a4a; background: rgba(90,20,16,.8); }
.hud-slot.alert .slot-icon { color: #ff5a4a; }
.hud-slot.flash { animation: hudflash .6s steps(2) infinite; }
.hud-slot.busy .prog { background: #7cc4ff; }
.hud-slot.busy .slot-icon { color: #7cc4ff; }
.hud-slot.ok .ico { color: #bfe8c0; }
.hud-slot.wide { width: 74px; }
.hud-sep { width: 1px; background: rgba(255,255,255,.15); margin: 2px 2px; }
@keyframes hudflash { 0% { background: rgba(120,24,16,.9); } 100% { background: rgba(30,36,42,.75); } }
.hud-feed { position: absolute; right: 16px; top: ${KILLCAM.margin * 2 + KILLCAM.height}px; width: ${KILLCAM.width}px; display: flex; flex-direction: column; gap: 3px; max-height: calc(100vh - ${KILLCAM.margin * 3 + KILLCAM.height + MINIMAP.size + MINIMAP.label + MINIMAP.margin}px); overflow: hidden; }
.hud-feed div { background: rgba(15,18,22,.62); border-left: 3px solid #999; padding: 3px 8px; border-radius: 3px; transition: opacity .4s; font-size: 12px; }
.hud-feed .pen { border-color: #ff8a3d; }
.hud-feed .nopen { border-color: #9ab; }
.hud-feed .kill { border-color: #ff4d4d; font-weight: 600; }
.hud-feed .self { border-color: #ffd166; }
.hud-feed .incoming { border-color: #e04040; background: rgba(70,12,12,.66); }
.hud-feed .feed-friendly, .hud-feed .feed-blue { color: #7cc4ff; }
.hud-feed .feed-enemy, .hud-feed .feed-red { color: #ff5a4a; }
.hud-cursor { position: fixed; left: 0; top: 0; width: 16px; height: 22px; display: none; filter: drop-shadow(0 1px 1px rgba(0,0,0,.8)); pointer-events: none; z-index: 7; }
.hud-marker { position: absolute; left: 0; top: 0; display: none; transform: translate(-50%, -100%); text-align: center; font-size: 12px; font-weight: 600; color: #ffd166; white-space: nowrap; }
.hud.scoped .hud-top { display: none; }
.hud-marker i { display: block; width: 10px; height: 10px; margin: 2px auto 0; background: #ffd166; transform: rotate(45deg); border: 1px solid #000; }
.hud-marker.edge { color: #ffe39b; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  parent.appendChild(e);
  return e;
}

interface Slot {
  root: HTMLDivElement;
  key: HTMLSpanElement;
  icon: HTMLSpanElement;
  iconKind: SlotIconKind | null;
  ico: HTMLSpanElement;
  val: HTMLSpanElement;
  prog: HTMLDivElement;
}

/**
 * 战斗 HUD(纯 DOM + 2D 画布),布局参照 War Thunder:
 *   左下车辆状态(俯视图 + 速度 / 转速)· 正下方状态提示和快捷栏(弹种、机枪、维修、灭火、瞄准镜)·
 *   上方罗盘和任务 · 右上击杀回放(由 KillCam 画在 WebGL 画布上)下面是命中记录 · 右下小地图(Minimap)。
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly gun: HTMLDivElement;
  private readonly compass: HTMLCanvasElement;
  private readonly compassCtx: CanvasRenderingContext2D;
  private readonly objective: HTMLDivElement;
  private readonly fps: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly status: VehicleStatus;
  private readonly drive: HTMLDivElement;
  private readonly speedEl: HTMLDivElement;
  private readonly gearEl: HTMLDivElement;
  private readonly rpmBar: HTMLDivElement;
  private readonly rpmFill: HTMLDivElement;
  private readonly surfaceEl: HTMLDivElement;
  private readonly crewEl: HTMLDivElement;
  private readonly actionHint: HTMLDivElement;
  private readonly msgs: HTMLDivElement;
  private readonly ringsContainer: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private readonly feed: HTMLDivElement;
  private readonly cursor: HTMLDivElement;
  private readonly markerEl: HTMLDivElement;
  private readonly markerText: HTMLSpanElement;
  private feedItems: Array<{ el: HTMLDivElement; bornAt: number }> = [];
  private slots: { ammo: Slot[]; mg: Slot | null; repair: Slot; fire: Slot; sight: Slot } | null = null;
  private barSignature = '';
  private lastMsgs = '';
  private lastActionHint = '';
  private lastHint = '';
  private compassDpr = 0;
  private readonly transientQueue = new MessageQueue(3.5);
  private readonly killTracker = new KillFeedTracker(0.5);
  private swapRings: ProgressRing[] = [];
  private repairRing: ProgressRing | null = null;
  private resupplyRing: ProgressRing | null = null;
  private resupplyProgress: number | null = null;

  constructor(parent: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = el('div', 'hud', parent);
    el('div', 'hud-crosshair', this.root);
    this.gun = el('div', 'hud-gun', this.root);

    const top = el('div', 'hud-top', this.root);
    this.compass = el('canvas', 'hud-compass', top);
    this.compass.style.width = '360px';
    this.compass.style.height = '30px';
    this.compassCtx = this.compass.getContext('2d')!;
    this.objective = el('div', 'hud-objective', top);

    const tl = el('div', 'hud-topleft', this.root);
    this.fps = el('div', 'hud-fps', tl);
    this.hint = el('div', 'hud-hint', tl);

    const status = el('div', 'hud-box hud-status', this.root);
    this.status = new VehicleStatus(status);
    this.drive = el('div', 'hud-drive', status);
    this.speedEl = el('div', 'speed', this.drive);
    this.gearEl = el('div', 'dim', this.drive);
    el('div', 'dim', this.drive).textContent = '转速';
    this.rpmBar = el('div', 'hud-rpm', this.drive);
    this.rpmFill = el('div', '', this.rpmBar);
    this.surfaceEl = el('div', 'dim', this.drive);
    this.crewEl = el('div', 'dim', this.drive);

    const bottom = el('div', 'hud-bottom', this.root);
    this.actionHint = el('div', 'hud-action-hint', bottom);
    this.actionHint.style.display = 'none';
    this.ringsContainer = el('div', 'hud-rings', bottom);
    this.ringsContainer.style.display = 'none';
    this.msgs = el('div', 'hud-msgs', bottom);
    this.bar = el('div', 'hud-box hud-bar', bottom);

    this.feed = el('div', 'hud-feed', this.root);

    this.markerEl = el('div', 'hud-marker', this.root);
    this.markerText = el('span', '', this.markerEl);
    el('i', '', this.markerEl);

    // 光标要盖在小地图上面,所以不放在 HUD 容器里(HUD 的层级在小地图之下)
    this.cursor = el('div', 'hud-cursor', parent);
    this.cursor.innerHTML =
      '<svg width="16" height="22" viewBox="0 0 16 22"><path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
    if (!v) this.cursor.style.display = 'none';
  }

  /** 设置占点补给圆环进度(0..1),传入 null 时隐藏 */
  setResupply(progress: number | null): void {
    this.resupplyProgress = progress;
    if (!this.resupplyRing) {
      this.resupplyRing = new ProgressRing(this.ringsContainer);
    }
    if (progress === null) {
      this.resupplyRing.hide();
    } else {
      this.resupplyRing.set({ progress, icon: 'ammo' });
    }
    this.updateRingsVisibility();
  }

  update(s: HudState, now: number): void {
    this.root.classList.toggle('scoped', s.scoped);
    this.objective.textContent = `摧毁全部靶车 ${s.targetsDestroyed} / ${s.targetsTotal}`;
    this.fps.textContent = s.fps === null ? '' : `${Math.round(s.fps)} FPS`;
    const hint = s.hints ?? '';
    if (hint !== this.lastHint) {
      this.hint.textContent = hint;
      this.lastHint = hint;
    }
    this.drawCompass(s.compassYaw);

    const d = s.damage;
    const reloading = !s.loaded;
    if (s.gunMarker && s.alive) {
      this.gun.style.display = '';
      this.gun.style.transform = `translate(${s.gunMarker.x.toFixed(1)}px, ${s.gunMarker.y.toFixed(1)}px)`;
      this.gun.classList.toggle('reloading', reloading);
      this.gun.classList.toggle('disabled', !d.canFire);
    } else {
      this.gun.style.display = 'none';
    }

    this.status.draw({ spec: s.spec, damage: d, turretYaw: s.turretYaw, viewYaw: s.viewYaw, time: now });
    this.updateDrive(s);
    this.updateActionHint(s);
    this.updateMessages(s, now);
    this.updateRings(s);
    this.updateBar(s);
    this.updateCursor(s.cursor);
    this.updateMarker(s.marker);

    this.feedItems = this.feedItems.filter((item) => {
      const age = now - item.bornAt;
      if (age > FEED_LIFETIME) {
        item.el.remove();
        return false;
      }
      item.el.style.opacity = age > FEED_LIFETIME - 1 ? String(FEED_LIFETIME - age) : '1';
      return true;
    });
  }

  onEvent(e: GameEvent, now: number): void {
    if (e.type === 'hit') {
      if (e.targetId === 'player') {
        const transients = transientFromHit(e.replay);
        for (const t of transients) {
          this.transientQueue.push(t, now);
        }
      }
      if (e.replay.destroyed) {
        if (this.killTracker.recordKill(e.targetId, now)) {
          this.pushFeed(createKillFeedFromHit(e), 'kill', now);
        }
      }
    } else if (e.type === 'misfire' && e.vehicleId === 'player') {
      const text = e.part === 'breech' ? '炮闩受损,击发失败' : '炮管受损,击发失败';
      this.transientQueue.push({ text, cls: 'red' }, now);
    } else if (e.type === 'ammo-lost' && e.vehicleId === 'player') {
      this.transientQueue.push({ text: `弹药架受损,损失 ${e.rounds} 发`, cls: 'amber' }, now);
    } else if (e.type === 'destroyed') {
      if (this.killTracker.recordKill(e.vehicleId, now)) {
        this.pushFeed(createKillFeedFromDestroyed(e), 'kill', now);
      }
    } else if (e.type === 'fire' && e.state === 'start' && e.vehicleId !== 'player') {
      this.pushFeed(`${killFeedName(e.name)} 起火`, 'pen', now);
    } else if (e.type === 'cook-off' && e.vehicleId !== 'player') {
      this.pushFeed(`${killFeedName(e.name)} 弹药被引燃殉爆`, 'kill', now);
    }
  }

  reset(): void {
    this.feedItems.forEach((i) => i.el.remove());
    this.feedItems = [];
    this.killTracker.clear();
    this.lastMsgs = '';
    this.msgs.innerHTML = '';
    this.lastActionHint = '';
    this.actionHint.innerHTML = '';
    this.actionHint.style.display = 'none';
    this.barSignature = '';
    this.transientQueue.clear();
    this.swapRings.forEach((r) => r.hide());
    this.repairRing?.hide();
    this.resupplyRing?.hide();
    this.resupplyProgress = null;
    this.updateRingsVisibility();
  }

  // ------------------------------------------------------------------ 罗盘

  private drawCompass(yaw: number): void {
    const W = 360;
    const H = 30;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (dpr !== this.compassDpr) {
      this.compassDpr = dpr;
      this.compass.width = W * dpr;
      this.compass.height = H * dpr;
    }
    const c = this.compassCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // 方位角:从北顺时针,度
    const bearing = ((((-yaw * 180) / Math.PI) % 360) + 360) % 360;
    const span = 90; // 画面宽度对应的角度
    const pxPerDeg = W / span;
    const grad = c.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'rgba(14,17,20,0)');
    grad.addColorStop(0.15, 'rgba(14,17,20,.5)');
    grad.addColorStop(0.85, 'rgba(14,17,20,.5)');
    grad.addColorStop(1, 'rgba(14,17,20,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, 20);
    c.font = '11px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    const names: Record<number, string> = { 0: '北', 45: '东北', 90: '东', 135: '东南', 180: '南', 225: '西南', 270: '西', 315: '西北' };
    const start = Math.ceil((bearing - span / 2) / 5) * 5;
    for (let a = start; a <= bearing + span / 2; a += 5) {
      const x = W / 2 + (a - bearing) * pxPerDeg;
      const n = ((a % 360) + 360) % 360;
      const alpha = 1 - Math.abs(x - W / 2) / (W / 2);
      c.globalAlpha = Math.max(0, alpha);
      c.strokeStyle = '#e8e8e8';
      c.lineWidth = 1;
      c.beginPath();
      const major = n % 15 === 0;
      c.moveTo(x, 0);
      c.lineTo(x, major ? 7 : 4);
      c.stroke();
      if (n % 45 === 0) {
        c.fillStyle = n === 0 ? '#ffd166' : '#f2f2f2';
        c.fillText(names[n], x, 18);
      } else if (major) {
        c.fillStyle = 'rgba(242,242,242,.75)';
        c.fillText(String(n), x, 17);
      }
    }
    c.globalAlpha = 1;
    // 当前方位
    c.fillStyle = '#ffd166';
    c.beginPath();
    c.moveTo(W / 2 - 4, 30);
    c.lineTo(W / 2 + 4, 30);
    c.lineTo(W / 2, 24);
    c.closePath();
    c.fill();
    c.font = 'bold 11px system-ui, sans-serif';
    c.fillText(`${Math.round(bearing) % 360}°`, W / 2 + 22, 29);
  }

  // ------------------------------------------------------------------ 左下:驾驶信息

  private updateDrive(s: HudState): void {
    const kmh = s.speedKmh;
    const reverse = kmh < -0.5;
    this.speedEl.innerHTML = `${Math.round(Math.abs(kmh))}<small>km/h</small>`;
    const gear = !s.alive ? '—' : reverse ? 'R 倒车' : Math.abs(s.throttle) < 0.01 && Math.abs(kmh) < 0.5 ? 'N 空挡' : s.throttle < 0 ? '刹车' : 'D 前进';
    this.gearEl.textContent = gear;
    this.rpmFill.style.width = `${Math.round(Math.max(0, Math.min(1, s.engineRpm)) * 100)}%`;
    const engine = s.damage.modules.find((m) => m.type === 'engine');
    this.rpmBar.classList.toggle('bad', !!engine && engine.hp < engine.maxHp);
    this.surfaceEl.textContent = s.surface;
    this.crewEl.textContent = `乘员 ${s.damage.aliveCount} / ${s.damage.crew.length}`;
  }

  // ------------------------------------------------------------------ 正下方:操作提示与状态提示

  private updateActionHint(s: HudState): void {
    if (!s.alive) {
      if (this.lastActionHint !== '') {
        this.actionHint.innerHTML = '';
        this.actionHint.style.display = 'none';
        this.lastActionHint = '';
      }
      return;
    }
    const d = s.damage;
    const hint = hintLine(
      {
        fire: d.fire,
        extinguishers: d.extinguishers,
        isRepairing: d.repair !== null,
        hasRepairable: d.brokenRepairable().length > 0,
      },
      s.keys
    );
    const html = hint ? formatActionHintHtml(hint) : '';
    if (html !== this.lastActionHint) {
      this.lastActionHint = html;
      this.actionHint.innerHTML = html;
      this.actionHint.style.display = hint ? 'flex' : 'none';
    }
  }

  private updateMessages(s: HudState, now: number): void {
    const d = s.damage;
    const out: StatusMsg[] = [];
    if (!s.alive) out.push({ text: '已被击毁', cls: 'red' });
    else {
      // 1. 维修倒计时作为第一行(琥珀色,居中在圆环行正下方)
      if (d.repair) {
        const remainingSec = Math.ceil(d.repair.remaining / Math.max(d.repairRate, 1e-6));
        out.push({ text: repairLabel(remainingSec), cls: 'amber' });
      }

      // 2. 状态型提示
      out.push(...statusMessages(d));

      // 3. 瞬时提示
      out.push(...this.transientQueue.get(now));

      // 4. 装填与弹药提示
      const selected = s.ammo.find((a) => a.selected);
      if (d.canFire && !s.loaded) {
        if (selected && selected.count === 0) {
          out.push({ text: `${selected.name} 已打光 — 换弹(${s.keys.nextShell} 或数字键)`, cls: 'amber' });
        } else {
          out.push({ text: `装填 ${selected?.name ?? ''} ${(s.reloadRemaining / Math.max(d.reloadRate, 1e-6)).toFixed(1)}s`, cls: 'white' });
        }
      }
    }
    const html = out
      .slice(0, 4)
      .map((m) => `<div class="${m.cls}">${m.text}</div>`)
      .join('');
    if (html !== this.lastMsgs) {
      this.msgs.innerHTML = html;
      this.lastMsgs = html;
    }
  }

  // ------------------------------------------------------------------ 正下方:圆环进度

  private updateRings(s: HudState): void {
    // 1. 乘员顶替
    const swaps = s.damage.crew.filter((c) => c.alive && c.swap);
    while (this.swapRings.length < swaps.length) {
      this.swapRings.push(new ProgressRing(this.ringsContainer));
    }
    this.swapRings.forEach((ring, i) => {
      if (i < swaps.length) {
        const swap = swaps[i].swap!;
        const progress = Math.max(0, Math.min(1, 1 - swap.remaining / CREW.swapTime));
        const icon = (['driver', 'gunner', 'loader', 'commander', 'radio', 'machinegunner'].includes(swap.to)
          ? swap.to
          : 'driver') as RingIcon;
        ring.set({ progress, icon });
      } else {
        ring.hide();
      }
    });

    // 2. 维修
    if (s.damage.repair) {
      if (!this.repairRing) {
        this.repairRing = new ProgressRing(this.ringsContainer);
      }
      const r = s.damage.repair;
      const progress = Math.max(0, Math.min(1, 1 - r.remaining / Math.max(r.total, 1e-6)));
      this.repairRing.set({
        progress,
        icon: 'repair',
      });
    } else {
      this.repairRing?.hide();
    }

    // 3. 补给
    if (this.resupplyProgress !== null) {
      if (!this.resupplyRing) {
        this.resupplyRing = new ProgressRing(this.ringsContainer);
      }
      this.resupplyRing.set({ progress: this.resupplyProgress, icon: 'ammo' });
    } else {
      this.resupplyRing?.hide();
    }

    this.updateRingsVisibility();
  }

  private updateRingsVisibility(): void {
    const hasSwap = this.swapRings.some((r) => r.root.style.display !== 'none');
    const hasRepair = this.repairRing !== null && this.repairRing.root.style.display !== 'none';
    const hasResupply = this.resupplyRing !== null && this.resupplyRing.root.style.display !== 'none';
    this.ringsContainer.style.display = hasSwap || hasRepair || hasResupply ? 'flex' : 'none';
  }

  // ------------------------------------------------------------------ 正下方:快捷栏

  private makeSlot(parent: HTMLElement, wide = false): Slot {
    const root = el('div', `hud-slot${wide ? ' wide' : ''}`, parent);
    const key = el('span', 'key', root);
    const icon = el('span', 'slot-icon', root);
    const ico = el('span', 'ico', root);
    const val = el('span', 'val', root);
    const prog = el('div', 'prog', root);
    return { root, key, icon, iconKind: null, ico, val, prog };
  }

  private setSlotIcon(slot: Slot, kind: SlotIconKind): void {
    if (slot.iconKind === kind) return;
    slot.icon.innerHTML = slotIconSvg(kind);
    slot.iconKind = kind;
  }

  private updateBar(s: HudState): void {
    const sig = `${s.ammo.map((a) => a.id).join(',')}|${s.mg ? 'mg' : ''}`;
    if (sig !== this.barSignature || !this.slots) {
      this.barSignature = sig;
      this.bar.innerHTML = '';
      const ammo = s.ammo.map(() => this.makeSlot(this.bar));
      let mg: Slot | null = null;
      if (s.mg) {
        el('div', 'hud-sep', this.bar);
        mg = this.makeSlot(this.bar, true);
      }
      el('div', 'hud-sep', this.bar);
      const repair = this.makeSlot(this.bar);
      const fire = this.makeSlot(this.bar);
      el('div', 'hud-sep', this.bar);
      const sight = this.makeSlot(this.bar, true);
      this.slots = { ammo, mg, repair, fire, sight };
    }
    const d = s.damage;
    const sl = this.slots;
    s.ammo.forEach((a, i) => {
      const slot = sl.ammo[i];
      slot.key.textContent = a.key;
      this.setSlotIcon(slot, shellIconKind(a.type));
      slot.ico.textContent = a.type;
      slot.val.textContent = String(a.count);
      slot.root.title = a.name;
      slot.root.className = `hud-slot${a.selected ? ' sel' : ''}${a.loaded ? ' loaded' : ''}${a.count === 0 ? ' empty' : ''}`;
      const loading = a.selected && !s.loaded && a.count > 0 && d.canFire;
      slot.prog.style.width = loading && s.reloadTime > 0 ? `${Math.round((1 - s.reloadRemaining / s.reloadTime) * 100)}%` : a.loaded ? '100%' : '0';
      slot.prog.style.background = a.loaded ? '#7cfc9a' : '';
    });
    if (sl.mg && s.mg) {
      const m = s.mg;
      sl.mg.key.textContent = m.key;
      this.setSlotIcon(sl.mg, 'mg');
      sl.mg.ico.textContent = '机枪';
      sl.mg.val.textContent = m.reloading > 0 ? `换弹链 ${m.reloading.toFixed(1)}s` : `${m.inBelt} / ${m.reserve}`;
      sl.mg.root.title = m.name;
      sl.mg.root.className = `hud-slot wide${m.inBelt + m.reserve === 0 ? ' empty' : ''}${m.firing ? ' sel' : ''}`;
      sl.mg.prog.style.width = m.reloading > 0 ? `${Math.round((1 - m.reloading / Math.max(m.reloadTime, 1e-6)) * 100)}%` : `${Math.round((m.inBelt / Math.max(m.beltSize, 1)) * 100)}%`;
      sl.mg.prog.style.background = m.reloading > 0 ? '#ffb347' : 'rgba(200,220,255,.55)';
    }
    // 维修
    const r = sl.repair;
    r.key.textContent = s.keys.repair;
    this.setSlotIcon(r, 'repair');
    r.ico.textContent = '维修';
    if (d.repair) {
      r.val.textContent = `${(d.repair.remaining / Math.max(d.repairRate, 1e-6)).toFixed(0)}s`;
      r.root.className = 'hud-slot busy';
      r.prog.style.width = `${Math.round((1 - d.repair.remaining / Math.max(d.repair.total, 1e-6)) * 100)}%`;
    } else {
      const need = d.brokenRepairable().length > 0 || d.damagedRepairable().length > 0;
      r.val.textContent = need ? '可维修' : '完好';
      r.root.className = `hud-slot${need ? '' : ' ok empty'}`;
      r.prog.style.width = '0';
    }
    // 灭火
    const f = sl.fire;
    f.key.textContent = s.keys.extinguish;
    this.setSlotIcon(f, 'extinguish');
    f.ico.textContent = '灭火';
    f.val.textContent = `× ${d.extinguishers}`;
    if (d.fire && d.fire.extinguishing !== null) {
      f.root.className = 'hud-slot busy';
      f.prog.style.width = `${Math.round((1 - d.fire.extinguishing / 2) * 100)}%`;
    } else {
      f.root.className = `hud-slot${d.fire ? ' alert flash' : ''}${d.extinguishers === 0 ? ' empty' : ''}`;
      f.prog.style.width = '0';
    }
    // 瞄准镜
    const v = sl.sight;
    v.key.textContent = s.keys.scope;
    this.setSlotIcon(v, 'scope');
    v.ico.textContent = s.scoped ? `${s.magnification}×` : '瞄准镜';
    v.val.textContent = `表尺 ${s.sightRange} m`;
    v.root.className = `hud-slot wide${s.scoped ? ' sel' : ''}`;
    v.prog.style.width = '0';
  }

  // ------------------------------------------------------------------ 光标 / 标记

  private updateCursor(p: { x: number; y: number } | null): void {
    if (!p) {
      this.cursor.style.display = 'none';
      return;
    }
    this.cursor.style.display = 'block';
    this.cursor.style.transform = `translate(${p.x.toFixed(0)}px, ${p.y.toFixed(0)}px)`;
  }

  private updateMarker(m: HudState['marker']): void {
    if (!m) {
      this.markerEl.style.display = 'none';
      return;
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    const pad = 24;
    let x: number;
    let y: number;
    let edge = false;
    if (m.screen) {
      x = m.screen.x;
      y = m.screen.y;
      if (x < pad || x > W - pad || y < pad + 20 || y > H - pad) edge = true;
      x = Math.min(W - pad, Math.max(pad, x));
      y = Math.min(H - pad, Math.max(pad + 20, y));
    } else {
      // 在身后:贴在画面底边
      x = W / 2;
      y = H - pad - 150;
      edge = true;
    }
    this.markerEl.style.display = 'block';
    this.markerEl.classList.toggle('edge', edge);
    this.markerEl.style.left = `${x.toFixed(0)}px`;
    this.markerEl.style.top = `${y.toFixed(0)}px`;
    this.markerText.textContent = `${m.distance >= 1000 ? (m.distance / 1000).toFixed(2) + ' km' : Math.round(m.distance) + ' m'}${m.screen ? '' : ' ↓'}`;
  }


  private pushFeed(html: string, cls: string, now: number): void {
    const item = el('div', cls, this.feed);
    item.innerHTML = html;
    this.feedItems.push({ el: item, bornAt: now });
    while (this.feedItems.length > FEED_MAX) this.feedItems.shift()?.el.remove();
  }
}
