### 071 车内 X 光模型抽成共用组件(Antigravity)

- **重构**: 将 `KillCam.ts` 与 `InternalsView.ts` 中分散的车内 X 光 3D 模型(模块盒子、坐姿人形乘员模型 `buildCrewFigure`、`killcamModuleColor`、`killcamCrewColor`、`MODULE_TYPE_COLORS`、`healthColor`)统一抽取至 `src/ui/internalsModel.ts`。
- **重构**: `buildInternalsModel` 提供 `hullMount`、`turretMount`、`gunMount` 三挂载点及 `update`、`setOpacity`、`dispose` 接口，支持基础透明度配置与显隐；`KillCam.ts` 与 `InternalsView.ts` 均接入新组件，消除重复定义。
- **新增**: `tests/internals-model.test.ts` 覆盖挂载点分组、着色插值、乘员顶替换位换挂载点、淡入淡出透明度缩放及资源清理。
- **决策**: `buildInternalsModel` 默认采用基于模块类型的 `killcamModuleColor` 着色，同时支持 `colorMode: 'health'` 保持 `InternalsView` 原有色调兼容性。
