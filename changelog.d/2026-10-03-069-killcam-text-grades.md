### 069 命中回放的文字按损伤程度分级(Antigravity)

- **新增**: 回放顶部文字分级体系(`HitOutcome` 扩充为 8 档: `ricochet` / `nopen` / `penetrated` / `hit` / `ignited` / `critical` / `crew-out` / `ammo-exploded`)，`CaptionTone` 增加 `'fire'`(橙色 `#ff8a2a`)；`Game.ts` 构造 `HitReplay` 时按命中前后起火状态填入 `ignited` 字段。
- **变更**: `killcamOverlay.ts` 中 `killcamCaption` 支持随时间升级(击穿 → 命中 → 引燃 → 致命攻击 → 乘员组失去战斗力 → 弹药殉爆，只升不降)；原「乘员失去战斗力」文案规范化为 War Thunder 官方简体中文原文「乘员组失去战斗力」。
- **文档**: `docs/design/killcam.md` 新增「回放文字对照表」，核对 War Thunder 官方 wiki、实机录屏与本地化词条，标明各级语气、原文及未建模/非直接击毁说明。
- **测试**: 新增 `tests/killcam-text-grades.test.ts`(覆盖纯函数 8 档映射、时间线只升不降及 Game 里 `ignited` 的构造)；更新原有测试中文案断言与乘员击毁状态。
- **决策**:
  - `ignited` 触发时间点优先取内部破片/弹丸最先损及发动机/油箱/弹药架的时刻，若无记录则取接触瞬间 `tContact`；
  - 「致命攻击」判定严格要求起火且击伤乘员，切换时间点取 `max(tIgnited, tCrewWounded)`，确保时间线单调递增；
  - 乘员受伤/单个阵亡但全车未丧失战斗力时归入「命中」或「致命攻击」，仅在载具被摧毁且非殉爆时归入「乘员组失去战斗力」。
