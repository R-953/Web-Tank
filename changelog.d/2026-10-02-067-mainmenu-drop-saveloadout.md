### 067 删掉 MainMenu 里没人用的 saveLoadout 选项(Copilot CLI)

- **新增 / 变更 / 修复**:移除 `MainMenuOptions.saveLoadout` 及 `MainMenu` 构造参数中的无用传值;保留 `MapScreen` 的携弹保存逻辑。
- **决策**:携弹保存只由地图界面使用,机库仍保留 `loadLoadout` 读取当前载具携弹。
- **待确认**:无。
