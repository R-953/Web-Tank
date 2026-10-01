# 044-mapscreen-key-and-symbols:M 键操作、小地图和地图界面换成军标

- 负责:Antigravity(3.8 Flash High)
- 状态:已合并
- 分支:`task/044-mapscreen-key-and-symbols`
- 规模:M
- 和 045 并行,改的文件不重叠;两张都合并后主程做 046(main.ts 接线)

## 目标

第九轮第二波。负责人 10-02 的要求:按 M 显示地图界面;小地图和地图界面上的载具标记用北约 / 华约军标(039 的 `src/ui/symbols.ts`)。本卡把 main.ts 以外需要的部分都做好,main.ts 由主程在 046 接。

## 要做的事

1. **按键**(`src/data/controls.ts`、`src/settings/Settings.ts`)
   - 新增操作 `mapScreen`:名称「地图界面」,分组「界面」,默认 `['KeyM', null]`,提示「战斗前调整携弹;战斗中查看大地图」。负责人已同意给 `ActionId` 加这一项。
   - `minimapShape`(小地图方形 / 圆形)的默认键改为 `[null, null]`,设置里仍然可以绑。
   - 老存档迁移:`sanitize` 读到的 bindings 里**没有** `mapScreen`,而 `minimapShape` 里有 `KeyM` 时,把 `minimapShape` 里的 `KeyM` 换成 `null`,让 `mapScreen` 用默认的 M。写测试。
2. **小地图军标**(`src/ui/Minimap.ts`、`src/settings/Settings.ts`、`src/ui/menu/SettingsPanel.ts`)
   - `MinimapMarker` 加可选字段 `vehicleClass?: VehicleClass`。
   - `MarkerStyle` 增加 `'symbol'`。样式为 `'symbol'` 且标记带 `vehicleClass` 时,用 `drawSymbol(ctx, cls, px, py, { set: currentSymbology(), affiliation: team === 'enemy' ? 'hostile' : 'friend', dead, size: 14 })` 画;没有 `vehicleClass` 时退回圆点。玩家自己的箭头不变。
   - 设置「小地图标记」加一个选项「军标」,`game.minimapMarkers` 的缺省值改为 `'symbol'`(老存档里选过圆点 / 箭头的保持不变)。
3. **地图界面**(`src/ui/MapScreen.ts`、`src/ui/Minimap.ts`)
   - 新增类型 `export type MapLike = Pick<GameMap, 'spec' | 'grid'>`(放在 Minimap.ts)。`renderMapBackground` 和 `MapScreen.open` 的 map 参数改为 `MapLike`,这样主程在对局创建之前就能打开地图界面。
   - 不传 `drawMarker` 时:标记带 `vehicleClass` 就按当前下拉框的符号体系画军标(带识别框,`size: 18`),否则画圆点。下拉框改了以后立刻用上一帧重画,不用等下一次 `draw`。
   - `MapScreenOptions` 加可选回调 `onSelectCrew?(index: number): void`:`spawn` 模式下点有车的车组卡片时调用(同时照旧切换左侧携弹面板),高亮跟着换;`battle` 模式下点卡片只切换携弹面板。

## 允许修改的文件

- 修改:`src/data/controls.ts`、`src/settings/Settings.ts`、`src/ui/menu/SettingsPanel.ts`、`src/ui/Minimap.ts`、`src/ui/MapScreen.ts`
- 修改测试:`tests/` 下相关文件(只增不删),可新增 `tests/minimap-symbols.test.ts`、`tests/controls-migration.test.ts`
- 新增:`changelog.d/<日期>-044-mapscreen-key-and-symbols.md`

## 接口(定死)

```ts
// controls.ts
type ActionId = ... | 'mapScreen';

// Minimap.ts
export type MapLike = Pick<GameMap, 'spec' | 'grid'>;
export interface MinimapMarker { x; z; team; dead; heading?; vehicleClass?: VehicleClass }
export type MarkerStyle = 'dot' | 'arrow' | 'symbol';
export function renderMapBackground(map: MapLike, pixels: number): HTMLCanvasElement;

// MapScreen.ts
interface MapScreenOptions { ...; onSelectCrew?(index: number): void }
open(map: MapLike, mode: 'spawn' | 'battle'): void;
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 测试:老存档(`minimapShape: ['KeyM', null]`、没有 `mapScreen`)迁移后 M 归 `mapScreen`;新存档默认 M 是 `mapScreen`、`minimapShape` 没有默认键;`minimapMarkers` 缺省为 `'symbol'`、旧值保留
- [x] 测试(jsdom,canvas 没有 2D 上下文时跳过绘制不报错):`spawn` 模式点卡片调用 `onSelectCrew`,`battle` 模式不调用
- [x] 主程会在浏览器里看小地图和地图界面的军标,16 px 左右要看得清

## 不做

- main.ts 的接线(046):按 M 打开、开局先进地图界面、标记里填 `vehicleClass`、符号体系同步
- 机库去掉携弹面板、信息卡(045)

## 结果(完成后由执行者填写)

- 改动文件:
  - `src/data/controls.ts`: `ActionId` 新增 `mapScreen`，`minimapShape` 默认键位改为 `[null, null]`
  - `src/settings/Settings.ts`: `minimapMarkers` 支持 `'symbol'` 且设为缺省值，`sanitize` 实现老存档迁移逻辑
  - `src/ui/menu/SettingsPanel.ts`: 小地图标记分段选项增加「军标」
  - `src/ui/Minimap.ts`: 新增 `MapLike` 类型，`MinimapMarker` 增加 `vehicleClass`，`MarkerStyle` 增加 `'symbol'` 并在 `draw` 中绘制军标
  - `src/ui/MapScreen.ts`: 参数改为 `MapLike`，缺省绘制 18 px 军标并即时重画，增加 `onSelectCrew` 回调并在 `spawn` 模式生效
  - `tests/settings.test.ts`: 更新 `minimapMarkers` 缺省与合法性测试
  - `tests/controls-migration.test.ts`: 新增测试 `mapScreen` 定义及老存档迁移
  - `tests/minimap-symbols.test.ts`: 新增测试小地图军标、`MapLike` 兼容性及 `MapScreen` 回调
  - `changelog.d/2026-10-02-044-mapscreen-key-and-symbols.md`: 新增开发日志
- 命令与结果:
  - `npm run lint`: 通过 (0 errors)
  - `npm test`: 全部通过 (51 test files, 527 tests passed)
  - `npm run build`: 通过 (tsc && vite build 正常打包输出)
- 偏差 / 未完成 / 待决定:
  - 无偏差，全部按照任务卡与接口约定完成。

### 主程审查(Claude Code)

- 代码逐条对过卡片;lint / 527 个测试通过。`main.ts` 还没接线,浏览器里用临时页面(没提交)加载真实的 `Minimap`、`MapScreen` 和河谷地图看过:小地图 14 px、地图界面 18 px 的军标都分得清友 / 敌 / 阵亡,北约 / 华约两套;下拉框切换后立刻重画。
- 修了一处:测试里两处 `as any`(规格对象、改 Minimap 私有 ctx)换成真实的 `RIVER_VALLEY` 规格和 `getContext` 桩,不再绕过类型检查。
- `tests/settings.test.ts` 把「缺省是圆点」改成「缺省是军标」是卡上要求的默认值变化,断言只增不减,通过。
- 给 046 的备忘:地图界面的遮罩是半透明的,下面的小地图会透出来,打开地图界面时要把小地图藏起来。
