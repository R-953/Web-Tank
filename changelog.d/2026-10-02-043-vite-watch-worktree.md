### 043 Vite worktree 文件监听(GitHub Copilot CLI)

- **新增 / 变更 / 修复**:监听忽略规则限定在当前项目根目录下的 `.worktrees/` 和 `Archive/`,避免 worktree 中的项目文件被忽略。
- **决策**:使用基于绝对根路径的正则规则,并覆盖 Windows 路径分隔符。
- **待确认**:无。
