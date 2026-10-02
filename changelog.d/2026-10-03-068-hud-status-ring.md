### 068 底部状态提示改版 + 圆环进度(顶替 / 维修 / 补给)(Antigravity)

- **新增 / 变更 / 修复**:
  - 新增 `src/ui/hud/hudStatus.ts`: 纯逻辑实现状态型提示优先级排序 (`statusMessages`, 最多 3 条)、瞬时提示解析 (`transientFromHit`) 与 3.5 秒过期消息队列 (`MessageQueue`)。
  - 新增 `src/ui/hud/ProgressRing.ts`: 直径约 44px 的 SVG 环形进度条组件, 支持乘员岗位(方向盘、瞄准镜、炮弹、双筒望远镜、电台等)、维修扳手与占点补给图标, 支持 amber/blue 色调与可选说明文字。
  - 修改 `src/ui/Hud.ts`: 接入 `hudStatus` 状态提示与瞬时提示; 底部状态栏展示横向并排的 `ProgressRing` 圆环(乘员顶替进度、维修倒计时与占点补给); 暴露 `setResupply(progress | null)` 方法; 右上角 feed 移除所有 hit 命中文字判定(改由回放呈现)及维修、顶替、己方起火行, 仅保留敌方摧毁/起火/殉爆; 移除 `describeHit` 及其专有常量与无用导入。
  - 新增 `docs/design/hud-status.md`: 详细说明三种圆环的数据来源、进度公式与将来占点补给模式的接入方案。
  - 新增测试 `tests/hud-status.test.ts` 与 `tests/progress-ring.test.ts`。
- **决策**:
  - 瞬时提示中若模块损坏且已包含在持续状态提示表(发动机/传动/炮管/炮闩/履带)中, 不再重复输出红色「损坏」瞬时字样, 避免同一模块重复冗余提示。
  - 乘员顶替期间该岗位正在由其他乘员接替, 隐藏对应的「xx昏迷」文字, 仅展示对应的顶替进度圆环。
- **待确认**:
  - 占点补给模式尚待地图与游戏循环完成判定逻辑后调用 `hud.setResupply(progress)`。
