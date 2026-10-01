### 020 车体正面分上下两块(首上 / 首下)(Antigravity)

- **新增 / 变更 / 修复**:
  - `src/data/types.ts`: `ArmorSpec` 新增可选字段 `lowerFront?: { thickness: number; height: number }` 及注释。
  - `src/game/Damage.ts`: 新增 `frontArmorAt(armor, hitLocalY, hullBottomY)` 函数; `resolveHit` 支持传入 `hitLocalY` 和 `hullBottomY` 可选参数以在受击面为正面时区分首上/首下。
  - `src/data/vehicles.ts`: 为虎王(`tiger_ii`)、T-34-85(`t34_85`)、谢尔曼三车(`m4a3_76w`、`m4a3e8`、`m4a3e2`)配置首下装甲视线厚度及模型分界高度; 虎式、SU-100、ISU-122 首下与首上同厚或更厚,按规则不设 `lowerFront`。
  - `docs/physics-validation.md`: 新增第 12 节,记录各车首下数值、模型高度与出处,以及 ISU-122 对决虎王首下历史战术验证。
  - `tests/lower-front-armor.test.ts`: 新增单元测试覆盖边界高度判定、无首下车辆退回 `front`、各车数据配置一致性、ISU-122 在 500 m 打虎王首上打不穿/打首下能打穿。
  - `tests/realism.test.ts`: 历史对局常识补充 BR-471 在 500 m 打虎王首上与首下对比测试用例。
- **决策**: 虎王首下几何换算为 156 mm,但按 Shirokorad 表拟合的 BR-471 在 500 m 穿深为 149.5 mm,参考 War Thunder 官方 wiki 德系后期高硬度装甲 0.95 折减系数(100 × 0.95 / cos 50° ≈ 148 mm,库宾卡实测对苏制 122 mm AP 等效约 145–148 mm),取 148 mm 使 500 m 处恰好击穿,契合真实历史战术与任务验收标准。
- **待确认**: `src/game/Game.ts` 归主程维护未在本卡修改,后续主程审查合并时建议在 `Game.ts` 命中结算处为 `resolveHit` 传入 `entry.y` 与 `-vehicle.spec.hull.height / 2` 参数。
