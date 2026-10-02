# 061-killcam-redo:命中回放按负责人的描述重做(规范化方向、环绕相机、内构淡入淡出)

- 负责:Antigravity(3.8 Flash High)
- 状态:已合并(第十轮)
- 分支:`task/061-killcam-redo`
- 规模:M–L
- 和 054–060、062–063 并行;只改 `src/ui/KillCam.ts`(052 的内构窗口只 `import { healthColor }`,不受影响)

## 目标

负责人 10-02 对命中回放(击毁回放)的要求,原话整理如下。画面还是现在的 X 光风格,改的是**镜头**和**内构的显隐**:

1. **炮弹飞行方向规范化为 +X 轴正方向**:不管实际从哪个方向打来,回放里一律把场景转到炮弹沿 +X 飞行。
2. **相机环绕**:相机以**载具模型的几何中点**为原点,从入射开始**逆时针**环绕,**起点是面对 X 轴方向**(相机在炮弹来向的一侧,顺着 +X 方向看),**终点在 Y 轴负方向**(侧面)——即四分之一圆、**90°**(负责人确认过:90°,不是 180°)——直到后效动画播放完毕。
3. **内构淡入**:炮弹**接触模型**时,内构模型(模块盒子、乘员、破片线等 X 光元素)**平滑淡入**。
4. **内构淡出**:炮弹**射出**或**后效完全衰减**后,内构模型**平滑淡出**。

坐标说明:负责人用的是 z 轴向上的数学坐标(x 红、y 绿、z 蓝);游戏里是 y 向上。换算:数学的 z = 游戏的 y;**水平面上**数学的 +X 取为回放坐标系的 +X,数学的 +Y(从上往下看,+X 逆时针转 90° 的方向)对应游戏的 −Z。所以从上往下看(游戏的 +Y 往下看),相机沿 −X → −Y 逆时针转 90°,在游戏坐标里是从 −X 侧转到 +Z 侧。**如果你对方向有疑问,以「从上往下看逆时针、起点在炮弹来向、终点在炮弹左手侧还是右手侧」为准写一条注释说明你的理解,并导出 `KILLCAM_ORBIT_DEGREES` 和 `KILLCAM_ORBIT_DIRECTION`(`1` 或 `-1`)两个常量,方便主程按负责人的录屏微调。**

## 背景与参考

- `src/ui/KillCam.ts`:现在的实现——炮弹在 `APPROACH`(0.8 s)内从画面外飞到击穿点,随后播放 `penetration` 的各段(`seg.t0 / t1`)、破片、爆炸,最后 `HOLD`(3.0 s)里相机绕 Y 轴以 `hold * 0.25` 弧度慢转;车体外壳 `GHOST`(很淡)常驻;模块 / 乘员盒子按血量时间线变色。
- 回放数据 `HitReplay`(`src/game/Game.ts`):车体本地坐标下的 `entry`(入射点)、`dir`(炮弹方向单位向量)、`penetration`(段列表、`duration`)、`layout`(模块和乘员)、`before` / `after`。
- 不要改 `Game.ts`、`main.ts`(主程维护)。`KillCam` 的公开接口(`play`、`stop`、`update`、`render`、`active`、`layout`、`killcamRect`、`healthColor`)不变。

## 要做的事

1. **规范化**:算一个绕垂直轴(游戏 y 轴)的旋转角,使 `replay.dir` 的水平分量指向 +X;只转水平方向,俯仰保持(车体不倾斜)。整个回放场景(车体外壳、模块、乘员、炮弹、破片线)放在一个 `Group` 里统一旋转。炮弹竖直向下(水平分量接近 0)时取旋转角 0。
2. **相机**:原点 = 车体包围盒的几何中心(车体 + 炮塔 + 炮管,用于取景的包围球半径也由它算出;`full` 布局和 `corner` 布局的画面比例不同,取景要都能看全整车)。相机仰角约 15°,距离按包围球和视场算好;**入射前**停在起点(−X 侧顺着 +X 看);从炮弹接触模型的时刻(`t = APPROACH`)起,到后效播完(`APPROACH + (penetration?.duration ?? 0.3) + 后效尾巴`,尾巴取 0.4 s)为止,角度按 smoothstep 从 0 走到 `KILLCAM_ORBIT_DEGREES`;之后回放结束(去掉原来的 `HOLD`,总时长 = 后效结束 + 0.5 s 收尾)。
3. **内构淡入淡出**:模块盒子、乘员、破片线、闪光 / 爆炸球的不透明度乘以一个包络 `internalsOpacity(t)`:接触前为 0;从 `APPROACH` 起 0.25 s 淡入到 1;后效结束时刻起 0.4 s 淡出到 0(「炮弹射出」= 最后一段炮弹轨迹 `shellSeg.t1` 之后且没有别的后效;没有穿透的命中——跳弹 / 未击穿——后效很短,同样按这条规则处理)。车体外壳 `GHOST` 一直在。
4. **纯函数**(导出,写单元测试,不依赖 DOM / WebGL):
   ```ts
   export const KILLCAM_ORBIT_DEGREES = 90;
   export const KILLCAM_ORBIT_DIRECTION: 1 | -1;
   export function killcamNormalizeYaw(dir: { x: number; y: number; z: number }): number; // 使 dir 的水平分量转到 +X 所需的绕 y 轴角度
   export function killcamOrbitAngle(t: number, tImpact: number, tEnd: number, orbitDeg?: number): number; // 弧度,smoothstep
   export function killcamInternalsOpacity(t: number, tContact: number, tEnd: number, fadeIn?: number, fadeOut?: number): number; // 0..1
   ```
5. 已有测试(`tests/` 里和 KillCam 相关的)按新行为更新并在结果里逐条说明;不删、不放宽。

## 允许修改的文件

- 修改:`src/ui/KillCam.ts`
- 修改测试:`tests/` 下 KillCam 相关文件(只增不删);新增 `tests/killcam-redo.test.ts`
- 新增:`changelog.d/<日期>-061-killcam-redo.md`

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 测试:`killcamNormalizeYaw`(四个方向、竖直向下、带俯仰)、`killcamOrbitAngle`(入射前为 0、结束为目标角度、单调、端点斜率平滑)、`killcamInternalsOpacity`(接触前 0、淡入、中间 1、淡出、结束后 0、`fadeIn / fadeOut` 为 0 时不除零)
- [ ] 主程会在浏览器里打一发看回放;负责人可能再给录屏微调方向和时长

## 不做

- `Game.ts` / `main.ts`;不改回放数据结构;不加新的 X 光元素;不改右上角小窗 / 全屏的布局尺寸。

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改: `docs/tasks/061-killcam-redo.md`
  - 修改: `src/ui/KillCam.ts`
  - 新增: `tests/killcam-redo.test.ts`
  - 新增: `changelog.d/2026-10-02-061-killcam-redo.md`
- 命令与结果:
  - `npm run lint`: 通过，0 错误
  - `npm test`: 61 个测试套件，620 个测试全部通过（包含已有测试与新覆盖测试）
  - `npm run build`: 构建成功
- 偏差 / 未完成 / 待决定:
  - 无偏差。已有 `tests/death-killcam.test.ts` 与 `tests/internals-view.test.ts` 无需修改即全数通过。
  - 常量 `KILLCAM_ORBIT_DEGREES = 90` 与 `KILLCAM_ORBIT_DIRECTION = 1` 已导出并带有完整坐标说明注释，便于主程对照负责人录屏微调。

### 主程审查

浏览器里按时间点核对:相机从 -X 侧(180°)逆时针转到 +Z 侧(90°),内构不透明度接触后 0.25 s 淡入、后效结束后 0.4 s 淡出到 0,炮弹射出后不可见。方向和节奏等负责人看过再微调。
