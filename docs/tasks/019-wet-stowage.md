# 019-wet-stowage:湿式弹药架降低殉爆和起火

- 负责:Antigravity(Gemini 3.8 Flash High;主程审查)
- 状态:待审查
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

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过,已有的伤害测试不变
- [x] 新测试:同样打坏一个满载弹药架,湿式的殉爆概率 = 干式 × `wetFactor`(用固定随机数或统计足够多次验证)
- [x] 系数有出处

## 不做

- 灭火、水套被打穿漏水之类的细节

## 结果

- 改动文件:
  - 修改:
    - `src/data/types.ts`: `ModuleSpec` 新增可选字段 `wet?: boolean`
    - `src/data/damage.ts`: `DAMAGE.ammo` 新增 `wetFactor: 0.18` 与出处注释
    - `src/game/damage/DamageModel.ts`: 弹药架被打坏殉爆判定和起火 cook-off 判定中对 `wet: true` 乘上 `DAMAGE.ammo.wetFactor`
    - `src/data/vehicles.ts`: 三辆谢尔曼(`M4A3_76W`、`M4A3E8`、`M4A3E2`)的车体底板弹药箱(`ammo_floor_l` / `ammo_floor_r`)标记为 `wet: true`,炮塔待发弹架(`ammo_ready`)无水套保持干式
    - `docs/physics-validation.md`: 补充 11.5 节,记录 1945 年美军战损调查出处与折减系数定值,注明底板为湿式、待发弹架为干式
    - `docs/tasks/019-wet-stowage.md`: 更新状态为待审查,勾选验收标准,填写结果
  - 新增:
    - `tests/wet-stowage.test.ts`: 7 个单元测试,验证底板 wet / 待发干式配置、确定性模式表现、固定随机数阈值校验、10,000 次蒙特卡洛统计检验及起火 cook-off 折减
    - `changelog.d/2026-10-01-019-wet-stowage.md`: 开发日志
- 运行命令与结果:
  - `npm run lint`: 通过(tsc --noEmit 无错误)
  - `npm test`: 通过(26 个测试文件全部通过,共 262 项测试全部通过)
  - `npm run build`: 通过(生产构建成功输出 dist/)
- 和任务卡不一致的地方、没做完的部分、需要负责人决定的问题:
  - **审查返工与偏差**:主程审查指出湿式改进仅针对车体底板的弹药箱(`ammo_floor_l` / `ammo_floor_r`),炮塔里的待发弹架(`ammo_ready`)没有水套、按干式处理。主程已在 `src/data/vehicles.ts` 中将 `ammo_ready` 设为干式。执行者同步调整了 `tests/wet-stowage.test.ts`(第一项断言明确校验待发弹架为干式、底板弹药架为 wet,其余用例统一取底板弹药架作为湿式样本)及文档说明。

