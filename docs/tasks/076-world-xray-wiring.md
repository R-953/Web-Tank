# 076-world-xray-wiring:把世界内 X 光(O 键)和叠在世界里的死亡回放接进游戏

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/076-world-xray-wiring`
- 规模:M
- 前置(都已合进 `integration/round12`):071 共用内构模型 `src/ui/internalsModel.ts`、072 `WorldXray` / `WorldReplay`(`src/ui/WorldXray.ts`、`src/ui/WorldReplay.ts`,接口和注意事项见 `docs/tasks/072-world-xray-replay.md` 的「结果」)、073 设置项 `game.internalsStyle` / `game.deathReplayStyle`、074 回放触发规则 `killcamPlan`(`src/ui/killcamPolicy.ts`)
- 主程授权的例外(负责人 10-03「主程只审查」):本卡可以改 `src/main.ts`;如确需,可对 `src/game/Vehicle.ts` 做**只加不改**的小扩展(比如暴露一个只读属性),在回报里列出来
- 075(Copilot)同时在改 `killcamOverlay.ts` 的文案和文档,不要碰这些文字

## 目标

1. **O 键内构显示**:`game.internalsStyle === 'world'`(缺省)时,按 O 直接在**当前这辆车上开 X 光**(`WorldXray`),不再画左侧小窗;`'panel'` 时保持现状(`InternalsView` 左侧面板)。
2. **自己被击毁的回放**:`game.deathReplayStyle === 'world'`(缺省)时,`killcamPlan` 返回 `layout: 'full'`(己方被击毁)的那一次,**不再用全屏独立窗口**,改用 `WorldReplay` 叠在游戏世界里播(残骸 X 光 + 弹道线 + 弹着标记 + 环绕相机 + 顶部文字层);`'window'` 时保持现状(`killcam.play(e.replay, plan)`)。其余回放(右上角小窗)一律照旧用 `KillCam`。
3. 设置面板里 `killCamAll` 的文案改成「命中敌方时都回放(关闭后只回放击毁)」(`src/ui/menu/SettingsPanel.ts`,只改这一个文案)。

## 要做的事(都在 `src/main.ts`,逻辑尽量抽成不依赖 DOM 的纯函数放进新文件 `src/ui/worldReplayFlow.ts` 并写测试)

- **O 键 X 光**:
  - 建一个 `WorldXray(player)`(玩家车变了——换车、试驾、重开——要重建或 `disable` 后重新 `enable`);`internalsOn` 切到开且样式是 `world`:`enable(internalsSnapshot(player))`;每帧开着时 `update(internalsSnapshot(player))`;关掉:`disable()`。`InternalsView` 面板只在样式是 `panel` 时显示。
  - 开镜(`scoped`)时把 X 光淡出(`setFade(0)`),退出开镜淡回(`setFade(1)`),避免灰壳轮廓线挡住瞄准镜;打开地图界面 / 暂停 / 己方被击毁 / 重开 / 回机库时必须 `disable()`,不能残留半透明材质。
- **死亡回放进世界**:
  - 触发点还是 `drainEvents` 里 `killcamPlan` 返回非 null 的地方:`plan.layout === 'full' && deathReplayStyle === 'world'` → 先 `WorldXray.disable()`(如果开着),再 `worldReplay.play(player, e.replay, now)`,`overlayHost` 用 `document.body`;其余情况走原来的 `killcam.play`。
  - **相机交接**:`worldReplay.active` 期间主相机由 `WorldReplay.update(now)` 驱动,跟随相机的更新要跳过(找到 `main.ts` 里更新相机位置的地方加个判断);`finished` 之后再多停一小会(约 0.5 秒)`stop()`,把相机交还。回放期间隐藏准星 / 瞄准镜叠加层 / 小地图等会遮画面的 HUD(能做到的就做,做不到在回报里说明),世界(敌车、特效)照常运行。
  - **结算画面**:现在 `!killcam.active` 才弹结算,改成同时要求 `!worldReplay.active`。
  - 重开、回机库、试驾退出、开始新对局等调用 `killcam.stop()` 的地方,同时调用 `worldReplay.stop()`(并 `disable()` X 光)。
  - 玩家战败时 `becomeWreck` 已经把外壳材质变暗,`WorldXray` 克隆材质时取的是当时的颜色——**确认回放里残骸的颜色看起来是灰色半透明壳而不是一团黑**;如果是黑的,需要在 `WorldXray` 里提亮灰壳的混合比例(改 `src/ui/WorldXray.ts` 允许)。
- 纯函数 `worldReplayFlow.ts`:例如 `useWorldReplay(plan, settings)`(是否走世界内回放)、`xrayFadeTarget({ enabled, scoped })`、`canShowResult({ killcamActive, worldReplayActive, ... })`,各配单元测试。

## 背景与参考

- `src/main.ts`:`internalsOn` / `internalsView`(约 176、719、916–922 行)、回放触发(约 786–805 行,074 刚改过)、`killcam.stop()` 的几处(约 491–513 行)、相机更新和渲染循环、结算弹出(约 806–810 行);`src/ui/WorldXray.ts`、`src/ui/WorldReplay.ts`、`src/ui/killcamPolicy.ts`、`src/game/internalsSnapshot.ts`。
- `?debug` 下 `__debug.game()` 可以拿到 `Game`,`__debug.advance(秒)` 快进;在浏览器里验证:开 X 光、被击毁后播回放。

## 允许修改的文件

- 修改:`src/main.ts`、`src/ui/menu/SettingsPanel.ts`(只改 `killCamAll` 文案)、`src/ui/WorldXray.ts`(只限调灰壳颜色这类小调整)、`src/game/Vehicle.ts`(只加不改,见上)、本卡「结果」一节
- 新增:`src/ui/worldReplayFlow.ts`、`tests/world-replay-flow.test.ts`、`changelog.d/<日期>-076-world-xray-wiring.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过,既有测试不改
- [ ] 纯函数测试覆盖:样式 `world` / `panel`、`window` / `world` 的分流,开镜淡出,结算画面等待逻辑
- [ ] 用 `npm run dev` + `?debug` 在浏览器里做一遍并在回报里写清结果:O 键在车上开 X 光、开镜淡出、关掉后材质还原;让敌车击毁自己(可以用 `__debug.game()` 降低玩家模块血量 / 让敌人开火)看世界内回放能播完、相机交还、之后弹出结算;切到 `panel` / `window` 后旧行为不变;控制台无报错

## 不做

- 不改 `WorldReplay` / `WorldXray` 的接口;不改回放文字(075);不做占点模式、超越控制。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
