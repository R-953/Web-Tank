# 002-minimap-marker-style:小地图标记样式——圆点 / 箭头

- 负责:Claude Code(原定 GitHub Copilot;2026-09-29 负责人决定本轮由 Claude Code 代做)
- 状态:待审查
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

- 改动文件(都在「允许修改的文件」以内):
  - `src/ui/Minimap.ts`:`MinimapMarker` 加可选 `heading?: number`;新增类型 `MarkerStyle`、`setMarkerStyle()`;新增纯函数 `arrowVertices()`(三角形顶点,朝向约定与玩家箭头的 `rotate(-heading)` 一致);`draw()` 在箭头样式下给活着且有 `heading` 的车画三角,其余照旧画圆点(被击毁的仍是灰点加 ×)
  - `src/settings/Settings.ts`:`game.minimapMarkers: 'dot' | 'arrow'`,默认 `'dot'`,`sanitize()` 用 `pick` 修正
  - `src/ui/menu/SettingsPanel.ts`:「游戏」页签在「小地图形状」下面加「小地图标记:圆点 / 箭头」
  - `src/main.ts`:只改了卡上的两处(`applySettings` 加 `minimap.setMarkerStyle(...)`;敌车标记加 `heading`,算法照抄玩家的 `atan2(-fwd.x, -fwd.z)`)
  - `tests/settings.test.ts`:+1 个测试(缺省 / 旧存档 / 非法值 → `'dot'`,`'arrow'` 能存能读回)
  - `tests/minimap.test.ts`:+2 个测试(东南西北四个朝向的尖端位置;由车头向量按 main.ts 算法求朝向,尖端方向和车头在小地图上的方向一致)
- 命令与结果:`npm run lint` 通过;`npm test` 20 个文件 213 个测试全部通过(原 210 + 新 3);`npm run build` 通过
- 实机验收(Claude 桌面版内置浏览器,本分支的 dev server):
  - 设置 → 游戏出现「小地图标记」,点「箭头」后高亮
  - 河谷试验场 5 辆敌车全是红色三角;逐个读小地图画布像素,尖端方向和各车实际朝向(西 / 东 / 北偏西 30° / 南 / 南偏西 30°)一致
  - 直接调 `draw()` 传入被击毁的车:箭头样式下仍是灰点加 ×
  - 默认(圆点)样式的绘制逻辑、尺寸和颜色都没变(只把颜色提成了变量),外观不变
  - 截图随 PR 提交
- 偏差 / 待决定:
  - 卡上写执行者是 Copilot,这次由 Claude Code 代做
  - `GameSettings.game.minimapMarkers` 是必填字段(卡上指定的写法;`sanitize` 总会补上默认值,旧存档不受影响)
  - 目前小地图只有敌车(没有友军),所以蓝色箭头的代码路径实机看不到,单元测试也没覆盖(`draw()` 需要真画布,测试只覆盖了 `arrowVertices()` 的几何),目前只经过代码审查
  - 方向测试里抄了一份 main.ts 的朝向公式 `atan2(-fwd.x, -fwd.z)`,所以 main.ts 那一行本身没有测试覆盖。想让测试直接覆盖它,需要把公式提成公用函数,main.ts 归主程,本次没做
