/**
 * 操作设置(按键用 KeyboardEvent.code)。所有按键都集中在这里,以后做「自定义按键」界面时
 * 只需要读写这份数据,游戏逻辑不用改。
 */
export interface ControlsConfig {
  keys: {
    forward: string[];
    back: string[];
    left: string[];
    right: string[];
    fire: string[];
    restart: string[];
    /** 开镜 / 关镜(炮手瞄准镜) */
    scope: string[];
    /** 在瞄准镜倍率之间切换 */
    zoom: string[];
    /** 维修 / 取消维修 */
    repair: string[];
    /** 第 i 项 = 选第 i 种弹 */
    ammo: string[][];
  };
  /** 滚轮往下(朝自己)滚是否加远表尺;false = 往上滚加远 */
  wheelDownIncreasesRange: boolean;
}

export const DEFAULT_CONTROLS: ControlsConfig = {
  keys: {
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    fire: ['Space'],
    restart: ['KeyR'],
    scope: ['ShiftLeft', 'ShiftRight'],
    zoom: ['KeyZ'],
    repair: ['KeyF'],
    ammo: [
      ['Digit1', 'Numpad1'],
      ['Digit2', 'Numpad2'],
      ['Digit3', 'Numpad3'],
      ['Digit4', 'Numpad4'],
      ['Digit5', 'Numpad5'],
      ['Digit6', 'Numpad6'],
    ],
  },
  wheelDownIncreasesRange: true,
};
