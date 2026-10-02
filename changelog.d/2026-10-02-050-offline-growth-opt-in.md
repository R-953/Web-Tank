### 050 离线挂机成长改成手动开启(Antigravity)

- **新增**:
  - `GameSettings.game.offlineGrowth` 布尔字段,默认值为 `false`;`sanitize` 校验老存档与非布尔非法值均回退为 `false`。
  - 设置面板「游戏」页增加「离线挂机成长」开关及说明文字。
  - `tests/settings.test.ts` 与 `tests/offline-growth-setting.test.ts` 补充缺省、非法值清洗、保存读回与面板切换测试。
- **决策**:按任务卡规范接口与说明文案,保持 `main.ts` 不修改交由主程后续接线。
- **待确认**:无
