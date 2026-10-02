### 072 世界内 X 光与叠在世界里的死亡回放(Antigravity)

- **新增 / 变更 / 修复**:
  - 新增 `src/ui/WorldXray.ts`: 实现 `WorldXray` 类与纯函数 `xrayShellStyle(k)`。支持直接在世界中的载具上开 X 光，外壳材质替换为透明克隆、混合中性灰并添加半透明白色轮廓线，挂载 `buildInternalsModel` 内构模型并支持 `setFade` 过渡与无泄漏还原。
  - 新增 `src/ui/WorldReplay.ts`: 实现 `WorldReplay` 类及纯函数 `worldReplayCameraPose`、`worldReplayFade`、`worldReplayImpactMark`、`worldReplayTrajectoryPoints`。叠在游戏世界里播放被击毁过程（细青绿弹道线、橙色弹着标记圆盘与扩散双圆环、受损模块红色高亮轮廓盒、缓慢环绕并在尾声微拉远的相机运动、`KillCamOverlay` 文字与模块图标层）。
  - 修改 `src/ui/KillCam.ts`: 仅增加 `export` 关键字导出时间常量与 `computeVehicleBounds`，未修改任何逻辑行为。
  - 新增测试 `tests/world-xray.test.ts` 与 `tests/world-replay.test.ts`，验证纯函数与冒烟场景还原。
- **决策**:
  - 相机环绕以残骸世界包围盒中心为基准，初始位于来弹方向仰角约 15° 看向弹着点，接触后注视点平滑过渡至中心，后效结束后略微拉远 20% 距离。
  - 材质克隆与边缘轮廓线在 `disable()` 时全部 dispose 并还原原始引用，重复调用 `enable` / `disable` 零节点泄漏。
- **待确认**:
  - 任务 074 接线时，相机交接需在回放开始时接管 `PerspectiveCamera` 并在 `stop()` 后交还控制权；当前 `Vehicle` 开放的 `root`、`turretPivot`、`gunPivot` 已完全满足需求。
