# 078-xray-ground-contrast:残骸 / X 光外壳的颜色随脚下地面的颜色调整

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/078-xray-ground-contrast`
- 规模:S–M
- 主程授权的例外(负责人 10-03「主程只审查」):本卡可以改 `src/main.ts` 里**创建 / 调用 `WorldXray`、`WorldReplay` 的几处**,把「脚下地面颜色」传进去;别的地方不要动
- 077(HUD)、079(文案)同时在改别的文件,不要碰 `src/ui/Hud.ts`、`src/ui/killcamOverlay.ts`

## 目标

负责人 10-03 的意见:**残骸颜色应该根据环境颜色适当调节,比如在雪地上被击毁就不用增强对比度**。

现状:`WorldXray`(O 键 X 光、死亡回放里的残骸)把外壳颜色往中性灰 `0x8a9399` 混、不透明度 0.12、白色轮廓线(`xrayShellStyle(k)`);死亡回放接触前残骸是 `Vehicle.becomeWreck` 压暗后的颜色(原色 × 0.25)。在深色 / 绿色地面上这样很清楚,但在雪地这种**很亮**的背景上,灰壳和白轮廓线会被「吃掉」,而压暗的残骸本来就够显眼,没必要再加强。

要做:按**脚下地面的亮度**调整 X 光外壳的样式——

- 新增纯函数(放进 `src/ui/WorldXray.ts`,导出并测试)`xrayContrastFor(groundLuminance: number)`:输入 0..1 的地面相对亮度(0.2126 R + 0.7152 G + 0.0722 B,sRGB 分量 0..1),输出 `{ grayHex, shellOpacity, edgeHex, edgeOpacity }` 之类的样式参数:
  - 地面暗 / 中等(草地、泥地、沙地等,亮度 < 约 0.55):保持现在的样子(灰壳 `0x8a9399`、白轮廓线),必要时稍微提亮;
  - 地面很亮(雪地,亮度 ≥ 约 0.75):**不加强对比度**——外壳的灰色压暗一点、轮廓线改成深灰,免得白对白看不见;
  - 中间段平滑过渡(线性插值),不要在阈值处跳变。
- `xrayShellStyle(k)` 在已有的 `k`(0..1 淡入系数)基础上带上这组参数(新增可选的第二个参数 `contrast?`,缺省 = 现在的样式,**旧测试不改**);`WorldXray` 新增可选的构造参数 / `setGroundLuminance(l)` 来设置它。
- `WorldReplay.play` 新增可选参数 `opts?: { groundLuminance?: number }`,转给它内部的 `WorldXray`;死亡回放接触前的残骸亮度也按同样的亮度判断:亮地面上维持压暗的颜色,暗地面上稍微提亮(例如原色 × 0.25 → × 0.45;用一个有注释的常量,放在 `WorldReplay` 里按需要给 `becomeWreck` 之后的材质做一次提亮克隆——**不要改 `Vehicle.ts`**)。
- **取地面颜色**:`main.ts` 里用 `game.map.surfaceAt(x, z)`(`SurfaceType`)查玩家脚下的地面类型,再映射到一个代表颜色的亮度。先看地图 / 地形渲染里各类地表的显示颜色放在哪(搜 `surface`、`terrain`、`snow`、`grass`),**复用已有的颜色表**;没有现成的就在 `src/game/` 之外新建一个小表 `SURFACE_LUMINANCE`(`Record<SurfaceType, number>`,按肉眼看到的地表颜色估算,注释里写「估算」和各值的依据),并加测试保证 `SurfaceType` 的每个取值都有值。
- `main.ts`:O 键 X 光(`worldXray`)每次 `enable` 前、死亡回放 `worldReplay.play` 时,取玩家脚下的亮度传进去(O 键开着期间走到别的地表,下一帧也要更新)。

## 背景与参考

- `src/ui/WorldXray.ts`(`xrayShellStyle`、`enable`、`setFade`)、`src/ui/WorldReplay.ts`(`play`)、`src/game/Map.ts`(`surfaceAt`)、`src/game/Vehicle.ts`(`becomeWreck`)、`src/main.ts` 里 `worldXray` / `worldReplay` 的使用处(搜这两个名字)。
- 雪地是 `SurfaceType` 里的 `snow`(第十轮 063 加的),雪地森林地图上能测。

## 允许修改的文件

- 修改:`src/ui/WorldXray.ts`、`src/ui/WorldReplay.ts`、`src/main.ts`(见上)、`tests/world-xray.test.ts`、`tests/world-replay.test.ts`、本卡「结果」一节
- 新增:`tests/xray-contrast.test.ts`、`changelog.d/<日期>-078-xray-ground-contrast.md`;如需地表亮度表,新增 `src/ui/surfaceLuminance.ts`
- 不要改 `Vehicle.ts`、`Game.ts`、`Hud.ts`、`killcamOverlay.ts`

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过,既有测试不改
- [ ] 测试:`xrayContrastFor` 的三段(暗 / 过渡 / 亮)和连续性;缺省参数下 `xrayShellStyle` 与原来一致;每个 `SurfaceType` 都有亮度
- [ ] 浏览器里看(雪地森林地图 + 草地地图各一次,按 O 开 X 光、`__debug.game()` 把玩家打死看死亡回放),在回报里写看到了什么:雪地上外壳 / 轮廓线能看清且没有刺眼的白;草地上和现在一样

## 不做

- 不改回放的相机 / 弹道 / 文字;不新增地表类型。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
