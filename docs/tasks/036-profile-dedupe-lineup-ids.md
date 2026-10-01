# 036-profile-dedupe-lineup-ids:存档清洗时给重复的编组 id 去重

- 负责:GitHub Copilot CLI(主程审查)
- 状态:已合并
- 分支:`task/036-profile-dedupe-lineup-ids`
- 规模:S

## 目标

030 审查时留下的小问题:`src/settings/Profile.ts` 的 `sanitizeProfile` 清洗编组时,如果存档里同一国家有两个编组 id 相同(只有手改存档才会出现),不会去重,之后按 id 找编组、切换、删除都会找错。

## 允许修改的文件

- 修改:`src/settings/Profile.ts`(只改 `sanitizeProfile` 里清洗编组 id 的那段)
- 修改:`tests/profile.test.ts`(只**加**用例)
- 新增:`changelog.d/<日期>-036-profile-dedupe-lineup-ids.md`

## 要求

- 同一国家里,后出现的重复 id 改成一个没用过的 `lineup-N`(N 从 1 往上找第一个空的),名称不变。
- `activeLineup` 原来指向重复 id 时,保持指向**第一个**用这个 id 的编组。
- 其他行为不变。

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 新测试:两个编组 id 相同 → 清洗后 id 各不相同、名称和格子不变、`activeLineup` 指向第一个;三个相同也能处理

## 不做

- 其他清洗规则

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
