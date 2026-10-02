# 064-info-card-fields:信息卡补质量、发动机功率、前进 / 倒车速度和弹药数

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/064-info-card-fields`
- 规模:M(数据 8 辆车 + 信息卡几行)
- 在 058–060(内构细化)合并之后再派:它们和本卡都改 `src/data/vehicles.ts`,本卡只加每辆车顶部的三个字段,不碰 `internals` 块

## 目标

负责人 10-02 给的信息卡参考图(War Thunder 的载具信息窗口)比我们现在的多几行:**质量、发动机功率(马力 @ 转速)、最大速度(前进 / 倒车)、每门武器的弹药数**。现在的信息卡有火力 / 瞄准 / 防护 / 机动 / 乘员五节,缺这几项。(参考图里的「可见度 %」「维修费用」「评级」「研发效率」是 WT 的经济 / 隐蔽系统,**不做**。)

## 背景与参考

- 主程已在 `src/data/types.ts` 的 `VehicleSpec` 加了三个**可选**字段,不要改它们的签名:
  ```ts
  mass?: number;                              // 战斗全重,kg
  enginePower?: { hp: number; rpm: number };  // 公制马力 PS 和对应转速 rpm
  reverseSpeed?: number;                      // 最大倒车速度,km/h
  ```
  这三个字段只用于显示,不参与物理计算(物理里的功率由 `maxSpeed` 反推)。
- `src/ui/menu/VehicleCard.ts` 的 `vehicleCardData(spec, skill)`:现有五节的生成逻辑;「机动」一节里有「最大速度」「转向」「起步加速度」。
- 数值规则见 AGENTS.md:有公开出处就写在注释里;查不到或查不准时直接用 War Thunder 官方 wiki 的设定并注明「War Thunder 值」;两者都没有时按新数据估算,标明「估算」并写出方法。agent 没有联网,**没把握的数一律写「估算」并说明方法,不要编出处**;主程会逐条核实。

## 要做的事

1. **数据**:给 8 辆车(`TIGER_I`、`T34_85`、`TIGER_II`、`SU_100`、`ISU_122`、三辆谢尔曼)各填 `mass`、`enginePower`、`reverseSpeed`,每个值旁边写注释(出处 / 估算方法)。**只在每辆车的顶层字段处加这三行,不要碰 `internals` 块**(058–060 在改)。
2. **信息卡**:
   - 「机动」一节增加:**质量**(`xx.x t`)、**发动机功率**(`xxxx hp @ xxxx rpm`)、**最大速度**一行改成「前进 / 倒车」两个数(`38 / 6 km/h`;没有 `reverseSpeed` 的车只显示前进);三个字段缺失时不显示对应行。
   - 「火力」一节增加:主炮弹药数(`弹药架容量` 行已有,保留)和**机枪弹药数**(`mg.rounds`,有则加一行「同轴机枪弹药 n 发」)。
3. 测试:`vehicleCardData` 在字段齐全 / 缺失时的行;数据层的测试(每辆车 `mass > 0`、功率与转速为正、倒车速度 ≤ 前进速度);已有的信息卡测试按新行为改并说明(不放宽)。

## 允许修改的文件

- 修改:`src/data/vehicles.ts`(只加三个顶层字段)、`src/ui/menu/VehicleCard.ts`
- 修改测试:`tests/vehicle-card.test.ts`(只增不删);新增 `tests/vehicle-extra-fields.test.ts`
- 新增:`changelog.d/<日期>-064-info-card-fields.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 上面第 3 条的测试都有;每个数据值旁边有出处 / 估算说明
- [ ] 主程会逐条核实数值出处,并在浏览器里看信息卡

## 不做

- 可见度、维修费用、评级;改 `types.ts`(已经加好);改物理或伤害。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
