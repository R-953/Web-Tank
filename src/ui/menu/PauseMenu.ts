import { h, injectMenuStyles } from './styles';

export type PauseMode = 'pause' | 'victory' | 'defeat';

export interface PauseHandlers {
  /** 继续战斗:在点击事件里同步调用(调用方要在这里申请锁定鼠标) */
  onResume(): void;
  onSettings(): void;
  onRestart(): void;
  onExit(): void;
}

const TITLES: Record<PauseMode, string> = { pause: '暂停', victory: '训练完成', defeat: '被击毁' };

/** 战斗中的 Esc 菜单与胜负结算卡片(画面保持在暂停的战场上) */
export class PauseMenu {
  private readonly root: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private modeValue: PauseMode | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: PauseHandlers,
    private readonly opts: { onUiSound?(): void } = {},
  ) {
    injectMenuStyles();
    this.root = h('div', 'mm-pause hidden', parent);
    this.card = h('div', 'mm-panel mm-card', this.root);
  }

  get visible(): boolean {
    return this.modeValue !== null;
  }

  get mode(): PauseMode | null {
    return this.modeValue;
  }

  show(mode: PauseMode, info: { lines?: string[] } = {}): void {
    this.modeValue = mode;
    this.root.classList.remove('hidden');
    this.card.innerHTML = '';
    h('h1', mode === 'defeat' ? 'mm-err' : mode === 'victory' ? 'mm-accent' : '', this.card, TITLES[mode]);
    for (const line of info.lines ?? []) h('p', 'mm-dim', this.card, line);
    const btns = h('div', 'btns', this.card);
    const button = (text: string, fn: () => void, primary = false) => {
      const b = h('button', `mm-btn${primary ? ' primary' : ''}`, btns, text);
      b.addEventListener('click', () => {
        this.opts.onUiSound?.();
        fn();
      });
    };
    if (mode === 'pause') {
      button('继续战斗', () => this.handlers.onResume(), true);
      button('设置', () => this.handlers.onSettings());
    }
    button('重新开始', () => this.handlers.onRestart(), mode !== 'pause');
    button('返回机库', () => this.handlers.onExit());
  }

  hide(): void {
    this.modeValue = null;
    this.root.classList.add('hidden');
  }
}
