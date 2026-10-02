# HUD 底部状态提示与圆环进度设计

本文档说明 068 任务中引入的 HUD 底部状态提示改版、圆环进度组件 (`ProgressRing`) 的数据来源及将来占点补给模式的接入设计。

---

## 1. 背景与设计目标

参照 War Thunder 的战斗界面规范:
- 精简战斗中的文字提示: 屏幕正下方按钮栏上方仅保留己方模块损毁与乘员损伤状态。
- 右上角命中记录 (feed) 移除所有详细击中判定文字 (统一由击中/击杀回放呈现)。
- 乘员顶替与维修等具有持续时间的过程, 使用直观的**圆环进度条**替代原有的文字倒计时。

---

## 2. 底部状态提示体系 (`hudStatus.ts`)

状态提示位于底部按钮栏上方 (`.hud-msgs`), 最多同时展示 3 条, 按严重程度与优先级排序:

### 2.1 状态型提示 (持续成立则持续显示)

| 优先级 | 触发条件 | 文案与色调 |
|---|---|---|
| 1 | 起火中 | 红色「起火!」<br>正在灭火时改为黄色「正在灭火 3.2s」<br>灭火器耗尽且无存活乘员时为红色「起火!没有灭火器了」 |
| 2 | 发动机 hp ≤ 0 | 红色「发动机受损,无法移动」 |
| 3 | 变速箱 hp ≤ 0 | 红色「传动装置受损,无法移动」 |
| 4 | 发动机/变速箱 0 < hp < maxHp | 黄色「发动机受损」/「传动装置受损」 |
| 5 | 炮闩 hp ≤ 0 | 红色「炮闩损坏,无法开火」 |
| 6 | 炮管 hp ≤ 0 | 红色「炮管损坏,无法开火」 |
| 7 | 履带断裂 (任意履带 hp ≤ 0) | 红色「履带断裂」 |
| 8 | 乘员岗位无人 (阵亡且未在顶替) | 红色「{岗位名}昏迷,无法{功能}」<br>特例: 车长昏迷固定为「车长昏迷,无法使用超越控制」 |

### 2.2 瞬时提示 (停留 3.5 秒后自动消失)

由 `MessageQueue` 维护, 显示在状态型提示的下方:
- **己方被穿透**:
  - 受伤但未阵亡乘员: 黄色「{岗位名}受伤」
  - 受损但未报废模块: 黄色「{模块名}受损」
  - 报废且不在上表的模块: 红色「{模块名}损坏」(如油箱、方向机、高低机)
  - 同一发命中重复项目自动去重。
- **击发失败 (`misfire`)**: 红色「炮闩受损,击发失败」或「炮管受损,击发失败」。
- **弹药架损坏未殉爆 (`ammo-lost`)**: 黄色「弹药架受损,损失 N 发」。

---

## 3. 圆环进度组件 (`ProgressRing`) 与三种数据来源

组件位于 `.hud-rings`, 直径约 44px, 采用 SVG `stroke-dasharray` 动态控制进度偏移, 中间绘制单色线条风格的矢量图标, 多个过程同时存在时横向并排。

### 3.1 乘员顶替 (Crew Swap)
- **数据来源**: `DamageModel.crew[i].swap = { to: CrewRole, remaining: number }`
- **进度计算**:
  $$\text{progress} = 1 - \frac{\text{swap.remaining}}{\text{CREW.swapTime}}$$
  其中 `CREW.swapTime = 5.0` 秒 (`src/data/modules.ts`)。
- **中间图标**:
  - 驾驶员 (`driver`): 方向盘
  - 炮手 (`gunner`): 瞄准十字线圆环
  - 装填手 (`loader`): 炮弹轮廓
  - 车长 (`commander`): 双筒望远镜
  - 机电员 (`radio`): 电台天线与波纹
- **互斥规则**: 当某岗位正在被顶替 (`swap.to === role`) 时, 状态提示中隐藏对应的「xx昏迷」文本, 仅展示此圆环进度。
- **文本说明**: 无 label。

### 3.2 维修 (Repair)
- **数据来源**: `DamageModel.repair = { remaining: number, total: number }` 以及 `DamageModel.repairRate`
- **进度计算**:
  $$\text{progress} = 1 - \frac{\text{repair.remaining}}{\text{repair.total}}$$
- **剩余时间**:
  $$\text{seconds} = \left\lceil \frac{\text{repair.remaining}}{\text{repairRate}} \right\rceil$$
- **中间图标**: 扳手 (`repair`)。
- **下方文字**: `正在修理,剩余:${seconds}秒`。

### 3.3 补给 (Resupply - 占点模式用)
- **支持状态**: `ProgressRing` 组件原生支持 `'ammo'` 图标与 `tone` 色调选择, `label` 可省略。`Hud` 类暴露了公开方法 `setResupply(progress: number | null)`。

#### 将来占点补给模式接入方案:
1. **触发时机与区域判定**:
   - 地图系统在占领点 (Capture Zone) 或补给站 (Resupply Point) 设定圆形/多边形触发区域。
   - 当玩家车辆处于己方占领点内部、速度低于静止判定阈值 (例如 $|v| < 1.0 \text{ km/h}$) 且车内弹药不满时, 开始补给计时。
2. **状态推进与数据回传**:
   - `Game` 或 `Vehicle` 中的补给逻辑每一帧推进单发弹药装填倒计时:
     $$\text{progress} = 1 - \frac{t_{\text{remaining}}}{t_{\text{roundSupplyTime}}}$$
   - 每完成一发补充, 弹药架数量增加, 并开启下一发的装填循环。
   - 游戏循环每固定步调用 `hud.setResupply(progress)` 驱动补给圆环。
3. **离开与结束**:
   - 当玩家驶离占领点、起步移动或车内所有弹药架全部装满时, 调用 `hud.setResupply(null)`。
   - HUD 自动隐藏补给圆环并收起展示容器。

## 官方用语对照

以下战斗中己方损伤提示对应 War Thunder 公开语言文件 [`menu.csv`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) 中的词条:

| 键 | English | 简体 | 我们现在用的文字 |
|---|---|---|---|
| `my_dmg_msg/tank_engine` | Engine damaged | 发动机受损 | 发动机受损 |
| `my_dmg_msg/tank_transmission` | Transmission damaged | 传动机构受损 | 传动装置受损 |
| `my_dmg_msg/tank_gun_barrel` | Gun barrel damaged | 炮管损坏 | 炮管损坏 |
| `my_dmg_msg/tank_cannon_breech` | Gun breech damaged | 炮闩损坏 | 炮闩损坏 |
| `my_dmg_msg/tank_engine_fire` | Engine fire | 发动机起火 | 起火! |
| `hud_tank_driver_dead` | Driver unconscious | 驾驶员昏迷,%02d:%02d 后恢复车辆控制 | 驾驶员昏迷,无法驾驶 |
| `hud_tank_gunner_dead` | Gunner unconscious | 炮手昏迷,%02d:%02d 后恢复射击控制 | 炮手昏迷,无法瞄准和开火 |
| `hud_tank_loader_dead` | Loader unconscious | 装填手昏迷,弹药装填时间增加 | 装填手昏迷,无法装填 |
| `hud_tank_commander_dead` | Commander unconscious | 车长昏迷 | 车长昏迷,无法使用超越控制 |
| `hints/commander_is_unconscious` | The commander is unconscious and cannot use commander sight | 车长已昏迷,无法使用车长观瞄 | 车长昏迷,无法使用超越控制 |
| `hud_gun_barell_malfunction` | Caution, the gun barrel is damaged; continued firing may cause a breech explosion | 注意,炮管已受损,继续发射弹药可能会导致炸膛 | 炮管受损,击发失败 |
| `hud_gun_breech_malfunction` | Caution, the gun breech is damaged; continued firing may cause a fighting compartment explosion | 注意,炮闩已受损,继续发射弹药可能会导致战斗室爆炸 | 炮闩受损,击发失败 |

我们沿用负责人 10-03 指定的文案,只有「炮闩受损,击发失败」这类官方没有的才算我们自己的设计。
