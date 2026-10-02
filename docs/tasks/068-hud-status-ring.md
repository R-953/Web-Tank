# 068-hud-status-ring:底部状态提示改版 + 圆环进度(顶替 / 维修 / 补给)

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/068-hud-status-ring`
- 规模:M
- 并行:069(命中回放文字)、070(击发失败机制)、071、072、073 与本卡互不依赖,**不要改它们的文件**
- 只改 `src/ui/Hud.ts`、`src/ui/hud/`(新增文件)、测试、日志。`GameEvent` 里的 `misfire` 变体已经由主程加好(见下),本卡只在 HUD 里消费它

## 目标

负责人 10-03 试玩后要求(参照 War Thunder):**战斗中的文字提示精简,只留己方的成员损伤和模块损毁,放在底部按钮栏上方;乘员顶替 / 维修用圆环进度代替文字。**

### 1. 底部状态提示(`updateMessages`,按钮栏上方那几行)

状态型提示(条件成立就一直显示,最多同时 3 条,按下面的优先级):

| 条件 | 文案(红 = 严重,黄 = 警告) |
|---|---|
| 着火 | 红「起火!」(正在灭火时改黄「正在灭火 3.2s」;没灭火器了红「起火!没有灭火器了」) |
| 发动机 hp ≤ 0 | 红「发动机受损,无法移动」 |
| 变速箱 hp ≤ 0 | 红「传动装置受损,无法移动」 |
| 发动机 / 变速箱受损但没报废 | 黄「发动机受损」/「传动装置受损」 |
| 炮闩 hp ≤ 0 | 红「炮闩损坏,无法开火」 |
| 炮管 hp ≤ 0 | 红「炮管损坏,无法开火」 |
| 履带断裂 | 红「履带断裂」(保留) |
| 某岗位没人(乘员阵亡且没人顶替、也没有正在进行的顶替) | 红「{岗位名}昏迷,无法{功能}」,见下表 |

岗位 → 功能(`CrewRole` 的取值以 `src/data/types.ts` 为准,表里没有的岗位用「无法操作{岗位名}负责的装置」兜底):

- 驾驶员 → 无法驾驶;炮手 → 无法瞄准和开火;装填手 → 无法装填;无线电员 / 机枪手 → 无法操作机枪 / 电台(按车上实际有的岗位)。
- **车长是特例**:文案固定「车长昏迷,无法使用超越控制」(超越控制这个机制等做冷战后期载具时再细化,现在只出文字)。

保留不动的提示:装填进度 / 弹药打光 / 「有模块被打坏 — 按 R 维修」这类操作提示。删掉:「无法开火(炮闩 / 炮管损坏或没有炮手)」这条笼统的(被上表取代)、「维修中 xx s(R 取消)」(被圆环取代)。

**瞬时提示**(出现 3.5 秒后消失,和状态提示共用这几行,瞬时的排在状态提示下面):
- 己方被击穿后,每个**受伤但没死**的乘员「{岗位名}受伤」(黄);**受损但没报废**的模块「{模块名}受损」(黄);**报废**的模块里不在上表的「{模块名}损坏」(红)。数据来自 `GameEvent` 里 `type: 'hit'` 且 `targetId === 'player'` 的 `replay.penetration.hits`,同一发里重复的名字去重。
- `type: 'misfire'` 且 `vehicleId === 'player'`:红「炮闩受损,击发失败」/「炮管受损,击发失败」(`part` 决定)。
- 弹药架被打坏没殉爆(`ammo-lost`):黄「弹药架受损,损失 N 发」。

纯逻辑写成不依赖 DOM 的函数放进 `src/ui/hud/hudStatus.ts`(`statusMessages(...)` 返回按优先级排好的 `{text, cls}[]`;`transientFromHit(...)`;一个小的 `MessageQueue` 管 3.5 秒过期),`Hud.ts` 只负责画。

### 2. 圆环进度 `ProgressRing`(`src/ui/hud/ProgressRing.ts`,新增)

在按钮栏上方、状态提示那一行里画**圆环**,中间一个符号(内联 SVG,线条风格,单色白 / 琥珀色),同时有多个时横向并排:

- **乘员顶替**:`damage.crew[i].swap = { to, remaining }` 存在时,进度 = `1 − remaining / CREW.swapTime`(`CREW` 在 `src/data/modules.ts`),中间符号是被顶替的岗位 `to`:驾驶员 = 方向盘,炮手 = 瞄准镜(圆 + 十字线),装填手 = 炮弹,车长 = 双筒望远镜,其他岗位 = 对应的简单图形或首字。**这个岗位正在被顶替时,不再显示对应的「xx昏迷」文字**,只画圆环。
- **维修**:`damage.repair` 存在时画扳手圆环,进度 = 已修 / 总量(`repair` 里没有总量就在 HUD 里记下维修开始时的 `remaining`),圆环**下方**加一行文字「正在修理,剩余:30秒」(剩余秒数 = `remaining / repairRate` 向上取整)。
- **补给(占点模式用)**:现在没有占点模式,**只做组件和图标**:`ProgressRing` 支持图标 `'ammo'`(炮弹)且 `label` 可省略(不显示文字),`Hud` 暴露一个 `setResupply(progress | null)` 方法画它,先不接任何逻辑;在 `docs/design/` 下新增 `hud-status.md` 一页说明三种圆环的数据来源、将来占点补给怎么接。
- `ProgressRing` 的接口:`new ProgressRing(parent)`、`set({ progress: number /*0..1*/, icon: RingIcon, label?: string, tone?: 'amber' | 'blue' })`、`hide()`;`RingIcon = 'driver' | 'gunner' | 'loader' | 'commander' | 'radio' | 'machinegunner' | 'repair' | 'ammo'`。圆环用 SVG `stroke-dasharray`,直径约 44 px。

### 3. 右上的信息流(feed)

- 删掉所有 `hit` 事件的文字行(`describeHit` 及只给它用的常量,没用到的删干净,别留死代码),击中敌方 / 被击中都不再往 feed 里写命中详情——命中信息改看回放。
- 保留「X 已摧毁(原因)」和敌方起火 / 殉爆的行。
- 维修、顶替、己方起火 / 灭火这几条 feed 行删掉(状态提示和圆环已经覆盖)。

## 背景与参考

- `src/ui/Hud.ts`:`updateMessages`(约 409 行)、`onEvent`(约 288 行)、`describeHit`(约 572 行);状态数据来自 `HudState.damage`(`DamageModel`:`crew[].swap`、`repair`、`repairRate`、`modules`、`fire`、`extinguishers`、`canFire`)。
- `GameEvent`:`misfire` 变体 = `{ type: 'misfire'; vehicleId: string; part: 'breech' | 'barrel' }`(070 负责在游戏里触发,本卡只消费;测试里手工构造事件)。
- 现有 HUD 的测试(`tests/` 里搜 `Hud`)要继续过;删文字行相关的断言如果属于被删功能,按任务卡改,在回报里列出。

## 允许修改的文件

- 修改:`src/ui/Hud.ts`
- 新增:`src/ui/hud/hudStatus.ts`、`src/ui/hud/ProgressRing.ts`、`tests/hud-status.test.ts`、`tests/progress-ring.test.ts`、`docs/design/hud-status.md`、`changelog.d/<日期>-068-hud-status-ring.md`(格式见 `changelog.d/README.md`)
- 修改:本卡「结果」一节
- 不要改 `Game.ts`、`Vehicle.ts`、`damage/**`、`main.ts`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] `hudStatus` 的纯函数测试:每一行状态文案的触发条件、优先级和 3 条上限、车长特例、顶替中不出「昏迷」、瞬时提示去重和 3.5 秒过期
- [ ] `ProgressRing` 的 jsdom 测试:进度 → `stroke-dashoffset`,有 / 无 `label`,`hide()`
- [ ] 用 `npm run dev` 打开 `?debug`,在浏览器里把己方打坏几个模块 / 乘员看一遍,回报里写看到了什么(截图更好)

## 不做

- 不实现占点模式、不实现超越控制;不改伤害模型。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
