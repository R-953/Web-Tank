import type { HitReplay } from '../game/Game';

/**
 * 命中回放的文字和图标层(War Thunder 回放的做法,见 docs/tasks/065):
 *   - 画面顶部中间一行大字:这一发的结果,随回放进展升级;
 *   - 左下四个模块类别图标:动力 / 火炮 / 炮塔驱动 / 弹药架,没事是灰的,受损变红;
 *   - 右下乘员「存活 / 总数」。
 * 065 负责实现纯函数和 DOM 组件;066 在 KillCam 里使用它。
 */

/** 这一发的结果。弱 → 强:跳弹 < 未击穿 < 击穿 < 命中 < 引燃 < 致命攻击 < 乘员昏迷 < 弹药殉爆 */
export type HitOutcome =
  | 'ricochet'
  | 'nopen'
  | 'penetrated'
  | 'hit'
  | 'ignited'
  | 'critical'
  | 'crew-out'
  | 'ammo-exploded';

/** 顶部文字的语气:info = 白(跳弹 / 未击穿),hit = 黄(击穿 / 命中),fire = 橙(引燃),severe = 红(致命攻击 / 乘员昏迷 / 殉爆) */
export type CaptionTone = 'info' | 'hit' | 'fire' | 'severe';

export interface CaptionState {
  text: string;
  tone: CaptionTone;
}

/** 四个模块类别 */
export type ModuleGroup = 'engine' | 'gun' | 'turret' | 'ammo';

/** 图标状态:ok 灰(没受损),damaged 红(受损),destroyed 深红 / 黑(报废) */
export type IconState = 'ok' | 'damaged' | 'destroyed';

export interface CrewCount {
  alive: number;
  total: number;
}

const STYLE_ID = 'kco-style';

const CAPTION_PENETRATED = '命中';
const CAPTION_HIT = '命中';
// 来自 hitcamera/result/critical 的简体「重创」(繁体为「致命攻擊」),负责人 10-03 同意按仓库写法。
const CAPTION_CRITICAL = '重创';
const CAPTION_CREW_OUT = '乘员昏迷';

const GROUP_TYPES: Record<ModuleGroup, string[]> = {
  engine: ['engine', 'transmission', 'fuel'],
  gun: ['barrel', 'breech'],
  turret: ['traverse', 'elevation'],
  ammo: ['ammo'],
};

const SVG_ENGINE =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v2H4v2h2v7H4v2h3v2h2v-2h6v2h2v-2h3v-2h-2V8h2V6h-3V4h-2v2H9V4H7zm2 4h6v7H9V8z"/></svg>';

const SVG_GUN =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11h11V8l7 4-7 4v-3H3v-2z"/></svg>';

const SVG_TURRET =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 15h16v3H4v-3zm2-6h8l3 6H7l-1-6zm9 2h6v2h-6v-2z"/></svg>';

const SVG_AMMO =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 6c0-2 2-4 2-4s2 2 2 4v12H7V6zm6 0c0-2 2-4 2-4s2 2 2 4v12h-4V6z"/></svg>';

const SVG_CREW =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm-6 14v2h12v-2c0-3.3-2.7-6-6-6s-6 2.7-6 6z"/></svg>';

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.kco-root {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  box-sizing: border-box;
  container-type: inline-size;
}

.kco-caption {
  position: absolute;
  top: 14px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: "Arial Narrow", "Microsoft YaHei", sans-serif;
  font-weight: 700;
  font-size: 40px;
  line-height: 1.1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  user-select: none;
}

@container (max-width: 480px) {
  .kco-caption {
    font-size: 22px;
    top: 10px;
  }
}

.kco-caption-info {
  color: #f2f2f2;
}

.kco-caption-hit {
  color: #ffd83a;
}

.kco-caption-fire {
  color: #ff8a2a;
}

.kco-caption-severe {
  color: #ff3b30;
}

@keyframes kco-caption-pop {
  0% {
    transform: scale(1.22);
  }
  60% {
    transform: scale(0.96);
  }
  100% {
    transform: scale(1);
  }
}

.kco-caption-pop {
  animation: kco-caption-pop 0.15s ease-out;
}

.kco-icons {
  position: absolute;
  bottom: 12px;
  left: 14px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.kco-icon {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
}

.kco-icon svg {
  width: 100%;
  height: 100%;
}

.kco-icon-ok {
  color: #8a949c;
}

.kco-icon-damaged {
  color: #ff3b30;
}

.kco-icon-destroyed {
  color: #7a1410;
}

.kco-crew {
  position: absolute;
  bottom: 12px;
  right: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: "Arial Narrow", "Microsoft YaHei", sans-serif;
  font-weight: 700;
  font-size: 15px;
  line-height: 1;
  color: #f2f2f2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9);
}

.kco-crew.kco-crew-lost {
  color: #ff3b30;
}

.kco-crew-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kco-crew-icon svg {
  width: 100%;
  height: 100%;
}

.kco-crew-text {
  display: inline-block;
}
`;
  document.head.appendChild(style);
}

/** 整段回放结束时的最终结果(用于选标题的最终档位和回放时长) */
export function hitOutcome(replay: HitReplay): HitOutcome {
  if (!replay.armor || (!replay.armor.penetrated && !replay.armor.ricochet)) {
    return 'nopen';
  }
  if (replay.armor.ricochet) {
    return 'ricochet';
  }
  if (replay.armor.penetrated) {
    if (replay.detonated) {
      return 'ammo-exploded';
    }
    const isCrewKnockedOut =
      replay.destroyed ||
      Boolean(replay.penetration?.knockedOut);
    if (isCrewKnockedOut) {
      return 'crew-out';
    }

    const crewDamaged =
      (replay.penetration?.hits ?? []).some((h) => h.kind === 'crew' && h.hpAfter < h.hpBefore) ||
      replay.layout.crew.some((c) => {
        const afterVal = replay.after[c.id] ?? 1;
        const beforeVal = replay.before[c.id] ?? 1;
        return afterVal < beforeVal;
      });

    const moduleDamaged =
      (replay.penetration?.hits ?? []).some((h) => h.kind === 'module' && h.hpAfter < h.hpBefore) ||
      (replay.external ?? []).some((e) => e.hpAfter < e.hpBefore) ||
      replay.layout.modules.some((m) => {
        const afterVal = replay.after[m.id] ?? 1;
        const beforeVal = replay.before[m.id] ?? 1;
        return afterVal < beforeVal;
      });

    const ignited = Boolean(replay.ignited);

    if (ignited && crewDamaged) {
      return 'critical';
    }
    if (ignited) {
      return 'ignited';
    }
    if (crewDamaged || moduleDamaged) {
      return 'hit';
    }
    return 'penetrated';
  }
  return 'nopen';
}

/** t 秒时某个模块 / 乘员的血量比例(0..1):接触前是 before,命中记录的时刻跳变,最后是 after */
export function ratioAt(replay: HitReplay, id: string, t: number, tContact: number): number {
  if (t < tContact) {
    return replay.before[id] ?? 1;
  }
  const tl: Array<[number, number]> = [[-1, replay.before[id] ?? 1]];
  for (const e of replay.external) {
    if (e.id === id) {
      tl.push([tContact, e.hpAfter / e.maxHp]);
    }
  }
  for (const h of replay.penetration?.hits ?? []) {
    if (h.id === id) {
      tl.push([tContact + h.time, h.hpAfter / h.maxHp]);
    }
  }
  const duration = replay.penetration?.duration ?? 0;
  tl.push([tContact + duration + 0.05, replay.after[id] ?? (replay.before[id] ?? 1)]);
  tl.sort((a, b) => a[0] - b[0]);

  let ratio = tl[0][1];
  for (const [time, value] of tl) {
    if (t >= time) {
      ratio = value;
    }
  }
  return ratio;
}

/**
 * t 秒时顶部要显示的文字。t = 回放开始后的秒数,tContact = 炮弹接触车体的时刻(之前返回 null)。
 * 接触后:跳弹 →「跳弹」,未击穿 →「未击穿」,击穿 →「命中」;
 * 随时间升级(击穿 → 命中 → 引燃 → 致命攻击 → 乘员昏迷 → 弹药殉爆),每一档在对应事件发生的时间点切换,只升不降。
 * 引燃发生的时间点 = 这一发里第一个伤到发动机 / 油箱 / 弹药架的时间(没有就取接触时刻)。
 */
export function killcamCaption(replay: HitReplay, t: number, tContact: number): CaptionState | null {
  if (t < tContact) return null;

  if (!replay.armor || (!replay.armor.penetrated && !replay.armor.ricochet)) {
    return { text: '未击穿', tone: 'info' };
  }
  if (replay.armor.ricochet) {
    return { text: '跳弹', tone: 'info' };
  }

  // 1. 命中:击伤乘员或损坏模块
  let tHit = Infinity;
  for (const hit of replay.penetration?.hits ?? []) {
    if ((hit.kind === 'crew' || hit.kind === 'module') && hit.hpAfter < hit.hpBefore) {
      const ht = tContact + hit.time;
      if (ht < tHit) {
        tHit = ht;
      }
    }
  }

  // 2. 引燃:这一发里第一个伤到发动机 / 油箱 / 弹药架的时间(没有就取接触时刻)
  const FIRE_MODULE_TYPES = new Set(['engine', 'fuel', 'ammo']);
  let tIgnited = Infinity;
  if (replay.ignited) {
    let firstFireModuleTime = Infinity;
    for (const hit of replay.penetration?.hits ?? []) {
      if (hit.kind === 'module' && hit.hpAfter < hit.hpBefore) {
        const modType = replay.layout.modules.find((m) => m.id === hit.id)?.type ?? '';
        if (
          FIRE_MODULE_TYPES.has(modType) ||
          FIRE_MODULE_TYPES.has(hit.id) ||
          hit.id.startsWith('engine') ||
          hit.id.startsWith('fuel') ||
          hit.id.startsWith('ammo')
        ) {
          const ht = tContact + hit.time;
          if (ht < firstFireModuleTime) {
            firstFireModuleTime = ht;
          }
        }
      }
    }
    tIgnited = firstFireModuleTime < Infinity ? firstFireModuleTime : tContact;
  }

  // 3. 致命攻击:点着了火,并且击伤乘员
  let tCrewWounded = Infinity;
  for (const hit of replay.penetration?.hits ?? []) {
    if (hit.kind === 'crew' && hit.hpAfter < hit.hpBefore) {
      const ht = tContact + hit.time;
      if (ht < tCrewWounded) {
        tCrewWounded = ht;
      }
    }
  }
  let tCritical = Infinity;
  if (replay.ignited && tCrewWounded < Infinity) {
    tCritical = Math.max(tIgnited, tCrewWounded);
  }

  // 4. 击毁:乘员昏迷
  let tCrewKnockout = Infinity;
  if (replay.destroyed || Boolean(replay.penetration?.knockedOut)) {
    let fatalTime = Infinity;
    for (const hit of replay.penetration?.hits ?? []) {
      if (hit.kind === 'crew' && (hit.destroyed || hit.hpAfter <= 0)) {
        const ht = tContact + hit.time;
        if (ht < fatalTime) {
          fatalTime = ht;
        }
      }
    }
    if (fatalTime < Infinity) {
      tCrewKnockout = fatalTime;
    } else {
      tCrewKnockout = tContact + (replay.penetration?.duration ?? 0);
    }
  }

  // 5. 击毁:弹药殉爆
  let tAmmoExploded = Infinity;
  if (replay.detonated) {
    const explosionTime = replay.penetration?.explosion?.time ?? replay.penetration?.duration ?? 0;
    tAmmoExploded = tContact + explosionTime;
  }

  if (t >= tAmmoExploded) {
    return { text: '弹药殉爆', tone: 'severe' };
  }
  if (t >= tCrewKnockout) {
    return { text: CAPTION_CREW_OUT, tone: 'severe' };
  }
  if (t >= tCritical) {
    return { text: CAPTION_CRITICAL, tone: 'severe' };
  }
  if (t >= tIgnited) {
    return { text: '引燃', tone: 'fire' };
  }
  if (t >= tHit) {
    return { text: CAPTION_HIT, tone: 'hit' };
  }
  return { text: CAPTION_PENETRATED, tone: 'hit' };
}

/** t 秒时四个类别图标的状态(类别归属见 065 卡:engine = 发动机 / 变速箱 / 油箱,gun = 炮管 / 炮闩,turret = 方向机 / 高低机,ammo = 弹药架) */
export function killcamIcons(replay: HitReplay, t: number, tContact: number): Record<ModuleGroup, IconState> {
  const result: Record<ModuleGroup, IconState> = {
    engine: 'ok',
    gun: 'ok',
    turret: 'ok',
    ammo: 'ok',
  };

  for (const group of ['engine', 'gun', 'turret', 'ammo'] as const) {
    const types = GROUP_TYPES[group];
    const mods = replay.layout.modules.filter((m) => types.includes(m.type));
    if (mods.length === 0) {
      result[group] = 'ok';
      continue;
    }
    const ratios = mods.map((m) => ratioAt(replay, m.id, t, tContact));
    if (ratios.every((r) => r <= 0)) {
      result[group] = 'destroyed';
    } else if (ratios.some((r) => r < 1)) {
      result[group] = 'damaged';
    } else {
      result[group] = 'ok';
    }
  }

  return result;
}

/** t 秒时乘员存活数 / 总数 */
export function killcamCrew(replay: HitReplay, t: number, tContact: number): CrewCount {
  const total = replay.layout.crew.length;
  let alive = 0;
  for (const c of replay.layout.crew) {
    if (ratioAt(replay, c.id, t, tContact) > 0) {
      alive++;
    }
  }
  return { alive, total };
}

/**
 * 回放窗口里的文字和图标层。挂在 KillCam 的 frame 元素里(绝对定位,pointer-events: none)。
 * show() 重置并绑定这一段回放;update() 每帧调用;hide() 隐藏。
 */
export class KillCamOverlay {
  readonly root: HTMLDivElement;
  private readonly captionEl: HTMLDivElement;
  private readonly iconsEl: HTMLDivElement;
  private readonly iconEls: Record<ModuleGroup, HTMLDivElement>;
  private readonly crewEl: HTMLDivElement;
  private readonly crewTextEl: HTMLSpanElement;

  private replay: HitReplay | null = null;
  private lastCaptionText: string | null = null;
  private lastCaptionTone: CaptionTone | null = null;
  private readonly lastIconStates: Record<ModuleGroup, IconState> = {
    engine: 'ok',
    gun: 'ok',
    turret: 'ok',
    ammo: 'ok',
  };
  private lastCrewAlive = -1;
  private lastCrewTotal = -1;

  constructor(parent: HTMLElement) {
    ensureStyles();

    this.root = document.createElement('div');
    this.root.className = 'kco-root';
    this.root.style.display = 'none';

    this.captionEl = document.createElement('div');
    this.captionEl.className = 'kco-caption';
    this.root.appendChild(this.captionEl);

    this.iconsEl = document.createElement('div');
    this.iconsEl.className = 'kco-icons';
    this.iconEls = {
      engine: this.createIcon('engine', SVG_ENGINE),
      gun: this.createIcon('gun', SVG_GUN),
      turret: this.createIcon('turret', SVG_TURRET),
      ammo: this.createIcon('ammo', SVG_AMMO),
    };
    for (const group of ['engine', 'gun', 'turret', 'ammo'] as const) {
      this.iconsEl.appendChild(this.iconEls[group]);
    }
    this.root.appendChild(this.iconsEl);

    this.crewEl = document.createElement('div');
    this.crewEl.className = 'kco-crew';
    const crewIconSpan = document.createElement('span');
    crewIconSpan.className = 'kco-crew-icon';
    crewIconSpan.innerHTML = SVG_CREW;
    this.crewEl.appendChild(crewIconSpan);

    this.crewTextEl = document.createElement('span');
    this.crewTextEl.className = 'kco-crew-text';
    this.crewEl.appendChild(this.crewTextEl);
    this.root.appendChild(this.crewEl);

    parent.appendChild(this.root);
  }

  private createIcon(group: ModuleGroup, svgHtml: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `kco-icon kco-icon-${group} kco-icon-ok`;
    el.innerHTML = svgHtml;
    return el;
  }

  show(replay: HitReplay): void {
    this.replay = replay;
    this.root.style.display = 'block';

    this.captionEl.textContent = '';
    this.captionEl.className = 'kco-caption';
    this.lastCaptionText = '';
    this.lastCaptionTone = null;

    for (const group of ['engine', 'gun', 'turret', 'ammo'] as const) {
      this.iconEls[group].className = `kco-icon kco-icon-${group} kco-icon-ok`;
      this.lastIconStates[group] = 'ok';
    }

    this.crewTextEl.textContent = '';
    this.crewEl.className = 'kco-crew';
    this.lastCrewAlive = -1;
    this.lastCrewTotal = -1;
  }

  update(t: number, tContact: number): void {
    if (!this.replay) return;

    // 1. 顶部标题
    const caption = killcamCaption(this.replay, t, tContact);
    const text = caption?.text ?? '';
    const tone = caption?.tone ?? null;

    if (text !== this.lastCaptionText || tone !== this.lastCaptionTone) {
      this.lastCaptionText = text;
      this.lastCaptionTone = tone;
      this.captionEl.textContent = text;
      this.captionEl.className = 'kco-caption' + (tone ? ` kco-caption-${tone}` : '');
      if (text) {
        this.captionEl.classList.remove('kco-caption-pop');
        void this.captionEl.offsetWidth;
        this.captionEl.classList.add('kco-caption-pop');
      }
    }

    // 2. 左下模块图标
    const icons = killcamIcons(this.replay, t, tContact);
    for (const group of ['engine', 'gun', 'turret', 'ammo'] as const) {
      const state = icons[group];
      if (state !== this.lastIconStates[group]) {
        this.lastIconStates[group] = state;
        this.iconEls[group].className = `kco-icon kco-icon-${group} kco-icon-${state}`;
      }
    }

    // 3. 右下乘员数
    const crew = killcamCrew(this.replay, t, tContact);
    if (crew.alive !== this.lastCrewAlive || crew.total !== this.lastCrewTotal) {
      this.lastCrewAlive = crew.alive;
      this.lastCrewTotal = crew.total;
      this.crewTextEl.textContent = `${crew.alive} / ${crew.total}`;
      if (crew.alive < crew.total) {
        this.crewEl.classList.add('kco-crew-lost');
      } else {
        this.crewEl.classList.remove('kco-crew-lost');
      }
    }
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
