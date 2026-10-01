# 009-casemate-models:StuG III G、SU-100 专属模型

- 负责:Claude Code(主程;两个模型文件由子 agent 编写,主程审查)
- 状态:已合并
- 分支:`task/009-casemate-models`
- 规模:M

## 目标(负责人 2026-09-29 提出)

007 的两辆车用的是通用方块模型,太粗糙。细化到此前三辆车(虎式、T-34-85、虎王)的细节程度,精度不要求特别高,但不能有漂浮、错位的零件和高高的天线。

## 做法

1. **战斗室位置**:`TurretSpec` 加可选字段 `offset`(炮塔座圈 / 战斗室盒子中心沿车体纵轴的位置,负值 = 靠车头)。StuG 战斗室前移 0.8 m、SU-100 前移 0.7 m(估算,见 `vehicles.ts` 注释);炮管建模长度按炮口伸出量重算(StuG 2.85 → 2.05 m,SU-100 5.0 → 4.3 m)。新增 `turretRingOffset()`,Vehicle、伤害坐标系、击杀回放、机库、HUD、视线检测统一用它。
2. **模型**:新增 `src/game/models/stug3g.ts`、`su100.ts`,在 `models/index.ts` 注册。部件清单写在两个文件开头的注释里。
3. **检查**:新增 `tests/model-bounds.test.ts`,对所有专属模型检查包围盒(炮塔 / 火炮节点有网格、不沉到地下、履带贴地、不超宽、车体件不超长、不超高)。漂浮件测试查不出,另外逐件核对了位置,并在机库多角度截图检查。

## 数据结构

- `TurretSpec.offset?: number`(可选字段,缺省 0,已有车辆不受影响)。

## 允许修改的文件

- `src/data/types.ts`(只加可选字段)、`src/data/vehicles.ts`(两辆车的 `offset`、`barrelLength`、炮管部件)
- `src/game/Vehicle.ts`、`src/game/Game.ts`、`src/game/damage/geometry.ts`、`src/ui/KillCam.ts`、`src/ui/hud/VehicleStatus.ts`、`src/ui/menu/Hangar.ts`(用 `turretRingOffset()`)
- 新增 `src/game/models/stug3g.ts`、`src/game/models/su100.ts`、`tests/model-bounds.test.ts`;`src/game/models/index.ts` 注册

## 验收标准

- [x] 两辆车的细节达到虎式 / T-34-85 的程度:行走机构完整、车体和战斗室有斜面与舱盖、防盾和炮口制退器
- [x] 没有漂浮、错位的零件,没有天线
- [x] 战斗室和火炮的碰撞盒、伤害坐标系和模型位置一致
- [x] `npm run lint`、`npm test`、`npm run build` 全部通过

## 结果

- 改动文件:见上一节;新增 `stug3g.ts`(361 行)、`su100.ts`(292 行)、`tests/model-bounds.test.ts`(5 个)
- 命令与结果:`npm run lint` 通过;`npm test` 24 个文件 239 个测试全部通过
- 检查:
  - 包围盒:StuG x ±1.495(上限 1.625)、y −0.750 ~ 1.680(上限 1.76)、z 最远 2.952(上限 3.05)
  - 贴合:子 agent 把 StuG 的 176 个静态零件逐个检查,每个零件都有顶点落在别的零件 4 mm 以内或内部(4 个拖车耳板孔是误报,孔本来就穿过耳板);火炮在水平 ±10°、俯仰 −6° / +17° 范围内,防盾始终和战斗室相接
  - 截图:主程在机库里看了 StuG 的两侧和俯视、SU-100 的侧面、尾部和俯视,没有发现漂浮或错位的零件
- 需要负责人决定:
  - **StuG 显得偏高**:战斗室顶在 2.16 m(= 数据里的全高),加上车长指挥塔约 2.43 m。公开资料的全高 2.16 m 应该已经含指挥塔,说明 007 估算的车体盒高 1.5 m 偏高了约 0.2 m。改的话要动 007 的数据(车体盒高、战斗室高度都会影响命中判定),建议另开卡
  - 三角面数比其他车多:StuG 静态约 3.8k、负重轮 + 履带约 6.0k(其他车分别 2.4–2.7k、3.5–3.8k),主要是 12 个双负重轮和较密的履带节距。按 001 的帧率基线,目前不构成瓶颈
  - StuG 两侧翼的正面倾角(约 28°)、负重轮直径 520 mm、履带宽 400 mm、离地间隙 385 mm 为估算,写在 `stug3g.ts` 开头
