### 032 调度脚本两处小修(GitHub Copilot CLI)

- **新增 / 变更 / 修复**:调度报告通过 `git diff --numstat` 汇总所有文件的新增 / 删除行数;Windows 优先直接运行 npm CLI 入口,并为导入测试添加直接执行判断。
- **决策**:继续限制 `as any` 检查只扫描新增 TypeScript 行,将其与全文件行数统计明确分离。
- **待确认**:无。
