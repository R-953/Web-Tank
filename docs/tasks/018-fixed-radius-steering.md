# 018-fixed-radius-steering:受控差速器的固定半径转向(谢尔曼不能原地转)

- 负责:Antigravity(Gemini 3.8 Flash High;主程审查)
- 状态:已合并
- 分支:`task/018-fixed-radius-steering`
- 规模:S–M

## 目标

谢尔曼用受控差速器转向:左右履带速度比固定,转向半径固定,**停着的时候转不了**(003 调研第 4 节、012 的「待决定」)。现在所有车都按 `turnRate` 原地转。加一个可选的转向半径,让谢尔曼行驶中按固定半径转弯、静止时不能原地转。

## 背景与参考

- 转向在 `src/game/Vehicle.ts` 的 `maxYawRate` / `targetYawRate` 一段(约 560 行):目标角速度 = 转向输入 × `turnRate`,受损伤系数影响;`steerInput()` 处理倒车时的转向方向(008)。
- 资料(afvdatabase,转载 Hunnicutt):最小转向直径 M4A3(76)W / M4A3E8 62 ft = 19 m,M4A3E2 74 ft = 22.5 m。
- 物理:转向半径 R 固定时,角速度 = 车速 / R。19 m 直径、10 km/h 时约 17°/s。

## 接口(主程定)

```ts
// HullSpec 新增可选字段
/** 固定转向半径,m(受控差速器等):设了以后角速度 ≤ |车速| / turnRadius,静止时不能原地转;不设 = 能原地转 */
turnRadius?: number;
```

角速度上限 = min(`turnRate`, |车速| / `turnRadius`),方向规则不变(倒车时仍按 008 的汽车习惯)。

## 允许修改的文件

- 修改:`src/data/types.ts`(**只加**上面这个可选字段,负责人已同意)、`src/game/Vehicle.ts`(只改转向那一段,负责人已同意)、`src/data/vehicles.ts`(三辆谢尔曼加 `turnRadius`:9.5 / 9.5 / 11.25)
- 修改:`tests/steering.test.ts`(加用例,不改已有用例)
- 新增:`changelog.d/<日期>-018-fixed-radius-steering.md`

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过,已有的转向测试全部不变地通过
- [x] 新测试:谢尔曼静止时按住转向 3 秒,航向变化 < 1°;以 10 km/h 行驶时的转弯半径在 19 m 直径 ±15% 以内;其他车行为不变
- [x] AI 控制的车如果用到谢尔曼,也不会卡死在原地(检查 `src/game/Controllers.ts` 里 AI 的驾驶逻辑有没有依赖原地转向,有就在结果里写明)

## 不做

- 其他车的转向机构(虎式的再生式转向等)
- 转向时的速度损失

## 结果

- 改动文件(全部在允许修改的范围内):
  - `src/data/types.ts`: `HullSpec` 新增可选字段 `turnRadius?: number;`
  - `src/game/Vehicle.ts`: `drive()` 转向角速度上限按公式引入 `turnRadius` 约束 `Math.min(maxTurnRate, Math.abs(newFwd) / turnRadius)`
  - `src/data/vehicles.ts`: 为三辆谢尔曼(`M4A3_76W`、`M4A3E8`、`M4A3E2`)添加 `turnRadius`(9.5 / 9.5 / 11.25)
  - `tests/steering.test.ts`: 新增 3 个受控差速器测试用例(静止转向 3 秒航向变化 < 1°、10 km/h 行驶转向半径在 19 m 直径 ±15% 以内、未配置 `turnRadius` 的车辆原地转向行为不变)
  - `changelog.d/2026-10-01-018-fixed-radius-steering.md`: 新增开发日志
  - `docs/tasks/018-fixed-radius-steering.md`: 填写验收结果与状态
- 命令与结果:
  - `npm run lint`: 通过 (`tsc --noEmit` 0 错误)
  - `npm test`: 25 个测试文件 258 个测试全部通过 (原 255 + 新增 3)
  - `npm run build`: 构建成功 (`dist/` 输出正常)
- AI 驾驶逻辑检查(`src/game/Controllers.ts`):
  - `StaticController` 仅输出静止指令(`steer: 0, throttle: 0`);
  - `PatrolController` 沿两点间直线往返巡逻,无转向操作(`steer: 0`);
  - `GunnerAI` 仅在固定战斗室车辆(`casemate`)射界受限时进行停车转向;谢尔曼为 360° 旋转炮塔车辆(`casemate` 为 false, `canTraverseTo` 恒为 true),AI 驾驶谢尔曼时无原地转向依赖,不会卡死在原地。
- 偏差与未做完事项: 无偏差,所有要求均已完成。

