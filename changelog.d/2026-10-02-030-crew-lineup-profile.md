### 030 车组与编组的存档(Antigravity)

- **新增**:
  - `src/settings/Profile.ts`: 车组与编组数据层及本机存储实现。包含默认存档生成 (`defaultProfile`)、熟练度判定 (`proficiency`)、载具分配与规则校验 (`assignVehicle`)、车组选择 (`selectCrew`)、编组增删与重命名 (`addLineup` / `renameLineup` / `removeLineup` / `setActiveLineup`)、国家切换 (`setActiveNation`)、出战载具读取 (`activeVehicleId`)、离线成长补算 (`advanceTime`)、存档清洗 (`sanitizeProfile`) 以及 localStorage 封装 (`ProfileStore`)。
  - `tests/profile.test.ts`: 覆盖正常路径与全部规则的单元测试 (29 个测试用例全部通过)，涵盖外国载具校验、同一编组车辆去重与移走、同车族免训与跨车族自动训练、编组非空保证、selected 自动改选修正、最后编组保护、数据清洗防坏防越界、负时间与成长计算、存储读写往返与异常容错。
- **决策**:
  - `assignVehicle` 中若移动载具导致原选中的 selected 格子变空，统一自动改选第一个非空格子，确保 `selected` 始终指向有效载具。
  - `sanitizeProfile` 采用全量防御性清洗：未知国家/载具自动剔除，slots 长度严格对齐该国车组数，空编组与无效 selected 自动修正为有效载具与非空格子，坏数据无法恢复时优雅回退为 `defaultProfile`。
- **待确认**: 无
