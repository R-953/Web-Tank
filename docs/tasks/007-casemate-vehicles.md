# 007-casemate-vehicles:两辆代表性的固定战斗室车辆(数据)

- 负责:Claude Code(主程)
- 状态:已合并
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

- 改动文件:
  - `src/data/vehicles.ts`:新增 `STUG_III_G`、`SU_100`,加入 `VEHICLES`
  - `docs/physics-validation.md`:新增第 9 节(数据、出处、估算项、实测)
  - 新增 `tests/casemate-vehicles.test.ts`(6 个):两辆车自动转向对准正侧面目标;Pzgr.39 / Pzgr.40 / BR-412 穿深曲线对照资料(3% 容差);500 m 都能打穿虎王侧面
  - `tests/data.test.ts`:这两辆车是史实 4 人车组,按车列出了期望岗位;载弹量期望表加上 54 / 33 发。其余车仍要求 5 人齐全,没有放宽
- 数据来源:
  - 尺寸、重量、发动机、弹药按 Wikipedia
  - 射界、方向机、高低机、俯仰、装填、瞄准镜倍率按 War Thunder 值(历史满改、新手乘员)
  - 穿深按公开表反推炮口值,并拟合阻力系数
  - BR-412 和 OF-412 的装药量没查到,按同类弹的装药比例估算
  - 车体盒、战斗室盒、内构坐标都是估算,方法写在第 9.2 节
- 命令与结果:`npm run lint` 通过;`npm test` 22 个文件 226 个测试全部通过;`npm run build` 通过
- 实机验证(本分支 dev server,桌面版内置浏览器):
  - 机库:底部车辆栏出现两辆车;信息栏显示「战斗室装甲」「射界 左 10° / 右 10°」「方向机 10.5°/s」、乘员 4 人;两辆车用通用模型,方块就是战斗室
  - 河谷试验场:StuG III G 瞄准正左 400 m,`?debug` 快进后,2 s 转过 39°,4 s 转过 78°,最后车头 80.4°、火炮 10°,炮管误差 0.32°
  - 内置浏览器拿不到鼠标锁定,窗口又被隐藏,没法用鼠标实际驾驶;这部分要负责人在浏览器里试玩确认
- 偏差 / 待决定:
  - 没有专属三维模型,先用通用模型
  - StuG III G 没有同轴机枪(史实如此),HUD 的机枪栏不显示
  - War Thunder 的穿深(游戏公式)比公开表高,没有采用