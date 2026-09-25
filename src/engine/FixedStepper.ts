/**
 * 固定步长推进器:把「每帧真实耗时」换算成若干个固定时长的物理步,
 * 让游戏速度与显示器刷新率无关(60Hz / 144Hz 下结果一致)。
 */
export class FixedStepper {
  private accumulator = 0;

  constructor(
    readonly stepSeconds = 1 / 60,
    /** 单帧最多补几步,防止卡顿后「死亡螺旋」 */
    readonly maxStepsPerFrame = 5,
  ) {}

  /** 推进 dt 秒真实时间,对每个固定步调用一次 fn,返回执行的步数 */
  advance(dt: number, fn: (step: number) => void): number {
    this.accumulator += Math.max(0, dt);
    let steps = 0;
    // 留一点容差,避免 1/144 这类浮点累加差一丝而少走一步
    const eps = 1e-9;
    while (this.accumulator + eps >= this.stepSeconds && steps < this.maxStepsPerFrame) {
      fn(this.stepSeconds);
      this.accumulator -= this.stepSeconds;
      steps++;
    }
    if (this.accumulator < 0) this.accumulator = 0;
    if (steps === this.maxStepsPerFrame && this.accumulator >= this.stepSeconds) {
      // 积压太多:丢弃,宁可慢一点也不要越补越卡
      this.accumulator = 0;
    }
    return steps;
  }

  /** 距离下一步的进度 0..1,用于渲染插值 */
  get alpha(): number {
    return Math.min(1, this.accumulator / this.stepSeconds);
  }

  reset(): void {
    this.accumulator = 0;
  }
}
