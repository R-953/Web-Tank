### 024 机库镜头拉远时穿墙(Antigravity)

- **新增 / 变更 / 修复**:
  - `src/ui/menu/Hangar.ts`: 抽取厂房墙体、立柱、屋架结构尺寸常量,导出 `HANGAR_ROOM` 边界与 `fitRadius` 视距收缩函数;在 `updateCamera()` 中收缩实际镜头距离,防止滚轮拉远或俯仰时镜头穿过后墙、两侧墙或屋架。
  - `buildShed()` 中的墙体、立柱与屋架改为引用同一组结构常量。
  - 新增 `tests/hangar-camera.test.ts`: 测试后墙、侧墙、屋架收缩,正前方 (+z) 敞开面不收缩,任意方向返回值均 <= 输入 radius,以及 HangarScene 集成测试。
- **决策**: `HANGAR_ROOM` 基于厂房最内侧障碍(立柱内侧面与屋架底面)各留约 0.4 m 余量计算,朝 +z 开放方向不做限制,玩家调整视角到开阔方向时视距自然还原。
- **待确认**: 无
