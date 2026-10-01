/**
 * 车组与编组的存档(纯逻辑 + 本机存储)
 * 对应设计稿 docs/design/tech-tree-and-crew.md 第 2.1、3.1、3.2 节。
 */

/** 每个国家的车位上限(游戏里俗称车位,负责人 10-01 暂定) */
export const CREW_SLOT_LIMIT = 8;

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

const STORAGE_KEY = 'webtank.profile.v1';

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function cloneProfile(p: Profile): Profile {
  return JSON.parse(JSON.stringify(p)) as Profile;
}

/** 默认存档:每个国家只有 1 个初级车组(progress 0),训练过该国在 vehicles 里的第一辆车;「编组 1」只有 1 格,分的就是这辆车,selected 0 */
export function defaultProfile(vehicles: readonly ProfileVehicle[], now: number): Profile {
  const nationsList: string[] = [];
  for (const v of vehicles) {
    if (!nationsList.includes(v.nation)) {
      nationsList.push(v.nation);
    }
  }

  const nations: Record<string, NationProfile> = {};
  for (const nation of nationsList) {
    const nationVehs = vehicles.filter((v) => v.nation === nation);
    const firstVeh = nationVehs[0];
    const crews: CrewState[] = [
      {
        progress: 0,
        trained: firstVeh ? [firstVeh.id] : [],
      },
    ];
    const lineupId = 'lineup-1';
    const lineups: Lineup[] = [
      {
        id: lineupId,
        name: '编组 1',
        slots: [firstVeh ? firstVeh.id : null],
        selected: 0,
      },
    ];
    nations[nation] = {
      crews,
      lineups,
      activeLineup: lineupId,
    };
  }

  return {
    version: 1,
    lastSeen: now,
    activeNation: nationsList[0] ?? '',
    nations,
  };
}

/** 熟练度:车组训练过同车族的任一载具 → 1;否则 0(第一期的简化,以后按车族差异打折) */
export function proficiency(crew: CrewState, vehicleId: string, vehicles: readonly ProfileVehicle[]): number {
  const targetVeh = vehicles.find((v) => v.id === vehicleId);
  if (!targetVeh) return 0;
  for (const tId of crew.trained) {
    const tVeh = vehicles.find((v) => v.id === tId);
    if (tVeh && tVeh.family === targetVeh.family) {
      return 1;
    }
  }
  return 0;
}

/** 清洗:未知国家 / 载具剔除、slots 长度对齐车组数、空编组或 selected 指向空格时修正;救不回来就用 defaultProfile */
export function sanitizeProfile(raw: unknown, vehicles: readonly ProfileVehicle[], now: number): Profile {
  const def = defaultProfile(vehicles, now);
  if (typeof raw !== 'object' || raw === null || vehicles.length === 0) {
    return def;
  }

  try {
    const r = raw as Record<string, unknown>;
    const validNationList: string[] = [];
    for (const v of vehicles) {
      if (!validNationList.includes(v.nation)) {
        validNationList.push(v.nation);
      }
    }
    const validNationSet = new Set(validNationList);
    const vehMap = new Map<string, ProfileVehicle>(vehicles.map((v) => [v.id, v]));

    const lastSeen = typeof r.lastSeen === 'number' && Number.isFinite(r.lastSeen) ? r.lastSeen : now;

    if (typeof r.nations !== 'object' || r.nations === null) {
      return def;
    }
    const rawNations = r.nations as Record<string, unknown>;

    const cleanNations: Record<string, NationProfile> = {};

    for (const nation of validNationList) {
      const nationVehs = vehicles.filter((v) => v.nation === nation);
      const rn = rawNations[nation];

      if (typeof rn !== 'object' || rn === null) {
        cleanNations[nation] = def.nations[nation];
        continue;
      }

      const rnObj = rn as Record<string, unknown>;

      // 1. 车组数取存档里的 crews 长度, 夹到 [1, CREW_SLOT_LIMIT]
      const rawCrews = Array.isArray(rnObj.crews) ? rnObj.crews : [];
      const crewCount = Math.max(1, Math.min(CREW_SLOT_LIMIT, rawCrews.length));

      // 2. 清洗 crews
      const cleanCrews: CrewState[] = [];
      for (let i = 0; i < crewCount; i++) {
        const rc = rawCrews[i];
        if (typeof rc === 'object' && rc !== null) {
          const rcObj = rc as Record<string, unknown>;
          const rawProgress = typeof rcObj.progress === 'number' && Number.isFinite(rcObj.progress) ? rcObj.progress : 0;
          const progress = Math.max(0, Math.min(0.999999, rawProgress));
          const rawTrained = Array.isArray(rcObj.trained) ? rcObj.trained : [];
          const cleanTrained: string[] = [];
          for (const tid of rawTrained) {
            if (typeof tid === 'string' && vehMap.get(tid)?.nation === nation && !cleanTrained.includes(tid)) {
              cleanTrained.push(tid);
            }
          }
          cleanCrews.push({
            progress,
            trained: cleanTrained,
          });
        } else {
          // 缺失的车组补齐默认车组
          cleanCrews.push({
            progress: 0,
            trained: nationVehs[0] ? [nationVehs[0].id] : [],
          });
        }
      }

      // 3. 清洗 lineups
      const rawLineups = Array.isArray(rnObj.lineups) ? rnObj.lineups : [];
      const cleanLineups: Lineup[] = [];

      for (let idx = 0; idx < rawLineups.length; idx++) {
        const rl = rawLineups[idx];
        if (typeof rl !== 'object' || rl === null) continue;
        const rlObj = rl as Record<string, unknown>;

        const id = typeof rlObj.id === 'string' && rlObj.id.trim() ? rlObj.id : `lineup-${cleanLineups.length + 1}`;
        const name = typeof rlObj.name === 'string' && rlObj.name.trim() ? rlObj.name : `编组 ${cleanLineups.length + 1}`;

        const rawSlots = Array.isArray(rlObj.slots) ? rlObj.slots : [];
        const cleanSlots: (string | null)[] = [];
        const seenInLineup = new Set<string>();

        for (let i = 0; i < crewCount; i++) {
          const vid = rawSlots[i];
          if (typeof vid === 'string' && vehMap.get(vid)?.nation === nation && !seenInLineup.has(vid)) {
            seenInLineup.add(vid);
            cleanSlots.push(vid);
          } else {
            cleanSlots.push(null);
          }
        }

        // 空编组修正: 不能让编组全为空
        if (crewCount > 0 && !cleanSlots.some((s) => s !== null)) {
          if (nationVehs.length > 0) {
            cleanSlots[0] = nationVehs[0].id;
          }
        }

        // selected 修正: 必须指向非空格子
        let selected = typeof rlObj.selected === 'number' ? Math.floor(rlObj.selected) : 0;
        if (crewCount > 0) {
          if (selected < 0 || selected >= cleanSlots.length || cleanSlots[selected] === null) {
            const firstValid = cleanSlots.findIndex((s) => s !== null);
            selected = firstValid >= 0 ? firstValid : 0;
          }
        } else {
          selected = 0;
        }

        cleanLineups.push({
          id,
          name,
          slots: cleanSlots,
          selected,
        });
      }

      if (cleanLineups.length === 0) {
        const defaultSlots: (string | null)[] = Array(crewCount).fill(null);
        if (nationVehs.length > 0) {
          defaultSlots[0] = nationVehs[0].id;
        }
        cleanLineups.push({
          id: 'lineup-1',
          name: '编组 1',
          slots: defaultSlots,
          selected: 0,
        });
      }

      // 4. 格子里分了车、但对应车组熟练度为 0(没训练过同车族)时, 把这辆车补进该车组的 trained
      for (const lineup of cleanLineups) {
        for (let i = 0; i < crewCount; i++) {
          const vehId = lineup.slots[i];
          if (vehId !== null) {
            const crew = cleanCrews[i];
            if (proficiency(crew, vehId, vehicles) === 0) {
              if (!crew.trained.includes(vehId)) {
                crew.trained.push(vehId);
              }
            }
          }
        }
      }

      const rawActiveLineup = typeof rnObj.activeLineup === 'string' ? rnObj.activeLineup : '';
      const activeLineup = cleanLineups.some((l) => l.id === rawActiveLineup) ? rawActiveLineup : cleanLineups[0].id;

      cleanNations[nation] = {
        crews: cleanCrews,
        lineups: cleanLineups,
        activeLineup,
      };
    }

    const activeNation =
      typeof r.activeNation === 'string' && validNationSet.has(r.activeNation)
        ? r.activeNation
        : (validNationList[0] ?? '');

    return {
      version: 1,
      lastSeen,
      activeNation,
      nations: cleanNations,
    };
  } catch {
    return def;
  }
}

/**
 * 把载具分给某编组的某个车组(vehicleId 为 null = 清空这一格)。
 * - 载具必须属于这个国家
 * - 同一编组里一辆车只能在一个格子:已在别的格子时,从那一格移走(那一格变 null)
 * - 车组熟练度为 0 时先训练(把 vehicleId 加进 trained,即时完成)
 * - 结果不能让编组变空;selected 指向的格子被清空时,改选第一个非空格子
 */
export function assignVehicle(
  p: Profile,
  nation: string,
  lineupId: string,
  crewIndex: number,
  vehicleId: string | null,
  vehicles: readonly ProfileVehicle[],
): Profile {
  const nationProfile = p.nations[nation];
  if (!nationProfile) {
    throw new Error(`国家不存在: ${nation}`);
  }

  const lineup = nationProfile.lineups.find((l) => l.id === lineupId);
  if (!lineup) {
    throw new Error(`编组不存在: ${lineupId}`);
  }

  if (crewIndex < 0 || crewIndex >= nationProfile.crews.length) {
    throw new Error(`车组索引超出范围: ${crewIndex}`);
  }

  if (vehicleId !== null) {
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!veh) {
      throw new Error(`载具不存在: ${vehicleId}`);
    }
    if (veh.nation !== nation) {
      throw new Error(`载具 ${vehicleId} 不属于国家 ${nation}`);
    }
  }

  const next = cloneProfile(p);
  const nextNation = next.nations[nation];
  const nextLineup = nextNation.lineups.find((l) => l.id === lineupId)!;
  const nextCrew = nextNation.crews[crewIndex];

  const slots = [...nextLineup.slots];

  if (vehicleId === null) {
    // 清空这一格
    slots[crewIndex] = null;
    // 结果不能让编组变空
    if (slots.every((s) => s === null)) {
      throw new Error('编组不能为空');
    }
  } else {
    // 同一编组里一辆车只能在一个格子:已在别的格子时,从那一格移走(那一格变 null)
    for (let i = 0; i < slots.length; i++) {
      if (i !== crewIndex && slots[i] === vehicleId) {
        slots[i] = null;
      }
    }
    slots[crewIndex] = vehicleId;

    // 车组熟练度为 0 时先训练(把 vehicleId 加进 trained,即时完成)
    const prof = proficiency(nextCrew, vehicleId, vehicles);
    if (prof === 0) {
      if (!nextCrew.trained.includes(vehicleId)) {
        nextCrew.trained.push(vehicleId);
      }
    }
  }

  // selected 指向的格子被清空时,改选第一个非空格子
  let selected = nextLineup.selected;
  if (slots[selected] === null) {
    const firstNonEmpty = slots.findIndex((s) => s !== null);
    if (firstNonEmpty >= 0) {
      selected = firstNonEmpty;
    }
  }

  nextLineup.slots = slots;
  nextLineup.selected = selected;

  return next;
}

export function selectCrew(p: Profile, nation: string, lineupId: string, crewIndex: number): Profile {
  const nationProfile = p.nations[nation];
  if (!nationProfile) {
    throw new Error(`国家不存在: ${nation}`);
  }
  const lineup = nationProfile.lineups.find((l) => l.id === lineupId);
  if (!lineup) {
    throw new Error(`编组不存在: ${lineupId}`);
  }
  if (crewIndex < 0 || crewIndex >= lineup.slots.length) {
    throw new Error(`车组索引超出范围: ${crewIndex}`);
  }
  if (lineup.slots[crewIndex] === null) {
    throw new Error('不能选中未分配载具的车组');
  }

  const next = cloneProfile(p);
  const nextLineup = next.nations[nation].lineups.find((l) => l.id === lineupId)!;
  nextLineup.selected = crewIndex;
  return next;
}

/** 新招募:车组数 < 上限时加一个初级车组,所有编组末尾补一个 null 格;到上限抛错,中文消息 */
export function recruitCrew(p: Profile, nation: string): Profile {
  const nationProfile = p.nations[nation];
  if (!nationProfile) {
    throw new Error(`国家不存在: ${nation}`);
  }
  if (nationProfile.crews.length >= CREW_SLOT_LIMIT) {
    throw new Error(`车组数量已达上限(${CREW_SLOT_LIMIT})，无法继续招募`);
  }

  const next = cloneProfile(p);
  const nextNation = next.nations[nation];
  nextNation.crews.push({
    progress: 0,
    trained: [],
  });
  for (const lineup of nextNation.lineups) {
    lineup.slots.push(null);
  }
  return next;
}

/** 新编组:复制当前编组的分配,名称默认「编组 N」 */
export function addLineup(p: Profile, nation: string, name?: string): Profile {
  const nationProfile = p.nations[nation];
  if (!nationProfile) {
    throw new Error(`国家不存在: ${nation}`);
  }
  const currentLineup = nationProfile.lineups.find((l) => l.id === nationProfile.activeLineup) ?? nationProfile.lineups[0];
  if (!currentLineup) {
    throw new Error('当前没有可复制的编组');
  }

  const next = cloneProfile(p);
  const nextNation = next.nations[nation];

  let n = nextNation.lineups.length + 1;
  while (nextNation.lineups.some((l) => l.id === `lineup-${n}`)) {
    n++;
  }
  const id = `lineup-${n}`;
  const lineupName = name && name.trim() ? name.trim() : `编组 ${nextNation.lineups.length + 1}`;

  const newLineup: Lineup = {
    id,
    name: lineupName,
    slots: [...currentLineup.slots],
    selected: currentLineup.selected,
  };

  nextNation.lineups.push(newLineup);
  return next;
}

export function renameLineup(p: Profile, nation: string, lineupId: string, name: string): Profile {
  const nationProfile = p.nations[nation];
  if (!nationProfile) {
    throw new Error(`国家不存在: ${nation}`);
  }
  const lineup = nationProfile.lineups.find((l) => l.id === lineupId);
  if (!lineup) {
    throw new Error(`编组不存在: ${lineupId}`);
  }
  if (!name || !name.trim()) {
    throw new Error('编组名称不能为空');
  }

  const next = cloneProfile(p);
  const nextLineup = next.nations[nation].lineups.find((l) => l.id === lineupId)!;
  nextLineup.name = name.trim();
  return next;
}

/** 最后一个编组不能删 */
export function removeLineup(p: Profile, nation: string, lineupId: string): Profile {
  const nationProfile = p.nations[nation];
  if (!nationProfile) {
    throw new Error(`国家不存在: ${nation}`);
  }
  const idx = nationProfile.lineups.findIndex((l) => l.id === lineupId);
  if (idx < 0) {
    throw new Error(`编组不存在: ${lineupId}`);
  }
  if (nationProfile.lineups.length <= 1) {
    throw new Error('最后一个编组不能删除');
  }

  const next = cloneProfile(p);
  const nextNation = next.nations[nation];
  nextNation.lineups.splice(idx, 1);

  if (nextNation.activeLineup === lineupId) {
    nextNation.activeLineup = nextNation.lineups[0].id;
  }
  return next;
}

export function setActiveLineup(p: Profile, nation: string, lineupId: string): Profile {
  const nationProfile = p.nations[nation];
  if (!nationProfile) {
    throw new Error(`国家不存在: ${nation}`);
  }
  const exists = nationProfile.lineups.some((l) => l.id === lineupId);
  if (!exists) {
    throw new Error(`编组不存在: ${lineupId}`);
  }

  const next = cloneProfile(p);
  next.nations[nation].activeLineup = lineupId;
  return next;
}

export function setActiveNation(p: Profile, nation: string): Profile {
  if (!p.nations[nation]) {
    throw new Error(`国家不存在: ${nation}`);
  }

  const next = cloneProfile(p);
  next.activeNation = nation;
  return next;
}

/** 当前出战的载具 id(当前国家 → 当前编组 → selected 格子) */
export function activeVehicleId(p: Profile): string {
  const nationProfile = p.nations[p.activeNation];
  if (!nationProfile) {
    throw new Error(`当前国家不存在: ${p.activeNation}`);
  }
  const lineup = nationProfile.lineups.find((l) => l.id === nationProfile.activeLineup);
  if (!lineup) {
    throw new Error(`当前编组不存在: ${nationProfile.activeLineup}`);
  }
  const vehId = lineup.slots[lineup.selected];
  if (!vehId) {
    throw new Error('当前选中的车组未分配载具');
  }
  return vehId;
}

/**
 * 离线成长补算:每个车组 progress = grow(progress, now − lastSeen),然后 lastSeen = now。
 * grow 由调用方注入(实际用 029 的 progressAfter),本卡测试用假函数。now < lastSeen 时只更新 lastSeen。
 */
export function advanceTime(p: Profile, now: number, grow: (f0: number, elapsedMs: number) => number): Profile {
  const next = cloneProfile(p);
  const elapsed = now - p.lastSeen;

  if (elapsed > 0) {
    for (const nation of Object.keys(next.nations)) {
      const np = next.nations[nation];
      for (const crew of np.crews) {
        crew.progress = grow(crew.progress, elapsed);
      }
    }
  }

  next.lastSeen = now;
  return next;
}

/** 本机存储,键名 'webtank.profile.v1';写法照 SettingsStore(storage 可注入,读失败用默认值) */
export class ProfileStore {
  private current: Profile;

  constructor(
    private readonly vehicles: readonly ProfileVehicle[],
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage(),
    private readonly now: () => number = () => Date.now(),
  ) {
    let raw: unknown = null;
    try {
      const text = this.storage?.getItem(STORAGE_KEY);
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = null;
    }
    this.current = sanitizeProfile(raw, this.vehicles, this.now());
  }

  get(): Profile {
    return this.current;
  }

  set(p: Profile): void {
    this.current = sanitizeProfile(p, this.vehicles, this.now());
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      /* 存不了就只在内存里生效 */
    }
  }
}
