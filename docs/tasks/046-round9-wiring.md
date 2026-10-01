# 046-round9-wiring:main.ts 接上地图界面、军标和符号体系

- 负责:Claude Code(主程)
- 状态:已合并
- 分支:`task/046-round9-wiring`
- 规模:M

## 目标

把第九轮的组件接进游戏流程,完成负责人 10-02 的要求。

## 要做的事(main.ts)

1. **开局流程:**
   - 机库点「进入战斗」→ 先打开 `MapScreen`(`spawn` 模式,地图用 `{ spec, grid: buildTerrain(spec) }`,按地图 id 缓存)。
   - 在这里调携弹、选出战车组(`onSelectCrew` → `selectCrew`)。
   - 点「出战」→ `startBattle`(载具和携弹按存档重新读)→ 锁鼠标。
   - 在地图界面按 Esc → 回机库。
2. **战斗中:**
   - 锁定鼠标时按 `mapScreen`(M)→ 打开 `battle` 模式,解锁鼠标,但不弹暂停菜单(`pointerlockchange` 里判断 `mapScreen.isOpen`)。
   - 地图界面开着时每帧 `draw`,对局继续跑。
   - 按 Esc / 再按 M / 点「返回战斗」→ 关闭并重新锁鼠标。
   - 战斗中改的携弹在下次出战 / 重开时生效:`onRestart` 用 `loadSavedLoadout` 重新读,不再用开局时的 `sel.loadout`。
3. **军标:**
   - 小地图和地图界面的标记填 `vehicleClass`(取自 `VEHICLES[t.vehicleId].vehicleClass`)。
   - `applySettings` 里调用 `setSymbology(s.game.symbology)`,并刷新机库里的类型图标(编组栏 `refresh`)。
   - 地图界面下拉框的 `onSymbologyChange` → `settings.update(d.game.symbology = v)`。
4. **验证:**在浏览器里走一遍完整流程:机库 → 地图界面 → 出战 → M → 返回战斗 → Esc 菜单 → 重开 → 回机库;北约 / 华约切换后机库、小地图、地图界面都跟着变。

## 允许修改的文件

- 修改:`src/main.ts`;确需改组件时在结果里说明

## 结果

- 改动文件:
  - 修改 `src/main.ts`:
    - 新增 `MapScreen`:机库点「进入战斗」→ 藏起机库、打开 `spawn` 模式地图界面(地形网格按地图 id 缓存);点「出战」按存档里选中的车组重新读载具和携弹,再开局、锁鼠标;Esc 回机库。
    - 战斗中锁定鼠标时按 M(`mapScreen`)打开 `battle` 模式并解锁,对局继续跑,`pointerlockchange` 看到地图开着就不弹暂停菜单;再按 M / Esc / 点「返回战斗」关闭并重新锁。地图开着时小地图和 HUD 都藏起来(遮罩是半透明的,不藏会透出来)。
    - 重新锁鼠标失败时(在地图界面按 Esc 回来,Esc 不算用户操作)监听 `pointerlockerror` 弹暂停菜单,点「继续」再锁。
    - 暂停菜单「重新开始」和重开键改用 `restartBattle()`:携弹重新读存档,战斗中改的携弹下一局生效。
    - 小地图和地图界面的标记填 `vehicleClass`(取自 `t.spec.vehicleClass`);`applySettings` 里调 `setSymbology` 并刷新机库;地图界面下拉框 → `settings.update`;操作提示条加「M 地图」;`__debug` 里多了 `mapScreen`、`profiles`。
  - 修改组件(卡上说「确需改组件时在结果里说明」):
    - `src/ui/menu/MainMenu.ts`:新增公开方法 `refresh()`——在地图界面换了车组、设置里换了符号体系以后,机库重选当前车组的车并重画编组栏和信息面板。
    - `src/ui/MapScreen.ts`:下拉框切换符号体系时,顶栏卡片的类型图标也跟着换(新增私有的 `refreshCardIcons()`,不重置携弹面板)。
  - 新增 `tests/round9-wiring.test.ts`(3 条:`refresh()` 换车、`refresh()` 重画图标、地图界面切换符号体系更新卡片图标)、`changelog.d/2026-10-02-046-round9-wiring.md`。
- 命令与结果:
  - `npm run lint`:通过;`npm test`:53 个文件 538 个测试全部通过(含 044、045);`npm run build`:通过。
  - 浏览器里走过(`?debug`,这个窗格里真实的鼠标锁定不可用,用脚本模拟了 `pointerLockElement` / `requestPointerLock` / `exitPointerLock` / `pointerlockerror`,其余都是真实 DOM 和真实游戏循环):机库 → 进入战斗 → 地图界面 → 改携弹 → 出战(携弹是刚改的)→ M 打开(对局继续跑、不弹暂停菜单)→ 再按 M 回来 → M 后按 Esc(锁失败时落到暂停菜单)→ 战斗中改携弹后「重新开始」读到新携弹 → 返回机库 → 切到华约(机库信息面板图标、设置、地图界面都跟着变)→ Esc 回机库;招募第二个车组分给虎王,地图界面点第二张卡,携弹面板换成虎王,出战的是虎王。
- 偏差 / 未完成 / 待决定:
  - 真实 Chrome 里 Esc 退出鼠标锁定后能否重新锁没法在这个窗格里实测;写成「先试着锁,失败就弹暂停菜单」,两种结果都有处理。
  - `MainMenu` 的 `saveLoadout` 选项机库里已经没人用了,删它要改十几处测试的构造参数,这次没动,留作清理。
