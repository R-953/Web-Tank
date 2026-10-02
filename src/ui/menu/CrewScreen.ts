import type { CrewRole, VehicleSpec } from '../../data/types';
import { CREW_ROLE_NAMES } from '../../data/modules';
import { applyCrewSkill, crewLevel, CREW_MAX_LEVEL } from '../../game/crew/progress';
import { crewSkillFor } from '../../game/crew/skill';
import { proficiency, type Profile, type ProfileVehicle } from '../../settings/Profile';
import { classIcon } from './classIcons';
import { vehicleThumbnail } from './thumbnails';

export interface CrewScreenOptions {
  parent: HTMLElement;
  vehicles: readonly VehicleSpec[];
  getProfile(): Profile;
  offlineGrowth(): boolean;
  onClose?(): void;
  onUiSound?(): void;
}

const ROLE_ABBR: Record<CrewRole, string> = {
  commander: '长',
  gunner: '炮',
  loader: '装',
  driver: '驾',
  radio: '电',
};

function formatNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

function toProfileVehicles(vehicles: readonly VehicleSpec[]): ProfileVehicle[] {
  return vehicles.map((v) => ({
    id: v.id,
    nation: v.nation ?? '',
    family: v.family ?? v.id,
  }));
}

function getCannonReload(spec: VehicleSpec): number | null {
  const cannon = spec.weapons?.find((w) => w.kind !== 'mg') ?? spec.weapons?.[0];
  return cannon?.reloadTime != null ? cannon.reloadTime : null;
}

const CSS = `
.crw-root {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #e6e8ea;
  user-select: none;
  box-sizing: border-box;
}
.crw-root.hidden {
  display: none;
}
.crw-window {
  width: min(860px, 94vw);
  max-height: min(720px, 90vh);
  background: rgba(22, 27, 32, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.crw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(28, 34, 40, 0.95);
}
.crw-title {
  font-size: 17px;
  font-weight: 700;
  color: #f3d27f;
  letter-spacing: 0.5px;
}
.crw-close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #cfd3d6;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
}
.crw-close-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.25);
}
.crw-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.crw-section {
  background: rgba(30, 36, 43, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 12px 14px;
}
.crw-sec-title {
  font-size: 13px;
  font-weight: 700;
  color: #e0b44c;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.crw-level-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.crw-level-val {
  font-size: 20px;
  font-weight: 700;
  color: #f3d27f;
}
.crw-progress-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 6px 0;
}
.crw-progress-bar-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  overflow: hidden;
}
.crw-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #c8962e, #f3d27f);
  border-radius: 4px;
  transition: width 0.2s ease;
}
.crw-progress-bar-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: space-between;
}
.crw-offline-row {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
}
.crw-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 700px) {
  .crw-two-col {
    grid-template-columns: 1fr;
  }
}
.crw-veh-card {
  display: flex;
  gap: 12px;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.crw-veh-thumb-wrap {
  width: 96px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}
.crw-veh-thumb {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.crw-veh-info {
  flex: 1;
  min-width: 0;
}
.crw-veh-name {
  font-size: 14px;
  font-weight: 700;
  color: #e6e8ea;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.crw-veh-tags {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
  flex-wrap: wrap;
}
.crw-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 2px;
}
.crw-tag.trained {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid #4caf50;
  color: #a5d6a7;
}
.crw-tag.untrained {
  background: rgba(255, 152, 0, 0.2);
  border: 1px solid #ff9800;
  color: #ffcc80;
}
.crw-tag.skill {
  background: rgba(224, 180, 76, 0.15);
  border: 1px solid rgba(224, 180, 76, 0.5);
  color: #f3d27f;
}
.crw-skill-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.crw-skill-table th {
  text-align: left;
  color: rgba(255, 255, 255, 0.55);
  font-weight: 600;
  padding: 4px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.crw-skill-table td {
  padding: 5px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.crw-skill-label {
  color: #cfd3d6;
  font-weight: 500;
  white-space: nowrap;
}
.crw-skill-val {
  font-variant-numeric: tabular-nums;
}
.crw-skill-novice {
  color: rgba(255, 255, 255, 0.65);
}
.crw-skill-curr {
  color: #f3d27f;
  font-weight: 600;
}
.crw-skill-ace {
  color: #9fe39f;
}
.crw-skill-arrow {
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
  padding: 0 4px;
}
.crw-crew-layout {
  display: flex;
  gap: 12px;
}
.crw-crew-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.crw-crew-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
  font-size: 12px;
}
.crw-crew-role {
  font-weight: 600;
}
.crw-crew-part {
  color: rgba(255, 255, 255, 0.6);
}
.crw-schematic-wrap {
  width: 140px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(14, 18, 22, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  flex-shrink: 0;
}
.crw-schematic-svg {
  max-width: 100%;
  max-height: 100%;
}
.crw-trained-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.crw-trained-item {
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  font-size: 12px;
  color: #cfd3d6;
}
.crw-trained-empty {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.crw-empty-notice {
  padding: 24px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}
`;

let stylesInjected = false;
function injectCrewScreenStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

function h<K extends keyof HTMLElementTagNameMap>(
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

export class CrewScreen {
  readonly root: HTMLElement;
  private readonly modalWindow: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private _isOpen = false;
  private readonly handleKeyDown: (e: KeyboardEvent) => void;

  constructor(private readonly opts: CrewScreenOptions) {
    injectCrewScreenStyles();

    this.root = h('div', 'crw-root hidden', opts.parent);

    this.modalWindow = h('div', 'crw-window', this.root);
    this.modalWindow.setAttribute('role', 'dialog');
    this.modalWindow.setAttribute('aria-modal', 'true');

    // Header
    const header = h('div', 'crw-header', this.modalWindow);
    this.titleEl = h('div', 'crw-title', header, '乘员');

    const closeBtn = h('button', 'crw-close-btn', header, '✕');
    closeBtn.title = '关闭 (Esc)';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Body
    this.bodyEl = h('div', 'crw-body', this.modalWindow);

    // Click mask to close
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) {
        this.close();
      }
    });

    this.modalWindow.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Esc keydown handler
    this.handleKeyDown = (e: KeyboardEvent): void => {
      if (this._isOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(nation: string, crewIndex: number): void {
    this._isOpen = true;
    this.root.classList.remove('hidden');
    this.render(nation, crewIndex);
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.root.classList.add('hidden');
    this.opts.onUiSound?.();
    this.opts.onClose?.();
  }

  dispose(): void {
    this._isOpen = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    this.root.remove();
  }

  private render(nation: string, crewIndex: number): void {
    this.titleEl.textContent = `乘员 · 车组 ${crewIndex + 1}`;
    this.bodyEl.innerHTML = '';

    const p = this.opts.getProfile();
    const nationProfile = p?.nations?.[nation];
    const crew = nationProfile?.crews?.[crewIndex];

    const currentLineup =
      nationProfile?.lineups?.find((l) => l.id === nationProfile.activeLineup) ??
      nationProfile?.lineups?.[0];
    const vehicleId = currentLineup?.slots?.[crewIndex] ?? null;
    const vehicle = vehicleId ? this.opts.vehicles.find((v) => v.id === vehicleId) : null;

    // 若车组完全不存在
    if (!crew) {
      h('div', 'crw-empty-notice', this.bodyEl, '该车组还没有分配载具');
      return;
    }

    // 1. 车组概况
    const profileSec = h('div', 'crw-section crw-overview-sec', this.bodyEl);
    h('div', 'crw-sec-title', profileSec, '车组概况');

    const progress = Math.max(0, Math.min(0.999999, crew.progress ?? 0));
    const lvl = crewLevel(progress);
    const pct = (progress * 100).toFixed(1);

    const levelRow = h('div', 'crw-level-row', profileSec);
    h('div', 'crw-level-val', levelRow, `Lv ${lvl}`);

    const progressWrap = h('div', 'crw-progress-bar-wrap', profileSec);
    const progressTrack = h('div', 'crw-progress-bar-track', progressWrap);
    const progressFill = h('div', 'crw-progress-bar-fill', progressTrack);
    progressFill.style.width = `${pct}%`;

    const progressText = h('div', 'crw-progress-bar-text', progressWrap);
    if (lvl < CREW_MAX_LEVEL) {
      h('span', '', progressText, `Lv ${lvl} → Lv ${lvl + 1}`);
      h('span', '', progressText, `${pct}%`);
    } else {
      h('span', '', progressText, `Lv ${lvl} (已满级)`);
      h('span', '', progressText, '100%');
    }

    const offlineGrowthEnabled = this.opts.offlineGrowth();
    const offlineText = offlineGrowthEnabled
      ? '离线挂机成长: 开'
      : '离线挂机成长: 关(在设置 → 游戏里打开)';
    h('div', 'crw-offline-row', profileSec, offlineText);

    // 若没有分车或载具不存在
    if (!vehicle) {
      h('div', 'crw-empty-notice', this.bodyEl, '该车组还没有分配载具');

      // 5. 训练过的车族 (依然可以展示已训练过的载具)
      this.renderTrainedSection(crew.trained);
      return;
    }

    // 两栏区域: 左侧 (当前车辆 & 技能表), 右侧 (车内乘员 & 俯视示意图)
    const twoCol = h('div', 'crw-two-col', this.bodyEl);
    const leftCol = h('div', '', twoCol);
    const rightCol = h('div', '', twoCol);

    // 2. 当前车辆
    const vehSec = h('div', 'crw-section crw-veh-sec', leftCol);
    h('div', 'crw-sec-title', vehSec, '当前车辆');

    const vehCard = h('div', 'crw-veh-card', vehSec);
    const thumbWrap = h('div', 'crw-veh-thumb-wrap', vehCard);
    const thumb = vehicleThumbnail(vehicle);
    if (thumb) {
      const img = h('img', 'crw-veh-thumb', thumbWrap);
      img.src = thumb;
      img.alt = vehicle.name;
    } else if (vehicle.vehicleClass) {
      thumbWrap.innerHTML = classIcon(vehicle.vehicleClass, 32);
    }

    const vehInfo = h('div', 'crw-veh-info', vehCard);
    h('div', 'crw-veh-name', vehInfo, vehicle.name);

    const profileVehicles = toProfileVehicles(this.opts.vehicles);
    const prof = proficiency(crew, vehicle.id, profileVehicles);
    const skill = crewSkillFor(p, profileVehicles, nation, crewIndex, vehicle.id);
    const skillPct = Math.round(skill * 100);

    const tagsWrap = h('div', 'crw-veh-tags', vehInfo);
    if (prof === 1) {
      h('span', 'crw-tag trained', tagsWrap, '已训练');
    } else {
      h('span', 'crw-tag untrained', tagsWrap, '未训练');
    }
    h('span', 'crw-tag skill', tagsWrap, `综合技能: ${skillPct}%`);

    // 3. 技能表
    const skillSec = h('div', 'crw-section crw-skills-sec', leftCol);
    h('div', 'crw-sec-title', skillSec, '技能加成');

    this.renderSkillsTable(skillSec, vehicle, skill);

    // 4. 车内乘员
    const crewSec = h('div', 'crw-section crw-crew-sec', rightCol);
    h('div', 'crw-sec-title', crewSec, '车内乘员');

    this.renderCrewSection(crewSec, vehicle);

    // 5. 训练过的车族
    this.renderTrainedSection(crew.trained);
  }

  private renderSkillsTable(parent: HTMLElement, spec: VehicleSpec, skill: number): void {
    const hasAce = Boolean(spec.crewAce);
    const noviceSpec = applyCrewSkill(spec, spec.crewAce, 0);
    const currentSpec = applyCrewSkill(spec, spec.crewAce, skill);
    const aceSpec = spec.crewAce ? applyCrewSkill(spec, spec.crewAce, 1) : null;

    const table = h('table', 'crw-skill-table', parent);
    const thead = h('thead', '', table);
    const headerTr = h('tr', '', thead);
    h('th', '', headerTr, '技能');
    if (hasAce) {
      h('th', '', headerTr, '新手');
      h('th', '', headerTr, '');
      h('th', '', headerTr, '当前');
      h('th', '', headerTr, '');
      h('th', '', headerTr, '王牌');
    } else {
      h('th', '', headerTr, '当前');
    }

    const tbody = h('tbody', '', table);

    interface SkillRowConfig {
      name: string;
      noviceVal: number | null;
      currVal: number | null;
      aceVal: number | null;
      unit: string;
    }

    const rows: SkillRowConfig[] = [
      {
        name: '装填时间',
        noviceVal: getCannonReload(noviceSpec),
        currVal: getCannonReload(currentSpec),
        aceVal: aceSpec ? getCannonReload(aceSpec) : null,
        unit: ' s',
      },
      {
        name: '方向机',
        noviceVal: noviceSpec.turretRotationSpeed,
        currVal: currentSpec.turretRotationSpeed,
        aceVal: aceSpec?.turretRotationSpeed ?? null,
        unit: '°/s',
      },
      {
        name: '高低机',
        noviceVal: noviceSpec.turret?.elevationSpeed ?? null,
        currVal: currentSpec.turret?.elevationSpeed ?? null,
        aceVal: aceSpec?.turret?.elevationSpeed ?? null,
        unit: '°/s',
      },
    ];

    for (const r of rows) {
      if (r.noviceVal == null && r.currVal == null) continue;
      const tr = h('tr', '', tbody);
      h('td', 'crw-skill-label', tr, r.name);

      const currStr = `${formatNum(r.currVal ?? 0)}${r.unit}`;
      if (hasAce && r.aceVal != null && r.noviceVal != null) {
        const noviceStr = `${formatNum(r.noviceVal)}${r.unit}`;
        const aceStr = `${formatNum(r.aceVal)}${r.unit}`;

        h('td', 'crw-skill-val crw-skill-novice', tr, noviceStr);
        h('td', 'crw-skill-arrow', tr, '→');
        h('td', 'crw-skill-val crw-skill-curr', tr, currStr);
        h('td', 'crw-skill-arrow', tr, '→');
        h('td', 'crw-skill-val crw-skill-ace', tr, aceStr);
      } else {
        h('td', 'crw-skill-val crw-skill-curr', tr, currStr);
      }
    }
  }

  private renderCrewSection(parent: HTMLElement, spec: VehicleSpec): void {
    const layout = h('div', 'crw-crew-layout', parent);
    const listEl = h('div', 'crw-crew-list', layout);

    const crewList = spec.internals?.crew ?? [];
    for (const member of crewList) {
      const item = h('div', 'crw-crew-item', listEl);
      const roleName = CREW_ROLE_NAMES[member.role] ?? member.role;
      const partName = member.part === 'turret' ? '炮塔' : '车体';
      h('span', 'crw-crew-role', item, roleName);
      h('span', 'crw-crew-part', item, partName);
    }

    // 俯视示意图
    const schematicWrap = h('div', 'crw-schematic-wrap', layout);
    schematicWrap.innerHTML = this.buildSchematicSvg(spec);
  }

  private buildSchematicSvg(spec: VehicleSpec): string {
    const svgW = 140;
    const svgH = 175;
    const pad = 16;
    const cx = svgW / 2;
    const cy = svgH / 2;

    const hullW = Math.max(1, spec.hull?.width ?? 3);
    const hullL = Math.max(1, spec.hull?.length ?? 6);
    const scale = Math.min((svgW - pad * 2) / hullW, (svgH - pad * 2) / hullL);

    const rectW = hullW * scale;
    const rectH = hullL * scale;
    const rectX = cx - rectW / 2;
    const rectY = cy - rectH / 2;

    const turretOffset = spec.turret?.offset ?? 0;
    const turretCx = cx;
    const turretCy = cy + turretOffset * scale;
    const tWidth = spec.turret?.width ?? hullW * 0.65;
    const tLength = spec.turret?.length ?? hullL * 0.45;
    const turretRadius = (Math.min(tWidth, tLength) / 2) * scale;

    const crewList = spec.internals?.crew ?? [];
    const dotsSvg = crewList
      .map((c) => {
        const cz = c.part === 'turret' ? c.center[2] + turretOffset : c.center[2];
        const dotX = cx + c.center[0] * scale;
        const dotY = cy + cz * scale;
        const abbr = ROLE_ABBR[c.role] ?? '员';
        return `
          <g class="crw-crew-dot-group" data-role="${c.role}">
            <circle class="crw-crew-dot" data-role="${c.role}" cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="9.5" fill="#e0b44c" stroke="#161b20" stroke-width="1.5" />
            <text class="crw-crew-dot-text" x="${dotX.toFixed(1)}" y="${(dotY + 0.5).toFixed(1)}" fill="#161b20" font-size="10" font-weight="bold" text-anchor="middle" dominant-baseline="central">${abbr}</text>
          </g>
        `;
      })
      .join('');

    return `
      <svg class="crw-schematic-svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
        <!-- 车体矩形 -->
        <rect class="crw-schematic-hull" x="${rectX.toFixed(1)}" y="${rectY.toFixed(1)}" width="${rectW.toFixed(1)}" height="${rectH.toFixed(1)}" rx="4" ry="4" fill="#29323c" stroke="#485766" stroke-width="1.5" />
        <!-- 炮塔圆 -->
        <circle class="crw-schematic-turret" cx="${turretCx.toFixed(1)}" cy="${turretCy.toFixed(1)}" r="${turretRadius.toFixed(1)}" fill="#36424e" stroke="#5a6c7e" stroke-width="1.5" />
        <!-- 乘员圆点 -->
        ${dotsSvg}
      </svg>
    `;
  }

  private renderTrainedSection(trained: readonly string[]): void {
    const trainedSec = h('div', 'crw-section crw-trained-sec', this.bodyEl);
    h('div', 'crw-sec-title', trainedSec, '训练过的车族');

    if (!trained || trained.length === 0) {
      h('div', 'crw-trained-empty', trainedSec, '暂无训练记录');
      return;
    }

    const listWrap = h('div', 'crw-trained-list', trainedSec);
    for (const id of trained) {
      const veh = this.opts.vehicles.find((v) => v.id === id);
      const name = veh ? veh.name : id;
      h('span', 'crw-trained-item', listWrap, name);
    }
  }
}
