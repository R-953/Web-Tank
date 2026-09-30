# 011-restart-key-test-timeout:重开键每帧重开;出生点视线测试偶发超时

- 负责:Claude Code(主程)
- 状态:待审查
- 分支:`task/011-restart-key-test-timeout`
- 规模:XS

## 目标(负责人 2026-09-30 确认修复)

1. **重开键**:001 测帧率时发现,给「重新开始本局」绑了键之后,按一下会每帧都重开一局(帧率掉到 3 左右、物理停住、画面卡住或黑屏,2 秒内新建了 7 局)。原因:`src/main.ts` 战斗循环里按下重开键后调用 `startBattle()` 直接 `return`,跳过了帧末的 `input.endFrame()`,「本帧按下」一直没清,下一帧又读到重开键。默认没绑这个键,Esc 菜单里的「重新开始」不受影响。
2. **测试超时**:`tests/terrain.test.ts` 的「所有出生点都在地图内……能直接看到至少两辆靶车」要生成整张 3 km 地图,单独跑就要 4–5 秒,机器忙(多个 worktree 同时跑测试)时会超过 Vitest 默认的 5 秒,偶发失败。

## 做法

1. `return` 前补上 `input.endFrame()`。
2. 只给这一个测试设 30 秒超时,断言不变。

## 允许修改的文件

- `src/main.ts`(重开键一处)、`tests/terrain.test.ts`(一个测试的超时)

## 验收标准

- [x] 绑键重开只重开一次,之后帧率和物理正常
- [x] 超时放宽,断言不变
- [x] `npm run lint`、`npm test`、`npm run build` 全部通过

## 结果

- 改动文件:`src/main.ts`、`tests/terrain.test.ts`
- 命令与结果:`npm run lint` 通过;`npm test` 20 个文件 210 个测试全部通过;`npm run build` 通过
- 实测(桌面版内置浏览器,`?debug`,重开键临时绑 F9,伪造鼠标锁定):修复前按一次 F9 后 2 秒内新建 7 局、物理停住;修复后只重开一次,2 秒内始终是同一局,帧率不变(30 → 30,内置浏览器锁 30 帧),物理正常推进
- 没有自动化测试:`main.ts` 的帧循环依赖 WebGL 和 DOM,现有测试框架跑不起来,所以只做了实测
