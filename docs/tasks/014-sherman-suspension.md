# 014-sherman-suspension:谢尔曼 VVSS / HVSS 行走机构

- 负责:Antigravity(Gemini 3.8 Flash High;原派 GitHub Copilot,模型测试里 mai-code 建模偏弱,2026-10-01 改派)
- 状态:待领取(012 合并后开工)
- 分支:`task/014-sherman-suspension`
- 规模:M(一个文件 + 一个测试文件)

## 目标

把 `src/game/models/sherman/suspension.ts` 的占位行走机构换成正式的两种悬挂:

- **VVSS**(垂直螺旋弹簧):M4A3(76)W、M4A3E2 用
- **HVSS**(水平螺旋弹簧):M4A3E8 用

同一时间还有两张卡在做同一组车的其他零件:013 做车体(`hull.ts`),015 做炮塔(`turret.ts`)。**只改 `suspension.ts`**,位置全部从 `layout.ts` 取。

## 开工

```bash
git fetch origin
git worktree add ../Main-copilot-014 -b task/014-sherman-suspension origin/main
cd ../Main-copilot-014
npm ci
npm run dev -- --port 5314 --strictPort
```

浏览器打开 `http://localhost:5314`,在车库下方的车辆列表里点三辆谢尔曼查看。如果你看不到渲染画面,在「结果」里说明,截图由主程审查时补。

## 背景与参考

- **先读** `src/game/models/sherman/layout.ts`:坐标约定、`ground`、`track`(中心线 x、宽、厚、节距)、`sprocket`(位置、半径、13 齿)、`bogieZ`(三个负重轮架中心)、`sponsonY`(侧裙底面,行走机构不能高过它)、`lowerHalfW`(下部车体侧面,负重轮架装在这上面)。
- **先读** `src/game/models/running.ts`:`runningGear()` 负责会转的车轮和一圈会走动的履带板。履带环是所有车轮外圆的凸包;有齿主动轮时履带节距按齿数定,张紧轮(诱导轮)自动前后微调让履带板数是整数。
- 现成车轮几何:`rubberRoadWheel`、`discWheel`、`toothedSprocket`(都在 `running.ts`)。双轮(两片轮子)可以用 `GeoBatch` 把两片合成一个几何体,参考 `isu122.ts` 里 IS-2 的双负重轮。
- 写法参考:`src/game/models/isu122.ts`、`src/game/models/t34_85.ts` 的行走机构部分。

## 资料(出自 afvdatabase,转载 Hunnicutt《Sherman》1994;尺寸未注明的是估算,可以按照片调整)

| | VVSS(M4A3(76)W、M4A3E2) | HVSS(M4A3E8) |
|---|---|---|
| 负重轮架 | 每侧 3 个,每个架 2 个**单**负重轮;铸造轮架外侧可以看到竖直的螺旋弹簧和两根摆臂 | 每侧 3 个,每个架 2 对**双**负重轮;两对轮之间有一根水平的螺旋弹簧;每个架一个斜置减震器 |
| 负重轮 | 直径 20 in(0.508 m),宽约 9 in(0.23 m),挂胶,冲压辐板 | 直径约 20.5 in(0.52 m),每对两片、中间留出诱导齿的缝,挂胶 |
| 托带轮 | 每个负重轮架后上方一个(装在轮架伸出的支架上) | 每侧 2 个双托带轮 + 3 个单托带轮,装在车体侧面 |
| 主动轮 | 前置,13 齿 | 前置,13 齿 |
| 诱导轮 | 后置,可调 | 后置,双诱导轮,可调 |
| 履带 | T48:**外侧诱导齿**(两边端联器上),双销,人字形橡胶块,宽 0.42 m;E2 加宽端联器(「鸭嘴」,装在外侧)后宽 0.51 m | T66:**中央诱导齿**,单销,铸钢,宽 0.58 m |
| 节距 / 块数 | 6 in,每侧 79 块,接地长 3.73 m | 6 in,每侧 79 块,接地长 3.84 m |

`runningGear` 的履带板形状只有 `'plain'` 和 `'guide'`(中央诱导齿)。HVSS 用 `'guide'`;VVSS 的外侧诱导齿没有现成样式,用 `'plain'`,不要为此改 `running.ts`。

## 允许修改的文件

- 修改:`src/game/models/sherman/suspension.ts`(整个重写)
- 新增:`tests/sherman-suspension.test.ts`、`changelog.d/<日期>-014-sherman-suspension.md`
- 填写本卡的「结果」一节

**不要改** `layout.ts`、`index.ts`、`hull.ts`、`turret.ts`、`kit.ts`、`running.ts` 和数据文件。确实需要改,写进「结果」说明理由,由主程改。

## 接口(主程定死,不要改)

```ts
export function buildSuspension(L: ShermanLayout, kit: ModelKit, root: THREE.Object3D, H: GeoBatch, C: Palette): void
```

会转的部分(负重轮、托带轮、主动轮、诱导轮、履带板)用 `runningGear(kit, root, …)`;不转的部分(负重轮架、弹簧、摆臂、减震器、托带轮支架、诱导轮支架)加到 `H`。根据 `L.variant.suspension` 选 VVSS 或 HVSS。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过(`tests/model-bounds.test.ts` 会自动检查三辆车:履带贴地、不超宽)
- [x] 新增 `tests/sherman-suspension.test.ts`,对三辆车都检查:
  - 每侧履带板 79 ± 2 块(搭好模型后,`root` 下实例数最多的 `InstancedMesh` 就是履带板,两侧合计,`count / 2` 即每侧块数)
  - 所有负重轮底部离地 = 履带厚(误差 1 cm 以内),即压在履带上
  - 行走机构的最高点低于 `L.sponsonY`(不顶到侧裙)
  - 负重轮架在履带内缘以外、`L.lowerHalfW` 以外(不插进车体)
- [x] VVSS 和 HVSS 一眼能分辨(单轮 / 双轮、竖弹簧 / 横弹簧、托带轮位置)
- [x] 行驶时车轮转动方向正确、履带板不穿过车轮(`runningGear` 已经保证,只要车轮位置合理)
- [x] 所有车轮几何体侧视呈圆形(负重轮、托带轮、诱导轮段数至少 12,侧视角度不少于 12 个方向,防止退化为方形)
- [x] 行走机构三角面(两侧合计,含履带板)不超过约 9,000(主程 2026-10-01 放宽),统计方法写进「结果」

## 不做

- 车体、挡泥板(归 013)
- 履带物理、悬挂起伏动画
- 改 `running.ts` 增加新的履带板样式

## 交付

- 提交信息:`model: 谢尔曼 VVSS / HVSS 行走机构`(格式见 AGENTS.md)
- 推送分支,**直接对 `main` 开 PR**(不要叠在别的任务分支上),PR 描述贴「结果」一节,能截图的话附上
- 012 必须已经合并;如果你开工时 `main` 里还没有 `src/game/models/sherman/`,先停下来告诉负责人

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改:`src/game/models/sherman/suspension.ts`
  - 修改:`docs/tasks/014-sherman-suspension.md`
  - 新增:`tests/sherman-suspension.test.ts`
  - 新增:`changelog.d/2026-10-01-014-sherman-suspension.md`
- 命令与结果:
  - `npm run lint`: 通过(tsc 0 错误)
  - `npm test`: 全部通过(26 个测试文件、274 个测试全部通过)
  - `npm run build`: 通过(tsc + vite build 生产打包成功)
  - 三角面统计:
    - 统计方法:遍历 root 下所有 Mesh/InstancedMesh。对 InstancedMesh 计算 `(geometry.position.count / 3) * count`;对普通 Mesh 计算 `geometry.position.count / 3`。
    - 统计结果(两侧合计,含全部履带板与车轮实例):
      - M4A3(76)W (VVSS):实际绘制 5,400 三角面(独立网格基础面数 932)
      - M4A3E8 (HVSS):实际绘制 8,864 三角面(独立网格基础面数 932)
      - M4A3E2 (VVSS):实际绘制 5,400 三角面(独立网格基础面数 932)
      - 均严格在放宽后的 9,000 面上限以内。
- 偏差 / 未完成 / 待决定:
  - 返工说明:初版为将面数严格压在 6,000 面内,HVSS 轮子采用了 4 段低多边形导致侧视呈方形。主程审查后将上限放宽至 9,000 面(2026-10-01)。已按主程意见将 VVSS 与 HVSS 全部轮子(负重轮、托带轮、诱导轮)统一改为至少 12 段圆轮,并在测试中新增侧视径向角度检查(≥12 方向),防止轮子退化成方形;面数严格控制在 9,000 面以内。
