### 030 车组与编组的存档(Antigravity)

- **新增**:
  - `src/settings/Profile.ts`: 车组与编组数据层及本机存储实现。车组数与载具数脱钩，导出车位上限常量 `CREW_SLOT_LIMIT = 8`；`defaultProfile` 初始为每国 1 个初级车组 (对应 1 格编组)；新增 `recruitCrew` 招募车组逻辑；包含熟练度判定 (`proficiency`)、载具分配与规则校验 (`assignVehicle`)、车组选择 (`selectCrew`)、编组增删与重命名 (`addLineup` / `renameLineup` / `removeLineup` / `setActiveLineup`)、国家切换 (`setActiveNation`)、出战载具读取 (`activeVehicleId`)、离线成长补算 (`advanceTime`)、坏数据清洗 (`sanitizeProfile`) 以及 localStorage 封装 (`ProfileStore`)。
  - `tests/profile.test.ts`: 覆盖全部正常路径与边界规则的单元测试 (396 个测试全部通过)，包括默认 1 车组、招募上限与超限报错、招募后编组槽位扩展、外国载具拦截、同编组车辆移走、同车族免训与跨车族自动训练、编组非空保证、selected 自动改选修正、最后编组保护、坏数据清洗(车组数夹取与自动补训)、离线成长与负时间、存储往返与异常容错。
- **决策**:
  - 车组数与载具数脱钩(负责人 10-01 修改设计)，初始 1 车组，上限 8 车组，通过 `recruitCrew` 招募并同步扩充所有编组的槽位。
  - `sanitizeProfile` 采用全量防御性清洗：车组数夹取到 [1, 8]，未知国家/载具自动剔除，slots 长度严格对齐车组数，空编组与无效 selected 自动修正；若编组分了车但车组熟练度为 0，自动将该车补入 trained 训练记录。
  - `assignVehicle` 中若移动载具导致原选中的 selected 格子变空，统一自动改选第一个非空格子，确保 `selected` 始终指向有效载具。
- **待确认**: 无
