# 045-hangar-info-card-hooks:机库去掉携弹面板,信息卡挂到编组栏和科技树

- 负责:Antigravity(3.8 Flash High)
- 状态:已合并
- 分支:`task/045-hangar-info-card-hooks`
- 规模:M
- 和 044 并行,改的文件不重叠;两张都合并后主程做 046(main.ts 接线)

## 目标

第九轮第二波。负责人 10-02 的要求:鼠标放在哪辆车上就显示一张可双击关闭的信息卡(041 的 `VehicleCard`);携弹调整挪进地图界面(042),机库右侧不再放携弹面板。

## 要做的事

1. **车组技能纯函数**(`src/game/crew/skill.ts`)
   - 新增 `crewSkillFor(p: Profile, vehicles: readonly ProfileVehicle[], nation: string, crewIndex: number, vehicleId: string): number`:返回该国第 `crewIndex` 个车组开这辆车的技能 = `progress × proficiency(crew, vehicleId, vehicles)`,夹在 [0, 1];车组不存在时返回 0。写单元测试(同车族保留熟练度、换车族要训练的情况各一例)。
2. **科技树悬停**(`src/ui/menu/TechTree.ts`)
   - `TechTreeOptions` 加可选回调 `onHoverVehicle?(vehicleId: string | null, rect: DOMRect | null): void`:鼠标移到载具卡片上 / 移开时调用(和 040 的 `LineupBar.onHoverVehicle` 一样)。
3. **机库**(`src/ui/menu/MainMenu.ts`)
   - 去掉右侧携弹面板(`AmmoPanel` 不再在机库里创建)。`selection().loadout` 仍然由 `loadLoadout` 提供,行为不变。左侧载具信息面板保留。
   - MainMenu 自己持有一个 `VehicleCard`:
     - 编组栏的 `onHoverVehicle`:有车 → `show(spec, crewSkillFor(当前国家, 该车组, 该车), rect)`;移开 → `hideSoon()`。
     - 编组栏的 `onShowInfo`(右键菜单「载具信息」):同样 `show`。
     - 科技树的 `onHoverVehicle`:`show(spec, crewSkillFor(当前国家, 当前编组选中的车组, 该车), rect)`,即「把这辆车分给当前车组会是什么水平」;移开 → `hideSoon()`。
     - 打开 / 关闭科技树、隐藏主界面时卡片也隐藏;`dispose` 时一起销毁。
   - 「载具栏 / 编组栏」区域的布局如果因为右侧面板去掉而需要调整,只改 `styles.ts` 末尾追加的样式。

## 允许修改的文件

- 修改:`src/game/crew/skill.ts`、`src/ui/menu/TechTree.ts`、`src/ui/menu/MainMenu.ts`、`src/ui/menu/styles.ts`(只在末尾追加)
- 修改测试:`tests/` 下相关文件(只增不删;机库里不再有携弹面板,原来断言携弹面板存在的测试可以改成断言不存在,在结果里说明)
- 新增:`tests/crew-skill-for.test.ts`、`changelog.d/<日期>-045-hangar-info-card-hooks.md`

## 接口(定死)

```ts
// game/crew/skill.ts
export function crewSkillFor(p: Profile, vehicles: readonly ProfileVehicle[], nation: string, crewIndex: number, vehicleId: string): number;

// menu/TechTree.ts
interface TechTreeOptions { ...; onHoverVehicle?(vehicleId: string | null, rect: DOMRect | null): void }
```

MainMenu 的构造参数不变(main.ts 不用改就能编译通过)。

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `crewSkillFor` 的单元测试
- [x] 测试(jsdom):机库里没有携弹面板;编组栏卡片 `mouseenter` 后信息卡可见、`dblclick` 后隐藏;科技树卡片悬停回调被调用
- [x] 主程会在浏览器里看:悬停显示、移到卡片上不消失、双击关闭

## 不做

- main.ts 的接线(046)、地图界面和小地图(044)

## 结果(完成后由执行者填写)

- 改动文件:
  - `src/game/crew/skill.ts`
  - `src/ui/menu/TechTree.ts`
  - `src/ui/menu/MainMenu.ts`
  - `tests/crew-skill-for.test.ts` (新增)
  - `tests/tech-tree-ui.test.ts`
  - `tests/lineup-bar.test.ts`
  - `changelog.d/2026-10-02-045-hangar-info-card-hooks.md` (新增)
  - `docs/tasks/045-hangar-info-card-hooks.md`
- 命令与结果:
  - `npm run lint`: 通过 (0 错误)
  - `npm test`: 50 test files passed, 521 tests passed (全部通过)
  - `npm run build`: 通过 (tsc && vite build 构建成功)
- 偏差 / 未完成 / 待决定: 无

### 主程审查(Claude Code)

- 代码、测试、浏览器里都看过:悬停显示、移到卡片上不消失、双击关闭、移开 150 ms 后隐藏、科技树悬停都正常。
- 修了一处:科技树悬停算技能时没跟 `onPick` 一样用 `crewIndex ?? selected`,从空车位的「+」进科技树会按选中车组算错;改后补了测试(撤掉修复时该测试失败)。
- `MainMenu` 的 `saveLoadout` 选项现在没人用了,留给 046 一起清理。
