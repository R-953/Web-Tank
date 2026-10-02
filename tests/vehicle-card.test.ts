import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VehicleSpec } from '../src/data/types';
import { M4A3E8, TIGER_I, ISU_122 } from '../src/data/vehicles';
import {
  VehicleCard,
  vehicleCardData,
} from '../src/ui/menu/VehicleCard';

describe('vehicleCardData 纯数据生成', () => {
  it('谢尔曼 M4A3E8 在 skill 0 / 1 时装填分别是 7.6 / 5.9 s,并带「满级 5.9 s」', () => {
    // skill = 0 (新手乘员)
    const data0 = vehicleCardData(M4A3E8, 0);
    const aimSec0 = data0.sections.find((s) => s.title === '瞄准');
    expect(aimSec0).toBeDefined();

    const reloadRow0 = aimSec0?.rows.find((r) => r.label === '装填时间');
    expect(reloadRow0).toBeDefined();
    expect(reloadRow0?.value).toContain('7.6 s');
    expect(reloadRow0?.value).toContain('满级 5.9 s');

    // skill = 1 (满级王牌乘员)
    const data1 = vehicleCardData(M4A3E8, 1);
    const aimSec1 = data1.sections.find((s) => s.title === '瞄准');
    expect(aimSec1).toBeDefined();

    const reloadRow1 = aimSec1?.rows.find((r) => r.label === '装填时间');
    expect(reloadRow1).toBeDefined();
    expect(reloadRow1?.value).toContain('5.9 s');
    expect(reloadRow1?.value).toContain('满级 5.9 s');

    // 中间技能 (skill = 0.5) 线性插值: 7.6 + (5.9 - 7.6) * 0.5 = 6.75 s
    const dataMid = vehicleCardData(M4A3E8, 0.5);
    const reloadRowMid = dataMid.sections
      .find((s) => s.title === '瞄准')
      ?.rows.find((r) => r.label === '装填时间');
    expect(reloadRowMid?.value).toContain('6.75 s');
    expect(reloadRowMid?.value).toContain('满级 5.9 s');
  });

  it('方向机与高低机在拥有 crewAce 时显示当前与满级数值', () => {
    const data0 = vehicleCardData(M4A3E8, 0);
    const aimRows0 = data0.sections.find((s) => s.title === '瞄准')?.rows ?? [];

    const rotRow0 = aimRows0.find((r) => r.label === '方向机');
    expect(rotRow0?.value).toContain('24°/s');
    expect(rotRow0?.value).toContain('满级 34.29°/s');

    const elevRow0 = aimRows0.find((r) => r.label === '高低机');
    expect(elevRow0?.value).toContain('2.8°/s');
    expect(elevRow0?.value).toContain('满级 4°/s');

    const data1 = vehicleCardData(M4A3E8, 1);
    const aimRows1 = data1.sections.find((s) => s.title === '瞄准')?.rows ?? [];

    const rotRow1 = aimRows1.find((r) => r.label === '方向机');
    expect(rotRow1?.value).toContain('34.29°/s');
    expect(rotRow1?.value).toContain('满级 34.29°/s');

    const elevRow1 = aimRows1.find((r) => r.label === '高低机');
    expect(elevRow1?.value).toContain('4°/s');
    expect(elevRow1?.value).toContain('满级 4°/s');
  });

  it('有首下的车多一行首下,无首下的车不多该行', () => {
    // M4A3E8 有 lowerFront (108 mm)
    const m4Data = vehicleCardData(M4A3E8, 0);
    const m4Armor = m4Data.sections.find((s) => s.title === '防护');
    const m4LowerFront = m4Armor?.rows.find((r) => r.label === '首下');
    expect(m4LowerFront).toBeDefined();
    expect(m4LowerFront?.value).toBe('108 mm');

    // 虎式 Ausf. E 没有 lowerFront
    const tigerData = vehicleCardData(TIGER_I, 0);
    const tigerArmor = tigerData.sections.find((s) => s.title === '防护');
    const tigerLowerFront = tigerArmor?.rows.find((r) => r.label === '首下');
    expect(tigerLowerFront).toBeUndefined();
    expect(tigerArmor?.rows.find((r) => r.label === '车体')?.value).toBe('100 / 80 / 80 mm');
  });

  it('固定半径转向的车显示半径,原地转向的车显示角速度', () => {
    // M4A3E8: turnRadius = 9.5
    const m4Data = vehicleCardData(M4A3E8, 0);
    const m4Mob = m4Data.sections.find((s) => s.title === '机动');
    const m4Turn = m4Mob?.rows.find((r) => r.label.includes('转向'));
    expect(m4Turn).toBeDefined();
    expect(m4Turn?.value).toContain('固定半径');
    expect(m4Turn?.value).toContain('9.5 m');

    // 虎式: turnRate = 15, 无 turnRadius
    const tigerData = vehicleCardData(TIGER_I, 0);
    const tigerMob = tigerData.sections.find((s) => s.title === '机动');
    const tigerTurn = tigerMob?.rows.find((r) => r.label.includes('转向'));
    expect(tigerTurn).toBeDefined();
    expect(tigerTurn?.value).toContain('原地转向');
    expect(tigerTurn?.value).toContain('15°/s');
  });

  it('没有 crewAce 的情况不报错,正常生成卡片且不带满级提示', () => {
    const mockSpec: VehicleSpec = {
      id: 'mock_tank',
      name: '简易测试坦克',
      armor: { front: 50, side: 30, rear: 20 },
      turretArmor: { front: 40, side: 30, rear: 20 },
      maxSpeed: 30,
      turretRotationSpeed: 12,
      weapons: [
        {
          id: 'test_cannon',
          name: '50 mm 炮',
          reloadTime: 5.0,
          ammo: [
            {
              id: 'test_shell',
              name: '穿甲弹',
              type: 'AP',
              caliber: 50,
              mass: 2,
              muzzleVelocity: 800,
              penetration: 70,
              explosiveMass: 0,
              fuseDelay: 0,
              fuseSensitivity: 0,
            },
          ],
        },
      ],
      hull: { length: 5, width: 2.5, height: 1.8, turnRate: 20, acceleration: 3 },
      turret: {
        length: 2,
        width: 2,
        height: 0.8,
        barrelLength: 2.5,
        elevation: [-8, 20],
        elevationSpeed: 3.5,
      },
      sight: { magnifications: [2.5], reticle: 'german' },
      internals: { modules: [], crew: [] },
      color: 0x555555,
      // 注意: 没有 crewAce, 没有 nation, 没有 vehicleClass, 没有 serviceYear
    };

    expect(() => vehicleCardData(mockSpec, 0.5)).not.toThrow();

    const data = vehicleCardData(mockSpec, 0.5);
    expect(data.title).toBe('简易测试坦克');
    expect(data.subtitle).toBe('');

    const aimSec = data.sections.find((s) => s.title === '瞄准');
    expect(aimSec).toBeDefined();
    const reloadRow = aimSec?.rows.find((r) => r.label === '装填时间');
    expect(reloadRow?.value).toBe('5 s');
    expect(reloadRow?.value).not.toContain('满级');

    const rotRow = aimSec?.rows.find((r) => r.label === '方向机');
    expect(rotRow?.value).toBe('12°/s');
    expect(rotRow?.value).not.toContain('满级');
  });

  it('副标题格式化国家、类别与服役年份', () => {
    const data = vehicleCardData(M4A3E8, 0);
    expect(data.title).toBe('M4A3E8');
    expect(data.subtitle).toBe('美国 · 中型坦克 · 1944');
  });

  it('固定战斗室车辆显示水平射界与战斗室装甲', () => {
    const data = vehicleCardData(ISU_122, 0);
    const aimSec = data.sections.find((s) => s.title === '瞄准');
    const traverseRow = aimSec?.rows.find((r) => r.label === '水平射界');
    expect(traverseRow).toBeDefined();
    expect(traverseRow?.value).toBe('左 3° / 右 7°');

    const armorSec = data.sections.find((s) => s.title === '防护');
    const casemateRow = armorSec?.rows.find((r) => r.label === '战斗室');
    expect(casemateRow).toBeDefined();
    expect(casemateRow?.value).toBe('90 / 75 / 60 mm');
  });

  it('完整包含火力、弹药架容量与乘员人数', () => {
    const data = vehicleCardData(M4A3E8, 0);

    const fireSec = data.sections.find((s) => s.title === '火力');
    expect(fireSec).toBeDefined();
    expect(fireSec?.rows.find((r) => r.label === '主炮')?.value).toContain('76 mm M1A2');
    expect(fireSec?.rows.find((r) => r.label === 'M62')?.value).toContain('127 mm');
    expect(fireSec?.rows.find((r) => r.label === '同轴机枪')?.value).toContain('M1919A4');
    expect(fireSec?.rows.find((r) => r.label === '同轴机枪弹药')?.value).toBe('3000 发');
    expect(fireSec?.rows.find((r) => r.label === '弹药架容量')?.value).toBe('71 发');

    const crewSec = data.sections.find((s) => s.title === '乘员');
    expect(crewSec?.rows.find((r) => r.label === '乘员人数')?.value).toBe('5 人');
  });

  it('机动一节显示质量(xx.x t)、发动机功率(hp @ rpm)与前进/倒车速度', () => {
    // 虎式 Ausf. E: mass = 57300 kg -> 57.3 t, enginePower = 700 hp @ 3000 rpm, maxSpeed = 38, reverseSpeed = 8
    const tigerData = vehicleCardData(TIGER_I, 0);
    const mobSec = tigerData.sections.find((s) => s.title === '机动');
    expect(mobSec).toBeDefined();

    const massRow = mobSec?.rows.find((r) => r.label === '质量');
    expect(massRow?.value).toBe('57.3 t');

    const powerRow = mobSec?.rows.find((r) => r.label === '发动机功率');
    expect(powerRow?.value).toBe('700 hp @ 3000 rpm');

    const speedRow = mobSec?.rows.find((r) => r.label === '最大速度');
    expect(speedRow?.value).toBe('38 / 8 km/h');
  });

  it('字段缺失时不显示对应行,无 reverseSpeed 时最大速度仅显示前进', () => {
    // mockSpec 在前面已有定义且缺 mass, enginePower, reverseSpeed, weapons 只有 cannon 没有 mg
    const mockSpec: VehicleSpec = {
      id: 'mock_no_extra',
      name: '缺失字段测试车',
      armor: { front: 50, side: 30, rear: 20 },
      turretArmor: { front: 40, side: 30, rear: 20 },
      maxSpeed: 40,
      turretRotationSpeed: 10,
      weapons: [
        {
          id: 'mock_gun',
          name: '75 mm 炮',
          reloadTime: 6,
          ammo: [],
        },
      ],
      hull: { length: 5, width: 2.5, height: 1.8, turnRate: 15, acceleration: 4 },
      turret: { length: 2, width: 2, height: 0.8, barrelLength: 2, elevation: [-5, 20], elevationSpeed: 3 },
      sight: { magnifications: [2.5], reticle: 'german' },
      internals: { modules: [], crew: [] },
      color: 0x333333,
    };

    const data = vehicleCardData(mockSpec, 0);
    const mobSec = data.sections.find((s) => s.title === '机动');
    expect(mobSec).toBeDefined();

    expect(mobSec?.rows.find((r) => r.label === '质量')).toBeUndefined();
    expect(mobSec?.rows.find((r) => r.label === '发动机功率')).toBeUndefined();
    const speedRow = mobSec?.rows.find((r) => r.label === '最大速度');
    expect(speedRow?.value).toBe('40 km/h');

    const fireSec = data.sections.find((s) => s.title === '火力');
    expect(fireSec?.rows.find((r) => r.label === '同轴机枪')).toBeUndefined();
    expect(fireSec?.rows.find((r) => r.label === '同轴机枪弹药')).toBeUndefined();
  });
});

describe('VehicleCard DOM 组件', () => {
  let container: HTMLElement;
  let card: VehicleCard;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    card = new VehicleCard(container);
  });

  afterEach(() => {
    card.dispose();
    container.remove();
    vi.useRealTimers();
  });

  it('show 后卡片可见且内容含载具名与性能', () => {
    const anchor = {
      left: 100,
      right: 200,
      top: 150,
      bottom: 250,
      width: 100,
      height: 100,
      x: 100,
      y: 150,
      toJSON: () => ({}),
    } as DOMRect;

    card.show(M4A3E8, 0, anchor);

    expect(card.element.classList.contains('hidden')).toBe(false);
    expect(card.element.textContent).toContain('M4A3E8');
    expect(card.element.textContent).toContain('美国 · 中型坦克 · 1944');
    expect(card.element.textContent).toContain('7.6 s');
    expect(card.element.textContent).toContain('满级 5.9 s');
  });

  it('双击卡片后隐藏 (hide)', () => {
    const anchor = {
      left: 100,
      right: 200,
      top: 150,
      bottom: 250,
      width: 100,
      height: 100,
      x: 100,
      y: 150,
      toJSON: () => ({}),
    } as DOMRect;

    card.show(M4A3E8, 0, anchor);
    expect(card.element.classList.contains('hidden')).toBe(false);

    card.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(card.element.classList.contains('hidden')).toBe(true);
  });

  it('hideSoon 延迟约 150 ms 隐藏; 期间鼠标移入卡片则取消隐藏', () => {
    const anchor = {
      left: 100,
      right: 200,
      top: 150,
      bottom: 250,
      width: 100,
      height: 100,
      x: 100,
      y: 150,
      toJSON: () => ({}),
    } as DOMRect;

    card.show(M4A3E8, 0, anchor);
    expect(card.element.classList.contains('hidden')).toBe(false);

    // 触发延迟隐藏
    card.hideSoon();
    expect(card.element.classList.contains('hidden')).toBe(false);

    // 在 100 ms 时鼠标移入卡片
    vi.advanceTimersByTime(100);
    card.element.dispatchEvent(new MouseEvent('mouseenter'));

    // 再过 100 ms (总计 200 ms), 因已移入卡片, 不应隐藏
    vi.advanceTimersByTime(100);
    expect(card.element.classList.contains('hidden')).toBe(false);

    // 鼠标离开卡片触发 hideSoon
    card.element.dispatchEvent(new MouseEvent('mouseleave'));
    expect(card.element.classList.contains('hidden')).toBe(false);

    // 150 ms 后隐藏
    vi.advanceTimersByTime(150);
    expect(card.element.classList.contains('hidden')).toBe(true);
  });

  it('位置计算优先右侧,放不下就左侧/上方,且不超出视口', () => {
    // 视口默认假设 1024 x 768
    // 1. 右侧有足够空间: anchor 靠左, 优先放置在右侧
    const anchor1 = {
      left: 100,
      right: 200,
      top: 100,
      bottom: 150,
      width: 100,
      height: 50,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect;
    card.show(M4A3E8, 0, anchor1);
    expect(card.element.style.left).toBe('208px'); // 200 + 8

    // 2. 右侧放不下 (anchor.right 靠右边界): 放置在左侧
    const anchor2 = {
      left: 800,
      right: 950,
      top: 100,
      bottom: 150,
      width: 150,
      height: 50,
      x: 800,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect;
    card.show(M4A3E8, 0, anchor2);
    // left = 800 - 8 - 320 = 472px
    expect(card.element.style.left).toBe('472px');
  });

  it('dispose 移除 DOM 元素并清除定时器', () => {
    const anchor = {
      left: 100,
      right: 200,
      top: 100,
      bottom: 150,
      width: 100,
      height: 50,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect;

    card.show(M4A3E8, 0, anchor);
    card.hideSoon();
    card.dispose();

    expect(container.contains(card.element)).toBe(false);
    // 定时器触发后不抛错
    vi.advanceTimersByTime(200);
  });
});
