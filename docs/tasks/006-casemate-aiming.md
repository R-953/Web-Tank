# 006-casemate-aiming:固定战斗室(无炮塔)车辆的瞄准逻辑

- 负责:Claude Code(主程)
- 状态:已合并
- 分支:`task/006-casemate-aiming`
- 规模:M

## 目标

支持突击炮、坦克歼击车这类「战斗室不转、火炮只能在左右小角度内转动」的车辆:

- 火炮在射界内跟随准星,超出射界就停在边上;
- 瞄准点超出射界、而玩家没有按左右转向键时,车体自动转向把火炮带过去(War Thunder 鼠标瞄准的做法);按了转向键就以玩家为准;
- 敌方 AI 驾驶这类车时,目标在射界外就停车原地转向;
- 伤害判定、HUD 车辆状态图、击杀回放、机库展示都按「战斗室不动、火炮转」处理。

## 背景与参考

- `src/game/Vehicle.ts`:`aimTurret()`、`drive()`、`muzzle()` / `mgMuzzle()` / `boresight()`、`updateBarrelCollider()`、`syncVisual()`、`partQuaternion()`
- `src/game/damage/geometry.ts`:`VehicleFrames`(车体 / 炮塔 / 火炮三个坐标系)
- `src/game/Controllers.ts`:`GunnerAI`
- 显示:`src/ui/hud/VehicleStatus.ts`、`src/ui/KillCam.ts`、`src/ui/menu/Hangar.ts`、`src/ui/menu/MainMenu.ts`

## 接口 / 数据约定

- `TurretSpec` 加**可选**字段 `traverse?: readonly [left: number, right: number]`:火炮左右射界,度,都填正数。设了这个字段就表示没有炮塔,「炮塔」盒子是固定的战斗室,只有火炮在射界内转;不设 = 现有的 360° 炮塔。已有车辆不受影响。
- `turretRotationSpeed` 对固定战斗室车辆表示火炮方向机的速度。
- `Vehicle.turretYaw` 的含义不变:火炮相对车体的水平角(正值向左)。只是对固定战斗室车辆,这个角加在火炮节点上,不加在炮塔节点上。
- 纯函数放在新文件 `src/game/casemate.ts`:射界换算、夹角、自动转向量,方便单元测试。

## 允许修改的文件

- `src/data/types.ts`(只加上面的可选字段)
- 新增 `src/game/casemate.ts`
- `src/game/Vehicle.ts`、`src/game/damage/geometry.ts`、`src/game/Controllers.ts`、`src/game/models/index.ts`(只加姿态辅助函数)
- `src/ui/hud/VehicleStatus.ts`、`src/ui/KillCam.ts`、`src/ui/menu/Hangar.ts`、`src/ui/menu/MainMenu.ts`
- 新增 `tests/casemate.test.ts`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过,已有测试不改
- [ ] 单元测试:射界夹角;自动转向的方向和大小;固定战斗室的坐标系里「炮塔」不随火炮转、火炮随水平角转
- [ ] 整局测试:固定战斗室车辆的瞄准点在正侧面时,车体自动转过去,最后炮管对准目标;瞄准点在射界内时车体不动
- [ ] 已有三辆车的行为不变

## 不做

- 不做新车的专属三维模型(先用通用模型);不做自由视角键。

## 结果(完成后填写)

- 改动文件:
  - 新增 `src/game/casemate.ts`(`isCasemate` / `yawLimits` / `clampYaw` / `autoSteer`)、`tests/casemate.test.ts`(10 个)
  - `src/data/types.ts`:`TurretSpec.traverse?` 可选字段
  - `src/game/Vehicle.ts`:
    - 火炮水平角夹进射界,自动转向用 `steerInput()`,新增公开方法 `canTraverseTo()`
    - 战斗室碰撞盒不转;炮口、机枪、炮管命中框改用「炮塔坐标系转角」+「火炮转角」两个辅助函数
    - 固定战斗室的瞄准角以炮耳轴为准(近距离不偏)
  - `src/game/damage/geometry.ts`:`VehicleFrames` 对固定战斗室把水平角加在火炮坐标系
  - `src/game/models/index.ts`:`applyGunPose()`,游戏、击杀回放、机库共用
  - `src/game/Controllers.ts`:`GunnerAI` 目标在射界外时停车
  - `src/ui/hud/VehicleStatus.ts`、`src/ui/KillCam.ts`、`src/ui/menu/Hangar.ts`、`src/ui/menu/MainMenu.ts`:显示同步;机库信息栏对固定战斗室显示「射界」「方向机」「战斗室装甲」
- 设计要点:
  - 火炮最终朝向对两种车都是「车体 × 水平角 × 俯仰」,只是水平角加在哪个节点不同。所以弹道、表尺、AI 对准、瞄准镜位置的代码都不用改
  - 自动转向量和超出射界的角度成正比,超出 6° 打满,避免来回摆;目标进射界后车体停住,不回正
- 命令与结果:`npm run lint` 通过;`npm test` 21 个文件 220 个测试全部通过(原 210 + 新 10,已有测试没改);`npm run build` 通过
- 实机验证:在任务 007 的 StuG III G 上做了,见 007 的结果
- 偏差 / 待决定:
  - 巡逻中的固定战斗室 AI 转向交战后,巡逻控制器不会把车头转回巡逻线。目前没有这样的车,以后有了再改 `PatrolController`
  - 没做自由视角键:固定战斗室车回头看时车体会跟着转(War Thunder 用单独的键解决)