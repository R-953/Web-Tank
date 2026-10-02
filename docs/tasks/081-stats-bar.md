# 081-stats-bar:左下角的帧率 / 延迟 / 丢包 / 对局 ID 小字

- 负责:Copilot(`auto`,即 mai-code)
- 状态:已合并(第十二轮)
- 分支:`task/081-stats-bar`
- 规模:S
- 主程授权的例外(负责人 10-03「主程只审查」):本卡可以改 `src/main.ts` 里**创建这个小字组件、每帧更新、每局换对局 ID**的几行;别的地方不要动
- 077 / 078 / 079 / 080 同时在改 `src/ui/Hud.ts`、`WorldXray.ts`、`killcamOverlay.ts`,**不要碰这几个文件**;本卡的组件自己挂到 `document.body`,不要放进 `Hud.ts`

## 目标

负责人给的 War Thunder 截图(`D:/Web Tank/Archive/hud-reference-1003.webp`,能打开就看)最底部左下角有一行很小的灰字:`FPS: 75   Ping: 215   PL: 0%   52def57001e76f0`(帧率、延迟、丢包、一串随机的对局 ID)。左上角那块是 MSI Afterburner / RTSS 的硬件监控,**不做**(网页读不到本机硬件占用)。我们照左下角那行做:

- **帧率**:真实测量(`requestAnimationFrame` 的帧间隔,取最近约 0.5 秒的平均,每秒刷新 2 次文字,避免数字乱跳);
- **延迟 / 丢包**:现在是单机游戏,没有网络,所以显示 `Ping: 0` 和 `PL: 0%`。做成可替换的数据源:`interface NetStats { pingMs: number; lossPct: number }`,默认实现 `localNetStats` 返回 0 / 0(注释写明「单机没有网络;将来有联机时换成真实统计」);
- **对局 ID**:每开一局随机生成一串 15 位小写十六进制(和截图里的长度一样),用 `crypto.getRandomValues`(拿不到就退回 `Math.random`),整局不变;
- 样式:固定在屏幕**最左下角**,字很小(约 10–11 px)、浅灰半透明、等宽数字、带细黑阴影、`pointer-events: none`;格式 `FPS: 75  Ping: 0  PL: 0%  52def57001e76f0`(字段间两个空格)。左下角现在有车辆状态面板,**确认小字不压在面板上**(在浏览器里看;要是压住了,把小字贴到页面最底边 `bottom: 0`、行高 12 px,仍然压就在回报里写出来,**不要改 Hud.ts**)。

## 要做的事

1. 新增 `src/ui/hud/StatsBar.ts`:
   - 纯函数 / 小类,不依赖 DOM:`FpsMeter`(`tick(nowMs)` 记帧,`fps` 取最近 0.5 秒平均,整数)、`newMatchId(rng?)`(15 位小写十六进制,`rng` 可注入便于测试)、`formatStats({ fps, pingMs, lossPct, matchId })`(返回上面的字符串,`pingMs` 取整、`lossPct` 取整加 `%`);
   - DOM 类 `StatsBar(parent: HTMLElement, net: NetStats = localNetStats)`:`update(nowMs)`(每帧调用,内部 0.5 秒节流刷新文字)、`setMatchId(id)`、`setVisible(v)`。
2. 设置:`src/settings/Settings.ts` 新增 `game.showStats: boolean`(缺省 `true`,非布尔值回退缺省,旧存档读出缺省);`src/ui/menu/SettingsPanel.ts` 加一个复选框「显示帧率和对局信息」。照 `killCam` / `killCamAll`(和 073 新加的两项)的写法。
3. `src/main.ts`(只限几行):创建 `StatsBar`;战斗循环里每帧 `statsBar.update(now)`(`now` 是毫秒);开始新对局时(找 `hud.reset()` 附近)`statsBar.setMatchId(newMatchId())`;只在 `appState === 'battle'` 且 `cfg().game.showStats` 时显示(回机库 / 设置关闭时 `setVisible(false)`)。

## 背景与参考

- `src/main.ts`(`appState`、战斗循环、`hud.reset()` 的位置);`src/settings/Settings.ts`、`src/ui/menu/SettingsPanel.ts`、`tests/world-replay-setting.test.ts`(照它写设置测试)。

## 允许修改的文件

- 修改:`src/settings/Settings.ts`、`src/ui/menu/SettingsPanel.ts`、`src/main.ts`(见上)、本卡「结果」一节
- 新增:`src/ui/hud/StatsBar.ts`、`tests/stats-bar.test.ts`、`tests/stats-setting.test.ts`、`changelog.d/<日期>-081-stats-bar.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过,既有测试不改
- [ ] 测试:`FpsMeter`(固定帧间隔 → 对应 fps;帧间隔变化后平均值跟着变)、`newMatchId`(15 位、全是 `[0-9a-f]`、两次不同、注入 `rng` 可复现)、`formatStats`、`StatsBar` 的 jsdom 冒烟(挂载、更新、`setVisible`)、设置的缺省 / 非法值 / 旧存档
- [ ] 浏览器里看一遍(`npm run dev` + `?debug`),在回报里写:小字在哪、有没有压住车辆状态面板、FPS 数字是否合理、关掉设置后消失

## 不做

- 不做 MSI Afterburner / RTSS 那种硬件监控(浏览器读不到);不做真正的联机统计、不伪造延迟波动。

## 结果(完成后由执行者填写)

- 改动文件: `src/ui/hud/StatsBar.ts`、`src/settings/Settings.ts`、`src/ui/menu/SettingsPanel.ts`、`src/main.ts`、`tests/stats-bar.test.ts`、`tests/stats-setting.test.ts`、`changelog.d/2026-10-03-081-stats-bar.md`、本任务卡。
- 命令与结果: `npm run lint` 通过; `npm test` 通过(94 个测试文件、1009 个测试); `npm run build` 通过(Vite 有既有的大 chunk 提示)。
- 偏差 / 未完成 / 待决定:受允许命令限制，未能运行 `npm run dev` 并在浏览器目测；样式设置在左下角页面最底边(bottom: 0、行高 12 px)，理论上低于车辆状态面板底边，但遮挡情况、实际 FPS 显示和设置开关后的视觉效果未实测。
