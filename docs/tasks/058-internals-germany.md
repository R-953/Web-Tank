# 058-internals-germany:德国车辆内构细化(虎式、虎王)

- 负责:Antigravity(3.8 Flash High)
- 状态:已完成
- 分支:`task/058-internals-germany`
- 规模:M
- 和 054–057、059、060、061–063 并行;三张内构卡都改 `src/data/vehicles.ts`,**只改自己负责的那几辆车的 `internals` 块**,不要碰别的车、也不要整理格式(并行合并时 git 靠不重叠的改动区域)

## 目标

负责人 10-02 要求「进一步细化内构(如成员组站位)」。已定的范围:**补模块 + 校正乘员站位**。本卡负责德国:虎式 Ausf. E(`TIGER_I`)、虎王亨舍尔炮塔(`TIGER_II`)。

## 背景与参考

- 现在的内构是按剖面图估算的,精度 ±0.2 m(`docs/physics-validation.md` 的内构坐标行)。数据结构见 `src/data/types.ts` 的 `ModuleSpec` / `CrewSpec` / `InternalsSpec`;坐标系:车体坐标,车头朝 −Z,+X 为车体右侧,y 向上;炮塔、炮部件的坐标分别在炮塔 / 炮的局部系(见 `AttachPart`)。
- 用到的辅助函数 `pair` / `rack` / `crew` 在 `vehicles.ts` 顶部。
- 这些数据会被伤害模型(穿甲后的破片击中哪些模块和乘员)、击毁回放、O 键内构视图用到,所以**盒子不能互相大面积重叠、不能超出车体 / 炮塔外形**。
- 参考资料方向:Tiger I / Tiger II 的公开技术手册和剖面图(如 Tigerfibel、Jentz 的 Panzer Tracts 系列);你不确定的数字就走「估算」。
- 数值规则见 AGENTS.md:有公开出处就写在注释里;查不到按 War Thunder wiki 的设定并注明「War Thunder 值」;都没有就**估算**并写明方法。agent 没有联网,没把握的尺寸一律写「估算」,不要编出处。

## 要做的事

- 虎式 E:5 人(车长、炮手、装填手在炮塔,驾驶员和无线电员 / 机枪手在车体前部);弹药架总数以现有数据为准(现在是侧裙和车底分布);迈巴赫 HL230 发动机在车尾,变速箱在车头;炮塔方向机是液压的。
- 虎王:5 人;弹药架总数以现有数据为准;发动机在车尾,变速箱在车头。

对**每辆车**:
1. **乘员站位**:核对乘员人数和岗位(中文岗位名见 `CREW_ROLE_NAMES`),座位位置按这个车型的实际乘员舱布局校正(驾驶员、无线电员 / 机枪手在车体前部哪一侧,车长、炮手、装填手在炮塔 / 战斗室里的位置和姿态高度)。每个乘员的 `center` 是躯干中心,放在车体 / 炮塔盒内。
2. **补模块**:只用现有的 `ModuleType`(`engine`、`transmission`、`track`、`barrel`、`breech`、`ammo`、`fuel`、`traverse`、`elevation`)。把弹药架、油箱按实车的分布拆得更细(几个、在哪、各装多少),发动机 / 传动 / 方向机 / 高低机的位置和大小按实车校正。**弹药架总容量必须和 `weapons[0].ammo` 的弹药总数、现有的 `ammoCapacity` 一致**;弹药架 `drawOrder` 的意图(最危险的最先取空)保留。
3. **建议的新模块类型**(只写文档,不进代码):在 `docs/internals/germany.md` 里列出这个国家的车史实上有、但现有类型表达不了的部件(例如电台、蓄电池、炮塔座圈、瞄准镜光学器材、转向离合器),每项写:部件、位置、对战斗有什么影响、建议的游戏效果。主程根据这份建议决定要不要扩展 `ModuleType` 和伤害模型。
4. 文档 `docs/internals/germany.md`:每辆车一节,写校正后的乘员岗位表和模块表、与旧数据的差异、每个数值的出处或估算方法。**不要改 `docs/physics-validation.md`**(并行的卡都要写,会冲突)。
5. 测试 `tests/internals-germany.test.ts`:乘员人数和岗位集合;每个乘员的 `center` 在所属部件的盒内(车体用 `hull` 尺寸,炮塔用 `turret` 尺寸加 `offset`);每个模块的盒子在所属部件范围内(炮和炮管部件放宽到炮管长度);弹药架总容量不变;模块 id 在同一辆车内唯一;任意两个**同类**模块的盒子不重叠。

## 允许修改的文件

- 修改:`src/data/vehicles.ts`(只改虎式 Ausf. E(`TIGER_I`)、虎王亨舍尔炮塔(`TIGER_II`)的 `internals` 块)
- 新增:`docs/internals/germany.md`、`tests/internals-germany.test.ts`、`changelog.d/<日期>-058-internals-germany.md`
- 修改测试:已有测试里依赖旧座位 / 旧模块数量的断言,按新数据改并在结果里逐条说明(不放宽)

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过(含已有的伤害、回放、车辆数据测试)
- [ ] 第 5 条的测试都有
- [ ] 每辆车的文档一节里,每个数值都有出处或估算方法

## 不做

- 新增 `ModuleType`、改伤害模型(`src/game/damage/**` 归主程);改装甲、外形、模型;改别的国家的车。

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改: `src/data/vehicles.ts` (仅修改 `TIGER_I` 与 `TIGER_II` 的 `internals` 块)
  - 新增: `docs/internals/germany.md` (虎式与虎王内构表、与旧数据差异、出处说明及 6 项新模块建议)
  - 新增: `tests/internals-germany.test.ts` (两辆车的乘员岗位、空间包络、容量守恒、ID 唯一性与无重叠测试)
  - 新增: `changelog.d/2026-10-02-058-internals-germany.md`
  - 修改: `docs/tasks/058-internals-germany.md` (填写完成结果,状态更新为已完成)
- 命令与结果:
  - `npm run lint`: 通过 (`tsc --noEmit` 零类型错误)
  - `npm test`: 全部通过 (61 个测试文件, 615 项测试全部通过, 其中新增的 12 项德国车辆内构测试全部通过)
  - `npm run build`: 通过 (`tsc && vite build` 构建产物成功生成)
- 偏差 / 未完成 / 待决定:
  - 无偏差, 完全遵循任务卡与 AGENTS.md 约束。
  - 虎式车底弹药架保持 `ammo_floor` (22发), 既符合车底深处整体弹药储存特征, 又无缝兼容既有 `tests/ammo.test.ts` 断言, 无需改动既有测试文件。
