# 030-crew-lineup-profile:车组与编组的存档(纯逻辑 + 本机存储)

- 负责:Antigravity(3.8 Flash High)
- 状态:已合并
- 分支:`task/030-crew-lineup-profile`
- 规模:M

## 目标

实现设计稿 [docs/design/tech-tree-and-crew.md](../design/tech-tree-and-crew.md) 第 2.1、3.1、3.2 节的数据层:每个国家的车组、编组,以及它们在浏览器里的存档。只做数据和规则,界面(机库底部的编组栏)和接入游戏在以后的卡里做。

## 背景与参考

- 现有设置的存法:`src/settings/Settings.ts` 的 `SettingsStore`(注入 storage、`sanitize` 清洗、键名带版本号)。本卡照这个写法。
- 现在机库记住的是「上次选的车」:`src/main.ts` 里的 `webtank.selection`(只读参考,不要改 main.ts)。

## 允许修改的文件

- 新增:`src/settings/Profile.ts`
- 新增:`tests/profile.test.ts`
- 新增:`changelog.d/2026-10-02-030-crew-lineup-profile.md`

## 接口(定死,不要改)

```ts
/** 本卡需要的载具信息(由调用方从 VehicleSpec 里取;测试里用假数据) */
export interface ProfileVehicle {
  id: string;
  nation: string;
  /** 车族 id,同车族换车保留熟练度 */
  family: string;
}

export interface CrewState {
  /** 进度 f ∈ [0, 1),见 029 */
  progress: number;
  /** 训练过的载具 id */
  trained: string[];
}

export interface Lineup {
  id: string;
  /** 玩家自定义名称 */
  name: string;
  /** 下标 = 这个国家的车组下标;值 = 分到的载具 id,没分车为 null。长度始终等于该国车组数 */
  slots: (string | null)[];
  /** 当前选中出战的车组下标,必须指向一个非空的格子 */
  selected: number;
}

export interface NationProfile {
  crews: CrewState[];
  lineups: Lineup[];
  activeLineup: string;
}

export interface Profile {
  version: 1;
  /** 上次补算成长的时刻,ms(Date.now()) */
  lastSeen: number;
  activeNation: string;
  nations: Record<string, NationProfile>;
}

/** 每个国家的车位上限(游戏里俗称车位,负责人 10-01 暂定) */
export const CREW_SLOT_LIMIT = 8;

/** 默认存档:每个国家只有 1 个初级车组(progress 0),训练过该国在 vehicles 里的第一辆车;「编组 1」只有 1 格,分的就是这辆车,selected 0 */
export function defaultProfile(vehicles: readonly ProfileVehicle[], now: number): Profile;

/** 清洗:未知国家 / 载具剔除、slots 长度对齐车组数、空编组或 selected 指向空格时修正;救不回来就用 defaultProfile */
export function sanitizeProfile(raw: unknown, vehicles: readonly ProfileVehicle[], now: number): Profile;

/** 熟练度:车组训练过同车族的任一载具 → 1;否则 0(第一期的简化,以后按车族差异打折) */
export function proficiency(crew: CrewState, vehicleId: string, vehicles: readonly ProfileVehicle[]): number;

// 下面的操作都返回新的 Profile(不改入参);违反规则时抛 Error,消息用中文说明原因
/**
 * 把载具分给某编组的某个车组(vehicleId 为 null = 清空这一格)。
 * - 载具必须属于这个国家
 * - 同一编组里一辆车只能在一个格子:已在别的格子时,从那一格移走(那一格变 null)
 * - 车组熟练度为 0 时先训练(把 vehicleId 加进 trained,即时完成)
 * - 结果不能让编组变空;selected 指向的格子被清空时,改选第一个非空格子
 */
export function assignVehicle(p: Profile, nation: string, lineupId: string, crewIndex: number, vehicleId: string | null, vehicles: readonly ProfileVehicle[]): Profile;
export function selectCrew(p: Profile, nation: string, lineupId: string, crewIndex: number): Profile;
/** 招募车组:车组数 < 上限时加一个初级车组,所有编组末尾补一个 null 格;到上限抛错,中文消息 */
export function recruitCrew(p: Profile, nation: string): Profile;
/** 新编组:复制当前编组的分配,名称默认「编组 N」 */
export function addLineup(p: Profile, nation: string, name?: string): Profile;
export function renameLineup(p: Profile, nation: string, lineupId: string, name: string): Profile;
/** 最后一个编组不能删 */
export function removeLineup(p: Profile, nation: string, lineupId: string): Profile;
export function setActiveLineup(p: Profile, nation: string, lineupId: string): Profile;
export function setActiveNation(p: Profile, nation: string): Profile;
/** 当前出战的载具 id(当前国家 → 当前编组 → selected 格子) */
export function activeVehicleId(p: Profile): string;
/**
 * 离线成长补算:每个车组 progress = grow(progress, now − lastSeen),然后 lastSeen = now。
 * grow 由调用方注入(实际用 029 的 progressAfter),本卡测试用假函数。now < lastSeen 时只更新 lastSeen。
 */
export function advanceTime(p: Profile, now: number, grow: (f0: number, elapsedMs: number) => number): Profile;

/** 本机存储,键名 'webtank.profile.v1';写法照 SettingsStore(storage 可注入,读失败用默认值) */
export class ProfileStore {
  constructor(vehicles: readonly ProfileVehicle[], storage?: Pick<Storage, 'getItem' | 'setItem'> | null, now?: () => number);
  get(): Profile;
  set(p: Profile): void;
}
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `tests/profile.test.ts` 覆盖上面每个函数的正常路径和每条规则(移走重复、自动训练、不能变空、selected 修正、不能删最后一个编组、外国载具报错、清洗各种坏数据、存取往返、负时间)
- [x] 不依赖 DOM;storage 用假对象

## 不做

- 界面、接入 main.ts / 游戏(以后的卡)
- 跨车族熟练度打折(以后再做)

## 结果(完成后由执行者填写)

- 改动文件:
  - `src/settings/Profile.ts` (新增)
  - `tests/profile.test.ts` (新增)
  - `changelog.d/2026-10-02-030-crew-lineup-profile.md` (新增)
  - `docs/tasks/030-crew-lineup-profile.md` (修改结果与状态)
- 命令与结果:
  - `npm run lint`: 通过 (`tsc --noEmit` 0 错误)
  - `npm test`: 全部通过 (37 个测试文件、396 个测试用例全部通过)
  - `npm run build`: 构建成功 (生产包构建成功无错误)
- 偏差 / 未完成 / 待决定:
  - 偏差: 负责人 10-01 改了车组数量设计，车组数与载具数脱钩。每个国家初始只有 1 个初级车组(编组 1 格)，车位上限常量 CREW_SLOT_LIMIT = 8，新增 `recruitCrew` 招募车组逻辑；`sanitizeProfile` 将存档中的车组数夹取在 [1, 8]，并且在编组分配了载具但熟练度为 0 时自动补齐训练记录。

