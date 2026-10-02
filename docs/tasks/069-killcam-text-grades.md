# 069-killcam-text-grades:命中回放的文字按损伤程度分级(引燃 / 致命攻击 / 击毁原因)

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/069-killcam-text-grades`
- 规模:M
- 并行:068、070、071、072、073 与本卡互不依赖;`HitReplay.ignited?` 字段已经由主程加好(见下),本卡负责在游戏里把它填对
- 主程授权的例外(负责人 10-03「主程只审查」):本卡可以改 `src/game/Game.ts` 里**构造 `HitReplay` 的那一段**,以及(只在确实需要时)`src/game/damage/**` 里为取到「这一发是否点着了火」所需的最小改动;别的地方不要动

## 目标

负责人 10-03 试玩后要求,回放顶部大字按 War Thunder 的做法随损伤程度分级:

| 情形 | 文字 | 语气 |
|---|---|---|
| 跳弹 | 跳弹(保持) | info |
| 未击穿 | 未击穿(保持) | info |
| 击穿但没伤到成员和模块 | 击穿(保持) | hit(黄) |
| 击伤成员,或损坏模块 | **命中** | hit(黄) |
| 打中发动机 / 油箱 / 弹药架,把目标点着了 | **引燃**(War Thunder 的原文是「引燃」/「点燃」,按下面查到的为准) | severe(橙红) |
| 点着了火,**并且**击伤成员 | **致命攻击** | severe(红) |
| 击毁:成员组失去战斗力 | **乘员组失去战斗力**(目前的「乘员失去战斗力」按查到的原文改) | severe |
| 击毁:弹药殉爆 | **弹药殉爆** | severe |

击毁方式还有「弹药烧毁、燃油爆炸、超压导致外部柱结构断裂」等,**当前游戏没有建模燃油爆炸和超压**,不要做;弹药被火烤殉爆、火烧死乘员这类要等「着火之后几秒才死」,不是这一发直接造成的,**回放里不处理**,在 `docs/design/killcam.md` 的新表格里标明「未建模 / 非直接击毁」就行。

文字仍然**随时间升级**(沿用现有时间线:击穿 → 命中 → 引燃 → 致命攻击 → 击毁原因,每一档在对应事件发生的时间点切换,只升不降)。引燃发生的时间点 = 这一发里第一个伤到发动机 / 油箱 / 弹药架的时间(没有就取接触时刻)。

## 第一步:查原文(有出处才能写)

用这些来源核对 War Thunder **简体中文**的命中回放用语,把查到的原文、出处链接和你的取舍写进 `docs/design/killcam.md` 新增的「回放文字对照表」一节,**查不到的不要编**,保持上表里的文字并注明「负责人给的说法」:

- 官方 wiki(`https://wiki.warthunder.com/`)的伤害模型、起火 / 弹药殉爆相关页面;
- 第三方中文 wiki(搜索「战争雷霆 命中回放 / X 光 / 致命攻击 / 引燃」);
- 游戏本地化文件的公开 datamine(GitHub 上 `gszabi99/War-Thunder-Datamine` 的 lang 目录里与 hitcamera / 命中回放相关的条目)。

提示:WebFetch 会把表格两栏的数字糊在一起,抓网页用 `curl -sL <url>` 再去标签读;只引文字,别大段复制。

## 要做的事

1. `src/game/Game.ts`:构造 `HitReplay` 时填 `ignited`(命中前目标没着火、命中后着火了;AI 和玩家的命中都要填对)。
2. `src/ui/killcamOverlay.ts`:`HitOutcome` 扩成 `'ricochet' | 'nopen' | 'penetrated' | 'hit' | 'ignited' | 'critical' | 'crew-out' | 'ammo-exploded'`(弱 → 强),`hitOutcome` / `ratioAt` / `killcamCaption` 按上表升级;语气 `CaptionTone` 如需要可增加 `'fire'`(橙),`kco-` 样式同步。
3. `src/ui/KillCam.ts`:只改喂给文字层的那一小段(如果文字层的接口变了);**不要动场景和相机**(071 / 072 在改)。
4. 旧测试里文字断言(「乘员失去战斗力」等)按新文案改,并在回报里列出。

## 背景与参考

- `docs/design/killcam.md`:War Thunder 回放的设计要点;`src/ui/killcamOverlay.ts`:065 的实现;`src/game/Game.ts` 里的 `HitReplay`、`hit` 事件的构造位置;`src/game/damage/DamageModel.ts`(起火:`fire`、`ignite` 一类逻辑)。
- 乘员「被击伤」 = `penetration.hits` 里 `kind === 'crew'` 且 `hpAfter < hpBefore`(含阵亡);模块「损坏」 = `kind === 'module'` 且血量下降。

## 允许修改的文件

- 修改:`src/ui/killcamOverlay.ts`、`src/ui/KillCam.ts`(见上)、`src/game/Game.ts`(见上)、`docs/design/killcam.md`、`tests/` 里相关测试
- 新增:`tests/killcam-text-grades.test.ts`、`changelog.d/<日期>-069-killcam-text-grades.md`
- 修改:本卡「结果」一节

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 纯函数测试覆盖上表每一行(含只升不降、点着火 + 击伤成员 = 致命攻击、点着火没伤人 = 引燃、击伤成员没起火 = 命中)
- [ ] `Game` 里 `ignited` 的测试:打油箱 / 发动机把目标点着 → true;没点着 → false;命中前就着火 → false
- [ ] `docs/design/killcam.md` 有「回放文字对照表」,每行有出处

## 不做

- 不做燃油爆炸、超压、弹药烧毁等未建模的击毁方式;不改回放的场景和镜头。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
