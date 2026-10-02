# 066-killcam-all-hits:命中回放第二版——跳弹 / 未击穿 / 击穿未击毁都出回放,按 War Thunder 的设计重做场景

- 负责:Antigravity(3.8 Flash High)
- 状态:已合并(第十一轮)
- 分支:`task/066-killcam-all-hits`
- 规模:L
- 和 065 并行:文字 / 图标层(`src/ui/killcamOverlay.ts`)由 065 实现,**接口已经由主程放好**(现在是空实现),本卡在 `KillCam.ts` 里直接 `new KillCamOverlay(this.frame)` 使用,测试里不要依赖它的具体行为
- 只改 `src/ui/KillCam.ts`(+ 测试 + 日志)。`main.ts` 的触发时机、设置项由主程做

## 目标

负责人 10-02 给了一段 War Thunder 命中回放录屏(`Archive/1002.mp4`),要求命中回放参照它的设计逻辑改,**跳弹、未击穿、击穿但未击毁也要显示回放**(现在只有击毁才播)。`HitReplay` 对所有主炮命中都有数据(`armor.ricochet` / `armor.penetrated` / `penetration` 为 null 表示没进车内),`KillCam` 已经能容忍 `penetration: null`,现在要把这几种情形各自做好看。主程逐帧看录屏后整理的设计要点:

1. **先看车外,再进 X 光**:炮弹从远处飞向**带真实材质的车外模型**(不是一上来就是半透明灰壳),接触那一刻真实外壳在约 0.2 s 内褪成半透明灰壳 + 白色轮廓线,同时内构淡入(061 已有)。
2. **弹着标记**:接触点出现一个橙色半透明圆盘(贴在装甲面上,朝向命中面法线),带两圈向外扩散并淡出的圆环,约 0.6 s。录屏里被命中的车(无论击穿与否)都有这个标记。
3. **跳弹**:炮弹在接触点被弹开,沿反射方向继续飞出去 0.7 s 左右(轨迹后面拖一条细线),整车保持真实外壳,**不进 X 光、没有内构**;镜头围着弹着点转。
4. **未击穿**:炮弹在接触点被挡下(接触后 0.25 s 内缩小消失,带一个小闪光),留着弹着标记;整车保持真实外壳,没有内构;镜头围着弹着点转。打中履带 / 炮管等外挂模块时,那个模块的盒子淡入并按受损变红。
5. **击穿(没击毁 / 击毁)**:沿用 061 的效果时间线、相机环绕和内构淡入淡出,增加:乘员改成**坐姿人形**(头、躯干、大腿、小腿的简单几何拼成,表面半透明浅蓝灰 + 橙色轮廓线;受伤变红;阵亡近黑),模块颜色改成**按类型着色、受损变红**(录屏里弹药架是黄色、受损 / 爆炸是红色)。
6. **顶部文字、左下图标、右下乘员数**:用 065 的 `KillCamOverlay`;原来左上的文字块(标题 + 击穿 / 阵亡 / 殉爆摘要)保留,但缩小成左上角一小块(12 px),并加一行「等效装甲 x mm / 穿深 y mm / 入射角 z°」(`armor` 为 null 时不显示)。

## 背景与参考

- `src/ui/KillCam.ts`(061 的成果):`APPROACH`(0.8 s)、`FADE_IN` / `FADE_OUT` / `EFFECT_TAIL` / `FINISH_DELAY`、`killcamNormalizeYaw` / `killcamOrbitAngle` / `killcamInternalsOpacity`、`KILLCAM_ORBIT_DEGREES` / `KILLCAM_ORBIT_DIRECTION`、`computeVehicleBounds`、`build` / `animate`、`play` / `stop` / `update` / `render`、`describe`。**公开接口(`play`、`stop`、`update`、`render`、`active`、`layout`、`killcamRect`、`healthColor`)不变**;`healthColor` 继续导出(`InternalsView` 用它)。
- `HitReplay.normal`(新增):命中面外法线,车体本地坐标,单位向量。回放场景整体绕 y 轴转了 `killcamNormalizeYaw(dir)`,所以场景里的法线 = 本地法线绕 y 轴转同样的角度(`root` 的子节点用本地坐标,直接放进 `root` 里就自动跟着转,**不要再手动转**)。
- `buildVehicleModel(spec, parts)`(`src/game/models`)返回 `{ materials }`,现在 `build` 里把所有 mesh 的材质换成了 `GHOST`、把返回的材质 `dispose` 掉了。本卡要**保留**真实材质:每个 mesh 克隆一份材质(`transparent = true`),接触后 0.2 s 内不透明度从 1 → 0.08(`InstancedMesh` 的轮子 / 履带板一起处理),轮廓线 `EDGE` 同步淡入;场景要加一盏平行光(`DirectionalLight`,强度约 2,方向斜上方)和环境光,真实材质才有明暗。`clear()` 要把克隆的材质都 `dispose`。
- 模块着色参考 `InternalsView.ts` 的 `MODULE_TYPE_COLORS`(弹药 0xffaa00、发动机 0x33b5e5、变速箱 0xab47bc、油箱 0xff4081……):完好 = 类型色,血量比例 < 1 时按 `(1 - 比例)` 向红色 `0xff3b30` 插值,≤ 0 = `0x1a1a1a`。写成导出的纯函数 `killcamModuleColor(type, ratio)`。
- 时间线:`ratioAt(replay, id, t, tContact)` 是 065 要实现的纯函数(现在是占位),**本卡里模块 / 乘员的血量时间线继续用 `KillCam.ts` 自己的 `timelineFor`**,不要依赖 065。

## 要做的事

1. **时长**(导出纯函数 `killcamDuration(replay): { tContact: number; tEffectEnd: number; total: number }`,`startItem` 里用它):
   - 击穿类(`penetration` 非 null):`tContact = APPROACH`,`tEffectEnd = APPROACH + (penetration.duration) + EFFECT_TAIL`,`total = tEffectEnd + FINISH_DELAY`(和 061 一致,不变);
   - 跳弹:`tEffectEnd = APPROACH + 1.0`,`total = tEffectEnd + FINISH_DELAY`;
   - 未击穿(含打中炮管):同上。
2. **相机计划**(导出纯函数 `killcamCameraRig(replay, center, radius, entry): { target: Vector3; distanceScale: number; orbitDeg: number }`,`animate` 里用它):击穿类 = `target: center`、`distanceScale: 1`、`orbitDeg: KILLCAM_ORBIT_DEGREES`(061 的行为不变);跳弹 / 未击穿 = `target: entry`(场景坐标系里的弹着点)、`distanceScale: 0.75`、`orbitDeg: KILLCAM_ORBIT_DEGREES / 2`。距离仍按 `boundingRadius * 1.15 / min(sin(fovY/2), sin(fovX/2)) * distanceScale` 算。
3. **跳弹方向**(导出纯函数 `killcamBounceDir(dir, normal): Vector3`):`r = d − 2 (d·n) n`,单位化;`n` 要朝着来弹一侧(`d·n > 0` 时先取反),掠射角大时 `r` 几乎沿原方向、垂直命中时几乎反向。
4. **弹着标记**:`CircleGeometry` + 两个 `RingGeometry`,`MeshBasicMaterial` 橙色 `0xffa000`(`transparent`、`depthWrite: false`、`side: DoubleSide`),位置 = `entry + normal * 0.03`,朝向让 +Z 对齐 `normal`(`quaternion.setFromUnitVectors`),半径 = `max(0.2, caliber / 1000 * 3)`;接触起 0.6 s 内圆盘不透明度 0.55 → 0、圆环半径 1 → 2.2 倍并淡出。所有结果都画。
5. **真实外壳 → 灰壳**:见背景。**跳弹 / 未击穿不褪成灰壳**(整段保持真实材质),也没有内构;只有击穿类才褪。
6. **炮弹**:放大系数从 2.5 改成按车体大小定(`boundingRadius * 0.12`,最小 2.5);后面拖一条细线(`THREE.Line`,最近 0.4 s 的位置,颜色 `0xffd9a0`)。跳弹:接触后沿 `killcamBounceDir` 方向飞 0.7 s(速度恒定约 `boundingRadius * 1.5` / s),末 0.3 s 淡出;未击穿:接触后 0.25 s 缩小到 0 并在接触点放一个 `flash`(现有的闪光球)。击穿类的炮弹轨迹不变。
7. **乘员坐姿人形**:`buildCrewFigure(): THREE.Group` 导出(纯几何,无 WebGL 依赖),总高约 1.0 m(坐姿):头 `SphereGeometry(0.11)`、躯干 `BoxGeometry(0.34, 0.5, 0.22)`、两条大腿 `BoxGeometry(0.14, 0.14, 0.45)` 向前(-Z)、两条小腿 `BoxGeometry(0.12, 0.45, 0.12)` 向下;每个部件一层半透明材质(共用一个材质方便改色)+ `EdgesGeometry` 轮廓线;颜色:完好 `0x9fb6c7`(轮廓橙 `0xff9a2e`),`ratio < 1` 向红色插值,≤ 0 近黑。`layout.crew` 每个乘员放一个,位置 = `center`(中心对准躯干)。
8. **外挂模块**(`replay.external` 非空,常见于未击穿打中履带 / 炮管):对应 `layout.modules` 里 id 匹配的模块盒子,接触时淡入并按受损变红,和内构共用 `killcamInternalsOpacity` 的包络;跳弹 / 未击穿时**只显示这些外挂模块**,别的内构不显示。
9. **文字层**:`this.overlay = new KillCamOverlay(this.frame)`,`startItem` 里 `overlay.show(replay)`,`animate(t)` 里 `overlay.update(t, tContact)`,`clear` / `stop` 里 `overlay.hide()`。原 `caption` 块缩成左上角 12 px、半透明、`max-width: 60%`,在 `describe` 里加「等效装甲 / 穿深 / 入射角」一行。
10. **排队**(导出纯函数 `killcamPriority(replay): number` 和 `enqueueByPriority<T extends { replay: HitReplay }>(queue: T[], item: T, max: number): T[]`;`play` 里用):优先级 = `killcamDuration` 之外再按结果:ricochet 1 < nopen 2 < penetrated 3 < crew-out 4 < ammo-exploded 5(自己写 `outcomeRank`,**不要依赖 065 的 `hitOutcome`**,可以用同样的判断规则:`armor` 为 null 或 `!penetrated && !ricochet` → nopen;`ricochet` → ricochet;`penetrated` 且 `detonated` → ammo-exploded;`penetrated` 且有乘员 `after` ≤ 0 而 `before` > 0 → crew-out;否则 penetrated)。小窗(`corner`)的队列最多 2 个等待项:满了就丢掉优先级最低的(同级丢最旧的;新来的如果是最低就丢新来的);`full` 布局(自己被击毁)照旧打断一切。
11. 测试(`tests/killcam-all-hits.test.ts`,不依赖 WebGL / DOM 以外的东西;已有的 KillCam 测试按新行为更新并在「结果」里逐条说明,不删、不放宽):
    - `killcamDuration` 三种;`killcamCameraRig` 击穿类 / 跳弹 / 未击穿;`killcamBounceDir`(垂直命中反向、掠射接近原方向、`n` 朝向修正、结果是单位向量);
    - `killcamModuleColor`(完好类型色、半血插值、报废);`buildCrewFigure`(包围盒高度约 1 m、有头 / 躯干 / 四肢);
    - `killcamPriority` / `enqueueByPriority`(满队列丢最低、同级丢最旧、新来的最低被丢);
    - 如果 `KillCam` 能在 jsdom 里构造(现有 `tests/killcam-redo.test.ts` 的做法),各种结果 `play` 之后 `active` 为 true、`stop` 后为 false,且不抛错。

## 允许修改的文件

- 修改:`src/ui/KillCam.ts`
- 修改测试:`tests/` 下 KillCam 相关文件(只增不删);新增 `tests/killcam-all-hits.test.ts`
- 新增:`changelog.d/<日期>-066-killcam-all-hits.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 上面第 11 条的测试都有
- [ ] 主程会在浏览器里把每种结果各打一发看(跳弹 / 未击穿 / 击穿没击毁 / 击毁),并和录屏逐帧对照

## 不做

- `Game.ts` / `main.ts` / `Settings.ts`(触发时机和设置项主程做);`killcamOverlay.ts`(065);右上角小窗 / 全屏的尺寸;不改 `HitReplay` 的数据结构。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:

### 主程审查

合入后在浏览器里把跳弹、未击穿、击穿未击毁、击毁各播了一遍(冻结时钟按时间点看):接触后顶部文字出现并升级,弹着标记(圆盘 + 圆环)、跳弹的反射轨迹、未击穿的闪光、坐姿人形乘员、模块按类型着色、左下图标和右下乘员数都正常;实战里小窗回放无报错。agent 跑到一半 Gemini 五小时额度用完(429),但提交时 lint / 测试 / 构建全过、功能完整,「结果」一节没来得及填,由主程补在日志里。镜头取景偏远(长炮管让车体显得小),可调。
