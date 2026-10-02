### 064 信息卡补质量、发动机功率、前进 / 倒车速度和弹药数(Antigravity)

- **新增**:
  - `src/data/vehicles.ts`: 为 8 辆核心载具(`TIGER_I`、`T34_85`、`TIGER_II`、`SU_100`、`ISU_122`、`M4A3_76W`、`M4A3E8`、`M4A3E2`)在顶层补充 `mass`(战斗全重 kg)、`enginePower`(公制马力与转速)、`reverseSpeed`(最大倒车速度 km/h), 且每个数值均附带详细出处或估算换算注释。
  - `src/ui/menu/VehicleCard.ts`: 信息卡「机动」一节补充质量(`xx.x t`)、发动机功率(`xxxx hp @ xxxx rpm`)、最大速度修改为「前进 / 倒车」两档速度(`38 / 6 km/h`, 无倒车速度时仅显示前进速度); 「火力」一节增加同轴机枪携弹量行(`同轴机枪弹药 n 发`)。字段缺失时平滑跳过对应行。
  - `tests/vehicle-extra-fields.test.ts`: 新增数据层(8 辆车质量、功率、转速、倒车速度合法性)与信息卡字段展示/缺失测试。
- **变更**:
  - `tests/vehicle-card.test.ts`: 补充同轴机枪弹药数、机动节三项新增指标及字段缺失时的测试断言(只增不删)。
- **决策**: 虎式倒车速度取实车 2500 rpm 限速下的 6 km/h(Wikipedia 明确记载 2500 rpm 限速下公路极速 38 km/h、倒车 6 km/h, 对应未限速时 War Thunder 8 km/h 并与任务卡示例一致); 其余各车数值优先采用 War Thunder 官方 wiki 与公开权威技术资料(如 Hunnicutt 1994、德军手册 D 656/21 等)。
- **待确认**: 无。
