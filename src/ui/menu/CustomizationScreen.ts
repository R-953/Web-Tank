import type { VehicleSpec } from '../../data/types';
import { paintsFor, applyPaint, type PaintSpec } from '../../data/paints';
import { vehicleThumbnail } from './thumbnails';

export interface CustomizationScreenOptions {
  parent: HTMLElement;
  getPaint(vehicleId: string): string | null;
  /** 点「确定」时调用 */
  setPaint(vehicleId: string, paintId: string | null): void;
  /** 选中方案时, 传入已套用涂装的 spec; 取消时传回原 spec */
  onPreview?(spec: VehicleSpec): void;
  onClose?(): void;
  onUiSound?(): void;
}

const STYLE_ID = 'webtank-customization-screen-style';

const CSS_STYLES = `
.cs-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(4px);
  user-select: none;
}
.cs-overlay.hidden {
  display: none !important;
}
.cs-window {
  width: 860px;
  max-width: 94vw;
  height: 560px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background: #191e24;
  border: 1px solid #333d47;
  border-radius: 6px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
  color: #d6dfe7;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden;
}
.cs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: #14181d;
  border-bottom: 1px solid #2a333d;
}
.cs-title {
  font-size: 17px;
  font-weight: 600;
  color: #edf2f7;
  letter-spacing: 0.5px;
}
.cs-close-btn {
  background: transparent;
  border: none;
  color: #7b8895;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.cs-close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}
.cs-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.cs-left-pane {
  width: 380px;
  border-right: 1px solid #2a333d;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #1b2027;
}
.cs-scheme-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #232932;
  border: 2px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.cs-scheme-item:hover {
  background: #2a323d;
}
.cs-scheme-item.selected {
  border-color: #d4af37;
  background: #2b3440;
  box-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
}
.cs-swatch {
  width: 42px;
  height: 42px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.5);
  flex-shrink: 0;
}
.cs-scheme-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cs-scheme-name {
  font-size: 14px;
  font-weight: 600;
  color: #f0f4f8;
}
.cs-scheme-note {
  font-size: 12px;
  color: #9cb0c3;
  line-height: 1.3;
}
.cs-scheme-source {
  font-size: 11px;
  color: #6d7f90;
  line-height: 1.2;
}
.cs-right-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #13171b;
  position: relative;
}
.cs-preview-wrap {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.cs-preview-box {
  width: 360px;
  height: 202px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  overflow: hidden;
  background: #1a2026;
  border: 1px solid #2c3642;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.cs-preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.cs-preview-color-block {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  font-weight: 600;
}
.cs-preview-color-code {
  font-size: 13px;
  opacity: 0.85;
  font-family: monospace;
}
.cs-preview-meta {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cs-preview-title {
  font-size: 16px;
  font-weight: 600;
  color: #edf2f7;
}
.cs-preview-desc {
  font-size: 12px;
  color: #8da0b3;
  max-width: 360px;
  line-height: 1.4;
}
.cs-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 20px;
  background: #161b21;
  border-top: 1px solid #2a333d;
}
.cs-btn {
  padding: 8px 22px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.cs-btn-cancel {
  background: #252d36;
  border: 1px solid #3c4755;
  color: #b0c2d3;
}
.cs-btn-cancel:hover {
  background: #2e3843;
  color: #fff;
}
.cs-btn-confirm {
  background: #cba028;
  border: 1px solid #e1b434;
  color: #0d1217;
}
.cs-btn-confirm:hover {
  background: #dcb032;
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.4);
}
`;

function injectCustomizationStyles(): void {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS_STYLES;
    document.head.appendChild(style);
  }
}

/**
 * 涂装全屏弹层界面。
 * 支持浏览各历史涂装方案、实时机库预览、确定保存与取消恢复。
 */
export class CustomizationScreen {
  readonly root: HTMLElement;
  private currentSpec: VehicleSpec | null = null;
  private originalPaintedSpec: VehicleSpec | null = null;
  private selectedPaintId: string = 'default';
  private isConfirmed = false;
  private readonly handleKeyDown: (e: KeyboardEvent) => void;

  // DOM 节点引用
  private titleEl!: HTMLElement;
  private schemeListEl!: HTMLElement;
  private previewBoxEl!: HTMLElement;
  private previewMetaEl!: HTMLElement;

  constructor(private readonly opts: CustomizationScreenOptions) {
    injectCustomizationStyles();

    this.root = document.createElement('div');
    this.root.className = 'cs-overlay hidden';
    this.opts.parent.appendChild(this.root);

    this.buildDom();

    this.handleKeyDown = (e: KeyboardEvent) => {
      if (this.isOpen && e.code === 'Escape') {
        e.preventDefault();
        this.cancelAndClose();
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  private buildDom(): void {
    const win = document.createElement('div');
    win.className = 'cs-window';
    this.root.appendChild(win);

    // 1. 顶栏
    const header = document.createElement('header');
    header.className = 'cs-header';
    win.appendChild(header);

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'cs-title';
    header.appendChild(this.titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'cs-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭 (Esc)';
    closeBtn.addEventListener('click', () => {
      this.opts.onUiSound?.();
      this.cancelAndClose();
    });
    header.appendChild(closeBtn);

    // 2. 主体区 (左右双栏)
    const body = document.createElement('div');
    body.className = 'cs-body';
    win.appendChild(body);

    this.schemeListEl = document.createElement('div');
    this.schemeListEl.className = 'cs-left-pane';
    body.appendChild(this.schemeListEl);

    const rightPane = document.createElement('div');
    rightPane.className = 'cs-right-pane';
    body.appendChild(rightPane);

    const previewWrap = document.createElement('div');
    previewWrap.className = 'cs-preview-wrap';
    rightPane.appendChild(previewWrap);

    this.previewBoxEl = document.createElement('div');
    this.previewBoxEl.className = 'cs-preview-box';
    previewWrap.appendChild(this.previewBoxEl);

    this.previewMetaEl = document.createElement('div');
    this.previewMetaEl.className = 'cs-preview-meta';
    previewWrap.appendChild(this.previewMetaEl);

    // 3. 底栏 (确定 / 取消)
    const footer = document.createElement('footer');
    footer.className = 'cs-footer';
    win.appendChild(footer);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cs-btn cs-btn-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => {
      this.opts.onUiSound?.();
      this.cancelAndClose();
    });
    footer.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'cs-btn cs-btn-confirm';
    confirmBtn.textContent = '确定';
    confirmBtn.addEventListener('click', () => {
      this.opts.onUiSound?.();
      this.confirmAndClose();
    });
    footer.appendChild(confirmBtn);

    // 点击遮罩空白区域取消关闭
    this.root.addEventListener('mousedown', (e) => {
      if (e.target === this.root) {
        this.opts.onUiSound?.();
        this.cancelAndClose();
      }
    });
  }

  /** 打开指定载具的涂装界面 */
  open(spec: VehicleSpec): void {
    this.currentSpec = spec;
    this.isConfirmed = false;

    // 读取当前已保存的涂装
    const savedPaintId = this.opts.getPaint(spec.id);
    this.selectedPaintId = savedPaintId ?? 'default';

    // 记录打开前的载具状态(用于取消时还原)
    this.originalPaintedSpec = applyPaint(spec, savedPaintId);

    // 更新界面标题
    this.titleEl.textContent = `涂装 · ${spec.name}`;

    // 渲染方案列表与预览
    this.renderSchemes();
    this.updatePreview();

    this.root.classList.remove('hidden');
  }

  /** 关闭界面(若未确认则自动恢复原始涂装) */
  close(): void {
    if (!this.isOpen) return;
    if (!this.isConfirmed && this.originalPaintedSpec) {
      this.opts.onPreview?.(this.originalPaintedSpec);
    }
    this.root.classList.add('hidden');
    this.opts.onClose?.();
  }

  private confirmAndClose(): void {
    if (!this.currentSpec) return;
    this.isConfirmed = true;
    const saveId = this.selectedPaintId === 'default' ? null : this.selectedPaintId;
    this.opts.setPaint(this.currentSpec.id, saveId);
    this.root.classList.add('hidden');
    this.opts.onClose?.();
  }

  private cancelAndClose(): void {
    this.close();
  }

  private renderSchemes(): void {
    if (!this.currentSpec) return;
    this.schemeListEl.innerHTML = '';
    const schemes = paintsFor(this.currentSpec);

    schemes.forEach((scheme) => {
      const item = document.createElement('div');
      item.className = `cs-scheme-item ${scheme.id === this.selectedPaintId ? 'selected' : ''}`;
      item.dataset.paintId = scheme.id;

      // 色块
      const swatch = document.createElement('div');
      swatch.className = 'cs-swatch';
      const hex = scheme.color.toString(16).padStart(6, '0');
      swatch.style.backgroundColor = `#${hex}`;
      item.appendChild(swatch);

      // 信息
      const info = document.createElement('div');
      info.className = 'cs-scheme-info';

      const name = document.createElement('div');
      name.className = 'cs-scheme-name';
      name.textContent = scheme.name;
      info.appendChild(name);

      if (scheme.note) {
        const note = document.createElement('div');
        note.className = 'cs-scheme-note';
        note.textContent = scheme.note;
        info.appendChild(note);
      }

      const source = document.createElement('div');
      source.className = 'cs-scheme-source';
      source.textContent = scheme.source;
      info.appendChild(source);

      item.appendChild(info);

      item.addEventListener('click', () => {
        if (this.selectedPaintId !== scheme.id) {
          this.selectedPaintId = scheme.id;
          this.opts.onUiSound?.();
          this.updateSelectionClasses();
          this.updatePreview();
          if (this.currentSpec) {
            const previewSpec = applyPaint(this.currentSpec, scheme.id);
            this.opts.onPreview?.(previewSpec);
          }
        }
      });

      this.schemeListEl.appendChild(item);
    });
  }

  private updateSelectionClasses(): void {
    const items = this.schemeListEl.querySelectorAll('.cs-scheme-item');
    items.forEach((el) => {
      const itemEl = el as HTMLElement;
      if (itemEl.dataset.paintId === this.selectedPaintId) {
        itemEl.classList.add('selected');
      } else {
        itemEl.classList.remove('selected');
      }
    });
  }

  private updatePreview(): void {
    if (!this.currentSpec) return;
    const schemes = paintsFor(this.currentSpec);
    const activeScheme: PaintSpec = schemes.find((p) => p.id === this.selectedPaintId) ?? schemes[0];
    const previewSpec = applyPaint(this.currentSpec, activeScheme.id);

    this.previewBoxEl.innerHTML = '';
    const thumbUrl = vehicleThumbnail(previewSpec);
    const hex = activeScheme.color.toString(16).padStart(6, '0');

    if (thumbUrl) {
      const img = document.createElement('img');
      img.className = 'cs-preview-img';
      img.src = thumbUrl;
      img.alt = activeScheme.name;
      this.previewBoxEl.appendChild(img);
    } else {
      // 无法获取缩略图时显示大色块
      const block = document.createElement('div');
      block.className = 'cs-preview-color-block';
      block.style.backgroundColor = `#${hex}`;

      const nameEl = document.createElement('div');
      nameEl.textContent = activeScheme.name;
      block.appendChild(nameEl);

      const codeEl = document.createElement('div');
      codeEl.className = 'cs-preview-color-code';
      codeEl.textContent = `#${hex.toUpperCase()}`;
      block.appendChild(codeEl);

      this.previewBoxEl.appendChild(block);
    }

    // 预览说明文字
    this.previewMetaEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'cs-preview-title';
    title.textContent = activeScheme.name;
    this.previewMetaEl.appendChild(title);

    if (activeScheme.note) {
      const desc = document.createElement('div');
      desc.className = 'cs-preview-desc';
      desc.textContent = activeScheme.note;
      this.previewMetaEl.appendChild(desc);
    }
  }

  dispose(): void {
    if (this.isOpen) {
      this.cancelAndClose();
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    this.root.remove();
  }
}
