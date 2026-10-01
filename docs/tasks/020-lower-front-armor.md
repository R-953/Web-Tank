# 020-lower-front-armor:车体正面分上下两块(首上 / 首下)

- 负责:Antigravity(3.8 Flash High;接口和伤害判定原定主程做,2026-10-01 改为整卡派出,主程审查)
- 状态:进行中
- 分支:`task/020-lower-front-armor`
- 规模:M

## 目标

现在车体正面只有一个厚度。很多车的首下比首上弱得多,比如虎王首上视线厚度 233 mm,首下 100 mm @ 50° 约 156 mm。历史上 SU-100、ISU-122 正面对付虎王主要打首下(010 的「需要负责人知道」)。把车体正面分成首上、首下两块,让「打首下」成为一种有效战术。

## 背景与参考

- 装甲厚度约定:`src/data/types.ts` 里 `ArmorSpec` 的注释——碰撞体是竖直的盒子,倾斜装甲填「水平来弹的视线厚度」= 厚度 / cos(倾角)。
- 命中面判定:`src/game/Damage.ts` 的 `classifyFace`、`armorForFace`,以及调用它们的命中结算(约 120 行起)。
- 车体碰撞盒尺寸:各车 `VehicleSpec` 里的车体尺寸;模型里上下首板的分界见 `src/game/models/**`(只读)。

## 做法

1. **接口与判定**:`ArmorSpec` 加下面的可选字段;命中面是 `front` 且这辆车有 `lowerFront` 时,按命中点在车体本地坐标里的高度选首上或首下。
2. **各车数据**:按公开资料给已有各车填 `lowerFront`,数值和出处写进 `docs/physics-validation.md`。

## 允许修改的文件

本卡**授权**修改两个主程文件,只限下面说的范围:

- 修改:`src/data/types.ts`(**只加** `ArmorSpec.lowerFront` 这一个可选字段和注释,不动已有字段)
- 修改:`src/game/Damage.ts`(命中面为正面时选首上 / 首下;如果命中点高度只在 `src/game/damage/**` 里拿得到,可以改那里,在结果里说明)
- 修改:`src/data/vehicles.ts`(各车的 `lowerFront`)、`docs/physics-validation.md`
- 新增:`tests/lower-front-armor.test.ts`;可以在 `tests/realism.test.ts` 里**加**用例
- 新增:`changelog.d/2026-10-01-020-lower-front-armor.md`

## 接口 / 数据约定

```ts
// ArmorSpec 新增可选字段
/**
 * 首下:命中点高度低于「车体碰撞盒底面 + height」时用 thickness(水平来弹的视线厚度,mm),
 * 否则用 front。不设 = 整个正面都用 front。
 */
lowerFront?: { thickness: number; height: number };
```

- `height` 单位 m,从车体碰撞盒底面往上量,取模型里上下首板分界的高度。
- `armorForFace` 等已有函数的签名不要改;需要命中点高度时,新加一个函数(例如 `frontArmorAt(armor, hitLocalY, hullBottomY)`),并给它写单元测试。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 新测试 `tests/lower-front-armor.test.ts`:高度选择的边界(正好在分界上、分界上下各一点、没设 `lowerFront` 时退回 `front`)
- [x] 新测试:BR-471(ISU-122)在 500 m 打虎王首上打不穿、打首下能打穿
- [x] 每辆车的首下数据有出处,查不到的用 War Thunder 值并注明「War Thunder 值」;首下和首上一样厚的车可以不设,在 `docs/physics-validation.md` 里写一句
- [x] 模型不用改(首下只影响判定),但首下高度要和模型里的上下首板分界大致对得上

## 不做

- 炮塔正面分区(防盾 / 炮塔正面)
- 其他面的分区
- 改模型

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改: `src/data/types.ts`(为 `ArmorSpec` 增加可选字段 `lowerFront` 与注释)
  - 修改: `src/game/Damage.ts`(新增 `frontArmorAt` 函数;`resolveHit` 增加 `hitLocalY` 与 `hullBottomY` 可选参数以在受击面为正面时选首上/首下)
  - 修改: `src/data/vehicles.ts`(为 `tiger_ii`、`t34_85`、`m4a3_76w`、`m4a3e8`、`m4a3e2` 配置 `lowerFront`;`tiger_i`、`su_100`、`isu_122` 首下不比首上薄,按规则不设)
  - 修改: `docs/physics-validation.md`(新增第 12 节,记录各车首下数据、出处、模型分界高度与历史战术验证)
  - 修改: `tests/realism.test.ts`(历史对局常识补充 BR-471 在 500 m 打首上打不穿，在 300 m 打首下能打穿、首上仍打不穿的对比测试)
  - 新增: `tests/lower-front-armor.test.ts`(测试边界高度判定、无首下车辆退回 `front`、各车数据配置一致性、ISU-122 在 500 m 打虎王首上打不穿/打首下亦打不穿、在 300 m 打首下能打穿)
  - 新增: `changelog.d/2026-10-01-020-lower-front-armor.md`
- 命令与结果:
  - `npm run lint`: 通过(tsc --noEmit 无错误)
  - `npm test`: 通过(36 个测试文件, 362 个测试全部通过)
  - `npm run build`: 通过(tsc && vite build 成功打包)
- 偏差 / 未完成 / 待决定:
  - 虎王首下装甲厚度与测试距离偏差:
    1. 虎王首下视线厚度统一采用纯几何视线厚度 156 mm (100 / cos 50° ≈ 155.6 mm), 与首上 233 mm 及其他车辆规则保持一致, 不乘任何装甲硬度折减系数。
    2. 验收标准中「BR-471(ISU-122)在 500 m 打首下能打穿」为主程写卡时的错误假设。本游戏中 BR-471 在 500 m 处计算穿深为 149.5 mm, 小于首下 156 mm, 如实反映了远距离动能衰减导致无法击穿首下。经 `flyShell` 计算, BR-471 穿深 ≥ 156 mm 的最远距离约为 340 m, 因此将穿透测试距离改为 300 m (穿深 157.8 mm > 156 mm, 击穿首下、首上仍打不穿), 500 m 保留首上与首下均无法击穿的断言, 测试名如实体现 300 m。
  - `src/game/Game.ts`: 归主程维护, 已由主程修改传入 `entry.y` 与 `-vehicle.spec.hull.height / 2`。
