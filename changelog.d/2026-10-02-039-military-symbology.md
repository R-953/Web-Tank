### 039 北约 / 华约军标符号(取代自绘的类型图标)(Antigravity)

- **新增 / 变更 / 修复**:
  - 新增 `src/ui/symbols.ts`，实现基于北约 (APP-6 / MIL-STD-2525) 与华约/苏军战术标图规范的矢量符号系统 (`symbolShape`、`symbolSvg`、`drawSymbol`、`setSymbology`、`currentSymbology`)。
  - 新增调研与设计文档 `docs/design/symbology.md`，记录北约与华约各车型出处、敌我识别框规范、公有领域版权与独立矢量路径说明、颜色偏差说明以及待确认清单。
  - 修改 `src/ui/menu/classIcons.ts`，将 `classIcon` 委托给 `symbolSvg` 并跟随当前选择的符号体系。
  - 修改 `src/settings/Settings.ts` 与 `src/ui/menu/SettingsPanel.ts`，在游戏设置中添加「地图符号:北约 / 华约」分段开关，缺省为北约，并在 `sanitize` 中做合法性校验与平滑降级。
  - 新增 `tests/symbols.test.ts` 并更新 `tests/class-icons.test.ts`，全量覆盖 8 种类型符号独立性、识别框、阵营色、击毁状态、中文无障碍标签、设置往返等测试。
- **决策**:
  - 苏军传统地图红友蓝敌，为防止玩家视角错乱，华约与北约两套符号均统一沿用游戏全局的“友军蓝、敌军红、中立绿”配色，在文档中详细记录该项偏差。
  - 严格依据条令规范与几何定义手工绘制 32×32 矢量路径，不抓取复制任何维基或第三方商业库现成 SVG 文件，确保彻底规避版权风险。
- **待确认**:
  - 华约体系在传入 `affiliation` 时目前共用标准的矩形/菱形/正方形识别框，后续是否需要切换为苏军无框单双线修饰待负责人定夺。
