import type { HitReplay } from '../game/Game';

/**
 * 命中回放的文字和图标层(War Thunder 回放的做法,见 docs/tasks/065):
 *   - 画面顶部中间一行大字:这一发的结果,随回放进展升级(「击穿」→「乘员失去战斗力」→「弹药殉爆」);
 *   - 左下四个模块类别图标:动力 / 火炮 / 炮塔驱动 / 弹药架,没事是灰的,受损变红;
 *   - 右下乘员「存活 / 总数」。
 * 这个文件现在只有类型和空实现(主程占位,065 负责实现纯函数和 DOM 组件;066 在 KillCam 里使用它)。
 */

/** 这一发的结果。弱 → 强:跳弹 < 未击穿 < 击穿 < 乘员失去战斗力 < 弹药殉爆 */
export type HitOutcome = 'ricochet' | 'nopen' | 'penetrated' | 'crew-out' | 'ammo-exploded';

/** 顶部文字的语气:info = 白(跳弹 / 未击穿),hit = 黄(击穿),severe = 红(乘员 / 殉爆) */
export type CaptionTone = 'info' | 'hit' | 'severe';

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

/** 整段回放结束时的最终结果(用于选标题的最终档位和回放时长) */
export function hitOutcome(_replay: HitReplay): HitOutcome {
  return 'penetrated';
}

/**
 * t 秒时顶部要显示的文字。t = 回放开始后的秒数,tContact = 炮弹接触车体的时刻(之前返回 null)。
 * 接触后:跳弹 →「跳弹」,未击穿 →「未击穿」,击穿 →「击穿」;
 * 击穿后第一名乘员阵亡的时刻(tContact + 命中记录的 time)起升级为「乘员失去战斗力」;
 * 弹药殉爆(replay.detonated)的时刻(tContact + explosion.time)起升级为「弹药殉爆」。只升不降。
 */
export function killcamCaption(_replay: HitReplay, _t: number, _tContact: number): CaptionState | null {
  return null;
}

/** t 秒时某个模块 / 乘员的血量比例(0..1):接触前是 before,命中记录的时刻跳变,最后是 after */
export function ratioAt(_replay: HitReplay, _id: string, _t: number, _tContact: number): number {
  return 1;
}

/** t 秒时四个类别图标的状态(类别归属见 065 卡:engine = 发动机 / 变速箱 / 油箱,gun = 炮管 / 炮闩,turret = 方向机 / 高低机,ammo = 弹药架) */
export function killcamIcons(_replay: HitReplay, _t: number, _tContact: number): Record<ModuleGroup, IconState> {
  return { engine: 'ok', gun: 'ok', turret: 'ok', ammo: 'ok' };
}

/** t 秒时乘员存活数 / 总数 */
export function killcamCrew(replay: HitReplay, _t: number, _tContact: number): CrewCount {
  return { alive: replay.layout.crew.length, total: replay.layout.crew.length };
}

/**
 * 回放窗口里的文字和图标层。挂在 KillCam 的 frame 元素里(绝对定位,pointer-events: none)。
 * show() 重置并绑定这一段回放;update() 每帧调用;hide() 隐藏。
 */
export class KillCamOverlay {
  readonly root: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.display = 'none';
    parent.appendChild(this.root);
  }

  show(_replay: HitReplay): void {
    this.root.style.display = 'block';
  }

  update(_t: number, _tContact: number): void {}

  hide(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
