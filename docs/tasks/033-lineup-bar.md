# 033-lineup-bar:机库底部的编组栏,接上科技树

- 负责:Antigravity(3.8 Flash High)
- 状态:进行中
- 分支:`task/033-lineup-bar`
- 规模:M

## 目标

按设计稿 [docs/design/tech-tree-and-crew.md](../design/tech-tree-and-crew.md) 第 2.1 节,把机库底部的「载具栏」换成「编组栏」:显示当前国家的车组格子(空格留白),能切换国家和编组、新建 / 改名 / 删除编组、招募车组,点格子选出战车组,从科技树给车组分车。`main.ts` 的接线由主程做,本卡只做界面组件和 `MainMenu` 里的切换。

## 背景与参考(只读)

- 存档与规则:`src/settings/Profile.ts`(030)——所有改动都通过它的函数完成,规则报错(例如「编组不能为空」)要显示给玩家
- 车组等级:`src/game/crew/progress.ts` 的 `crewLevel`(029)
- 科技树组件:`src/ui/menu/TechTree.ts`(031)
- 载具的国家 / 类别 / 年份 / 车族:`VehicleSpec` 的可选字段(028)
- 现有载具栏:`src/ui/menu/MainMenu.ts` 的 `renderSlots`、样式 `.mm-slot`

## 允许修改的文件

- 新增:`src/ui/menu/LineupBar.ts`
- 修改:`src/ui/menu/MainMenu.ts`(加可选项、在有存档时用编组栏和科技树;没传时保持现状)
- 修改:`src/ui/menu/styles.ts`(只允许在末尾追加编组栏的样式)
- 新增:`tests/lineup-bar.test.ts`(jsdom)
- 新增:`changelog.d/<日期>-033-lineup-bar.md`

## 接口(定死,不要改)

```ts
// LineupBar.ts
import type { VehicleSpec } from '../../data/types';
import type { Profile } from '../../settings/Profile';

export interface LineupBarOptions {
  vehicles: readonly VehicleSpec[];
  getProfile(): Profile;
  /** 存档改了:调用方负责保存(ProfileStore.set) */
  setProfile(p: Profile): void;
  /** 出战载具变了(选了别的车组、换了编组或国家、分车改了当前格子) */
  onActiveVehicle(vehicleId: string): void;
  /** 玩家要给某个车组分车:调用方打开科技树,选好后调 assign */
  onPickVehicle(nation: string, crewIndex: number): void;
  onUiSound?(): void;
}

export class LineupBar {
  constructor(parent: HTMLElement, opts: LineupBarOptions);
  /** 存档在外面被改了(例如科技树分完车)时重画 */
  refresh(): void;
  dispose(): void;
}

// MainMenu.ts:MainMenuOptions 新增可选项
/** 有这个就用编组栏 + 科技树取代旧的载具栏;没有就保持旧行为 */
profile?: {
  get(): Profile;
  set(p: Profile): void;
};
```

## 界面要求

- **第一行**:国家页签(德国 / 苏联 / 美国,用 031 的 `NATION_NAMES`)· 编组下拉(切换)· 「新建」「改名」「删除」· 「招募车组 n/8」(到上限置灰)。改名用页面内的输入框,不要用 `prompt()`。
- **第二行**:当前编组的车组格子,数量 = 该国车组数。
  - 有车的格子:载具名、剪影(沿用 `silhouette`)、车组等级「Lv 23」;当前出战的格子高亮。点格子 = 选这个车组出战。格子上有「换车」和「×」(清空)两个小按钮。
  - 空格子:留白,中间一个「+」,点了 = 给这个车组分车。
- 分车:`MainMenu` 收到 `onPickVehicle` 后打开科技树(`TechTree`,entries 只放当前国家的车,`inLineup` 标出当前编组里已有的车),点车 → `assignVehicle` → `profile.set` → 关闭科技树 → `LineupBar.refresh()`。
- 规则报错(`assignVehicle` 等抛出的 Error)用一行提示显示几秒,不要 `alert()`。
- 出战载具变化时,`MainMenu` 走现有的 `select(spec)` 流程(更新左侧信息、携弹、机库模型)。

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] `tests/lineup-bar.test.ts`(jsdom,存档用 030 的函数造):格子数 = 车组数、空格显示「+」、点格子触发 `onActiveVehicle`、点「+」触发 `onPickVehicle`、「×」清空最后一辆车时显示报错且存档不变、招募到 8 个后按钮置灰、切换国家 / 编组
- [ ] 不传 `profile` 时 `MainMenu` 行为和原来一样(现有测试不改也能过)
- [ ] 不改 `main.ts`

## 不做

- `main.ts` 接线、离线补算、开局按车组等级改数值(主程做)
- 车组详情页、技能点

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
