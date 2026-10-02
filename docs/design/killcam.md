# 命中回放设计(参照 War Thunder 的 X 光回放)

负责人 2026-10-02 给了一段 War Thunder 命中 / 被命中回放的录屏(`Archive/1002.mp4`,57 秒、1920×1080,由七八段回放拼成;录屏和主程逐帧截的参考图都放在本机 `Archive/`,不进 git)。下面是主程逐帧看过后整理的设计要点,第十一轮(065、066)按它实现。

## 画面构成

- **回放窗口**:屏幕中央一个带边距的矩形,窗口外是被调淡、泛白的游戏画面;窗口里是回放场景。
- **顶部文字**(居中,窄体粗字,红 / 黄):这一发的结果,**随进展升级**——
  - 黄「COUP」(命中):炮弹刚击穿、还没伤到乘员时;
  - 红「ÉQUIPAGE HORS DE COMBAT」(乘员昏迷):有乘员阵亡后;
  - 红「LES MUNITIONS ONT EXPLOSÉ」(弹药殉爆):弹药架爆炸后。
- **左下四个模块类别图标**:发动机、火炮、炮塔驱动、弹药架;没受损是灰的,受损变红,随时间逐个亮红。
- **右下乘员数**:小人图标 + 「存活 / 总数」(1 / 4、3 / 3……);有人阵亡后变红。

## 镜头与场景

1. **先看车外**:镜头对着带真实材质的目标车,炮弹(深色带尾翼的弹体或白色五片尾翼的箭形弹)从画外飞向车体。
2. **接触 → X 光**:接触瞬间真实外壳褪成半透明灰壳 + 白色轮廓线,乘员显示成**坐姿人形剪影**(半透明浅蓝灰 + 橙色轮廓线),模块是带颜色的盒子(弹药架黄色、其余蓝灰),炮弹变成车内的橙红曳光线,破片是橙色火花 / 红点。
3. **受损**:被打中的乘员和模块整体变红(红色填充 + 红轮廓),报废的变近黑;弹药殉爆是一个大的纯红球。
4. **镜头运动**:接触后贴近车内,先沿弹道看,再围着乘员 / 受损部位缓慢环绕;结束时拉远或淡出,回到游戏画面。每段约 5–6 秒,段与段之间有一道白闪。
5. **未造成伤害的命中**(顶部文字只有黄色「COUP」、图标全灰、乘员数灰色):也会播放,只是内构里没有红色。
6. **自己被击毁的回放**(录屏最后一段):不带窗口框,直接叠在游戏世界的画面上——自己的残骸变成半透明 X 光,弹道是一条细青绿线,**弹着点是橙色半透明圆盘 + 向外扩散的圆环**,受损部位红色多边形高亮,镜头围着残骸缓慢环绕。(录屏里的圆形裁切是负责人剪辑时加的,不是游戏本身的。)

## 我们怎么落地(第十一轮)

- 玩家击毁目标时播右上角小窗;玩家命中但未击毁时仅在开启「所有命中都回放」后播。己方被命中未击毁不播,只有己方被击毁时才播全屏;「命中回放」总开关关闭时一律不播。
- 跳弹:炮弹沿反射方向飞出,不进 X 光;未击穿:炮弹被挡下,不进 X 光;两者都保留弹着标记,镜头围着弹着点转。击穿:沿用第十轮 061 的效果时间线和相机环绕,加上真实外壳 → 灰壳过渡、坐姿人形乘员、按类型着色的模块。
- 文字层(顶部文字、模块图标、乘员数)是 `src/ui/killcamOverlay.ts`,3D 场景在 `src/ui/KillCam.ts`。
- 第 6 条「叠在游戏世界里的死亡回放」第十二轮已做(`src/ui/WorldReplay.ts` + `WorldXray.ts`,设置「死亡回放方式」可切回全屏窗口);己方被击中没被击毁不再播。

## 修改方向

- 环绕角度、方向、时长是常量(`KILLCAM_ORBIT_DEGREES`、`KILLCAM_ORBIT_DIRECTION`、`APPROACH` 等),不满意直接调。

## 回放文字对照表(第十二轮 069、075)

下表使用 War Thunder 公开语言文件 [`menu.csv`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) 的 `hitcamera/result/*` 词条。游戏保留 `penetrated` 和 `hit` 两个分档及其升级时刻,但击穿且无损伤时也显示「命中」。

| 情形 | 键 | English | 简体 | 我们用的文字 | 说明 |
|---|---|---|---|---|---|
| 跳弹 | [`hitcamera/result/ricochet`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Ricochet | 跳弹 | 跳弹 | 入射角导致弹丸弹开。 |
| 未击穿 | [`hitcamera/result/bounce`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Non-penetration | 未击穿 | 未击穿 | 弹丸未能穿透目标装甲。 |
| 击穿但没伤到成员和模块 | [`hitcamera/result/hit`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Hit | 命中 | 命中 | `penetrated` 分档仍保留,只将顶部文案改为官方 `hit` 用语。 |
| 击伤成员,或损坏模块 | [`hitcamera/result/damage`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Damage | 击伤 | 命中 | 负责人指定沿用「命中」,不按官方「击伤」改动。 |
| 打中发动机 / 油箱 / 弹药架并起火 | [`hitcamera/result/burn`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Fire | 引燃 | 引燃 | 沿用负责人指定的「引燃」。 |
| 起火且击伤成员 | [`hitcamera/result/critical`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Critical Hit | 重创 | **致命攻击** | 负责人指定使用「致命攻击」;与官方简体「重创」不同(官方繁体为「致命攻擊」)。 |
| 击毁:乘员 | [`hitcamera/result/crew`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Crew knocked out | 乘员昏迷 | 乘员昏迷 | 乘员阵亡导致载具失去战斗力时显示。 |
| 击毁:弹药殉爆 | [`hitcamera/result/ammo`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Ammunition exploded | 弹药殉爆 | 弹药殉爆 | 弹药架殉爆时显示。 |
| 击毁:燃油爆炸 | [`hitcamera/result/fuel`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Fuel exploded | 燃油爆炸 | - | 当前未建模燃油爆炸,暂无此回放结果。 |
| 击毁:超压 / 结构断裂 | [`hitcamera/result/hull`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Hull break | 外部主结构断裂 | - | 对应负责人所说的超压 / 结构断裂;当前未建模,暂无此回放结果。 |
| 火烧致死 / 烤炸弹药 | [`hitcamera/result/burn`](https://github.com/gszabi99/War-Thunder-Datamine/blob/master/lang.vromfs.bin_u/lang/menu.csv) | Fire | 引燃 | - | `burn` 只表示引燃,不是火灾蔓延后的乘员烧死或弹药烤炸;此类持续性间接伤害不是直接击毁,当前不作为回放击毁标题。 |

### 升级规则与时间线说明
- **只升不降**: 击穿档 / 命中档（两档文案均为「命中」）→ 引燃 → 致命攻击 → 击毁原因（乘员昏迷 / 弹药殉爆），每一档在对应事件发生的时刻切换。
- **引燃时刻**: 取这一发中最早伤及发动机 / 油箱 / 弹药架的时刻（若无内部伤害记录则取接触时刻 `tContact`）。
- **致命攻击时刻**: 当且仅当这一发同时满足「点着了火」与「击伤乘员」时触发，切换时刻为 `max(tIgnited, tCrewWounded)`。
- **乘员昏迷**: 仅当载具被判定击毁（且非弹药殉爆）时触发，切换时刻为致死乘员中弹时刻。
