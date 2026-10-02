### 076 把世界内 X 光(O 键)和叠在世界里的死亡回放接进游戏(Antigravity)

- **新增**:
  - `src/ui/worldReplayFlow.ts`: 纯逻辑流控制函数，涵盖 `useWorldReplay` (世界内/窗口死亡回放样式分流)、`xrayFadeTarget` (开镜淡出至 0、退出恢复至 1)、`internalsDisplayMode` (样式与状态判定)、`canShowResult` (胜负结算等待时间与回放活跃状态校验)、`shouldUpdateFollowCamera` (相机交接控制) 与 `isBattleHudVisible` (HUD 遮挡屏蔽)。
  - `tests/world-replay-flow.test.ts`: 针对纯函数的全部分支测试覆盖。
- **变更**:
  - `src/main.ts`:
    - 接入 `WorldXray(player)`: `game.internalsStyle === 'world'` 时按 O 键在车体上开启 X 光；开镜时淡出避免遮挡瞄准镜；打开地图界面、暂停、己方被击毁、重开、回机库时均 `disable()` 还原材质。
    - 接入 `WorldReplay`: `game.deathReplayStyle === 'world'` 且己方被击毁时，叠在世界场景中播放残骸回放；主相机由 `WorldReplay` 驱动并跳过跟随相机更新，隐藏准星与小地图等遮挡画面的 HUD；播完延迟 0.5s 后交还相机控制权。
    - 结算画面：要求 `!killcam.active && !worldReplay.active` 均满足才弹出。
    - `__debug` 暴露 `worldReplay` 与 `worldXray` 辅助调试。
  - `src/ui/menu/SettingsPanel.ts`:
    - `killCamAll` 设置项文案更新为「命中敌方时都回放(关闭后只回放击毁)」。
- **决策**:
  - 严格保持 `WorldReplay` 与 `WorldXray` 既有接口及 `Vehicle` 现有结构不变；回放流和淡出逻辑抽离为纯函数，确保纯逻辑单测完备。
- **待确认**: 无
