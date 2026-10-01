import { describe, expect, it } from 'vitest';
import {
  CLASS_NAMES,
  FAMILY_NAMES,
  NATION_NAMES,
  techTreeLayout,
  type TechTreeEntry,
} from '../src/ui/menu/techTreeLayout';

describe('techTreeLayout', () => {
  it('年份轴去重并升序排序', () => {
    const entries: TechTreeEntry[] = [
      { id: 'v1', name: '车1', nation: 'germany', vehicleClass: 'heavy', serviceYear: 1944, family: 'tiger' },
      { id: 'v2', name: '车2', nation: 'ussr', vehicleClass: 'medium', serviceYear: 1942, family: 't34' },
      { id: 'v3', name: '车3', nation: 'usa', vehicleClass: 'medium', serviceYear: 1945, family: 'm4a3' },
      { id: 'v4', name: '车4', nation: 'germany', vehicleClass: 'heavy', serviceYear: 1944, family: 'tiger' },
      { id: 'v5', name: '车5', nation: 'ussr', vehicleClass: 'td', serviceYear: 1943, family: 'su' },
    ];

    const layout = techTreeLayout(entries);
    expect(layout.years).toEqual([1942, 1943, 1944, 1945]);
  });

  it('输入为空时年份和国家均为空', () => {
    const layout = techTreeLayout([]);
    expect(layout.years).toEqual([]);
    expect(layout.nations).toEqual([]);
  });

  it('国家顺序为 germany → ussr → usa,没有车的国家不出现', () => {
    // 乱序输入,且缺少 germany
    const entries: TechTreeEntry[] = [
      { id: 'us1', name: '谢尔曼', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
      { id: 'su1', name: 'T-34-85', nation: 'ussr', vehicleClass: 'medium', serviceYear: 1944, family: 't34' },
    ];

    const layout = techTreeLayout(entries);
    expect(layout.nations.map((n) => n.nation)).toEqual(['ussr', 'usa']);

    // 含有三个国家时,严格按 germany → ussr → usa 排序
    const allNationsEntries: TechTreeEntry[] = [
      { id: 'us1', name: '谢尔曼', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
      { id: 'de1', name: '虎式', nation: 'germany', vehicleClass: 'heavy', serviceYear: 1942, family: 'tiger' },
      { id: 'su1', name: 'T-34-85', nation: 'ussr', vehicleClass: 'medium', serviceYear: 1944, family: 't34' },
    ];
    const layoutAll = techTreeLayout(allNationsEntries);
    expect(layoutAll.nations.map((n) => n.nation)).toEqual(['germany', 'ussr', 'usa']);
  });

  it('类别顺序为 light → medium → heavy → td,且只含该国家有车的类别', () => {
    const entries: TechTreeEntry[] = [
      { id: 'su_td', name: 'SU-100', nation: 'ussr', vehicleClass: 'td', serviceYear: 1944, family: 'su100' },
      { id: 'su_med', name: 'T-34-85', nation: 'ussr', vehicleClass: 'medium', serviceYear: 1944, family: 't34_85' },
    ];

    const layout = techTreeLayout(entries);
    const ussr = layout.nations.find((n) => n.nation === 'ussr')!;
    expect(ussr).toBeDefined();
    // 只有 medium 和 td,没有 light 和 heavy,且顺序为 medium -> td
    expect(ussr.lanes.map((l) => l.vehicleClass)).toEqual(['medium', 'td']);
  });

  it('同车族成组,且组内成员按服役年份、再按 id 排序', () => {
    const entries: TechTreeEntry[] = [
      // 同车族 m4a3,乱序输入:不同年份,同一年份多个 id
      { id: 'm4a3e8', name: 'M4A3E8', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
      { id: 'm4a3_76w', name: 'M4A3(76)W', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
      { id: 'm4a3e2', name: 'M4A3E2', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
      { id: 'm4a1', name: 'M4A1', nation: 'usa', vehicleClass: 'medium', serviceYear: 1942, family: 'm4a3' },
    ];

    const layout = techTreeLayout(entries);
    const usa = layout.nations[0];
    const medLane = usa.lanes[0];
    expect(medLane.groups).toHaveLength(1);

    const group = medLane.groups[0];
    expect(group.family).toBe('m4a3');
    // 排序后:1942 m4a1 -> 1944 m4a3_76w -> 1944 m4a3e2 -> 1944 m4a3e8
    expect(group.members.map((m) => m.id)).toEqual(['m4a1', 'm4a3_76w', 'm4a3e2', 'm4a3e8']);
  });

  it('column 正确对应组内最早服役年份在全局 years 里的下标', () => {
    const entries: TechTreeEntry[] = [
      { id: 'v1941', name: '早车', nation: 'ussr', vehicleClass: 'medium', serviceYear: 1941, family: 'fam1' },
      { id: 'v1943', name: '中车', nation: 'germany', vehicleClass: 'heavy', serviceYear: 1943, family: 'fam2' },
      // 组 fam3 含有 1944 与 1945
      { id: 'v1945', name: '晚车B', nation: 'usa', vehicleClass: 'medium', serviceYear: 1945, family: 'fam3' },
      { id: 'v1944', name: '晚车A', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'fam3' },
    ];

    const layout = techTreeLayout(entries);
    // years: [1941, 1943, 1944, 1945]
    expect(layout.years).toEqual([1941, 1943, 1944, 1945]);

    const usa = layout.nations.find((n) => n.nation === 'usa')!;
    const fam3Group = usa.lanes[0].groups.find((g) => g.family === 'fam3')!;
    // 组内最早年份为 1944,在 years 中的下标为 2
    expect(fam3Group.column).toBe(2);

    const de = layout.nations.find((n) => n.nation === 'germany')!;
    const fam2Group = de.lanes[0].groups[0];
    // 最早年份 1943,下标为 1
    expect(fam2Group.column).toBe(1);
  });

  it('标题回退:FAMILY_NAMES 中有的用映射名,没有的用组内第一辆车的名字', () => {
    const entries: TechTreeEntry[] = [
      // 已知车族 m4a3
      { id: 'm4a3_76w', name: 'M4A3(76)W', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
      // 未知车族 unknown_proto,第一辆车为 Proto A(1942),第二辆车为 Proto B(1944)
      { id: 'proto_b', name: 'Proto B', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'unknown_proto' },
      { id: 'proto_a', name: 'Proto A', nation: 'usa', vehicleClass: 'medium', serviceYear: 1942, family: 'unknown_proto' },
    ];

    const layout = techTreeLayout(entries);
    const usaMed = layout.nations[0].lanes[0];

    const m4Group = usaMed.groups.find((g) => g.family === 'm4a3')!;
    expect(m4Group.title).toBe('M4A3 谢尔曼');
    expect(m4Group.title).toBe(FAMILY_NAMES['m4a3']);

    const unknownGroup = usaMed.groups.find((g) => g.family === 'unknown_proto')!;
    // 未知车族回退到组内排序第一辆车 (Proto A, 1942)
    expect(unknownGroup.title).toBe('Proto A');
  });

  it('常量字典完整性与标准映射', () => {
    expect(FAMILY_NAMES['m4a3']).toBe('M4A3 谢尔曼');
    expect(NATION_NAMES['germany']).toBe('德国');
    expect(NATION_NAMES['ussr']).toBe('苏联');
    expect(NATION_NAMES['usa']).toBe('美国');
    expect(CLASS_NAMES['light']).toBe('轻型坦克');
    expect(CLASS_NAMES['medium']).toBe('中型坦克');
    expect(CLASS_NAMES['heavy']).toBe('重型坦克');
    expect(CLASS_NAMES['td']).toBe('坦克歼击车 / 突击炮');
  });

  it('真实八辆车全景数据布局正确性', () => {
    const entries: TechTreeEntry[] = [
      { id: 'tiger_i', name: '虎式 Ausf. E', nation: 'germany', vehicleClass: 'heavy', serviceYear: 1944, family: 'tiger_i' },
      { id: 'tiger_ii', name: '虎王(H)', nation: 'germany', vehicleClass: 'heavy', serviceYear: 1944, family: 'tiger_ii' },
      { id: 't34_85', name: 'T-34-85', nation: 'ussr', vehicleClass: 'medium', serviceYear: 1944, family: 't34_85' },
      { id: 'su_100', name: 'SU-100', nation: 'ussr', vehicleClass: 'td', serviceYear: 1944, family: 'su100' },
      { id: 'isu_122', name: 'ISU-122', nation: 'ussr', vehicleClass: 'td', serviceYear: 1943, family: 'isu122' },
      { id: 'm4a3_76w', name: 'M4A3(76)W', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
      { id: 'm4a3e8', name: 'M4A3E8', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
      { id: 'm4a3e2', name: 'M4A3E2', nation: 'usa', vehicleClass: 'medium', serviceYear: 1944, family: 'm4a3' },
    ];

    const layout = techTreeLayout(entries);
    expect(layout.years).toEqual([1943, 1944]);
    expect(layout.nations.map((n) => n.nation)).toEqual(['germany', 'ussr', 'usa']);

    // 德国: heavy lane
    const de = layout.nations[0];
    expect(de.lanes.map((l) => l.vehicleClass)).toEqual(['heavy']);
    expect(de.lanes[0].groups).toHaveLength(2);

    // 苏联: medium (t34_85), td (isu_122, su_100)
    const su = layout.nations[1];
    expect(su.lanes.map((l) => l.vehicleClass)).toEqual(['medium', 'td']);
    const suTd = su.lanes.find((l) => l.vehicleClass === 'td')!;
    expect(suTd.groups).toHaveLength(2);
    // isu122(1943, col 0) 应该排在 su100(1944, col 1) 前面
    expect(suTd.groups[0].family).toBe('isu122');
    expect(suTd.groups[0].column).toBe(0);
    expect(suTd.groups[1].family).toBe('su100');
    expect(suTd.groups[1].column).toBe(1);

    // 美国: medium 只有一组 m4a3 (3 辆车)
    const us = layout.nations[2];
    expect(us.lanes.map((l) => l.vehicleClass)).toEqual(['medium']);
    const m4Group = us.lanes[0].groups[0];
    expect(m4Group.title).toBe('M4A3 谢尔曼');
    expect(m4Group.members).toHaveLength(3);
    expect(m4Group.column).toBe(1); // 1944
  });
});
