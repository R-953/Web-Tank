# 039-military-symbology:北约 / 华约军标符号(取代自绘的类型图标)

- 负责:Antigravity(3.8 Flash High)
- 状态:进行中
- 分支:`task/039-military-symbology`
- 规模:M(调研 + 纯逻辑)

## 目标

负责人 10-02 提出:War Thunder 的载具类型图标是 Gaijin 自己的美术,照搬有版权风险;038 自绘的菱形 / 三角也只是「参考思路」。改用公开的军用标图规范:**北约(NATO)**和**华约(Warsaw Pact / 苏军)**两套符号,地图界面里可以切换。本卡做符号模块、调研文档和设置项;接进小地图 / 地图界面在以后的卡里做。

## 调研要求(写进 `docs/design/symbology.md`)

1. **北约**:以 Wikipedia「NATO Joint Military Symbology」(APP-6)为主要出处,必要时查 APP-6 / MIL-STD-2525 的公开版本。要写清:
   - 敌我识别框:友军、敌军、中立各是什么形状、什么颜色(标准色值)。
   - 本游戏四种类型——轻型坦克、中型坦克、重型坦克、坦克歼击车 / 突击炮——各用标准里的哪个符号(装备符号还是单位符号、轻 / 中 / 重怎么区分),每个都注明条目或章节。
2. **华约**:苏军 / 华约的战术标号。出处按优先级:
   1. Wikipedia(含俄语维基)上有引用来源的条目;
   2. 美军关于苏军 / 假想敌标号的野战条令(美国政府出版物,属公有领域),例如 FM 100-2 系列;
   3. 实在找不到,用负责人提的 **Command: Modern Operations(CMO)**里的华约符号作参考,并写明「参考 CMO,非原始出处」。
   - 同样写清四种类型各用什么符号、出处是哪一条。
3. **版权**:标准里的符号是公开的标图约定。**不要整份复制** Wikipedia 上的 SVG 文件,按标准的描述自己画路径;文档里写一节说明这一点。
4. **颜色(主程默认,负责人可改)**:苏军习惯是己方红、敌方蓝,和游戏里「友军蓝、敌军红」正好相反。为了不让玩家看反,**两套符号都沿用游戏的友蓝敌红**,在文档里把这条偏差写清楚。
5. 查不到、拿不准的地方单独列一节「待负责人确认」,不要编。

## 允许修改的文件

- 新增:`src/ui/symbols.ts`、`docs/design/symbology.md`、`tests/symbols.test.ts`
- 修改:`src/ui/menu/classIcons.ts`(`classIcon` 改为调用 `symbolSvg`,接口不变)、`tests/class-icons.test.ts`(图标换了,期望可以跟着改)
- 修改:`src/settings/Settings.ts`(`game` 里加 `symbology`,缺省 `'nato'`,`sanitize` 一并处理)、`src/ui/menu/SettingsPanel.ts`(设置 → 游戏 加一项「地图符号:北约 / 华约」)
- 新增:`changelog.d/<日期>-039-military-symbology.md`

## 接口(定死,不要改)

```ts
// src/ui/symbols.ts
import type { VehicleClass } from '../data/types';
export type Symbology = 'nato' | 'warsaw';
export type Affiliation = 'friend' | 'hostile' | 'neutral';
export interface SymbolOptions {
  set: Symbology;
  /** 不传 = 只画类型符号,不画敌我识别框(机库、科技树里用) */
  affiliation?: Affiliation;
  /** 像素边长,缺省 16 */
  size?: number;
  /** 被击毁:灰色,叠一个 × */
  dead?: boolean;
}
export interface SymbolPath { d: string; fill: string; stroke: string; width?: number }
/** 纯数据:viewBox 0 0 32 32 里的若干路径;frame 只在传了 affiliation 时有 */
export interface SymbolShape { frame?: SymbolPath; parts: SymbolPath[] }
export function symbolShape(vehicleClass: VehicleClass, opts: SymbolOptions): SymbolShape;
/** 内联 SVG 字符串,带 role="img"、中文 aria-label(例如「北约 · 中型坦克 · 友军」) */
export function symbolSvg(vehicleClass: VehicleClass, opts: SymbolOptions): string;
/** 画到 canvas(小地图、地图界面用),(x, y) 是符号中心;用 Path2D */
export function drawSymbol(ctx: CanvasRenderingContext2D, vehicleClass: VehicleClass, x: number, y: number, opts: SymbolOptions): void;
/** 当前使用的符号体系(main.ts 读设置后调用 setSymbology;classIcon 用 currentSymbology) */
export function setSymbology(set: Symbology): void;
export function currentSymbology(): Symbology;
```

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] `tests/symbols.test.ts`:两套 × 四种类型共 8 个符号互不相同;传 / 不传 affiliation 时有 / 无识别框;友军 / 敌军 / 中立三种框的形状和颜色符合文档;`dead` 变灰;`aria-label` 正确;`setSymbology` 后 `classIcon` 跟着变
- [x] `docs/design/symbology.md`:每个符号都有出处(条目名 + 链接);版权说明;颜色偏差说明;待确认清单
- [x] 设置存取往返正确,旧设置没有这一项时缺省为北约

## 不做

- 小地图、地图界面、机库里实际换上新符号的接线(以后的卡;`classIcon` 换了实现,机库和科技树会自动用上)
- 海军、空军符号(只在文档里记一句以后怎么扩展)

## 结果(完成后由执行者填写)

- 主程审查后返工:出处改为 MIL-STD-2525C 与 TM 30-430,符号按原图重画。
- 改动文件:
  - 新增:
    - `src/ui/symbols.ts`
    - `docs/design/symbology.md`
    - `tests/symbols.test.ts`
    - `changelog.d/2026-10-02-039-military-symbology.md`
  - 修改:
    - `src/ui/menu/classIcons.ts`
    - `tests/class-icons.test.ts`
    - `src/settings/Settings.ts`
    - `src/ui/menu/SettingsPanel.ts`
    - `docs/tasks/039-military-symbology.md`
- 命令与结果:
  - `npm run lint`: 通过 (TypeScript strict 检查无错误)
  - `npm test`: 通过 (46 个测试套件，479 个测试全部通过)
  - `npm run build`: 通过 (Vite 生产打包成功)
- 偏差 / 未完成 / 待决定:
  - 偏差: 苏军原版战术标图为红方友军、蓝方敌军，为保证游戏一致性与玩家直觉，北约与华约均统一采用游戏现有的友蓝敌红配色，并在 `docs/design/symbology.md` 中做明确说明。
  - 待决定: 小地图与全屏战术地图界面的实际渲染替换留待后续任务卡统筹接入。

