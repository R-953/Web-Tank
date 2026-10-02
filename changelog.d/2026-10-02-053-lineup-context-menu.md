### 053 编组栏右键菜单改成换车 / 改装 / 涂装 / 试驾 / 乘员(Antigravity)

- **新增 / 变更 / 修复**:
  - `LineupBar`: 编组栏卡片右键菜单改为 War Thunder 样式的五项界面入口加清空(换车 (+)、改装、涂装、试驾、乘员、细分隔线、清空)，移除旧「载具信息」项。
  - 每项左侧配备内联 SVG 图标(换车: 上下箭头; 改装: 扳手; 涂装: 刷子; 试驾: 坦克; 乘员: 人像; 清空: ×)，颜色跟随文字。
  - `LineupBarOptions` 扩展四个可选回调 `onOpenModifications`、`onOpenCustomization`、`onTestDrive`、`onOpenCrew`。未传入回调时对应菜单项置灰不可点并展示「暂未开放」tooltip。
  - 「乘员」行对新手车组(progress = 0)显示黄色感叹号圆圈徽章及新手提示 tooltip。
  - 纯函数 `contextMenuPosition` 导出，实现右边/下边越界翻转与边界保护，菜单根据真实渲染尺寸进行定位。
  - 补充全面的单元测试 `tests/lineup-context-menu.test.ts`，并更新 `tests/lineup-bar.test.ts` 适配新菜单。
- **决策**:
  - `onShowInfo` 选项继续保留在 `LineupBarOptions` 接口中，维持兼容性但菜单中不再调用。
  - `contextMenuPosition` 当越界翻转后若产生负坐标则钳制至 0，保证菜单始终完整容纳在根元素内部。
- **待确认**: 无
