# 任务看板

一个任务一张卡(模板见 [TEMPLATE.md](TEMPLATE.md))。主程写卡、分配、审查;执行者只做卡上的事,完成后在卡末尾填「结果」。

| 编号 | 任务 | 负责 | 车道 | 状态 |
|---|---|---|---|---|
| [000](000-git-sync.md) | 理顺 git,把第五轮和协作机制推上 GitHub | Claude Code | 主程 | 已合并 |
| [001](001-perf-baseline.md) | 本机帧率基线(低 / 中 / 高画质) | Claude Code(代 Antigravity) | 界面 / 实测 | 待领取(等 Chrome 连上) |
| [002](002-minimap-marker-style.md) | 小地图标记样式:圆点 / 箭头 | Claude Code(代 Copilot) | 小任务 | 待审查 |
| [003](003-research-m4a3-76w.md) | M4A3(76)W 数据调研(只出数据和出处) | Claude Code(代 Gemini CLI) | 内容 | 待审查 |
| [004](004-local-model-eval.md) | 本地模型能力测试 | 负责人 + LM Studio | 杂务 | 待领取(随时) |
| [005](005-menu-dropdown-overlap.md) | 主界面下拉菜单被车辆信息面板盖住 | Claude Code | 主程 | 待审查 |
| [006](006-casemate-aiming.md) | 固定战斗室(无炮塔)车辆的瞄准逻辑 | Claude Code | 主程 | 进行中 |
| [007](007-casemate-vehicles.md) | 两辆代表性固定战斗室车辆:StuG III G、SU-100(数据) | Claude Code | 主程 / 内容 | 待领取(006 之后) |

### 候选车辆(负责人 2026-09-29 提出方向,型号待确认后再开卡)

按「早期 / 后期型只是换皮时只做后期型」挑选:

| 国家 | 类别 | 候选 |
|---|---|---|
| 德国 | 突击炮 / 歼击车 | StuG III G(007)、Jagdpanzer IV/70、Jagdpanther |
| 德国 | 中型坦克 | 豹式 G 型(D / A 型视为换皮,不做) |
| 苏联 | 各口径自行反坦克炮 | SU-76M(76 mm)、SU-85(85 mm)、SU-100(100 mm,007)、ISU-122(122 mm)、ISU-152(152 mm) |
| 苏联 | 各重量坦克 | 轻型 T-70、中型 T-34-85(已有)、重型 IS-2(1944) |

状态:待领取 → 进行中 → 待审查 → 已合并。改状态时同时改卡片开头的「状态」一行。

## 各工具怎么读到 AGENTS.md

- **Claude Code:** 仓库里没有 CLAUDE.md 时自动读 AGENTS.md(需要 v2.1.277 以上;会话里用 `/memory` 确认)。
- **GitHub Copilot:** CLI 和 coding agent 都会自动读 AGENTS.md。
- **Antigravity:** 自动读工作区根目录的 AGENTS.md。
- **Gemini CLI:** 默认只读 GEMINI.md。在 `%USERPROFILE%\.gemini\settings.json` 里加上下面这段,就会读 AGENTS.md:
  ```json
  { "context": { "fileName": ["AGENTS.md", "GEMINI.md"] } }
  ```
- **本地模型(LM Studio):** 没有自动读取,需要时把相关内容直接贴进对话。
