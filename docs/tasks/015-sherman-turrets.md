# 015-sherman-turrets:谢尔曼 T23 / Jumbo 炮塔与火炮

- 负责:Antigravity(第二个会话,和 013 并行;车道:界面 / 实测,本轮兼做内容)
- 状态:待领取(012 合并后开工)
- 分支:`task/015-sherman-turrets`
- 规模:M(一个文件,约 250–400 行)

## 目标

把 `src/game/models/sherman/turret.ts` 的占位炮塔换成正式的两种炮塔和三种火炮:

| 车 | 炮塔 | 火炮(`L.variant.gun`) |
|---|---|---|
| M4A3(76)W | T23 炮塔(`'t23'`) | 76 mm M1A1(`'m1a1'`):炮口**没有**制退器,只有一个略粗的螺纹保护帽 |
| M4A3E8 | T23 炮塔 | 76 mm M1A2(`'m1a2'`):炮口有单室制退器(圆柱形,两侧开口) |
| M4A3E2 | Jumbo 厚壁炮塔(`'jumbo'`) | 75 mm M3(`'m3'`):短粗,没有制退器 |

同一时间还有两张卡在做同一组车的其他零件:013 做车体(`hull.ts`),014 做行走机构(`suspension.ts`)。**只改 `turret.ts`**,尺寸全部从 `layout.ts` 取。

## 开工

```bash
git fetch origin
git worktree add ../Main-ag-turret -b task/015-sherman-turrets origin/main
cd ../Main-ag-turret
npm ci
npm run dev -- --port 5315 --strictPort
```

浏览器打开 `http://localhost:5315`,在车库下方的车辆列表里点三辆谢尔曼查看。机库里火炮会微微抬起、炮塔偏转一点;进入战斗后上下移动鼠标让火炮俯仰,按住 C 自由视角绕车看(操作见 Readme「操作」一节)。也可以在 `tests/` 里搭模型、用 `applyGunPose()` 摆到射界两端检查。

## 背景与参考

- **先读** `src/game/models/sherman/layout.ts`:`turretBox`(长、宽、高、炮耳轴位置)、`ring.r`(座圈半径)、`barrelLength`(炮耳轴到炮口)。
- 坐标:`T`(炮塔静态网格)的原点在座圈中心、车顶高度,炮塔从 y = 0 往上建;`G`(火炮网格)的原点在炮耳轴 `(0, trunnionY, trunnionZ)`,炮管沿 −Z 伸出 `barrelLength`,整体随俯仰转动。**炮盾随火炮俯仰,放在 `G` 里。**
- 工具:`src/game/models/kit.ts`(`loft` 适合铸造圆炮塔,`tube` 做炮管)、`src/game/models/parts.ts`(舱盖、潜望镜、`lateCupola` 指挥塔可以参考)。
- 写法参考:`src/game/models/t34_85.ts`(铸造圆炮塔、防盾)、`src/game/models/tigerII.ts`。
- 资料:`docs/physics-validation.md` 第 11 节。外形照片可以搜「M4A3E8 turret」「T23 turret Sherman」「M4A3E2 Jumbo turret」(博物馆实车照片最可靠)。

## 要做的部件

**T23 炮塔**(M4A3(76)W、M4A3E8):

- 铸造炮塔,侧面略向内倾,前部圆润,后部有大尾舱(配重)。
- M62 炮架的**炮盾**:宽大的铸造炮盾,正面 89 mm,带同轴机枪口和瞄准镜口。
- 炮塔顶:车长指挥塔(**右后**,带观察窗)、装填手椭圆舱盖(左侧)、炮手和装填手的潜望镜、通风罩。
- 起吊环;.50 机枪可以做,但要横放成行军状态,不要高高竖起(负责人不要高天线一类的东西)。

**Jumbo 炮塔**(M4A3E2):

- 在 T23 基础上加厚:侧壁 152 mm,所以侧面更直(只倾 6°)、整体更方更厚重,炮塔盒宽 2.35 m(T23 2.2 m)。
- T110 炮架的炮盾:厚 178 mm,比 T23 的炮盾更厚、更方。
- 指挥塔(右后)、椭圆装填手舱盖。

**火炮**:76 mm 炮管细长(L/52),75 mm 炮管短粗(L/40)。两种炮管的长度都是 `L.barrelLength`(从炮耳轴量到炮口),不要自己按真实身管长重算。

## 允许修改的文件

- 修改:`src/game/models/sherman/turret.ts`(整个重写)
- 新增:`changelog.d/<日期>-015-sherman-turrets.md`;可以新增 `tests/sherman-turret.test.ts`
- 填写本卡的「结果」一节

**不要改** `layout.ts`、`index.ts`、`hull.ts`、`suspension.ts`、`kit.ts`、`parts.ts` 和数据文件。确实需要改,写进「结果」说明理由,由主程改。

## 接口(主程定死,不要改)

```ts
export function buildShermanTurret(L: ShermanLayout, T: GeoBatch, G: GeoBatch, C: Palette): void
```

`T` 和 `G` 都必须有几何体(`tests/model-bounds.test.ts` 会检查)。

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过(`tests/model-bounds.test.ts` 会检查三辆车不超高、不超宽)
- [ ] 炮塔底面盖住座圈(半径 `ring.r`),不悬空、不插进车顶
- [ ] 火炮在整个俯仰范围内(76 mm 车 −12° / +25°,E2 −10° / +25°)炮盾都不露破绽:背面始终在炮塔正面以内,不和炮塔顶、车顶穿插。在「结果」里写明怎么检查的(例如在射界两端逐个顶点核对)
- [ ] 炮口位置正确:炮管末端在 `z = −L.barrelLength`(gunPivot 坐标)
- [ ] 三种火炮一眼能分辨(有无制退器、粗细长短),两种炮塔一眼能分辨
- [ ] 炮塔 + 火炮三角面不超过约 2,500,统计方法写进「结果」
- [ ] 在机库截图:三辆车各一张右前 45°,外加 E8 和 E2 的炮塔特写各一张,放进 PR 描述(不要提交进仓库)

## 不做

- 车体、行走机构
- 改数据(`vehicles.ts`)、碰撞盒和炮耳轴位置
- 天线

## 交付

- 提交信息:`model: 谢尔曼 T23 / Jumbo 炮塔与火炮`(格式见 AGENTS.md)
- 推送分支,**直接对 `main` 开 PR**(不要叠在别的任务分支上),PR 描述贴「结果」一节和截图
- 012 必须已经合并;如果你开工时 `main` 里还没有 `src/game/models/sherman/`,先停下来告诉负责人

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
