### 034 开局按车组等级改玩家载具的装填和转速(Antigravity)

- **新增**: `src/game/crew/skill.ts` 提供 `activeCrewSkill(p, vehicles)`，计算当前出战车组对当前出战载具的综合技能（progress × proficiency）；找不到时安全返回 0。
- **变更**: `src/game/Game.ts` 的 `GameConfig` 新增可选字段 `playerCrewSkill?: number`；`spawn()` 生成玩家载具时套用 `applyCrewSkill` 改写主炮装填、方向机和高低机速度；敌方载具不变。
- **决策**: `activeCrewSkill` 遇到无效格子、空槽位或缺失国家/编组时返回 0 而不抛异常；`GameConfig.playerCrewSkill` 缺省使用 0（新手数值）。
- **待确认**: 无。
