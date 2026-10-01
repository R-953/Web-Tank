### 044 mapscreen-key-and-symbols(Antigravity)

- **新增 / 变更 / 修复**:
  - 新增操作 `mapScreen`(地图界面), 默认绑定 `['KeyM', null]`, `minimapShape` 默认键位调整为 `[null, null]`。
  - 在 `Settings.sanitize` 中加入旧存档迁移逻辑: 若旧存档没有 `mapScreen` 且 `minimapShape` 绑了 `KeyM`, 则将 `minimapShape` 中的 `KeyM` 替换为 `null`, 保证 `mapScreen` 默认使用 M 键。
  - 小地图增加军标标记样式支持 (`MarkerStyle = 'dot' | 'arrow' | 'symbol'`), `MinimapMarker` 增加 `vehicleClass` 可选字段; `game.minimapMarkers` 缺省值设为 `'symbol'`; 设置界面增加「军标」选项。
  - 抽出 `MapLike = Pick<GameMap, 'spec' | 'grid'>`, `renderMapBackground` 与 `MapScreen.open` 接受 `MapLike`。
  - 地图界面在未传入自定义 `drawMarker` 时按当前下拉框符号体系绘制 18 px 军标(带识别框), 下拉框切换时立即重画上一帧。
  - `MapScreenOptions` 新增 `onSelectCrew` 回调: `spawn` 模式下点击有车卡片时调用并切换高亮; `battle` 模式下点击卡片只切换携弹面板。
- **决策**:
  - 小地图在没有 `vehicleClass` 属性时平滑降级为绘制圆点, 避免异常。
  - 在 `spawn` 模式下切换卡片既触发 `onSelectCrew` 又更新视觉选中态, 而 `battle` 模式下保持出战载具的高亮不变, 仅供在左侧面板查阅/调整该车携弹。
- **待确认**: 无
