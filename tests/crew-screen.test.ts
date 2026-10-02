import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLES } from '../src/data/vehicles';
import type { VehicleSpec } from '../src/data/types';
import { defaultProfile, recruitCrew, type Profile } from '../src/settings/Profile';
import { CrewScreen } from '../src/ui/menu/CrewScreen';

const vehicleList = Object.values(VEHICLES);
const profileVehicles = vehicleList.map((v) => ({
  id: v.id,
  nation: v.nation ?? '',
  family: v.family ?? v.id,
}));

describe('CrewScreen UI Component', () => {
  let container: HTMLElement;
  let currentProfile: Profile;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    currentProfile = defaultProfile(profileVehicles, 1000);
    return () => {
      container.remove();
    };
  });

  function createCrewScreen(opts?: {
    offlineGrowth?: boolean;
    vehicles?: VehicleSpec[];
    onClose?: () => void;
    onUiSound?: () => void;
  }) {
    const onClose = opts?.onClose ?? vi.fn();
    const onUiSound = opts?.onUiSound ?? vi.fn();
    let offline = opts?.offlineGrowth ?? true;

    const screen = new CrewScreen({
      parent: container,
      vehicles: opts?.vehicles ?? vehicleList,
      getProfile: () => currentProfile,
      offlineGrowth: () => offline,
      onClose,
      onUiSound,
    });

    return {
      screen,
      onClose,
      onUiSound,
      setOfflineGrowth: (val: boolean) => {
        offline = val;
      },
    };
  }

  it('各区块渲染: 标题、车组概况、当前车辆、技能加成、车内乘员与俯视示意图、训练过的车族', () => {
    const { screen } = createCrewScreen();
    // 默认德国车组 0 分配了 tiger_i
    screen.open('germany', 0);
    expect(screen.isOpen).toBe(true);

    // 1. 标题
    const title = screen.root.querySelector('.cs-title');
    expect(title?.textContent).toBe('乘员 · 车组 1');

    // 2. 车组概况
    const overviewSec = screen.root.querySelector('.cs-overview-sec');
    expect(overviewSec).not.toBeNull();
    expect(overviewSec?.textContent).toContain('Lv 0');
    expect(overviewSec?.textContent).toContain('离线挂机成长: 开');
    const progressBar = overviewSec?.querySelector('.cs-progress-bar-fill') as HTMLElement;
    expect(progressBar).not.toBeNull();

    // 3. 当前车辆
    const vehSec = screen.root.querySelector('.cs-veh-sec');
    expect(vehSec).not.toBeNull();
    expect(vehSec?.textContent).toContain('虎式 Ausf. E');
    expect(vehSec?.textContent).toContain('已训练');
    expect(vehSec?.textContent).toContain('综合技能');

    // 4. 技能表
    const skillSec = screen.root.querySelector('.cs-skills-sec');
    expect(skillSec).not.toBeNull();
    expect(skillSec?.textContent).toContain('装填时间');
    expect(skillSec?.textContent).toContain('方向机');
    expect(skillSec?.textContent).toContain('高低机');

    // 5. 车内乘员
    const crewSec = screen.root.querySelector('.cs-crew-sec');
    expect(crewSec).not.toBeNull();
    expect(crewSec?.textContent).toContain('驾驶员');
    expect(crewSec?.textContent).toContain('车体');
    expect(crewSec?.textContent).toContain('炮手');
    expect(crewSec?.textContent).toContain('炮塔');

    // 6. 训练过的车族
    const trainedSec = screen.root.querySelector('.cs-trained-sec');
    expect(trainedSec).not.toBeNull();
    expect(trainedSec?.textContent).toContain('训练过的车族');
    expect(trainedSec?.textContent).toContain('虎式 Ausf. E');

    screen.dispose();
  });

  it('offlineGrowth 开 / 关的两种文案', () => {
    const { screen, setOfflineGrowth } = createCrewScreen({ offlineGrowth: true });

    // 开
    screen.open('germany', 0);
    expect(screen.root.textContent).toContain('离线挂机成长: 开');

    // 关
    setOfflineGrowth(false);
    screen.open('germany', 0);
    expect(screen.root.textContent).toContain('离线挂机成长: 关(在设置 → 游戏里打开)');

    screen.dispose();
  });

  it('车辆有 crewAce 时显示「新手值 → 当前值 → 王牌值」及箭头', () => {
    const { screen } = createCrewScreen();
    screen.open('germany', 0);

    const skillTable = screen.root.querySelector('.cs-skill-table');
    expect(skillTable).not.toBeNull();

    const headers = skillTable?.querySelectorAll('th');
    const headerTexts = Array.from(headers ?? []).map((h) => h.textContent);
    expect(headerTexts).toContain('新手');
    expect(headerTexts).toContain('当前');
    expect(headerTexts).toContain('王牌');

    const rows = skillTable?.querySelectorAll('tbody tr');
    expect(rows?.length).toBe(3);

    // 每一行都应该有新手值、当前值、王牌值和 "→" 箭头
    rows?.forEach((row) => {
      expect(row.textContent).toContain('→');
      const noviceVal = row.querySelector('.cs-skill-novice');
      const currVal = row.querySelector('.cs-skill-curr');
      const aceVal = row.querySelector('.cs-skill-ace');
      expect(noviceVal).not.toBeNull();
      expect(currVal).not.toBeNull();
      expect(aceVal).not.toBeNull();
    });

    screen.dispose();
  });

  it('没有 crewAce 的车只显示一列，没有箭头', () => {
    // 制作一个没有 crewAce 的车辆
    const tigerSpec = VEHICLES.tiger_i;
    const noAceVehicle: VehicleSpec = {
      ...tigerSpec,
      id: 'tiger_no_ace',
      name: '虎式(无王牌配置)',
      crewAce: undefined,
    };

    // 分配给车组
    currentProfile = defaultProfile([
      { id: noAceVehicle.id, nation: 'germany', family: 'tiger' },
    ], 1000);

    const { screen } = createCrewScreen({ vehicles: [noAceVehicle] });
    screen.open('germany', 0);

    const skillTable = screen.root.querySelector('.cs-skill-table');
    expect(skillTable).not.toBeNull();

    const headers = skillTable?.querySelectorAll('th');
    const headerTexts = Array.from(headers ?? []).map((h) => h.textContent);
    expect(headerTexts).not.toContain('新手');
    expect(headerTexts).not.toContain('王牌');
    expect(headerTexts).toContain('当前');

    const rows = skillTable?.querySelectorAll('tbody tr');
    rows?.forEach((row) => {
      expect(row.textContent).not.toContain('→');
      const currVal = row.querySelector('.cs-skill-curr');
      expect(currVal).not.toBeNull();
      const noviceVal = row.querySelector('.cs-skill-novice');
      const aceVal = row.querySelector('.cs-skill-ace');
      expect(noviceVal).toBeNull();
      expect(aceVal).toBeNull();
    });

    screen.dispose();
  });

  it('没分车的车组不报错，显示「该车组还没有分配载具」', () => {
    // 招募新车组(车组 1 为未分车状态)
    currentProfile = recruitCrew(currentProfile, 'germany');
    const { screen } = createCrewScreen();

    expect(() => {
      screen.open('germany', 1);
    }).not.toThrow();

    expect(screen.root.textContent).toContain('乘员 · 车组 2');
    expect(screen.root.textContent).toContain('该车组还没有分配载具');
    // 车组概况依然显示
    expect(screen.root.textContent).toContain('车组概况');

    screen.dispose();
  });

  it('车组不存在时不报错，显示「该车组还没有分配载具」', () => {
    const { screen } = createCrewScreen();

    expect(() => {
      screen.open('germany', 99);
    }).not.toThrow();

    expect(screen.root.textContent).toContain('乘员 · 车组 100');
    expect(screen.root.textContent).toContain('该车组还没有分配载具');

    screen.dispose();
  });

  it('俯视示意图里点的数量等于乘员数', () => {
    const { screen } = createCrewScreen();
    screen.open('germany', 0);

    const tigerSpec = VEHICLES.tiger_i;
    const expectedCrewCount = tigerSpec.internals.crew.length; // 5人

    const svg = screen.root.querySelector('.cs-schematic-svg');
    expect(svg).not.toBeNull();

    // 检查乘员小圆点
    const dots = svg?.querySelectorAll('.cs-crew-dot');
    expect(dots?.length).toBe(expectedCrewCount);

    const dotGroups = svg?.querySelectorAll('.cs-crew-dot-group');
    expect(dotGroups?.length).toBe(expectedCrewCount);

    // 检查岗位缩写是否正确显示
    const texts = svg?.querySelectorAll('.cs-crew-dot-text');
    expect(texts?.length).toBe(expectedCrewCount);
    const textChars = Array.from(texts ?? []).map((t) => t.textContent);
    // 虎式有车长、炮手、装填手、驾驶员、机电员 -> '长', '炮', '装', '驾', '电'
    expect(textChars).toContain('长');
    expect(textChars).toContain('炮');
    expect(textChars).toContain('装');
    expect(textChars).toContain('驾');
    expect(textChars).toContain('电');

    screen.dispose();
  });

  it('Esc 键关闭界面并触发 onClose', () => {
    const { screen, onClose } = createCrewScreen();
    screen.open('germany', 0);
    expect(screen.isOpen).toBe(true);
    expect(screen.root.classList.contains('hidden')).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(screen.isOpen).toBe(false);
    expect(screen.root.classList.contains('hidden')).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);

    screen.dispose();
  });

  it('× 按钮关闭界面并触发 onClose', () => {
    const { screen, onClose } = createCrewScreen();
    screen.open('germany', 0);

    const closeBtn = screen.root.querySelector('.cs-close-btn') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    closeBtn.click();

    expect(screen.isOpen).toBe(false);
    expect(screen.root.classList.contains('hidden')).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);

    screen.dispose();
  });

  it('点遮罩背景关闭界面，点击弹窗内容不关闭', () => {
    const { screen, onClose } = createCrewScreen();
    screen.open('germany', 0);

    const modalWindow = screen.root.querySelector('.cs-window') as HTMLElement;
    modalWindow.click();
    expect(screen.isOpen).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    // 点击外部 root 遮罩
    screen.root.click();
    expect(screen.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);

    screen.dispose();
  });

  it('熟练度未训练状态显示「未训练」', () => {
    // 招募新车组并分配一辆未训练过的车(通过直接修改 slots 或模拟)
    const { screen } = createCrewScreen();
    // 修改 profile 使得 crew 0 的 trained 为空
    currentProfile.nations.germany.crews[0].trained = [];

    screen.open('germany', 0);
    const vehSec = screen.root.querySelector('.cs-veh-sec');
    expect(vehSec?.textContent).toContain('未训练');

    screen.dispose();
  });

  it('dispose 移除 DOM 元素和键盘监听', () => {
    const { screen, onClose } = createCrewScreen();
    screen.open('germany', 0);

    expect(container.contains(screen.root)).toBe(true);
    screen.dispose();
    expect(container.contains(screen.root)).toBe(false);

    // dispose 后按 Esc 不再触发 onClose
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
