import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VEHICLES } from '../src/data/vehicles';
import { AmmoPanel, maxForShell, setShellCount } from '../src/ui/menu/AmmoPanel';

describe('maxForShell 与 setShellCount 纯函数', () => {
  const tiger = VEHICLES.tiger_i; // 容量 92 发

  describe('maxForShell', () => {
    it('无其他弹种时，最大值等于总容量', () => {
      expect(maxForShell({}, 'pzgr39', 92)).toBe(92);
      expect(maxForShell({ pzgr39: 30 }, 'pzgr39', 92)).toBe(92);
    });

    it('有其他弹种时，最大值为 容量 − 其他弹种合计', () => {
      const loadout = { pzgr39: 20, sprgr: 10, pzgr40: 5 };
      // 其他弹种合计: sprgr(10) + pzgr40(5) = 15 -> 92 - 15 = 77
      expect(maxForShell(loadout, 'pzgr39', 92)).toBe(77);
      // 其他弹种合计: pzgr39(20) + pzgr40(5) = 25 -> 92 - 25 = 67
      expect(maxForShell(loadout, 'sprgr', 92)).toBe(67);
    });

    it('容量边界：满载、超载或容量为 0 时返回 0', () => {
      // 刚好满载
      expect(maxForShell({ sprgr: 92 }, 'pzgr39', 92)).toBe(0);
      // 其他弹种超出容量
      expect(maxForShell({ sprgr: 100 }, 'pzgr39', 92)).toBe(0);
      // 总容量为 0 或负数
      expect(maxForShell({}, 'pzgr39', 0)).toBe(0);
      expect(maxForShell({}, 'pzgr39', -10)).toBe(0);
    });

    it('其他弹种存在负数或非法值时，视为 0 处理', () => {
      const loadout = { sprgr: -10 as unknown as number, pzgr40: NaN as unknown as number };
      expect(maxForShell(loadout, 'pzgr39', 92)).toBe(92);
    });
  });

  describe('setShellCount', () => {
    it('在合法范围内设定弹药数量，其他弹种不变且不改变原对象', () => {
      const initial = { pzgr39: 20, sprgr: 10 };
      const next = setShellCount(tiger, initial, 'pzgr39', 35);

      expect(next.pzgr39).toBe(35);
      expect(next.sprgr).toBe(10);
      expect(initial.pzgr39).toBe(20); // 不改变原对象
    });

    it('超出上限时被夹到 maxForShell', () => {
      // tiger 容量 92，sprgr 占 10 发，pzgr39 最多 82 发
      const initial = { pzgr39: 20, sprgr: 10 };
      const next = setShellCount(tiger, initial, 'pzgr39', 120);
      expect(next.pzgr39).toBe(82);
    });

    it('低于 0 或负数时被夹到 0', () => {
      const initial = { pzgr39: 20 };
      const next = setShellCount(tiger, initial, 'pzgr39', -8);
      expect(next.pzgr39).toBe(0);
    });

    it('传入浮点数或非法数字时取整', () => {
      const initial = { pzgr39: 20 };
      expect(setShellCount(tiger, initial, 'pzgr39', 15.4).pzgr39).toBe(15);
      expect(setShellCount(tiger, initial, 'pzgr39', 15.6).pzgr39).toBe(16);
      expect(setShellCount(tiger, initial, 'pzgr39', NaN).pzgr39).toBe(0);
    });
  });
});

describe('AmmoPanel 组件交互', () => {
  let container: HTMLElement;
  const tiger = VEHICLES.tiger_i; // 92 发，弹种: pzgr39, pzgr40, gr39hl, sprgr

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  });

  it('初始渲染各弹种卡片、滑块与数字框', () => {
    const onChange = vi.fn();
    const panel = new AmmoPanel(container, { onChange });
    panel.setVehicle(tiger, { pzgr39: 20, sprgr: 10 });

    const cards = panel.root.querySelectorAll('.mm-ammo-card');
    expect(cards.length).toBe(4);

    const sliders = panel.root.querySelectorAll<HTMLInputElement>('input[type=range]');
    const numInputs = panel.root.querySelectorAll<HTMLInputElement>('input[type=number]');
    expect(sliders.length).toBe(4);
    expect(numInputs.length).toBe(4);

    // pzgr39 数量为 20，sprgr 占 10，pzgr39 上限为 92 - 10 = 82
    expect(sliders[0].value).toBe('20');
    expect(sliders[0].max).toBe('82');
    expect(numInputs[0].value).toBe('20');
    expect(numInputs[0].max).toBe('82');

    expect(panel.root.textContent).toContain('合计 30 / 92 发');
  });

  it('滑块 input 事件实时更新数量、合计和 onChange，且拖动中滑块节点未被替换', () => {
    const onChange = vi.fn();
    const panel = new AmmoPanel(container, { onChange });
    panel.setVehicle(tiger, { pzgr39: 20, sprgr: 10 });

    const sliders = panel.root.querySelectorAll<HTMLInputElement>('input[type=range]');
    const pzgrSlider = sliders[0];
    const numInputs = panel.root.querySelectorAll<HTMLInputElement>('input[type=number]');

    // 拖动滑块到 35
    pzgrSlider.value = '35';
    pzgrSlider.dispatchEvent(new Event('input'));

    // 检查数量输入框、合计条实时更新
    expect(numInputs[0].value).toBe('35');
    expect(panel.root.textContent).toContain('合计 45 / 92 发');
    expect(onChange).toHaveBeenCalledWith(tiger, expect.objectContaining({ pzgr39: 35, sprgr: 10 }));

    // 拖动中滑块 DOM 节点没有被替换
    const currentSliders = panel.root.querySelectorAll<HTMLInputElement>('input[type=range]');
    expect(currentSliders[0]).toBe(pzgrSlider);
  });

  it('多带一种弹后其他滑块的 max 变小', () => {
    const onChange = vi.fn();
    const panel = new AmmoPanel(container, { onChange });
    panel.setVehicle(tiger, { pzgr39: 20, sprgr: 10 });

    const sliders = panel.root.querySelectorAll<HTMLInputElement>('input[type=range]');
    const sprgrSlider = sliders[3]; // sprgr 是第 4 种弹
    // 初始 sprgr max: 92 - 20 = 72
    expect(sprgrSlider.max).toBe('72');

    // 增加 pzgr39 到 60
    sliders[0].value = '60';
    sliders[0].dispatchEvent(new Event('input'));

    // sprgr max 应减小为 92 - 60 = 32
    expect(sprgrSlider.max).toBe('32');
  });

  it('数字框输入越界被自动夹住（回车 / 失焦）', () => {
    const onChange = vi.fn();
    const panel = new AmmoPanel(container, { onChange });
    panel.setVehicle(tiger, { pzgr39: 20, sprgr: 10 });

    const numInputs = panel.root.querySelectorAll<HTMLInputElement>('input[type=number]');
    const pzgrNum = numInputs[0];

    // 输入超出 max(82) 的数字并回车
    pzgrNum.value = '150';
    pzgrNum.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(pzgrNum.value).toBe('82');
    expect(onChange).toHaveBeenCalledWith(tiger, expect.objectContaining({ pzgr39: 82 }));

    // 输入负数并失焦
    pzgrNum.value = '-20';
    pzgrNum.dispatchEvent(new Event('blur'));

    expect(pzgrNum.value).toBe('0');
    expect(onChange).toHaveBeenCalledWith(tiger, expect.objectContaining({ pzgr39: 0 }));
  });

  it('「−」「+」步长 1，Shift 点击步长 5', () => {
    const onChange = vi.fn();
    const onUiSound = vi.fn();
    const panel = new AmmoPanel(container, { onChange, onUiSound });
    panel.setVehicle(tiger, { pzgr39: 20 });

    const btns = panel.root.querySelectorAll<HTMLButtonElement>('button.mm-btn.small');
    const pzgrMinus = btns[0];
    const pzgrPlus = btns[1];

    // 普通点击 +，增加 1 发
    pzgrPlus.click();
    expect(onChange).toHaveBeenLastCalledWith(tiger, expect.objectContaining({ pzgr39: 21 }));

    // 普通点击 −，减少 1 发
    pzgrMinus.click();
    expect(onChange).toHaveBeenLastCalledWith(tiger, expect.objectContaining({ pzgr39: 20 }));

    // 按住 Shift 点击 +，增加 5 发
    pzgrPlus.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(onChange).toHaveBeenLastCalledWith(tiger, expect.objectContaining({ pzgr39: 25 }));

    // 按住 Shift 点击 −，减少 5 发
    pzgrMinus.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(onChange).toHaveBeenLastCalledWith(tiger, expect.objectContaining({ pzgr39: 20 }));

    expect(onUiSound).toHaveBeenCalledTimes(4);
  });

  it('滑块松手（change 事件）触发 onChange 与音效', () => {
    const onChange = vi.fn();
    const onUiSound = vi.fn();
    const panel = new AmmoPanel(container, { onChange, onUiSound });
    panel.setVehicle(tiger, { pzgr39: 20 });

    const slider = panel.root.querySelector<HTMLInputElement>('input[type=range]')!;
    slider.value = '30';
    slider.dispatchEvent(new Event('change'));

    expect(onChange).toHaveBeenCalled();
    expect(onUiSound).toHaveBeenCalled();
  });

  it('数量为 0 时减号禁用，总容量达到上限时加号禁用', () => {
    const onChange = vi.fn();
    const panel = new AmmoPanel(container, { onChange });
    panel.setVehicle(tiger, { pzgr39: 0, sprgr: 92 }); // 总量 92 达到上限

    const btns = panel.root.querySelectorAll<HTMLButtonElement>('button.mm-btn.small');
    const pzgrMinus = btns[0];
    const pzgrPlus = btns[1];

    expect(pzgrMinus.disabled).toBe(true);
    expect(pzgrPlus.disabled).toBe(true);
  });
});
