# 042-map-screen:地图界面(编组 + 携弹 + 大地图),先做成独立组件

- 负责:Antigravity(3.8 Flash High)
- 状态:进行中
- 分支:`task/042-map-screen`
- 规模:L(组件大,但都是新文件 + 两处抽取)

## 目标

负责人 10-02 给了 War Thunder 战斗中「出战 / 地图」界面的截图:顶部一排编组卡片,左侧是所选载具的携弹调整,右侧是大地图,地图右边一列工具里有「北约」符号下拉框,右下「出战」按钮。要求:按 M 显示这个地图界面,并且把机库右侧的携弹调整挪进来。本卡把界面做成**独立组件**,并把两段现有代码抽成可复用的函数 / 组件;按 M 打开、开局先进这个界面、机库去掉携弹面板等接线由主程在下一张卡做。

## 抽取(行为不变,现有测试照样通过)

1. `src/ui/Minimap.ts` 的 `setMap` 里生成地形底图的那段,抽成导出函数 `renderMapBackground(map: GameMap, pixels: number): HTMLCanvasElement`,`setMap` 改为调用它。
2. `src/ui/menu/MainMenu.ts` 的 `renderAmmo`(右侧携弹面板)抽成组件 `AmmoPanel`(新文件 `src/ui/menu/AmmoPanel.ts`),`MainMenu` 改为使用它,机库里看起来和现在一样。

## 地图界面布局(参考截图,只学布局,不照搬美术)

- 全屏半透明深色底,盖在战斗画面上。
- **顶部**:当前编组的车组卡片(载具名、`classIcon` 类型符号、Lv),当前出战的高亮;只读,不能在这里改编组。
- **左侧**(宽约 480 px):
  - 所选载具的 `AmmoPanel`
  - 下面一行小字:地图名、地图尺寸
- **右侧**:正方形大地图(尽量占满剩余高度):地形底图(`renderMapBackground`)、10 × 10 网格和边上的 A–J / 1–10 标号(复用 `gridLabel` 的规则)、比例尺;玩家位置和朝向;其他标记由调用方传入的 `drawMarker` 画(下一张卡会接上 039 的军标)。
- **地图右边一列工具**:符号体系下拉框「北约 / 华约」(改了调用 `onSymbologyChange`)。
- **右下按钮**:`mode = 'spawn'` 时是「出战」,`mode = 'battle'` 时是「返回战斗」;点了调用 `onConfirm`。Esc 和再按一次打开键由主程处理,本组件只提供 `close()`。

## 允许修改的文件

- 新增:`src/ui/MapScreen.ts`、`src/ui/menu/AmmoPanel.ts`、`tests/map-screen.test.ts`
- 修改:`src/ui/Minimap.ts`(只做抽取 1)、`src/ui/menu/MainMenu.ts`(只做抽取 2)
- 修改:`src/ui/menu/styles.ts`(只允许在末尾追加样式)
- 新增:`changelog.d/<日期>-042-map-screen.md`

## 接口(定死,不要改)

```ts
// Minimap.ts
export function renderMapBackground(map: GameMap, pixels: number): HTMLCanvasElement;

// menu/AmmoPanel.ts
export interface AmmoPanelOptions {
  /** 携弹改了:调用方负责保存 */
  onChange(spec: VehicleSpec, loadout: Loadout): void;
  onUiSound?(): void;
}
export class AmmoPanel {
  constructor(parent: HTMLElement, opts: AmmoPanelOptions);
  /** 换载具或外面改了携弹时调用 */
  setVehicle(spec: VehicleSpec, loadout: Loadout): void;
  readonly root: HTMLElement;
}

// MapScreen.ts
import type { GameMap } from '../game/Map';
import type { Loadout, VehicleSpec } from '../data/types';
import type { Profile } from '../settings/Profile';
import type { MinimapMarker } from './Minimap';

export interface MapScreenOptions {
  parent: HTMLElement;
  vehicles: readonly VehicleSpec[];
  getProfile(): Profile;
  loadLoadout(spec: VehicleSpec): Loadout;
  saveLoadout(spec: VehicleSpec, loadout: Loadout): void;
  /** 当前符号体系;改了回调(039 的 Symbology,这里先写成字面量联合,避免依赖) */
  symbology: 'nato' | 'warsaw';
  onSymbologyChange(set: 'nato' | 'warsaw'): void;
  onConfirm(): void;
  onUiSound?(): void;
}

export interface MapScreenFrame {
  player?: { x: number; z: number; heading: number };
  markers: MinimapMarker[];
  /** 画一个标记;不传就画小圆点 */
  drawMarker?(ctx: CanvasRenderingContext2D, m: MinimapMarker, px: number, py: number): void;
}

export class MapScreen {
  constructor(opts: MapScreenOptions);
  open(map: GameMap, mode: 'spawn' | 'battle'): void;
  close(): void;
  get isOpen(): boolean;
  /** 每帧(或定时)由主程调用,刷新地图上的标记 */
  draw(frame: MapScreenFrame): void;
  dispose(): void;
}
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过;现有测试不改也能过(两处抽取行为不变)
- [x] `tests/map-screen.test.ts`(jsdom):`open` 后可见、顶部卡片数 = 编组车组数且高亮当前车组;左侧携弹面板改数量后调用 `saveLoadout`;`spawn` / `battle` 两种模式按钮文字正确并触发 `onConfirm`;符号下拉框触发 `onSymbologyChange`;`close` 后隐藏
- [x] jsdom 里 canvas 没有 2D 上下文时不报错(跳过绘制)
- [x] 不改 `main.ts`

## 不做

- 按 M 打开、开局先进地图界面、机库去掉携弹面板、小地图换军标(主程下一张卡)
- 在地图上点选出生点、标点(以后再说)

## 结果(完成后由执行者填写)

- 改动文件:
  - 新增: `src/ui/MapScreen.ts`、`src/ui/menu/AmmoPanel.ts`、`tests/map-screen.test.ts`、`changelog.d/2026-10-02-042-map-screen.md`
  - 修改: `src/ui/Minimap.ts`、`src/ui/menu/MainMenu.ts`、`src/ui/menu/styles.ts`、`docs/tasks/042-map-screen.md`
- 命令与结果:
  - `npm run lint`: 通过 (0 errors)
  - `npm test`: 通过 (46 test files passed, 481 tests passed)
  - `npm run build`: 通过 (73 modules transformed, 生产打包成功)
- 偏差 / 未完成 / 待决定:
  - 主程审查后返工:地图尺寸自适应窗口、底色加深。全部按要求完成并补充单元测试。
