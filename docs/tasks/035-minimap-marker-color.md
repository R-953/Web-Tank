# 035-minimap-marker-color:小地图标记颜色抽成纯函数并补测试(友军蓝色)

- 负责:GitHub Copilot CLI(主程审查)
- 状态:进行中
- 分支:`task/035-minimap-marker-color`
- 规模:S

## 目标

002 留下的待确认:友军用蓝色的那条代码路径没有测试覆盖(游戏里目前只有敌车)。颜色判断现在写在 `src/ui/Minimap.ts` 绘制循环里(约 279、297 行),jsdom 画不了 canvas,没法直接测。把它抽成纯函数,绘制改用这个函数,再给它写单元测试。行为不变。

## 允许修改的文件

- 修改:`src/ui/Minimap.ts`(只抽函数、改调用,不改别的)
- 修改:`tests/minimap.test.ts`(只**加**用例)
- 新增:`changelog.d/<日期>-035-minimap-marker-color.md`

## 接口(定死,不要改)

```ts
/** 小地图标记的填充色:被击毁 → 灰;敌军 → 红;友军 → 蓝。颜色值和现在的完全一样 */
export function markerColor(team: 'enemy' | 'ally', dead: boolean): string;
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `tests/minimap.test.ts` 新增:敌军红 `#ff3b30`、友军蓝 `#3aa0ff`、两方被击毁都是灰 `#5a5a5a`
- [x] 绘制效果不变(箭头样式里被击毁的车不画箭头这条逻辑不动)

## 不做

- 改颜色、改样式、加友军单位

## 结果(完成后由执行者填写)

- 改动文件:修改 `src/ui/Minimap.ts`、`tests/minimap.test.ts`、`docs/tasks/035-minimap-marker-color.md`;新增 `changelog.d/2026-10-01-035-minimap-marker-color.md`。
- 命令与结果:`npm run lint` 通过; `npm test` 首次运行因 Vitest worker 启动超时失败,重试通过(42 个测试文件、439 项); `npx vitest run` 通过(42 个测试文件、439 项); `npm run build` 通过。
- 偏差 / 未完成 / 待决定:无。箭头分支中被击毁车辆不绘制箭头的条件未改动。
