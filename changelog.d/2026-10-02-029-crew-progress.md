### 029 车组成长曲线与技能插值(纯逻辑)(Antigravity)

- **新增**:实现车组离线挂机成长进度闭式解与推进函数 `progressAfter`、等级换算 `crewLevel` 以及新手至王牌数值线性插值函数 `applyCrewSkill`(`src/game/crew/progress.ts`),并补充完备单元测试(`tests/crew-progress.test.ts`)。
- **决策**:按负责人 2026-10-01 决定,地面载具满级等级与 War Thunder 一致定为 150 级(`CREW_MAX_LEVEL = 150`,最高显示 149 级,150 级为渐近线);成长曲线采用闭式解 $f(t) = t / (t + T)$,$f_0$ 与计算结果均防溢出夹在 $[0, 1)$ 内且严格 $< 1$;插值时不修改输入配置并保持机枪数值不变。
- **待确认**:无。
