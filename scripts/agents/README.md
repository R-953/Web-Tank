# scripts/agents — 多智能体调度

主程(Claude Code)用这里的脚本把任务卡派给其他 agent 的命令行版,自己只做拆任务、审查、合并。目的是先用其他家的额度,Claude 只在别人做不了的时候接手。

```bash
node scripts/agents/dispatch.mjs run   scripts/agents/jobs/<作业>.json [--only id1,id2] [--dry-run]
node scripts/agents/dispatch.mjs grade scripts/agents/jobs/<作业>.json [--only id1,id2]
```

- `run`:每个任务建一个独立的 git worktree(已存在就复用),装依赖,启动 agent,结束后把改动提交成一个提交,然后评分。
- `grade`:只评分,不启动 agent(审查时重跑检查用)。
- `--dry-run`:只打印会建哪些 worktree、允许改哪些文件、会运行什么命令,提示词写到输出目录。

输出在 `Archive/agent-runs/<作业名>-<run|grade>-<时间>/`:每个任务的提示词、agent 原始输出,以及 `report.md` / `report.json`。

## 作业文件

```json
{
  "name": "sherman-models",
  "base": "origin/main",
  "permissions": "scoped",
  "timeoutMin": 60,
  "maxPerAgent": 2,
  "jobs": [
    {
      "id": "013",
      "agent": "antigravity",
      "model": "gemini-3.1-pro-high",
      "card": "docs/tasks/013-sherman-hull.md",
      "worktree": "013",
      "branch": "task/013-sherman-hull",
      "commit": "model: 谢尔曼 M4A3 车体"
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `agent` | `antigravity`(agy 命令行)或 `copilot`(Copilot CLI) |
| `model` | agy 的模型名用 `agy models` 查;Copilot 用 `auto` 或具体模型名 |
| `effort` | 可选,推理强度(agy:low / medium / high / max;Copilot:low … max) |
| `card` | 任务卡路径(相对仓库根目录),全文会放进提示词 |
| `allow` | 可选,允许改的文件(通配符)。不写就从任务卡「允许修改的文件」一节里以「新增 / 修改 / 删除」开头的条目读取,任务卡本身总是允许改 |
| `hidden` | 可选,隐藏测试文件(`*.hidden.ts`)。评分时临时拷进 worktree 的 `tests/__hidden__/` 运行,跑完删掉,agent 看不到 |
| `worktree` / `branch` | 可选,默认 `.worktrees/<id>`、`agent/<id>` |
| `base` | 可选,这个任务从哪个提交拉分支(默认取作业文件顶层的 `base`)。任务卡还没合并进 main 时,填卡所在的分支 |
| `commit` | 提交信息(格式见 AGENTS.md) |
| `maxPerAgent` | 同一种 agent 同时最多跑几个;不同 agent 之间总是并行 |

## 权限(`permissions`)

默认 `scoped`:agent 只能改工作区里的文件,能运行的命令只有

`npm run lint`、`npm test`、`npm run build`、`npx tsc`、`npx vitest run`、`git status / diff / log / show`

不能 `git add / commit / push`、改历史、装依赖、联网。提交由脚本在 agent 结束后统一做。`full` 会跳过全部确认,只在负责人明确同意时用。

- **Copilot**:逐条用 `--allow-tool` / `--deny-tool` 传进去(见 `dispatch.mjs` 的 `COPILOT_SCOPED`)。
- **Antigravity(agy)**:没有命令行参数,放行规则写在 `%USERPROFILE%\.gemini\antigravity-cli\settings.json` 的 `permissions.allow` / `deny` 里(这个文件由负责人维护,对本机所有 agy 会话生效),运行时加 `--mode accept-edits`。实测的两个坑:
  - 规则按「整条命令」匹配,只有开关参数可以不同:`command(npx tsc)` 能放行 `npx tsc --version`,但 `command(npx vitest)` 放行不了 `npx vitest run tests/a.test.ts`,`command(git add)` 也放行不了 `git add a.txt`,通配符 `*` 也不行。所以只放行不带文件名的几条命令,提交改由脚本做。
  - 无人值守时只要有一条命令被拒,这一轮就结束。脚本会用同一个会话续跑(最多 3 次),提醒它只用放行的命令。

## 评分(机器分,满分 90)

| 项 | 分 |
|---|---|
| 隐藏测试通过比例(没有隐藏测试时看 `npm test`) | 40 |
| 没改允许范围以外的文件 10、没 push 5、新代码里没有 `any` 5 | 20 |
| `lint` 7、`test` 7、`build` 6 | 20 |
| 填了任务卡「结果」6、写了 `changelog.d` 4(任务卡不在仓库里时只看日志 10) | 10 |

代码质量和外观(模型类任务)由主程看代码、截图后另评。

## 目录

- `dispatch.mjs`:调度和评分
- `jobs/`:作业文件。`smoke.json` 是冒烟测试(确认两边的权限设置能用)
- `bench/`:模型测试题。`b1-penetration.md`(纯逻辑)、`b2-m2hb.md`(程序化建模),隐藏测试在 `bench/hidden/`(存成 `*.hidden.ts`,Vitest 不会收集,评分时改名拷进去)。这些文件合并进 main 以后,之后建的 worktree 里 agent 就能看到隐藏测试,下次测模型要换新题
