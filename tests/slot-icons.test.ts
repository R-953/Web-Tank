// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SHELL_TYPES } from '../src/data/shells';
import { VEHICLES } from '../src/data/vehicles';
import type { DamageModel } from '../src/game/damage/DamageModel';
import { Hud, type HudState } from '../src/ui/Hud';
import { shellIconKind, slotIconSvg, type SlotIconKind } from '../src/ui/hud/slotIcons';

describe('快捷栏图标', () => {
  it('为每种弹种提供图标映射,未知弹种回退通用图标', () => {
    for (const shellType of Object.keys(SHELL_TYPES)) {
      expect(shellIconKind(shellType)).toBe(shellType);
      expect(slotIconSvg(shellIconKind(shellType))).toContain('<svg');
    }
    expect(shellIconKind('not-a-shell')).toBe('default');
  });

  it('所有图标类型均返回内联 SVG', () => {
    const kinds: SlotIconKind[] = [
      ...Object.keys(SHELL_TYPES) as SlotIconKind[],
      'APDS',
      'SMOKE',
      'mg',
      'repair',
      'extinguish',
      'scope',
      'default',
    ];
    for (const kind of kinds) {
      expect(slotIconSvg(kind)).toContain('<svg');
      expect(slotIconSvg(kind)).toContain('</svg>');
    }
  });

  it('更新快捷栏后每个按钮都有图标,且图标类型不变时复用 SVG 节点', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const hud = new Hud(container);
    const damage = {
      canFire: true,
      repair: null,
      repairRate: 1,
      brokenRepairable: () => [],
      damagedRepairable: () => [],
      extinguishers: 2,
      fire: null,
    } as unknown as DamageModel;
    const ammo = Object.keys(SHELL_TYPES).map((type, index) => ({
      id: `shell-${type}`,
      name: type,
      type,
      count: index === 0 ? 0 : 10,
      selected: index === 1,
      loaded: index === 2,
      key: String(index + 1),
    }));
    const state: HudState = {
      spec: VEHICLES.tiger_i,
      damage,
      turretYaw: 0,
      viewYaw: 0,
      compassYaw: 0,
      speedKmh: 0,
      engineRpm: 0,
      throttle: 0,
      surface: 'grass',
      reloadRemaining: 0,
      reloadTime: 1,
      loaded: null,
      ammo,
      mg: {
        name: '同轴机枪',
        inBelt: 100,
        beltSize: 100,
        reserve: 100,
        reloading: 0,
        reloadTime: 5,
        firing: false,
        key: 'Space',
      },
      keys: { fire: 'Mouse1', repair: 'F', extinguish: '6', nextShell: 'CapsLock', scope: 'Shift', zoom: 'Z', cursor: 'Alt' },
      targetsDestroyed: 0,
      targetsTotal: 0,
      gunMarker: null,
      scoped: false,
      sightRange: 100,
      magnification: 2,
      hints: null,
      fps: null,
      cursor: null,
      marker: null,
      alive: true,
    };

    hud['updateBar'](state);
    const slots = container.querySelectorAll('.hud-slot');
    expect(slots).toHaveLength(ammo.length + 4);
    for (const slot of slots) {
      expect(slot.querySelector('.slot-icon svg')).not.toBeNull();
    }
    expect(slots[0].classList.contains('empty')).toBe(true);
    expect(slots[1].classList.contains('sel')).toBe(true);
    expect(slots[2].classList.contains('loaded')).toBe(true);

    const firstIcon = slots[1].querySelector('svg');
    hud['updateBar'](state);
    expect(slots[1].querySelector('svg')).toBe(firstIcon);

    damage.fire = { extinguishing: null } as DamageModel['fire'];
    hud['updateBar'](state);
    const fireSlot = container.querySelectorAll('.hud-slot')[ammo.length + 2];
    expect(fireSlot.classList.contains('alert')).toBe(true);
    expect(fireSlot.classList.contains('flash')).toBe(true);

    damage.repair = { remaining: 5, total: 10 } as DamageModel['repair'];
    hud['updateBar'](state);
    expect(container.querySelector('.hud-slot.busy .slot-icon svg')).not.toBeNull();
    container.remove();
  });
});
