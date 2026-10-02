### 054 改装的数据、套用逻辑和存档(Antigravity)

- **新增 / 变更 / 修复**:
  - `src/data/modifications.ts`: 实现机动(履带/悬挂/传动/发动机)、防护(备件/灭火器/乘员补充)、火力(水平驱动/垂直驱动/射击调整)改装数据定义，支持坦克歼击车无炮塔方向机差异化配置；实现 `modificationsFor`、`applyModifications`、`sanitizeModifications`、`toggleModification` 纯逻辑函数，保证入参不可变与前置/连带关闭规则。
  - `src/settings/ModificationStore.ts`: 新增改装存档类 `ModificationStore`，读写 localStorage `webtank.mods.v1`，支持按车存取、坏数据容错与变更订阅。
  - `tests/modifications.test.ts`: 新增改装数值提升、同类相乘、前置/连带关闭、总提升上限 <= +25%、坦克歼击车特性与纯函数测试。
  - `tests/modification-store.test.ts`: 新增存档读写往返、坏数据降级、存储不可用容错及 subscribe 订阅通知测试。
- **决策**: 改装数值采用保守档(+4% 至 +10% 级，发动机极速 +5%)，单栏累计总提升均不超过 +25%；坦克歼击车无旋转炮塔故排除水平方向机，其垂直驱动无需前置。
- **待确认**: 无。
