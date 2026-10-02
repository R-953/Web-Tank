import { describe, it, expect } from 'vitest';
import { SURFACES } from '../src/data/surfaces';
import { SURFACE_ORDER, buildTerrain } from '../src/game/terrain';
import { SNOW_FOREST } from '../src/data/mapspecs/snow_forest';

describe('积雪地表(snow)', () => {
  it('颜色是雪白,阻力在草地和沙地之间,抓地比草地差', () => {
    const s = SURFACES.snow;
    const r = (s.color >> 16) & 0xff;
    const g = (s.color >> 8) & 0xff;
    const b = s.color & 0xff;
    expect(Math.min(r, g, b)).toBeGreaterThan(0xd0);
    expect(s.rollingResistance).toBeGreaterThan(SURFACES.grass.rollingResistance);
    expect(s.rollingResistance).toBeLessThan(SURFACES.sand.rollingResistance);
    expect(s.grip).toBeLessThan(SURFACES.grass.grip);
  });

  it('加在 SURFACE_ORDER 末尾,原有地表的下标不变', () => {
    expect(SURFACE_ORDER.slice(0, 6)).toEqual(['grass', 'dirt', 'sand', 'rock', 'mud', 'water']);
    expect(SURFACE_ORDER[6]).toBe('snow');
  });

  it('雪地森林的开阔地面是积雪', () => {
    const grid = buildTerrain(SNOW_FOREST);
    const snowIndex = SURFACE_ORDER.indexOf('snow');
    let snow = 0;
    for (const t of grid.surfaces) if (t === snowIndex) snow++;
    expect(snow / grid.surfaces.length).toBeGreaterThan(0.5);
  });
});
