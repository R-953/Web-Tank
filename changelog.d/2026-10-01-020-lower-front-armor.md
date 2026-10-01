### 020 车体正面分上下两块(首上 / 首下)(Antigravity)

- **新增 / 变更 / 修复**:
  - `src/data/types.ts`: `ArmorSpec` 新增可选字段 `lowerFront?: { thickness: number; height: number }` 及注释。
  - `src/game/Damage.ts`: 新增 `frontArmorAt(armor, hitLocalY, hullBottomY)` 函数; `resolveHit` 支持传入 `hitLocalY` 和 `hullBottomY` 可选参数以在受击面为正面时区分首上/首下。
  - `src/data/vehicles.ts`: 为虎王(`tiger_ii`)、T-34-85(`t34_85`)、谢尔曼三车(`m4a3_76w`、`m4a3e8`、`m4a3e2`)配置首下装甲视线厚度及模型分界高度; 虎式、SU-100、ISU-122 首下与首上同厚或更厚,按规则不设 `lowerFront`。
  - `docs/physics-validation.md`: 新增第 12 节,记录各车首下数值、模型高度与出处,以及 ISU-122 对决虎王首下历史战术验证。
  - `tests/lower-front-armor.test.ts`: 新增单元测试覆盖边界高度判定、无首下车辆退回 `front`、各车数据配置一致性、ISU-122 在 500 m 打虎王首上打不穿(打首下亦打不穿)、在 300 m 打首下能打穿(首上仍打不穿)。
  - `tests/realism.test.ts`: 历史对局常识补充 BR-471 在 500 m 与 300 m 对决虎王首上与首下对比测试用例。
- **决策**: 虎王首下采用纯几何视线厚度 156 mm(100 / cos 50° ≈ 155.6 mm),与首上 233 mm 及其他车辆纯几何视线厚度的规则保持一致。经 `flyShell` 测算,BR-471 穿深 ≥ 156 mm 的最远距离约为 340 m,在 500 m 衰减至 149.5 mm 无法击穿首下,而在 300 m 处(穿深 157.8 mm)能稳定击穿首下、首上仍打不穿。
- **说明**: `src/game/Game.ts` 归主程维护, 已由主程修改传入 `entry.y` 与 `-vehicle.spec.hull.height / 2`。
