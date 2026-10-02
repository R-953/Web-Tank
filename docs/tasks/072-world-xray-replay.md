# 072-world-xray-replay:在世界里直接给车开 X 光(O 键)+ 叠在世界里的死亡回放

- 负责:Antigravity(3.8 Flash High)
- 状态:已合并(第十二轮)
- 分支:`task/072-world-xray-replay`
- 规模:L
- 并行:071 把共用的内构模型(`src/ui/internalsModel.ts`)做成真实实现,本卡**按主程已放好的接口**(现在是占位实现,内构是空的)写代码,测试里不要依赖内构的具体样子;068、069、070、073 互不依赖
- **只新增文件**:`src/ui/WorldXray.ts`、`src/ui/WorldReplay.ts` 和测试。**不要改** `Vehicle.ts`、`Game.ts`、`main.ts`(接线是下一波的任务 074,由它处理相机交接、O 键、触发时机);需要 `Vehicle` 多开放什么,在回报里写出来

## 目标

负责人给的 War Thunder 录屏最后一段、以及 10-03 的要求:

1. **O 键内构显示**不再是画在车左边的小窗,而是**直接在当前这辆车上开 X 光**:车体外壳变成半透明灰壳,里面显示每个模块和每个乘员的实时状态(`WorldXray`)。
2. **自己被击毁的回放**不再是全屏的独立场景,而是**叠在游戏世界里**:自己的残骸变 X 光,弹道是一条细青绿线,弹着点是橙色半透明圆盘 + 向外扩散的圆环,受损部位红色高亮,主相机绕着残骸缓慢环绕(`WorldReplay`)。设计要点见 `docs/design/killcam.md` 第 6 条。

## 接口(主程写死,不要改形状)

```ts
// src/ui/WorldXray.ts
import type { InternalsSnapshot } from '../game/internalsSnapshot';
/** Vehicle 满足这个形状(只用这三个节点) */
export interface XrayVehicle { root: THREE.Group; turretPivot: THREE.Group; gunPivot: THREE.Group }
export class WorldXray {
  constructor(vehicle: XrayVehicle);
  readonly enabled: boolean;
  enable(s: InternalsSnapshot): void;   // 外壳变半透明灰壳 + 轮廓线,内构挂到车上并显示
  update(s: InternalsSnapshot): void;   // 每帧调用:内构着色、乘员位置
  setFade(k: number): void;             // 0 = 真实外壳、无内构;1 = 完全 X 光。回放里做「接触后褪成灰壳」用
  disable(): void;                      // 还原所有材质、摘掉内构、释放克隆
}

// src/ui/WorldReplay.ts
import type { HitReplay } from '../game/Game';
export class WorldReplay {
  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, overlayHost: HTMLElement);
  readonly active: boolean;
  readonly finished: boolean;           // 播完了(接线那边据此弹结算画面)
  play(vehicle: XrayVehicle, replay: HitReplay, nowMs: number): void;
  update(nowMs: number): void;          // 推进时间线、摆好 camera(渲染前调用)
  stop(): void;                         // 清理一切,还原外壳
}
```

## 要做的事

### WorldXray
- 遍历 `vehicle.root` 下所有 `Mesh` / `InstancedMesh`,**把每个 mesh 的材质换成克隆**(`transparent = true`、`depthWrite = false`),原材质引用存起来,`disable()` 时原样换回、克隆 `dispose`(`Vehicle.becomeWreck` 会直接改原材质颜色,所以不要改原材质对象,只换 mesh 上的引用)。外壳在 `setFade(1)` 时:颜色往中性灰(约 `0x8a9399`)混、不透明度约 0.12,并给主要大部件(车体、炮塔、炮管)加白色半透明轮廓线(`EdgesGeometry`,面数很多的 mesh 别加,控制帧耗)。
- 内构用 `buildInternalsModel`(`src/ui/internalsModel.ts`):`hullMount` 加进 `vehicle.root`,`turretMount` 加进 `vehicle.turretPivot`,`gunMount` 加进 `vehicle.gunPivot`;`update(s)` 转调 `model.update(s)`,`setFade(k)` 里内构不透明度也跟着 `k`。
- 纯函数导出并测试:`xrayShellStyle(k)` → `{ opacity, grayMix, edgeOpacity }` 之类。

### WorldReplay
时间线沿用 `src/ui/KillCam.ts` 的 `killcamDuration(replay)`(`tContact` / `tEffectEnd` / `total`),模块和乘员的血量时间线用 `src/ui/killcamOverlay.ts` 的 `ratioAt`(两者都已存在):

1. **相机**(纯函数 `worldReplayCameraPose(t, replay, bounds)` → `{ position, target }`,导出并测试):以残骸的包围盒中心为中心,起点在弹道射来的一侧稍高处看向弹着点;接触后沿 `KILLCAM_ORBIT_DEGREES` / `KILLCAM_ORBIT_DIRECTION`(`KillCam.ts` 里已有)缓慢环绕,距离约 2.2 倍包围盒半径,结束前略微拉远。相机只在回放期间被本类控制,`stop()` 后交还。
2. **弹道线**:一条细青绿线(约 `0x39e6c4`),从射来方向的远处(沿 `-replay.dir`,长约 8 m)延伸到弹着点,击穿后继续在车内延伸到弹道终点(用 `replay.penetration` 里的轨迹,没有就取 `dir` 方向 2–3 m);按 `APPROACH` 时间从远处「射」过来。坐标:`replay.entry` / `dir` / `normal` 是车体本地坐标,用 `vehicle.root.localToWorld` 换到世界。
3. **弹着标记**:接触点一个橙色(`0xff8a1f`)半透明圆盘(贴在装甲面上,朝向命中面法线 `replay.normal`),带两圈向外扩散并淡出的圆环,约 0.6 s。跳弹 / 未击穿也画(死亡回放一般是击穿,但函数要都能处理)。
4. **受损部位红色高亮**:被打中的模块 / 乘员随时间变红(内构的 `update` 用 `ratioAt` 算出的快照),另外给受损模块加红色半透明轮廓盒子。
5. **外壳过渡**:接触后 0.2 s 内 `WorldXray.setFade` 0 → 1;结束时淡回。回放期间**游戏世界继续显示**(敌车、地形不隐藏、不调暗)。
6. **文字层**:用 `KillCamOverlay`(`src/ui/killcamOverlay.ts`)盖在整个画面上,`overlayHost` 里建一个铺满屏幕的容器;顶部文字、模块图标、乘员数沿用,标题随调用方,本类不设标题。
7. 播完(`total` 过后)`finished = true`,`active` 仍为 true 直到 `stop()`。

纯函数(`worldReplayCameraPose`、弹道线端点、圆盘 / 圆环随时间的半径和不透明度、淡入淡出系数)写成不依赖 Three 场景的函数,放在 `WorldReplay.ts` 里导出并写单元测试;类本身用 jsdom + 一个 `THREE.Scene` 做冒烟测试(`play` → `update` 几步 → `stop`,场景里新增的对象在 `stop` 后全部被移除、材质还原)。

## 背景与参考

- `src/game/Vehicle.ts`:`root`、`turretPivot`、`gunPivot`、`becomeWreck()`;`src/game/internalsSnapshot.ts`(`InternalsSnapshot`,`internalsSnapshot(vehicle)`);回放里用的快照可以由 `HitReplay.layout` + `ratioAt` 拼出来;`src/ui/KillCam.ts`(`killcamDuration`、`killcamCameraRig`、`killcamBounceDir`、`APPROACH` 等时间常量、弹着标记和弹道的现成做法)——能复用的导出函数直接用,**不要复制粘贴一份**;需要而没导出的,在 `KillCam.ts` 里加 `export`(只加 export,别改行为)。
- `docs/design/killcam.md`:录屏逐帧整理出的设计要点。

## 允许修改的文件

- 新增:`src/ui/WorldXray.ts`、`src/ui/WorldReplay.ts`、`tests/world-xray.test.ts`、`tests/world-replay.test.ts`、`changelog.d/<日期>-072-world-xray-replay.md`
- 修改:`src/ui/KillCam.ts`(**只加 `export`**)、本卡「结果」一节

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过,既有测试一个不改
- [x] `WorldXray`:`enable` → 每个 mesh 的材质被换成克隆且 `transparent`;`disable` → 全部是原来的对象;`setFade(0/0.5/1)` 的外壳不透明度符合 `xrayShellStyle`;重复 `enable` / `disable` 不泄漏(场景里子节点数不变)
- [x] `WorldReplay`:`worldReplayCameraPose` 的单元测试(起点在弹道射来一侧、环绕角度随时间单调、结束时距离略增);冒烟测试 `play → update → stop` 之后场景干净
- [x] 回报里列出接线(074)需要知道的事:相机怎么交接、需要 `Vehicle` 额外提供什么

## 不做

- 不接 `main.ts`、不做设置项、不改 `Vehicle` / `Game`;不做 3D 之外的结算画面逻辑。

## 结果(完成后由执行者填写)

- 改动文件:
  - 新增: `src/ui/WorldXray.ts`、`src/ui/WorldReplay.ts`、`tests/world-xray.test.ts`、`tests/world-replay.test.ts`、`changelog.d/2026-10-03-072-world-xray-replay.md`
  - 修改: `src/ui/KillCam.ts` (仅加 `export` 关键字导出 `APPROACH`、`FADE_IN`、`FADE_OUT`、`EFFECT_TAIL`、`FINISH_DELAY` 及 `computeVehicleBounds`)、`docs/tasks/072-world-xray-replay.md`
- 命令与结果:
  - `npm run lint`: 通过，TypeScript 严格检查无任何错误
  - `npm test`: 通过，84 个测试套件全部通过 (共 900 项测试通过)
  - `npm run build`: 通过，Vite 构建生产包顺利完成
- 偏差 / 未完成 / 待决定:
  - 无偏差，任务卡所有目标均已完成。
  - 给任务 074 接线人员的说明:
    1. **相机交接机制**: `WorldReplay.update(nowMs)` 会直接驱动外部传入的 `PerspectiveCamera` 的 `position` 与 `lookAt(target)`。074 在调用 `worldReplay.play(playerVehicle, replay, nowMs)` 时，主循环或输入系统应暂时挂起跟随相机的更新；待 `worldReplay.finished === true` 且调用 `worldReplay.stop()` 之后，再恢复常规相机的控制权。
    2. **Vehicle 依赖需求**: 仅需 `Vehicle` 提供现有的 `root: THREE.Group`、`turretPivot: THREE.Group` 和 `gunPivot: THREE.Group`。内构挂载、世界坐标变换 (`localToWorld` / `transformDirection`) 以及包围盒计算均已自包含，不需要 `Vehicle` 开放额外新接口。

