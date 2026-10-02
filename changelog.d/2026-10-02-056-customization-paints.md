### 056 涂装界面与历史涂装方案(Antigravity)

- **新增 / 变更 / 修复**:
  - 新增 `src/data/paints.ts`: 定义 `PaintSpec` 接口与 `paintsFor`、`applyPaint` 工具函数, 为游戏中全部 8 辆载具配置出厂及历史上真实使用过的涂装方案(虎式装甲灰/橄榄绿/冬季白, 虎王暗黄/橄榄绿/冬季白, 苏联 4BO 与冬季白, 谢尔曼橄榄褐与冬季白等);
  - 新增 `src/settings/PaintStore.ts`: 涂装持久化存储, 使用 localStorage 键 `webtank.paints.v1`, 实现读取、设置、订阅, 坏数据与异常自动容错;
  - 新增 `src/ui/menu/CustomizationScreen.ts`: 涂装定制全屏弹层组件, 独立注入专用样式, 支持涂装方案金边高亮、缩略图/色块实时预览、确定保存、取消/Esc/关闭按钮还原原涂装;
  - 新增测试 `tests/paints.test.ts`、`tests/paint-store.test.ts`、`tests/customization-screen.test.ts`: 全面覆盖史实数据校验、涂装套用逻辑、存储往返容错以及界面交互回调。
- **决策**:
  - 德军装甲灰 (RAL 7021 `0x3b3f42`) 与橄榄绿 (RAL 6003 `0x4b533b`) 严格按标准色卡转换;
  - 冬季涂料标明为战地临时石灰水洗涂料估算值 (`0xd8dcd6`);
  - 样式自包含在 `CustomizationScreen.ts` 中动态注入, 避免与其他并行任务修改 `styles.ts` 冲突。
- **待确认**: 无。
