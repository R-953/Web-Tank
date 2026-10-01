# 024-hangar-camera-walls:机库镜头拉远时穿墙

- 负责:Antigravity(Gemini 3.8 Flash High;车道:界面)
- 状态:已完成
- 分支:`task/024-hangar-camera-walls`
- 规模:S

## 目标

机库里滚轮把镜头拉到最远时,镜头会跑到墙外,画面只剩墙的背面(一片黑)。War Thunder 的机库镜头不会穿墙。做完后:任何朝向、任何缩放下镜头都留在厂房里面。

## 背景与参考

- `src/ui/menu/Hangar.ts`:镜头绕 `target` 转(`yaw` / `pitch` / `radius`,滚轮把 `radius` 限制在 6.5–20,`pitch` 0.02–0.6),位置在 `updateCamera()` 里算。
- 厂房在 `buildShed()`:后墙中心 z = -15、两侧墙 x = ±17(厚 0.4),立柱(0.45 见方)在 x = ±16.5、z = -14.5,屋架底面约 y = 10.25,吊灯约 y = 10.1;前面(+z)没有墙,地面一直铺到 ±40,远处靠雾(24–60 m)融进背景。
- 拉到最远(20 m)、俯仰到最大(0.6)时,镜头高度约 12.6 m,也会高过墙顶。

## 允许修改的文件

- 修改:`src/ui/menu/Hangar.ts`
- 新增:`tests/hangar-camera.test.ts`、`changelog.d/<日期>-024-hangar-camera-walls.md`

## 接口 / 数据约定

```ts
// Hangar.ts
/** 镜头可以待的范围(厂房内表面再往里留余量):x ∈ [-halfWidth, halfWidth],z ≥ back,y ≤ ceiling */
export const HANGAR_ROOM: { halfWidth: number; back: number; ceiling: number };

/**
 * 从 target 沿 dir(单位向量,指向镜头)出发,镜头最远能放多远而不出 HANGAR_ROOM。
 * 返回 min(radius, 到边界的距离)。
 */
export function fitRadius(target: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, radius: number): number;
```

- `HANGAR_ROOM` 从墙、立柱、屋架的位置算出来(各留约 0.4 m 余量),`buildShed()` 里的墙和立柱位置改成引用同一组常量,以后挪墙不会忘了改镜头。
- `updateCamera()` 用 `fitRadius` 收缩实际距离;玩家设定的 `radius` 本身不变(转回空旷方向时镜头会自己退回去)。
- 前方(+z)没有墙,不限制。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 新测试 `tests/hangar-camera.test.ts`:朝后墙、朝两侧墙、朝上的方向,`radius` = 20 时算出的镜头位置都在 `HANGAR_ROOM` 以内;朝 +z(敞开的一面)时不收缩;任何方向的返回值都 ≤ 输入的 `radius`
- [x] 已有测试全部不变地通过

## 不做

- 镜头和载具本身的碰撞(最小距离 6.5 m 先不动)
- 给厂房加前墙、屋顶

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改: `src/ui/menu/Hangar.ts`
  - 新增: `tests/hangar-camera.test.ts`
  - 新增: `changelog.d/2026-10-01-024-hangar-camera-walls.md`
  - 修改: `docs/tasks/024-hangar-camera-walls.md`
- 命令与结果:
  - `npm run lint`: 通过 (0 error)
  - `npm test`: 通过 (26 个测试文件, 264 个测试全部通过)
  - `npm run build`: 通过 (生产构建成功)
- 偏差 / 未完成 / 待决定: 无
