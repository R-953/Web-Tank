# 023-death-killcam:玩家被击毁时的回放

- 负责:Antigravity(Gemini 3.8 Flash High;车道:界面)
- 状态:待领取
- 分支:`task/023-death-killcam`
- 规模:S–M

## 目标

War Thunder 里自己被击毁后,会回放打死自己的那一发:炮弹飞来、击穿、车内哪些模块和乘员被打坏,并显示是谁打的。现在只有玩家击毁敌人时右上角有回放,玩家被击毁时什么都没有,直接弹结算。做完后:玩家被一发炮弹击毁 → 放大的回放画面 + 「被 <敌车名> 击毁」→ 播完再弹结算。

## 背景与参考

- 回放:`src/ui/KillCam.ts`。`play(replay)` 排队播放,`render()` 用主渲染器在右上角开小视口(`KILLCAM` 尺寸),标题和摘要由 `describe()` 生成。回放数据 `HitReplay` 在 `src/game/Game.ts` 里生成,`hit` 事件带 `shooterId` / `targetId` / `replay`(`replay.destroyed` = 这一发把车打掉了)。
- 触发:`src/main.ts` 约 519–534 行的事件循环。现在只有 `e.shooterId === player.id` 时播放;下面紧接着是结算延时(`RESULT_DELAY`)。
- 瞄准镜遮罩给右上角回放挖洞:`main.ts` 约 624 行的 `cutout`。
- 击毁者的车名:`g.vehicles` 里按 `e.shooterId` 找 `spec.name`。
- 设置里的「击杀回放」开关:`cfg().game.killCam`,关掉时两种回放都不播。

## 允许修改的文件

- 修改:`src/ui/KillCam.ts`
- 修改:`src/main.ts`(**只改**事件循环里触发回放的几行、结算延时的条件、`cutout` 的计算,负责人已同意)
- 修改:`src/ui/Hud.ts`(**只在**全屏回放期间隐藏会挡画面的部分,需要时才改)
- 新增:`tests/death-killcam.test.ts`、`changelog.d/<日期>-023-death-killcam.md`

## 接口 / 数据约定

```ts
// KillCam.ts
export type KillCamLayout = 'corner' | 'full';
export interface KillCamOptions {
  /** corner = 右上角小窗(击毁敌人,现状);full = 自己被击毁,铺满或接近铺满画面 */
  layout?: KillCamLayout;
  /** 标题,不传时用现在的「击毁回放 · <车名>」 */
  title?: string;
}
/** 回放视口(CSS 像素,左上角原点),render() 和 main.ts 的瞄准镜挖洞共用 */
export function killcamRect(layout: KillCamLayout, viewW: number, viewH: number): { x: number; y: number; w: number; h: number };

class KillCam {
  play(replay: HitReplay, opts?: KillCamOptions): void; // full 会清空队列、打断正在播的 corner 回放
  get layout(): KillCamLayout;                           // 当前回放的布局(没有回放时 'corner')
}
```

- 触发:`e.type === 'hit' && e.targetId === player.id && e.replay.destroyed && cfg().game.killCam` → `killcam.play(e.replay, { layout: 'full', title: \`被 ${击毁者车名} 击毁\` })`。击毁者找不到时标题用「被击毁」。
- 结算:原条件之外再等 `!killcam.active`,也就是回放播完才退出鼠标锁定、弹结算。回放开关关闭或不是被炮弹打死(比如被火烧死)时行为不变。
- full 布局:铺满画面或接近铺满(四周留一点边),相机取景和动画沿用现有逻辑(摄像机宽高比要跟着视口改)。HUD 如果有元素挡住回放,在回放期间隐藏。
- 现有 corner 回放的样子、时长不变。

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 新测试 `tests/death-killcam.test.ts`:`killcamRect('corner', …)` 和现在的右上角位置一致;`killcamRect('full', 1920, 1080)` 覆盖画面中心、宽度至少占 80%;(能在 jsdom 里构造的话)播 corner 时再播 full,`layout` 变成 'full'、队列清空
- [ ] 已有测试全部不变地通过(包括整局集成测试)

## 不做

- 回放跳过键
- 被火烧死、弹药架被火引爆时的回放(没有 HitReplay)
- 击毁者视角的第三人称跟随镜头

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
