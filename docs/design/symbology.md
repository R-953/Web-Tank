# 战术标号规范与实现设计: 北约 (NATO) 与 华约 (Warsaw Pact)

本文档归档 039 任务卡中关于战术军标规范(北约 MIL-STD-2525C 与 华约 TM 30-430)的调研出处、矢量路径设计、版权说明、颜色偏差以及待负责人确认清单。

---

## 1. 背景与目标

在拟真装甲对抗游戏中，采用公开的军用标图规范(Military Symbology)取代商业游戏美术或自绘几何图例，能够消除版权合规隐患并提升专业军事拟真感。
本项目实现了两套公开战术标号规范：
- **北约体系 (NATO / MIL-STD-2525C 地面装备标号)**
- **华约体系 (Warsaw Pact / 1946 年美国陆军部 TM 30-430 苏军战术标号)**

两套符号提供统一的数据与渲染接口(`symbolShape`、`symbolSvg`、`drawSymbol`)，支持在设置面板中切换，并与机库、科技树以及后续的小地图/战略地图解耦协作。

---

## 2. 北约标号体系 (MIL-STD-2525C 地面装备)

### 2.1 出处与依据标准
- **主要出处**:
  - 美国国防部《Common Warfighting Symbology》(MIL-STD-2525C), 2008-11-17, 公开标准: [MIL-STD-2525C PDF](https://worldwind.arc.nasa.gov/milstd2525c/Mil-STD-2525C.pdf)
  - Wikipedia: [NATO Joint Military Symbology](https://en.wikipedia.org/wiki/NATO_Joint_Military_Symbology) (敌我识别框概述)
  - 外观对照参考: 开源项目 milsymbol (MIT 许可) 对 2525C 规范的渲染效果(仅用于目视对照外观，路径数据完全独立手写，不复制其代码)

### 2.2 敌我识别框架 (Ground Equipment Frames)
由于地图上的标记为单辆载具装备而非建制部队，根据 MIL-STD-2525C「地面装备 (Ground Equipment)」定义：

| 阵营身份 | 框架几何形状 | 标准色值 | 几何与网格定义 (32×32) |
| :--- | :--- | :--- | :--- |
| **友军 (Friendly)** | 圆形 (Circle) | 蓝色 (`#00A8F0`) | 半径 12 的居中正圆 `M 16 4 A 12 12 0 1 0 16 28 A 12 12 0 1 0 16 4 Z` |
| **敌军 (Hostile)** | 菱形 (Diamond) | 红色 (`#FF4D4D`) | 45° 旋转菱形 `M 16 2 L 30 16 L 16 30 L 2 16 Z` |
| **中立 (Neutral)** | 正方形 (Square) | 绿色 (`#00C800`) | 边长 22 的正方形 `M 5 5 H 27 V 27 H 5 Z` |

*注：边框线宽统一为 2px，内部透明(`fill="none"`)。*

### 2.3 四种载具类型符号与 SIDC 代码
在 MIL-STD-2525C 地面装备规范中，坦克使用横置延伸长方形，火炮使用竖直炮身线加底座：

1. **轻型坦克 (Light Tank)**:
   - **SIDC**: `S*GPEVATL-` (Ground / Equipment / Ground Vehicle / Armored Vehicle / Tank / Light)
   - **图形构型**: 横放的长方形，左右两条竖边向上、向下各伸出一小截；长方形内部有 1 道居中竖线。
2. **中型坦克 (Medium Tank)**:
   - **SIDC**: `S*GPEVATM-` (Ground / Equipment / Ground Vehicle / Armored Vehicle / Tank / Medium)
   - **图形构型**: 同样的横置延伸长方形，内部有 2 道均匀分布的竖线。
3. **重型坦克 (Heavy Tank)**:
   - **SIDC**: `S*GPEVATH-` (Ground / Equipment / Ground Vehicle / Armored Vehicle / Tank / Heavy)
   - **图形构型**: 同样的横置延伸长方形，内部有 3 道均匀分布的竖线。
4. **坦克歼击车 / 突击炮 (Tank Destroyer / Self-Propelled Gun)**:
   - **SIDC**: `S*GPEWDMS-` (Ground / Equipment / Weapon / Direct Fire Gun / Medium / Self-Propelled)
   - **图形构型**: 一根竖直炮身线，上部有 2 道短横线；底部一个横放的小椭圆(履带底座，表示自行)。
   - **说明**: 2525C 中直射火炮的 Light / Medium / Heavy 级别并非按口径数值界定，本项目在战术符号层面统一取 Medium 级别。

内部图元边界最大跨度约 13px (距中心半径约 9.2px)，均可完整置入半径为 12px 的友军圆形框内。

---

## 3. 华约 / 苏军战术标号体系 (TM 30-430)

### 3.1 出处与依据标准
- **主要出处**:
  - 美国陆军部手册: War Department, TM 30-430《Handbook on USSR Military Forces》Chapter XII「Maps, Conventional Signs, and Symbols」, 1946-10-15。
  - 节次: Section II「Soviet Tactical Symbols」第 5 条「Tank troop symbols」, 第 XII-10 页。
  - 在线馆藏: [内布拉斯加大学林肯分校数字馆藏 (UNL Digital Commons)](https://digitalcommons.unl.edu/dodmilintel/29/)
  - 版权属性: 美国政府出版物，属公有领域 (Public Domain)。

### 3.2 四种载具类型图形 (按 TM 30-430 原书图例)
苏军战术标图采用扁菱形及其内部划线作为装甲车辆的判读符号：

1. **轻型坦克 (Light Tank)**:
   - 原文: 「Light tank (or unspecified type)」
   - 图形: 横放的扁菱形，宽约为高的 2 倍 (宽 20, 高 10)，空心。
2. **中型坦克 (Medium Tank)**:
   - 原文: 「Medium tank」
   - 图形: 同样的横放扁菱形，加 1 道竖线连接上、下两个顶点。
3. **重型坦克 (Heavy Tank)**:
   - 原文: 「Heavy tank」
   - 图形: 同样的横放扁菱形，中心带一个实心圆点。
4. **坦克歼击车 / 突击炮 (Self-Propelled Gun)**:
   - 原文: 「Self-propelled gun」
   - 图形: 竖放的扁菱形，高约为宽的 2 倍 (高 20, 宽 10)；内部有 3 道竖线，中间 1 道最长(贯通上下顶点)，两边 2 道较短。

### 3.3 敌我识别表现形式
华约体系**不绘制北约的几何外框**。依据 TM 30-430 第 XII-1 页原文：
> 「Tactical symbols representing friendly troops are red. Those for enemy troops are blue, the converse of United States usage. On black and white maps or charts, friendly troops are represented by solid heavy lines and enemy troops are indicated by lighter, double lines.」

项目实现规则：
- **友军 (Friendly)**: 单道粗线 (线宽 2.4)，颜色为友军蓝。
- **敌军 (Hostile)**: 双道细线 (外层菱形轮廓 + 同心向内缩进的内层菱形轮廓，线宽 1.2)，颜色为敌军红。
- **中立 (Neutral)**: 单道细线 (线宽 1.2)，颜色为中立绿。原书未设中立类型，此项为游戏接口完整性而补充。
- **无阵营 (科技树 / 机库)**: 单道中等粗细 (线宽 1.8)，颜色跟随 `currentColor`。

---

## 4. 版权与独立矢量实现声明

本文档所依据的 MIL-STD-2525C 与 TM 30-430 均为美国政府发布的公开军事技术规范与历史文献，属于公有领域。本项目根据标准所规定的几何定义，在 32×32 网格中自主编写所有 SVG 路径，未抓取或复制任何现成商业库文件。

---

## 5. 颜色约定与偏差说明

1. **历史偏差说明**:
   苏军传统制图为红方己方、蓝方敌方。为保证玩家战场态势感知统一，避免因阵营切换发生敌我识别混淆，**北约与华约两套符号均统一沿用游戏的「友军蓝 (`#00A8F0`)、敌军红 (`#FF4D4D`)、中立绿 (`#00C800`)」配色**。
2. **被击毁状态**:
   载具被击毁(`dead: true`)时线条统一变灰 (`#888888`)，并叠加居中对角交叉线 (`×`)。

---

## 6. 将来扩展 (海军与空军标号)

当前任务卡专注于地面载具。未来扩展空海作战时：
- 北约空军装备在 2525C 中使用拱形圆顶框架，海军使用下半圆或扁平底框；
- 华约空海符号亦可在 TM 30-430 后续章节中查验对应海空图例，通过 `SymbolOptions` 增加 `domain?: 'land' | 'air' | 'sea'` 平滑扩展。

---

## 7. 待负责人确认事项

1. **小地图接入时机**:
   本卡实现符号底层逻辑、设置项开关、文档与测试，并完成 `classIcon` 接入。小地图与全屏战术地图界面的实际渲染替换留待后续任务卡统筹接入。
