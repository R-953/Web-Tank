# 本地模型能力测试(任务 004)

状态:**进行中**。已测 1 个模型(MiniCPM5 1B);三个 9B Q8 模型和其他侧载模型待测。每测完一个,在「各模型结果」里追加一节,最后再写总结论。

## 测试环境

| 项目 | 值 |
|---|---|
| 机器 | 15.7 GB 内存,Intel UHD 核显(显存 128 MB),基本靠 CPU 推理 |
| 运行方式 | LM Studio 服务(`localhost:1234`,OpenAI 兼容接口),llama.cpp Vulkan AVX2 后端 |
| 采样参数 | 两组。**A 低温对照**:temperature 0.2,max_tokens 6000。**B 默认设置**:temperature 0.8(LM Studio 默认值,显式传入),max_tokens 16384。都开启思考、流式输出 |
| 上下文 / 并行 | 32768 / 4;Flash Attention 开,KV 缓存不量化,其余为 LM Studio 默认 |
| 测量方式 | 脚本记录首字延迟、总耗时、生成 token 数;速度 = 生成 token 数 ÷ 首字之后的耗时 |
| 仓库版本 | `69b6617`(测试 1 的 git log 输入取自这个提交) |
| 评分 | 0 = 不能用,1 = 要大改,2 = 小改就能用,3 = 直接能用(评分人:Claude Code,按下面写明的标准) |

三个测试每个模型每组参数只跑一次,没有重复取平均;输入固定,所有模型用同一份。另有一轮因脚本的环境变量名与 Windows 的 `TEMP` 冲突,temperature 参数不确定,该轮已作废,不计入结果。

## 与任务卡的差异

- 任务卡写的是「7–8B、Q4、约 5 GB」。机器上现有的模型全是 Q8 / F16(9–10 GB),没有 Q4。16 GB 内存的笔记本在已开浏览器和 Claude 的情况下只剩约 2 GB 可用,**9–10 GB 的模型无法在本机加载**,所以这一轮只测了已加载的 1B。
- 测试 3 的提示词里补了 `export const GRID = 10;` 和导入路径。`gridLabel` 依赖 `GRID`,不给的话任何模型都写不出正确的期望值。
- 后续如果用「远端侧载」的模型测试,**测出的速度反映的是远端机器,不是这台笔记本**;能力(得分)可以比较,速度不能直接用来回答「这台笔记本能不能跑」。

## 各模型结果

### MiniCPM5 1B Claude-Opus-Fable5 v2 Thinking(1.1B,F16,2.17 GB,纯文本)

> 精度 F16(LM Studio 与文件名一致,负责人已确认)。

| 测试 | A 低温(0.2)得分 / 速度 | B 默认(0.8)得分 / 速度 |
|---|---|---|
| 1 文本整理 | **0** / 7.6 tok/s(6000 token 用满上限,无正式输出,共 797 s) | **0** / 8.0 tok/s(6036 token 自然结束,内容不可用,共 755 s) |
| 2 读代码 | **0** / 9.7 tok/s(537 token,共 58 s) | **0** / 7.3 tok/s(752 token,共 105 s) |
| 3 写测试 | **0** / 14.1 tok/s(753 token,共 54 s) | **0** / 12.0 tok/s(882 token,共 75 s) |

下面三小节(测试 1–3)是 **A 组**(temperature 0.2,max_tokens 6000)的完整记录;**B 组**(默认设置)在它们之后。

#### A 组 · 测试 1:文本整理(得分 0)

输入(原样):

```text
下面是 changelog.d/README.md 规定的开发日志格式,以及本仓库 `git log --oneline -15 --stat` 的输出。
请按该格式,用中文为这 15 个提交写一条开发日志。任务编号和任务名请从提交信息里归纳;agent 名写「本地模型」。不要编造日志里没有的改动。

=== changelog.d/README.md ===
(此处为 changelog.d/README.md 全文)
=== git log --oneline -15 --stat ===
(此处为 `git log --oneline -15 --stat` 在 69b6617 上的完整输出,117 行)
```

输出:`content` 为空,没有给出任何日志。6000 个 token 全部花在思考上(约 2.2 万字符英文),并且在循环:长度超过 25 字符的 196 行里只有 60 行不重复,同一句话最多重复了 11 次。开头和结尾原样如下(中间约 2 万字符省略,完整输出在评测脚本的 `out-minicpm-1.json` 里):

```text
We are given a changelog.d/README.md and the output of git log --oneline -15 --stat.
 We need to write 15 development logs in the same format as the README. The task is to use agent name "本地模型".
 However, note that the provided data does not include any actual tasks or agents. It only shows a list of files and their changes.
 ……
 Let me look at the provided data again:
 It has 15 tasks, but they are from a different changelog.d. The tasks are:
 1. 新增 / 变更 / 修复 (agent 本地模型)
 2. 决策 (agent 本地模型)
 3. 待确认 (agent 本地模型)
 4. docs: 看板——010 待审查
 5. docs/tasks/README.md | 2 +-
 ……
```

评分理由:没有可用输出。思考过程中把格式模板里的三个字段名(新增 / 变更 / 修复、决策、待确认)当成了 3 个「任务」,又把 `--stat` 的文件行当成任务,属于误读输入;任务卡要求的「不编造」这一条在思考里就已经违反。

#### A 组 · 测试 2:读代码(得分 0)

输入(原样):

````text
下面是 TypeScript 函数 hitTree(含注释)。请回答:什么情况下炮弹会穿过树继续飞?请用中文,给出明确条件。

```ts
  /**
   * 炮弹 / 子弹打中树干。返回炮弹是否被挡下:
   * 主炮动能弹把树打断后继续飞;化学能弹在树上起爆;机枪子弹被挡下(细树打几发会断)。
   */
  hitTree(p: Plant, dirX: number, dirZ: number, caliber: number, chemical: boolean): { stopped: boolean; felled: boolean } {
    if (p.state !== 'ok') return { stopped: false, felled: false };
    if (caliber >= 20) {
      this.fellTree(p, dirX, dirZ);
      return { stopped: chemical, felled: true };
    }
    p.hp -= 1;
    if (p.hp <= 0 && p.radius < 0.2) {
      this.fellTree(p, dirX, dirZ);
      return { stopped: true, felled: true };
    }
    return { stopped: true, felled: false };
  }
```
````

输出(最终回答原样,思考过程略):

```text
炮弹穿过树继续飞的情况是:当炮弹被**化学能弹击中**(即 `chemical` 为 `true`)时,或者当炮弹的 **口径大于或等于 20 毫米** 时(即属于主炮动能弹)。此时,函数会打断树干并继续飞行;否则,如果子弹击中树干,则停止并炸毁。
```

标准答案:口径 ≥ 20 mm **且不是**化学能弹;或者树已经不是完好状态(`p.state !== 'ok'`)。

评分理由:把「化学能弹」当成会穿过的条件,与代码相反(`chemical` 为 true 时 `stopped: true`,是被挡下);漏了「树已倒 / 已毁」这一条。只有「口径 ≥ 20 mm」这一半是对的,而且读的人会被反向误导,所以给 0 而不是 1。

#### A 组 · 测试 3:写小测试(得分 0)

输入(原样):

````text
下面是 src/ui/Minimap.ts 里的 gridLabel 函数,以及它用到的常量。请用 Vitest 为它写 3 个边界测试,导入写 `import { gridLabel } from '../src/ui/Minimap';`。只输出一个完整的 TypeScript 代码块。

```ts
export const GRID = 10;

/** 世界坐标所在的格子,如 'C4'(字母 = 行,北边是 A;数字 = 列,西边是 1);超出地图的点算最近的边格 */
export function gridLabel(x: number, z: number, mapSize: number): string {
  const cell = mapSize / GRID;
  const half = mapSize / 2;
  const col = Math.min(GRID - 1, Math.max(0, Math.floor((x + half) / cell)));
  const row = Math.min(GRID - 1, Math.max(0, Math.floor((z + half) / cell)));
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}
```
````

输出(代码块原样,后面还有三条一句话的说明,略):

```ts
import { gridLabel } from '../src/ui/Minimap';

/**
 * 世界坐标所在的格子,如 'C4'(字母 = 行,北边是 A;数字 = 列,西边是 1);超出地图的点算最近的边格
 */
export function gridLabel(x: number, z: number, mapSize: number): string {
  const cell = mapSize / GRID;
  const half = mapSize / 2;
  const col = Math.min(GRID - 1, Math.max(0, Math.floor((x + half) / cell)));
  const row = Math.min(GRID - 1, Math.max(0, Math.floor((z + half) / cell)));
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

/**
 * 测试边界情况:超出地图范围时的处理
 */
export function testBoundaryOutOfRange() {
  const mapSize = 10; // GRID 是 10
  const x = -5, z = 20; // 超出地图范围
  console.log('x:', x);
  console.log('z:', z);
  console.log('mapSize:', mapSize);
  console.log('gridLabel(x, z, mapSize):', gridLabel(x, z, mapSize));
}

/**
 * 测试边界情况:mapSize 小于 GRID 时的情况
 */
export function testMapSizeSmallerThanGRID() {
  const mapSize = 5; // 小于 GRID (10)
  console.log('mapSize:', mapSize);
  console.log('gridLabel(x, z, mapSize):', gridLabel(0, 0, mapSize));
}

/**
 * 测试边界情况:计算 cell 时可能出现的错误(cell 为负数或大于 GRID-1)
 */
export function testCellCalculationError() {
  const mapSize = 10; // GRID 是 10
  console.log('mapSize:', mapSize);
  console.log('gridLabel(x, z, mapSize):', gridLabel(0, 0, mapSize));
}
```

运行:代码块原样存为 `tests/_local-model-scratch.test.ts`,执行 `npx vitest run tests/_local-model-scratch.test.ts`,结果:

```text
FAIL  tests/_local-model-scratch.test.ts
Error: No test suite found in file D:/Main/tests/_local-model-scratch.test.ts
Test Files  1 failed (1)   Tests  no tests
```

测试文件已删除,未提交。

评分理由:没有 `describe` / `it` / `expect`,不是 Vitest 测试,只有 `console.log`,没有任何断言;把函数本体又抄了一遍并重复导入;`mapSize = 5`「小于 GRID」的场景没有意义(`GRID` 是格数,不是尺寸)。

#### B 组(默认设置:temperature 0.8,max_tokens 16384)

输入与 A 组完全相同。负责人的 LM Studio 设置是:启用思考、temperature 0.8、不限思考长度、32K 上下文、Flash Attention 开、不量化 KV 缓存;A 组的脚本覆盖了 temperature 和长度上限,所以补测这一组。

**B 组 · 测试 1(得分 0)**:6036 token,没撞上限,自然结束。`content` 有 5033 字符,但不是开发日志:先把 README 和 `git log` 输出抄回来,再附上一行说明。抄的过程中还改动了原文。`content` 开头和结尾原样如下(中间抄回来的 `git log` 输出约 4000 字符省略):

```text
=== changelog.d/README.md ===
# changelog.d — 每个任务一条开发日志

多个 agent 并行时,不要同时改 Changelog.md。每个任务完成时,在本目录新建一个文件:

- 文件名:`010 -000 主界面与设置、植被、机枪、起火、HUD 重排`.md`
- 内容格式(和 Changelog.md 一致):
  ~~~markdown
### 000 主界面与设置、植被、机枪、起火、HUD 重排
- **新增 / 变更 / 修复**:……
- **决策**:……(一句话说明为什么这么选)
- **待确认**:……
~~~
每轮结束时,主程把本目录的条目汇总进 Changelog.md,再删掉已经汇总的文件。

=== git log --oneline -15 --stat ===

69b6617 docs: 看板——010 待审查
 ……(抄回来的 git log,省略)……

请注意: 任务编号和任务名请从提交信息里归纳;agent 名写「本地模型」。本仓库 `git log --oneline -15 --stat` 的输出。
```

评分理由:没有写出任何一条有内容的日志;唯一的「条目」是把格式模板里的占位符(`……`)原样留着。抄回来的 `git log` 里,提交 `c5ce125` 的信息被改成「数值查准时用 War Thunder 官方 Wiki」(原文是「数值查不准时用 War Thunder 官方 wiki;看板加 005」,意思反了,还丢了后半句),这正是任务卡要评判的「编造 / 篡改」。思考部分还把提交按顺序标成「000–006」号任务,与提交信息里的编号无关。

**B 组 · 测试 2(得分 0)**:752 token,`content` 原样:

```text
炮弹穿过树继续飞的情况是当它被**化学能弹在树上起爆**时。这包括两种情况:

1. **物理击中**:动能弹打中树干并“打出”(即树干被击穿),此时会触发 `fellTree` 处理并改变状态(可能让炮弹飞出)。
2. **起爆后未伤及树皮/根部**:化学能弹在树上起爆,但树干未受损,此时炮弹不会穿过树而继续飞,而是留在原地或其它地方。

代码中的逻辑是:
- 若 `caliber >= 20`,则触发物理击中的处理 (`fellTree`),并返回 `stopped: chemical, fell: true`(化学弹打穿)。
- 若 `hp <= 0 且半径 < 0.2`,则再次触发物理击中 (`fellTree`)。
- 若两者都满足,则直接返回 `stopped: true, fell: false`。

因此,穿透树继续飞的条件是:炮弹在树上发生**起爆**,这既可能因物理击穿而飞出,也可能仅因起爆未伤及树干而不飞。
```

评分理由:结论「化学能弹起爆才穿过」与代码相反,漏了「树已倒」;它自己复述的 `stopped: chemical` 就说明化学弹会被挡下,与结论矛盾。第三条「两者都满足时返回 `stopped: true, fell: false`」也不对:代码里是两个条件都不满足时才这样返回,而 `caliber >= 20` 已在前面直接返回。

**B 组 · 测试 3(得分 0)**:882 token,`content` 原样(只有这一个代码块):

```typescript
import { gridLabel } from '../src/ui/Minimap';
export const GRID = 10;

/** 世界坐标所在的格子,如 'C4'(字母 = 行,北边是 A;数字 = 列,西边是 1);超出地图的点算最近的边格 */
export function gridLabel(x: number, z: number, mapSize: number): string {
  const cell = mapSize / GRID;
  const half = mapSize / 2;
  const col = Math.min(GRID - 1, Math.max(0, Math.floor((x + half) / cell)));
  const row = Math.min(GRID - 1, Math.max(0, Math.floor((z + half) / cell)));
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}
```

运行结果:同 A 组,`No test suite found in file`(`Test Files 1 failed`,`Tests no tests`)。测试文件已删除,未提交。

评分理由:一个测试也没写。它在思考里纠结「地图是不是正方形」之类与任务无关的问题,最后只把函数抄了一遍。

#### 小结(仅 MiniCPM5 1B)

- 两组参数 × 三项测试,**共 6 次,全部 0 分**。低温看起来确实加重了测试 1 的循环(A 组思考里 196 个长行只有 60 个不重复;B 组 211 行里 203 行不重复),但换成默认的 temperature 0.8 并放宽长度上限后,得到的仍是抄回输入并改动原文的输出,不是日志。所以循环只是低温的副作用,0 分的根本原因是模型能力不够,不是设置问题。
- 速度:约 7–14 tok/s(CPU),交互够用;但带思考,一次回答常要 1–13 分钟。
- 不适合交给它:总结 git 历史、解释带分支的代码逻辑、写有断言的测试。三类任务都没有发现它能胜任的情况。
- 局限:每组每项只跑一次;但 6 次都 0 分,且失败方式各不相同(循环、反向、没写断言),样本虽少,结论方向不太可能被更多重复推翻。

## 待测

- [ ] Gemma 4 E4B(Q8,约 9 GB,多模态)
- [ ] Qwen3.5 9B Uncensored(Q8,约 10.4 GB,多模态)
- [ ] Qwythos 9B(Q8,约 10.4 GB,多模态)
- [ ] 其他侧载模型

复测方法:同一份输入(固定在 69b6617),同样的参数。注意带思考的模型要给足 max_tokens,否则像测试 1 那样得不到正式回答——这一点也应在对比时单独说明。

## 总结论

待所有模型测完后填写。
