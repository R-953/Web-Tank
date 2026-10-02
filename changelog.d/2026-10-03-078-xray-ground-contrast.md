### 078 xray-ground-contrast (Antigravity)

- **新增**: 新增 `src/ui/surfaceLuminance.ts`，基于 sRGB 相对亮度公式提供地表亮度计算函数 `relativeLuminance` 与映射表 `SURFACE_LUMINANCE`；新增测试套件 `tests/xray-contrast.test.ts`。
- **变更**:
  - `src/ui/WorldXray.ts`: 新增纯函数 `xrayContrastFor`，在亮地面(雪地 ≥ 0.75)下不增强对比度(外壳灰度压暗至 0x4b5258、轮廓线改为深灰 0x222222)，暗/中等地面(≤ 0.55)保持灰壳与白轮廓线，中间段线性插值平滑过渡；`xrayShellStyle` 支持可选参数 `contrast`；`WorldXray` 构造函数支持可选地面亮度并提供 `setGroundLuminance` 方法动态刷新。
  - `src/ui/WorldReplay.ts`: `WorldReplay.play` 增加可选参数 `opts?: { groundLuminance?: number }`；新增 `WRECK_BRIGHTEN_FACTOR_DARK` 常量与 `wreckBrightenFactorFor` 纯函数，暗地面接触前将残骸材质提亮 1.8 倍(原色 0.25 → 0.45)，雪地保持压暗原色，并在 `stop` 时精准恢复原始材质引用。
  - `src/main.ts`: 开局、O 键 X 光开启及每帧更新、死亡回放触发处传入玩家脚下的地面相对亮度。
- **决策**: 地表亮度计算直接复用 `src/data/surfaces.ts` 中各地表的基准显示颜色；残骸在暗地面的提亮通过克隆材质并在回放结束时恢复原始材质实现，不修改 `Vehicle.ts`。
- **待确认**: 无。
