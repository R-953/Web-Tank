# 079-wording-and-notes:「致命攻击」改回语言文件的「重创」,更正对击发失败和出处的措辞

- 负责:Copilot(`auto`,即 mai-code)
- 状态:待领取
- 分支:`task/079-wording-and-notes`
- 规模:S
- 主程授权的例外(负责人 10-03「主程只审查」):可以改 `src/game/damage/DamageModel.ts` 里 `MISFIRE_MAX_CHANCE` 上方的**注释**,不改代码
- 077、078 同时在改别的文件,不要碰 `src/ui/Hud.ts`、`src/ui/WorldXray.ts`、`src/ui/WorldReplay.ts`、`src/main.ts`

## 背景

1. 负责人 10-03 看了 075 的出处说明:「那个仓库更可能是玩家无偿维护的,不过一个文字显示完全无所谓,那就按照这个仓库中的来吧」。所以**回放里「点着火并击伤成员」那一档改回仓库(语言文件)里的简体写法「重创」**(之前为了照负责人原话用的是「致命攻击」)。仓库里该档的键是 `hitcamera/result/critical`:简体「重创」、繁体「致命攻擊」。
2. 075 在多处写了「War Thunder 里没有『击发失败』这种说法」「官方没有击发失败」。**这个说法不对,要改**:语言文件里确实只有「继续开火可能炸膛 / 战斗室爆炸」的警告(`hud_gun_barell_malfunction` / `hud_gun_breech_malfunction`),没有击发失败的文案;但语言文件只含文字,**不能说明游戏里没有击发失败的机制**,负责人在实战里多次遇到过。另外,炮管 / 炮闩故障导致哑火或炸膛在现实中也是合理的(负责人的设计依据)。所以措辞改成:「语言文件里没有击发失败的文案,只有炸膛警告;击发失败是负责人 10-03 的设计(依据:游戏实战中多次遇到、现实中炮管 / 炮闩故障也会造成哑火或炸膛),概率是估算」。
3. 把「官方语言文件」的说法改准确:这个仓库是**社区维护的拆包数据**(`gszabi99/War-Thunder-Datamine`,内容取自游戏自己的语言文件,但仓库本身不是官方的),文档里写「游戏语言文件(社区 datamine)」,不要写成「官方仓库」。

## 要做的事

1. `src/ui/killcamOverlay.ts` 的 `CAPTION_CRITICAL`:「致命攻击」→「重创」;注释里写明:来自 `hitcamera/result/critical` 的简体(繁体是「致命攻擊」),负责人 10-03 同意按仓库写法。相关测试(`tests/killcam-overlay.test.ts`、`tests/killcam-text-grades.test.ts`)里的文案断言同步改;**不删不放宽**。
2. `docs/design/killcam.md`「回放文字对照表」:「致命攻击 / 重创」那一行改成直接写「重创」,去掉「负责人指定与官方不同」的说明,改成「按语言文件写法(负责人 10-03 同意)」;出处说明里把「官方」改成「游戏语言文件(社区 datamine)」。
3. `docs/design/hud-status.md` 末尾的「官方用语对照」一节:标题改成「游戏语言文件用语对照」,按上面第 2、3 点改措辞(击发失败那句)。
4. `docs/physics-validation.md` 里 070 / 075 写的「击发失败」小节、`src/game/damage/DamageModel.ts` 里 `MISFIRE_MAX_CHANCE` 的注释:按第 2 点改措辞,估算方法保持不变。
5. 在 `docs/design/hud-status.md` 加一小节「后续可选:炸膛」:War Thunder 语言文件的警告是「继续发射可能炸膛(炮管)/ 战斗室爆炸(炮闩)」,如果负责人以后想加,可以在炮管 / 炮闩受损时给开火一个小概率的炸膛后果(伤及乘员或炸坏模块);**现在不做**,只记一笔。

## 允许修改的文件

- 修改:`src/ui/killcamOverlay.ts`(只改常量和注释)、`tests/killcam-overlay.test.ts`、`tests/killcam-text-grades.test.ts`、`docs/design/killcam.md`、`docs/design/hud-status.md`、`docs/physics-validation.md`、`src/game/damage/DamageModel.ts`(只限注释)、本卡「结果」一节
- 新增:`changelog.d/<日期>-079-wording-and-notes.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过;测试只改文案断言
- [ ] 仓库里不再出现「官方没有击发失败」「War Thunder 里没有击发失败」这类说法(`grep -rn "没有「击发失败」\|没有击发失败" docs src` 看一遍),也不再把 datamine 仓库写成「官方」
- [ ] 回报里列出改了哪些文案

## 不做

- 不实现炸膛;不改分档和升级逻辑。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
