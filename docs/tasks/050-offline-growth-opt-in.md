# 050-offline-growth-opt-in:离线挂机成长改成手动开启

- 负责:Antigravity(3.8 Flash High)
- 状态:待审查
- 分支:`task/050-offline-growth-opt-in`
- 规模:S
- 和 047、048、049、051、052 并行;改的文件不重叠

## 目标

负责人 10-02:离线挂机成长现在默认开启,改成默认关闭、玩家在设置里手动打开。

## 背景与参考

- `src/main.ts` 的 `openProfileStore`:打开页面时 `store.set(advanceTime(p, Date.now(), progressAfter))` 补算离线成长;页面开着时每 30 秒记一次 `lastSeen`。
- 设置:`src/settings/Settings.ts`(`GameSettings.game`)、`src/ui/menu/SettingsPanel.ts` 的「游戏」页(已有「地图符号」分段开关、「显示操作提示条」等开关可以照着写)。
- **`main.ts` 归主程,不要改。** 本卡只做设置项;主程合并后在 `openProfileStore` 里按这个设置决定要不要调用 `advanceTime`(关闭时只把 `lastSeen` 记成当前时刻,不补算)。

## 要做的事

1. `GameSettings.game` 增加 `offlineGrowth: boolean`,**缺省 `false`**;`sanitize` 校验(非布尔值回到 `false`;老存档没有这个字段 = `false`)。
2. 设置「游戏」页增加开关「离线挂机成长」,说明文字:「打开后,关闭页面期间车组也会按时间成长;关闭时只有在线游玩的时间不计入成长。默认关闭。」(文案可微调,要把「默认关闭」和「关闭页面期间」说清楚)。
3. 测试:缺省值、老存档、非法值、保存再读回、设置面板里开关的显示与切换。

## 允许修改的文件

- 修改:`src/settings/Settings.ts`、`src/ui/menu/SettingsPanel.ts`
- 修改测试:`tests/settings.test.ts`(只增不删)及设置面板相关的测试;可新增 `tests/offline-growth-setting.test.ts`
- 新增:`changelog.d/<日期>-050-offline-growth-opt-in.md`

## 接口(定死)

```ts
// Settings.ts
interface GameSettings { game: { …; offlineGrowth: boolean } } // 缺省 false
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 测试:缺省 `false`、老存档 `false`、非法值 `false`、往返、设置面板里的开关

## 不做

- `main.ts`(主程接);不改 `Profile.ts` 的 `advanceTime`;不做「开启时补发之前的离线成长」(关闭期间 `lastSeen` 照常更新,所以打开开关不会追溯)。

## 结果(完成后由执行者填写)

- 改动文件:
  - `src/settings/Settings.ts`: `GameSettings.game` 添加 `offlineGrowth: boolean` 字段, `defaultSettings` 缺省 `false`, `sanitize` 修正非布尔与老存档为 `false`
  - `src/ui/menu/SettingsPanel.ts`: 在「游戏」设置页增加「离线挂机成长」复选框及说明文案
  - `tests/settings.test.ts`: 增加 `offlineGrowth` 缺省值、老存档、非法值与存储往返测试
  - `tests/offline-growth-setting.test.ts`: 新增设置项及 SettingsPanel 交互单元测试 (8 个测试)
  - `changelog.d/2026-10-02-050-offline-growth-opt-in.md`: 新增开发日志
  - `docs/tasks/050-offline-growth-opt-in.md`: 勾选验收标准并填写完成结果
- 命令与结果:
  - `npm run lint`: 通过 (`tsc --noEmit` 0 错误)
  - `npm test`: 全部通过 (54 个测试套件, 547 个测试用例全部通过)
  - `npm run build`: 通过 (`tsc && vite build` 成功构建)
- 偏差 / 未完成 / 待决定: 无
