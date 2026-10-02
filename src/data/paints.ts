import type { VehicleSpec } from './types';

/**
 * 载具历史涂装方案定义。
 * 涂装色即模型主体色, 换涂装 = 换 spec.color。
 * 出处核实规则: 标准色号(RAL/FS等)严格对应标准转换, 未知出处使用估算并标明方法。
 */
export interface PaintSpec {
  /** 涂装方案唯一标识, 'default' 固定保留给出厂涂装 */
  id: string;
  /** 显示中文名称 */
  name: string;
  /** 十六进制颜色数值 */
  color: number;
  /** 数据出处或估算方法 */
  source: string;
  /** 使用时间或作战场合说明 */
  note?: string;
}

/** 德军标准色 */
const GERMAN_PAINTS = {
  panzergrau: {
    id: 'panzergrau',
    name: '装甲灰',
    color: 0x3b3f42,
    source: 'RAL 7021 Dunkelgrau(标准色卡转换 RGB 59, 63, 66)',
    note: '1943 年 2 月前早期德军战车全车标准装甲灰涂装',
  },
  dunkelgelb: {
    id: 'dunkelgelb',
    name: '暗黄色',
    color: 0xa89060,
    source: 'RAL 7028 Dunkelgelb(德军标准暗黄, 与虎式出厂色相同)',
    note: '1943 年 2 月起德军标准出厂底漆与主体色',
  },
  olivgruen: {
    id: 'olivgruen',
    name: '橄榄绿',
    color: 0x4b533b,
    source: 'RAL 6003 Olivgrün(标准色卡转换 RGB 75, 83, 59)',
    note: '1943 年起德军三色迷彩之绿色, 后期部分车辆直接作为主体底漆',
  },
  winterWhite: {
    id: 'winter_white',
    name: '冬季水洗白',
    color: 0xd8dcd6,
    source: '估算: 战地临时石灰水洗涂料(Kalktünche), 取带轻微风化的灰白色(RGB 216, 220, 214)',
    note: '东线与阿登战役冬季战地临时涂刷的石灰白色水洗漆',
  },
} as const;

/** 苏军战地临时水洗白 */
const SOVIET_WINTER_WHITE: PaintSpec = {
  id: 'winter_white',
  name: '冬季水洗白',
  color: 0xd8dcd6,
  source: '估算: 苏军临时石灰水洗白色伪装涂料, 微带风化灰白色(RGB 216, 220, 214)',
  note: '冬季作战期间战地临时涂刷的石灰白色水洗漆, 春季洗去',
};

/** 美军战地水洗白 */
const US_WINTER_WHITE: PaintSpec = {
  id: 'winter_white',
  name: '冬季水洗白',
  color: 0xd8dcd6,
  source: '估算: 1944 年冬阿登战役美军战地临时水洗白漆, 微带风化灰白色(RGB 216, 220, 214)',
  note: '1944 年冬季阿登战役(突出部战役)美军战地临时喷刷的白色伪装漆',
};

/** 车型专属涂装列表构造函数(不含出厂项) */
const VEHICLE_EXTRA_PAINTS: Record<string, (spec: VehicleSpec) => readonly PaintSpec[]> = {
  tiger_i: () => [
    GERMAN_PAINTS.panzergrau,
    GERMAN_PAINTS.olivgruen,
    GERMAN_PAINTS.winterWhite,
  ],
  tiger_ii: () => [
    GERMAN_PAINTS.dunkelgelb,
    GERMAN_PAINTS.olivgruen,
    GERMAN_PAINTS.winterWhite,
  ],
  t34_85: () => [SOVIET_WINTER_WHITE],
  su_100: () => [SOVIET_WINTER_WHITE],
  isu_122: () => [SOVIET_WINTER_WHITE],
  m4a3_76w: () => [US_WINTER_WHITE],
  m4a3e8: () => [US_WINTER_WHITE],
  m4a3e2: () => [US_WINTER_WHITE],
};

/** 出厂涂装元数据(依车型定制说明与出处) */
function defaultPaintSpec(spec: VehicleSpec): PaintSpec {
  switch (spec.id) {
    case 'tiger_i':
      return {
        id: 'default',
        name: '出厂暗黄',
        color: spec.color,
        source: 'RAL 7028 Dunkelgelb(虎式出厂色值 0xa89060)',
        note: '1943 年 2 月起德军装甲车辆标准出厂底色',
      };
    case 'tiger_ii':
      return {
        id: 'default',
        name: '出厂涂装',
        color: spec.color,
        source: '虎王出厂基色(0x6b6e5e)',
        note: '1944 年后期型标准涂装基色',
      };
    case 't34_85':
      return {
        id: 'default',
        name: '出厂 4BO 防护绿',
        color: spec.color,
        source: '苏联 4BO 防护绿标准色(T-34-85 出厂色值 0x4b5a2c)',
        note: '1944 年苏联装甲战车标准出厂保护绿涂装',
      };
    case 'su_100':
      return {
        id: 'default',
        name: '出厂 4BO 防护绿',
        color: spec.color,
        source: '苏联 4BO 防护绿标准色(SU-100 出厂色值 0x4f5b31)',
        note: '1944 年第 183 厂与乌拉尔重机厂标准出厂防护绿',
      };
    case 'isu_122':
      return {
        id: 'default',
        name: '出厂 4BO 防护绿',
        color: spec.color,
        source: '苏联 4BO 防护绿标准色(ISU-122 出厂色值 0x535e36)',
        note: '1944 年车里雅宾斯克基洛夫厂(ChKZ)标准出厂防护绿',
      };
    case 'm4a3_76w':
    case 'm4a3e8':
    case 'm4a3e2':
      return {
        id: 'default',
        name: '出厂橄榄褐',
        color: spec.color,
        source: '二战美军 Olive Drab No. 9 / No. 319(FS 33070, 026 号卡色值 0x544f3d)',
        note: '1944 年美军陆军战车标准出厂橄榄褐涂料',
      };
    default:
      return {
        id: 'default',
        name: '出厂涂装',
        color: spec.color,
        source: '载具出厂原始主体色值',
        note: '标准出厂涂装方案',
      };
  }
}

/**
 * 获取指定载具可用的涂装方案列表。
 * 第一项永远是「出厂」(id 'default', color = spec.color)。
 */
export function paintsFor(spec: VehicleSpec): readonly PaintSpec[] {
  const def = defaultPaintSpec(spec);
  const extraBuilder = VEHICLE_EXTRA_PAINTS[spec.id];
  const extras = extraBuilder ? extraBuilder(spec) : [
    {
      id: 'winter_white',
      name: '冬季水洗白',
      color: 0xd8dcd6,
      source: '估算: 战地临时石灰水洗涂料(Kalktünche), 取带轻微风化的灰白色(RGB 216, 220, 214)',
      note: '冬季作战期间战地临时涂刷的石灰白色水洗漆',
    },
  ];
  return [def, ...extras];
}

/**
 * 套用涂装方案到 VehicleSpec 上。
 * 未知 id / null / undefined / 'default' 原样返回入参;
 * 命中合法涂装时返回新对象, 不修改入参。
 */
export function applyPaint(spec: VehicleSpec, paintId: string | null | undefined): VehicleSpec {
  if (!paintId || paintId === 'default') {
    return spec;
  }
  const paints = paintsFor(spec);
  const found = paints.find((p) => p.id === paintId);
  if (!found) {
    return spec;
  }
  return {
    ...spec,
    color: found.color,
  };
}
