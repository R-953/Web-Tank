# 077-hud-layout-killfeed:底部提示的布局(圆环同高、按参考图排)+ 击毁提示带车型和弹种

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/077-hud-layout-killfeed`
- 规模:M
- 主程授权的例外(负责人 10-03「主程只审查」):本卡可以改 `src/game/Game.ts` **构造 `hit` 事件的那一行**,给事件加一个**可选**字段 `shooterName?: string`(开炮车的车名);别的地方不要动
- 078(残骸颜色)、079(文案)同时在改别的文件,不要碰 `src/ui/WorldXray.ts`、`src/ui/WorldReplay.ts`、`src/ui/killcamOverlay.ts`

## 参考图

负责人给了一张 War Thunder 的战斗截图,**本机路径 `D:/Web Tank/Archive/hud-reference-1003.webp`**(能打开就看一眼;不能打开就按下面的文字描述做)。底部中间自上而下是:

1. **操作提示行**:一个带边框的按键框 + 一句话,例如「[F] 按住开始维修」(大一号、白字、带阴影);
2. **圆环行**:两个白色圆环**并排、在同一高度**,环里是符号(履带 / 方向盘等),符号红色 = 对应乘员失去战斗力;
3. **状态文字行**:几行较小的白色文字,例如「驾驶员昏迷,xx:xx 后恢复车辆控制」「灭火器已启用」,旧的一行行淡出;
4. 最下面才是 1–8 号快捷栏(我们的按钮栏)。

右侧中部是**击毁提示流**,每行形如 `射击者(车型) ➡弹种 被击毁者(车型)`:射击者按阵营着色(友军蓝、敌军红),被击毁者同样按阵营着色,中间的 ➡ 后面紧跟弹种名,例如 `T-80B ➡3BM42 Puma VJTF`。**单机游戏没有玩家名,所以只写车型**。

## 目标

### 1. 底部提示的布局(`src/ui/Hud.ts`、`src/ui/hud/`)

现状(068):状态文字在上、圆环在下,圆环行 `align-items: flex-end`,带文字的维修圆环和不带文字的顶替圆环**高低不一**。改成参考图的顺序,自上而下:

1. **操作提示行**:把现在的黄字「有模块被打坏 — 按 F 维修」改成按键框 + 文字的样式(「[F] 按住开始维修」;按键名取 `HudState.keys.repair`,别写死 F;条件不变:没在维修、没着火、有可修的模块);灭火提示同理(着火且有灭火器时:「[6] 灭火」之类,键名取 `keys.extinguish`)。
2. **圆环行**:所有圆环**顶部对齐、圆心在同一水平线上**(`align-items: flex-start` 或固定高度),**圆环自己不再带文字**——`ProgressRing` 的 `label` 保留给将来用,但维修的文字不再画在圆环下面。
3. **状态文字行**:维修倒计时「正在修理,剩余:30秒」作为这一块的**第一行**(琥珀色,居中在圆环行正下方),接着是 068 的状态提示(「起火!」「发动机受损,无法移动」「炮手昏迷…」)和瞬时提示;最多 4 行。
4. 按钮栏。

`ProgressRing` 的接口不变(`set` / `hide`),只是维修圆环不再传 `label`;`hudStatus.ts` 里要新增对应的纯函数(例如 `repairLabel(remainingSec)`、`hintLine(...)`),并加测试。

### 2. 击毁提示流(`Hud.onEvent`、右上的 feed)

改成参考图的格式 `射击者车型 ➡弹种 被击毁者车型`,友军蓝、敌军红(玩家和玩家一方为友军,靶车 / 敌车为敌军;颜色用现有 feed 配色风格里挑清楚的蓝 / 红):

- 一发击毁(`type: 'hit'` 且 `replay.destroyed`):射击者 = `shooterName`(见下),弹种 = `replay.shell.name`,被击毁者 = `targetName`。`GameEvent` 的 `hit` 变体新增可选字段 `shooterName?: string`,在 `Game.ts` 构造 `hit` 事件的地方(约 660 行)填 `shooter.spec.name`(取不到就不填;HUD 里缺省显示「未知」)。
- 车型太长时用短名:先看 `VehicleSpec` 里有没有简称字段,没有就去掉括号及括号里的内容(如「虎式 Ausf. E(1944 后期型)」→「虎式 Ausf. E」),写成纯函数 `killFeedName(spec.name)` 并测试。
- 不是一发击毁、而是起火 / 弹药被火烤殉爆 / 烧毁等**没有射击者**的击毁(`type: 'destroyed'` 且前 0.5 秒内没有同一目标的击毁行):显示 `被击毁者车型 烧毁` / `被击毁者车型 弹药殉爆` 之类(原因文字沿用现有 `crew / ammo / fire` 对照)。**同一目标不能出现两行**(一发击毁时 `hit` 和 `destroyed` 事件都会来,按目标 id 去重)。
- **己方被击毁也要出现在流里**(现在只写别人)。
- 敌方起火 / 殉爆那几行保持。

## 背景与参考

- `src/ui/Hud.ts`:`onEvent`、`updateMessages`、`updateRings`、CSS(`.hud-msgs`、`.hud-rings`、`.hud-bottom` 约 100–127 行)、feed 的 `pushFeed`;`src/ui/hud/hudStatus.ts`、`ProgressRing.ts`;`GameEvent` 在 `src/game/Game.ts`。
- 单机游戏**没有用户名**,不要加任何玩家名字段。

## 允许修改的文件

- 修改:`src/ui/Hud.ts`、`src/ui/hud/hudStatus.ts`、`src/ui/hud/ProgressRing.ts`(只限去掉对 label 的依赖)、`src/game/Game.ts`(只限 `hit` 事件的可选字段)、`docs/design/hud-status.md`(更新布局说明)、`tests/hud-status.test.ts`、`tests/progress-ring.test.ts`、本卡「结果」一节
- 新增:`tests/kill-feed.test.ts`、`changelog.d/<日期>-077-hud-layout-killfeed.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 纯函数测试:`killFeedName`、击毁行的格式(有射击者 / 无射击者 / 己方被击毁 / 友敌配色)、同目标去重、操作提示行的触发条件
- [ ] 用 `npm run dev` + `?debug` 在浏览器里看一遍并写进回报:顶替圆环和维修圆环同时出现时**同高**;维修文字在圆环行正下方;击毁一辆靶车和被敌车击毁时右侧各出一行,格式正确;控制台无报错。(测试 / 看画面的办法:`__debug.game()` 可以拿到 `Game`,把靶车搬到玩家面前开炮,`__debug.advance(秒)` 快进。)

## 不做

- 不改回放(069 / 075 / 078)、不做占点模式;不加玩家名。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
