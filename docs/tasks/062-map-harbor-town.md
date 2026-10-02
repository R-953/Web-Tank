# 062-map-harbor-town:新地图——港口城镇

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/062-map-harbor-town`
- 规模:M
- 和 054–061 以及另一张地图卡并行;每张地图卡**只新增自己的地图文件**,不改 `maps.ts`(两张卡都往 `MAPS` 里注册会冲突,注册由主程合并时一次加好)

## 目标

负责人 10-02 要求更多地图。已定:先做两张——港口城镇和雪地森林。本卡:**港口城镇**。参考负责人给的 War Thunder 战斗准备界面截图里的港口 / 工业区:楼群、道路、铁路、堆场,适合中近距离、拐角战斗。

## 背景与参考

- 地图数据类型:`src/data/types.ts` 的 `MapSpec`(`terrain` 手写地形要素、`surface` 手写地表字符网格、`waterLevel`、`vegetation`、`obstacles`、`spawns`);现有的两张图(`RIVER_VALLEY`、`TRAINING_GROUND`)在 `src/data/maps.ts`,**照着它们的写法**,所有数据手写、确定性,不要程序化随机生成。
- 渲染和碰撞:`src/game/Map.ts`、`src/game/terrain.ts`(障碍物是带碰撞体的盒子;地表类型决定颜色和滚动阻力,见 `src/data/surfaces.ts`)。先看现有地图怎么处理障碍物的渲染合并,**障碍物总数控制在 300 个以内**。
- 已有的地图测试:`tests/map.test.ts`、`tests/terrain.test.ts`;出生点视线、AI 巡逻相关的测试在 `tests/` 下搜 `spawn` / `patrol`。新地图要过同样的检查。
- 敌方 AI 的携弹、还击、巡逻参数见 `SpawnSpec`;玩家出生点、5 个左右的敌方出生点(用 `VEHICLES` 里已有的车,混合 `t34_85`、`tiger_ii` 等,和 `RIVER_VALLEY` 一样的数量级)。
- 地图的字符网格和坐标约定、边长必须是 `cellSize` 的整数倍等细节看现有地图的注释。

## 要做的事

- 边长 1500 m(`cellSize` 取现有地图用过的值),基准地形基本平坦,港口一侧(例如南边或西边)用 `valley` 或 `waterLevel` 做出海岸线和一片浅水码头水域(浅水可涉水但很慢,和现有水面规则一致)。
- 地表:用 `surface` 字符网格画出道路网(`rock` 或 `dirt` 当路面,宽度约 8–12 m,有一条主干道和几条横街)、一条铁路走廊(用 `dirt`)、堆场空地;其余是 `grass` / `dirt`。
- 障碍物(盒子):一片仓库 / 厂房群(宽 20–60 m、高 8–14 m)、几栋 15–25 m 高的办公楼、集装箱堆(每堆几个 6 × 2.6 × 2.4 m 的盒子码放成 2–3 层)、几处低矮围墙,街道留出坦克能通过的宽度(≥ 8 m),并留出几个能互相看见的长直街区和几个只能拐角相遇的位置。
- 植被:只有零星的树 / 灌木(街边、空地),不要成片森林;不要草丛很密(`grass.density` 取低值)。
- 玩家出生点放在城镇一端的开阔处;敌方出生点分散在街区里,带 2–3 条巡逻路线沿主干道和横街。

1. 新增 `src/data/mapspecs/harbor_town.ts`,导出 `HARBOR_TOWN: MapSpec`(`id: 'harbor_town'`,`name` 用中文「港口城镇」)。
2. 新增 `tests/harbor-town-map.test.ts`:地图能通过现有的构建流程(`buildTerrain` 不抛错、尺寸和 `cellSize` 整除);玩家和所有敌方出生点都在地图内、不在障碍物里、不在水里(`waterLevel` 以下)、离边界墙够远;玩家出生点到每个敌方出生点的直线距离在 [150, 900] m 之间;巡逻目标点都在地图内、不在障碍物里;障碍物数量 ≤ 300 且都在地图内;地表网格行数 / 列数和 legend 对得上。
3. **不要**在 `maps.ts` 里注册,也不要改机库的地图下拉(主程合并后统一接)。

## 允许修改的文件

- 新增:`src/data/mapspecs/harbor_town.ts`、`tests/harbor-town-map.test.ts`、`changelog.d/<日期>-062-map-harbor-town.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 第 2 条的测试都有
- [ ] 主程会注册后在浏览器里开一局,看地形、障碍物、AI 巡逻、小地图 / 地图界面底图是否合理

## 不做

- 占点 / 多模式;新的障碍物种类(只用盒子);新的地表类型;新的植物种类;改渲染或碰撞代码。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
