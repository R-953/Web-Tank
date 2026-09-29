/**
 * 数据层类型定义(核心数据结构,见 Readme.md「核心数据结构约定」)。
 * 新增载具 / 武器 / 地图时复用这些结构,不要另起格式;要改结构先征得项目负责人同意,并记入 Changelog.md。
 *
 * 单位约定:距离 m、速度 km/h(maxSpeed)或 m/s(muzzleVelocity)、角度 度、装甲与穿深 mm。
 * 坐标约定:+Y 向上;载具本地 -Z 为车头;heading 为绕 +Y 的旋转角,0 = 朝 -Z,正值向左转。
 */

export type Vec2 = readonly [x: number, z: number];
export type Vec3 = readonly [x: number, y: number, z: number];

/**
 * 各面装甲厚度,mm。碰撞体是竖直的盒子,所以倾斜装甲要填「水平来弹的视线厚度」= 厚度 / cos(倾角),
 * 例如 T-34 首上 45mm@60° 填 90。顶/底面按三者中最薄值计算。
 */
export interface ArmorSpec {
  front: number;
  side: number;
  rear: number;
}

/**
 * 弹种。通用规则见 data/shells.ts(每个弹种一套穿深 / 入射角 / 跳弹 / 后效参数):
 *   动能弹 · 实心:AP(尖头无帽)、APC(被帽)、APBC(钝头 + 风帽)、APCBC(被帽 + 风帽)
 *   动能弹 · 带装药(击穿后延时起爆):APHE、APHEBC、APCBC-HE
 *   动能弹 · 硬芯:APCR
 *   化学能弹:HEAT(破甲)、HE(高爆)、HESH(碎甲)
 */
export type ShellType =
  | 'AP'
  | 'APC'
  | 'APBC'
  | 'APCBC'
  | 'APHE'
  | 'APHEBC'
  | 'APCBC-HE'
  | 'APCR'
  | 'HEAT'
  | 'HE'
  | 'HESH';

export interface ShellSpec {
  /** 同一门炮内唯一,例如 'pzgr39' */
  id: string;
  /** 显示名,例如 'Pzgr.39' */
  name: string;
  type: ShellType;
  /** 口径,mm */
  caliber: number;
  /** 弹丸质量,kg */
  mass: number;
  /** 炮口初速,m/s */
  muzzleVelocity: number;
  /**
   * 穿深,mm(对垂直均质装甲)。
   * 动能弹:炮口处(近距离)的值,飞行中按弹速衰减(de Marre);化学能弹:固定值,与距离无关。
   */
  penetration: number;
  /** 装药量,g(TNT 当量);实心弹和硬芯弹为 0 */
  explosiveMass: number;
  /** 引信延迟:击穿后再飞多远起爆,m(化学能弹为 0,着发) */
  fuseDelay: number;
  /** 引信灵敏度:穿过的等效装甲 ≥ 该值才会触发引信,mm */
  fuseSensitivity: number;
  /** 超音速阻力系数 Cd;缺省取该弹种在 data/shells.ts 里的通用值 */
  dragCoefficient?: number;
}

export interface WeaponSpec {
  id: string;
  name: string;
  /** 主炮:装填时间,秒(满编装填手、炮闩完好);机枪:换弹链时间 */
  reloadTime: number;
  /** 可携带的弹种;第一种是默认弹,敌方 AI 也主要用它。机枪只有一种弹 */
  ammo: ShellSpec[];
  /** 武器类型,缺省为主炮 'cannon';'mg' = 同轴机枪(不占弹药架,单独计弹链) */
  kind?: 'cannon' | 'mg';
  /** 机枪:射速,发 / 分 */
  rateOfFire?: number;
  /** 机枪:每条弹链(弹鼓)的发数 */
  beltSize?: number;
  /** 机枪:携带总发数 */
  rounds?: number;
  /** 机枪:枪口在火炮坐标系里的位置(随火炮俯仰),m;缺省在炮管右侧 */
  mount?: Vec3;
}

/** 出发前的携弹方案:弹种 id → 发数 */
export type Loadout = Record<string, number>;

/** 车体外形与机动参数 */
export interface HullSpec {
  length: number;
  width: number;
  height: number;
  /** 车体转向速度,度/秒 */
  turnRate: number;
  /**
   * 起步最大牵引加速度,m/s²(受履带附着力 / 低挡扭矩限制)。高速段由发动机功率限制,
   * 功率由 maxSpeed 和滚动阻力反推(见 Vehicle.longitudinalSpeed);爬坡能力 ≈ asin((acceleration − 0.05g) / g)。
   */
  acceleration: number;
}

/** 炮塔外形参数 */
export interface TurretSpec {
  length: number;
  width: number;
  height: number;
  barrelLength: number;
  /** 火炮俯仰范围 [最大俯角(负), 最大仰角],度 */
  elevation: readonly [min: number, max: number];
  /** 高低机速度(火炮俯仰),度/秒 */
  elevationSpeed: number;
}

/** 炮手瞄准镜 */
export interface SightSpec {
  /** 可切换的放大倍率(按 Z 循环),例如 [2.5, 5] */
  magnifications: number[];
  /** 分划样式 */
  reticle: 'german' | 'soviet';
}

/**
 * 模块 / 乘员所在的坐标系:
 *   hull   车体本地坐标,原点在车体碰撞盒中心,-Z 为车头,+X 为右
 *   turret 炮塔坐标,原点在车体顶面中心(炮塔座圈),y = 0 为车顶,随炮塔转动
 *   gun    火炮坐标,原点在炮耳轴(炮塔正面中部),-Z 沿炮管,随火炮俯仰
 */
export type AttachPart = 'hull' | 'turret' | 'gun';

export type ModuleType =
  | 'engine'
  | 'transmission'
  | 'track'
  | 'barrel'
  | 'breech'
  | 'ammo'
  | 'fuel'
  | 'traverse'
  | 'elevation';

export type CrewRole = 'commander' | 'gunner' | 'loader' | 'driver' | 'radio';

export interface ModuleSpec {
  /** 同一辆车内唯一,例如 'engine'、'track_l'、'ammo_sponson_r' */
  id: string;
  type: ModuleType;
  part: AttachPart;
  /** 盒子中心与尺寸 [x, y, z],m,所在坐标系见 AttachPart */
  center: Vec3;
  size: Vec3;
  /** 弹药架专用:能放几发 */
  capacity?: number;
  /**
   * 弹药架专用:取弹顺序,1 最先取空。少带弹时先空出来的也是这些架(与 War Thunder 相同),
   * 所以把最危险的弹药架排在前面,少带弹就能把它清空。
   */
  drawOrder?: number;
}

export interface CrewSpec {
  /** 初始岗位 */
  role: CrewRole;
  part: 'hull' | 'turret';
  /** 座位(躯干中心)坐标,m */
  center: Vec3;
}

/** 内部结构:模块 + 乘员。模块 / 乘员的血量与维修时间按类型固定,见 data/modules.ts */
export interface InternalsSpec {
  modules: ModuleSpec[];
  crew: CrewSpec[];
}

export interface VehicleSpec {
  id: string;
  name: string;
  /** 车体装甲 */
  armor: ArmorSpec;
  /** 炮塔装甲(炮塔碰撞盒按自身朝向判定受击面) */
  turretArmor: ArmorSpec;
  /** 最大前进速度,km/h */
  maxSpeed: number;
  /** 炮塔水平旋转速度(方向机),度/秒 */
  turretRotationSpeed: number;
  weapons: WeaponSpec[];
  hull: HullSpec;
  turret: TurretSpec;
  sight: SightSpec;
  internals: InternalsSpec;
  /** 主体颜色(十六进制) */
  color: number;
}

/** 手写高度网格(小地图 / 测试用;大地图用 TerrainSpec.features 描述) */
export interface HeightmapSpec {
  /** 每条边的采样点数,网格共 resolution × resolution 个点 */
  resolution: number;
  /** 行优先存储(先按 z 从 -size/2 到 +size/2 分行,行内 x 从 -size/2 到 +size/2),取值 0..1 */
  heights: number[];
  /** 实际高度 = heights[i] * heightScale,m */
  heightScale: number;
}

/**
 * 地表类型:决定地面颜色和滚动阻力(见 data/surfaces.ts)。
 * grass 草地 / 平原,dirt 土地 / 丘陵,sand 沙地 / 荒漠,rock 岩地 / 山地,mud 泥滩,water 浅水(涉水)
 */
export type SurfaceType = 'grass' | 'dirt' | 'sand' | 'rock' | 'mud' | 'water';

/**
 * 地形要素:按列表顺序叠加到基准高度上,手写、确定性(不是随机生成)。
 * 位置为地面坐标 [x, z],尺寸 m。surface 可选:在要素的主体范围内覆盖地表类型。
 */
export type TerrainFeature =
  /** 圆润的丘陵(余弦剖面) */
  | { kind: 'hill'; at: Vec2; radius: number; height: number; surface?: SurfaceType }
  /** 陡峭的山峰(锥形剖面,顶部略圆) */
  | { kind: 'mountain'; at: Vec2; radius: number; height: number; surface?: SurfaceType }
  /** 沿折线的山脊 / 土堤 */
  | { kind: 'ridge'; path: Vec2[]; width: number; height: number; surface?: SurfaceType }
  /** 平顶台地:半径内平顶,edge 为边坡宽度 */
  | { kind: 'plateau'; at: Vec2; radius: number; height: number; edge: number; surface?: SurfaceType }
  /** 沙丘带:半径内叠加平行的波浪,heading 为波峰走向(度,0 = 南北向) */
  | { kind: 'dunes'; at: Vec2; radius: number; height: number; wavelength: number; heading: number; surface?: SurfaceType }
  /** 河谷 / 河道:沿折线下切,谷底宽 width(平底),两侧 bank 宽的斜坡 */
  | { kind: 'valley'; path: Vec2[]; width: number; depth: number; bank: number; surface?: SurfaceType };

export interface TerrainSpec {
  /** 采样间距,m(渲染与碰撞网格的格子大小;地图边长必须是它的整数倍) */
  cellSize: number;
  /** 基准高度,m */
  base: number;
  /** 可选的手写高度网格,放大到 cellSize 后与要素叠加 */
  heightmap?: HeightmapSpec;
  features: TerrainFeature[];
}

/** 地表网格:rows 为手写字符网格(第一行是北边),每个字符对应 legend 里的地表类型 */
export interface SurfaceSpec {
  rows: string[];
  legend: Record<string, SurfaceType>;
}

export interface ObstacleSpec {
  /** 障碍物中心的地面坐标 [x, z] */
  position: Vec2;
  /** [宽(x), 高(y), 深(z)],m */
  size: Vec3;
  /** 绕 Y 轴旋转,度 */
  rotationY: number;
}

export interface SpawnSpec {
  /** 对应 VEHICLES 里的 id */
  vehicleId: string;
  position: Vec2;
  /** 朝向,度,0 = 朝 -Z,正值向左转 */
  heading: number;
  /** 有则按匀速往返巡逻:从出生点开到 to,再倒车回出生点 */
  patrol?: { to: Vec2; speed: number /* km/h */ };
  /** 敌方:是否会还击(缺省 true) */
  ai?: boolean;
  /** 敌方:携弹量占弹药架总容量的比例;缺省在 30%–100% 之间随机 */
  ammoFraction?: number;
}

/** 植物种类:阔叶树、针叶树、灌木(草丛按地表自动生成,不在区域里写) */
export type PlantKind = 'tree' | 'pine' | 'bush';

/**
 * 植被区:在圆形或多边形区域内按密度撒点。用固定种子,每次加载位置完全一样(确定性,不是每局随机)。
 * 水面、陡坡和出生点附近会自动跳过。
 */
export interface VegetationZone {
  kind: PlantKind;
  /** 圆形区域:中心 [x, z] 与半径 */
  at?: Vec2;
  radius?: number;
  /** 或多边形区域:顶点 [x, z] 按顺序 */
  polygon?: Vec2[];
  /** 密度,株 / 公顷(10 000 m²) */
  density: number;
  seed: number;
  /** 大小倍数范围,缺省 [0.8, 1.2] */
  scale?: readonly [number, number];
}

export interface VegetationSpec {
  zones: VegetationZone[];
  /**
   * 草丛:按地表自动铺满(只在镜头附近生成和渲染)。density = 草地上每 100 m² 的草丛数,
   * 土地、沙地等按比例减少,浅水里不长。
   */
  grass?: { density: number; seed: number };
  /** 出生点周围多少米内不长树和灌木,缺省 12 */
  clearRadius?: number;
}

export interface MapSpec {
  id: string;
  name: string;
  /** 地图边长,m(正方形,中心在原点) */
  size: number;
  terrain: TerrainSpec;
  /** 地表类型;缺省全部为草地 */
  surface?: SurfaceSpec;
  /** 水面高度,m;低于它的地面是浅水(可以涉水,但很慢)。缺省没有水 */
  waterLevel?: number;
  /** 草丛、灌木、树林;缺省没有植被 */
  vegetation?: VegetationSpec;
  obstacles: ObstacleSpec[];
  spawns: {
    player: SpawnSpec;
    targets: SpawnSpec[];
  };
}
