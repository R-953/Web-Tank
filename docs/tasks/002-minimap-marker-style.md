# 002-minimap-marker-style:小地图标记样式——圆点 / 箭头

- 负责:GitHub Copilot(把本卡贴进 GitHub Issue 指派给 Copilot,或者用 Copilot CLI 在 worktree 里做)
- 状态:待领取(000 完成之后)
- 分支:`task/002-minimap-marker-style`
- 规模:S

## 目标

设置 → 游戏里新增「小地图标记」选项,可选 **圆点**(默认,现在的红蓝圆点)或 **箭头**(带朝向的三角,尖端指向车头方向)。被击毁的车两种样式都用现在的灰点加 ×。

## 背景与参考

- `src/ui/Minimap.ts`:`MinimapMarker`、`Minimap.draw()`;玩家箭头的画法可以参考(朝向约定:0 = 北 / −Z,正值向左)
- `src/settings/Settings.ts`:`GameSettings.game`、`defaultSettings()`、`sanitize()`
- `src/ui/menu/SettingsPanel.ts`:`renderGame()` 里「小地图形状」的写法

## 允许修改的文件

- `src/ui/Minimap.ts`:
  - `MinimapMarker` 加可选字段 `heading?: number`;
  - 新增 `setMarkerStyle(style: 'dot' | 'arrow')`;
  - `draw()` 按样式画标记。
- `src/settings/Settings.ts`:`game.minimapMarkers: 'dot' | 'arrow'`,默认 `'dot'`;`sanitize()` 同步修改。
- `src/ui/menu/SettingsPanel.ts`:「游戏」页签加一个两选项的切换。
- `src/main.ts`:**只允许改两处**——
  - `applySettings` 里加一行 `minimap.setMarkerStyle(...)`;
  - `minimap.draw` 的 markers 映射里给每辆车加 `heading`(计算方法照抄同一函数里玩家的 `heading`)。
- `tests/settings.test.ts`、`tests/minimap.test.ts`:补测试。

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 测试:旧存档没有这个字段时 `sanitize` 给 `'dot'`;非法值回到 `'dot'`
- [ ] 箭头样式下,敌方红色、友方蓝色,尖端方向和车头一致(PR 里附一张截图)
- [ ] 默认外观和现在完全一样

## 不做

- 不改小地图的其他逻辑(缩放、网格、标点),不加新图标种类。

## 结果(完成后填写)
