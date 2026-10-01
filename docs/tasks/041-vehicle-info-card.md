# 041-vehicle-info-card:鼠标悬停的载具信息卡片

- 负责:Antigravity(3.8 Flash High)
- 状态:待审查
- 分支:`task/041-vehicle-info-card`
- 规模:M

## 目标

负责人 10-02 提出:鼠标放在哪辆车上,就显示这辆车的信息卡片,卡片可以双击关闭。参考 War Thunder 的载具信息卡(名称、类型、主要性能、括号里给出满级乘员的数值)。本卡做**独立组件**和纯数据函数,挂到编组栏 / 科技树上由主程接线。

## 卡片内容(有数据的都列,没有的不编)

- 标题:载具名;一行副标题:国家 · 类型 · 服役年份
- 火力:主炮名称和口径;各弹种(名称、弹种类型、炮口穿深);同轴机枪;弹药架容量
- 瞄准:方向机 H、高低机 V(°/s),俯仰范围;装填时间(s);瞄准镜倍率
  - 方向机、高低机、装填都显示「当前车组的值(满级 X)」,满级值来自 `crewAce`,当前值用 029 的 `applyCrewSkill` 按传入的技能算
- 防护:车体 前 / 侧 / 后,有首下时加一行首下;炮塔 前 / 侧 / 后(mm,水平来弹视线厚度)
- 机动:最大速度、原地转向 或「固定半径 N m」、起步加速度
- 乘员人数

## 允许修改的文件

- 新增:`src/ui/menu/VehicleCard.ts`、`tests/vehicle-card.test.ts`
- 修改:`src/ui/menu/styles.ts`(只允许在末尾追加卡片样式)
- 新增:`changelog.d/<日期>-041-vehicle-info-card.md`

## 接口(定死,不要改)

```ts
import type { VehicleSpec } from '../../data/types';

export interface CardRow { label: string; value: string }
export interface CardSection { title: string; rows: CardRow[] }
export interface VehicleCardData { title: string; subtitle: string; sections: CardSection[] }

/** 纯函数:按技能 skill ∈ [0, 1] 生成卡片内容(不碰 DOM) */
export function vehicleCardData(spec: VehicleSpec, skill: number): VehicleCardData;

export class VehicleCard {
  constructor(parent: HTMLElement);
  /** 在 anchor 旁边显示(优先右侧,放不下就左侧 / 上方,不超出视口) */
  show(spec: VehicleSpec, skill: number, anchor: DOMRect): void;
  /** 鼠标离开载具时调用:延迟约 150 ms 隐藏;这段时间里鼠标移到卡片上就不隐藏 */
  hideSoon(): void;
  hide(): void;
  /** 在卡片上双击:关闭(调用 hide) */
  dispose(): void;
}
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `tests/vehicle-card.test.ts`:
  - `vehicleCardData`:谢尔曼 M4A3E8 在 skill 0 / 1 时装填分别是 7.6 / 5.9 s,并带「满级 5.9 s」;有首下的车多一行首下;固定半径转向的车显示半径;没有 `crewAce` 的情况不报错
  - jsdom:`show` 后可见、内容含载具名;双击后隐藏;`hideSoon` 期间鼠标进入卡片则不隐藏
- [x] 文字用简体中文,单位和现有界面一致

## 不做

- 挂到编组栏、科技树、地图界面上(主程接线)
- 载具图片(用 `silhouette` 剪影或不放图)

## 结果(完成后由执行者填写)

- 改动文件:
  - 新增: `src/ui/menu/VehicleCard.ts`
  - 新增: `tests/vehicle-card.test.ts`
  - 新增: `changelog.d/2026-10-02-041-vehicle-info-card.md`
  - 修改: `src/ui/menu/styles.ts`
  - 修改: `docs/tasks/041-vehicle-info-card.md`
- 命令与结果:
  - `npm run lint`: 通过 (tsc --noEmit 无错误)
  - `npm test`: 通过 (46 个测试套件, 479 个测试全部通过)
  - `npm run build`: 通过 (tsc 与 vite 生产构建打包成功)
- 偏差 / 未完成 / 待决定:
  - 无偏差, 全部要求均已按规范完成; 组件为独立实现, 挂载由主程后续接线。

