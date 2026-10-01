# 032-dispatch-fixes:调度脚本两处小修——改动行数统计、DEP0190 警告

- 负责:GitHub Copilot CLI(主程审查)
- 状态:进行中
- 分支:`task/032-dispatch-fixes`
- 规模:S

## 目标

`scripts/agents/dispatch.mjs` 有两处小毛病:

1. **报告里的「+N 行」不对**:`grade()` 里的 `g.addedLines` 只数了 `*.ts` 文件新增的行(这个列表本来是给「有没有 `as any`」检查用的),报告却写成「N 个文件 +N 行」。027 改的全是 Markdown,报告显示「16 个文件 +0 行」,实际是 +174 行。
2. **每次运行都有 Node 的 DEP0190 弃用警告**:Windows 下 `npm` 用 `spawnSync('npm.cmd', args, { shell: true })`,把参数数组和 `shell: true` 一起用,Node 24 起会警告(参数不转义,只是拼接)。

## 允许修改的文件

- 修改:`scripts/agents/dispatch.mjs`
- 新增:`tests/dispatch.test.ts`
- 新增:`changelog.d/2026-10-02-032-dispatch-fixes.md`

## 要求

1. **行数统计**:
   - 新增并导出纯函数 `export function sumNumstat(text)`:输入 `git diff --numstat` 的输出,返回 `{ files, added, deleted }`。二进制文件那一行是 `-\t-\t路径`,算进 files,不算行数。
   - `grade()` 里用 `git diff --numstat <baseSha>` 加上这个函数,得到全部文件的新增行数,报告显示「N 个文件 +新增 −删除 行」。
   - 检查 `as any` 的那段保持只看 `*.ts`,但变量改名,别再叫 `addedLines`,免得混淆。
2. **DEP0190**:Windows 下跑 npm 时不要再「`shell: true` + 参数数组」。推荐做法是用 `process.execPath` 直接运行 npm 自带的 `npm-cli.js`(在 node 可执行文件同目录的 `node_modules/npm/bin/npm-cli.js`);找不到这个文件时,再退回把命令拼成**一个字符串**交给 shell。非 Windows 平台行为不变。
3. **让测试能 import 这个脚本**:现在文件末尾无条件调用 `main()`,被测试 import 时会当成命令行运行并退出。改成只有直接用 node 运行这个文件时才调用 `main()`(比较 `import.meta.url` 和 `process.argv[1]`;Windows 路径要先用 `pathToFileURL` 转换)。
4. 测试 `tests/dispatch.test.ts`:
   - `sumNumstat`:普通行、二进制行、空输入、末尾换行
   - 顺带给已经导出的 `allowedFiles` 补两三个用例(卡片里的「允许修改的文件」一节能解析出路径)

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] `node scripts/agents/dispatch.mjs` 不带参数时仍然打印用法
- [ ] `node scripts/agents/dispatch.mjs run scripts/agents/jobs/smoke.json --dry-run` 正常输出,没有 DEP0190 警告
- [ ] 不改评分规则和分数

## 不做

- 评分规则、权限放行列表、提示词的其他改动

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
