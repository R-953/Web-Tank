# 022-sight-azimuth-range:瞄准镜顶部改为方位角,距离读数移到准星右下

- 负责:Antigravity(Gemini 3.8 Flash High;车道:界面)
- 状态:已完成
- 分支:`task/022-sight-azimuth-range`
- 规模:S

## 目标

按 War Thunder 的开镜画面改两处:

1. 顶部现在是随表尺移动的距离刻度带,WT 在这个位置显示的是**方位角**刻度(纯数字,不带单位)。换成方位角刻度带。
2. 表尺距离改成文字读数「距离:<米数>」(数字不带单位,例如「距离:0」「距离:800」),默认放在**分划中心(瞄准点)的右下方**。

## 背景与参考

- 瞄准镜画面:`src/ui/SightOverlay.ts`。顶部刻度带是 `drawRangeScale`,`draw()` 末尾调用;输入是 `SightState`。
- `src/main.ts` 约 617 行的 `sight.draw({...})` 传入 `SightState`。相机水平朝向是 `orbit.yaw`(弧度,0 = 看向 -Z,正值向左转,见 `src/engine/OrbitCamera.ts`)。
- 方位角的「北」以小地图为准:先看 `src/ui/Minimap.ts` 怎么画玩家朝向和视角(`heading` / `view`),方位角 0 = 小地图正上方,顺时针增加,范围 0–359。
- **同时在做的 017** 也在改 `SightOverlay.ts`(加美式分划 `drawUS`)。只动 `drawRangeScale`、`draw()` 末尾和 `SightState`,不要碰 `drawGerman` / `drawSoviet`,方便合并。

## 允许修改的文件

- 修改:`src/ui/SightOverlay.ts`
- 修改:`src/main.ts`(**只改** `sight.draw({...})` 这一处,加方位角,负责人已同意)
- 新增:`tests/sight-azimuth.test.ts`、`changelog.d/<日期>-022-sight-azimuth-range.md`

## 接口 / 数据约定

```ts
// SightOverlay.ts
export interface SightState {
  // ……已有字段不变
  /** 视线方位角,度,0–360,0 = 小地图正上方,顺时针增加 */
  azimuth?: number;
}

/** 相机 yaw(弧度,0 = 看向 -Z,正值向左)→ 方位角(度,0–360) */
export function azimuthFromYaw(yaw: number): number;

/** 顶部方位刻度带上要画的刻度:center 为当前方位角,halfSpan 为左右各显示多少度 */
export function azimuthTicks(center: number, halfSpan: number): Array<{ deg: number; offset: number; major: boolean; label: string | null }>;
```

- 方位刻度带:每 5° 一个短刻度,每 15° 一个长刻度并标数字(0、15、30 …… 345,不带「°」);能查到 WT 的刻度间隔就按 WT 的来,并注明「War Thunder 值」。中间一个固定指针,左右各显示约 30°。`offset` 为相对中心的度数(左负右正),跨 0 / 360 时要连续。
- 删掉 `drawRangeScale` 和 `RANGE_SPACING_PX`,改成 `drawAzimuthScale`。
- 距离读数:「距离:」用全角冒号,后接表尺米数(整数),字号、颜色与分划一致,左上角放在瞄准点右下方约 (+3 密位, +3 密位) 处,换倍率时跟着 `mil` 缩放位置但字号不变。
- `draw()` 的重绘判断(`key`)要包含方位角(取整到 0.1° 即可,避免每帧都重画)。
- 底部 HUD 装填栏里的表尺读数不动。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 新测试 `tests/sight-azimuth.test.ts`:`azimuthFromYaw(0)` = 0;向右转 90°(yaw = -π/2)= 90;`azimuthFromYaw` 结果永远在 [0, 360);`azimuthTicks(355, 30)` 里有 deg = 0 的长刻度且 label = "0",offset = 5;每个长刻度的 deg 都是 15 的倍数
- [x] 已有测试全部不变地通过

## 不做

- 自定义瞄具(负责人说后期再做,已记进看板「已规划」)
- 第三人称画面的方位角
- 底部 HUD 的改动

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改:`src/ui/SightOverlay.ts`
  - 修改:`src/main.ts`
  - 修改:`docs/tasks/022-sight-azimuth-range.md`
  - 新增:`tests/sight-azimuth.test.ts`
  - 新增:`changelog.d/2026-10-01-022-sight-azimuth-range.md`
- 命令与结果:
  - `npm run lint`: 通过 (tsc --noEmit 无错误)
  - `npm test`: 通过 (26 个测试文件全部通过,共 263 个用例通过)
  - `npm run build`: 通过 (tsc && vite build 正常构建)
- 偏差 / 未完成 / 待决定:
  - 无偏差。SightState 中的 `azimuth` 设置为可选字段 `azimuth?: number`,既符合 AGENTS.md「只加可选字段」的约定,又使得 `src/main.ts` 中 `backToHangar()` 的 `sight.draw({ active: false, ... })` 无需额外改动,严格落实了只修改 `main.ts` 约 617 行这一处的要求。
