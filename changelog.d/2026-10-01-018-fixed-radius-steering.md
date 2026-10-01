### 018 受控差速器的固定半径转向(Antigravity)

- **新增 / 变更 / 修复**:
  - `src/data/types.ts`: `HullSpec` 新增可选字段 `turnRadius?: number`(固定转向半径,米);
  - `src/game/Vehicle.ts`: 转向角速度上限加入 `turnRadius` 约束(`min(turnRate, |车速| / turnRadius)`),静止时无法原地转向;
  - `src/data/vehicles.ts`: 为三辆谢尔曼(`m4a3_76w`、`m4a3e8`、`m4a3e2`)添加 `turnRadius`(9.5 / 9.5 / 11.25 m);
  - `tests/steering.test.ts`: 新增测试用例验证谢尔曼静止转向 3 秒航向角变化 < 1°、10 km/h 行驶转向半径在 19 m 直径 ±15% 以内、其他车辆原地转向行为不变。
- **决策**:
  - 转向角速度限制中的车速取当前固定步更新后的纵向车速 `Math.abs(newFwd)`,与刚体线速度更新保持物理同步;
  - 经检查 `src/game/Controllers.ts`,AI 驾驶逻辑(`StaticController`、`PatrolController`、`GunnerAI`)不依赖谢尔曼原地转向,谢尔曼不会卡死。
- **待确认**:无。
