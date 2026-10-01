# 017-us-reticle:美式瞄准镜分划

- 负责:Antigravity(Gemini 3.8 Flash High;车道:界面)
- 状态:待领取(012 合并后)
- 分支:`task/017-us-reticle`
- 规模:S

## 目标

三辆谢尔曼(012)暂时借用苏式分划。加一种美式分划,开镜时看到的是 M71D / M83D 望远镜那种样式。

## 背景与参考

- 分划在 `src/ui/SightOverlay.ts` 里画(`drawGerman` / `drawSoviet`,表尺刻度是 `drawRangeScale`),输入是 `SightState.reticle`;`main.ts` 把车辆数据里的 `sight.reticle` 传进去。
- 美式坦克望远镜分划的特点(以 M70 / M71 系列为准,画之前先找实物分划图核对):
  - 中央一个小十字或倒 V 形瞄准点;
  - 一条水平的密位刻度线,用来估提前量;
  - 中央下方一组竖排的横线(表尺线),对应不同距离,两侧标距离数字(百码 / 百米)。
- 分划要和现有两种一样跟着倍率缩放(看 `drawGerman` 里 `mil` 的用法),并且支持游戏里的表尺(`range`)。

## 允许修改的文件

- 修改:`src/data/types.ts`(**只把** `SightSpec.reticle` 的类型从 `'german' | 'soviet'` 扩成 `'german' | 'soviet' | 'us'`,负责人已同意改这一处热点文件)
- 修改:`src/ui/SightOverlay.ts`(加 `drawUS`)、`src/data/vehicles.ts`(三辆谢尔曼的 `reticle` 改成 `'us'`,删掉「暂用苏式」的注释)
- 新增:`tests/sight-us.test.ts`(可选)、`changelog.d/<日期>-017-us-reticle.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 谢尔曼开镜是美式分划,其他车不变;切换倍率、调表尺时分划正常
- [ ] 截图:4.3× 和 5× 各一张(放进结果)
- [ ] 分划样式的出处写进代码注释

## 不做

- 炮手潜望镜(M4A1 / M10)那种带弹道曲线的分划
