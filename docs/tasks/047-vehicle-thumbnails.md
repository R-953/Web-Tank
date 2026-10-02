# 047-vehicle-thumbnails:载具缩略图(用真实模型渲染)

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/047-vehicle-thumbnails`
- 规模:M
- 和 048、049、050、051、052 并行;改的文件不重叠(`styles.ts` 的约定见下)

## 目标

负责人 10-02 测试反馈:编组栏、科技树等处所有载具用的都是同一种「简笔画坦克」剪影(`silhouette()`)。改成每辆载具用自己的 3D 模型渲染一张缩略图,参考 War Thunder 编组栏:卡片里是车辆的 3/4 角度抠图,车头朝画面左侧。

## 背景与参考

- 模型:`buildVehicleModel(spec, parts)`(`src/game/models/index.ts`);机库怎么搭模型、摆炮塔,看 `HangarScene.setVehicle`(`src/ui/menu/Hangar.ts`)和 `applyGunPose`。
- 剪影:`silhouette()` 在 `LineupBar.ts` 和 `MainMenu.ts` 各有一份(`MainMenu` 里那份只在没有存档时用,不动)。
- 占位:主程已经放了 `src/ui/menu/thumbnails.ts`,里面的 `vehicleThumbnail` 永远返回 `null`。**048(地图界面)已经按这个签名调用它,签名不能改。**

## 要做的事

1. **实现 `thumbnails.ts`**(替换占位):
   - `vehicleThumbnail(spec: VehicleSpec): string | null`:返回 PNG data URL(透明背景),同一辆车只渲染一次(按 `spec.id` 缓存);没有 WebGL(jsdom、无 GPU)或渲染失败时返回 `null`,不抛错,也不重复尝试。
   - 内部懒创建一个**独立的离屏** `THREE.WebGLRenderer`(`alpha: true`、`antialias: true`),像素尺寸 `THUMB_SIZE = { width: 320, height: 180 }`(显示时按 CSS 缩小,高 DPI 才清晰)。场景:半球光 + 一盏主方向光 + 一盏补光,背景透明,不要机库厂房。
   - 视角:车头朝画面左侧并略朝向镜头,露出车体左侧;相机方向与车头夹角约 35°–55°,俯角约 12°,视场约 28°。
   - 摆放:炮塔朝前、炮管水平(`applyGunPose(…, 0, 0)`)、行走机构静止。渲染完 dispose 模型的几何体和材质。
   - 纯函数 `thumbnailFraming(bounds, aspect, fovDeg, azimuthDeg, pitchDeg)`:`bounds = { min: Vec3, max: Vec3 }`(模型包围盒),返回 `{ position: Vec3, target: Vec3 }`,保证整车完整落在画面内、左右各留约 4% 边距。
   - 导出 `clearThumbnails()`(测试和释放用)。
2. **接到界面上**。有缩略图时用 `<img>`,返回 `null` 时保持现在的剪影,行为不变:
   - 编组栏卡片(`LineupBar.ts` 的 `.mm-lineup-slot-sil`):用缩略图替换 100 px 的剪影;车名、类型符号、等级、车组编号的位置不变。
   - 科技树车辆卡片(`TechTree.ts`,单车卡片和车族展开项都要):车名上方加缩略图(宽约 100–120 px),卡片整齐,高度随之增加。
   - 信息卡(`VehicleCard.ts`):标题上方加一张铺满卡片宽度的缩略图(`.vc-image`),没有缩略图时不留空位。
3. **样式**:只改 `styles.ts` 里自己组件那一段,新规则放在该组件现有规则的紧后面,**不要追加到文件末尾**(其他卡并行改 `styles.ts`,都追加到末尾会冲突)。

## 允许修改的文件

- 修改:`src/ui/menu/thumbnails.ts`、`src/ui/menu/LineupBar.ts`、`src/ui/menu/TechTree.ts`、`src/ui/menu/VehicleCard.ts`、`src/ui/menu/styles.ts`(见上)
- 修改测试:`tests/` 下相关文件(只增不删);新增 `tests/thumbnails.test.ts`
- 新增:`changelog.d/<日期>-047-vehicle-thumbnails.md`

## 接口(定死)

```ts
// src/ui/menu/thumbnails.ts
export const THUMB_SIZE: { readonly width: 320; readonly height: 180 };
export function vehicleThumbnail(spec: VehicleSpec): string | null;
export function clearThumbnails(): void;
export function thumbnailFraming(
  bounds: { min: Vec3; max: Vec3 }, aspect: number, fovDeg: number, azimuthDeg: number, pitchDeg: number,
): { position: Vec3; target: Vec3 };
```

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 测试:`thumbnailFraming`(各种尺寸的包围盒都完整落在画面内;更长的车不比更短的车占画面更小);jsdom 里 `vehicleThumbnail` 返回 `null` 且不抛错、不重复尝试;`LineupBar` / `TechTree` / `VehicleCard` 在 `vehicleThumbnail` 被 mock 成返回 data URL 时渲染出 `<img>`,返回 `null` 时退回剪影
- [ ] 主程会在浏览器里看:8 辆车的缩略图各不相同、完整入画、车头朝向一致、颜色不发黑

## 不做

- `MapScreen`(048 做)、`main.ts`;不改模型本身;不做动画缩略图;不做模型加载进度条。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
