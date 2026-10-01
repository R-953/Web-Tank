### 028 载具国家 / 类别 / 年份 / 车族,以及王牌乘员数值(Antigravity)

- **新增**:
  - `src/data/types.ts`: 增加 `Nation`、`VehicleClass`、`CrewAceSpec` 类型,并在 `VehicleSpec` 中增加可选字段 `nation`、`vehicleClass`、`serviceYear`、`family`、`crewAce`。
  - `src/data/vehicles.ts`: 为全部 8 辆载具补充国家、车型分类、服役年份、车族及王牌乘员数值(装填时间、方向机与高低机转速)。
  - `tests/vehicle-meta.test.ts`: 验证 8 辆车 5 个元数据字段完整性、车族分类正确性、王牌数值相比基础值的提升。
  - `docs/physics-validation.md`: 补充第 13 节详细记录每辆车实装数值、新手/王牌数值对比、折算依据与公开文献/WT 出处。
- **决策**:
  - 服役年份以各型实车正式列装或投入实战年份为准(虎式按 1942 年列装,其余 7 辆均为 1944 年)。
  - WT 新手值与现有值一致的车直接采用 WT 王牌值;不一致的(如历史射速填写的装填时间、史料液压方向机转速)按 WT 新手到王牌比例(方向/高低机按瞄准技能 10/7 比例)折算,保持数值体系自洽。
- **待确认**: 无。
