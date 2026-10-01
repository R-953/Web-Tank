# 025-relocate-web-tank:仓库搬到 D:\Web Tank,清理旧 worktree,整理根目录

- 负责:Antigravity(Gemini 3.8 Flash High)写改动和搬家脚本 → 主程审查后执行脚本
- 状态:待审查
- 分支:`task/025-relocate-web-tank`
- 规模:M

## 目标

负责人要求:

- 项目根目录从 `D:\Main` 换成 `D:\Web Tank`。
- `D:\` 下那一堆往期 worktree(`Main-005`、`Main-test`、`Main-bench` 等)清理掉。
- 不需要的本机文件挪到 `D:\Web Tank\Archive\`。
- 以后并行任务的 worktree 放进仓库里的 `.worktrees\`,不再散落在 `D:\`。

手动挪目录容易出错(git worktree 记的是绝对路径;本会话的工作目录就是 `D:\Main`,Windows 下正在用的目录挪不动)。所以分两步:

1. **你(本卡)**:改好仓库里的约定,写一个搬家脚本 `scripts/relocate.mjs`,默认只打印计划,加 `--apply` 才执行。
2. **主程**:本轮任务全部合并后审查脚本,先空跑再执行。执行是**复制**到新目录,旧的 `D:\Main` 等负责人关掉所有用它的程序后自己删。

## 现状(写卡时)

- `D:\Main`:主仓库,`main` 分支。根目录下 `Claude outputs\`(旧截图、CI 草稿,已 gitignore)、`dist\`(构建产物)、`.claude\`(本机设置,未跟踪)。
- 24 个 worktree,全部干净:
  - `D:\Main-005` … `D:\Main-016`、`D:\Main-antigravity`、`D:\Main-copilot`、`D:\Main-gemini`、`D:\Main-plan`、`D:\Main-test`;
  - `D:\Main-bench\` 下 14 个(模型测试题和冒烟测试)。
  - 分支:`task/*`、`docs/*` 已全部合并进 `origin/main`;`bench/*`、`local/*` 只在本机,保留不删。
- 本轮(013–025)还会再建一批 `D:\Main-0xx`,脚本执行时它们也已合并。
- `D:\agent-runs\`:调度脚本的报告。

## 目标布局

```text
D:\Web Tank\                仓库根目录(原 D:\Main)
  .worktrees\<编号>\        并行任务的 worktree(不进 git)
  Archive\                  本机归档(不进 git)
    agent-runs\             调度报告:原 D:\agent-runs\,以后的新报告也写这里
    claude-outputs\         原 Claude outputs\
  src\ tests\ docs\ …       不变
```

## 允许修改的文件

- 新增:`scripts/relocate.mjs`、`changelog.d/<日期>-025-relocate-web-tank.md`
- 修改:`.gitignore`:加 `.worktrees/`、`Archive/`,删掉 `Claude outputs/`
- 修改:`vite.config.ts`
  - `test.exclude` 在 Vitest 默认值(`configDefaults.exclude`)之外加上 `.worktrees/**`、`Archive/**`,否则 worktree 里的测试会被主仓库的 `npm test` 收进去;
  - `server.watch.ignored` 加上这两个目录。
- 修改:`scripts/agents/dispatch.mjs`
  - worktree 默认位置改成 `<仓库>/.worktrees/<worktree 字段或 id>`;
  - 报告目录改成 `<仓库>/Archive/agent-runs/`。
  - 只改这两处路径,**别动** `prepare` / `grade` 的调用行,主程同时在改。
- 修改:`scripts/agents/jobs/*.json` 里的 `worktree` 字段(去掉 `Main-` 前缀,如 `Main-bench/b1-g38flash` → `bench/b1-g38flash`)、`scripts/agents/README.md`(路径说明)
- 修改:`AGENTS.md`
  - **只改**「分支与提交」里 worktree 的示例命令,改成 `git worktree add .worktrees/<编号> -b task/<编号>-<英文短名> origin/main`;
  - 和「不提交生成物」那一条,`Claude outputs/` 换成 `Archive/`、`.worktrees/`。
  - 负责人已同意改这两处。
- 修改:`Readme.md`
  - **只改**「目录结构」代码块,加 `.worktrees/` 和 `Archive/` 两行说明;
  - 负责人已同意。主程同时在改 Readme 的其他节,别碰。

## 搬家脚本 `scripts/relocate.mjs`

只用 Node 自带模块,风格参考 `scripts/agents/dispatch.mjs`(中文注释、中文输出)。

```text
node scripts/relocate.mjs [--to "D:\Web Tank"] [--apply]
```

不加 `--apply` 时**只打印**每一步要做什么(要删哪些 worktree、哪些被拦下及原因、要复制 / 移动什么),不改任何东西。

按顺序做,任何一步不满足就停下并说明原因:

1. **前置检查**:
   - 在旧仓库根目录运行,当前分支是 `main`;
   - 先 `git fetch origin`,`main` 与 `origin/main` 一致;
   - 工作区干净,只允许未跟踪的 `.claude/`;
   - 目标目录不存在或为空。
2. **清理 worktree**:用 `git worktree list --porcelain` 列出主仓库以外的 worktree。
   - 每个都要满足两条,否则拦下并列出:
     - `git status --porcelain` 为空;
     - 分支已合并进 `origin/main`,或分支名是 `bench/*`、`local/*`。
   - `--apply` 时:
     - 用 `git worktree remove <路径>` 删除,**不加 `--force`**;
     - 然后 `git worktree prune`;
     - 删完后变成空目录的父目录(如 `D:\Main-bench`)一起删掉,非空的不碰。
3. **清理已合并的本地分支**:`task/*`、`docs/*` 里已合并进 `origin/main` 的,用 `git branch -d` 删除(不用 `-D`);`bench/*`、`local/*`、`main` 不动。
4. **复制仓库**:把旧仓库复制到目标目录,跳过 `node_modules`、`dist`、`.vite`、`Claude outputs`。`.git`、`.claude` 照常复制。
5. **归档**:
   - `Claude outputs\` 复制到 `<目标>\Archive\claude-outputs\`;
   - `<旧仓库的上一级>\agent-runs\` 移动到 `<目标>\Archive\agent-runs\`。
   - 两者不存在就跳过。
6. **验证新目录**:在目标目录依次运行 `npm ci`、`npm run lint`、`npm test`,再确认 `git status` 只有未跟踪的 `.claude/`、`git worktree list` 只剩一行。
7. **打印后续事项**(脚本不做):
   - Antigravity 的 `%USERPROFILE%\.gemini\antigravity-cli\settings.json` 里 `trustedWorkspaces` 加上新路径;
   - 在新目录开新的 Claude Code 会话;
   - `.claude\launch.json` 里的旧路径要更新;
   - 关掉所有用着 `D:\Main` 的程序(终端、编辑器、Claude 会话、dev server)后,把 `D:\Main` 删到回收站。

另外:

- 判断逻辑(哪些 worktree 能删、哪些分支能删、复制时跳过哪些路径)写成导出的纯函数,方便以后加测试。
- 主程序只在直接运行时执行,和 `dispatch.mjs` 的写法一致。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `node scripts/relocate.mjs`(空跑)在当前机器上能跑完。这条命令不在你能用的命令里,写清楚你是怎么检查脚本逻辑的,主程会自己空跑
- [x] 脚本里没有 `--force`、`-D`、`rm -rf` 一类强制删除;删除只发生在 `--apply` 下
- [x] 改过的文档里没有残留指向 `../Main-xxx` 的新 worktree 用法(历史任务卡里的不用改)

## 不做

- 不改历史任务卡(000–024)里的路径
- 不改负责人本机的 Antigravity / Claude 设置文件(只在脚本最后提示)
- 不重命名 GitHub 仓库

## 结果(完成后由执行者填写)

- 改动文件:新增 `scripts/relocate.mjs`、`changelog.d/2026-10-01-025-relocate-web-tank.md`;修改 `.gitignore`、`vite.config.ts`、`scripts/agents/dispatch.mjs`、`scripts/agents/jobs/smoke.json`、`scripts/agents/jobs/bench-2026-10.json`、`scripts/agents/README.md`、`AGENTS.md`、`Readme.md`、`docs/tasks/025-relocate-web-tank.md`
- 命令与结果:`npm run lint`(tsc --noEmit)、`npm test`(25 文件 255 测试全部通过)、`npm run build`(tsc && vite build 构建成功,dist/ 产物正常)全部通过。针对 `node scripts/relocate.mjs`,通过代码审查核对了全部执行分支、参数解析以及安全逻辑:纯函数 `canRemoveWorktree`、`canDeleteBranch`、`shouldSkipCopy`、`parsePorcelainWorktrees`、`parseArgs` 全部独立导出;脚本内无 `--force`、`-D` 等强制参数,无 `rm -rf` 破坏性调用;删除与写操作严格限制在 `--apply` 分支下,默认只读空跑输出规划。
- 偏差 / 未完成 / 待决定:无偏差。待本轮所有任务合并后,由主程在旧仓库根目录审查并执行 `node scripts/relocate.mjs --apply` 进行实际搬迁。
