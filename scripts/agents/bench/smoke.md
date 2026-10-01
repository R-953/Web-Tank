# 冒烟测试:确认 agent 能改文件、跑命令、提交

- 规模:XS

## 目标

确认调度脚本启动的 agent 在当前权限档位下能完成最基本的三件事。

## 允许修改的文件

- 新增:`smoke.txt`

## 要做的事

1. 运行 `npx tsc --version`,把输出写进仓库根目录的新文件 `smoke.txt`(只有这一行)。
2. 运行 `npm run lint`,确认通过。

不用跑 `npm test` 和 `npm run build`。
