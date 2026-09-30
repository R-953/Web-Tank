# 007-casemate-vehicles:两辆代表性的固定战斗室车辆(数据)

- 负责:Claude Code(主程)
- 状态:待领取(006 之后)
- 分支:`task/007-casemate-vehicles`
- 规模:M

## 目标

加两辆固定战斗室车辆,用来实际检验 006 的瞄准逻辑:

- **德国 StuG III Ausf. G**:75 mm StuK 40 L/48,低矮、射界小,代表突击炮;
- **苏联 SU-100**:100 mm D-10S,代表中型坦克底盘的坦克歼击车。

两辆都是「只做后期型」规矩下的代表型号。先用通用模型,专属三维模型以后另开任务。

## 要求

- 数值来源按 AGENTS.md:公开资料 → War Thunder 官方 wiki(注明「War Thunder 值」)→ 新数据才估算并写方法
- 字段对齐 `VehicleSpec`,射界填 `turret.traverse`
- 出处写进 `docs/physics-validation.md` 新的一节

## 允许修改的文件

- `src/data/vehicles.ts`(新增两辆车并加入 `VEHICLES`)
- `docs/physics-validation.md`
- 测试:`tests/` 下新增或补充

## 验收标准

- [ ] 机库能选这两辆车并进入战斗,射界、方向机、火炮数据按出处
- [ ] 整局测试:两辆车各自能自动转车体对准正侧面的目标并击穿虎王侧面
- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过

## 结果(完成后填写)
