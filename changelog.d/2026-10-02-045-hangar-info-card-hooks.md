### 045 机库去掉携弹面板,信息卡挂到编组栏和科技树(Antigravity)

- **新增 / 变更 / 修复**:
  - `src/game/crew/skill.ts`: 新增纯函数 `crewSkillFor(p, vehicles, nation, crewIndex, vehicleId)` 计算指定国家车组的开车载具技能（progress × 熟练度，范围 [0, 1]），`activeCrewSkill` 改为内部委托调用。
  - `src/ui/menu/TechTree.ts`: `TechTreeOptions` 增加可选回调 `onHoverVehicle?(vehicleId: string | null, rect: DOMRect | null): void`，单车卡片和车族展开单车项在 mouseenter 与 mouseleave 时触发回调。
  - `src/ui/menu/MainMenu.ts`: 移除机库中的 `AmmoPanel` 携弹面板；持有 `VehicleCard` 实例，接入编组栏与科技树的悬停及「载具信息」回调；在打开/关闭科技树与隐藏主界面时隐藏信息卡，新增 `dispose` 方法释放资源。
  - 测试: 新增 `tests/crew-skill-for.test.ts` 验证同车族保留熟练度、换车族要训练及非法入参情况；在 `tests/tech-tree-ui.test.ts` 与 `tests/lineup-bar.test.ts` 中补充悬停显示/延迟隐藏/双击关闭及携弹面板移除断言。
- **决策**: 科技树悬停查看载具技能时，按任务卡要求传入当前出战车组下标，直观展示该车如果分给当前出战车组所能达到的熟练与技能水平。
- **待确认**: 无。
