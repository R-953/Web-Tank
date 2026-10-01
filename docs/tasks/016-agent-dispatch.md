# 016-agent-dispatch:命令行派发任务 + 各家模型测试

- 负责:Claude Code(主程)
- 状态:待审查
- 分支:`task/016-agent-dispatch`
- 规模:M

## 目标(负责人 2026-10-01 提出)

1. 主程直接在终端把任务派给 Antigravity、Copilot 并行开发,自己只拆任务、审查、修冲突,其他 agent 都做不了的才接手。这样先用别家的额度,Claude 作为中枢能撑得更久。
2. 跑一个简短的测试,看每家哪个模型最适合本项目。这几天优先用 Antigravity:Copilot 的权益 10 月 3 日才生效,OpenAI 的工单还没回复,到时再测更多模型。Antigravity 的第三方模型(Claude、GPT-OSS)单独计量,和 Gemini 的每周限额互不影响。

## 做法

- `scripts/agents/dispatch.mjs`:一个任务一个 worktree,启动 agent(agy / Copilot CLI 的无人值守模式),结束后统一提交、评分、出报告。用法、权限、评分见 `scripts/agents/README.md`。
- 权限默认「受限」:只能改工作区文件,只能跑 lint / test / build 和只读的 git 命令,不能提交、push、装依赖、联网。agy 的放行规则写在负责人本机的 `~/.gemini/antigravity-cli/settings.json`。
- 模型测试:两道题,每题给每个模型一个干净的 worktree,隐藏测试由脚本在评分时拷进去。
  - B1(纯逻辑):穿深随距离的解析计算,隐藏测试和逐帧模拟对照。
  - B2(程序化建模):M2HB 重机枪零件,隐藏测试查尺寸和坐标,外观由主程截图比较。

## 允许修改的文件

- 新增:`scripts/agents/**`、`docs/research/model-bench-2026-10.md`、`changelog.d/<日期>-016-agent-dispatch.md`
- 修改:`docs/tasks/README.md`、`Readme.md`(「多智能体分工」一节)

## 验收标准

- [x] 冒烟测试:两边都能在受限权限下改文件、跑检查,由脚本提交
- [x] 模型测试跑完,报告写进 `docs/research/model-bench-2026-10.md`,给出每家用哪个模型的建议
- [x] `npm run lint`、`npm test`、`npm run build` 全部通过(脚本不在 `src/` 里,不影响构建)

## 结果

- 改动文件:新增 `scripts/agents/`(`dispatch.mjs`、`README.md`、`jobs/smoke.json`、`jobs/bench-2026-10.json`、`bench/` 两道题和隐藏测试、冒烟题)、`docs/research/model-bench-2026-10.md`、`docs/images/bench-2026-10-b2.jpg`;修改 `Readme.md`(「多智能体分工」:去掉 Gemini CLI,加派发方式)
- 命令与结果:冒烟测试两边都通过;模型测试 12 个任务跑完(10 个有结果,2 个因 Antigravity 第三方额度耗尽没跑);`npm run lint`、`npm test`、`npm run build` 全部通过
- 结论:Antigravity 默认 Gemini 3.8 Flash High,第二选择 Claude Opus 4.6;Copilot 目前只有 mai-code-1.1-flash,适合小逻辑。详见测试报告
- 和预期不一样的地方:
  - **agy 的放行规则只能整条匹配**:`command(git add)` 放行不了 `git add a.txt`,通配符也不行。所以 agent 只能跑几条固定的检查命令,提交改由脚本做
  - **agy 无人值守时,一条命令被拒这一轮就结束**:脚本自动用同一会话续跑,最多 3 次
  - 放行规则写在负责人本机的 `~/.gemini/antigravity-cli/settings.json`,对本机所有 agy 会话生效(会话里改的时候负责人逐条批准过)
- 待办:额度重置后补测 Opus 4.6 的 B2;10 月 3 日后重测 Copilot;Codex CLI 等工单解决后再接入
