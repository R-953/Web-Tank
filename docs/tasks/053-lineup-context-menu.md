# 053-lineup-context-menu:编组栏右键菜单改成换车 / 改装 / 涂装 / 试驾 / 乘员

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/053-lineup-context-menu`
- 规模:S–M

## 目标

负责人 10-02 要求:右键(或点卡片 ▾)弹出的菜单参考 War Thunder:**换车、改装、涂装、试驾、乘员**五项,每一项对应一个界面(界面本身在 055–057 和主程的接线里做,本卡只做菜单和回调)。WT 菜单最下面的「Informations」不加(它指向官方 wiki;我们有悬停信息卡)。

## 背景与参考

- `src/ui/menu/LineupBar.ts` 的 `showContextMenu`:现在是「更换载具 / 清空 / 载具信息」三项,回调有 `onPickVehicle`、`onShowInfo` 等,选项接口 `LineupBarOptions` 在文件顶部。
- WT 菜单外观:一列带图标的行,每行左边一个小图标、右边文字,「乘员」行右边有一个黄色圆形感叹号(这里用于提示**有车组未训练 / 技能为 0**,见下面第 3 条;不需要时不显示)。
- 样式在 `src/ui/menu/styles.ts` 里 `.mm-lineup-context-menu` / `.mm-lineup-menu-item` 那一段;**只改那一段(新规则放在它紧后面),不要追加到文件末尾**。

## 要做的事

1. 菜单项(从上到下):**换车**(原「更换载具」,保留现有行为,文字后加「(+)」)、**改装**、**涂装**、**试驾**、**乘员**;再用一条细分隔线,最下面保留**清空**(原行为不变)。去掉「载具信息」一项(`onShowInfo` 选项保留在接口里以免破坏调用方,但菜单里不再用它)。每项左边一个简单的内联 SVG 图标(换车:上下箭头;改装:扳手 / 螺丝刀;涂装:刷子;试驾:坦克;乘员:人像;清空:×),颜色跟随文字色。
2. `LineupBarOptions` 增加四个**可选**回调,点对应菜单项时先关菜单、播 `onUiSound`,再调用:
   ```ts
   onOpenModifications?(vehicleId: string, crewIndex: number): void;
   onOpenCustomization?(vehicleId: string, crewIndex: number): void;
   onTestDrive?(vehicleId: string, crewIndex: number): void;
   onOpenCrew?(nation: string, crewIndex: number): void;
   ```
   没传回调时,对应菜单项**置灰不可点**,并用 `title` 提示「暂未开放」。
3. 「乘员」行的黄色感叹号:当前车组 `progress` 为 0(新手车组)时显示,`title` 为「新手车组:挂机成长或在线游玩后会提升」。
4. 菜单位置:菜单变高了(6 行),原来写死的 `left + 120`、`top + 90` 越界判断要按实际菜单宽高算(用渲染后的 `offsetWidth` / `offsetHeight` 或写一个纯函数 `contextMenuPosition(clickX, clickY, menuW, menuH, rootRect)`,导出并写单元测试:右边、下边越界时翻到鼠标另一侧,不超出根元素)。
5. 不删、不放宽已有测试;`tests/lineup-bar.test.ts` 里依赖旧菜单的断言(「载具信息」那条)改成新菜单并在结果里说明。

## 允许修改的文件

- 修改:`src/ui/menu/LineupBar.ts`、`src/ui/menu/styles.ts`(见上)
- 修改测试:`tests/lineup-bar.test.ts`;可新增 `tests/lineup-context-menu.test.ts`
- 新增:`changelog.d/<日期>-053-lineup-context-menu.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 测试:菜单项顺序和文字;五个回调各自被调用且参数正确;没传回调的项置灰且点击无反应;「清空」行为不变;`contextMenuPosition` 的越界翻转;乘员行感叹号只在 `progress` 为 0 时出现
- [ ] 主程会在浏览器里右键看菜单

## 不做

- 各界面本身(055–057)、`main.ts` 接线(主程做)、试驾的游戏逻辑(主程做);不加「载具信息 / Informations」。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
