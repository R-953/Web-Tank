# 034-crew-skill-in-battle:开局按车组等级改玩家载具的装填和转速

- 负责:Antigravity(3.8 Flash High;`src/game/Game.ts` 本归主程维护,本卡授权只做下面这一处)
- 状态:已完成
- 分支:`task/034-crew-skill-in-battle`
- 规模:S

## 目标

设计稿 [docs/design/tech-tree-and-crew.md](../design/tech-tree-and-crew.md) 第 3.3 节:车组等级让装填、方向机、高低机在「新手」和「王牌」之间线性插值。029 已经有 `applyCrewSkill`,本卡把它接进战斗:`Game` 生成玩家载具时按传入的技能值改数值;另写一个从存档算技能值的函数。`main.ts` 那一行由主程接。

## 背景与参考(只读)

- `src/game/crew/progress.ts`:`applyCrewSkill(spec, ace, skill)`
- `src/settings/Profile.ts`:`Profile`、`ProfileVehicle`、`proficiency`
- `VehicleSpec.crewAce`(028)
- `src/game/Game.ts` 的 `GameConfig`(约 98 行)和 `spawn()`(约 402 行)

## 允许修改的文件

- 修改:`src/game/Game.ts`(**只**加下面的可选配置项,并在 `spawn()` 里给玩家载具套 `applyCrewSkill`;敌方载具不变)
- 新增:`src/game/crew/skill.ts`
- 新增:`tests/crew-skill.test.ts`
- 新增:`changelog.d/<日期>-034-crew-skill-in-battle.md`

## 接口(定死,不要改)

```ts
// Game.ts:GameConfig 新增
/** 玩家车组技能 ∈ [0, 1](= 车组成长进度 × 熟练度);缺省 0 = 新手数值(和现在一样) */
playerCrewSkill?: number;

// crew/skill.ts
import type { Profile, ProfileVehicle } from '../../settings/Profile';
/** 当前出战车组对当前出战载具的技能 = 该车组 progress × proficiency;找不到时返回 0 */
export function activeCrewSkill(p: Profile, vehicles: readonly ProfileVehicle[]): number;
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `tests/crew-skill.test.ts`:
  - `activeCrewSkill`:正常、熟练度 0、存档里当前格子无效时返回 0
  - 用 `Game` 开一局(参照现有测试里创建 `Game` 的写法):`playerCrewSkill: 1` 时玩家载具的主炮装填 = `crewAce.reloadTime`、方向机 = `crewAce.turretRotationSpeed`;缺省时和 `VEHICLES` 里的数值一样;敌方载具不受影响
- [x] 不改 `main.ts`

## 不做

- `main.ts` 接线(主程)
- 车组等级对其他数值的影响

## 结果(完成后由执行者填写)

- 改动文件:
  - 新增: `src/game/crew/skill.ts`
  - 新增: `tests/crew-skill.test.ts`
  - 新增: `changelog.d/2026-10-01-034-crew-skill-in-battle.md`
  - 修改: `src/game/Game.ts`
  - 修改: `docs/tasks/034-crew-skill-in-battle.md`
- 命令与结果:
  - `npm run lint`: 通过 (0 errors)
  - `npm test`: 全部通过 (43 test files, 446 passed)
  - `npm run build`: 通过 (tsc && vite build 正常构建)
- 偏差 / 未完成 / 待决定: 无。完全按任务卡与接口要求实现。
