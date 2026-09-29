/** 主界面 / 设置 / 暂停菜单共用的样式(类名都以 mm- 开头,避免和 HUD 冲突),只注入一次 */
const CSS = `
.mm-root, .mm-modal, .mm-pause { font: 13px/1.45 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #e6e8ea; }
.mm-root { position: fixed; inset: 0; z-index: 10; pointer-events: none; user-select: none; }
.mm-root.hidden, .mm-modal.hidden, .mm-pause.hidden { display: none; }
.mm-root > * { pointer-events: auto; }
.mm-drag { position: absolute; inset: 0; pointer-events: auto; cursor: grab; }
.mm-drag:active { cursor: grabbing; }
.mm-panel { background: rgba(22,27,32,.9); border: 1px solid rgba(255,255,255,.1); border-radius: 4px; box-shadow: 0 6px 24px rgba(0,0,0,.35); }
.mm-btn { font: inherit; color: #e6e8ea; background: #2b333b; border: 1px solid rgba(255,255,255,.14); border-radius: 3px; padding: 5px 12px; cursor: pointer; }
.mm-btn:hover { background: #36404a; border-color: rgba(255,255,255,.25); }
.mm-btn:active { transform: translateY(1px); }
.mm-btn.primary { background: linear-gradient(#e7bd57, #c8962e); color: #1b1b1b; border-color: #f3d27f; font-weight: 700; }
.mm-btn.primary:hover { background: linear-gradient(#f0c866, #d4a23a); }
.mm-btn.small { padding: 1px 8px; min-width: 26px; }
.mm-btn.on { border-color: #e0b44c; color: #f3d27f; }
.mm-btn:disabled { opacity: .4; cursor: default; }
.mm-accent { color: #e0b44c; }
.mm-dim { opacity: .7; }
.mm-note { font-size: 12px; opacity: .7; }
.mm-err { color: #ff7a6a; }
.mm-ok { color: #9fe39f; }

/* 顶栏 */
.mm-top { position: absolute; left: 0; right: 0; top: 0; height: 64px; display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 14px; pointer-events: none; background: linear-gradient(rgba(10,12,14,.75), rgba(10,12,14,0)); }
.mm-top > * { pointer-events: auto; }
.mm-menuwrap { position: relative; }
.mm-burger { width: 40px; height: 36px; font-size: 18px; padding: 0; }
.mm-dropdown { position: absolute; left: 0; top: 42px; min-width: 180px; padding: 4px 0; display: none; }
.mm-dropdown.open { display: block; }
.mm-dropdown button { display: block; width: 100%; text-align: left; font: inherit; color: #e6e8ea; background: none; border: none; padding: 7px 14px; cursor: pointer; }
.mm-dropdown button:hover { background: rgba(224,180,76,.15); color: #f3d27f; }
.mm-dropdown hr { border: none; border-top: 1px solid rgba(255,255,255,.1); margin: 4px 0; }
.mm-battle { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.mm-battle .mm-btn.primary { font-size: 18px; padding: 8px 46px; letter-spacing: 2px; }
.mm-battle select { font: inherit; color: #e6e8ea; background: rgba(22,27,32,.9); border: 1px solid rgba(255,255,255,.18); border-radius: 3px; padding: 2px 6px; }
.mm-title { font-size: 20px; font-weight: 700; letter-spacing: 1px; opacity: .9; padding-top: 4px; }

/* 左侧车辆信息 / 右侧携弹 */
.mm-info { position: absolute; left: 14px; top: 80px; width: 250px; padding: 10px 12px; max-height: calc(100vh - 250px); overflow: auto; }
.mm-info h2, .mm-ammo h2 { margin: 0 0 6px; font-size: 15px; }
.mm-info table { width: 100%; border-collapse: collapse; font-size: 12px; }
.mm-info td { padding: 2px 0; vertical-align: top; }
.mm-info td:first-child { opacity: .7; padding-right: 8px; white-space: nowrap; }
.mm-info .sec { margin-top: 8px; font-size: 12px; color: #e0b44c; }
.mm-ammo { position: absolute; right: 14px; top: 80px; width: 290px; padding: 10px 12px; max-height: calc(100vh - 250px); overflow: auto; }
.mm-ammo table { width: 100%; border-collapse: collapse; }
.mm-ammo td { padding: 3px 2px; }
.mm-ammo td.n { width: 34px; text-align: center; font-variant-numeric: tabular-nums; }
.mm-ammo .type { font-size: 11px; opacity: .7; }
.mm-ammo .total { margin-top: 6px; }
.mm-ammo .bar { height: 5px; background: rgba(255,255,255,.12); border-radius: 3px; overflow: hidden; margin-top: 3px; }
.mm-ammo .bar > div { height: 100%; background: #e0b44c; }

/* 底部载具栏 */
.mm-slots { position: absolute; left: 50%; bottom: 30px; transform: translateX(-50%); display: flex; gap: 6px; padding: 6px; }
.mm-slot { width: 170px; padding: 6px 8px; background: rgba(30,36,42,.92); border: 1px solid rgba(255,255,255,.12); border-radius: 3px; cursor: pointer; }
.mm-slot:hover { border-color: rgba(255,255,255,.3); }
.mm-slot.sel { border-color: #e0b44c; box-shadow: inset 0 0 0 1px #e0b44c; background: rgba(60,50,25,.9); }
.mm-slot .name { font-weight: 700; }
.mm-slot .stats { font-size: 11px; opacity: .75; margin-top: 2px; }
.mm-slot svg { display: block; margin: 2px 0; }
.mm-hint { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); font-size: 11px; opacity: .6; pointer-events: none; }
.mm-about { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(520px, 92vw); padding: 16px 20px; display: none; }
.mm-about.open { display: block; }

/* 设置窗口 */
.mm-modal { position: fixed; inset: 0; z-index: 30; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; }
.mm-window { width: min(820px, 94vw); height: min(620px, 90vh); display: flex; flex-direction: column; }
.mm-window header { display: flex; align-items: center; gap: 4px; padding: 8px 10px 0; border-bottom: 1px solid rgba(255,255,255,.1); }
.mm-window header .tab { font: inherit; color: #cfd3d6; background: none; border: 1px solid transparent; border-bottom: none; padding: 7px 18px; cursor: pointer; border-radius: 3px 3px 0 0; }
.mm-window header .tab.on { color: #f3d27f; background: rgba(224,180,76,.1); border-color: rgba(255,255,255,.1); }
.mm-window header .close { margin-left: auto; margin-bottom: 6px; }
.mm-window .body { flex: 1; overflow: auto; padding: 12px 18px 18px; }
.mm-row { display: grid; grid-template-columns: 220px 1fr; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
.mm-row .lbl small { display: block; font-size: 11px; opacity: .6; }
.mm-row input[type=range] { width: 240px; vertical-align: middle; accent-color: #e0b44c; }
.mm-row .val { display: inline-block; min-width: 64px; margin-left: 8px; font-variant-numeric: tabular-nums; }
.mm-row input[type=checkbox] { accent-color: #e0b44c; width: 16px; height: 16px; vertical-align: middle; }
.mm-seg { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.mm-radio { display: block; padding: 3px 0; cursor: pointer; }
.mm-radio input { accent-color: #e0b44c; margin-right: 6px; }
.mm-radio small { display: block; margin-left: 22px; opacity: .6; font-size: 11px; }
.mm-group { margin: 14px 0 4px; color: #e0b44c; font-weight: 600; }
.mm-keys { width: 100%; border-collapse: collapse; }
.mm-keys td { padding: 3px 4px; border-bottom: 1px solid rgba(255,255,255,.05); }
.mm-keys td.name small { display: block; font-size: 11px; opacity: .55; }
.mm-keys .cell { width: 150px; }
.mm-key { width: 140px; font: inherit; color: #e6e8ea; background: #252c33; border: 1px solid rgba(255,255,255,.14); border-radius: 3px; padding: 4px 6px; cursor: pointer; text-align: center; }
.mm-key:hover { border-color: rgba(255,255,255,.3); }
.mm-key.empty { color: rgba(230,232,234,.35); }
.mm-key.conflict { border-color: #ff5a4a; color: #ffb0a6; }
.mm-key.capture { border-color: #e0b44c; color: #f3d27f; background: rgba(224,180,76,.12); animation: mmblink 1s ease-in-out infinite; }
@keyframes mmblink { 50% { background: rgba(224,180,76,.25); } }
.mm-keytools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 14px 0 4px; }

/* 暂停 / 结算 */
.mm-pause { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; }
.mm-card { min-width: 320px; padding: 20px 26px; text-align: center; }
.mm-card h1 { margin: 0 0 10px; font-size: 22px; letter-spacing: 1px; }
.mm-card p { margin: 4px 0; }
.mm-card .btns { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.mm-card .btns .mm-btn { padding: 8px 12px; }
`;

let injected = false;

export function injectMenuStyles(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}
