# 073-settings-world-replay:设置里加「内构显示方式」和「死亡回放方式」

- 负责:Copilot(`auto`,即 mai-code)
- 状态:待领取
- 分支:`task/073-settings-world-replay`
- 规模:S
- 只改设置相关文件;`main.ts` 怎么读这两项由下一波的 074 接

## 目标

第十二轮要把 O 键内构显示和自己被击毁的回放改成「叠在世界里的 X 光」(072),旧做法(左侧小窗、全屏独立窗口)保留作为选项。设置里加两项:

- `game.internalsStyle`:`'world' | 'panel'`,缺省 `'world'`(世界里直接开 X 光 / 左侧面板)。
- `game.deathReplayStyle`:`'world' | 'window'`,缺省 `'world'`(叠在世界里 / 全屏独立窗口)。

照 `killCam` / `killCamAll` 的写法:`src/settings/Settings.ts` 里加字段、缺省值和清洗(不是这两个取值的一律回退到缺省,旧存档没有这两项也要得到缺省),`src/ui/menu/SettingsPanel.ts` 里加两个下拉(「内构显示方式:在载具上显示 X 光 / 左侧面板」「死亡回放方式:叠在游戏画面里 / 全屏窗口」),中文文案和现有风格一致。

## 背景与参考

- `src/settings/Settings.ts`、`src/ui/menu/SettingsPanel.ts`、`tests/killcam-setting.test.ts`(照着它写测试)。

## 允许修改的文件

- 修改:`src/settings/Settings.ts`、`src/ui/menu/SettingsPanel.ts`
- 新增:`tests/world-replay-setting.test.ts`、`changelog.d/<日期>-073-settings-world-replay.md`
- 修改:本卡「结果」一节
- 不要改 `main.ts`、`Game.ts`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过,既有测试不改
- [ ] 新测试:缺省值、非法值回退、旧存档(没有这两项)读出缺省、面板里两个下拉改值后写入设置

## 不做

- 不实现 X 光和回放本身(071 / 072),不接 `main.ts`。

## 结果(完成后由执行者填写)

- 改动文件:修改 `src/settings/Settings.ts`、`src/ui/menu/SettingsPanel.ts`、本任务卡;新增 `tests/world-replay-setting.test.ts`、`changelog.d/2026-10-03-073-settings-world-replay.md`。
- 命令与结果:`npm run lint` 通过;`npm test` 通过(83 个测试文件、880 个测试);`npm run build` 通过。
- 偏差 / 未完成 / 待决定:无。
