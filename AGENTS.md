# AGENTS.md — 给所有 Coding Agent 的工作守则

> 适用于 Claude Code、Gemini CLI / Antigravity、GitHub Copilot(CLI 与 coding agent)、Codex 等。
> 项目说明与长期约定在 [Readme.md](Readme.md),每轮的开发日志在 [Changelog.md](Changelog.md)。本文件只写「怎么干活」。

## 开工前

1. 读 Readme.md,至少读「声明」「核心数据结构约定」「协作约定」三节。
2. 读分配给你的任务卡 `docs/tasks/<编号>-<名称>.md`,只做卡上写的事。
3. 没有任务卡的改动,先问负责人。

## 常用命令(Node ≥ 22.12)

- 安装依赖:`npm ci`
- 类型检查:`npm run lint`
- 测试:`npm test`(Vitest + jsdom,必须全部通过)
- 构建:`npm run build`
- 本地运行:`npm run dev`。地址栏加 `?debug` 后,控制台可用 `__debug.game()`,`__debug.advance(秒)` 可以快进

## 硬性规则

- 不新增、不更换依赖,不改 `package.json` 里的依赖项。
- 不改核心数据结构(`src/data/types.ts` 的已有字段、`GameEvent`、`Bindings` 等),只允许加**可选**字段。确实需要改,在任务卡里写明理由,等负责人确认。
- 下面这些文件归主程维护。其他 agent 不要改;确需改动,在回报里说明原因和建议的改法:
  `src/game/Game.ts`、`src/game/Vehicle.ts`、`src/game/damage/**`、`src/main.ts`、`src/data/types.ts`、`.github/**`、`Readme.md`、`Changelog.md`、`AGENTS.md`
- 数值要有公开出处,写进代码注释或 `docs/physics-validation.md`。找不到出处就保留原值,不要自己编。
- 代码注释和界面文字用简体中文,风格与现有代码一致。TypeScript 严格模式,不要用 `any` 绕过类型检查。
- 新功能要带测试。纯逻辑写单元测试,不依赖 DOM 和渲染。不删除、不放宽已有测试,除非任务卡要求。
- 不提交生成物:`dist/`、`node_modules/`、`Claude outputs/`。

## 分支与提交

- 一个任务一个分支,命名 `task/<编号>-<英文短名>`,从最新的 `main` 拉出。
- 多个 agent 同时工作时,各用各的 git worktree。例如:`git worktree add ../Main-gemini -b task/012-minimap-icons origin/main`
- 不直接推 `main`,不 force push。通过 Pull Request 合并,CI(lint / test / build)必须是绿的。
- 提交信息格式:`<类型>: <中文说明>`,类型用 feat / fix / data / model / ui / test / docs / refactor。

## 完成时的回报

写进任务卡末尾的「结果」一节,PR 描述里贴同样的内容:

- 改了哪些文件(新增 / 修改)
- 跑过哪些命令、结果如何(测试数量、是否全部通过)
- 和任务卡不一致的地方、没做完的部分、需要负责人决定的问题

另外在 `changelog.d/` 新建一条日志,格式见 `changelog.d/README.md`。**不要直接改 Changelog.md。**
