# 052-internals-view:战斗中按 O 显示当前车辆的内构

- 负责:Antigravity(3.8 Flash High)
- 状态:待领取
- 分支:`task/052-internals-view`
- 规模:M
- 和 047、048、049、050、051 并行;改的文件不重叠

## 目标

负责人 10-02 要求:战斗中按 O 显示**自己这辆车**的内部结构(模块 + 乘员站位 + 实时血量颜色),再按 O 关闭。样子参考现有的击毁回放 X 光画面,但这是常驻的、实时的、不播放动画。

## 背景与参考

- `src/ui/KillCam.ts`:X 光画面的画法(车体半透明外壳 `GHOST` + 轮廓 `EDGE`、模块盒子、乘员、`healthColor(ratio)` 血量配色、`applyGunPose` 摆炮塔炮管)。**只读参考**,可以 `import { healthColor }`,不要改这个文件(第十轮后面有一张卡要重写它)。
- 实时数据:`vehicle.damage.modules`(`id`、`type`、`spec.part`、`spec.center`、`spec.size`、`hp`、`maxHp`)和 `vehicle.damage.crew`(`index`、`homeRole`、`box.part`、`box.center`、`alive`、`hp`);`vehicle.turretYaw`、`vehicle.gunPitch`。`Game.healthSnapshot` / 命中时的 `layout` 构造(`src/game/Game.ts` 540–555 行)是现成的写法,可以照着写成纯函数。
- 操作表:`src/data/controls.ts`。
- **`main.ts`、`Vehicle.ts`、`Game.ts` 归主程,不要改。**主程合并后负责在 `main.ts` 里创建、每帧更新和渲染。

## 要做的事

1. 新增操作 `internals`:名称「显示内构」,分组「车辆」,默认 `['KeyO', null]`,提示「再按一次关闭」。`ActionId` 加这一项(负责人已同意)。老存档里没有这一项时取默认键(`sanitize` 已经会补默认值;确认 `KeyO` 没有被别的操作占用)。
2. 新增 `src/game/internalsSnapshot.ts`(纯函数,不依赖 DOM / Three):
   ```ts
   export interface InternalsSnapshot {
     spec: VehicleSpec;
     turretYaw: number;
     gunPitch: number;
     modules: { id: string; type: ModuleType; part: AttachPart; center: Vec3; size: Vec3; ratio: number }[]; // ratio = hp / maxHp,0..1
     crew: { id: string; role: CrewRole; part: 'hull' | 'turret'; center: Vec3; ratio: number; alive: boolean }[]; // ratio = hp / 100;死亡 0
   }
   export function internalsSnapshot(v: Pick<Vehicle, 'spec' | 'turretYaw' | 'gunPitch' | 'damage'>): InternalsSnapshot;
   ```
3. 新增 `src/ui/InternalsView.ts`:
   ```ts
   export class InternalsView {
     constructor(parent: HTMLElement);
     setVisible(v: boolean): void;
     get visible(): boolean;
     update(s: InternalsSnapshot): void;       // 每帧调用:更新炮塔 / 炮管姿态和各模块、乘员的颜色(模型按 spec.id 缓存,换车才重建)
     render(renderer: THREE.WebGLRenderer): void; // 在主渲染器上开一个视口画出来(同 KillCam.render 的做法,画完恢复视口和剪裁)
     dispose(): void;
   }
   ```
   - 位置:屏幕**左侧中部**的一个小窗(宽 440、高 270,距左边 16 px,垂直居中),带细边框和标题「车辆内构 · <车名>」,避开右上角的击毁回放、左下角的 HUD 示意图。
   - 画面:车体半透明外壳 + 轮廓;模块用盒子,乘员用小球 + 躯干盒,颜色按 `healthColor(ratio)`;乘员旁标岗位简称(车长 / 炮手 / 装填手 / 驾驶员 / 无线电员);相机固定在车体左前方 3/4 俯视,随车体坐标系(不随炮塔转),炮塔和炮管按实时姿态摆放;模块种类用不同的轮廓或标签区分(弹药架、发动机、变速箱、油箱、炮闩、方向机、高低机),不用一堆文字,图例放在窗口底部一行小字。
   - 没有 WebGL(jsdom)时不要抛错。

## 允许修改的文件

- 修改:`src/data/controls.ts`
- 新增:`src/game/internalsSnapshot.ts`、`src/ui/InternalsView.ts`、`tests/internals-snapshot.test.ts`、`tests/internals-view.test.ts`、`changelog.d/<日期>-052-internals-view.md`
- 修改测试:`tests/controls-migration.test.ts` / `tests/settings.test.ts` 里涉及操作列表的断言(只增不删)

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 测试:`internalsSnapshot`(模块 / 乘员数量与 `ratio`;乘员死亡时 `ratio` 为 0、`alive` 为 false;换位后的岗位用 `homeRole` 还是当前岗位——用**当前座位的岗位**,和 `damage.crew` 的字段为准,在结果里说明取的哪个);`InternalsView` 的显示 / 隐藏、`update` 不抛错、换车时重建;`internals` 操作的默认键和老存档
- [ ] 主程会在浏览器里看:按 O 出现、再按关闭、被打坏的模块变色

## 不做

- 命中回放的重做(另一张卡);`main.ts` 接线;不在窗口里做交互(不能点、不能拖)。

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
