# 005-menu-dropdown-overlap:主界面 ☰ 下拉菜单被车辆信息面板盖住

- 负责:Claude Code(主程)
- 状态:已合并
- 分支:`task/005-menu-dropdown-overlap`
- 规模:S(1 行 CSS)

## 目标

主界面点左上角 ☰,下拉菜单(设置 / 图像 / 声音 / 操作 / 关于)要完整显示在左侧车辆信息面板上面。负责人 2026-09-29 反馈:现在只有「设置」一项露出来,其余被信息面板盖住。

## 原因

`.mm-dropdown` 和 `.mm-info` 都是 `position: absolute`,都没有设 `z-index`,在同一个层叠上下文(`.mm-root`)里按 DOM 顺序绘制。信息面板在 DOM 里更靠后,所以画在菜单上面。

## 允许修改的文件

- `src/ui/menu/styles.ts`:只给 `.mm-dropdown` 加 `z-index`

## 验收标准

- [x] 下拉菜单的每一项都在信息面板上面,能点到
- [x] `npm run lint`、`npm test`、`npm run build` 全部通过

## 结果

- 改动文件:`src/ui/menu/styles.ts`,`.mm-dropdown` 加 `z-index: 5`,并加一行注释说明原因
- 命令与结果:`npm run lint` 通过;`npm test` 20 个文件 210 个测试全部通过;`npm run build` 通过
- 实机验证:在桌面版内置浏览器(本分支的 dev server)里打开 ☰,用 `elementFromPoint` 逐项检查。5 项都是最上层元素,其中 4 项正好压在信息面板上;截图里菜单完整显示
- 偏差:没有新增自动测试。jsdom 不计算层叠顺序,这类 CSS 问题只能在真浏览器里验
