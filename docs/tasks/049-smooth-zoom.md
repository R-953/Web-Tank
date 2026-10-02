# 049-smooth-zoom:Z 键放大、开镜和切换倍率时视场平滑过渡

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
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

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 测试:按 Z 后 `displayFov` 单调趋近 35°、不过冲;0.5 s 内到达目标的 99% 以内;帧率无关(dt = 1/30 与 dt = 1/120,在 t = 0.2 s 时的差小于 0.05°);开镜 70° → 瞄准镜视场同样平滑;`snapFov()` 立即到位;灵敏度缩放在过渡期间连续变化;目标不变时不再更新投影矩阵
- [ ] 主程会在浏览器里按 Z 看手感

## 不做

- `main.ts`(传 `dt`、瞄准镜遮罩改用 `displayFov` 由主程做);不改 `FreeLook`;不改镜头位置 / 距离的变化(只做视场)。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
