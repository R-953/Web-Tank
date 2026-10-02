# 049-smooth-zoom:Z 键放大、开镜和切换倍率时视场平滑过渡

- 负责:Antigravity(3.8 Flash High)
- 状态:待审查(主程已审,等负责人合并)
- 分支:`task/049-smooth-zoom`
- 规模:S
- 和 047、048、050、051、052 并行;改的文件不重叠

## 目标

负责人 10-02 测试反馈:按 Z 放大视角是瞬间跳变,不是平滑的。查代码:`OrbitCamera.applyFov()` 直接 `camera.fov = this.fov`,021 号卡写的「平滑切换」其实没有做。要求:第三人称放大 / 还原、开镜 / 关镜、切换瞄准镜倍率时,视场都在约 0.15 秒内平滑过渡,手感接近 War Thunder。

## 背景与参考

- `src/engine/OrbitCamera.ts`:`fov` 是 getter,返回**目标**视场(第三人称 70° / 放大 35° / 瞄准镜 `SIGHT_FOV_AT_1X / 倍率`);`setThirdPerson`、`setSight`、`setThirdZoom` 改目标并调用 `applyFov()`;灵敏度缩放用 `this.fov`。
- 已有测试:`tests/third-person-zoom.test.ts`。
- 调用方 `src/main.ts`(主程维护,不要改):`orbit.update(target, heightAt, sightPos)`,`sight.draw({ fovDeg: orbit.fov, … })`。

## 要做的事

1. 新增「显示视场」`displayFov`(getter),`camera.fov` 每次 `update` 时设为它,向目标视场做**帧率无关**的指数趋近:`displayFov += (target − displayFov) × (1 − exp(−dt / FOV_TAU))`,`FOV_TAU = 0.06` s(约 0.15 s 走完 90%)。导出常量 `FOV_TAU`。
2. `update(target, groundHeightAt?, sightPosition?, dt = 1 / 60)`:增加**可选**的第四个参数 `dt`(秒);主程会在合并后让 `main.ts` 传入真实的帧间隔。不传时按 1/60 算。
3. `fov` getter 保持返回目标视场(游戏逻辑 / 瞄准镜遮罩以后由主程改用 `displayFov`);灵敏度缩放(`scaleWithZoom`)改用 `displayFov`,这样过渡期间屏幕上的转动速度保持恒定。
4. 新增 `snapFov()`:把 `displayFov` 直接设为目标值,不做过渡。`setThirdPerson()`、`setSight()`、`setThirdZoom()` **不**调用它(要平滑);构造时和 `reset` 类场景由主程在需要时调用 `snapFov()`(开局重置视角时)。
5. 过渡期间 `camera.updateProjectionMatrix()` 要在 `fov` 变化时调用;`displayFov` 与目标差小于 0.01° 时直接吸附,不再每帧更新投影矩阵。

## 允许修改的文件

- 修改:`src/engine/OrbitCamera.ts`
- 修改测试:`tests/third-person-zoom.test.ts`(只增不删,旧断言如果因为「不再瞬间跳变」必须改,在结果里逐条说明);新增 `tests/orbit-smooth-fov.test.ts`
- 新增:`changelog.d/<日期>-049-smooth-zoom.md`

## 接口(定死)

```ts
export const FOV_TAU = 0.06;
class OrbitCamera {
  get fov(): number;            // 目标视场(不变)
  get displayFov(): number;     // 当前显示的视场
  update(target, groundHeightAt?, sightPosition?, dt?: number): void;
  snapFov(): void;
}
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 测试:按 Z 后 `displayFov` 单调趋近 35°、不过冲;0.5 s 内到达目标的 99% 以内;帧率无关(dt = 1/30 与 dt = 1/120,在 t = 0.2 s 时的差小于 0.05°);开镜 70° → 瞄准镜视场同样平滑;`snapFov()` 立即到位;灵敏度缩放在过渡期间连续变化;目标不变时不再更新投影矩阵
- [ ] 主程会在浏览器里按 Z 看手感

## 不做

- `main.ts`(传 `dt`、瞄准镜遮罩改用 `displayFov` 由主程做);不改 `FreeLook`;不改镜头位置 / 距离的变化(只做视场)。

## 结果(完成后由执行者填写)

- 改动文件:
  - `src/engine/OrbitCamera.ts` (修改): 增加导出常量 `FOV_TAU = 0.06`、`displayFov` getter、`snapFov()` 方法、`update(..., dt = 1 / 60)` 指数趋近与吸附逻辑; 灵敏度计算过渡期跟随 `displayFov`; 移除 `setThirdPerson`/`setSight`/`setThirdZoom` 中的瞬变调用。
  - `tests/third-person-zoom.test.ts` (修改): 未删除任何已有断言，仅在需要验证瞬时到位属性及转动前补充 `orbit.snapFov()`，适配平滑过渡新机制。
  - `tests/orbit-smooth-fov.test.ts` (新增): 新增完整测试套件，全面覆盖单调趋近不过冲、0.5s 到达 99% 并吸附、帧率无关(dt=1/30 与 1/120 差异 <0.05°)、开镜/切换倍率/关镜平滑、`snapFov()` 即时性、灵敏度随 `displayFov` 连续变化、目标不变不更新投影矩阵、<0.01° 自动吸附。
  - `changelog.d/2026-10-02-049-smooth-zoom.md` (新增): 记录 049 任务开发日志与决策。
  - `docs/tasks/049-smooth-zoom.md` (修改): 填写验收状态与结果。
- 命令与结果:
  - `npm run lint`: 通过 (0 errors)。
  - `npm test`: 全部通过 (54 test files, 547 tests passed)。
  - `npm run build`: 通过 (TypeScript 与 Vite 构建均成功完成)。
- 偏差 / 未完成 / 待决定:
  - 无偏差。遵照任务卡规定，未修改 `src/main.ts`。主程后续合并后可将真实 `dt` 传给 `orbit.update`，并按需将瞄准镜遮罩绘制视场由 `orbit.fov` 调整为 `orbit.displayFov`。

### 主程审查(Claude Code)

- `main.ts`(主程)接了 `dt`(每帧第一次传真实间隔、同一帧第二次传 0)、瞄准镜遮罩改用 `displayFov`、开局 `snapFov()`。
- 浏览器里给 `orbit.update` 打记录补丁看了轨迹:按 Z 后显示视场从 35° 向 70° 平滑趋近,没有跳变。
