# 任务看板

一个任务一张卡(模板见 [TEMPLATE.md](TEMPLATE.md))。主程写卡、分配、审查;执行者只做卡上的事,完成后在卡末尾填「结果」。

## 当前进度与下一步(新会话先读这里)

> 每个对话之间不共享上下文。新开的会话先读这一节,再看下面的看板和 Changelog「路线与进度」;主程每轮收尾时更新这一节。

最后更新:2026-10-02(第九轮第一波)

- **刚完成:** 第八轮:科技树、编组栏、车组成长与技能、存档全部合并并接进游戏(028–037);038 类型图标待合并(#47)。
- **进行中(第九轮第一波,并行,都从 038 的分支拉出):** 039 北约 / 华约军标符号(调研 + 模块 + 设置项);040 机库底部按 WT 布局重排;041 悬停载具信息卡片(独立组件);042 地图界面(独立组件,含携弹面板和地形底图的抽取)。负责人 10-02 的要求和 WT 参考截图的要点都写在各卡里。
- **下一步(第九轮第二波,等第一波合并;主程或授权卡):**
  - 新增操作「地图界面」,默认 M;原来 M 的「小地图方形 / 圆形」改为没有默认键(设置里可绑)。
  - 进入战斗先打开地图界面(`mode: 'spawn'`)调携弹,点「出战」才开局;战斗中按 M 打开(`mode: 'battle'`,改的携弹下次出战 / 重开生效);机库去掉右侧携弹面板。
  - 小地图和地图界面的标记换成 039 的军标(带敌我识别框);设置和地图界面里的「北约 / 华约」同步。
  - 041 的信息卡挂到编组栏、科技树(悬停显示,双击关闭)。
  - (已派 Copilot 043)修 `vite.config.ts`:在 worktree 里跑 dev server 时改代码不刷新。
- **已定的细节:** 每个国家默认 1 个初级车组,招募上限 8 个车位;同一编组一辆车只分给一个车组;地面载具满级 150 级(经验上限、溢出、模式折算等引入空中载具时再定);第一期换到别的车族要先训练(即时、免费);在线时间(页面开着,包括停在机库)不算挂机成长,在线游玩的成长以后按战斗经验另算。029、030 已按这些返工。
- **排队:**
  - 10 月 3 日 Copilot 权益生效后,重测 Copilot 可用的模型;OpenAI 工单解决后,把 Codex CLI 加进调度脚本。
  - 候选车辆(见下文)型号确认后开卡。
  - 自定义瞄具(后期)。
- **派活方式:** 默认 Antigravity + Gemini 3.8 Flash High,用 `scripts/agents/dispatch.mjs` 派发(说明见 [scripts/agents/README.md](../../scripts/agents/README.md));Claude Code 当主程,写卡、审查、解决冲突。

| 编号 | 任务 | 负责 | 车道 | 状态 |
|---|---|---|---|---|
| [000](000-git-sync.md) | 理顺 git,把第五轮和协作机制推上 GitHub | Claude Code | 主程 | 已合并 |
| [001](001-perf-baseline.md) | 本机帧率基线(低 / 中 / 高画质) | Claude Code(代 Antigravity) | 界面 / 实测 | 已合并 |
| [002](002-minimap-marker-style.md) | 小地图标记样式:圆点 / 箭头 | Claude Code(代 Copilot) | 小任务 | 已合并 |
| [003](003-research-m4a3-76w.md) | M4A3(76)W 数据调研(只出数据和出处) | Claude Code(代 Gemini CLI) | 内容 | 已合并 |
| [004](004-local-model-eval.md) | 本地模型能力测试 | 负责人 + LM Studio | 杂务 | 待领取(随时) |
| [005](005-menu-dropdown-overlap.md) | 主界面下拉菜单被车辆信息面板盖住 | Claude Code | 主程 | 已合并 |
| [006](006-casemate-aiming.md) | 固定战斗室(无炮塔)车辆的瞄准逻辑 | Claude Code | 主程 | 已合并 |
| [007](007-casemate-vehicles.md) | 两辆代表性固定战斗室车辆:StuG III G、SU-100(数据) | Claude Code | 主程 / 内容 | 已合并 |
| [008](008-freelook-reverse-steer.md) | C 键自由视角;倒车时转向按汽车习惯 | Claude Code | 主程 | 已合并 |
| [009](009-casemate-models.md) | StuG III G、SU-100 专属模型(战斗室可前后偏移) | Claude Code | 主程 / 内容 | 已合并 |
| [010](010-isu122.md) | ISU-122 替换 StuG III G;SU-100 炮盾修正 | Claude Code | 主程 / 内容 | 已合并 |
| [011](011-restart-key-test-timeout.md) | 重开键每帧重开;出生点视线测试偶发超时 | Claude Code | 主程 | 已合并 |
| [012](012-shermans.md) | 谢尔曼三车(M4A3(76)W、M4A3E8、M4A3E2)数据与模型骨架 | Claude Code | 主程 / 内容 | 已合并 |
| [013](013-sherman-hull.md) | 谢尔曼 M4A3 车体模型 | Antigravity(3.8 Flash High) | 内容 | 已合并 |
| [014](014-sherman-suspension.md) | 谢尔曼 VVSS / HVSS 行走机构 | Antigravity(3.8 Flash High;原派 Copilot,mai-code 建模偏弱,改派) | 内容 | 已合并 |
| [015](015-sherman-turrets.md) | 谢尔曼 T23 / Jumbo 炮塔与火炮 | Antigravity(3.8 Flash High) | 内容 | 已合并 |
| [016](016-agent-dispatch.md) | 命令行派发任务 + 各家模型测试 | Claude Code | 主程 | 已合并 |
| [017](017-us-reticle.md) | 美式瞄准镜分划 | Antigravity | 界面 | 已合并 |
| [018](018-fixed-radius-steering.md) | 受控差速器的固定半径转向(谢尔曼不能原地转) | Antigravity(主程审查) | 主程 / 内容 | 已合并 |
| [019](019-wet-stowage.md) | 湿式弹药架降低殉爆和起火 | Antigravity(主程审查) | 主程 / 内容 | 已合并 |
| [020](020-lower-front-armor.md) | 车体正面分首上 / 首下(虎王首下弱点等) | Antigravity(3.8 Flash High,主程审查) | 主程 / 内容 | 已合并 |
| [021](021-third-person-zoom.md) | 第三人称按 Z 放大视角 | Antigravity | 界面 | 已合并 |
| [022](022-sight-azimuth-range.md) | 瞄准镜顶部改为方位角,距离读数移到准星右下 | Antigravity | 界面 | 已合并 |
| [023](023-death-killcam.md) | 玩家被击毁时的回放 | Antigravity | 界面 | 已合并 |
| [024](024-hangar-camera-walls.md) | 机库镜头拉远时穿墙 | Antigravity | 界面 | 已合并 |
| [025](025-relocate-web-tank.md) | 仓库搬到 D:\Web Tank,清理旧 worktree,整理根目录 | Antigravity → 主程执行 | 杂务 | 已合并 |
| [026](026-sherman-paint.md) | 谢尔曼按真实涂装改颜色、加白星标识 | Antigravity | 内容 | 已合并 |
| [027](027-round6-wrapup.md) | 第六轮收尾——日志汇总、看板状态、跨会话进度 | Antigravity(3.8 Flash High;主程审查) | 主程 | 已合并 |
| [028](028-vehicle-meta-crew-ace.md) | 载具国家 / 类别 / 年份 / 车族,王牌乘员数值 | Antigravity(3.8 Flash High) | 内容 | 已合并 |
| [029](029-crew-progress.md) | 车组成长曲线与技能插值(纯逻辑) | Antigravity(3.8 Flash High) | 主程 / 内容 | 已合并 |
| [030](030-crew-lineup-profile.md) | 车组与编组的存档 | Antigravity(3.8 Flash High) | 主程 / 内容 | 已合并 |
| [031](031-tech-tree-ui.md) | 科技树界面(独立组件) | Antigravity(3.8 Flash High) | 界面 | 已合并 |
| [032](032-dispatch-fixes.md) | 调度脚本:改动行数统计、DEP0190 警告 | Copilot CLI(主程审查) | 杂务 | 已合并 |
| [033](033-lineup-bar.md) | 机库底部的编组栏,接上科技树 | Antigravity(3.8 Flash High) | 界面 | 已合并 |
| [034](034-crew-skill-in-battle.md) | 开局按车组等级改玩家载具的装填和转速 | Antigravity(3.8 Flash High,主程审查) | 主程 / 内容 | 已合并 |
| [035](035-minimap-marker-color.md) | 小地图标记颜色抽成纯函数并补测试 | Copilot CLI(主程审查) | 测试 | 已合并 |
| [036](036-profile-dedupe-lineup-ids.md) | 存档清洗时给重复的编组 id 去重 | Copilot CLI(主程审查) | 小任务 | 已合并 |
| [037](037-crew-wiring.md) | main.ts 接上车组与编组存档、离线成长、开局车组技能 | Claude Code | 主程 | 已合并 |
| [038](038-class-icons.md) | 载具类型图标(039 会换成北约 / 华约军标) | Antigravity(3.8 Flash High) | 界面 | 待合并 |
| [039](039-military-symbology.md) | 北约 / 华约军标符号(调研 + 模块 + 设置项) | Antigravity(3.8 Flash High) | 内容 / 界面 | 进行中 |
| [040](040-hangar-bar-layout.md) | 机库底部按 War Thunder 的布局重排 | Antigravity(3.8 Flash High) | 界面 | 进行中 |
| [041](041-vehicle-info-card.md) | 鼠标悬停的载具信息卡片 | Antigravity(3.8 Flash High) | 界面 | 进行中 |
| [042](042-map-screen.md) | 地图界面(编组 + 携弹 + 大地图),独立组件 | Antigravity(3.8 Flash High) | 界面 | 进行中 |
| [043](043-vite-watch-worktree.md) | worktree 里跑 dev server 时改代码不刷新 | Copilot CLI(主程审查) | 杂务 | 进行中 |

### 候选车辆(负责人 2026-09-29 提出方向,型号待确认后再开卡)

按「早期 / 后期型只是换皮时只做后期型」挑选:

| 国家 | 类别 | 候选 |
|---|---|---|
| 德国 | 突击炮 / 歼击车 | Jagdpanzer IV/70、Jagdpanther(StuG III G 做过,010 换成了 ISU-122) |
| 德国 | 中型坦克 | 豹式 G 型(D / A 型视为换皮,不做) |
| 苏联 | 各口径自行反坦克炮 | SU-76M(76 mm)、SU-85(85 mm)、SU-100(100 mm,007)、ISU-122(122 mm,010)、ISU-122S(D-25S 炮,不是换皮,要做另开卡)、ISU-152(152 mm) |
| 苏联 | 各重量坦克 | 轻型 T-70、中型 T-34-85(已有)、重型 IS-2(1944) |

**已规划:**

- 科技树、成员组:谢尔曼三车(013–015)完工后开卡,设计稿见 [docs/design/tech-tree-and-crew.md](../design/tech-tree-and-crew.md)。
- 自定义瞄具(负责人 2026-10-01 提出,后期再做):参考 War Thunder 的自定义瞄具,玩家可以自己摆分划、刻度和读数的位置。022 先把方位角、距离读数按 WT 默认布局做好。

状态:待领取 → 进行中 → 待审查 → 已合并。改状态时同时改卡片开头的「状态」一行。

## 各工具怎么读到 AGENTS.md

- **Claude Code:** 仓库里没有 CLAUDE.md 时自动读 AGENTS.md(需要 v2.1.277 以上;会话里用 `/memory` 确认)。
- **GitHub Copilot:** CLI 和 coding agent 都会自动读 AGENTS.md。
- **Antigravity:** 自动读工作区根目录的 AGENTS.md。
- **Gemini CLI:** 默认只读 GEMINI.md。在 `%USERPROFILE%\.gemini\settings.json` 里加上下面这段,就会读 AGENTS.md:
  ```json
  { "context": { "fileName": ["AGENTS.md", "GEMINI.md"] } }
  ```
- **本地模型(LM Studio):** 没有自动读取,需要时把相关内容直接贴进对话。
