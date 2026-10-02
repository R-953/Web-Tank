# 056-customization-paints:涂装界面(历史涂装方案)

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/056-customization-paints`
- 规模:M
- 和 054、055、057–063 并行;改的文件不重叠

## 目标

右键菜单「涂装」打开的界面:为每辆车选择一种**历史上真实存在的涂装方案**,在机库里实时预览。(War Thunder 的 Customisation 有迷彩、贴花、铭牌;我们先做迷彩色。)

## 背景与参考

- 涂装色 = 模型的主体色:所有车模型都用 `palette(spec.color)` 取各部件的颜色(`src/game/models/*`),所以换涂装 = 换 `spec.color`;履带、橡胶、炮管等不上漆的部件在 `palette` 里本来就是自己的颜色,不会跟着变。
- 项目已有的涂装约定(026 号卡、`docs/physics-validation.md` 里谢尔曼涂装一节):**涂装色要有出处,加国籍标识,不上漆的部件用本色**。谢尔曼的白星是 `markings.ts` 另画的,不随涂装色变。
- agent 没有联网。色值如果写了标准色号(RAL / FS / Humbrol 之类),主程会用资料逐条核实;**没把握的色号不要写,宁可写「估算:……」并说明方法**,不要编出处。

## 要做的事

1. **数据**(新增 `src/data/paints.ts`):
   ```ts
   export interface PaintSpec { id: string; name: string; color: number; source: string; note?: string }
   export function paintsFor(spec: VehicleSpec): readonly PaintSpec[]; // 第一项永远是「出厂」(id 'default',color = spec.color)
   export function applyPaint(spec: VehicleSpec, paintId: string | null | undefined): VehicleSpec; // 未知 id / null / 'default' 原样返回;返回新对象,不改入参
   ```
   每辆车至少 2 个方案(含默认),都要是**该车型历史上实际使用过**的:
   - 虎式 / 虎王:暗黄(Dunkelgelb,1943 年起)、橄榄绿(Olivgrün)、装甲灰(Panzergrau,早期)等;
   - T-34-85 / SU-100 / ISU-122:苏军标准防护绿(4BO)、冬季白色涂料(临时水洗);
   - 谢尔曼三车:橄榄褐(Olive Drab,默认保持 026 号卡定的色值)、冬季白色涂料。
   `name` 用中文,`source` 写出处或估算方法,`note` 写使用时间 / 场合。
2. **存档**(新增 `src/settings/PaintStore.ts`):`localStorage` 键 `webtank.paints.v1`,`{ [vehicleId]: paintId }`,`get(vehicleId)`、`set(vehicleId, paintId | null)`、`subscribe(fn)`;坏数据回到空,存储不可用不抛错(参考 `SettingsStore`)。
3. **界面**(新增 `src/ui/menu/CustomizationScreen.ts`):全屏弹层,标题「涂装 · <车名>」,×;左边是方案列表(色块 + 名称 + 使用时间 + 出处小字),选中的有金边;右边是大一点的车辆预览(缩略图 `vehicleThumbnail(applyPaint(spec, id))`,没有时只显示色块);点选方案立即调用 `onPreview(paintId)`(主程把它接到机库的 3D 模型上做实时预览),「确定」保存并关闭,「取消」/ Esc / × 恢复原来的并关闭。
   ```ts
   export interface CustomizationScreenOptions {
     parent: HTMLElement;
     getPaint(vehicleId: string): string | null;
     setPaint(vehicleId: string, paintId: string | null): void; // 点「确定」时调用
     onPreview?(spec: VehicleSpec): void; // 选中方案时,传入已套用涂装的 spec;取消时传回原 spec
     onClose?(): void;
     onUiSound?(): void;
   }
   export class CustomizationScreen { constructor(opts); open(spec: VehicleSpec): void; close(): void; get isOpen(): boolean; readonly root: HTMLElement; dispose(): void }
   ```
   样式写在 `CustomizationScreen.ts` 里自己的 `<style>`,**不要改 `styles.ts`**。
4. 测试:`paintsFor` 每辆车 ≥ 2 项且第一项是出厂、`id` 唯一、`source` 非空;`applyPaint` 的各种输入和不改入参;`PaintStore` 往返和坏数据;界面的选择 / 预览回调 / 确定 / 取消恢复 / Esc。

## 允许修改的文件

- 新增:`src/data/paints.ts`、`src/settings/PaintStore.ts`、`src/ui/menu/CustomizationScreen.ts`、`tests/paints.test.ts`、`tests/paint-store.test.ts`、`tests/customization-screen.test.ts`、`changelog.d/<日期>-056-customization-paints.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 第 4 条的测试都有
- [ ] 主程会逐条核实每个色值的出处,并在浏览器里看预览

## 不做

- 机库实时预览的接线、右键菜单(053)和 `main.ts`(主程做);贴花、铭牌、自定义颜色;不改 `markings.ts`。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
