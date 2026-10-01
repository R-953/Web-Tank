# 043-vite-watch-worktree:在 worktree 里跑 dev server 时改代码不刷新

- 负责:GitHub Copilot CLI(主程审查)
- 状态:已合并
- 分支:`task/043-vite-watch-worktree`
- 规模:S

## 目标

`vite.config.ts` 的 `server.watch.ignored` 里有 `'**/.worktrees/**'` 和 `'**/Archive/**'`。在 worktree(路径形如 `D:\Web Tank\.worktrees\038\...`)里跑 `npm run dev` 时,项目自己的每个文件路径里都带 `.worktrees`,全被忽略了:改代码页面不刷新,必须重启 dev server。主程 10-02 复查 038 时遇到。

## 要求

- 只忽略**本项目根目录下**的 `.worktrees/` 和 `Archive/`:用 `vite.config.ts` 所在目录拼出绝对路径(`fileURLToPath(new URL('.', import.meta.url))` 或 `path.resolve(__dirname, ...)`,选能通过 `npm run lint` 的写法),去掉 `**/` 开头的两条。
- 这样主仓库里跑 dev server 时仍不监听 `.worktrees/`、`Archive/`;worktree 里跑时只忽略它自己下面的(通常不存在),项目文件正常监听。
- `test.exclude` 保持不变。
- 抽一个纯函数方便测试,例如导出 `watchIgnored(root: string): string[]`(放在 `vite.config.ts` 里或新文件 `scripts/watchIgnored.mjs`,选一个),写测试:根目录为 `D:/Web Tank` 和 `D:/Web Tank/.worktrees/038` 时,返回的规则分别会 / 不会匹配 `D:/Web Tank/.worktrees/038/src/main.ts`。

## 允许修改的文件

- 修改:`vite.config.ts`
- 新增:`scripts/watchIgnored.mjs`(如果选这种写法)、`tests/vite-watch.test.ts`
- 新增:`changelog.d/<日期>-043-vite-watch-worktree.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 新测试覆盖上面两种根目录
- [ ] 不改依赖

## 结果(完成后由执行者填写)

- 改动文件:`vite.config.ts`、`tests/vite-watch.test.ts`、`changelog.d/2026-10-02-043-vite-watch-worktree.md`、本任务卡。
- 命令与结果:`npm run lint` 通过;`npm test` 通过(46 个测试文件、468 个测试);`npm run build` 通过(有 bundle 体积提示)。
- 偏差 / 未完成 / 待决定:无;`test.exclude` 未改,未新增依赖。
