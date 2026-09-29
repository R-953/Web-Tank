import { ACTIONS, MOUSE_BUTTON_NAMES, bindingLabel, defaultBindings, findConflicts, ACTION_BY_ID, type ActionGroup, type ActionId } from '../../data/controls';
import { AI_PRESETS, type AIPresetId } from '../../data/ai';
import { GRAPHICS_PRESETS, type GameSettings, type GraphicsPreset, type SettingsStore } from '../../settings/Settings';
import { importWtBindings } from '../../settings/wtImport';
import { h, injectMenuStyles } from './styles';

export type SettingsTab = 'game' | 'graphics' | 'sound' | 'controls';

const TAB_NAMES: Record<SettingsTab, string> = { game: '游戏', graphics: '图像', sound: '声音', controls: '操作' };
const GROUPS: readonly ActionGroup[] = ['驾驶', '武器', '瞄准', '车辆', '界面'];

/**
 * 设置窗口(主界面和暂停菜单共用):游戏 / 图像 / 声音 / 操作四个页签。
 * 每项改动立即通过 SettingsStore.update 生效并保存,没有「确定 / 取消」;关闭用右上角按钮或 Esc。
 */
export class SettingsPanel {
  private readonly root: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly tabs = new Map<SettingsTab, HTMLButtonElement>();
  private tab: SettingsTab = 'game';
  private capture: { action: ActionId; slot: 0 | 1; el: HTMLButtonElement; armedAt: number } | null = null;
  private importMsg: { text: string; ok: boolean } | null = null;
  private readonly captureHandler = (e: Event) => this.onCaptureEvent(e);

  constructor(
    parent: HTMLElement,
    private readonly settings: SettingsStore,
    private readonly opts: { onClose?(): void; onUiSound?(): void } = {},
  ) {
    injectMenuStyles();
    this.root = h('div', 'mm-modal hidden', parent);
    const win = h('div', 'mm-panel mm-window', this.root);
    const header = h('header', '', win);
    for (const t of Object.keys(TAB_NAMES) as SettingsTab[]) {
      const b = h('button', 'tab', header, TAB_NAMES[t]);
      b.addEventListener('click', () => {
        this.click();
        this.show(t);
      });
      this.tabs.set(t, b);
    }
    const close = h('button', 'mm-btn close', header, '关闭');
    close.addEventListener('click', () => {
      this.click();
      this.close();
    });
    this.body = h('div', 'body', win);
    this.root.addEventListener('mousedown', (e) => {
      if (e.target === this.root) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && !this.capture && e.code === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  open(tab: SettingsTab = this.tab): void {
    this.root.classList.remove('hidden');
    this.show(tab);
  }

  close(): void {
    if (!this.isOpen) return;
    this.stopCapture();
    this.root.classList.add('hidden');
    this.opts.onClose?.();
  }

  private click(): void {
    this.opts.onUiSound?.();
  }

  private show(tab: SettingsTab): void {
    this.stopCapture();
    this.tab = tab;
    this.tabs.forEach((b, t) => b.classList.toggle('on', t === tab));
    this.render();
  }

  private render(): void {
    const scroll = this.body.scrollTop;
    this.body.innerHTML = '';
    const s = this.settings.value;
    if (this.tab === 'game') this.renderGame(s);
    else if (this.tab === 'graphics') this.renderGraphics(s);
    else if (this.tab === 'sound') this.renderSound(s);
    else this.renderControls(s);
    this.body.scrollTop = scroll;
  }

  private update(mutate: (d: GameSettings) => void, rerender = false): void {
    this.settings.update(mutate);
    if (rerender) this.render();
  }

  // ------------------------------------------------------------------ 控件

  private row(label: string, hint?: string): HTMLDivElement {
    const r = h('div', 'mm-row', this.body);
    const l = h('div', 'lbl', r, label);
    if (hint) h('small', '', l, hint);
    return h('div', '', r);
  }

  private checkbox(label: string, value: boolean, onChange: (v: boolean) => void, hint?: string): void {
    const box = h('input', '', this.row(label, hint));
    box.type = 'checkbox';
    box.checked = value;
    box.addEventListener('change', () => {
      this.click();
      onChange(box.checked);
    });
  }

  private slider(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    format: (v: number) => string,
    onChange: (v: number) => void,
    hint?: string,
  ): void {
    const cell = this.row(label, hint);
    const input = h('input', '', cell);
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const val = h('span', 'val', cell, format(value));
    input.addEventListener('input', () => {
      const v = Number(input.value);
      val.textContent = format(v);
      onChange(v);
    });
    input.addEventListener('change', () => {
      if (this.tab === 'graphics') this.render();
    });
  }

  private segmented<T extends string>(label: string, value: T, options: readonly { id: T; name: string }[], onChange: (v: T) => void, hint?: string): void {
    const seg = h('div', 'mm-seg', this.row(label, hint));
    for (const o of options) {
      const b = h('button', `mm-btn${o.id === value ? ' on' : ''}`, seg, o.name);
      b.addEventListener('click', () => {
        this.click();
        onChange(o.id);
      });
    }
  }

  // ------------------------------------------------------------------ 页签

  private renderGame(s: GameSettings): void {
    const cell = this.row('敌方 AI 强度', '下一局生效');
    for (const id of Object.keys(AI_PRESETS) as AIPresetId[]) {
      const p = AI_PRESETS[id];
      const label = h('label', 'mm-radio', cell);
      const input = h('input', '', label);
      input.type = 'radio';
      input.name = 'mm-ai';
      input.checked = s.game.aiPreset === id;
      label.append(p.name);
      h('small', '', label, p.description);
      input.addEventListener('change', () => {
        this.click();
        this.update((d) => (d.game.aiPreset = id));
      });
    }
    this.checkbox('击毁回放', s.game.killCam, (v) => this.update((d) => (d.game.killCam = v)), '击毁目标后在右上角回放这一发');
    this.segmented(
      '小地图形状',
      s.game.minimapShape,
      [
        { id: 'square', name: '方形' },
        { id: 'circle', name: '圆形' },
      ],
      (v) => this.update((d) => (d.game.minimapShape = v), true),
      '战斗中也可以按 M 切换',
    );
    this.checkbox('显示操作提示', s.game.showHints, (v) => this.update((d) => (d.game.showHints = v)));
    this.checkbox('显示帧率', s.game.showFps, (v) => this.update((d) => (d.game.showFps = v)));
  }

  private renderGraphics(s: GameSettings): void {
    const g = s.graphics;
    const presets: { id: GraphicsPreset | 'custom'; name: string }[] = [
      { id: 'low', name: '低' },
      { id: 'medium', name: '中' },
      { id: 'high', name: '高' },
    ];
    if (g.preset === 'custom') presets.push({ id: 'custom', name: '自定义' });
    this.segmented('画质预设', g.preset, presets, (v) => {
      if (v === 'custom') return;
      this.update((d) => Object.assign(d.graphics, GRAPHICS_PRESETS[v], { preset: v }), true);
    });
    // 拖滑块时不重画(会打断拖动),松手后再重画一次,让预设按钮显示「自定义」
    const custom = (mutate: (d: GameSettings) => void, rerender = false) =>
      this.update((d) => {
        mutate(d);
        d.graphics.preset = 'custom';
      }, rerender);
    this.segmented(
      '阴影',
      g.shadows,
      [
        { id: 'off', name: '关' },
        { id: 'low', name: '低' },
        { id: 'high', name: '高' },
      ],
      (v) => custom((d) => (d.graphics.shadows = v), true),
    );
    this.slider('渲染分辨率', g.renderScale, 0.5, 1.5, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => custom((d) => (d.graphics.renderScale = v)));
    this.slider('视距', g.viewDistance, 1000, 6000, 250, (v) => `${v} m`, (v) => custom((d) => (d.graphics.viewDistance = v)));
    this.slider('植被密度', g.vegetation, 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => custom((d) => (d.graphics.vegetation = v)), '下一局生效');
    this.slider('草丛距离', g.grassDistance, 0, 200, 10, (v) => (v === 0 ? '关' : `${v} m`), (v) => custom((d) => (d.graphics.grassDistance = v)), '下一局生效');
    this.checkbox('抗锯齿', g.antialias, (v) => custom((d) => (d.graphics.antialias = v), true), '刷新页面后生效');
  }

  private renderSound(s: GameSettings): void {
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    this.slider('总音量', s.sound.master, 0, 1, 0.05, pct, (v) => this.update((d) => (d.sound.master = v)));
    this.slider('音效', s.sound.effects, 0, 1, 0.05, pct, (v) => this.update((d) => (d.sound.effects = v)), '炮声、命中、爆炸');
    this.slider('发动机', s.sound.engine, 0, 1, 0.05, pct, (v) => this.update((d) => (d.sound.engine = v)));
    this.checkbox('静音', s.sound.muted, (v) => this.update((d) => (d.sound.muted = v)));
  }

  private renderControls(s: GameSettings): void {
    const c = s.controls;
    const x = (v: number) => `×${v.toFixed(2)}`;
    this.slider('第三人称鼠标灵敏度', c.mouseSensitivity, 0.1, 5, 0.05, x, (v) => this.update((d) => (d.controls.mouseSensitivity = v)));
    this.slider('瞄准镜灵敏度', c.sightSensitivity, 0.1, 5, 0.05, x, (v) => this.update((d) => (d.controls.sightSensitivity = v)));
    this.checkbox('瞄准镜灵敏度随倍率缩放', c.scaleWithZoom, (v) => this.update((d) => (d.controls.scaleWithZoom = v)), '开:倍率越高转得越慢(屏幕上的移动速度不变)');
    this.checkbox('反转 Y 轴', c.invertY, (v) => this.update((d) => (d.controls.invertY = v)));

    const tools = h('div', 'mm-keytools', this.body);
    const reset = h('button', 'mm-btn', tools, '恢复默认键位');
    reset.addEventListener('click', () => {
      this.click();
      this.importMsg = null;
      this.update((d) => (d.controls.bindings = defaultBindings()), true);
    });
    const file = h('input', '', tools);
    file.type = 'file';
    file.accept = '.blk';
    file.style.display = 'none';
    const imp = h('button', 'mm-btn', tools, '导入 War Thunder 键位(.blk)');
    imp.addEventListener('click', () => {
      this.click();
      file.value = '';
      file.click();
    });
    file.addEventListener('change', () => this.importFile(file.files?.[0]));
    if (this.importMsg) h('span', this.importMsg.ok ? 'mm-ok' : 'mm-err', tools, this.importMsg.text);
    h('div', 'mm-note', this.body, '点击键位格子后按下新的按键 / 鼠标键 / 滚动滚轮;Esc 取消,Backspace / Delete 清空。Esc 保留给暂停,不能绑定。');

    const conflicts = findConflicts(c.bindings);
    for (const group of GROUPS) {
      h('div', 'mm-group', this.body, group);
      const table = h('table', 'mm-keys', this.body);
      for (const a of ACTIONS.filter((x) => x.group === group)) {
        const tr = h('tr', '', table);
        const name = h('td', 'name', tr, a.name);
        if (a.hint) h('small', '', name, a.hint);
        for (const slot of [0, 1] as const) {
          const td = h('td', 'cell', tr);
          const b = c.bindings[a.id][slot];
          const btn = h('button', `mm-key${b ? '' : ' empty'}`, td, bindingLabel(b));
          const others = b ? (conflicts.get(b) ?? []).filter((id) => id !== a.id) : [];
          if (others.length) {
            btn.classList.add('conflict');
            btn.title = `与「${others.map((id) => ACTION_BY_ID[id].name).join('」「')}」冲突`;
          }
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startCapture(a.id, slot, btn);
          });
        }
      }
    }
  }

  // ------------------------------------------------------------------ 改键

  private startCapture(action: ActionId, slot: 0 | 1, el: HTMLButtonElement): void {
    this.stopCapture();
    this.click();
    this.capture = { action, slot, el, armedAt: performance.now() };
    el.classList.add('capture');
    el.textContent = '按下新的按键…';
    window.addEventListener('keydown', this.captureHandler, true);
    window.addEventListener('keyup', this.captureHandler, true);
    window.addEventListener('mousedown', this.captureHandler, true);
    window.addEventListener('wheel', this.captureHandler, { capture: true, passive: false });
  }

  private stopCapture(): void {
    if (!this.capture) return;
    this.capture = null;
    window.removeEventListener('keydown', this.captureHandler, true);
    window.removeEventListener('keyup', this.captureHandler, true);
    window.removeEventListener('mousedown', this.captureHandler, true);
    window.removeEventListener('wheel', this.captureHandler, true);
  }

  private onCaptureEvent(e: Event): void {
    const cap = this.capture;
    if (!cap) return;
    e.preventDefault();
    e.stopPropagation();
    let binding: string | null | undefined;
    if (e instanceof KeyboardEvent) {
      if (e.type === 'keyup') return;
      if (e.code === 'Escape') {
        this.stopCapture();
        this.render();
        return;
      }
      binding = e.code === 'Backspace' || e.code === 'Delete' ? null : e.code;
    } else if (e instanceof WheelEvent) {
      if (e.deltaY === 0) return;
      binding = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
    } else if (e instanceof MouseEvent) {
      // 开始改键的那一下点击(同一个按钮)不算;之后的点击才算
      if (performance.now() - cap.armedAt < 150) return;
      binding = MOUSE_BUTTON_NAMES[e.button] ?? undefined;
    }
    if (binding === undefined) return;
    this.stopCapture();
    this.update((d) => {
      d.controls.bindings[cap.action][cap.slot] = binding ?? null;
    }, true);
  }

  private importFile(f: File | undefined): void {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const r = importWtBindings(text, this.settings.value.controls.bindings);
      if (r.recognized === 0) {
        this.importMsg = { text: '没有在文件里找到坦克操作的键位(是 War Thunder 的操作设置 .blk 吗?)', ok: false };
        this.render();
        return;
      }
      this.importMsg = {
        text: `已导入 ${r.applied.length} 项操作${r.skippedCombos ? `;跳过 ${r.skippedCombos} 个组合键(本游戏只支持单键)` : ''}`,
        ok: true,
      };
      this.update((d) => (d.controls.bindings = r.bindings), true);
    };
    reader.onerror = () => {
      this.importMsg = { text: '读取文件失败', ok: false };
      this.render();
    };
    reader.readAsText(f);
  }
}
