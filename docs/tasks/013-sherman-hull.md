# 013-sherman-hull:谢尔曼 M4A3 车体模型

- 负责:Antigravity(车道:界面 / 实测;本轮兼做内容)
- 状态:待领取(012 合并后开工)
- 分支:`task/013-sherman-hull`
- 规模:M(一个文件,约 250–400 行)

## 目标

把 `src/game/models/sherman/hull.ts` 的占位方块换成 M4A3 的正式车体。三辆谢尔曼(M4A3(76)W、M4A3E8、M4A3E2)共用这个车体,E2 多一层附加装甲。细节程度对齐现有的 `t34_85.ts`、`isu122.ts`。

同一时间还有两张卡在做同一组车的其他零件:014 做行走机构(`suspension.ts`),015 做炮塔和火炮(`turret.ts`)。**只改 `hull.ts`**,接缝处的尺寸全部从 `layout.ts` 取。

## 开工

```bash
git fetch origin
git worktree add ../Main-ag-hull -b task/013-sherman-hull origin/main
cd ../Main-ag-hull
npm ci
npm run dev -- --port 5313 --strictPort
```

浏览器打开 `http://localhost:5313`,在车库下方的车辆列表里点 M4A3(76)W / M4A3E8 / M4A3E2,拖动旋转、滚轮缩放。

## 背景与参考

- **先读** `src/game/models/sherman/layout.ts`:坐标约定和所有关键尺寸(地面、车底、侧裙底面、车顶、车鼻、首上 47° 的 `glacisZ(y)`、车尾、上下车体半宽、主动轮位置、附加装甲厚度)。车体必须和它对齐,否则会和 014 的行走机构、015 的炮塔对不上。
- 工具:`src/game/models/kit.ts`(`extrude`、`prism`、`loft`、`box`、`rod`、`bothSides`、`palette` 等)、`src/game/models/parts.ts`(舱盖、潜望镜、大灯、工具、拖车钢缆、备用履带板等现成零件)。
- 写法参考:`src/game/models/t34_85.ts`(车体部分)、`src/game/models/isu122.ts`。文件开头用注释列出做了哪些部件。
- 资料:`docs/research/m4a3-76w.md`、`docs/physics-validation.md` 第 11 节。外形照片可以搜「M4A3E8 Sherman」「M4A3(76)W」「M4A3E2 Jumbo」(博物馆实车照片最可靠)。

## 要做的部件

三辆车共有:

- **下部车体**(两条履带之间,半宽 `lowerHalfW`):车鼻是**单块铸造传动罩**(尖鼻型:侧视前端有一道棱,顶边用一排螺栓法兰和车体相接),两个大拖车钩;车底;车尾下部。
- **首上**:47° 单块钢板(`glacisZ(y)`),右侧有航向机枪球座(M1919A4),左右各一个大灯带护罩(**E2 没有大灯**),起吊环。
- **车顶**:驾驶员、副驾驶两个大圆舱盖(在首上后方的车顶上,带潜望镜);炮塔座圈周围留空(半径 `ring.r`,炮塔归 015);发动机舱盖板、加油口;工具(铁锹、斧头、撬棍等)。
- **侧裙**:上部车体伸出到履带上方(半宽 `upperHalfW`,底面在 `sponsonY`);侧裙下沿的挡沙板支架。
- **车尾**:M4A3 的车尾板(两扇检修门)、排气导流板、拖车钩、尾灯。
- **挡泥板**:前挡泥板盖住主动轮上方,后挡泥板。
- **HVSS 型(`L.variant.suspension === 'hvss'`,即 M4A3E8)**:履带比侧裙宽(履带外缘约 1.42 m,侧裙 1.31 m),挡泥板要加宽到盖住履带。

只有 M4A3E2(`L.variant.applique`):

- 首上加焊一块附加装甲(厚 `L.applique`,舱盖、机枪球座的位置留开口),四周有焊缝。
- 上部侧面各加焊一块长方形附加装甲(厚 `L.applique`)。
- 传动罩更厚更圆(单块加厚型)。
- 没有大灯和警报器。

## 允许修改的文件

- 修改:`src/game/models/sherman/hull.ts`(整个重写)
- 新增:`changelog.d/<日期>-013-sherman-hull.md`;可以新增 `tests/sherman-hull.test.ts`
- 填写本卡的「结果」一节

**不要改** `layout.ts`、`index.ts`、`suspension.ts`、`turret.ts`、`kit.ts`、`parts.ts`、`running.ts` 和数据文件。需要新的尺寸或零件,在本文件里自己定义常量 / 函数;确实需要改别的文件,写进「结果」说明理由,由主程改。

## 接口(主程定死,不要改)

```ts
export function buildShermanHull(L: ShermanLayout, H: GeoBatch, C: Palette): void
```

只往 `H`(车体静态网格)里加几何体。不要画负重轮架、主动轮、诱导轮、托带轮、履带(归 014),不要画炮塔(归 015)。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过(`tests/model-bounds.test.ts` 会自动检查三辆车的包围盒)
- [x] 车体和 `layout.ts` 对齐:首上斜面就是 `glacisZ(y)`,侧裙底面在 `sponsonY`,车顶在 `top`,车鼻不超过 `noseZ`
- [x] 没有漂浮、错位的零件,没有零件插进炮塔座圈范围
- [x] 三辆车之间能看出区别:E8 的加宽挡泥板,E2 的附加装甲和没有大灯
- [x] `buildShermanHull` 加进去的三角面不超过约 4,000(参考:现有车的车体 2.4k–3.8k),统计方法写进「结果」
- [ ] 在机库截图:三辆车各一张左前 45°,外加 E2 正面一张,放进 PR 描述(不要提交进仓库)

## 不做

- 炮塔、火炮、行走机构
- 改数据(`vehicles.ts`)和碰撞盒
- 车体上的 .50 机枪、天线

## 交付

- 提交信息:`model: 谢尔曼 M4A3 车体`(格式见 AGENTS.md)
- 推送分支,**直接对 `main` 开 PR**(不要叠在别的任务分支上),PR 描述贴「结果」一节和截图
- 012 必须已经合并;如果你开工时 `main` 里还没有 `src/game/models/sherman/`,先停下来告诉负责人

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改: `docs/tasks/013-sherman-hull.md`
  - 修改: `src/game/models/sherman/hull.ts`
  - 新增: `tests/sherman-hull.test.ts`
  - 新增: `changelog.d/2026-10-01-013-sherman-hull.md`
- 命令与结果:
  - `npm run lint`: 通过 (tsc --noEmit 无错误)
  - `npm test`: 全部 26 个测试套件、259 个测试用例全部通过 (包含 `tests/model-bounds.test.ts`、`tests/sherman-vehicles.test.ts` 及 `tests/sherman-hull.test.ts`)
  - `npm run build`: 通过 (tsc && vite build 正常产出 dist)
  - 三角面统计:
    - 统计方法: 调用 `buildShermanHull(L, H, C)` 填充 `GeoBatch` 后读取 `H.triangles` (即顶点数组长度 / 9)
    - M4A3(76)W: 2,612 面
    - M4A3E8: 2,636 面
    - M4A3E2: 2,468 面
    - 均符合不超过 4,000 面的预算要求
- 偏差 / 未完成 / 待决定:
  - 无功能偏差, 尺寸严格遵循 `layout.ts`, 座圈范围内部完全留空。
  - 遵守调度脚本与 Agent 规则, 未执行 git commit / push / PR 操作, 待主程审查后统一处理。机库截图待主程提交 PR 时附上。
