# 029-crew-progress:车组成长曲线与技能插值(纯逻辑)

- 负责:Antigravity(3.8 Flash High)
- 状态:已合并
- 分支:`task/029-crew-progress`
- 规模:S

## 目标

实现设计稿 [docs/design/tech-tree-and-crew.md](../design/tech-tree-and-crew.md) 第 3.3、5 节的两条公式:车组离线挂机的成长进度,以及按进度在「新手」和「王牌」数值之间线性插值。只写纯函数和测试,不接界面、不接存档。

## 允许修改的文件

- 新增:`src/game/crew/progress.ts`
- 新增:`tests/crew-progress.test.ts`
- 新增:`changelog.d/2026-10-02-029-crew-progress.md`

## 接口(定死,不要改)

```ts
import type { VehicleSpec } from '../../data/types';

/** 成长常数 T:挂机 T 时长升到满级的 50%(负责人定为两周),毫秒 */
export const CREW_HALF_TIME_MS: number; // = 14 天
/** 显示给玩家的满级等级 */
export const CREW_MAX_LEVEL: number; // = 150

/**
 * 成长进度 f ∈ [0, 1):f(t) = t / (t + T)。
 * 从进度 f0 出发再挂机 elapsedMs 后的进度:先反推 t0 = T·f0 / (1 − f0),再算 f(t0 + elapsedMs)。
 * elapsedMs ≤ 0(含改了系统时间导致的负值)时原样返回 f0;f0 夹到 [0, 1)。
 */
export function progressAfter(f0: number, elapsedMs: number, halfTimeMs?: number): number;

/** 显示等级 = floor(f × CREW_MAX_LEVEL) */
export function crewLevel(f: number): number;

/** 满级数值(结构与 data/types.ts 里将要加的 CrewAceSpec 相同,这里单独声明,避免依赖 028) */
export interface AceValues {
  reloadTime: number;
  turretRotationSpeed: number;
  elevationSpeed: number;
}

/**
 * 按技能 skill ∈ [0, 1](= 成长进度 × 熟练度,调用方算好)把载具数值从新手线性插值到王牌,返回新的 VehicleSpec(不改入参)。
 * - 主炮(weapons 里 kind 不是 'mg' 的)reloadTime:novice + (ace − novice) × skill
 * - turretRotationSpeed、turret.elevationSpeed 同理
 * - 机枪不变;ace 为 undefined 时原样返回(拷贝或原对象都行,但不能改入参);skill 夹到 [0, 1]
 */
export function applyCrewSkill(spec: VehicleSpec, ace: AceValues | undefined, skill: number): VehicleSpec;
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `tests/crew-progress.test.ts` 覆盖:
  - 负责人的规则:从 0 开始,2 周 → 50%,6 周 → 75%,14 周 → 87.5%(误差 < 1e-9)
  - 分段补算等于一次补算:`progressAfter(progressAfter(0, a), b)` ≈ `progressAfter(0, a + b)`
  - 负时间、0 时间原样返回;f0 超出范围被夹住;永远 < 1
  - `crewLevel`:0 → 0,0.5 → 75,0.999 → 149;满级 150 为渐近线最高显示 149
  - `applyCrewSkill`:skill 0 / 0.5 / 1 的三个数值;机枪不变;不改入参;ace 缺省原样

## 不做

- 存档、编组、界面(030、031 和以后的卡)
- 熟练度的计算(030 的车组存档里做)

## 结果(完成后由执行者填写)

- 改动文件:
  - 新增: `src/game/crew/progress.ts`
  - 新增: `tests/crew-progress.test.ts`
  - 新增: `changelog.d/2026-10-02-029-crew-progress.md`
  - 修改: `docs/tasks/029-crew-progress.md`
- 命令与结果:
  - `npm run lint`: 全部通过
  - `npm test`: 全部通过 (37 个测试文件, 376 个测试全部 pass)
  - `npm run build`: 全部通过 (tsc 与 vite build 成功打包)
- 偏差 / 未完成 / 待决定:
  - 偏差: 负责人 2026-10-01 调整设计,地面载具满级与 War Thunder 一致改为 150 级(CREW_MAX_LEVEL = 150),满级为渐近线最高显示 149 级。
