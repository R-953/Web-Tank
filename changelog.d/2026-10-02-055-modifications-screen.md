### 055 改装界面(Antigravity)

- **新增 / 变更 / 修复**:
  - 新增 `src/ui/menu/ModificationsScreen.ts`: 实现右键菜单「改装」全屏界面, 包含车辆卡片(缩略图与类型符号降级)、机动/防护/火力三栏与 I–IV 标尺、内联 SVG 改装图标、金色边框勾选、前置依赖判断与变暗不可点、效果暂未接入小字标注、效果汇总数值变化对比行、启用进度条及全部启用/全部关闭按钮、Esc/关闭按钮/遮罩关闭。
  - 组件内封装 `injectModificationsStyles()`, 独立管理黑金主题样式, 适配 1280x720 与 961x541 内部滚动不出现外层滚动条。
  - 新增 `tests/modifications-screen.test.ts`: 涵盖渲染三栏和等级标尺、缩略图展示、启用/关闭点击、缺前置不可点、空 effects 标注、全部启用/关闭、效果汇总数值对比、Esc/×/遮罩关闭、getEnabled/setEnabled 调用的全套单元测试。
- **决策**:
  - 界面内部负责前置依赖的 UI 渲染判断与不可点保护, 状态切换逻辑直接调用 `toggleModification(spec, enabled, id)`, 确保与 054 真实套用逻辑解耦。
  - 样式使用独立的 `<style id="modifications-screen-styles">` 标签动态注入, 不修改共用的 `styles.ts`。
- **待确认**:
  - 无。
