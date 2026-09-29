/** 视角(与 OrbitCamera 的 yaw / pitch 同义,弧度) */
export interface ViewAngles {
  yaw: number;
  pitch: number;
}

/**
 * 自由视角(按住):按下的那一刻记住视角,按住期间视角随意转、瞄准点冻结不变
 * (炮塔 / 固定战斗室的车体继续对准按下时的位置);松开后视角回到按下前的方向。
 */
export class FreeLook {
  private saved: ViewAngles | null = null;

  get active(): boolean {
    return this.saved !== null;
  }

  /**
   * 每帧在转动视角之前调用。held = 自由视角键是否按住(且当前允许自由视角)。
   * 松开时把 view 的角度改回按下前的值。返回本帧是否处于自由视角。
   */
  update(held: boolean, view: ViewAngles): boolean {
    if (held && !this.saved) {
      this.saved = { yaw: view.yaw, pitch: view.pitch };
    } else if (!held && this.saved) {
      view.yaw = this.saved.yaw;
      view.pitch = this.saved.pitch;
      this.saved = null;
    }
    return this.saved !== null;
  }

  /** 开局 / 重新开始时清掉(不恢复视角) */
  reset(): void {
    this.saved = null;
  }
}
