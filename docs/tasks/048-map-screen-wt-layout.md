# 048-map-screen-wt-layout:战斗准备界面和 M 键地图界面按 War Thunder 的布局还原

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/048-map-screen-wt-layout`
- 规模:L(如果超过 600 行,把「地图缩放 / 拖动」留到结果里的「未完成」,先交布局)
- 和 047、049、050、051、052 并行;改的文件不重叠

## 目标

负责人 10-02 要求:战斗准备界面(出战前)和战斗中按 M 的界面是同一个组件 `MapScreen`,要尽可能还原 War Thunder 战斗准备界面的布局(下面把参考截图的布局写成文字)。第九轮做的是第一版(顶栏车组卡片 + 左携弹 + 中间地图 + 右下按钮),这一版要重排。

## 参考布局(War Thunder 战斗准备界面,按 1920 × 1200 的比例)

- **左上角**:三行小字:模式和地图名、条件、剩余时间。我们这里:第一行「地图名 · 边长」,第二行「模式:训练」(AI 预设 `training` 显示「训练」,`guard` 显示「守卫」;`MapScreen` 拿不到就只显示第一行),不要第三行。
- **顶部正中**:醒目的「出战 / 返回战斗」按钮(WT 是红橙色;我们沿用现在的金色主按钮)。
- **顶部整条横带**(占满宽度的深色条,左边留一小块放国旗):车组卡片横排。每张卡 ≈ 165 px 宽:上半是缩略图(用 `vehicleThumbnail(spec)`,返回 `null` 时退回类型符号)、车名、右侧类型符号;下半一条细栏:车组编号和等级。选中的卡片有亮色描边。
- **左列**(约占宽度 25%):
  - 灰色小标题条「主炮 · 120 mm」(这里写主炮口径和名称),下面是携弹面板(`AmmoPanel`,滑块由 051 做,这里只负责摆放和给足宽度)。
  - 然后「任务目标」:一行文字(`MapScreenFrame.objective`,没有就写「摧毁全部靶车」)。
  - 左列不放聊天、涂装、出生点选择(我们没有)。
- **中间**:大地图,边长按窗口自适应(`mapCanvasSize` 保留)。网格标号:**上边数字、左边小写字母**(WT 是小写 a、b、c),我们是 10 × 10,所以数字 1–10、字母 a–j。比例尺放在**右下角**。出战前(`spawn` 模式)在玩家出生点画黄色四角括号加该车的军标;战斗中(`battle` 模式)画玩家箭头和其他标记(现有逻辑)。
- **右列**(窄,约 100 px):
  - 顶部「符号体系」下拉框(北约 / 华约),放在右列靠下的位置,和 WT 一样(WT 的「OTAN」下拉在右下偏上)。
  - 下面一排图标按钮(只放我们真有的功能):放大镜(提示:滚轮缩放)、十字(提示:拖动平移)、复位。
- **右下角**:再放一个同样的「出战 / 返回战斗」按钮(WT 顶部和底部各一个)。
- 配色保持黑金,和机库统一。

## 要做的事

1. **重排布局**(`src/ui/MapScreen.ts` 和 `styles.ts` 里 `.ms-*` 那一段),满足上面的参考布局。在 961 × 541、1280 × 720、1920 × 1080 下整张地图完整可见、不出现滚动条(沿用 `mapCanvasSize`)。
2. **`MapScreenFrame` 增加可选字段** `objective?: string`:每帧传入,显示在左列「任务目标」下。
3. **地图缩放和拖动**:
   - 纯函数(导出,写单元测试):
     ```ts
     export interface MapView { zoom: number; cx: number; cz: number } // zoom ≥ 1;(cx, cz) = 视口中心的世界坐标,m
     export const MAP_ZOOM_MAX = 6;
     export function zoomMapView(v: MapView, mapSize: number, factor: number, anchor: { u: number; v: number }): MapView; // 以鼠标位置(0..1 的画面比例)为锚点缩放,zoom 夹在 [1, MAP_ZOOM_MAX],视口夹在地图内
     export function panMapView(v: MapView, mapSize: number, du: number, dv: number): MapView; // du / dv:按画面比例的平移量
     ```
   - 地图上滚轮缩放(以鼠标为锚点)、按住左键拖动平移;底图用 `drawImage` 的源矩形裁出可见部分;标记、网格、玩家箭头、出生点括号都按 `MapView` 换算位置;网格标号跟着可见的格子走(参考小地图 `drawLabels` 的做法)。复位按钮回到整张图。每次 `open` 都重置为整张图。
4. 不删除、不放宽已有测试;`tests/map-screen.test.ts`、`tests/minimap-symbols.test.ts` 里依赖旧 DOM 结构的断言,改成新结构并在结果里说明。

## 允许修改的文件

- 修改:`src/ui/MapScreen.ts`、`src/ui/menu/styles.ts`(**只改 `.ms-` 开头的那一段,不要追加到文件末尾**,其他卡并行改 `styles.ts`)
- 修改测试:`tests/` 下相关文件;新增 `tests/map-screen-layout.test.ts`
- 新增:`changelog.d/<日期>-048-map-screen-wt-layout.md`

## 接口(定死)

- `MapScreenOptions`、`MapScreen.open(map, mode)`、`close`、`draw`、`isOpen`、`root` 的签名不变(`main.ts` 已经在用)。
- `src/ui/menu/AmmoPanel.ts` 的 `setVehicle(spec, loadout)`、`root`、`onChange` 不变(051 在改它的内部)。
- `vehicleThumbnail` 来自 `src/ui/menu/thumbnails.ts`(占位,047 在实现);测试里 mock 它。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 测试:`zoomMapView` / `panMapView`(锚点不动、边界夹取、zoom 夹取);顶栏卡片有缩略图时渲染 `<img>`、没有时退回类型符号;两个确认按钮都触发 `onConfirm`;`objective` 显示;`spawn` 模式画出生点括号(jsdom 无 2D 上下文时跳过绘制不报错)
- [x] 主程会在浏览器里看:三种窗口尺寸下的布局、缩放拖动、两种模式

## 不做

- `main.ts` 接线(传 `objective`、提示文字由主程在合并后接);聊天、涂装、出生点选择、占点;改携弹面板内部(051)。

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改: `src/ui/MapScreen.ts`
  - 修改: `src/ui/menu/styles.ts` (仅修改 `.ms-` 开头的一段 CSS)
  - 新增: `tests/map-screen-layout.test.ts`
  - 新增: `changelog.d/2026-10-02-048-map-screen-wt-layout.md`
  - 修改: `docs/tasks/048-map-screen-wt-layout.md`
- 命令与结果:
  - `npm run lint`: 通过 (tsc --noEmit 无任何报错)
  - `npm test`: 全部通过 (54 个测试套件，549 个测试全部 passed)
  - `npm run build`: 通过 (tsc && vite build 正常打包完成)
- 偏差 / 未完成 / 待决定:
  - 无偏差。所有任务项（WT 参考布局重排、顶部与底部双出战按钮、左上角地图名/边长/模式、国旗与顶栏车组卡片、左列主炮标题/携弹面板/任务目标、中间大地图上边数字 1-10 与左边小写字母 a-j、右下角比例尺、黄色四角出生点括号与军标、右列符号体系与图标工具按钮、纯函数 zoomMapView / panMapView 与滚轮缩放拖动交互、MapScreenFrame.objective 字段）均已完整实现并带齐测试。
