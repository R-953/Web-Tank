### 022 瞄准镜顶部改为方位角,距离读数移到准星右下(Antigravity)

- **新增 / 变更 / 修复**:
  - `SightOverlay.ts`: 新增 `azimuthFromYaw` 与 `azimuthTicks` 纯逻辑函数,视线水平 yaw 映射到 [0, 360) 方位角;顶部距离刻度带替换为方位角刻度带(War Thunder 值:5° 短刻度、15° 长刻度标数,中心红三角指针);表尺距离移至瞄准点右下方(+3 密位, +3 密位),格式为「距离:<米数>」并随倍率缩放位置。
  - `SightOverlay.ts`: `draw()` 缓存 key 增加方位角(保留 1 位小数),避免微小变动每帧全量重绘。
  - `main.ts`: `sight.draw()` 传入 `azimuth: azimuthFromYaw(orbit.yaw)`。
  - `tests/sight-azimuth.test.ts`: 新增方位角换算与刻度带逻辑测试。
- **决策**:方位刻度带每 15° 标数字、每 5° 短刻度,对齐 War Thunder 设定;距离读数使用固定字号并在瞄准点右下 3 密位处随视场密位缩放位置,不遮挡主瞄准三角。
- **待确认**:无。
