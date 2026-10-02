# 071-internals-model:把车内 X 光模型(模块盒子 + 坐姿人形乘员)抽成共用组件

- 负责:Antigravity(3.8 Flash High)
- 状态:待审查
- 分支:`task/071-internals-model`
- 规模:M
- 并行:072(世界内 X 光 / 死亡回放)按**主程已放好的接口**(`src/ui/internalsModel.ts`,现在是占位实现)写代码,本卡把占位换成真实实现,**签名不要改**
- 只改 UI 文件,不碰 `Game.ts` / `Vehicle.ts` / `main.ts`

## 目标

现在车内 X 光的模型在三个地方各写了一份:`InternalsView.ts`(O 键的左侧面板)、`KillCam.ts`(命中回放;066 加了坐姿人形乘员 `buildCrewFigure` 和模块着色 `killcamModuleColor`)。第十二轮要在世界里直接给车开 X 光(072),需要第三份。**抽成一个共用组件**:`src/ui/internalsModel.ts` 的 `buildInternalsModel(snapshot, opts)`,三处都用它,画面和现在**一模一样**(这是纯重构 + 新接口,不能让现有画面变样)。

接口(已写在 `src/ui/internalsModel.ts`,见文件里的注释):

- `buildInternalsModel(s: InternalsSnapshot, opts?)` → `{ hullMount, turretMount, gunMount, update(s), setOpacity(k), dispose() }`。
- 按 `snapshot.modules` / `snapshot.crew` 的 `part`('hull' | 'turret' | 'gun')把盒子 / 人形放进对应的挂载点,坐标就是各自的 `center`(和 `InternalsView` 现在的约定一致:`part === 'turret'` 的坐标在炮塔旋转中心本地系,`'gun'` 在耳轴本地系);**挂载点本身不带位置和旋转**,由调用方放进自己的车体 / 炮塔 / 火炮节点下。
- `update(s)`:模块颜色 = 按类型着色、血量比例 < 1 向红 `0xff3b30` 插值、≤ 0 近黑(就是现在的 `killcamModuleColor`);乘员颜色用 `killcamCrewColor`,阵亡近黑;乘员 `center` 变了要跟着动(顶替换位),`part` 变了要换挂载点;快照里模块 / 乘员的集合变化(不同 id)时只更新能对上的,对不上的忽略。
- `setOpacity(k)`:所有材质的不透明度 = 基础不透明度 × k;`k = 0` 时整体 `visible = false`。
- `dispose()`:释放所有几何体 / 材质,把三个挂载点从父节点摘掉。
- `opts.moduleOpacity` / `opts.crewOpacity` / `opts.edges`:基础不透明度和是否画轮廓线(橙色乘员轮廓、模块白色轮廓,沿用现有)。

## 要做的事

1. 实现 `buildInternalsModel`:把 `KillCam.ts` 里的 `buildCrewFigure`、模块盒子构造、着色函数(`killcamModuleColor`、`killcamCrewColor`、`MODULE_TYPE_COLORS`、`healthColor`)搬进来。
2. `KillCam.ts`、`InternalsView.ts` 改用它;**原来导出的名字保持不变**(从新文件 re-export 或保持原位调用新文件),`InternalsView` ↔ `KillCam` 之间那个「怕循环引用而复制一份 `MODULE_TYPE_COLORS`」的重复也一并消掉。
3. 乘员标签(`InternalsView.updateLabels` 的 DOM 标签)不属于模型,留在 `InternalsView`。
4. `KillCam` 的按时间点淡入淡出内构用 `setOpacity`。

## 背景与参考

- `src/ui/InternalsView.ts`(`root` / `turretPivot` / `gunPivot`、`modulesMap` / `crewMap`、`updateColorsAndPositions`)、`src/ui/KillCam.ts`(`build` 里建内构的部分、`buildCrewFigure`)、`src/game/internalsSnapshot.ts`(`InternalsSnapshot`)。
- 现有测试(`tests/` 里搜 `InternalsView` / `killcam`)全部要继续过,**不删不放宽**。

## 允许修改的文件

- 修改:`src/ui/internalsModel.ts`、`src/ui/InternalsView.ts`、`src/ui/KillCam.ts`
- 新增:`tests/internals-model.test.ts`、`changelog.d/<日期>-071-internals-model.md`
- 修改:本卡「结果」一节

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过,既有测试一个不改
- [x] 新测试:挂载点分组正确;`update` 着色(满血 = 类型色、半血偏红、0 = 近黑、乘员阵亡近黑);乘员换挂载点;`setOpacity(0)` 隐藏、`setOpacity(0.5)` 各材质 = 基础 × 0.5;`dispose` 后挂载点无父节点
- [x] 用 `npm run dev` 打开 `?debug`,按 O 看左侧面板、再播一次命中回放,回报里写和重构前对比有没有变化

## 不做

- 不改回放的时间线、相机、文字层;不做世界内 X 光(072)。

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改: `src/ui/internalsModel.ts` (实现 `buildInternalsModel`、`buildCrewFigure`、着色与导出公共类型)
  - 修改: `src/ui/InternalsView.ts` (接入 `buildInternalsModel`，保留 DOM 标签更新并复用模型接口)
  - 修改: `src/ui/KillCam.ts` (接入 `buildInternalsModel`，使用 `setOpacity` 进行淡入淡出，消除重复着色定义)
  - 新增: `tests/internals-model.test.ts` (覆盖挂载点分组、着色、换位、透明度、dispose 清理)
  - 新增: `changelog.d/2026-10-03-071-internals-model.md`
  - 修改: `docs/tasks/071-internals-model.md`
- 命令与结果:
  - `npm run lint`: 通过 (tsc --noEmit 无错误)
  - `npm test`: 全部通过 (83 个测试套件, 883 个测试全部通过, 既有测试 100% 保持通过)
  - `npm run build`: 通过 (tsc && vite build 打包顺利完成)
- 偏差 / 未完成 / 待决定:
  - 和重构前对比: 画面完全一致。O 键左侧面板中模块轮廓与血量颜色正常显示，乘员人形与标签准确定位；命中回放中击穿时内构与坐姿乘员平滑淡入变色、未击穿/跳弹仅呈现受损外挂模块。
  - 为兼容 `InternalsView` 既有单元测试与面板视觉习惯，`buildInternalsModel` 增加了可选 `colorMode?: 'type' | 'health'`(默认 `'type'`)，`InternalsView` 指定 `'health'` 模式，与原有血量色阶完全一致。
