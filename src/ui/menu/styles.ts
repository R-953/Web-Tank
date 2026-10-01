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
/* 下拉菜单要盖住下面的车辆信息面板(信息面板在 DOM 里更靠后,不设 z-index 会画在菜单上面) */
.mm-dropdown { position: absolute; left: 0; top: 42px; min-width: 180px; padding: 4px 0; display: none; z-index: 5; }
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

/* 科技树样式 */
const TECH_TREE_CSS = `
/* 科技树全屏覆盖层 */
.tt-root { position: fixed; inset: 0; z-index: 35; display: flex; flex-direction: column; background: rgba(14, 18, 22, .96); font: 13px/1.45 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #e6e8ea; user-select: none; }
.tt-topbar { height: 50px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; border-bottom: 1px solid rgba(255,255,255,.1); background: rgba(20, 25, 30, .95); }
.tt-top-left { display: flex; align-items: center; gap: 16px; }
.tt-title { font-size: 18px; font-weight: 700; color: #f3d27f; letter-spacing: 1px; }
.tt-nation-tabs { display: flex; gap: 6px; }
.tt-nation-tab.on { border-color: #e0b44c; color: #f3d27f; background: rgba(224,180,76,.15); }
.tt-close { width: 34px; height: 34px; font-size: 18px; padding: 0; display: flex; align-items: center; justify-content: center; }

/* 年份刻度栏(固定在顶部) */
.tt-years-bar { height: 34px; display: flex; border-bottom: 1px solid rgba(255,255,255,.1); background: rgba(24, 30, 37, .92); overflow: hidden; }
.tt-years-spacer { width: 220px; min-width: 220px; border-right: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; padding-left: 14px; font-size: 12px; color: rgba(255,255,255,.45); }
.tt-years-track { flex: 1; display: grid; align-items: center; }
.tt-year-tick { text-align: center; font-weight: 600; font-size: 12px; color: #cfd3d6; border-left: 1px solid rgba(255,255,255,.06); height: 100%; display: flex; align-items: center; justify-content: center; }

/* 国家垂直滚动区(scroll-snap) */
.tt-scroll { flex: 1; overflow-y: auto; overflow-x: auto; scroll-snap-type: y mandatory; position: relative; }
.tt-nation { height: 100%; min-height: 100%; scroll-snap-align: start; scroll-snap-stop: always; display: flex; border-bottom: 2px solid rgba(255,255,255,.1); box-sizing: border-box; background: rgba(18, 22, 27, .85); }
.tt-nation-sidebar { width: 100px; min-width: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(24, 30, 38, .85); border-right: 1px solid rgba(255,255,255,.1); padding: 12px 6px; }
.tt-nation-name { font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #e6e8ea; text-shadow: 0 2px 4px rgba(0,0,0,.6); }

/* 类别线与网格 */
.tt-lanes { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
.tt-lane { display: flex; min-height: 80px; flex: 1; border-bottom: 1px solid rgba(255,255,255,.06); align-items: stretch; }
.tt-lane-header { width: 120px; min-width: 120px; display: flex; align-items: center; justify-content: center; padding: 0 10px; font-size: 13px; font-weight: 600; color: #cfd3d6; background: rgba(22, 28, 34, .5); border-right: 1px solid rgba(255,255,255,.08); text-align: center; }
.tt-lane-grid { flex: 1; display: grid; align-items: center; }
.tt-grid-col { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; height: 100%; border-left: 1px dashed rgba(255,255,255,.05); padding: 6px; box-sizing: border-box; }

/* 单车卡片 */
.tt-card { position: relative; width: 145px; box-sizing: border-box; }
.tt-vehicle-card { padding: 8px 10px; background: rgba(36, 44, 53, .9); border: 1px solid rgba(255,255,255,.14); border-radius: 4px; cursor: pointer; transition: all .15s ease; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.tt-vehicle-card:hover { background: #36404a; border-color: rgba(255,255,255,.35); transform: translateY(-1px); }
.tt-vehicle-card:active { transform: translateY(1px); }
.tt-vehicle-card.tt-current { border-color: #e0b44c; box-shadow: 0 0 10px rgba(224,180,76,.35), inset 0 0 0 1px #e0b44c; background: rgba(65, 55, 30, .9); }
.tt-vehicle-card.tt-current .tt-vehicle-name { color: #f3d27f; font-weight: 700; }
.tt-vehicle-name { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tt-vehicle-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 3px; gap: 4px; }
.tt-vehicle-year { font-size: 11px; opacity: .65; white-space: nowrap; }

/* 标记:已编组 */
.tt-badge-lineup { font-size: 10px; padding: 1px 5px; border-radius: 2px; background: rgba(76, 175, 80, .2); border: 1px solid #4caf50; color: #a5d6a7; font-weight: 600; margin-left: auto; white-space: nowrap; line-height: 1.2; }

/* 多车组卡片 */
.tt-group-card { z-index: 5; }
.tt-group-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: rgba(36, 44, 53, .95); border: 1px solid rgba(255,255,255,.18); border-radius: 4px; cursor: pointer; transition: all .15s ease; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.tt-group-header:hover { border-color: rgba(255,255,255,.35); background: #36404a; }
.tt-group-card.open { z-index: 30; }
.tt-group-card.open .tt-group-header { border-radius: 4px 4px 0 0; border-color: #e0b44c; }
.tt-group-title { font-weight: 700; font-size: 12px; color: #e6e8ea; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 78px; }
.tt-group-count { font-size: 11px; color: #e0b44c; font-weight: 700; background: rgba(224,180,76,.15); padding: 1px 5px; border-radius: 2px; margin-left: auto; }
.tt-group-arrow { font-size: 10px; opacity: .6; margin-left: 4px; }
.tt-group-card.tt-has-current .tt-group-header { border-color: rgba(224,180,76,.6); }

/* 展开的车组列表 */
.tt-group-list { position: absolute; left: 0; top: 100%; width: 100%; display: flex; flex-direction: column; gap: 4px; padding: 6px; background: rgba(22, 27, 32, .98); border: 1px solid #e0b44c; border-top: none; border-radius: 0 0 4px 4px; box-shadow: 0 8px 24px rgba(0,0,0,.5); z-index: 30; box-sizing: border-box; }
.tt-vehicle-item { padding: 6px 8px; border-radius: 3px; cursor: pointer; background: #252c33; border: 1px solid rgba(255,255,255,.08); position: relative; }
.tt-vehicle-item:hover { background: #36404a; border-color: rgba(255,255,255,.25); }
.tt-vehicle-item.tt-current { border-color: #e0b44c; background: rgba(65, 55, 30, .9); }
.tt-vehicle-item.tt-current .tt-vehicle-name { color: #f3d27f; font-weight: 700; }
`;

let ttInjected = false;

export function injectTechTreeStyles(): void {
  injectMenuStyles();
  if (ttInjected || typeof document === 'undefined') return;
  ttInjected = true;
  const style = document.createElement('style');
  style.textContent = TECH_TREE_CSS;
  document.head.appendChild(style);
}

/* 编组栏样式 */
const LINEUP_BAR_CSS = `
.mm-lineup-bar {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  min-width: 500px;
  max-width: 96vw;
  box-sizing: border-box;
  z-index: 10;
}
.mm-lineup-row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.mm-lineup-nations {
  display: flex;
  gap: 4px;
}
.mm-lineup-nation-tab.on {
  border-color: #e0b44c;
  color: #f3d27f;
  background: rgba(224, 180, 76, 0.15);
}
.mm-lineup-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.mm-lineup-select {
  font: inherit;
  color: #e6e8ea;
  background: rgba(30, 36, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 12px;
}
.mm-lineup-rename-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}
.mm-lineup-rename-input {
  font: inherit;
  color: #e6e8ea;
  background: #1a2026;
  border: 1px solid #e0b44c;
  border-radius: 3px;
  padding: 2px 6px;
  width: 110px;
  font-size: 12px;
}
.mm-lineup-error {
  color: #ff7a6a;
  font-size: 12px;
  background: rgba(255, 74, 74, 0.12);
  border: 1px solid rgba(255, 74, 74, 0.3);
  border-radius: 3px;
  padding: 2px 8px;
  text-align: center;
}
.mm-lineup-slots {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  max-width: 100%;
  padding-bottom: 2px;
  justify-content: center;
}
.mm-lineup-slot {
  width: 155px;
  min-width: 155px;
  min-height: 96px;
  padding: 6px 8px;
  background: rgba(30, 36, 42, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  transition: border-color .15s;
  position: relative;
}
.mm-lineup-slot:hover {
  border-color: rgba(255, 255, 255, 0.3);
}
.mm-lineup-slot.sel {
  border-color: #e0b44c;
  box-shadow: inset 0 0 0 1px #e0b44c;
  background: rgba(60, 50, 25, 0.9);
}
.mm-lineup-slot.empty {
  border-style: dashed;
  background: rgba(22, 27, 32, 0.6);
  align-items: center;
  justify-content: center;
}
.mm-lineup-slot-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.mm-lineup-slot-name {
  font-weight: 700;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 105px;
}
.mm-lineup-slot-level {
  font-size: 11px;
  color: #e0b44c;
  font-weight: 600;
  background: rgba(224, 180, 76, 0.12);
  padding: 1px 4px;
  border-radius: 2px;
  white-space: nowrap;
}
.mm-lineup-slot-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  width: 100%;
}
.mm-lineup-btn-clear {
  padding: 0 5px;
  font-size: 12px;
  line-height: 16px;
  min-width: 20px;
}
.mm-lineup-slot-add-btn {
  font-size: 26px;
  font-weight: 700;
  color: #e0b44c;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.mm-lineup-slot-empty-hint {
  font-size: 11px;
  opacity: .5;
  margin-top: 4px;
}
.mm-btn-sm {
  padding: 2px 8px;
  font-size: 12px;
}
`;

let lineupInjected = false;

export function injectLineupBarStyles(): void {
  injectMenuStyles();
  if (lineupInjected || typeof document === 'undefined') return;
  lineupInjected = true;
  const style = document.createElement('style');
  style.textContent = LINEUP_BAR_CSS;
  document.head.appendChild(style);
}

/* 载具类型图标样式 */
const CLASS_ICON_CSS = `
.vehicle-class-icon {
  display: inline-block;
  vertical-align: -2px;
  margin-right: 4px;
  flex-shrink: 0;
}
.mm-slot .name .vehicle-class-icon,
.mm-slot svg.vehicle-class-icon {
  display: inline-block;
  margin: 0 4px 0 0;
  vertical-align: -2px;
}
.tt-lane-header .vehicle-class-icon {
  margin-right: 6px;
}
`;

let classIconInjected = false;

export function injectClassIconStyles(): void {
  injectMenuStyles();
  if (classIconInjected || typeof document === 'undefined') return;
  classIconInjected = true;
  const style = document.createElement('style');
  style.textContent = CLASS_ICON_CSS;
  document.head.appendChild(style);
}

/* 地图界面样式 (MapScreen) */
const MAP_SCREEN_CSS = `
.ms-root {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: rgba(10, 12, 14, 0.95);
  display: flex;
  flex-direction: column;
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #e6e8ea;
  user-select: none;
  box-sizing: border-box;
  overflow: hidden;
}
.ms-root.hidden {
  display: none;
}
.ms-top {
  padding: 8px 16px 6px;
  display: flex;
  gap: 8px;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 12, 14, 0.88);
  overflow-x: auto;
  flex-shrink: 0;
  box-sizing: border-box;
}
.ms-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: rgba(30, 36, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  min-width: 120px;
  cursor: pointer;
  white-space: nowrap;
}
.ms-card:hover {
  border-color: rgba(255, 255, 255, 0.3);
}
.ms-card.sel, .ms-card.active {
  border-color: #e0b44c;
  box-shadow: inset 0 0 0 1px #e0b44c;
  background: rgba(60, 50, 25, 0.9);
}
.ms-card-name {
  font-weight: bold;
  flex: 1;
  display: flex;
  align-items: center;
}
.ms-card-level {
  font-size: 11px;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}
.ms-body {
  flex: 1;
  display: flex;
  min-height: 0;
  min-width: 0;
  padding: 10px 16px;
  gap: 16px;
  box-sizing: border-box;
  overflow: hidden;
}
.ms-left {
  width: 440px;
  max-width: 45vw;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  box-sizing: border-box;
}
.ms-left .mm-ammo {
  position: static;
  width: 100%;
  max-height: none;
  box-sizing: border-box;
}
.ms-map-info {
  font-size: 12px;
  opacity: 0.75;
  padding: 2px 4px;
}
.ms-map-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.ms-canvas {
  display: block;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  border-radius: 2px;
  flex-shrink: 0;
}
.ms-right {
  width: 130px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  padding: 2px 0;
  min-height: 0;
  box-sizing: border-box;
}
.ms-tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.ms-symbology-select {
  width: 100%;
  font: inherit;
  color: #e6e8ea;
  background: rgba(22, 27, 32, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 3px;
  padding: 4px 8px;
}
.ms-bottom-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.ms-confirm-btn {
  font-size: 16px;
  padding: 10px 24px;
  min-width: 120px;
  font-weight: 700;
}
`;

let mapScreenInjected = false;

export function injectMapScreenStyles(): void {
  injectMenuStyles();
  injectClassIconStyles();
  if (mapScreenInjected || typeof document === 'undefined') return;
  mapScreenInjected = true;
  const style = document.createElement('style');
  style.textContent = MAP_SCREEN_CSS;
  document.head.appendChild(style);
}


/* 载具信息卡片样式 */
const VEHICLE_CARD_CSS = `
.vc-card {
  position: fixed;
  z-index: 100;
  width: 320px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 12px 14px;
  background: rgba(22, 27, 32, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #e6e8ea;
  user-select: none;
  pointer-events: auto;
  box-sizing: border-box;
}
.vc-card.hidden {
  display: none;
}
.vc-header {
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 6px;
}
.vc-title {
  font-size: 15px;
  font-weight: 700;
  color: #f3d27f;
  margin: 0 0 2px;
}
.vc-subtitle {
  font-size: 11px;
  color: #cfd3d6;
  opacity: 0.75;
}
.vc-section {
  margin-top: 8px;
}
.vc-sec-title {
  font-size: 12px;
  font-weight: 600;
  color: #e0b44c;
  margin-bottom: 3px;
  border-left: 2px solid #e0b44c;
  padding-left: 5px;
}
.vc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.vc-table tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.vc-table td {
  padding: 2px 0;
  vertical-align: top;
}
.vc-label {
  opacity: 0.7;
  padding-right: 8px;
  white-space: nowrap;
  width: 32%;
}
.vc-val {
  text-align: right;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}
`;

let vcInjected = false;

export function injectVehicleCardStyles(): void {
  injectMenuStyles();
  if (vcInjected || typeof document === 'undefined') return;
  vcInjected = true;
  const style = document.createElement('style');
  style.textContent = VEHICLE_CARD_CSS;
  document.head.appendChild(style);
}



