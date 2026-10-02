### 047 载具缩略图(用真实模型渲染)(Antigravity)

- **新增 / 变更 / 修复**:
  - `src/ui/menu/thumbnails.ts`: 实现 `vehicleThumbnail` 离屏渲染(独立 WebGLRenderer, 透明背景, 半球光 + 主方向光 + 补光), 带 `spec.id` 缓存与 WebGL 缺失降级; 实现纯函数 `thumbnailFraming` 计算包围盒自适应视角与距离, 保证整车完整入画且左右留 4% 边距; 导出 `THUMB_SIZE` 与 `clearThumbnails`。
  - `src/ui/menu/LineupBar.ts`: 编组栏卡片 `.mm-lineup-slot-sil` 接入缩略图 `<img>`, 缺失时退回已有剪影。
  - `src/ui/menu/TechTree.ts`: 单车卡片与车族展开项在车名上方展示 100–120 px 缩略图, 缺失时退回剪影。
  - `src/ui/menu/VehicleCard.ts`: 标题上方展示铺满卡片宽度的缩略图 `.vc-image`, 缺失时不留空位。
  - `src/ui/menu/styles.ts`: 分别在科技树、编组栏、信息卡样式规则后补充缩略图样式规则, 不追加到文件末尾。
  - `tests/thumbnails.test.ts`: 新增包围盒入画与边距测试、长短车画面占比测试、jsdom 降级与缓存测试, 以及 LineupBar / TechTree / VehicleCard 的 mock 与 fallback 集成测试。
- **决策**:
  - `thumbnailFraming` 采用视锥体反推投影坐标并通过二分搜索精确定位目标与相机距离, 保证左右各留 4% 边距且全车入画, 避免因包围球算法导致长车被推得过远。
  - 无 WebGL 环境(如 jsdom / 无 GPU)静默返回 `null` 并写入缓存, 避免重复尝试或抛出异常。
- **待确认**: 无
