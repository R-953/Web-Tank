/**
 * 科技树布局计算(纯函数)
 * 将扁平的载具列表组织为科技树所需的层级结构:
 * 年份轴(去重升序) -> 国家(germany -> ussr -> usa) -> 类别线(light -> medium -> heavy -> td) -> 车族组(按最早年份排在对应列)
 */

export interface TechTreeEntry {
  id: string;
  name: string;
  nation: string;
  vehicleClass: 'light' | 'medium' | 'heavy' | 'td';
  serviceYear: number;
  family: string;
}

export interface TechTreeGroup {
  family: string;
  /** 组的标题:FAMILY_NAMES 里有就用,否则用第一辆车的名字 */
  title: string;
  /** 按服役年份、再按 id 排序 */
  members: TechTreeEntry[];
  /** 所在列 = 组内最早服役年份在 years 里的下标 */
  column: number;
}

export interface TechTreeLane {
  vehicleClass: TechTreeEntry['vehicleClass'];
  groups: TechTreeGroup[];
}

export interface TechTreeNation {
  nation: string;
  /** 只含这个国家有车的类别,顺序 light → medium → heavy → td */
  lanes: TechTreeLane[];
}

export interface TechTreeLayout {
  /** 所有国家共用的年份轴,升序、去重 */
  years: number[];
  /** 国家顺序:germany → ussr → usa,没有车的国家不出现 */
  nations: TechTreeNation[];
}

/** 车族的中文显示名,例如 m4a3 → 'M4A3 谢尔曼' */
export const FAMILY_NAMES: Readonly<Record<string, string>> = {
  m4a3: 'M4A3 谢尔曼',
  tiger: '虎式',
  tiger_i: '虎式',
  tiger_ii: '虎王',
  t34: 'T-34',
  t34_85: 'T-34-85',
  su_100: 'SU-100',
  su100: 'SU-100',
  isu_122: 'ISU-122',
  isu122: 'ISU-122',
  is: 'IS',
  kv: 'KV',
  panther: '黑豹',
  pz4: '四号坦克',
  stug: '三号突击炮',
};

/** 国家显示名 */
export const NATION_NAMES: Readonly<Record<string, string>> = {
  germany: '德国',
  ussr: '苏联',
  usa: '美国',
};

/** 载具类别显示名 */
export const CLASS_NAMES: Readonly<Record<TechTreeEntry['vehicleClass'], string>> = {
  light: '轻型坦克',
  medium: '中型坦克',
  heavy: '重型坦克',
  td: '坦克歼击车 / 突击炮',
};

/** 国家优先顺序 */
const PREFERRED_NATIONS: readonly string[] = ['germany', 'ussr', 'usa'];

/** 载具类别优先顺序 */
const CLASS_ORDER: readonly TechTreeEntry['vehicleClass'][] = ['light', 'medium', 'heavy', 'td'];

/**
 * 根据载具列表计算科技树布局数据
 */
export function techTreeLayout(entries: readonly TechTreeEntry[]): TechTreeLayout {
  // 1. 年份轴:所有国家共用,升序、去重
  const yearSet = new Set<number>();
  for (const entry of entries) {
    yearSet.add(entry.serviceYear);
  }
  const years = Array.from(yearSet).sort((a, b) => a - b);

  // 2. 国家列表:按 germany → ussr → usa 排序,没有车的国家不出现
  const nationSet = new Set<string>();
  for (const entry of entries) {
    nationSet.add(entry.nation);
  }

  const sortedNations = Array.from(nationSet).sort((a, b) => {
    const ia = PREFERRED_NATIONS.indexOf(a);
    const ib = PREFERRED_NATIONS.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const nations: TechTreeNation[] = [];

  for (const nation of sortedNations) {
    const nationEntries = entries.filter((e) => e.nation === nation);
    const lanes: TechTreeLane[] = [];

    // 3. 类别线:顺序 light → medium → heavy → td,没有车的类别不出现
    for (const vehicleClass of CLASS_ORDER) {
      const classEntries = nationEntries.filter((e) => e.vehicleClass === vehicleClass);
      if (classEntries.length === 0) continue;

      // 4. 车族分组:同一车族叠成一组
      const familyMap = new Map<string, TechTreeEntry[]>();
      for (const entry of classEntries) {
        let list = familyMap.get(entry.family);
        if (!list) {
          list = [];
          familyMap.set(entry.family, list);
        }
        list.push(entry);
      }

      const groups: TechTreeGroup[] = [];

      for (const [family, members] of familyMap) {
        // 组内排序:按服役年份、再按 id 排序
        const sortedMembers = [...members].sort((a, b) => {
          if (a.serviceYear !== b.serviceYear) {
            return a.serviceYear - b.serviceYear;
          }
          return a.id.localeCompare(b.id);
        });

        // 所在列 = 组内最早服役年份在 years 里的下标
        const earliestYear = sortedMembers[0].serviceYear;
        const column = years.indexOf(earliestYear);

        // 组标题:FAMILY_NAMES 里有就用,否则用第一辆车的名字
        const title = FAMILY_NAMES[family] ?? sortedMembers[0].name;

        groups.push({
          family,
          title,
          members: sortedMembers,
          column,
        });
      }

      // 组间排序:按所在列升序,同列按车族名排序
      groups.sort((a, b) => {
        if (a.column !== b.column) {
          return a.column - b.column;
        }
        return a.family.localeCompare(b.family);
      });

      lanes.push({
        vehicleClass,
        groups,
      });
    }

    if (lanes.length > 0) {
      nations.push({
        nation,
        lanes,
      });
    }
  }

  return {
    years,
    nations,
  };
}
