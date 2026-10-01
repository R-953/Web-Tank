### 021 第三人称按 Z 放大视角(Antigravity)

- **新增**:OrbitCamera 增加 `THIRD_PERSON_ZOOM_FOV`(35°)与第三人称放大状态及方法(`thirdZoomed`、`toggleThirdZoom`、`setThirdZoom`)。放大时视场收窄为 35°,灵敏度在 `scaleWithZoom` 开启时按视场比例缩放。开镜及退出开镜、载具阵亡时自动复位。
- **变更**:按键逻辑在未开镜时使 `zoomCycle` 切换第三人称放大、`zoomIn` 放大、`zoomOut` 复原;底部提示文案与键位设置名称更新为「放大视角 / 切换瞄准镜倍率」与「放大 / 倍率」。
- **决策**:War Thunder 官方未公开第三人称放大的具体垂直视场度数,按任务卡要求采用 35° 估算值(按 2 倍放大取 70° 的一半)。
- **待确认**:无。
