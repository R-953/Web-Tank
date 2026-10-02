export interface NetStats {
  pingMs: number;
  lossPct: number;
}

// 单机没有网络;将来有联机时换成真实统计。
export const localNetStats: NetStats = { pingMs: 0, lossPct: 0 };

interface FpsSample {
  at: number;
  intervalMs: number;
}

/** 按最近约 0.5 秒的帧间隔计算平均帧率。 */
export class FpsMeter {
  private previousAt: number | null = null;
  private readonly samples: FpsSample[] = [];
  private currentFps = 0;

  get fps(): number {
    return this.currentFps;
  }

  tick(nowMs: number): void {
    if (!Number.isFinite(nowMs)) return;
    if (this.previousAt !== null && nowMs > this.previousAt) {
      this.samples.push({ at: nowMs, intervalMs: nowMs - this.previousAt });
    }
    this.previousAt = nowMs;

    const cutoff = nowMs - 500;
    while (this.samples.length > 0 && this.samples[0].at < cutoff) this.samples.shift();
    const totalInterval = this.samples.reduce((total, sample) => total + sample.intervalMs, 0);
    this.currentFps = totalInterval > 0 ? Math.round((this.samples.length * 1000) / totalInterval) : 0;
  }
}

export function newMatchId(rng?: () => number): string {
  if (rng) {
    return Array.from({ length: 15 }, () => (Math.floor(rng() * 16) & 0xf).toString(16)).join('');
  }

  const bytes = new Uint8Array(8);
  try {
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 15);
  } catch {
    return Array.from({ length: 15 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

export interface StatsFormat {
  fps: number;
  pingMs: number;
  lossPct: number;
  matchId: string;
}

export function formatStats({ fps, pingMs, lossPct, matchId }: StatsFormat): string {
  return `FPS: ${Math.round(fps)}  Ping: ${Math.round(pingMs)}  PL: ${Math.round(lossPct)}%  ${matchId}`;
}

export class StatsBar {
  private readonly element: HTMLDivElement;
  private readonly fpsMeter = new FpsMeter();
  private matchId = newMatchId();
  private lastTextUpdate: number | null = null;

  constructor(parent: HTMLElement, private readonly net: NetStats = localNetStats) {
    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      position: 'fixed',
      left: '0',
      bottom: '0',
      height: '12px',
      lineHeight: '12px',
      fontSize: '10px',
      color: 'rgba(220, 220, 220, 0.72)',
      fontFamily: 'monospace',
      fontVariantNumeric: 'tabular-nums',
      textShadow: '0 1px 1px rgba(0, 0, 0, 0.9)',
      pointerEvents: 'none',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      zIndex: '8',
    });
    this.element.textContent = formatStats({ fps: 0, ...this.net, matchId: this.matchId });
    parent.appendChild(this.element);
    this.setVisible(false);
  }

  update(nowMs: number): void {
    this.fpsMeter.tick(nowMs);
    if (this.lastTextUpdate === null || nowMs - this.lastTextUpdate >= 500) {
      this.element.textContent = formatStats({ fps: this.fpsMeter.fps, ...this.net, matchId: this.matchId });
      this.lastTextUpdate = nowMs;
    }
  }

  setMatchId(id: string): void {
    this.matchId = id;
    this.element.textContent = formatStats({ fps: this.fpsMeter.fps, ...this.net, matchId: this.matchId });
  }

  setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'block' : 'none';
  }
}
