# 063-map-snow-forest:新地图——雪地森林

- 负责:Antigravity(3.8 Flash High)
- 状态:已完成
- 分支:`task/063-map-snow-forest`
- 规模:M
- 和 054–061 以及另一张地图卡并行;每张地图卡**只新增自己的地图文件**,不改 `maps.ts`(两张卡都往 `MAPS` 里注册会冲突,注册由主程合并时一次加好)

## 目标

负责人 10-02 要求更多地图。已定:先做两张——港口城镇和雪地森林。本卡:**雪地森林**。偏开阔和遮蔽并存:雪原上有树林带、小丘和冰冻的河道,适合远距离对射和林缘伏击。

## 背景与参考

- 地图数据类型:`src/data/types.ts` 的 `MapSpec`(`terrain` 手写地形要素、`surface` 手写地表字符网格、`waterLevel`、`vegetation`、`obstacles`、`spawns`);现有的两张图(`RIVER_VALLEY`、`TRAINING_GROUND`)在 `src/data/maps.ts`,**照着它们的写法**,所有数据手写、确定性,不要程序化随机生成。
- 渲染和碰撞:`src/game/Map.ts`、`src/game/terrain.ts`(障碍物是带碰撞体的盒子;地表类型决定颜色和滚动阻力,见 `src/data/surfaces.ts`)。先看现有地图怎么处理障碍物的渲染合并,**障碍物总数控制在 300 个以内**。
- 已有的地图测试:`tests/map.test.ts`、`tests/terrain.test.ts`;出生点视线、AI 巡逻相关的测试在 `tests/` 下搜 `spawn` / `patrol`。新地图要过同样的检查。
- 敌方 AI 的携弹、还击、巡逻参数见 `SpawnSpec`;玩家出生点、5 个左右的敌方出生点(用 `VEHICLES` 里已有的车,混合 `t34_85`、`tiger_ii` 等,和 `RIVER_VALLEY` 一样的数量级)。
- 地图的字符网格和坐标约定、边长必须是 `cellSize` 的整数倍等细节看现有地图的注释。

## 要做的事

- 边长 2000 m。地形:起伏的缓丘和几条 `ridge` 土堤做掩体,一条冰冻河谷(`valley`,谷底 `surface` 用 `rock` 或 `sand` 代替冰面——没有「雪」的地表类型,**不要新增**;地表整体用 `grass` 表示被雪覆盖的平原是可以的,在地图名和注释里说明「用现有地表类型近似雪地」,颜色上的差异留给以后加雪地表类型时再做)。
- 障碍物:少量——几处农舍 / 谷仓(宽 10–20 m、高 6–9 m)、倒木堆和石堆(低矮盒子),不要城镇。
- 植被:成片的针叶林带(`pine` 为主,混少量 `tree` 和 `bush`;多边形区域,密度要有高低变化),林间留出坦克可以通行的空地和林间路;林缘到敌方出生点之间要有可以隐蔽接近的路线。
- 玩家出生点在开阔雪原一端的林缘;敌方出生点分布在林带、农舍和丘后,带 2–3 条巡逻路线。

1. 新增 `src/data/mapspecs/snow_forest.ts`,导出 `SNOW_FOREST: MapSpec`(`id: 'snow_forest'`,`name` 用中文「雪地森林」)。
2. 新增 `tests/snow-forest-map.test.ts`:地图能通过现有的构建流程(`buildTerrain` 不抛错、尺寸和 `cellSize` 整除);玩家和所有敌方出生点都在地图内、不在障碍物里、不在水里(`waterLevel` 以下)、离边界墙够远;玩家出生点到每个敌方出生点的直线距离在 [150, 900] m 之间;巡逻目标点都在地图内、不在障碍物里;障碍物数量 ≤ 300 且都在地图内;地表网格行数 / 列数和 legend 对得上。
3. **不要**在 `maps.ts` 里注册,也不要改机库的地图下拉(主程合并后统一接)。

## 允许修改的文件

- 新增:`src/data/mapspecs/snow_forest.ts`、`tests/snow-forest-map.test.ts`、`changelog.d/<日期>-063-map-snow-forest.md`

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 第 2 条的测试都有
- [ ] 主程会注册后在浏览器里开一局,看地形、障碍物、AI 巡逻、小地图 / 地图界面底图是否合理

## 不做

- 占点 / 多模式;新的障碍物种类(只用盒子);新的地表类型;新的植物种类;改渲染或碰撞代码。

## 结果(完成后由执行者填写)

- 改动文件:
  - 新增 `src/data/mapspecs/snow_forest.ts`
  - 新增 `tests/snow-forest-map.test.ts`
  - 新增 `changelog.d/2026-10-02-063-map-snow-forest.md`
  - 修改 `docs/tasks/063-map-snow-forest.md`
- 命令与结果:
  - `npm run lint`: 通过 (TypeScript 校验 0 错误)
  - `npm test`: 全部通过 (61 个测试文件, 618 个用例全部 PASS)
  - `npm run build`: 通过 (生产构建成功)
- 偏差 / 未完成 / 待决定:
  - 无偏差。未修改 `maps.ts` 和机库下拉菜单, 等候主程合并两张地图卡后统一注册与实机联调。
