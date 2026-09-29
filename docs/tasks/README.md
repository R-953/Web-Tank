# 任务看板

一个任务一张卡(模板见 [TEMPLATE.md](TEMPLATE.md))。主程写卡、分配、审查;执行者只做卡上的事,完成后在卡末尾填「结果」。

| 编号 | 任务 | 负责 | 车道 | 状态 |
|---|---|---|---|---|
| [000](000-git-sync.md) | 理顺 git,把第五轮和协作机制推上 GitHub | Claude Code | 主程 | 进行中 |
| [001](001-perf-baseline.md) | 本机帧率基线(低 / 中 / 高画质) | Antigravity | 界面 / 实测 | 待领取(000 之后) |
| [002](002-minimap-marker-style.md) | 小地图标记样式:圆点 / 箭头 | Copilot | 小任务 | 待领取(000 之后) |
| [003](003-research-m4a3-76w.md) | M4A3(76)W 数据调研(只出数据和出处) | Gemini CLI | 内容 | 待领取(000 之后) |
| [004](004-local-model-eval.md) | 本地模型能力测试 | 负责人 + LM Studio | 杂务 | 待领取(随时) |

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
