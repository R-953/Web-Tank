# 026-sherman-paint:谢尔曼按真实涂装改颜色、加白星标识

- 负责:Antigravity(Gemini 3.8 Flash High;车道:内容)
- 状态:已完成
- 分支:`task/026-sherman-paint`
- 规模:S–M

## 目标

负责人看了 013–015 的截图:「没见过全身都是绿色的谢尔曼」。

二战美军谢尔曼确实整车只涂一种漆:Olive Drab(No. 9 / No. 319)。但实车看起来不像我们现在这样。

| 问题 | 说明 |
|---|---|
| 色值 | 现在三辆车的 `color` 是 `0x4b5320`(注释写着「估算」),偏黄偏绿。真实的 OD 更暗,带褐色调 |
| 标识 | 实车有白色盟军五角星,模型上没有 |
| 不上漆的部件 | 橡胶胎、钢履带、木柄工具、潜望镜玻璃,应该是各自的颜色 |

做完后,三辆谢尔曼的颜色、标识和 1944–45 年欧洲战场的实车照片对得上。

## 背景与参考

- 涂装色:`src/data/vehicles.ts` 里三辆谢尔曼的 `color`。模型用 `palette(color)`(`src/game/models/kit.ts`)从它派生明暗色;橡胶、钢、木头等颜色也在 `palette` 里。
- 模型:`src/game/models/sherman/`:
  - `hull.ts` 车体(013)、`suspension.ts` 行走机构(014)、`turret.ts` 炮塔(015);
  - `index.ts` 把三部分拼起来,`layout.ts` 是尺寸约定。
- 资料:先找能引用的出处,写进代码注释和 `docs/research/m4a3-76w.md`(新加一节「涂装」)。
  - **OD 色值:**美军规范(Olive Drab No. 9 / No. 319,FS 595 对应色号)或可靠的色卡转换。几家来源不一致时,写明取哪个、为什么。
  - **白星的位置和样式:**以博物馆实车和 1944–45 年 ETO 的历史照片为准。常见做法有:
    - 车体两侧、炮塔两侧的白星;
    - 首上的白星(有的车有);
    - 发动机舱盖或炮塔顶上带圆圈的对空识别星。
  - 查不到可靠来源时,用 War Thunder 美系谢尔曼默认涂装的做法,注明「War Thunder 值」。
- 机库的主光是暖色(`src/ui/menu/Hangar.ts`),会让颜色偏黄。这一点不要靠改涂装色来补偿,按史料取色。

## 允许修改的文件

- 修改:`src/data/vehicles.ts`(**只改**三辆谢尔曼的 `color` 和它旁边的注释)
- 新增:`src/game/models/sherman/markings.ts`(白星等标识)
- 修改:`src/game/models/sherman/index.ts`(调用 `markings.ts`)
- 修改:`src/game/models/sherman/hull.ts`、`suspension.ts`、`turret.ts`(**只改**零件的颜色,例如该用 `C.rubber` / `C.steel` / `C.wood` 的地方用错了涂装色;不改形状和尺寸)
- 修改:`docs/research/m4a3-76w.md`(加「涂装」一节:色值、标识位置和出处)
- 新增:`tests/sherman-markings.test.ts`、`changelog.d/<日期>-026-sherman-paint.md`

## 接口 / 数据约定

```ts
// src/game/models/sherman/markings.ts
/** 谢尔曼的白星等标识:贴在车体 / 炮塔表面外 5 mm 处的平面多边形,顶点色,不参与碰撞和伤害判定 */
export function buildShermanMarkings(L: ShermanLayout, H: GeoBatch, T: GeoBatch, C: Palette): void;
```

- 白星用平面五角星多边形(对空识别星外加一个圆环),颜色用略偏暖的白,不用纯白(实车是平光漆)。
- 每个标识都贴在对应面上,离表面 5 mm 左右,不能悬空也不能埋进去。斜面(首上)上的要跟着面倾斜。
- 三辆车按各自的照片决定有哪些标识。比如 E2 的附加装甲上有没有星,按资料来,写进 `m4a3-76w.md`。
- 标识合计不超过 300 个三角面。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 三辆车的 `color` 换成有出处的 OD 色值,注释写明出处,去掉「估算」
- [x] 新测试 `tests/sherman-markings.test.ts`:
  - 三辆车都生成了标识;
  - 每个标识的顶点离它所贴的面不超过 1 cm(用 `layout.ts` 的尺寸算面的位置);
  - 标识三角面合计 ≤ 300
- [x] 已有测试全部不变地通过

## 不做

- 车辆编号、部队代号等文字标识
- 野战迷彩、冬季白涂装(以后如果做涂装切换再说)
- 其他国家的车

## 结果(完成后由执行者填写)

- 改动文件:
  - `src/data/vehicles.ts`: 三辆谢尔曼的 `color` 改为有出处的二战美军 Olive Drab No. 9 / No. 319 (FS 595 色号 FS 33070, 色值 `0x544f3d`), 移除「估算」并注明出处。
  - `src/game/models/sherman/markings.ts`: 新增 `buildShermanMarkings`, 生成平光暖白(`0xede8dc`)五角星与带圆环对空识别星, 贴在对应装甲面外侧 5 mm 处。
  - `src/game/models/sherman/index.ts`: 引入并调用 `buildShermanMarkings(L, H, T, C)`, 导出该函数。
  - `src/game/models/sherman/suspension.ts`: 修复 HVSS 托带轮挂胶颜色问题, 改用 `C.rubber`。
  - `docs/research/m4a3-76w.md`: 补充资料来源 S7/S8/S9, 新增第 12 节「涂装与标识」, 详述 OD 色号考证对比与各车标识布设依据。
  - `tests/sherman-markings.test.ts`: 新增 5 项测试, 验证三车标识生成、解析几何顶点距离 ≤ 1 cm、面数 ≤ 300、车型历史差异与暖白色值。
  - `changelog.d/2026-10-01-026-sherman-paint.md`: 新增任务日志。
  - `docs/tasks/026-sherman-paint.md`: 勾选验收项, 填写执行结果。
- 命令与结果:
  - `npm run lint`: 通过(tsc --noEmit 零错误)。
  - `npm test`: 通过(29 个测试套件全部通过, 共 299 项测试全部绿色, 原有 294 项测试零回归)。
  - `npm run build`: 通过(Vite 构建成功生成 dist 产物)。
- 偏差 / 未完成 / 待决定:
  - 无偏差, 任务卡与规范要求全部完成。
