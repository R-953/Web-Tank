# 067-mainmenu-drop-saveloadout:删掉 MainMenu 里没人用的 saveLoadout 选项

- 负责:Copilot CLI(auto)
- 状态:已合并(第十一轮)
- 分支:`task/067-mainmenu-drop-saveloadout`
- 规模:S(机械清理)

## 目标

第九轮机库去掉了携弹面板,携弹只在地图界面里调(`MapScreen` 自己持有 `saveLoadout`),`MainMenu` 的 `saveLoadout` 选项已经没有任何地方在调用,只剩接口字段和各处构造参数。把它删干净。

## 背景

- `src/ui/menu/MainMenu.ts` 的 `MainMenuOptions` 里有 `saveLoadout(spec: VehicleSpec, loadout: Loadout): void;`,类里没有任何一处调用 `this.opts.saveLoadout`(自己 grep 确认)。
- **不要动** `MapScreen`(`src/ui/MapScreen.ts`)的 `saveLoadout`——它是真在用的。
- `loadLoadout` 选项还在用(机库里算当前载具的携弹),**保留**。

## 要做的事

1. 删掉 `MainMenuOptions.saveLoadout`(以及它上面如果有只为它写的注释)。
2. 删掉所有 `new MainMenu({...})` 构造处传的 `saveLoadout` 属性:
   - `src/main.ts` 里 `new MainMenu({ ... })` 那一处(约 290 行,**只删这一行 `saveLoadout,`**,不要动同一文件里 `new MapScreen({...})` 里的那一行,也不要动别的东西);
   - 测试里 `new MainMenu` 的构造参数:`tests/class-icons.test.ts`、`tests/lineup-bar.test.ts`、`tests/round9-wiring.test.ts`(只删传给 `MainMenu` 的 `saveLoadout: vi.fn(),`;传给 `MapScreen` 的在 `tests/map-screen*.test.ts`、`tests/minimap-symbols.test.ts`,**不要动**)。
3. 跑 `npm run lint`(类型检查会指出遗漏或误删的地方)、`npm test`、`npm run build`,全部通过。不新增测试(纯清理),不删、不放宽任何断言。

## 允许修改的文件

- 修改:`src/ui/menu/MainMenu.ts`、`src/main.ts`(**仅限**删 `new MainMenu` 里的 `saveLoadout,` 这一行——这是主程专门为本卡开的例外)、`tests/class-icons.test.ts`、`tests/lineup-bar.test.ts`、`tests/round9-wiring.test.ts`
- 新增:`changelog.d/<日期>-067-mainmenu-drop-saveloadout.md`

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] `grep -rn saveLoadout src tests` 里剩下的全是 `MapScreen` 相关(`src/ui/MapScreen.ts`、`src/main.ts` 里的 `saveLoadout` 函数定义和 `new MapScreen` 那一行、`tests/map-screen*.test.ts`、`tests/minimap-symbols.test.ts`)

## 不做

- 不改 `MapScreen`、`loadLoadout`、携弹存取逻辑;不改别的文件。

## 结果(完成后由执行者填写)

- 改动文件:`src/ui/menu/MainMenu.ts`、`src/main.ts`、`tests/class-icons.test.ts`、`tests/lineup-bar.test.ts`、`tests/round9-wiring.test.ts`、`changelog.d/2026-10-02-067-mainmenu-drop-saveloadout.md`、`docs/tasks/067-mainmenu-drop-saveloadout.md`。
- 命令与结果:`npm run lint` 通过;`npm test` 通过(80 个测试文件、820 个测试);`npm run build` 通过。
- 偏差 / 未完成 / 待决定:无。`MapScreen` 的 `saveLoadout` 保持不变。

### 主程审查

Copilot(auto,即 mai-code)1.7 分钟、1 次请求,diff 只删了 9 行,正好是卡里列的那些;评分时 `npm test` 有一个测试失败(819/820),主程在 worktree 里单独重跑是 820/820 全过,判断是同时跑 066 的负载导致的偶发超时(已知的出生点视线测试偶发超时一类)。
