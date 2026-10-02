# 065-killcam-overlay:命中回放的文字和图标层(顶部结果文字、左下模块图标、右下乘员数)

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/065-killcam-overlay`
- 规模:M
- 和 066 并行:066 在 `KillCam.ts` 里使用本卡的组件;**接口已经由主程放在 `src/ui/killcamOverlay.ts`(现在是类型 + 空实现),本卡只实现它,不改导出的名字、参数和类型**

## 目标

负责人 10-02 给了一段 War Thunder 命中回放的录屏(`Archive/1002.mp4`,不进 git),要求按它的设计逻辑改命中回放:**跳弹、未击穿、击穿但没击毁也要播回放**,不止击毁。主程逐帧看过,回放画面上有三样文字 / 图标元素,本卡做这一层(3D 场景由 066 做):

1. **顶部中间一行大字**(黄 / 红,窄体粗字,带暗色描边):这一发的结果,随回放进展**升级**。录屏里的例子:刚击穿时黄色「COUP」(命中);乘员阵亡时变红色「ÉQUIPAGE HORS DE COMBAT」(乘员失去战斗力);弹药架爆炸时红色「LES MUNITIONS ONT EXPLOSÉ」(弹药殉爆)。
2. **左下四个模块类别图标**:发动机、火炮、炮塔驱动、弹药架。没受损是灰的,受损变红;随回放时间轴逐个亮红。
3. **右下乘员数**:小人图标 + 「存活 / 总数」,例如「3 / 3」「1 / 4」;有乘员阵亡后变红。

## 背景与参考

- `src/ui/killcamOverlay.ts`:主程放的接口和空实现,里面每个函数 / 类型的注释就是规格。
- `HitReplay`(`src/game/Game.ts`):`armor`(`penetrated` / `ricochet` / `angleDeg` / `armor` / `effectiveArmor` / `penetration`;打中炮管时为 `null`)、`penetration`(`hits[]`:`kind` / `id` / `destroyed` / `time` / `hpAfter`;`explosion?.time`;`duration`)、`external[]`(车外受损的履带 / 炮管)、`before` / `after`(模块和乘员血量比例,键为模块 id 或 `crew:序号`)、`layout`(模块和乘员列表,`modules[].type`)、`detonated`、`destroyed`。
- 时间约定(和现有 `KillCam` 一致):`tContact` 是炮弹接触车体的时刻(KillCam 里叫 `APPROACH`);车内记录的 `time` 是相对 `tContact` 的秒数,所以绝对时刻 = `tContact + time`;车外的 `external` 记录在接触那一刻生效。
- 模块血量时间线:接触前 = `before[id]`;`external` 里的记录在 `tContact` 跳变;`penetration.hits` 里的记录在 `tContact + time` 跳变(取该记录的 `hpAfter / maxHp`);最后 = `after[id]`。`KillCam.ts` 里 `timelineFor` 有同样的逻辑,本卡写成纯函数 `ratioAt`(不要改 `KillCam.ts`,066 会改成用它)。
- 模块类别(`layout.modules[].type` → 类别):`engine` / `transmission` / `fuel` → `engine`;`barrel` / `breech` → `gun`;`traverse` / `elevation` → `turret`;`ammo` → `ammo`;`track` 不进图标(履带受损在 3D 画面里看)。一个类别里**任意**模块血量比例 < 1 → `damaged`;**全部**模块 ≤ 0 → `destroyed`;否则 `ok`。
- 样式:`KillCamOverlay` 自己注入 `<style>`(带 id,重复创建不重复注入),类名用 `kco-` 前缀(**不要用 `cs-` / `crw-` / `mm-` / `ms-` / `vc-`**,会和别的界面冲突);不要改 `styles.ts`。字体用系统无衬线粗体窄体(`"Arial Narrow", "Microsoft YaHei", sans-serif` 一类,`font-weight: 700`),字号随窗口宽度:小窗(≤ 480 px)22 px,大窗 40 px;黄 `#ffd83a`、红 `#ff3b30`、白 `#f2f2f2`,文字描边用 `text-shadow` 做 1–2 px 暗边。

## 要做的事

1. **纯函数**(全部导出,按 `killcamOverlay.ts` 里已有的签名,不依赖 DOM / WebGL):
   - `hitOutcome(replay)`:整段回放的最终档位。`armor` 为 null(打中炮管)或 `!penetrated && !ricochet` → `'nopen'`;`ricochet` → `'ricochet'`;`penetrated` 且 `detonated` → `'ammo-exploded'`;`penetrated` 且有乘员阵亡(`after` 里某个 `crew:` 键 ≤ 0 而 `before` > 0)→ `'crew-out'`;其余 `'penetrated'`。
   - `ratioAt(replay, id, t, tContact)`:上面的血量时间线。
   - `killcamCaption(replay, t, tContact)`:`t < tContact` → null。文字:`ricochet`「跳弹」(`info`),`nopen`「未击穿」(`info`),击穿后起「击穿」(`hit`);第一名乘员阵亡的时刻(`penetration.hits` 里 `kind === 'crew' && destroyed` 的最早 `tContact + time`)起「乘员失去战斗力」(`severe`);弹药殉爆的时刻(`tContact + explosion.time`;没有 `explosion` 字段就用 `tContact + duration`)起「弹药殉爆」(`severe`)。只升不降,同一时刻有多个条件取最强的。
   - `killcamIcons(replay, t, tContact)`:四个类别的 `IconState`,按上面的规则用 `ratioAt` 算。
   - `killcamCrew(replay, t, tContact)`:`total = layout.crew.length`,`alive` = `ratioAt(crew:序号)` > 0 的人数(`layout.crew[i].id` 就是 `crew:序号`)。
2. **`KillCamOverlay` 组件**:构造时往 `parent`(KillCam 的 frame 元素)里放一个 `.kco-root`(绝对定位铺满、`pointer-events: none`),里面三块:顶部居中的文字 `.kco-caption`、左下的四个 SVG 图标 `.kco-icons`(顺序:发动机、火炮、炮塔、弹药架;每个图标一个简单的内联 SVG,颜色用 `currentColor`,灰 `#8a949c` / 受损红 `#ff3b30` / 报废深红 `#7a1410`)、右下 `.kco-crew`(小人 SVG + 「存活 / 总数」文字,有人阵亡时红色,否则灰白色)。`show(replay)` 记下这段回放并清空;`update(t, tContact)` 按上面的纯函数刷新(**只在内容变化时改 DOM**,不要每帧重写 `innerHTML`);文字变化时加一个 0.15 s 的放大回弹动画(CSS `@keyframes`);`hide()` 隐藏;`dispose()` 移除。
3. 测试(新增 `tests/killcam-overlay.test.ts`,jsdom):
   - `hitOutcome`:四种(跳弹 / 未击穿 / 击穿没人死 / 击穿死人 / 殉爆)和打中炮管(`armor: null`);
   - `ratioAt`:接触前 = before、外挂记录在接触时跳变、车内记录在 `tContact + time` 跳变、最后 = after;
   - `killcamCaption`:接触前 null;各档位文字和语气;升级只升不降;
   - `killcamIcons`:类别归属(`track` 不影响)、`ok` / `damaged` / `destroyed`;随时间亮起;
   - `killcamCrew`:随时间减少;
   - `KillCamOverlay`:show / update 后文字、图标类名、乘员数文字;反复 update 同一时刻不重写 DOM(用 `MutationObserver` 或比较节点引用);hide / dispose;重复创建只注入一份样式。
   - 回放数据用测试里自己造的 `HitReplay`(参考 `tests/killcam-redo.test.ts` 的 `makeReplay`;`normal` 字段随便填一个单位向量)。

## 允许修改的文件

- 修改:`src/ui/killcamOverlay.ts`(只实现,不改导出签名)
- 新增:`tests/killcam-overlay.test.ts`、`changelog.d/<日期>-065-killcam-overlay.md`

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 上面第 3 条的测试都有
- [ ] 主程会在 066 合入后在浏览器里看实际效果

## 不做

- `KillCam.ts` 的 3D 场景、镜头、触发时机(066 和主程);不改 `Game.ts` / `main.ts` / `styles.ts`;不加英文 / 法文文案(只用简体中文)。

## 结果(完成后由执行者填写)

- 改动文件:
  - `src/ui/killcamOverlay.ts` (实现纯函数与 DOM 组件)
  - `tests/killcam-overlay.test.ts` (新增单元测试)
  - `changelog.d/2026-10-02-065-killcam-overlay.md` (新增日志)
  - `docs/tasks/065-killcam-overlay.md` (填写完成结果)
- 命令与结果:
  - `npm run lint`: 通过 (0 errors)
  - `npm test`: 80 个测试文件共 838 个测试全部通过
  - `npm run build`: 生产构建成功
- 偏差 / 未完成 / 待决定: 无。所有规格均与任务卡要求严格一致。
