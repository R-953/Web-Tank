# 020-lower-front-armor:车体正面分上下两块(首上 / 首下)

- 负责:Claude Code 定接口、改伤害判定 → Antigravity 补各车数据(两步,同一张卡)
- 状态:待领取
- 分支:`task/020-lower-front-armor`
- 规模:M

## 目标

现在车体正面只有一个厚度。很多车的首下比首上弱得多,比如虎王首上视线厚度 233 mm,首下 100 mm @ 50° 约 156 mm。历史上 SU-100、ISU-122 正面对付虎王主要打首下(010 的「需要负责人知道」)。把车体正面分成首上、首下两块,让「打首下」成为一种有效战术。

## 做法

1. **主程**(核心数据结构 + 伤害判定):`ArmorSpec` 加可选字段,命中车体正面时按命中点高度选首上或首下。
2. **Antigravity**:按公开资料给已有各车填首下数据,数值和出处写进 `docs/physics-validation.md`。

## 接口(主程第 1 步完成后定死)

```ts
// ArmorSpec 新增可选字段(草案)
/** 首下:命中点低于车体盒底 + height(m)时用这块的视线厚度;不设 = 整个正面都用 front */
lowerFront?: { thickness: number; height: number };
```

## 允许修改的文件

- 第 1 步(主程):`src/data/types.ts`、`src/game/Damage.ts`、`src/game/damage/**`、相关测试
- 第 2 步(Antigravity):`src/data/vehicles.ts`(各车的 `lowerFront`)、`docs/physics-validation.md`、`tests/realism.test.ts`(加用例)、`changelog.d/<日期>-020-lower-front-armor.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 新测试:BR-471(ISU-122)在 500 m 打虎王首上打不穿、打首下能打穿
- [ ] 每辆车的首下数据有出处,查不到的用 War Thunder 值并注明
- [ ] 模型不用改(首下只影响判定),但首下高度要和模型里的上下首板分界大致对得上

## 不做

- 炮塔正面分区(防盾 / 炮塔正面)
- 其他面的分区
