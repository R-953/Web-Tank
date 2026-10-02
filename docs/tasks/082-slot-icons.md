# 082-slot-icons:底部按钮栏每个按钮加图标

- 负责:Copilot(`auto`,即 mai-code)
- 状态:已合并(第十二轮)
- 分支:`task/082-slot-icons`
- 规模:S–M
- 和 080(维修倒计时行,也在改 `Hud.ts`)并行:**只改按钮栏那一块**(`makeSlot`、`updateBar` 和 `.hud-slot` 的样式),不要碰状态文字块、圆环、击毁提示流的代码;合并时的小冲突由主程处理

## 目标

底部按钮栏现在每个按钮只有按键号 + 文字(弹种名 / 「机枪」/「维修」/「灭火」…)+ 数量。负责人要求**每个按钮加一个图标**,风格参照 War Thunder 底部快捷栏(`D:/Web Tank/Archive/hud-reference-1003.webp` 最下面一排:按键号在上、图标在中间、数量在下,能打开就看一眼)。保留原来的文字(弹种名等)和数量,图标加在按键号下面、文字上面;按钮可以略微加高(现在 64 × 50 px)。

图标都用**内联 SVG**(线条 + 少量填充,单色为主,和现有 HUD 的白 / 琥珀色协调,别引入图片文件和新依赖):

- **弹种**(按 `ShellType`,取值见 `src/data/types.ts` 的 `SHELL_TYPES`):每种画一个竖放的炮弹侧影,靠弹头 / 弹芯 / 颜色区分:
  - 穿甲类(`AP` / `APBC` / `APCBC` / `APCBC-HE` 等):尖弹头 + 风帽(帽用浅色);
  - `APCR` / `APDS`(硬芯 / 脱壳):细长弹芯露在外壳里;
  - `HEAT`(空心装药):锥形弹头 + 里面的锥形罩;
  - `HE`(榴弹):钝头,弹头红色;
  - `SMOKE`(烟幕,如果有):弹体灰色 + 烟团;
  - 以上之外的类型用通用炮弹图标兜底(`default`)。
- **同轴机枪**:一排并列的子弹;**维修**:扳手(和圆环里的 `repair` 图标用同一个,可以复用 `src/ui/hud/ProgressRing.ts` 里的 SVG 路径,别复制粘贴,必要时把路径常量导出);**灭火**:灭火器;**开镜 / 变焦**(如果按钮栏里有):瞄准镜十字线。
- 选中的弹种、已装填的、数量为 0 的、起火 / 忙碌状态下,图标要跟着现有的样式变化(选中 = 琥珀色描边、数量 0 = 变暗、着火时灭火图标红色闪烁、维修中图标变蓝),**沿用现有的 `.sel` / `.empty` / `.alert` / `.busy` 类,别另起一套状态**。

## 要做的事

1. 新增 `src/ui/hud/slotIcons.ts`:导出 `slotIconSvg(kind: SlotIconKind): string`(返回 SVG 字符串),`SlotIconKind` 包含各弹种 + `'mg' | 'repair' | 'extinguish' | 'scope' | 'default'`;导出纯函数 `shellIconKind(shellType: string): SlotIconKind`(把 `ShellType` 映射到图标种类,未知值回退 `'default'`),并写测试保证 `SHELL_TYPES` 里的每个类型都有对应图标。
2. `src/ui/Hud.ts`:`makeSlot` 里加一个图标容器,`updateBar` 里按弹种 / 按钮类型设置图标(只在签名变化时重建,别每帧改 `innerHTML`);`.hud-slot` 样式里给图标留位置(图标约 22–26 px)。

## 背景与参考

- `src/ui/Hud.ts`:`makeSlot`、`updateBar`、`.hud-slot*` 样式(约 114–127 行);`src/data/types.ts` 的 `SHELL_TYPES` / `ShellType`;`src/ui/hud/ProgressRing.ts`(已有扳手、方向盘、瞄准镜、炮弹等 SVG)。

## 允许修改的文件

- 修改:`src/ui/Hud.ts`(只限按钮栏)、`src/ui/hud/ProgressRing.ts`(只限把图标路径导出复用)、本卡「结果」一节
- 新增:`src/ui/hud/slotIcons.ts`、`tests/slot-icons.test.ts`、`changelog.d/<日期>-082-slot-icons.md`

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过,既有测试不改
- [ ] 测试:`shellIconKind` 覆盖所有 `ShellType` 且未知值回退;每个 `SlotIconKind` 的 SVG 都是合法字符串(含 `<svg`);`jsdom` 里 `updateBar` 后每个按钮都有图标节点(代码测试已通过,浏览器目视验收未完成)
- [ ] 浏览器里看一遍(`npm run dev` + `?debug`)并在回报里写:每种弹种的图标是否能区分、选中 / 数量 0 / 着火时的样式、按钮有没有被撑得太大

## 不做

- 不改装填 / 换弹逻辑(负责人说现在的装填时换弹逻辑有问题,**以后单独改**,不要在本卡里碰);不改状态文字块和圆环。

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改:`src/ui/Hud.ts`、`src/ui/hud/ProgressRing.ts`、本卡
  - 新增:`src/ui/hud/slotIcons.ts`、`tests/slot-icons.test.ts`、`changelog.d/2026-10-03-082-slot-icons.md`
- 命令与结果:`npm run lint`通过;`npm test`首次运行有 1 个既有 `killcam-redo.test.ts` 断言失败,重跑后 97 个测试文件 / 1056 个测试全部通过;`npm run build`通过(仅有现有 chunk size 提示)
- 偏差 / 未完成 / 待决定:未能在浏览器中查看 `?debug` 页面,弹种辨识度、状态色和按钮实际尺寸仍需目视确认;按钮高度从 50px 调为 64px
