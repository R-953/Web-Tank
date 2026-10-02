# 080-repair-countdown-line:维修倒计时放在状态文字的最后一行,文案改成「修复车辆还需 mm:ss」

- 负责:Copilot(`auto`,即 mai-code)
- 状态:待领取
- 分支:`task/080-repair-countdown-line`
- 规模:S
- 前置:077(底部提示布局)已合进 `integration/round12`;本卡只改 077 做完的那一块,不动别的

## 背景

负责人补充了参考图里漏掉的一行:War Thunder 底部**最下面一行**文字是维修倒计时,法文「Le char sera réparé dans 00:10」。游戏语言文件里的键是 `NUD_TIME_TO_TANK_REPAIR`,简体是「修复车辆还需」+ 计时器 `mm:ss`(同类键:`HUD_TIME_TO_TRACK_REPAIR` 修复履带还需、`hints/repair_tank` 开始维修车辆)。文件来源:社区 datamine `gszabi99/War-Thunder-Datamine` 的 `lang.vromfs.bin_u/lang/menu.csv`。

077 把「正在修理,剩余:30秒」放在状态文字块的**第一行**(圆环行正下方),**位置和文案都要改**:

1. 维修倒计时是状态文字块的**最后一行**(在「起火!」「发动机受损…」「炮手昏迷…」「xx受伤」等所有其他行**下面**,紧贴按钮栏上方);
2. 文案改成「修复车辆还需 00:10」:`mm:ss` 两位补零,秒数 = `ceil(remaining / repairRate)`(和现在算法一致),琥珀色,居中;
3. 状态文字块有行数上限(077 定的 4 行):**倒计时这一行单独占位,不计入上限、也不能被别的行挤掉**(别的行最多 3–4 行,倒计时永远显示在最下面);
4. 操作提示行(「[F] 开始维修车辆」)的文案按语言文件 `hints/repair_tank` 写成「开始维修车辆」(按键名仍取 `keys.repair`,不写死)。

## 要做的事

- `src/ui/hud/hudStatus.ts` 里 077 新增的 `repairLabel(...)`:改文案和格式(例如 `repairLabel(remainingSec)` → `修复车辆还需 00:10`),并补 `formatClock(sec)` 之类的小纯函数(≥ 60 秒显示 `01:05`);
- `src/ui/Hud.ts`:把倒计时行挪到文字块最后;单独的 DOM 节点放在文字块底部,别的状态行放在它上面;
- 测试(`tests/hud-status.test.ts` 等)里对旧文案和位置的断言**只改文案和位置,不删不放宽**;新增:`mm:ss` 补零、超过一分钟、倒计时不占用行数上限。

## 允许修改的文件

- 修改:`src/ui/Hud.ts`、`src/ui/hud/hudStatus.ts`、`tests/hud-status.test.ts`、`docs/design/hud-status.md`(布局说明里同步)、本卡「结果」一节
- 新增:`changelog.d/<日期>-080-repair-countdown-line.md`
- 不要改 `Game.ts`、`main.ts`、`WorldXray.ts`、`killcamOverlay.ts`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 回报里写清:倒计时现在是哪一行、有没有被别的行挤掉(可以在 `npm run dev` + `?debug` 里用 `__debug.game().player.damage.startRepair()` 看,同时让几个模块受损 / 起火)

## 不做

- 不改圆环和击毁提示流(077 做完了);不改维修的玩法(仍是按 F 开始)。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
