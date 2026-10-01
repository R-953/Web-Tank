# B1:穿深随距离变化的解析计算(模型测试题)

- 规模:S(一个源文件 + 一个测试文件)

## 目标

新增一个纯函数,不跑物理引擎,直接用本项目的弹道模型算出炮弹飞到各个距离时的速度、飞行时间和穿深。以后 HUD 的射表、验证报告的表格都可以用它。

## 背景与参考

- 弹道模型:飞行中只有空气阻力,dv/dt = −k·|v|·v,k 由 `src/data/shells.ts` 的 `dragK()` 给出;穿深随速度变化见 `src/game/Damage.ts` 的 `shellPenetration()`(动能弹穿深 ∝ 速度^1.43,化学能弹与速度无关)。
- 游戏里实际的飞行由 `src/game/Projectile.ts` 逐帧积分;`tests/sim.ts` 的 `flyShell()` 是测试用的逐帧模拟,可以用来对照。
- 忽略重力(水平射击、近距离时下坠对速度的影响可以忽略)。

## 允许修改的文件

- 新增:`src/data/penetration.ts`、`tests/penetration.test.ts`

## 接口(定死,不要改)

```ts
export interface RangeSample {
  /** 距离,m */
  range: number;
  /** 飞到这个距离时的速度,m/s */
  velocity: number;
  /** 飞到这个距离用的时间,s */
  time: number;
  /** 这个距离上的穿深,mm */
  penetration: number;
}

/** 按 ranges 给出的顺序返回每个距离上的样本(ranges 不一定有序,可以含 0) */
export function penetrationTable(shell: ShellSpec, ranges: readonly number[]): RangeSample[];
```

## 验收标准

- [ ] `npm run lint`、`npm test`、`npm run build` 全部通过
- [ ] 结果和 `flyShell()` 的逐帧模拟一致(穿深、速度、时间的相对误差都在 2% 以内),现有全部车辆的全部炮弹都适用
- [ ] 新增测试至少覆盖:一种动能弹和资料表对照、一种化学能弹、距离 0、乱序输入
- [ ] 代码注释用简体中文,不用 `any`

## 不做

- 不改 `Projectile.ts`、`Damage.ts`、`shells.ts`
