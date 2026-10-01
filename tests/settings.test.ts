import { describe, it, expect } from 'vitest';
import { SettingsStore, defaultSettings, sanitize } from '../src/settings/Settings';
import { importWtBindings, parseWtHotkeys } from '../src/settings/wtImport';
import { defaultBindings, findConflicts } from '../src/data/controls';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

describe('设置:修正与保存', () => {
  it('空值 / 垃圾数据得到缺省设置;数值越界被夹住;未知枚举值回到缺省', () => {
    expect(sanitize(null)).toEqual(defaultSettings());
    expect(sanitize('garbage')).toEqual(defaultSettings());
    const s = sanitize({
      game: { aiPreset: 'insane', minimapShape: 'circle' },
      graphics: { renderScale: 9, viewDistance: -5, shadows: 'ultra' },
      controls: { mouseSensitivity: 0, sightSensitivity: '3' },
    });
    expect(s.game.aiPreset).toBe('training');
    expect(s.game.minimapShape).toBe('circle');
    expect(s.graphics.renderScale).toBe(1.5);
    expect(s.graphics.viewDistance).toBe(1000);
    expect(s.graphics.shadows).toBe(defaultSettings().graphics.shadows);
    expect(s.controls.mouseSensitivity).toBe(0.1);
    expect(s.controls.sightSensitivity).toBe(1);
  });

  it('小地图标记:缺省和旧存档(没有这个字段)是军标;非法值回到军标;圆点和箭头能保存再读回', () => {
    expect(defaultSettings().game.minimapMarkers).toBe('symbol');
    expect(sanitize({ game: { minimapShape: 'circle', showFps: true } }).game.minimapMarkers).toBe('symbol');
    expect(sanitize({ game: { minimapMarkers: 'star' } }).game.minimapMarkers).toBe('symbol');
    expect(sanitize({ game: { minimapMarkers: 1 } }).game.minimapMarkers).toBe('symbol');
    expect(sanitize({ game: { minimapMarkers: 'dot' } }).game.minimapMarkers).toBe('dot');
    expect(sanitize({ game: { minimapMarkers: 'arrow' } }).game.minimapMarkers).toBe('arrow');
    expect(sanitize({ game: { minimapMarkers: 'symbol' } }).game.minimapMarkers).toBe('symbol');
    const storage = new MemoryStorage();
    new SettingsStore(storage).update((d) => (d.game.minimapMarkers = 'arrow'));
    expect(new SettingsStore(storage).value.game.minimapMarkers).toBe('arrow');
  });

  it('只存了部分键位的旧存档:其余操作用默认键位', () => {
    const s = sanitize({ controls: { bindings: { forward: ['KeyI', null], bogus: ['KeyQ', null] } } });
    expect(s.controls.bindings.forward).toEqual(['KeyI', null]);
    expect(s.controls.bindings.back).toEqual(defaultBindings().back);
  });

  it('update 保存到存储并通知订阅者;重新读取得到同样的设置', () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    let notified = 0;
    store.subscribe(() => notified++);
    store.update((d) => {
      d.controls.sightSensitivity = 0.5;
      d.game.aiPreset = 'guard';
    });
    expect(notified).toBe(1);
    const again = new SettingsStore(storage);
    expect(again.value.controls.sightSensitivity).toBe(0.5);
    expect(again.value.game.aiPreset).toBe('guard');
  });

  it('存档损坏、存储不可用(无痕模式)都不会出错', () => {
    const storage = new MemoryStorage();
    storage.setItem('webtank.settings.v1', '{not json');
    expect(new SettingsStore(storage).value).toEqual(defaultSettings());
    const broken = {
      getItem: (): string | null => {
        throw new Error('denied');
      },
      setItem: (): void => {
        throw new Error('denied');
      },
    };
    const store = new SettingsStore(broken);
    store.update((d) => (d.sound.master = 0.3));
    expect(store.value.sound.master).toBe(0.3);
    expect(new SettingsStore(null).value).toEqual(defaultSettings());
  });

  it('键位冲突检测', () => {
    const b = defaultBindings();
    expect(findConflicts(b).size).toBe(0);
    b.repair = ['KeyW', null];
    const c = findConflicts(b);
    expect(c.get('KeyW')).toEqual(['forward', 'repair']);
  });
});

describe('导入 War Thunder 键位(.blk)', () => {
  const BLK = `controls{
  version:i=5
  hotkeys{
    ID_AGM_LOCK{
      keyboardKey:i=56
      keyboardKey:i=45
    }
    ID_FIRE_GM{}
    ID_FIRE_GM_MACHINE_GUN{
      keyboardKey:i=56
      keyboardKey:i=57
    }
    ID_NEXT_BULLET_TYPE{
      keyboardKey:i=58
    }
    ID_REPAIR_TANK{
      keyboardKey:i=33
    }
    ID_REPAIR_TANK{
      mouseButton:i=4
    }
    gm_sight_distance_rangeMax{
      mouseButton:i=6
    }
    gm_sight_distance_rangeMin{
      mouseButton:i=5
    }
    gm_zoom_rangeMax{
      keyboardKey:i=201
    }
  }
  axes{
    gm_throttle{ axisId:i=0 }
  }
}`;

  it('解析 hotkeys 段:扫描码和鼠标按键都能认出来', () => {
    const list = parseWtHotkeys(BLK);
    expect(list.map((x) => x.id)).toContain('ID_NEXT_BULLET_TYPE');
    expect(list.find((x) => x.id === 'ID_NEXT_BULLET_TYPE')!.keys).toEqual(['CapsLock']);
    expect(list.find((x) => x.id === 'ID_AGM_LOCK')!.keys).toEqual(['AltLeft', 'KeyX']);
    expect(list.find((x) => x.id === 'gm_sight_distance_rangeMax')!.keys).toEqual(['WheelDown']);
    expect(list.some((x) => x.id === 'gm_throttle')).toBe(false);
  });

  it('只导入单键的坦克操作;组合键跳过;空块保持原键位;重复块变成主 / 副键位', () => {
    const current = defaultBindings();
    current.rangeUp = ['WheelUp', null]; // 模拟玩家之前改反了
    const r = importWtBindings(BLK, current);
    expect(r.bindings.rangeUp).toEqual(['WheelDown', null]);
    expect(r.bindings.rangeDown).toEqual(['WheelUp', null]);
    expect(r.bindings.nextShell).toEqual(['CapsLock', null]);
    expect(r.bindings.repair).toEqual(['KeyF', 'MouseForward']);
    expect(r.bindings.zoomIn).toEqual(['PageUp', null]);
    // 机枪是 Alt + 空格(组合键):跳过,保持原来的空格
    expect(r.bindings.fireMg).toEqual(defaultBindings().fireMg);
    expect(r.skippedCombos).toBe(1);
    // 主炮是空块:保持原来的左键
    expect(r.bindings.fireMain).toEqual(defaultBindings().fireMain);
    // 空军的操作不算
    expect(r.applied.map((a) => a.action)).not.toContain('forward');
    // 不改动传进来的对象
    expect(current.rangeUp).toEqual(['WheelUp', null]);
  });

  it('不是 WT 键位文件:一个都认不出', () => {
    expect(importWtBindings('hello world', defaultBindings()).recognized).toBe(0);
  });
});
