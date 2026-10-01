# 031-tech-tree-ui:科技树界面(独立组件,先不接入机库)

- 负责:Antigravity(3.8 Flash High)
- 状态:已合并
- 分支:`task/031-tech-tree-ui`
- 规模:M

## 目标

按设计稿 [docs/design/tech-tree-and-crew.md](../design/tech-tree-and-crew.md) 第 2 节做科技树:横轴是服役年份,每个国家占一条横带,上下滚动按国家对齐,国家里按类别分线,同车族叠成一组、点开展开。本卡做成**独立组件**:给它数据和回调就能显示,接入机库(打开 / 关闭、点车后分进编组)在以后的卡里做。

## 背景与参考

- 菜单的样式和写法:`src/ui/menu/MainMenu.ts`、`src/ui/menu/styles.ts`(只读参考;要加样式就在新文件里注入,或者在 `styles.ts` 末尾**追加**一段,不改已有规则)
- 载具类别、年份、车族字段由 028 加进 `VehicleSpec`;本卡**不依赖** 028,组件只吃下面的 `TechTreeEntry`

## 允许修改的文件

- 新增:`src/ui/menu/techTreeLayout.ts`(纯函数,算布局)
- 新增:`src/ui/menu/TechTree.ts`(DOM 组件)
- 修改:`src/ui/menu/styles.ts`(只允许在末尾追加科技树的样式)
- 新增:`tests/tech-tree-layout.test.ts`;可以加 `tests/tech-tree-ui.test.ts`(jsdom)
- 新增:`changelog.d/2026-10-02-031-tech-tree-ui.md`

## 接口(定死,不要改)

```ts
// techTreeLayout.ts
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
export const FAMILY_NAMES: Readonly<Record<string, string>>;
export const NATION_NAMES: Readonly<Record<string, string>>; // germany → '德国' 等
export const CLASS_NAMES: Readonly<Record<TechTreeEntry['vehicleClass'], string>>; // td → '坦克歼击车 / 突击炮' 等

export function techTreeLayout(entries: readonly TechTreeEntry[]): TechTreeLayout;

// TechTree.ts
export interface TechTreeOptions {
  entries: readonly TechTreeEntry[];
  /** 当前出战的载具,高亮 */
  currentId?: string;
  /** 已在当前编组里的载具,打一个小标记 */
  inLineup?: ReadonlySet<string>;
  onPick(vehicleId: string): void;
  onClose(): void;
}

export class TechTree {
  constructor(parent: HTMLElement, opts: TechTreeOptions);
  /** 滚到某个国家(按国家对齐) */
  showNation(nation: string): void;
  dispose(): void;
}
```

## 界面要求

- 全屏覆盖层,右上角关闭按钮,Esc 也能关(调用 `onClose`)。
- 顶部固定一行年份刻度;每个国家一条横带,高度占满可视区,左侧写国家名;上下滚动用 CSS `scroll-snap`,一次停在一个国家。
- 国家横带里每个类别一行,行首写类别名;车族组按 `column` 放在对应年份列。
- 只有一辆车的组直接显示那辆车;多辆车的组显示标题和「×N」,点一下展开成列表,再点收起。
- 点车调用 `onPick(id)`;`currentId` 的车高亮,`inLineup` 里的车有标记。
- 界面文字用简体中文,配色和机库菜单一致。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `tests/tech-tree-layout.test.ts`:年份轴去重排序、国家顺序和缺省、类别顺序且只含有车的、同车族成组且成员排序、`column` 正确、标题回退
- [x] (可选)jsdom 测试:点车触发 `onPick`、点组展开、Esc 触发 `onClose`
- [x] 不接入 `main.ts`、`MainMenu.ts`(主程在以后的卡里接)

## 不做

- 编组栏、车组、存档(030 和以后的卡)
- 接入机库

## 结果(完成后由执行者填写)

- 改动文件:
  - 新增: `src/ui/menu/techTreeLayout.ts`
  - 新增: `src/ui/menu/TechTree.ts`
  - 修改: `src/ui/menu/styles.ts` (末尾追加科技树样式与注入函数)
  - 新增: `tests/tech-tree-layout.test.ts`
  - 新增: `tests/tech-tree-ui.test.ts`
  - 新增: `changelog.d/2026-10-02-031-tech-tree-ui.md`
  - 修改: `docs/tasks/031-tech-tree-ui.md`
- 命令与结果:
  - `npm run lint`: 全部通过 (tsc --noEmit 无错误)
  - `npm test`: 全部通过 (38 个测试文件、379 个测试全部通过, 包含新增的 17 个测试)
  - `npm run build`: 全部通过 (tsc && vite build 正常产出 dist)
- 偏差 / 未完成 / 待决定: 无, 严格遵守任务卡定死接口与不做要求。
