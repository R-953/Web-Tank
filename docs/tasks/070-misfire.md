# 070-misfire:炮闩 / 炮管受损时概率击发失败

- 负责:Antigravity(Opus 4.6,`claude-opus-4-6-thinking`)
- 状态:待领取
- 分支:`task/070-misfire`
- 规模:S–M
- 并行:068(HUD 消费 `misfire` 事件)、069、071、072、073 与本卡互不依赖
- 主程授权的例外(负责人 10-03「主程只审查」):本卡可以改 `src/game/Game.ts`、`src/game/Vehicle.ts`、`src/game/damage/**` 里**开火流程和炮闩 / 炮管状态**相关的最小范围;`GameEvent` 里的 `misfire` 变体主程已经加好,不要改它的形状

## 目标

负责人 10-03 要求(参照 War Thunder):**炮闩或炮管受损(没报废)时,开火有概率失败**——炮没响,界面显示「炮闩受损,击发失败」/「炮管受损,击发失败」(文案由 068 的 HUD 做,本卡只发事件)。炮闩 / 炮管报废时仍然是现有的「无法开火」。

## 规则

1. 只对**主炮**生效(机枪不管),玩家和敌方 AI 用同一套逻辑(敌方也会哑火)。
2. 击发失败的概率:查 War Thunder 官方 wiki 的伤害模型(`https://wiki.warthunder.com/`)里炮闩 / 炮管受损对开火的影响,有数值就用并在注释里写「War Thunder 值」+ 链接;**查不到就估算**:`P = MISFIRE_MAX_CHANCE × (1 − 模块血量比例)`,取炮闩和炮管两者中较大的一个,`MISFIRE_MAX_CHANCE = 0.5`(估算:模块只剩一点血时约一半概率哑火;写进代码注释和 `docs/physics-validation.md` 的新小节,说明这是估算以及怎么估的)。模块满血 = 0。
3. 击发失败时:**不发射炮弹、不消耗炮膛里的弹、没有后坐力和炮口焰**,发一个 `misfire` 事件(`part` = 概率更大的那个模块;两者相同取炮闩),并且 1 秒内不能再次击发(`MISFIRE_COOLDOWN = 1`,估算:防止按住开火键时每帧重新掷骰;常量,可调)。
4. 随机数用 `Game` 现有的带种子随机,保证测试可复现(`GameConfig.seed`)。
5. 不要因此改变现有的装填、瞄准、弹药架逻辑。

## 背景与参考

- `src/game/damage/DamageModel.ts`:`canFire`、`efficiency('barrel' | 'breech')`、模块 `hp / maxHp`;`src/game/Game.ts` 和 `src/game/Vehicle.ts` 里主炮开火的位置(搜 `fired`、`fireMain`、`loaded`);敌方 AI 开火走同一个入口还是另一个,先确认。
- 音效 / 特效对 `fired` 事件有反应,`misfire` 是新事件,默认不触发它们,不用改。

## 允许修改的文件

- 修改:`src/game/Game.ts`、`src/game/Vehicle.ts`、`src/game/damage/DamageModel.ts`(只限上面说的范围)、`docs/physics-validation.md`
- 新增:`tests/misfire.test.ts`、`changelog.d/<日期>-070-misfire.md`
- 修改:本卡「结果」一节

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过(现有测试不改)
- [ ] 测试:满血不会哑火;模块血量越低概率越高(用固定种子跑多次,统计落在合理范围);哑火时不产生炮弹、不消耗弹、发 `misfire` 且 `part` 正确;冷却期内不能再击发;报废仍是 `canFire = false`;敌方同样会哑火
- [ ] `physics-validation.md` 里写明概率的出处或估算方法

## 不做

- 不做哑火后的「重新装填」惩罚;不做机枪哑火;不改 HUD(068 做)。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
