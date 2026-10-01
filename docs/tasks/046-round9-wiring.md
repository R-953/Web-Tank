# 046-round9-wiring:main.ts 接上地图界面、军标和符号体系

- 负责:Claude Code(主程)
- 状态:待领取(等 044、045 合并)
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
- 命令与结果:
- 偏差 / 未完成 / 待决定:
