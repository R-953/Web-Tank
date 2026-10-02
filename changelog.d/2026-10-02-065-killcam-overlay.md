### 065 命中回放文字与图标层(Antigravity)

- **新增**: 实现命中回放界面覆盖层 `KillCamOverlay` 及判定纯函数(`hitOutcome`、`ratioAt`、`killcamCaption`、`killcamIcons`、`killcamCrew`)。包含顶部标题随时间轴升级动效、左下模块状态图标、右下乘员数统计与局部 DOM 脏检查机制。
- **决策**: 顶部标题状态升级按「击穿 → 乘员失去战斗力 → 弹药殉爆」只升不降处理，相同状态多次更新时不触发 DOM 重绘；样式采用独立的 `kco-` 前缀并确保单例注入。
- **待确认**: 无。
