# 012-shermans:谢尔曼三车(M4A3(76)W、M4A3E8、M4A3E2)数据与模型骨架

- 负责:Claude Code(主程)
- 状态:待审查
- 分支:`task/012-shermans`
- 规模:M

## 目标(负责人 2026-10-01 提出)

加入三辆谢尔曼:M4A3(76)W、M4A3E2「Jumbo」、M4A3E8「Easy Eight」。用它们检验多智能体协作机制:主程出数据和接口,模型按零件拆给 Antigravity 和 Copilot(任务 013–015)。

本卡只做**数据**和**模型骨架**:三辆车能在游戏里选、能打,模型先用占位外形,013–015 合并后换成正式模型。

## 做法

1. **数据**(`vehicles.ts`):M4A3(76)W、M4A3E8 沿用 003 的调研;M4A3E2 和 75 mm M3 炮是新查的。数值与出处见 `docs/physics-validation.md` 第 11 节。
   - 两辆 76 mm 车用同一门炮的弹药(`gun76()`),三辆共用同轴机枪(`m1919a4Coax()`)和内部布局(`shermanInternals()`)。
   - 车体盒高 1.93 + 炮塔盒高 0.72:炮耳轴高度等于资料的火线高 2.29 m,炮塔顶加指挥塔等于全高 2.97 m。003 草稿是 2.0 + 0.9,会高出约 0.2 m,所以改了。
   - M4A3(76)W 和 M4A3E8 车体、炮塔都一样,但悬挂不同、外观差别明显,负责人点名两辆都要,所以不按「换皮只做后期型」处理。
   - M4A3E2 按出厂状态用 75 mm M3;前线换装 76 mm 的车不做。
2. **模型骨架**(`src/game/models/sherman/`):
   - `layout.ts`:三辆车共用的关键尺寸(地面、车底、侧裙高度、首上 47° 斜面、主动轮、负重轮架位置、履带、炮耳轴等),由主程维护,零件作者只读。
   - `index.ts`:用「同一车体 + 两种悬挂 + 两种炮塔」拼出三辆车,在 `models/index.ts` 注册。
   - `hull.ts`、`suspension.ts`、`turret.ts`:占位实现,分别由 013、014、015 整个重写。三张卡各改各的文件,互不冲突。
3. **测试**:新增 `tests/sherman-vehicles.test.ts`,包括 5 种穿甲弹的穿深曲线对照资料表(容差 3%)、炮口伸出量 / 火线高 / 全高和资料一致、共用布局的几何自检。`tests/data.test.ts` 加三辆车的载弹量。

## 允许修改的文件

- `src/data/vehicles.ts`、`src/game/models/index.ts`;新增 `src/game/models/sherman/*`
- `tests/data.test.ts`;新增 `tests/sherman-vehicles.test.ts`
- `docs/physics-validation.md`(新增第 11 节);新增任务卡 013–015

## 验收标准

- [x] 每个数值都有出处,或标明「War Thunder 值」/「估算」并写出方法
- [x] 穿深曲线和资料表逐点误差 < 3%
- [x] 三辆车能在机库选中、进入战斗,占位模型通过 `model-bounds` 测试
- [x] `npm run lint`、`npm test`、`npm run build` 全部通过

## 结果

- 改动文件:`src/data/vehicles.ts`(+ 三辆车和三个共用函数)、`src/game/models/index.ts`、`tests/data.test.ts`、`docs/physics-validation.md`;新增 `src/game/models/sherman/`(`layout.ts`、`index.ts` 和三个占位文件)、`tests/sherman-vehicles.test.ts`、任务卡 013–015
- 命令与结果:`npm run lint` 通过;`npm test` 25 个文件 255 个测试全部通过(新增 13 个:穿深与几何 10 个,三辆车的包围盒 3 个);`npm run build` 通过(只有原来就有的包体积警告)
- 检查:
  - 穿深拟合:M62 / M79 / M93 / M61 / M72 各点误差都在 1.5% 以内
  - 布局自检:按 `layout.ts` 的主动轮、负重轮架位置,占位行走机构每侧正好 79 块履带板,和资料(79 块 × 6 in)一致
  - 机库里三辆车都能选中,占位模型正常显示,控制台没有报错
- 需要负责人决定:
  - **美式分划**:`SightSpec.reticle` 只有德式 / 苏式,三辆车暂用苏式。加 `'us'` 属于改核心类型,可以作为一张界面卡(Antigravity)
  - **不能原地转向**、**湿式弹药架降低殉爆**:003 留下的两个问题,本卡没有处理
  - 76 mm M93 在约 170 m 以内能打穿虎王首上(233 mm)。这和资料一致,但虎王「正面打不穿」的设定在近距离不再成立
