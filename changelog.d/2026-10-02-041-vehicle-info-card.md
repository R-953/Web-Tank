### 041 鼠标悬停的载具信息卡片(Antigravity)

- **新增**: 新增独立组件 `src/ui/menu/VehicleCard.ts` 与对应测试 `tests/vehicle-card.test.ts`。实现纯数据生成函数 `vehicleCardData` 与 DOM 卡片组件 `VehicleCard`。
  - `vehicleCardData`: 支持根据车组技能 [0, 1] 动态线性插值装填时间与高低机/方向机速度并标注满级王牌数值; 包含标题(载具名)、副标题(国家 · 类别 · 服役年份)、火力(主炮、各弹种与炮口穿深、同轴机枪、弹药架容量)、瞄准、防护(车体、首下、炮塔/战斗室)、机动(最大速度、转向模式与半径/角速度、起步加速度)、乘员人数等完备字段。
  - `VehicleCard`: 支持传入 anchor 自动定位(优先右侧, 边缘自适应与视口防溢出); 支持鼠标离开 150 ms 延迟隐藏及移入卡片取消隐藏; 支持卡片双击关闭与 `dispose` 清理。
- **变更**: `src/ui/menu/styles.ts` 末尾追加卡片样式 `VEHICLE_CARD_CSS` 与样式注入函数 `injectVehicleCardStyles`。
- **决策**: 弹种类型显示英文缩写及中文名(如 `APCBC-HE (被帽风帽穿甲爆破弹)`)方便识别; 转向行根据是否有固定半径区分显示 `固定半径 N m` 或 `原地转向 N°/s`。
- **待确认**: 无。组件为独立实现, 后续由主程接线至编组栏与科技树。
