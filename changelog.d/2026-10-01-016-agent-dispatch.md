### 016 命令行派发任务 + 各家模型测试(Claude Code)

- **新增**:`scripts/agents/dispatch.mjs`:把任务卡派给 Antigravity(agy)和 Copilot CLI 并行做,一个任务一个 worktree、受限权限,跑完由脚本统一提交、评分(隐藏测试、越界文件、lint / test / build、交付),出报告给主程审查。
- **新增**:模型测试两道题(纯逻辑 B1、程序化建模 B2),12 个任务的结果和建议见 `docs/research/model-bench-2026-10.md`。
- **变更**:Readme「多智能体分工」:去掉 Gemini CLI(已删除),写明派发方式和各家默认模型。
- **决策**:Antigravity 默认 Gemini 3.8 Flash High(两题满分、最守规则),第二选择 Claude Opus 4.6;不用 Sonnet 4.6、GPT-OSS 和 3.1 Pro。agent 不自己提交,因为 agy 的放行规则只能整条匹配,放行不了带文件名的 git 命令。
- **待确认**:Opus 4.6 的 B2 等第三方额度重置后补测;Copilot 10 月 3 日权益生效后重测;Codex 等 OpenAI 工单。
