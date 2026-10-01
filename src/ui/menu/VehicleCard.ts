import type { VehicleSpec } from '../../data/types';
import { applyCrewSkill } from '../../game/crew/progress';
import { CLASS_NAMES, NATION_NAMES } from './techTreeLayout';
import { h, injectVehicleCardStyles } from './styles';

export interface CardRow {
  label: string;
  value: string;
}

export interface CardSection {
  title: string;
  rows: CardRow[];
}

export interface VehicleCardData {
  title: string;
  subtitle: string;
  sections: CardSection[];
}

/** 格式化数字,最多保留 2 位小数并去除末尾多余的 0 */
function formatNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

/** 附带满级王牌数值的格式化 */
function withAce(current: number, aceVal: number | undefined, unit: string): string {
  const curStr = `${formatNum(current)}${unit}`;
  if (aceVal != null) {
    return `${curStr} (满级 ${formatNum(aceVal)}${unit})`;
  }
  return curStr;
}

/** 纯函数:按技能 skill ∈ [0, 1] 生成卡片内容(不碰 DOM) */
export function vehicleCardData(spec: VehicleSpec, skill: number): VehicleCardData {
  const title = spec.name;

  // 副标题:国家 · 类型 · 服役年份
  const subParts: string[] = [];
  if (spec.nation) {
    subParts.push(NATION_NAMES[spec.nation] ?? spec.nation);
  }
  if (spec.vehicleClass) {
    subParts.push(CLASS_NAMES[spec.vehicleClass] ?? spec.vehicleClass);
  }
  if (spec.serviceYear != null) {
    subParts.push(`${spec.serviceYear}`);
  }
  const subtitle = subParts.join(' · ');

  // 插值车组技能
  const appliedSpec = applyCrewSkill(spec, spec.crewAce, skill);
  const ace = spec.crewAce;

  const sections: CardSection[] = [];

  // --- 火力
  const fireRows: CardRow[] = [];
  const cannon = spec.weapons?.find((w) => w.kind !== 'mg') ?? spec.weapons?.[0];
  if (cannon && cannon.kind !== 'mg') {
    const cal = cannon.ammo?.[0]?.caliber;
    const calInName =
      cal != null &&
      (cannon.name.includes(`${cal} mm`) ||
        cannon.name.includes(`${cal}mm`) ||
        (cal === 88 && cannon.name.includes('8.8 cm')));
    const gunVal = cal != null && !calInName ? `${cannon.name} (${cal} mm)` : cannon.name;
    fireRows.push({ label: '主炮', value: gunVal });

    if (cannon.ammo) {
      for (const shell of cannon.ammo) {
        const pen = Math.round(shell.penetration);
        fireRows.push({
          label: shell.name,
          value: `${shell.type} · 穿深 ${pen} mm`,
        });
      }
    }
  }

  const mg = spec.weapons?.find((w) => w.kind === 'mg');
  if (mg) {
    const mgVal = mg.rateOfFire ? `${mg.name} · ${mg.rateOfFire} 发/分` : mg.name;
    fireRows.push({ label: '同轴机枪', value: mgVal });
  }

  const ammoCap =
    spec.internals?.modules?.reduce(
      (n, m) => n + (m.type === 'ammo' ? (m.capacity ?? 0) : 0),
      0,
    ) ?? 0;
  if (ammoCap > 0) {
    fireRows.push({ label: '弹药架容量', value: `${ammoCap} 发` });
  }

  if (fireRows.length > 0) {
    sections.push({ title: '火力', rows: fireRows });
  }

  // --- 瞄准
  const aimRows: CardRow[] = [];
  if (spec.turret?.traverse) {
    aimRows.push({
      label: '水平射界',
      value: `左 ${spec.turret.traverse[0]}° / 右 ${spec.turret.traverse[1]}°`,
    });
  }

  if (spec.turretRotationSpeed != null) {
    aimRows.push({
      label: '方向机',
      value: withAce(appliedSpec.turretRotationSpeed, ace?.turretRotationSpeed, '°/s'),
    });
  }

  if (spec.turret?.elevationSpeed != null) {
    aimRows.push({
      label: '高低机',
      value: withAce(appliedSpec.turret.elevationSpeed, ace?.elevationSpeed, '°/s'),
    });
  }

  if (spec.turret?.elevation) {
    aimRows.push({
      label: '俯仰范围',
      value: `${spec.turret.elevation[0]}° / +${spec.turret.elevation[1]}°`,
    });
  }

  const appliedCannon =
    appliedSpec.weapons?.find((w) => w.kind !== 'mg') ?? appliedSpec.weapons?.[0];
  if (appliedCannon && appliedCannon.kind !== 'mg') {
    aimRows.push({
      label: '装填时间',
      value: withAce(appliedCannon.reloadTime, ace?.reloadTime, ' s'),
    });
  }

  if (spec.sight?.magnifications?.length) {
    aimRows.push({
      label: '瞄准镜倍率',
      value: spec.sight.magnifications.map((m) => `${m}×`).join(' / '),
    });
  }

  if (aimRows.length > 0) {
    sections.push({ title: '瞄准', rows: aimRows });
  }

  // --- 防护
  const armorRows: CardRow[] = [];
  if (spec.armor) {
    armorRows.push({
      label: '车体',
      value: `${spec.armor.front} / ${spec.armor.side} / ${spec.armor.rear} mm`,
    });
    if (spec.armor.lowerFront) {
      armorRows.push({
        label: '首下',
        value: `${spec.armor.lowerFront.thickness} mm`,
      });
    }
  }

  if (spec.turretArmor) {
    armorRows.push({
      label: spec.turret?.traverse ? '战斗室' : '炮塔',
      value: `${spec.turretArmor.front} / ${spec.turretArmor.side} / ${spec.turretArmor.rear} mm`,
    });
  }

  if (armorRows.length > 0) {
    sections.push({ title: '防护', rows: armorRows });
  }

  // --- 机动
  const mobRows: CardRow[] = [];
  if (spec.maxSpeed != null) {
    mobRows.push({ label: '最大速度', value: `${spec.maxSpeed} km/h` });
  }

  if (spec.hull) {
    if (spec.hull.turnRadius != null) {
      mobRows.push({
        label: '转向',
        value: `固定半径 ${spec.hull.turnRadius} m`,
      });
    } else if (spec.hull.turnRate != null) {
      mobRows.push({
        label: '转向',
        value: `原地转向 ${spec.hull.turnRate}°/s`,
      });
    }

    if (spec.hull.acceleration != null) {
      mobRows.push({
        label: '起步加速度',
        value: `${spec.hull.acceleration} m/s²`,
      });
    }
  }

  if (mobRows.length > 0) {
    sections.push({ title: '机动', rows: mobRows });
  }

  // --- 乘员
  const crewCount = spec.internals?.crew?.length ?? 0;
  if (crewCount > 0) {
    sections.push({
      title: '乘员',
      rows: [{ label: '乘员人数', value: `${crewCount} 人` }],
    });
  }

  return { title, subtitle, sections };
}

export class VehicleCard {
  private readonly root: HTMLElement;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement) {
    injectVehicleCardStyles();
    this.root = h('div', 'vc-card hidden', parent);

    this.root.addEventListener('mouseenter', () => {
      this.clearHideTimer();
    });

    this.root.addEventListener('mouseleave', () => {
      this.hideSoon();
    });

    this.root.addEventListener('dblclick', () => {
      this.hide();
    });
  }

  get element(): HTMLElement {
    return this.root;
  }

  /** 在 anchor 旁边显示(优先右侧,放不下就左侧 / 上方,不超出视口) */
  show(spec: VehicleSpec, skill: number, anchor: DOMRect): void {
    this.clearHideTimer();
    const data = vehicleCardData(spec, skill);
    this.render(data);

    this.root.classList.remove('hidden');

    const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 1024;
    const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 768;
    const cardWidth = this.root.offsetWidth || 320;
    const cardHeight = this.root.offsetHeight || 420;
    const gap = 8;

    let left: number;
    let top = anchor.top;

    // 优先右侧,放不下就左侧 / 上方,不超出视口
    if (anchor.right + gap + cardWidth <= viewportWidth) {
      left = anchor.right + gap;
    } else if (anchor.left - gap - cardWidth >= 0) {
      left = anchor.left - gap - cardWidth;
    } else if (anchor.top - gap - cardHeight >= 0) {
      top = anchor.top - gap - cardHeight;
      left = anchor.left;
    } else {
      top = anchor.bottom + gap;
      left = anchor.left;
    }

    if (left + cardWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - cardWidth - 8);
    }
    if (left < 8) left = 8;

    if (top + cardHeight > viewportHeight - 8) {
      top = Math.max(8, viewportHeight - cardHeight - 8);
    }
    if (top < 8) top = 8;

    this.root.style.left = `${Math.round(left)}px`;
    this.root.style.top = `${Math.round(top)}px`;
  }

  /** 鼠标离开载具时调用:延迟约 150 ms 隐藏;这段时间里鼠标移到卡片上就不隐藏 */
  hideSoon(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hide();
    }, 150);
  }

  hide(): void {
    this.clearHideTimer();
    this.root.classList.add('hidden');
  }

  /** 移除卡片 DOM(双击卡片只是 hide,见构造函数) */
  dispose(): void {
    this.clearHideTimer();
    this.root.remove();
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private render(data: VehicleCardData): void {
    this.root.innerHTML = '';

    const header = h('div', 'vc-header', this.root);
    h('div', 'vc-title', header, data.title);
    if (data.subtitle) {
      h('div', 'vc-subtitle', header, data.subtitle);
    }

    for (const section of data.sections) {
      const secEl = h('div', 'vc-section', this.root);
      h('div', 'vc-sec-title', secEl, section.title);
      const table = h('table', 'vc-table', secEl);
      for (const row of section.rows) {
        const tr = h('tr', '', table);
        h('td', 'vc-label', tr, row.label);
        h('td', 'vc-val', tr, row.value);
      }
    }
  }
}
