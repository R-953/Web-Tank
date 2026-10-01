# 019-wet-stowage:湿式弹药架降低殉爆和起火

- 负责:Antigravity(Gemini 3.8 Flash High;主程审查)
- 状态:待领取(012 合并后)
- 分支:`task/019-wet-stowage`
- 规模:S–M

## 目标

谢尔曼「W」型的弹药放在带水套的弹药箱里,被击穿后起火、殉爆的概率比干式弹药架低得多(003 第 9.2 节)。现在殉爆概率只看剩余弹数。给弹药架加「湿式」标记,湿式架的殉爆概率按史料打折。

## 背景与参考

- 殉爆:`src/data/damage.ts` 的 `ammo.detonationChance`(被打坏时)和 `fire.cookOffChance`(着火后每秒),使用处在 `src/game/damage/DamageModel.ts`(约 375 行)。
- 史料线索:Wikipedia「M4 Sherman」引 1945 年美军的统计,干式弹药架的谢尔曼被击穿后起火约 60–80%,湿式约 10–15%。**先打开条目源码核对原文和出处**,按核对后的数字定折扣系数(例如 12.5% / 70% ≈ 0.18),写进 `damage.ts` 的注释和 `docs/physics-validation.md`。查不到可引用的数字就停下来写进「结果」,不要自己编。

## 接口(主程定)

```ts
// ModuleSpec 新增可选字段
/** 湿式弹药架(带水套):殉爆、着火殉爆概率乘 DAMAGE.ammo.wetFactor */
wet?: boolean;
```

`DAMAGE.ammo` 加 `wetFactor`,两处殉爆概率(被打坏时、着火后每秒)都乘上它。

## 允许修改的文件

- 修改:`src/data/types.ts`(**只加**上面这个可选字段)、`src/data/damage.ts`、`src/game/damage/DamageModel.ts`(只改殉爆概率那两处,负责人已同意)、`src/data/vehicles.ts`(三辆谢尔曼的弹药架加 `wet: true`)
- 修改:`docs/physics-validation.md`(加一小节:系数和出处)
- 新增:`tests/wet-stowage.test.ts`、`changelog.d/<日期>-019-wet-stowage.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过,已有的伤害测试不变
- [ ] 新测试:同样打坏一个满载弹药架,湿式的殉爆概率 = 干式 × `wetFactor`(用固定随机数或统计足够多次验证)
- [ ] 系数有出处

## 不做

- 灭火、水套被打穿漏水之类的细节
