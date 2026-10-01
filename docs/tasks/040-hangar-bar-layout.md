# 040-hangar-bar-layout:机库底部按 War Thunder 的布局重排

- 负责:Antigravity(3.8 Flash High)
- 状态:已完成
- 分支:`task/040-hangar-bar-layout`
- 规模:M

## 目标

负责人 10-02 给了 War Thunder 机库正下方的截图作参考,要求照它的布局改 033 做的编组栏。只学布局和交互,不照搬 WT 的美术素材(图标、底图、字体)。

## 参考布局(从上到下)

1. **科技树把手**:编组栏左上方一个小页签「︽ 科技树」(WT 是「Recherche」),点了打开当前国家的科技树。
2. **国旗页签行**:德国、苏联、美国三个国旗小图(约 28 × 18 px),当前国家下面有高亮线。国旗用代码画的简化 SVG:
   - 美国:红白条纹 + 左上蓝底白星(简化,不必画全 48 颗星)
   - 苏联:红底 + 左上角黄色锤子镰刀和五角星(简化)
   - 德国:**用国防军的铁十字(Balkenkreuz)**,白底黑十字;不用任何纳粹旗帜
3. **车组卡片行**(每个车组一张卡,横排):
   - 卡片主体:左边载具剪影(沿用 `silhouette`),右上载具名,右下「类型符号 + Lv N」(类型符号用 `classIcon`)
   - 卡片下方一条窄底栏:左边「👤 N」(车组编号,从 1 起),右边留空(以后放车组技能点)
   - 当前出战的卡片白色描边高亮;空车组是空白卡片,中间一个淡色「+」
   - 行末一张「招募车组」卡片:车组人像位置放一个简单的人形图标,文字「招募车组 n/8」,到上限时置灰
4. **编组页签行**(WT 叫「Préréglages」):最左一个 ⚙ 按钮,点开小菜单:新建编组 / 改名 / 删除;后面横排各个编组的名字,点名字切换,当前编组高亮。原来的编组下拉框、新建 / 改名 / 删除按钮去掉。

## 交互

- 左键点卡片:选这个车组出战(和现在一样)。
- 右键点卡片(或卡片右上角一个小 ▾):弹出菜单——更换载具 / 清空 / 载具信息。空卡片左键 = 更换载具。
  - 「载具信息」先调用新加的回调 `onShowInfo`,具体卡片由 041 做、主程接线。
- 鼠标移到有车的卡片上:调用新加的回调 `onHoverVehicle(vehicleId, rect)`,移开时 `onHoverVehicle(null, null)`(给 041 的悬停信息卡用)。
- 改名仍用页面内输入框;规则报错仍用一行提示。

## 允许修改的文件

- 修改:`src/ui/menu/LineupBar.ts`、`src/ui/menu/MainMenu.ts`(只改编组栏和科技树打开方式相关的部分;**右侧携弹面板不要动**,042 会把它挪走)
- 新增:`src/ui/menu/flags.ts`(国旗 SVG)
- 修改:`src/ui/menu/styles.ts`(编组栏相关样式可以改;其他不动)
- 修改:`tests/lineup-bar.test.ts`(布局变了,原来按按钮文字找元素的用例可以跟着改,但覆盖的行为不能少)
- 新增:`changelog.d/<日期>-040-hangar-bar-layout.md`

## 接口(定死,不要改)

```ts
// LineupBarOptions 新增(都可选)
/** 鼠标移到有车的卡片上 / 移开 */
onHoverVehicle?(vehicleId: string | null, rect: DOMRect | null): void;
/** 右键菜单里点了「载具信息」 */
onShowInfo?(vehicleId: string, rect: DOMRect): void;
/** 点了「科技树」把手 */
onOpenTechTree?(nation: string): void;

// flags.ts
export function nationFlag(nation: string, width?: number): string; // 内联 SVG;未知国家返回空字符串
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `tests/lineup-bar.test.ts` 覆盖:国旗页签切换国家、卡片数 = 车组数、空卡片「+」、招募卡片到 8 个置灰、编组页签切换、⚙ 菜单新建 / 改名 / 删除、右键菜单三项、悬停回调、科技树把手回调
- [x] 1280 × 720 下编组栏不超出屏幕宽度;8 个车组时卡片自动缩窄或可横向滚动
- [x] 不改 `main.ts`

## 不做

- 悬停信息卡本身(041)、携弹面板挪位(042)、军标符号(039)
- WT 截图里卡片上方的备用车数、银狮价格、战斗权重(本游戏没有这些机制)

## 结果(完成后由执行者填写)

- 改动文件:
  - 新增: `src/ui/menu/flags.ts`
  - 修改: `src/ui/menu/LineupBar.ts`
  - 修改: `src/ui/menu/MainMenu.ts`
  - 修改: `src/ui/menu/styles.ts`
  - 修改: `tests/lineup-bar.test.ts`
  - 新增: `changelog.d/2026-10-02-040-hangar-bar-layout.md`
  - 修改: `docs/tasks/040-hangar-bar-layout.md`
- 命令与结果:
  - `npm run lint`: 通过 (0 错误)
  - `npm test`: 全部通过 (45 test files, 469 tests)
  - `npm run build`: 全部通过 (dist 构建成功)
- 偏差 / 未完成 / 待决定:
  - 无。严格按任务卡与接口定义完成全部功能和测试用例, 未修改 main.ts 或 package.json。
