# 051-ammo-slider:携弹面板用滑块自由设定数量

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/051-ammo-slider`
- 规模:S–M
- 和 047、048、049、050、052 并行;改的文件不重叠

## 目标

负责人 10-02:调整弹药时用滚动条(滑块)自由设定数量,不要只能每次加减固定的 5 发。参考 War Thunder 战备界面:每个弹种一张小卡片,上面是弹种名和数量,下面是一条带黄色填充的滑块,两侧有「−」「+」小按钮。

## 背景与参考

- `src/ui/menu/AmmoPanel.ts`:现在每行是弹种名 + 「−」「数量」「+」(每次 ±5)+ 底部合计条。`setVehicle(spec, loadout)`、`root`、`onChange(spec, loadout)` 是被 `MapScreen`(048 在重排)用的接口,**不能改**。
- 约束:总数不能超过弹药架容量 `ammoCapacity(spec)`,单个弹种不能为负;`clampLoadout`、`loadoutTotal` 在 `src/game/Loadout.ts`。
- 样式在 `styles.ts` 里 `.mm-ammo` 那一段;**只改那一段(新规则放在它紧后面),不要追加到文件末尾**,其他卡并行改 `styles.ts`。

## 要做的事

1. 每个弹种一张小卡片:弹种名(`a.name`)、类型缩写和穿深(沿用现在的说明行)、**数量**;下面一条 `<input type="range">`(`min=0`,`max` = 这个弹种当前最多能设的值 = `min(容量 − 其他弹种合计 + 本弹种当前值, 容量)`,`step=1`),滑块已填充部分用金色;两侧的「−」「+」每次 1 发,按住 Shift 点是 5 发。数量也可以直接在数字框里输入(`<input type="number">`,回车 / 失焦时生效,超出范围自动夹到范围内)。
2. 拖动滑块时**实时**更新数量和合计条,并调用 `onChange`(拖动过程中节流到每帧最多一次,松手时一定再调一次);不要在每次输入事件里重建整个 DOM(拖动中会丢失焦点)——只更新数字、合计条和各滑块的 `max`。
3. 其他弹种的滑块 `max` 要跟着变(这个弹种多带了,别的弹种能设的上限就少了)。
4. 抽出纯函数(导出,写单元测试):
   ```ts
   export function maxForShell(loadout: Loadout, shellId: string, capacity: number): number;
   export function setShellCount(spec: VehicleSpec, loadout: Loadout, shellId: string, count: number): Loadout; // 夹到 [0, maxForShell] 并取整,其他弹种不变
   ```
5. 已有测试里按「每次 ±5」写的断言(`tests/map-screen.test.ts` 等)需要改成新行为(±1,Shift ±5),在结果里逐条说明改了哪几条。

## 允许修改的文件

- 修改:`src/ui/menu/AmmoPanel.ts`、`src/ui/menu/styles.ts`(见上)
- 修改测试:`tests/` 下相关文件;新增 `tests/ammo-panel-slider.test.ts`
- 新增:`changelog.d/<日期>-051-ammo-slider.md`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 测试:`maxForShell` / `setShellCount`(容量边界、取整、其他弹种不变);滑块 `input` 事件更新数量、合计和 `onChange`;数字框输入越界被夹住;「−」「+」步长 1,Shift 点击步长 5;多带一种弹后其他滑块的 `max` 变小;拖动中滑块节点没有被替换
- [ ] 主程会在浏览器里拖滑块

## 不做

- `MapScreen`(048);机枪弹数量(仍不占弹药架,只显示);不加「按比例分配」之类的预设按钮。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
