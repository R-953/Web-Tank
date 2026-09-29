# 004-local-model-eval:本地模型能力测试

- 负责:负责人(在 LM Studio 里手动跑,不花 Claude 的额度);第 3 项的测试由 Claude Code 或负责人执行
- 状态:待领取(随时可做,不依赖 000)
- 规模:S

## 目标

用三个小任务判断:这台 16 GB 内存的笔记本上,LM Studio 里的本地模型能不能分担杂务,以及适合哪一类。

## 准备

- 在 LM Studio 里下载一个放得进内存的代码模型:7–8B、Q4 量化,文件大约 5 GB,例如 Qwen2.5-Coder-7B-Instruct 这一类。
- 另外可以试一个更小的通用模型做对比。
- 记录每个模型的生成速度(LM Studio 会显示 tokens/s)。

## 三个测试(每个模型都跑一遍,把提示词和输出原样存下来)

1. **文本整理:** 把 `git log --oneline -15 --stat` 的输出贴给模型,让它按 `changelog.d/README.md` 的格式写一条中文开发日志。
   评判:格式对不对,有没有编造不存在的改动。
2. **读代码:** 把 `src/game/Vegetation.ts` 里的 `hitTree` 函数贴给模型,问「什么情况下炮弹会穿过树继续飞?」。
   正确答案:口径 ≥ 20 mm 且不是化学能弹;或者树已经不是完好状态。
3. **写小测试:** 把 `src/ui/Minimap.ts` 里的 `gridLabel` 函数贴给模型,让它写 3 个 Vitest 边界测试。把结果放进 `tests/_local-model-scratch.test.ts`,跑 `npx vitest run tests/_local-model-scratch.test.ts`,记录能否直接通过;跑完删掉这个文件,不要提交。

## 允许修改的文件

- 新增:`docs/research/local-model-eval.md`(模型名、量化、速度、三项结果、结论)

## 验收标准

- [ ] 三项测试都有原样的输入 / 输出和打分(0 = 不能用,1 = 要大改,2 = 小改就能用,3 = 直接能用)
- [ ] 结论:本地模型适合做哪几类杂务,哪些不能交给它

## 结果(完成后填写)
