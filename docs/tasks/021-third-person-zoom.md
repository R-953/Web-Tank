# 021-third-person-zoom:第三人称按 Z 放大视角

- 负责:Antigravity(Gemini 3.8 Flash High;车道:界面)
- 状态:已合并
- 分支:`task/021-third-person-zoom`
- 规模:S

## 目标

War Thunder 里第三人称也能按放大键(默认 Z)拉近视角,再按一次复原;开镜时同一个键切换瞄准镜倍率。现在 Z 只在开镜时有用。做完后:第三人称按 Z 视场收窄、再按复原,开镜行为不变。

## 背景与参考

- 相机:`src/engine/OrbitCamera.ts`。`fov` 取值、`setThirdPerson()` / `setSight()`、`rotate()` 里灵敏度随视场缩放(`scaleWithZoom`)都在这里。
- 按键处理:`src/main.ts` 的「1. 瞄准镜 / 弹种 / 维修 / 灭火 等按键」一段(约 467–491 行),`zoomCycle` / `zoomIn` / `zoomOut` 现在只改 `zoomIndex`;底部操作提示在 `hints()`(约 401 行)。
- 键位表:`src/data/controls.ts` 的 `zoomCycle`(名称「循环切换瞄准镜倍率」,默认 Z)。

## 允许修改的文件

- 修改:`src/engine/OrbitCamera.ts`
- 修改:`src/main.ts`(**只改**上面说的按键处理那几行和 `hints()` 里的文字,负责人已同意)
- 修改:`src/data/controls.ts`(**只改** `zoomCycle` 的 `name`,id 和默认键位不动,否则玩家存的键位会失效)
- 新增:`tests/third-person-zoom.test.ts`、`changelog.d/<日期>-021-third-person-zoom.md`

## 接口 / 数据约定

```ts
// OrbitCamera.ts
/** 第三人称放大后的垂直视场,度 */
export const THIRD_PERSON_ZOOM_FOV: number;

class OrbitCamera {
  /** 第三人称是否处于放大状态;setSight() / setThirdPerson() 时复位为 false */
  thirdZoomed: boolean;
  /** 第三人称下切换放大;开镜时调用无效果 */
  toggleThirdZoom(): void;
}
```

- `fov`:第三人称放大时返回 `THIRD_PERSON_ZOOM_FOV`,否则不变。
- 灵敏度:第三人称放大时也按视场缩放(和开镜一样受 `scaleWithZoom` 控制),放大后鼠标不会显得「太灵」。
- 视场取值:先查 War Thunder 第三人称放大的视场(wiki 或游戏设置说明)。查到就用并注明「War Thunder 值」;查不到用 **35°(约 2 倍,估算)**,注释里写明「估算:按 2 倍放大取 70° 的一半」。
- `main.ts`:没开镜时,`zoomCycle` 切换第三人称放大,`zoomIn` 放大、`zoomOut` 复原;开镜时三个键的行为保持现状。阵亡时(`!alive`)复位。
- `controls.ts`:`zoomCycle` 的名称改成「放大视角 / 切换瞄准镜倍率」;`hints()` 里的「倍率」改成「放大 / 倍率」。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 新测试 `tests/third-person-zoom.test.ts`:第三人称切换后 `fov` 在 70 和放大值之间来回;`setSight()` 后再 `setThirdPerson()` 放大状态已复位;开镜时 `toggleThirdZoom()` 不改变 `fov`;放大时同样的鼠标位移转动角度按视场比例变小(`scaleWithZoom` 开着时)
- [x] 已有测试全部不变地通过

## 不做

- 第三人称滚轮拉远拉近(滚轮已经是表尺)
- 自由视角(C)和放大的组合效果,保持各自现状即可

## 结果(完成后由执行者填写)

- 改动文件:
  - `src/engine/OrbitCamera.ts`:导出常量 `THIRD_PERSON_ZOOM_FOV = 35`(估算:按 2 倍放大取 70° 的一半);新增 `thirdZoomed`、`setThirdZoom()`、`toggleThirdZoom()`;`fov` 属性在第三人称放大时返回 35°;`setSight()` / `setThirdPerson()` 复位放大状态为 false;`rotate()` 在第三人称放大且 `scaleWithZoom` 开启时按视场比例缩放转动灵敏度
  - `src/main.ts`:未开镜时 `zoomCycle` 切换第三人称放大、`zoomIn` 放大、`zoomOut` 复原;阵亡时(`!alive`)复位第三人称放大状态;`hints()` 中按键提示由「倍率」改为「放大 / 倍率」
  - `src/data/controls.ts`:将 `zoomCycle` 的名称修改为「放大视角 / 切换瞄准镜倍率」(保持 id 和默认键位不变)
  - `tests/third-person-zoom.test.ts`:新增测试套件,覆盖视场切换、开镜复位、开镜防误触、视场缩放灵敏度及精准控制
  - `changelog.d/2026-10-01-021-third-person-zoom.md`:新增开发日志
- 命令与结果:
  - `npm run lint`:通过 (tsc --noEmit 无错误)
  - `npm test`:通过 (26 个测试文件, 261 个测试全部通过)
  - `npm run build`:通过 (tsc && vite build 生产构建成功)
- 偏差 / 未完成 / 待决定:无

