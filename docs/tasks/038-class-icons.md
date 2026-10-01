# 038-class-icons:载具类型图标(轻型 / 中型 / 重型 / 坦克歼击车)

- 负责:Antigravity(3.8 Flash High)
- 状态:进行中
- 分支:`task/038-class-icons`(从 `task/037-crew-wiring` 拉出,需在 033、034、037 之后合并)
- 规模:S

## 目标

负责人 10-02 提出:现在已经有中型、重型、坦克歼击车等不同类型,要加类型图标,一眼区分。在科技树、编组栏、机库左侧载具信息三处显示。

## 允许修改的文件

- 新增:`src/ui/menu/classIcons.ts`
- 修改:`src/ui/menu/TechTree.ts`(车辆卡片、车族组标题、类别行首加图标)
- 修改:`src/ui/menu/LineupBar.ts`(车组格子里载具名前加图标)
- 修改:`src/ui/menu/MainMenu.ts`(左侧信息面板的载具名前加图标;旧载具栏 `renderSlots` 也加)
- 修改:`src/ui/menu/styles.ts`(只允许在末尾追加图标样式)
- 新增:`tests/class-icons.test.ts`
- 新增:`changelog.d/<日期>-038-class-icons.md`

## 接口(定死,不要改)

```ts
import type { VehicleClass } from '../../data/types';
/**
 * 类型图标的内联 SVG 字符串。颜色用 currentColor(跟随文字颜色),带 role="img" 和 aria-label(中文类别名,取 CLASS_NAMES)。
 * size:像素边长,缺省 14。
 */
export function classIcon(vehicleClass: VehicleClass, size?: number): string;
```

## 图标样式

参考 War Thunder 用简单几何形状区分类型的思路,**自己画,不照搬** WT 的图标:

| 类型 | 形状 |
|---|---|
| light 轻型坦克 | 空心菱形(只描边) |
| medium 中型坦克 | 实心菱形 |
| heavy 重型坦克 | 实心菱形 + 外面再套一圈菱形描边 |
| td 坦克歼击车 / 突击炮 | 实心倒三角 |

- 四种在 14 px 下要能一眼分开;用 `viewBox="0 0 16 16"`,线宽统一。
- 没有 `vehicleClass` 的载具不显示图标(不报错)。

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] `tests/class-icons.test.ts`:四种类型生成的 SVG 互不相同;都含 `currentColor`、`role="img"`、正确的中文 `aria-label`;`size` 参数生效
- [ ] jsdom 里:科技树车辆卡片、编组栏格子、机库信息面板都能找到对应类型的图标(按 `aria-label` 查)
- [ ] 不改 `main.ts`

## 不做

- 小地图标记用类型图标(以后看负责人要不要)
- 国旗、等级徽章等其他图标

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
