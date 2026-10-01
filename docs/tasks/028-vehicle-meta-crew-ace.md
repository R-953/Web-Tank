# 028-vehicle-meta-crew-ace:载具的国家 / 类别 / 年份 / 车族,以及王牌乘员数值

- 负责:Antigravity(3.8 Flash High;`src/data/types.ts` 本归主程维护,本卡授权只加下面的可选字段)
- 状态:进行中
- 分支:`task/028-vehicle-meta-crew-ace`
- 规模:S–M(数据 + 调研)

## 目标

科技树和成员组(设计稿 [docs/design/tech-tree-and-crew.md](../design/tech-tree-and-crew.md))需要知道每辆车属于哪个国家、哪一类、哪一年服役、哪个车族,以及车组满级(War Thunder「王牌乘员」)时的装填和转动速度。本卡只补数据,不做界面和逻辑。

## 允许修改的文件

- 修改:`src/data/types.ts`(**只加**下面「接口」里的类型和 `VehicleSpec` 的可选字段,不动已有字段)
- 修改:`src/data/vehicles.ts`(给 8 辆车填新字段,注释写出处)
- 修改:`docs/physics-validation.md`(加一节列出王牌乘员数值和出处)
- 新增:`tests/vehicle-meta.test.ts`
- 新增:`changelog.d/2026-10-02-028-vehicle-meta-crew-ace.md`

## 接口(定死,不要改)

```ts
/** 国家 */
export type Nation = 'germany' | 'ussr' | 'usa';
/** 载具类别(科技树里的一条线) */
export type VehicleClass = 'light' | 'medium' | 'heavy' | 'td';
/** 车组满级(War Thunder「王牌乘员」)时的数值;单位同 VehicleSpec / WeaponSpec 里的对应字段 */
export interface CrewAceSpec {
  /** 主炮装填时间,秒 */
  reloadTime: number;
  /** 炮塔(固定战斗室为火炮)水平转动速度,度/秒 */
  turretRotationSpeed: number;
  /** 高低机速度,度/秒 */
  elevationSpeed: number;
}

// VehicleSpec 新增(都可选)
nation?: Nation;
vehicleClass?: VehicleClass;
/** 服役年份(科技树横轴) */
serviceYear?: number;
/** 车族 id:同车族的车在科技树里叠成一组,车组换车保留熟练度 */
family?: string;
crewAce?: CrewAceSpec;
```

## 要填的数据

| 车 | nation | vehicleClass | family |
|---|---|---|---|
| 虎式 E 型 `tiger_i` | germany | heavy | `tiger` |
| 虎王 `tiger_ii` | germany | heavy | `tiger_ii` |
| T-34-85 `t34_85` | ussr | medium | `t34` |
| SU-100 `su_100` | ussr | td | `su100` |
| ISU-122 `isu_122` | ussr | td | `isu` |
| M4A3(76)W `m4a3_76w` | usa | medium | `m4a3` |
| M4A3E8 `m4a3e8` | usa | medium | `m4a3` |
| M4A3E2 `m4a3e2` | usa | medium | `m4a3` |

- `serviceYear`:实车**投入使用**的年份,按公开资料(Wikipedia 等)填,注释写出处。
- `crewAce`:按 [War Thunder wiki](https://wiki.warthunder.com/) 各车页面的「王牌乘员」(Aced crew)数值:
  - 先比较 WT 的「新手乘员」值和本仓库现有值(现有值的注释里大多写了「新手乘员」)。
  - **一致时**:直接填 WT 王牌值,注明「War Thunder 值」。
  - **不一致时**(例如虎式、T-34-85 的装填取自史料射速):**现有值保持不变**,王牌值按 WT 的比例折算:王牌值 = 现有值 × (WT 王牌 / WT 新手),注明「按 War Thunder 新手→王牌比例折算」。
  - WT 页面没有高低机的乘员数值时,按方向机的同一比例折算,标明「估算」并写出方法。
  - 机枪不填。
- 已有字段一律不改。

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 新测试 `tests/vehicle-meta.test.ts`:8 辆车都填了 5 个新字段;王牌装填 < 现有装填、王牌转速 ≥ 现有转速;三辆谢尔曼 `family` 相同,其余各不相同
- [ ] `docs/physics-validation.md` 新一节列出每辆车的新手 / 王牌数值、服役年份和出处
- [ ] 每个数值都有出处或折算说明

## 不做

- 科技树、编组、成员组的界面和逻辑(029–031 和以后的卡)
- 改已有字段的数值

## 结果(完成后由执行者填写)

- 改动文件:
- 命令与结果:
- 偏差 / 未完成 / 待决定:
