# 057-crew-screen:乘员界面

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/057-crew-screen`
- 规模:M
- 和 054–056、058–063 并行;改的文件不重叠

## 目标

右键菜单「乘员」打开的界面:查看这个车组的等级、成长、训练过的车族、开当前这辆车的技能,以及这辆车里每个乘员的岗位和座位(为之后细化内构的乘员站位做展示入口)。参考 War Thunder 右键菜单里的「Équipage」,但我们的车组系统比它简单。

## 背景与参考

- 车组存档:`src/settings/Profile.ts`(`CrewState = { progress, trained[] }`、`proficiency()`)。
- 等级和技能:`src/game/crew/progress.ts`(`crewLevel`、`applyCrewSkill`、`CREW_MAX_LEVEL`)、`src/game/crew/skill.ts`(`crewSkillFor(p, vehicles, nation, crewIndex, vehicleId)`)。
- 岗位名:`src/data/modules.ts` 的 `CREW_ROLE_NAMES`;内构乘员座位:`spec.internals.crew`(`role`、`part`、`center`)。
- 信息卡 `VehicleCard`(`src/ui/menu/VehicleCard.ts`)里已经按技能插值显示装填 / 转速,可以参考怎么算「新手 → 当前 → 王牌」。

## 要做的事

新增 `src/ui/menu/CrewScreen.ts`:全屏弹层,标题「乘员 · 车组 N」,×。内容(都是只读展示,不做修改操作):
1. **车组概况**:等级 `Lv N`(`crewLevel`)和一条成长进度条(进度 `progress`;文字显示「Lv N → Lv N+1」不必精确,没有现成函数就只显示进度百分比);「离线挂机成长:开 / 关」一行(由选项 `offlineGrowth()` 提供,关闭时写「关(在设置 → 游戏里打开)」)。
2. **当前车辆**:缩略图(`vehicleThumbnail`,没有时退回类型符号)、车名;熟练度(`proficiency` 为 1 显示「已训练」,否则「未训练」)和综合技能百分比(`crewSkillFor`)。
3. **技能表**:装填时间、方向机、高低机三行,每行显示「新手值 → 当前值 → 王牌值」(新手 = 车辆基础数据,王牌 = `spec.crewAce`,当前 = 按技能插值,车辆没有 `crewAce` 就只显示一列);用 `applyCrewSkill` 的结果算,不要重复实现插值。
4. **车内乘员**:列出 `spec.internals.crew` 每个乘员的岗位(中文名)和位置(车体 / 炮塔),再画一张**简单的俯视示意图**(内联 SVG:车体矩形 + 炮塔圆,乘员用带岗位缩写的小圆点按 `center` 的 x / z 摆放;比例按 `spec.hull` 尺寸)。
5. **训练过的车族**:列出该车组 `trained` 里的载具名(用选项给的 `vehicles` 查名字)。

```ts
export interface CrewScreenOptions {
  parent: HTMLElement;
  vehicles: readonly VehicleSpec[];
  getProfile(): Profile;
  offlineGrowth(): boolean;
  onClose?(): void;
  onUiSound?(): void;
}
export class CrewScreen { constructor(opts); open(nation: string, crewIndex: number): void; close(): void; get isOpen(): boolean; readonly root: HTMLElement; dispose(): void }
```
Esc / × / 点遮罩关闭;车组或车辆不存在时显示「该车组还没有分配载具」而不是报错。样式写在 `CrewScreen.ts` 里自己的 `<style>`,**不要改 `styles.ts`**。

测试(jsdom):各区块渲染;`offlineGrowth` 开 / 关的两种文案;没有 `crewAce` 的车只显示一列;没分车的车组不报错;俯视示意图里点的数量等于乘员数;Esc / × 关闭。

## 允许修改的文件

- 新增:`src/ui/menu/CrewScreen.ts`、`tests/crew-screen.test.ts`、`changelog.d/<日期>-057-crew-screen.md`

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 上面的测试都有
- [ ] 主程会在浏览器里看布局

## 不做

- 右键菜单(053)和 `main.ts` 接线(主程做);修改乘员技能、招募 / 解雇、给乘员起名字;不改 `Profile.ts`。

## 结果(完成后由执行者填写)

- 改动文件:
  - 新增: `src/ui/menu/CrewScreen.ts`
  - 新增: `tests/crew-screen.test.ts`
  - 新增: `changelog.d/2026-10-02-057-crew-screen.md`
  - 修改: `docs/tasks/057-crew-screen.md`
- 命令与结果:
  - `npm run lint`: 通过 (0 errors)
  - `npm test`: 通过 (61 test files, 615 tests 全部通过，新增测试 12 个全部通过)
  - `npm run build`: 通过 (生产构建成功)
- 偏差 / 未完成 / 待决定: 无

