# 055-modifications-screen:改装界面

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/055-modifications-screen`
- 规模:M–L
- 和 054 并行:界面按 `src/data/modifications.ts` 里定死的类型写,测试里 mock 数据函数

## 目标

右键菜单「改装」打开的全屏界面,参考 War Thunder 的 Modifications 界面。

## 参考布局(War Thunder 改装界面,文字描述)

- 一个居中的大面板(约占屏幕宽 65%),深色底;**标题**「改装 · <车名>」,右上角 ×。
- **第一排**:左边是当前车辆卡片(缩略图 `vehicleThumbnail(spec)`,没有时退回类型符号;车名);右边留空。
- **主体三栏**:「机动」「防护」「火力」,每栏一个灰色小标题条;栏内按等级 I–IV 分行,**最左边竖着一条带 I / II / III / IV 的箭头标尺**(机动栏有;其他栏同样标等级)。每个改装是一个小方块:左上一个简单图标(内联 SVG,按 `effects` 的种类选:履带 / 悬挂 / 变速箱 / 发动机 / 方向机 / 高低机 / 其他通用图标)、名称、右下一个勾选框;启用的方块有金色边和勾,缺前置的方块变暗不可点,悬停显示 `description` 和 `effects` 的具体变化;`effects` 为空的改装显示「效果暂未接入」小字。
- **底部**:一条进度条「已启用 n / m」,右边两个按钮「全部启用」「全部关闭」。
- 右侧或下方一个**效果汇总**:把启用后和原版相比有变化的数值列出来,如「方向机 19°/s → 20.9°/s」「最大速度 38 → 39.5 km/h」(用 `applyModifications` 算出新 spec 再和原 spec 对比 `turretRotationSpeed`、`turret.elevationSpeed`、`hull.turnRate`、`hull.acceleration`、`maxSpeed`)。
- 配色保持黑金。1280 × 720 和 961 × 541 下不出现滚动条(内容太多时面板内部滚动)。

## 要做的事

1. 新增 `src/ui/menu/ModificationsScreen.ts`:
   ```ts
   export interface ModificationsScreenOptions {
     parent: HTMLElement;
     getEnabled(vehicleId: string): string[];
     setEnabled(vehicleId: string, ids: string[]): void; // 调用方负责保存
     onClose?(): void;
     onUiSound?(): void;
   }
   export class ModificationsScreen {
     constructor(opts: ModificationsScreenOptions);
     open(spec: VehicleSpec): void;
     close(): void;
     get isOpen(): boolean;
     readonly root: HTMLElement;
     dispose(): void;
   }
   ```
   点方块调用 `toggleModification(spec, enabled, id)`(`src/data/modifications.ts` 里已有占位导出,054 实现真逻辑;界面里**不要**自己写前置判断);测试里用 `vi.mock` 覆盖 `modificationsFor` 和 `toggleModification`。Esc 和 × 关闭;点面板外的遮罩也关闭。
2. 样式:新增一段 `injectModificationsStyles()`,写在 `ModificationsScreen.ts` 里(自己的 `<style>`),**不要改 `styles.ts`**。
3. 测试(jsdom):渲染三栏和等级、点击启用 / 关闭、缺前置不可点、`effects` 为空的标注、全部启用 / 全部关闭、效果汇总出现变化行、Esc / × / 遮罩关闭、`getEnabled` / `setEnabled` 的调用。

## 允许修改的文件

- 新增:`src/ui/menu/ModificationsScreen.ts`、`tests/modifications-screen.test.ts`、`changelog.d/<日期>-055-modifications-screen.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 上面第 3 条的测试都有
- [ ] 主程会在浏览器里看布局和交互

## 不做

- 数据和逻辑(054);右键菜单(053)和 `main.ts` 接线(主程做);研发点数、价格、「自动购买」之类按钮。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
