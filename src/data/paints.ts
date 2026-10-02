import type { VehicleSpec } from './types';

/**
 * 载具历史涂装方案定义。
 * 涂装色即模型主体色, 换涂装 = 换 spec.color。
 * 出处规则: 标准色号(RAL / FS 等)只写资料里能对上的;屏幕色值查不到标准 RGB 的,一律标「估算」并写方法。
 * 主程已对照涂装复原资料逐条核对(见各项 source)。
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
    source: '色号 RAL 7021(Panzergrau / Dunkelgrau);色值为估算: 涂装复原资料给出的屏幕色约 #353536–#4A4A4C, 取略偏蓝的 #3B3F42',
    note: '1943 年 2 月以前德军装甲车辆的标准全车涂装',
  },
  dunkelgelb: {
    id: 'dunkelgelb',
    name: '暗黄色',
    color: 0xa89060,
    source: '色号 RAL 7028 Dunkelgelb;屏幕色参考涂装复原资料约 #9A8953–#A39448, 取项目里虎式既有的 #A89060',
    note: '1943 年 2 月起德军装甲车辆的标准出厂底色',
  },
  olivgruen: {
    id: 'olivgruen',
    name: '橄榄绿',
    color: 0x4b533b,
    source: '色号 RAL 6003 Olivgrün(与空军 RLM 62 同色);色值为估算: 中暗橄榄绿 #4B533B, 没有查到可核对的标准 RGB',
    note: '1943 年春起与 Dunkelgelb、Rotbraun 组成三色迷彩的绿色;1944 年下半年起部分车辆以它为主体色',
  },
  winterWhite: {
    id: 'winter_white',
    name: '冬季水洗白',
    color: 0xd8dcd6,
    source: '估算: 战地临时涂刷的水溶性白色冬季涂料, 取带轻微风化的灰白色(RGB 216, 220, 214)',
    note: '东线等冬季战场上临时涂刷、开春洗去的白色伪装涂料',
  },
} as const;

/** 苏军战地临时水洗白 */
const SOVIET_WINTER_WHITE: PaintSpec = {
  id: 'winter_white',
  name: '冬季水洗白',
  color: 0xd8dcd6,
  source: '估算: 苏军战地临时刷的可洗去白色伪装涂料, 取微带风化的灰白色(RGB 216, 220, 214)',
  note: '冬季作战期间战地临时涂刷, 开春洗去',
};

/** 美军战地水洗白 */
const US_WINTER_WHITE: PaintSpec = {
  id: 'winter_white',
  name: '冬季水洗白',
  color: 0xd8dcd6,
  source: '估算: 美军战地临时刷的白色伪装涂料, 取微带风化的灰白色(RGB 216, 220, 214)',
  note: '1944—45 年冬季(阿登战役前后)战地临时涂刷的白色伪装',
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
        source: '色号 RAL 7028 Dunkelgelb;色值 0xa89060 是项目既有的虎式出厂色',
        note: '1943 年 2 月起德军装甲车辆的标准出厂底色',
      };
    case 'tiger_ii':
      return {
        id: 'default',
        name: '出厂涂装',
        color: spec.color,
        source: '项目既有的虎王出厂色 0x6b6e5e(灰橄榄色, 没有对应标准色号)',
        note: '沿用项目原有色值',
      };
    case 't34_85':
      return {
        id: 'default',
        name: '出厂 4BO 防护绿',
        color: spec.color,
        source: '4БО 防护绿(1938 年起红军的标准车辆色);色值 0x4b5a2c 是项目既有值',
        note: '1944 年 T-34-85 投产后的标准出厂涂装',
      };
    case 'su_100':
      return {
        id: 'default',
        name: '出厂 4BO 防护绿',
        color: spec.color,
        source: '4БО 防护绿(1938 年起红军的标准车辆色);色值 0x4f5b31 是项目既有值',
        note: '1944 年 SU-100 投产后的标准出厂涂装',
      };
    case 'isu_122':
      return {
        id: 'default',
        name: '出厂 4BO 防护绿',
        color: spec.color,
        source: '4БО 防护绿(1938 年起红军的标准车辆色);色值 0x535e36 是项目既有值',
        note: '1944 年 ISU-122 服役后的标准出厂涂装',
      };
    case 'm4a3_76w':
    case 'm4a3e8':
    case 'm4a3e2':
      return {
        id: 'default',
        name: '出厂橄榄褐',
        color: spec.color,
        source: '美军 Olive Drab(陆军 No. 9 / AN 319, 最接近的现代色卡是 FS 33070);色值 0x544f3d 是 026 号卡定的既有值',
        note: '二战美军战车的标准出厂涂装',
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
      source: '估算: 战地临时涂刷的可洗去白色涂料, 取带轻微风化的灰白色(RGB 216, 220, 214)',
      note: '冬季作战期间战地临时涂刷',
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
