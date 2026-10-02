# 054-modifications-data:改装的数据、套用逻辑和存档

- 负责:Antigravity(3.8 Flash High)
- 状态:已合并(第十轮)
- 分支:`task/054-modifications-data`
- 规模:M
- 和 055–063 并行;055 的界面按本卡的接口写,改的文件不重叠

## 目标

负责人 10-02 要求右键菜单里的「改装」有对应界面(参考 War Thunder:机动 / 防护 / 火力三栏,每栏分 I–IV 级),并且**少量改装要真实生效**。已定的范围:不做研发点数和价格,勾选即时生效、免费(和之前定的「不做 WT 的价格」一致)。本卡做数据、纯逻辑和存档,界面在 055。

## 背景与参考

- 接口:主程已放 `src/data/modifications.ts`(类型 + 四个占位函数),**类型和函数签名不能改**,你来实现函数体和数据。
- 套用的做法参考 `applyCrewSkill`(`src/game/crew/progress.ts`):纯函数,返回新 `VehicleSpec`,不改入参。
- 能接到现有字段上的效果只有 5 种(见 `ModEffect`):`turretRotationSpeed`、`elevationSpeed`(= `turret.elevationSpeed`)、`turnRate`(= `hull.turnRate`)、`acceleration`(= `hull.acceleration`)、`maxSpeed`。其余改装(维修备件、灭火器、乘员补充等)`effects` 留空数组,界面会标「效果暂未接入」。
- 数值规则见 AGENTS.md:有公开出处就写出处;查不到按 War Thunder wiki 的设定并注明「War Thunder 值」;都没有就**估算**,在 `source` 里写「估算:……(方法)」。agent 没有联网,没有把握的数值一律走「估算」并说明方法,不要编出处。

## 要做的事

1. **数据**(`modifications.ts`):按车分类给出改装列表,`modificationsFor(spec)` 按 `spec.nation` / `spec.vehicleClass` 返回(三个国家共用一套通用列表也行,但要体现类别差异:坦克歼击车 / 突击炮没有「炮塔方向机」,它们的 `turret.traverse` 有值)。每辆车至少:
   - 机动:履带(I)→ 悬挂(II,需履带)→ 传动(III,需悬挂)→ 发动机(IV,需传动),效果挂到 `turnRate` / `acceleration` / `maxSpeed`(幅度估算,每级一档,发动机最高 +5% 速度)。
   - 防护:备件(I)、灭火器(II)、乘员补充(III),`effects: []`。
   - 火力:水平驱动(I,`turretRotationSpeed`)、垂直驱动(II,`elevationSpeed`,需水平驱动)、射击调整(III,`effects: []`)。
   - 幅度统一用保守档:每级 +4% / +6% / +8% / +10% 这一量级,写进 `source` 的估算说明里;**同一栏全部启用后的总提升不超过 +25%**。
2. **逻辑**(`toggleModification` 的占位导出已经在文件里,签名不能改):
   - `applyModifications(spec, enabled)`:按 `effects` 改 spec 的对应字段,多个同类效果相乘;忽略不属于这辆车的 id 和缺前置的 id;`enabled` 为空或没有可用的就原样返回(可以返回原对象)。不改入参,不改 `crewAce` 等其他字段。
   - `sanitizeModifications(spec, enabled)`:去掉不适用 / 缺前置的 id,去重,保持列表里的顺序;关闭某个改装时,依赖它的高级改装一起去掉。
   - `toggleModification(spec, enabled, id): string[]`:启用时要求前置已启用(否则原样返回);关闭时连带关闭依赖它的改装。
3. **存档**:新增 `src/settings/ModificationStore.ts`:`ModificationStore`(`localStorage` 键 `webtank.mods.v1`,`{ [vehicleId]: string[] }`),`get(vehicleId)`、`set(vehicleId, ids)`、`subscribe(fn)`;读到坏数据回到空,存储不可用时不抛错(参考 `SettingsStore` 的写法)。不改 `Profile.ts`。
4. 测试:每个效果的数值、同类相乘、前置 / 连带关闭、总提升不超过 +25%、坦克歼击车没有炮塔方向机、不改入参、存档往返和坏数据。

## 允许修改的文件

- 修改:`src/data/modifications.ts`
- 新增:`src/settings/ModificationStore.ts`、`tests/modifications.test.ts`、`tests/modification-store.test.ts`、`changelog.d/<日期>-054-modifications-data.md`

## 验收标准

- [x] `npm run lint`、`npm test`、`npm run build` 全部通过
- [x] 上面第 4 条的测试都有
- [x] 每条改装的 `source` 都不是空的;用了估算的写清方法

## 不做

- 界面(055);`main.ts` 接线(主程做:开局时 `applyModifications` 套到玩家车上);不做研发点数、价格、研发进度。

## 结果(完成后由执行者填写)

- 改动文件:
  - 修改: `src/data/modifications.ts`、`docs/tasks/054-modifications-data.md`
  - 新增: `src/settings/ModificationStore.ts`、`tests/modifications.test.ts`、`tests/modification-store.test.ts`、`changelog.d/2026-10-02-054-modifications-data.md`
- 命令与结果:
  - `npm run lint`: 通过 (tsc --noEmit 无错误)
  - `npm test`: 通过 (62 个测试文件，623 个测试全部通过)
  - `npm run build`: 通过 (tsc && vite build 成功输出生产构建产物)
- 偏差 / 未完成 / 待决定: 无

### 主程审查

`isCasemate` 原来在 modifications.ts 里重复实现了一份(还多判了 `vehicleClass === 'td'`),改用项目已有的 `game/casemate`。其余数值和规则按卡片通过。
