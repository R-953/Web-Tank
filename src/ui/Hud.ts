import type { GameEvent, HitReplay } from '../game/Game';
import type { ArmorFace } from '../game/Damage';
import type { VehiclePart } from '../game/Vehicle';
import type { DamageModel } from '../game/damage/DamageModel';
import type { Loadout, VehicleSpec } from '../data/types';
import { CREW_ROLE_NAMES } from '../data/modules';
import { SHELL_SHORT, SHELL_TYPES } from '../data/shells';
import { ammoCapacity, clampLoadout, loadoutTotal } from '../game/Loadout';
import { KILLCAM } from './KillCam';

/** 一种弹在 HUD 里的显示 */
export interface AmmoLine {
  name: string;
  type: string;
  count: number;
  selected: boolean;
}

export interface HudState {
  /** 玩家载具的模块 / 乘员状态 */
  damage: DamageModel;
  reloadRemaining: number;
  reloadTime: number;
  /** 炮膛里的弹名;null = 空膛 */
  loaded: string | null;
  ammo: AmmoLine[];
  speedKmh: number;
  /** 脚下地表的名字 */
  surface: string;
  targetsDestroyed: number;
  targetsTotal: number;
  /** 炮管实际指向在屏幕上的位置(像素),null = 不在画面内 */
  gunMarker: { x: number; y: number } | null;
  pointerLocked: boolean;
  victory: boolean;
  defeat: boolean;
  scoped: boolean;
  sightRange: number;
  magnification: number;
}

const FACE_LABEL: Record<ArmorFace, string> = {
  front: '正面',
  side: '侧面',
  rear: '背面',
  top: '顶部',
  bottom: '底部',
};
const PART_LABEL: Record<VehiclePart, string> = { hull: '车体', turret: '炮塔', barrel: '炮管' };

const FEED_LIFETIME = 6;
const FEED_MAX = 7;

const CSS = `
.hud { position: fixed; inset: 0; pointer-events: none; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #f2f2f2; text-shadow: 0 1px 2px rgba(0,0,0,.8); user-select: none; }
.hud-crosshair { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; }
.hud-crosshair::before, .hud-crosshair::after { content: ""; position: absolute; background: rgba(255,255,255,.9); box-shadow: 0 0 2px #000; }
.hud-crosshair::before { left: 8px; top: 0; width: 2px; height: 18px; }
.hud-crosshair::after { top: 8px; left: 0; height: 2px; width: 18px; }
.hud.scoped .hud-crosshair, .hud.scoped .hud-hint { display: none; }
.hud-gun { position: absolute; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; border: 2px solid #7cfc9a; border-radius: 50%; box-shadow: 0 0 3px #000; transition: border-color .1s; }
.hud-gun.reloading { border-color: #ffb347; border-style: dashed; }
.hud-gun.disabled { border-color: #ff4d4d; }
.hud-panel { position: absolute; background: rgba(15,18,22,.55); border-radius: 6px; padding: 8px 12px; }
.hud-objective { left: 16px; top: 16px; }
.hud-hint { left: 16px; top: 58px; font-size: 12px; opacity: .85; }
.hud-status { left: 16px; bottom: 16px; font-size: 13px; }
.hud-status .row { display: flex; flex-wrap: wrap; gap: 2px 10px; max-width: 360px; }
.hud-status .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: middle; box-shadow: 0 0 2px #000; }
.hud-status .swap { opacity: .7; font-style: italic; }
.hud-status .repair { color: #ffd166; margin-top: 4px; }
.hud-reload { left: 50%; bottom: 16px; width: 440px; margin-left: -220px; text-align: center; }
.hud-ammo { display: flex; justify-content: center; gap: 10px; margin-top: 6px; font-size: 12px; }
.hud-ammo span { opacity: .6; }
.hud-ammo span.sel { opacity: 1; color: #ffd166; }
.hud-ammo span.empty { text-decoration: line-through; }
.hud-bar { height: 6px; background: rgba(255,255,255,.2); border-radius: 3px; overflow: hidden; margin-top: 4px; }
.hud-bar > div { height: 100%; background: #7cfc9a; width: 100%; }
.hud-bar.reloading > div { background: #ffb347; }
.hud-feed { right: 16px; top: ${KILLCAM.margin * 2 + KILLCAM.height}px; width: 440px; display: flex; flex-direction: column; gap: 4px; background: none; padding: 0; }
.hud-feed div { background: rgba(15,18,22,.6); border-left: 3px solid #999; padding: 4px 8px; border-radius: 3px; transition: opacity .4s; }
.hud-feed .pen { border-color: #ff8a3d; }
.hud-feed .nopen { border-color: #9ab; }
.hud-feed .kill { border-color: #ff4d4d; font-weight: 600; }
.hud-feed .self { border-color: #ffd166; }
.hud-feed .incoming { border-color: #e04040; background: rgba(60,10,10,.6); }
.hud-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.35); pointer-events: auto; cursor: pointer; }
.hud-overlay.hidden { display: none; }
.hud-card { background: rgba(15,18,22,.88); border-radius: 10px; padding: 22px 30px; max-width: 560px; text-align: center; }
.hud-card h1 { margin: 0 0 8px; font-size: 22px; }
.hud-card p { margin: 6px 0; }
.hud-card .keys { opacity: .85; font-size: 13px; }
.hud-loadout { margin: 12px auto 4px; cursor: default; font-size: 13px; text-align: left; display: inline-block; }
.hud-loadout table { border-collapse: collapse; }
.hud-loadout td { padding: 2px 8px; }
.hud-loadout td.n { width: 34px; text-align: center; font-variant-numeric: tabular-nums; }
.hud-loadout button { font: inherit; color: #eee; background: #2b3138; border: 1px solid #555; border-radius: 4px; width: 26px; cursor: pointer; }
.hud-loadout button.apply { width: auto; padding: 3px 12px; margin-top: 8px; background: #3a5a3a; }
.hud-loadout .total { margin-top: 6px; opacity: .85; }
`;

const COLOR = { ok: '#3ecf5a', hurt: '#f0d23a', bad: '#f07b1e', dead: '#555' };
function ratioColor(r: number): string {
  if (r <= 0) return COLOR.dead;
  if (r < 0.5) return COLOR.bad;
  if (r < 1) return COLOR.hurt;
  return COLOR.ok;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  parent.appendChild(e);
  return e;
}

/** 携弹编辑器的输入:当前车型、当前方案,点「应用」时回调 */
export interface LoadoutEditor {
  spec: VehicleSpec;
  loadout: Loadout;
  onApply(loadout: Loadout): void;
}

type OverlayMode = 'start' | 'victory' | 'defeat' | null;

/** HUD:准星、炮管指向、装填 / 弹种、表尺、自车模块 / 乘员、命中记录、开始 / 胜利 / 失败界面(纯 DOM) */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly gun: HTMLDivElement;
  private readonly objective: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly reloadText: HTMLDivElement;
  private readonly reloadBar: HTMLDivElement;
  private readonly reloadFill: HTMLDivElement;
  private readonly ammoRow: HTMLDivElement;
  private readonly feed: HTMLDivElement;
  private readonly overlay: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private feedItems: Array<{ el: HTMLDivElement; bornAt: number }> = [];
  private overlayMode: OverlayMode = null;
  private lastStatus = '';
  private lastAmmo = '';
  private editor: LoadoutEditor | null = null;
  private draft: Loadout = {};

  constructor(parent: HTMLElement, onOverlayClick: () => void) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = el('div', 'hud', parent);
    el('div', 'hud-crosshair', this.root);
    this.gun = el('div', 'hud-gun', this.root);
    this.objective = el('div', 'hud-panel hud-objective', this.root);
    const hint = el('div', 'hud-panel hud-hint', this.root);
    hint.textContent = 'WASD 移动 · 鼠标 瞄准 · 左键/空格 开火 · 1–4 弹种 · Shift 开镜 · Z 倍率 · 滚轮 表尺 · F 维修 · R 重开';
    this.status = el('div', 'hud-panel hud-status', this.root);
    const reload = el('div', 'hud-panel hud-reload', this.root);
    this.reloadText = el('div', '', reload);
    this.reloadBar = el('div', 'hud-bar', reload);
    this.reloadFill = el('div', '', this.reloadBar);
    this.ammoRow = el('div', 'hud-ammo', reload);
    this.feed = el('div', 'hud-panel hud-feed', this.root);
    this.overlay = el('div', 'hud-overlay', this.root);
    this.card = el('div', 'hud-card', this.overlay);
    this.overlay.addEventListener('click', onOverlayClick);
  }

  /** 设置开始界面里的携弹编辑器(每局开始前调用) */
  setLoadoutEditor(editor: LoadoutEditor): void {
    this.editor = editor;
    this.draft = { ...editor.loadout };
    if (this.overlayMode === 'start') this.setOverlay('start');
  }

  update(s: HudState, now: number): void {
    this.root.classList.toggle('scoped', s.scoped);
    this.objective.textContent = `目标:摧毁全部靶车 ${s.targetsDestroyed} / ${s.targetsTotal}`;

    const d = s.damage;
    const reloading = !s.loaded;
    const canFire = d.canFire;
    const selected = s.ammo.find((a) => a.selected);
    let reloadLabel: string;
    if (!canFire) reloadLabel = '无法开火';
    else if (s.loaded) reloadLabel = `${s.loaded} 已装填`;
    else if (selected && selected.count === 0) reloadLabel = `${selected.name} 已打光 — 按数字键换弹`;
    else reloadLabel = `装填 ${selected?.name ?? ''} ${(s.reloadRemaining / Math.max(d.reloadRate, 1e-6)).toFixed(1)}s`;
    this.reloadText.textContent = `${reloadLabel}   ·   表尺 ${s.sightRange} m${s.scoped ? `   ·   ${s.magnification}×` : ''}`;
    this.reloadBar.classList.toggle('reloading', reloading);
    const ratio = s.loaded ? 1 : s.reloadTime > 0 ? 1 - s.reloadRemaining / s.reloadTime : 1;
    this.reloadFill.style.width = `${Math.round(ratio * 100)}%`;
    const ammoHtml = s.ammo
      .map((a, i) => `<span class="${a.selected ? 'sel' : ''} ${a.count === 0 ? 'empty' : ''}" title="${a.type}">[${i + 1}] ${a.name} ×${a.count}</span>`)
      .join('');
    if (ammoHtml !== this.lastAmmo) {
      this.ammoRow.innerHTML = ammoHtml;
      this.lastAmmo = ammoHtml;
    }

    if (s.gunMarker) {
      this.gun.style.display = '';
      this.gun.style.transform = `translate(${s.gunMarker.x.toFixed(1)}px, ${s.gunMarker.y.toFixed(1)}px)`;
      this.gun.classList.toggle('reloading', reloading);
      this.gun.classList.toggle('disabled', !canFire);
    } else {
      this.gun.style.display = 'none';
    }

    this.renderStatus(s);

    const mode: OverlayMode = s.defeat ? 'defeat' : s.victory ? 'victory' : s.pointerLocked ? null : 'start';
    if (mode !== this.overlayMode) this.setOverlay(mode);

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
    if (e.type === 'hit' && e.shooterId === 'player') {
      this.onPlayerHit(e.targetName, e.part, e.replay, now);
    } else if (e.type === 'hit' && e.targetId === 'player') {
      this.onIncomingHit(e.part, e.replay, now);
    } else if (e.type === 'destroyed' && e.vehicleId !== 'player') {
      this.pushFeed(`${e.name} 已摧毁(${e.cause === 'ammo' ? '弹药殉爆' : '乘员不足'})`, 'kill', now);
    } else if (e.type === 'repair' && e.vehicleId === 'player') {
      const text = { start: `开始维修,约 ${Math.round(e.seconds)} 秒(维修期间不能移动)`, cancel: '维修已取消', done: '维修完成' }[e.state];
      this.pushFeed(text, 'self', now);
    } else if (e.type === 'crew-swap' && e.vehicleId === 'player') {
      this.pushFeed(e.state === 'start' ? `${e.crew} 正在顶替${e.to}` : `${e.crew} 已接替${e.to}`, 'self', now);
    } else if (e.type === 'ammo-lost' && e.vehicleId === 'player') {
      this.pushFeed(`弹药架被打坏(没有殉爆),损失 ${e.rounds} 发`, 'incoming', now);
    }
  }

  reset(): void {
    this.feedItems.forEach((i) => i.el.remove());
    this.feedItems = [];
    this.overlayMode = null;
    this.lastStatus = '';
    this.lastAmmo = '';
  }

  private describeHit(part: VehiclePart, r: HitReplay, targetName: string): { cls: string; html: string } {
    const ext = r.external;
    const extNote = ext.length
      ? ' · ' + ext.map((x) => `${x.name}${x.destroyed ? (x.name.includes('履带') ? '被打断' : '损坏') : '受损'}`).join('、')
      : '';
    const shell = `${r.shell.name}(${SHELL_SHORT[r.shell.type]})`;
    if (part === 'barrel') return { cls: 'pen', html: `命中 · ${targetName} 炮管 · ${shell}${extNote}` };
    const a = r.armor!;
    const where = `${targetName} ${PART_LABEL[part]}${FACE_LABEL[a.face]}`;
    if (a.ricochet) return { cls: 'nopen', html: `跳弹 · ${where} · 入射角 ${Math.round(a.angleDeg)}° · ${shell}${extNote}` };
    const armor = SHELL_TYPES[r.shell.type].ignoresAngle
      ? `装甲 ${a.armor}mm(碎甲弹不计入射角)`
      : `等效 ${Math.round(a.effectiveArmor)}mm(${a.armor}mm, 入射角 ${Math.round(a.angleDeg)}°)`;
    const pen = Math.round(a.penetration);
    if (!a.penetrated) return { cls: 'nopen', html: `未击穿 · ${where} · ${armor} > 穿深 ${pen}mm · ${shell}${extNote}` };
    const hits = r.penetration?.hits ?? [];
    const killed = [...new Set(hits.filter((h) => h.kind === 'crew' && h.destroyed).map((h) => h.name))];
    const hurt = [...new Set(hits.filter((h) => h.kind === 'crew' && !h.destroyed && h.hpAfter > 0).map((h) => h.name))].filter(
      (n) => !killed.includes(n),
    );
    const broken = [...new Set(hits.filter((h) => h.kind === 'module' && h.destroyed).map((h) => h.name))];
    const damaged = [...new Set(hits.filter((h) => h.kind === 'module' && !h.destroyed).map((h) => h.name))].filter(
      (n) => !broken.includes(n),
    );
    const parts: string[] = [];
    if (killed.length) parts.push(`阵亡 ${killed.join('、')}`);
    if (hurt.length) parts.push(`受伤 ${hurt.join('、')}`);
    if (broken.length) parts.push(`损坏 ${broken.join('、')}`);
    if (damaged.length) parts.push(`受损 ${damaged.join('、')}`);
    if (r.detonated) parts.push('弹药殉爆');
    const result = parts.length ? parts.join(' · ') : '未伤及乘员和模块';
    return { cls: 'pen', html: `击穿 · ${where} · ${armor} ≤ 穿深 ${pen}mm · ${shell}${extNote}<br>${result}` };
  }

  private onPlayerHit(targetName: string, part: VehiclePart, r: HitReplay, now: number): void {
    const { cls, html } = this.describeHit(part, r, targetName);
    this.pushFeed(html, cls, now);
  }

  private onIncomingHit(part: VehiclePart, r: HitReplay, now: number): void {
    const { html } = this.describeHit(part, r, '我方');
    this.pushFeed(`被击中 · ${html}`, 'incoming', now);
  }

  private renderStatus(s: HudState): void {
    const d = s.damage;
    const crew = d.crew
      .map((c) => {
        const name = CREW_ROLE_NAMES[c.homeRole];
        const seat = c.swap ? `<span class="swap">→${CREW_ROLE_NAMES[c.swap.to]}</span>` : c.seat && c.seat !== c.homeRole ? `(${CREW_ROLE_NAMES[c.seat]})` : '';
        const pct = c.alive && c.hp < 100 ? ` ${Math.round(c.hp)}%` : '';
        return `<span><i class="dot" style="background:${ratioColor(c.alive ? c.hp / 100 : 0)}"></i>${name}${seat}${pct}</span>`;
      })
      .join('');
    const modules = d.modules
      .filter((m) => m.type !== 'ammo' && m.type !== 'fuel')
      .map((m) => `<span><i class="dot" style="background:${ratioColor(m.hp / m.maxHp)}"></i>${m.name}</span>`)
      .join('');
    let repair = '';
    if (d.repair) repair = `<div class="repair">维修中 ${(d.repair.remaining / Math.max(d.repairRate, 1e-6)).toFixed(1)}s(F 取消)</div>`;
    else if (d.brokenRepairable().length) repair = `<div class="repair">有模块被打坏 — 按 F 维修</div>`;
    else if (d.damagedRepairable().length) repair = `<div class="repair" style="opacity:.75">有模块受损 — 可按 F 维修</div>`;
    const html = `<div>${Math.round(s.speedKmh)} km/h · ${s.surface} · 乘员 ${d.aliveCount}/${d.crew.length} · 弹药 ${s.ammo.reduce((n, a) => n + a.count, 0)}/${d.ammoCapacity}</div><div class="row">${crew}</div><div class="row">${modules}</div>${repair}`;
    if (html !== this.lastStatus) {
      this.status.innerHTML = html;
      this.lastStatus = html;
    }
  }

  private pushFeed(html: string, cls: string, now: number): void {
    const item = el('div', cls, this.feed);
    item.innerHTML = html;
    this.feedItems.push({ el: item, bornAt: now });
    while (this.feedItems.length > FEED_MAX) this.feedItems.shift()?.el.remove();
  }

  private setOverlay(mode: OverlayMode): void {
    this.overlayMode = mode;
    this.overlay.classList.toggle('hidden', mode === null);
    if (mode === 'start') {
      this.card.innerHTML = `
        <h1>河谷试验场</h1>
        <p>点击画面开始(锁定鼠标);Esc 暂停</p>
        <p class="keys">WASD 移动车体 · 鼠标 转动视角,炮塔会跟随准星 · 左键 / 空格 开火 · 1–4 切换弹种<br>
        Shift 开镜 / 关镜 · Z 切换倍率 · 滚轮 调表尺(下滚加远)· F 维修 · R 重新开始</p>
        <p class="keys">远处目标:开镜后用分划估距(两侧三角间隔 4 密位,3 m 高的坦克占 4 密位 ≈ 750 m),
        把表尺调到这个距离再打。北边每 500 m 有一根测距标杆。敌方发现你(或被你打)后会还击。</p>`;
      this.renderLoadoutEditor();
    } else if (mode === 'victory') {
      this.card.innerHTML = `<h1>训练完成</h1><p>全部靶车已摧毁</p><p class="keys">按 R 重新开始</p>`;
    } else if (mode === 'defeat') {
      this.card.innerHTML = `<h1>被击毁</h1><p>存活乘员不足或弹药殉爆</p><p class="keys">按 R 重新开始</p>`;
    }
  }

  /** 开始界面里的携弹编辑器:每种弹 − / + ,「应用并重新开始」生效 */
  private renderLoadoutEditor(): void {
    const ed = this.editor;
    if (!ed) return;
    const box = el('div', 'hud-loadout', this.card);
    box.addEventListener('click', (ev) => ev.stopPropagation());
    const cap = ammoCapacity(ed.spec);
    const draw = () => {
      const ammo = ed.spec.weapons[0]?.ammo ?? [];
      const total = loadoutTotal(this.draft);
      box.innerHTML = `<div>携弹(弹药架共 ${cap} 发;少带弹时最先取空的弹药架会空着)</div>
        <table>${ammo
          .map(
            (a) =>
              `<tr><td>${a.name}</td><td>${SHELL_TYPES[a.type].name} · ${SHELL_SHORT[a.type]}</td>
              <td><button data-id="${a.id}" data-d="-5">−</button></td><td class="n">${this.draft[a.id] ?? 0}</td>
              <td><button data-id="${a.id}" data-d="5">+</button></td></tr>`,
          )
          .join('')}</table>
        <div class="total">合计 ${total} / ${cap} 发</div>
        <button class="apply">应用并重新开始</button>`;
      box.querySelectorAll<HTMLButtonElement>('button[data-id]').forEach((b) =>
        b.addEventListener('click', () => {
          const id = b.dataset.id!;
          const delta = Number(b.dataset.d);
          const next = { ...this.draft, [id]: Math.max(0, (this.draft[id] ?? 0) + delta) };
          // 超出容量时只加到满为止
          if (loadoutTotal(next) > cap) next[id] = Math.max(0, (this.draft[id] ?? 0) + (cap - loadoutTotal(this.draft)));
          this.draft = clampLoadout(ed.spec, next);
          draw();
        }),
      );
      box.querySelector<HTMLButtonElement>('button.apply')!.addEventListener('click', () => ed.onApply({ ...this.draft }));
    };
    draw();
  }
}
