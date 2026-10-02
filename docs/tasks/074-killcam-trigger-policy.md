# 074-killcam-trigger-policy:回放触发规则——己方被击中不弹小窗,只有被击毁才播

- 负责:Copilot(`auto`,即 mai-code)
- 状态:待领取
- 分支:`task/074-killcam-trigger-policy`
- 规模:S
- 主程授权的例外(负责人 10-03「主程只审查」):本卡可以改 `src/main.ts` 里**命中回放触发**那一小段(约 786–805 行的 `for (const e of g.drainEvents())` 里 `e.type === 'hit'` 分支),别的地方不要动

## 目标

负责人 10-03 试玩后确认 War Thunder 的机制:**己方被命中时(除非一发就被带走)不显示右上角的命中回放,只有己方被击毁时才播(全屏)。** 我们现在的做法是被击中没死也在右上角弹小窗,要改掉。

把触发决策从 `main.ts` 里抽成不依赖 DOM 的纯函数 `killcamPlan`(新文件 `src/ui/killcamPolicy.ts`),`main.ts` 调用它:

```ts
export interface KillcamPolicyInput {
  playerId: string;
  shooterId: string;
  targetId: string;
  targetName: string;
  /** 击毁者的车名(查不到就 undefined) */
  killerName?: string;
  /** 这一发把目标打毁了(replay.destroyed) */
  destroyed: boolean;
  /** 设置:命中回放总开关 / 所有命中都回放 */
  killCam: boolean;
  killCamAll: boolean;
}
/** null = 不播;否则是传给 killcam.play 的选项 */
export type KillcamPlan = null | { layout?: 'full'; title?: string };
export function killcamPlan(i: KillcamPolicyInput): KillcamPlan;
```

规则(`killCam` 为 false 一律不播):

1. 玩家打中别人(`shooterId === playerId`):击毁 → `{}`(右上角小窗,不带标题);没击毁且 `killCamAll` → `{ title: '命中回放 · ' + targetName }`;没击毁且没开 `killCamAll` → null。
2. 别人打中玩家(`targetId === playerId`):**只有击毁才播**,`{ layout: 'full', title: killerName ? '被 ' + killerName + ' 击毁' : '被击毁' }`(和现在的文案一致,注意现在 `被 ${名字} ` 后面带一个空格,抽出来时保持最终显示一致);没击毁 → **null**(不管 `killCamAll` 开没开)。
3. 其他(AI 打 AI)→ null。

`main.ts` 只负责取 `killerName`(`g.vehicles.find(...)?.spec.name`)、调 `killcamPlan`、有结果就 `killcam.play(e.replay, plan)`;`stats.hits++` 的统计保持原样。

## 背景与参考

- `src/main.ts` 约 786–805 行(现在的触发逻辑);`src/ui/KillCam.ts` 的 `KillCamOptions`(`layout`、`title`);`tests/killcam-setting.test.ts`(设置测试,不用改)。
- `docs/design/killcam.md`「我们怎么落地」一节:把「被击中没死在右上角小窗播」那句改成新规则。

## 允许修改的文件

- 新增:`src/ui/killcamPolicy.ts`、`tests/killcam-policy.test.ts`、`changelog.d/<日期>-074-killcam-trigger-policy.md`(格式见 `changelog.d/README.md`)
- 修改:`src/main.ts`(只限上面说的那一段)、`docs/design/killcam.md`、本卡「结果」一节
- 不要改 `SettingsPanel.ts` / `Settings.ts`(073 在改)

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过,既有测试不改
- [ ] `tests/killcam-policy.test.ts` 覆盖:总开关关 → 一律 null;玩家击毁目标 / 命中未击毁(开 / 关 `killCamAll`);己方被击毁 → 全屏 + 文案(有 / 没有击毁者名字);己方被击中未击毁 → null(`killCamAll` 开着也是 null);AI 打 AI → null

## 不做

- 不改回放本身、不接世界内回放(下一波做)。

## 结果(完成后由执行者填写)

- 改动文件:新增 `src/ui/killcamPolicy.ts`、`tests/killcam-policy.test.ts`、`changelog.d/2026-10-03-074-killcam-trigger-policy.md`;修改 `src/main.ts`、`docs/design/killcam.md`、本任务卡。
- 命令与结果:`npm run lint` 通过;`npm test` 通过(83 个测试文件、882 项测试);`npm run build` 通过。
- 偏差 / 未完成 / 待决定:无。
