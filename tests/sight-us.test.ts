import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { VEHICLES, M4A3_76W, M4A3E8, M4A3E2, TIGER_I, TIGER_II, T34_85, SU_100, ISU_122 } from '../src/data/vehicles';
import { US_RETICLE_MARKS, SightOverlay } from '../src/ui/SightOverlay';
import { superelevation } from '../src/game/Ballistics';
import { SIGHT_FOV_AT_1X } from '../src/engine/OrbitCamera';

const STRICH = (2 * Math.PI) / 6400;

beforeAll(async () => {
  await RAPIER.init();
});

describe('美式瞄准镜分划 (US Reticle) 车辆配置', () => {
  it('三辆谢尔曼开镜使用美式分划 (reticle: us)', () => {
    expect(M4A3_76W.sight.reticle).toBe('us');
    expect(M4A3E8.sight.reticle).toBe('us');
    expect(M4A3E2.sight.reticle).toBe('us');

    expect(VEHICLES.m4a3_76w.sight.reticle).toBe('us');
    expect(VEHICLES.m4a3e8.sight.reticle).toBe('us');
    expect(VEHICLES.m4a3e2.sight.reticle).toBe('us');
  });

  it('三辆谢尔曼具有双倍率 [4.3, 5]', () => {
    expect(M4A3_76W.sight.magnifications).toEqual([4.3, 5]);
    expect(M4A3E8.sight.magnifications).toEqual([4.3, 5]);
    expect(M4A3E2.sight.magnifications).toEqual([4.3, 5]);
  });

  it('其他国家车辆分划保持不变', () => {
    expect(TIGER_I.sight.reticle).toBe('german');
    expect(TIGER_II.sight.reticle).toBe('german');
    expect(T34_85.sight.reticle).toBe('soviet');
    expect(SU_100.sight.reticle).toBe('soviet');
    expect(ISU_122.sight.reticle).toBe('soviet');
  });
});

describe('美式分划表尺刻度与弹道拟合', () => {
  const m62 = M4A3_76W.weapons[0].ammo[0]; // 76 mm M62 APCBC-HE (792 m/s)

  it('分划下坠刻度单调递增，覆盖 200 m 至 2800 m', () => {
    expect(US_RETICLE_MARKS.length).toBeGreaterThanOrEqual(10);
    expect(US_RETICLE_MARKS[0].range).toBe(200);
    expect(US_RETICLE_MARKS[US_RETICLE_MARKS.length - 1].range).toBe(2800);

    for (let i = 1; i < US_RETICLE_MARKS.length; i++) {
      expect(US_RETICLE_MARKS[i].range).toBeGreaterThan(US_RETICLE_MARKS[i - 1].range);
      expect(US_RETICLE_MARKS[i].dropMil).toBeGreaterThan(US_RETICLE_MARKS[i - 1].dropMil);
    }
  });

  it('主刻度线标注百米数字 (4, 8, 12, 16, 20, 24, 28)', () => {
    const labeledMarks = US_RETICLE_MARKS.filter((m) => m.label !== undefined);
    expect(labeledMarks.map((m) => m.label)).toEqual(['4', '8', '12', '16', '20', '24', '28']);
    expect(labeledMarks.map((m) => m.range)).toEqual([400, 800, 1200, 1600, 2000, 2400, 2800]);
  });

  it('分划落差密位与 76 mm M62 弹道射表精确吻合 (误差 ≤ 0.1 密位)', () => {
    for (const m of US_RETICLE_MARKS) {
      const angleRad = superelevation(m62, m.range);
      const angleMil = angleRad / STRICH;
      expect(Math.abs(m.dropMil - angleMil)).toBeLessThanOrEqual(0.1);
    }
  });
});

describe('美式分划倍率与表尺缩放', () => {
  it('5× 倍率下的像素密位比 (px/mil) 高于 4.3× 倍率', () => {
    const h = 1080;
    const fov43 = SIGHT_FOV_AT_1X / 4.3;
    const fov50 = SIGHT_FOV_AT_1X / 5.0;

    const pxPerRad43 = h / 2 / Math.tan(((fov43 / 2) * Math.PI) / 180);
    const pxPerRad50 = h / 2 / Math.tan(((fov50 / 2) * Math.PI) / 180);

    const mil43 = pxPerRad43 * STRICH;
    const mil50 = pxPerRad50 * STRICH;

    expect(mil50).toBeGreaterThan(mil43);
    // 倍率比 5 / 4.3 ≈ 1.163
    expect(mil50 / mil43).toBeCloseTo(5.0 / 4.3, 2);
  });

  it('SightOverlay 在美式分划下正常执行 draw, 支持切换倍率和表尺', () => {
    // 为 jsdom 补充 canvas 2d mock 上下文
    const dummyCtx = {
      setTransform: () => {},
      clearRect: () => {},
      beginPath: () => {},
      rect: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      save: () => {},
      restore: () => {},
      clip: () => {},
      fillText: () => {},
      createRadialGradient: () => ({
        addColorStop: () => {},
      }),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
    };

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() => dummyCtx) as unknown as typeof origGetContext;

    try {
      const overlay = new SightOverlay(document.body);

      // 4.3×, 0 m 表尺
      expect(() => {
        overlay.draw({
          active: true,
          fovDeg: SIGHT_FOV_AT_1X / 4.3,
          magnification: 4.3,
          range: 0,
          reticle: 'us',
        });
      }).not.toThrow();

      // 5.0×, 800 m 表尺
      expect(() => {
        overlay.draw({
          active: true,
          fovDeg: SIGHT_FOV_AT_1X / 5.0,
          magnification: 5.0,
          range: 800,
          reticle: 'us',
        });
      }).not.toThrow();

      // 5.0×, 1600 m 表尺带 cutout
      expect(() => {
        overlay.draw({
          active: true,
          fovDeg: SIGHT_FOV_AT_1X / 5.0,
          magnification: 5.0,
          range: 1600,
          reticle: 'us',
          cutout: { x: 100, y: 100, w: 200, h: 150 },
        });
      }).not.toThrow();
    } finally {
      HTMLCanvasElement.prototype.getContext = origGetContext;
    }
  });
});
