# 008-freelook-reverse-steer:C 键自由视角;倒车时转向按汽车习惯

- 负责:Claude Code(主程)
- 状态:已合并
- 分支:`task/008-freelook-reverse-steer`
- 规模:S

## 目标(负责人 2026-09-29 提出)

1. **自由视角**:按住 C 时视角随意转,火炮(固定战斗室车是车体)继续对准按下时的位置;松开后视角回到原来的方向。开镜时不可用。
2. **倒车转向**:按 S + D 应该向右后方倒车,车头转向 −X(左)。以前倒车时车头仍按前进的方向转,和汽车、履带车的实际运动学相反。

## 做法

- 倒车转向:`Vehicle.steerInput()` 里只把**手动**转向键在倒车时反过来。倒车的判定:向后速度 > 0.5 m/s,或者速度在 ±0.5 m/s 以内且正在踩倒车。固定战斗室的自动转向表示的是「车头该往哪边转」,倒车时不反。
- 自由视角:新增操作 `freeLook`(默认 C),新增 `src/engine/FreeLook.ts` 负责记住 / 恢复视角。按住期间 main.ts 不再用相机射线更新瞄准点。

## 数据结构

- `ActionId` / `Bindings` 加了一个操作 `freeLook`。旧存档由 `sanitize()` 自动补上默认键位,不受影响。
- `VehicleControls.steer` 的语义在注释里写明:倒车时按汽车习惯反过来。

## 允许修改的文件

- `src/game/Vehicle.ts`、`src/data/controls.ts`、`src/main.ts`(瞄准点与操作提示两处)
- 新增 `src/engine/FreeLook.ts`、`tests/steering.test.ts`

## 验收标准

- [x] 前进 W + D 向右前方;原地 D 右转(不变);倒车 S + D 向右后方、车头向 −X;倒车 S + A 向左后方
- [x] 固定战斗室倒车时自动转向方向正确
- [x] 自由视角按下记住、松开恢复;默认 C 键不和其他操作冲突
- [x] `npm run lint`、`npm test`、`npm run build` 全部通过

## 结果

- 改动文件:`src/game/Vehicle.ts`、`src/data/controls.ts`、`src/main.ts`;新增 `src/engine/FreeLook.ts`、`tests/steering.test.ts`(8 个)
- 命令与结果:`npm run lint` 通过;`npm test` 23 个文件 234 个测试全部通过;`npm run build` 通过
- 两个倒车测试放在旧代码上会失败(旧代码 S + D 让车头右转),确实能抓住这个问题
- 待负责人实机确认:内置浏览器拿不到鼠标锁定,自由视角的手感需要真人试。另外 War Thunder 键位导入没有加自由视角的映射,因为没查到 WT 里对应的操作 id
