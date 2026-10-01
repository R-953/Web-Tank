# 037-crew-wiring:main.ts 接上车组与编组存档、离线成长、开局车组技能

- 负责:Claude Code(主程)
- 状态:已合并
- 分支:`task/037-crew-wiring`(含 033、034,需在它们之后合并)
- 规模:S

## 目标

把第八轮做好的几块接进游戏:`main.ts` 用 `ProfileStore` 取代 `webtank.selection` 的选车功能,传给 `MainMenu` 的 `profile`(033 的编组栏和科技树随之生效);打开页面时补算离线成长;开局把当前车组的技能传给 `Game`(034)。

## 做法

- 第一次用新存档(本机没有 `webtank.profile.v1`)时,按旧版「上次选的车」定当前国家,并把那辆车分给第一个车组。`webtank.selection` 以后只用来记地图。
- 打开页面:`advanceTime(p, Date.now(), progressAfter)`。
- 在线时间不算挂机(设计稿 3.2):页面开着时每 30 秒、以及页面隐藏 / 关闭时,把 `lastSeen` 记成当前时刻,不加成长。
- 开局:`playerCrewSkill: activeCrewSkill(profile, vehicles)`。

## 结果

- 改动文件:`src/main.ts`;新增本卡、`changelog.d/2026-10-02-037-crew-wiring.md`
- 命令与结果:`npm run lint` 通过;`npm test` 44 个文件 458 个测试全部通过。浏览器实测(1280 宽):旧选择 M4A3E8 → 新存档当前国家美国、第一个车组分到 M4A3E8;刷新多次车组数不变;招募 → 空格「+」→ 科技树只列美国车、M4A3E8 标「已编组」→ 选 M4A3E2 → 第二格分到 E2 并自动训练;美国第一车组进度设 50% 后显示 Lv 75,开局装填 6.75 s(7.6 ↔ 5.9 的中点)、方向机 29.1°/s、高低机 3.4°/s,敌车不变。
- 偏差 / 未完成 / 待决定:同时开两个游戏标签页时,两边各自定时写 `lastSeen` 会互相覆盖对方对编组的修改(单机游戏一般只开一个页面,暂不处理)。
