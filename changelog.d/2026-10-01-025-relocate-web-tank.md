### 025 仓库搬到 D:\Web Tank,清理旧 worktree,整理根目录(Antigravity)

- **新增**:编写搬家脚本 `scripts/relocate.mjs`。支持 `--to` 指定目标目录(默认 `D:\Web Tank`)与 `--apply` 实际执行模式。默认只打印执行计划(前置检查、关联 worktree 清理、合并分支清理、仓库复制、Archive 归档、新目录完整性验证与后续人工事项),不加 `--apply` 不做任何改动;导出了纯函数便于判定与测试。
- **变更**:.gitignore 与 AGENTS.md 将 `Claude outputs/` 替换为 `Archive/` 和 `.worktrees/`,新增忽略规则;Readme.md 目录结构补充 `.worktrees/` 与 `Archive/`。
- **变更**:vite.config.ts 的 `test.exclude` 在默认排除规则基础上加入 `.worktrees/**` 与 `Archive/**`,`server.watch.ignored` 同样忽略这两处路径。
- **变更**:scripts/agents/dispatch.mjs 中 worktree 默认位置改为 `<仓库>/.worktrees/<worktree 字段或 id>`,报告输出目录改为 `<仓库>/Archive/agent-runs/`;同步更新 scripts/agents/jobs/*.json 与 scripts/agents/README.md。
- **决策**:迁移采用先安全只读检查、默认空跑打印、加 `--apply` 才执行的策略,脚本中绝不使用 `--force`、`-D` 等强制删除指令,确保无代码丢失风险。
- **待确认**:本轮任务全部合并后由主程在 `D:\Main` 根目录先空跑审查 `node scripts/relocate.mjs`,确认无误后再加 `--apply` 执行实际搬迁。
