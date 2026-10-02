# 075-official-wording:回放文字和出处按 War Thunder 官方本地化文件更正

- 负责:Copilot(`auto`,即 mai-code)
- 状态:待领取
- 分支:`task/075-official-wording`
- 规模:S
- 主程授权的例外(负责人 10-03「主程只审查」):本卡可以改 `src/game/damage/DamageModel.ts` 里 `MISFIRE_MAX_CHANCE` 上方那段**注释**,不改代码

## 背景:069 的出处是编的

069 在 `docs/design/killcam.md` 的「回放文字对照表」里写的出处不能用:`https://wiki.warthunder.com/Damage_mechanics` 是 404,「官方简中本地化标准原文」没有任何链接,「065 误译」的说法也没有依据。主程已经查到**真正的官方本地化文件**:

`https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv`(War Thunder 官方语言文件的公开 datamine;每行格式 `"键";"English";"Français";…`,简体中文是第 11 列)。

### 命中回放用语(键 `hitcamera/result/*`,简体中文 / 繁体中文)

| 键 | English | 简体 | 繁体 |
|---|---|---|---|
| ricochet | Ricochet | 跳弹 | 跳彈 |
| bounce | Non-penetration | 未击穿 | 沒有穿透 |
| hit | Hit | 命中 | 擊中 |
| damage | Damage | 击伤 | 傷害 |
| burn | Fire | 引燃 | 引燃 |
| critical | Critical Hit | 重创 | 致命攻擊 |
| kill | Destroyed | 击毁 | 擊毀 |
| hull | Hull break | 外部主结构断裂 | 外部主結構斷裂 |
| ammo | Ammunition exploded | 弹药殉爆 | 彈藥殉爆 |
| fuel | Fuel exploded | 燃油爆炸 | 燃料爆炸 |
| crew | Crew knocked out | 乘员昏迷 | 乘員組昏迷 |

### 战斗中己方损伤提示用语(同一个文件;键 → 简体)

- `my_dmg_msg/tank_engine` 发动机受损;`tank_transmission` 传动机构受损;`tank_gun_barrel` 炮管损坏;`tank_cannon_breech` 炮闩损坏;`tank_engine_fire` 发动机起火。
- `hud_tank_driver_dead` 驾驶员昏迷,%02d:%02d 后恢复车辆控制;`hud_tank_gunner_dead` 炮手昏迷,%02d:%02d 后恢复射击控制;`hud_tank_loader_dead` 装填手昏迷,弹药装填时间增加;`hud_tank_commander_dead` 车长昏迷;`hints/commander_is_unconscious` 车长已昏迷,无法使用车长观瞄。
- `hud_gun_barell_malfunction` 注意,炮管已受损,继续发射弹药可能会导致炸膛;`hud_gun_breech_malfunction` 注意,炮闩已受损,继续发射弹药可能会导致战斗室爆炸。**也就是说 War Thunder 里炮管 / 炮闩受损的后果是「继续开火可能炸膛 / 战斗室爆炸」,没有「击发失败」这种说法**;我们的「击发失败」是负责人 10-03 的设计,保留。

## 要做的事

1. **命中回放顶部文字**(`src/ui/killcamOverlay.ts` 的文案常量和对应测试,`tests/killcam-overlay.test.ts`、`tests/killcam-text-grades.test.ts`):
   - 击穿但没伤到成员和模块:「击穿」→「命中」(官方 `hit`,录屏里这一档就是黄色 COUP);
   - 击伤成员 / 损坏模块:「命中」(负责人指定,保持);
   - 引燃:「引燃」(官方 `burn`,保持);
   - 点着火并击伤成员:**「致命攻击」保持**(负责人指定;官方简体是「重创」、繁体是「致命攻擊」)——把文案放在一个有注释的常量里(`CAPTION_CRITICAL`),注释写明官方简体是「重创」,负责人想换改这一个常量;
   - 击毁·乘员:「乘员组失去战斗力」→「乘员昏迷」(官方 `crew`);
   - 击毁·弹药殉爆:「弹药殉爆」(保持);跳弹、未击穿保持。
   `HitOutcome` 的分档和升级逻辑**不要改**(`penetrated` 和 `hit` 两档保留,只是文字相同)。
2. **`docs/design/killcam.md` 的「回放文字对照表」整节重写**:每一行写「键、English、简体、我们用的文字、说明」,出处统一写上面的 `menu.csv` 链接和键名;**删掉**所有 `wiki.warthunder.com/Damage_mechanics` 的假出处;「未建模」两行改成官方词:燃油爆炸(`fuel`)、外部主结构断裂(`hull`,对应负责人说的超压 / 结构断裂)、火烧致死 / 烤炸弹药(非直接击毁);「致命攻击 / 重创」那行写清楚负责人指定与官方的差别。
3. **`docs/design/hud-status.md`**(068 新增的)末尾加「官方用语对照」一节,把上面第二个清单整理成表(键、English、简体、我们现在用的文字),并写一句:我们沿用负责人 10-03 指定的文案,只有「炮闩受损,击发失败」这类官方没有的才算我们自己的设计。
4. **`MISFIRE_MAX_CHANCE` 的注释**(`DamageModel.ts`)和 `docs/physics-validation.md` 里 070 写的「击发失败」小节:把「wiki 没有找到具体数值」改成准确的说法——官方语言文件里炮管 / 炮闩受损的提示是「继续开火可能炸膛 / 战斗室爆炸」(键名见上),没有给哑火概率;「击发失败」是负责人 10-03 的设计,概率仍是估算(估算方法保持不变)。

## 允许修改的文件

- 修改:`src/ui/killcamOverlay.ts`、`tests/killcam-overlay.test.ts`、`tests/killcam-text-grades.test.ts`、`docs/design/killcam.md`、`docs/design/hud-status.md`、`docs/physics-validation.md`、`src/game/damage/DamageModel.ts`(只限注释)、本卡「结果」一节
- 新增:`changelog.d/<日期>-075-official-wording.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过;测试只改文案断言,不删不放宽
- [ ] `docs/design/killcam.md` 里不再出现 `Damage_mechanics`;每行有 `menu.csv` 出处和键名
- [ ] 回报里列出改了哪些文案

## 不做

- 不改分档逻辑、不改场景和相机;不新增机制。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
