import { describe, it, expect } from 'vitest';
import { ACTION_BY_ID, defaultBindings, findConflicts } from '../src/data/controls';
import { sanitize, defaultSettings } from '../src/settings/Settings';

describe('键位与老存档迁移 (044-mapscreen-key-and-symbols)', () => {
  it('mapScreen 操作定义与 minimapShape 默认键位', () => {
    const mapScreenDef = ACTION_BY_ID.mapScreen;
    expect(mapScreenDef).toBeDefined();
    expect(mapScreenDef.name).toBe('地图界面');
    expect(mapScreenDef.group).toBe('界面');
    expect(mapScreenDef.hint).toBe('战斗前调整携弹;战斗中查看大地图');
    expect(mapScreenDef.defaults).toEqual(['KeyM', null]);

    const minimapShapeDef = ACTION_BY_ID.minimapShape;
    expect(minimapShapeDef).toBeDefined();
    expect(minimapShapeDef.defaults).toEqual([null, null]);

    const defBindings = defaultBindings();
    expect(defBindings.mapScreen).toEqual(['KeyM', null]);
    expect(defBindings.minimapShape).toEqual([null, null]);
    expect(findConflicts(defBindings).size).toBe(0);
  });

  it('新存档默认 M 是 mapScreen，minimapShape 没有默认键', () => {
    const s = defaultSettings();
    expect(s.controls.bindings.mapScreen).toEqual(['KeyM', null]);
    expect(s.controls.bindings.minimapShape).toEqual([null, null]);
  });

  it('老存档迁移: 没有 mapScreen 且 minimapShape 为 [KeyM, null] 时，KeyM 归 mapScreen，minimapShape 换成 null', () => {
    const oldSave = {
      controls: {
        bindings: {
          forward: ['KeyW', 'ArrowUp'],
          minimapShape: ['KeyM', null],
        },
      },
    };
    const s = sanitize(oldSave);
    expect(s.controls.bindings.mapScreen).toEqual(['KeyM', null]);
    expect(s.controls.bindings.minimapShape).toEqual([null, null]);
    expect(s.controls.bindings.forward).toEqual(['KeyW', 'ArrowUp']);
  });

  it('老存档迁移: 没有 mapScreen 且 minimapShape 副键为 KeyM 时，副键换成 null', () => {
    const oldSave = {
      controls: {
        bindings: {
          minimapShape: ['KeyN', 'KeyM'],
        },
      },
    };
    const s = sanitize(oldSave);
    expect(s.controls.bindings.mapScreen).toEqual(['KeyM', null]);
    expect(s.controls.bindings.minimapShape).toEqual(['KeyN', null]);
  });

  it('老存档迁移: 没有 mapScreen 且 minimapShape 未绑定 KeyM 时，保留原键位', () => {
    const oldSave = {
      controls: {
        bindings: {
          minimapShape: ['KeyN', null],
        },
      },
    };
    const s = sanitize(oldSave);
    expect(s.controls.bindings.mapScreen).toEqual(['KeyM', null]);
    expect(s.controls.bindings.minimapShape).toEqual(['KeyN', null]);
  });

  it('新存档已有 mapScreen 时不迁移，用户自定义设置被保留', () => {
    const newSave = {
      controls: {
        bindings: {
          mapScreen: ['KeyO', null],
          minimapShape: ['KeyM', null],
        },
      },
    };
    const s = sanitize(newSave);
    expect(s.controls.bindings.mapScreen).toEqual(['KeyO', null]);
    expect(s.controls.bindings.minimapShape).toEqual(['KeyM', null]);
  });
});

describe('显示内构键位 (052-internals-view)', () => {
  it('internals 操作定义与默认键位', () => {
    const def = ACTION_BY_ID.internals;
    expect(def).toBeDefined();
    expect(def.name).toBe('显示内构');
    expect(def.group).toBe('车辆');
    expect(def.hint).toBe('再按一次关闭');
    expect(def.defaults).toEqual(['KeyO', null]);

    const defBindings = defaultBindings();
    expect(defBindings.internals).toEqual(['KeyO', null]);
    expect(findConflicts(defBindings).size).toBe(0);
  });

  it('老存档没有 internals 字段时自动补齐默认键 KeyO', () => {
    const oldSave = {
      controls: {
        bindings: {
          forward: ['KeyW', 'ArrowUp'],
          repair: ['KeyF', null],
        },
      },
    };
    const s = sanitize(oldSave);
    expect(s.controls.bindings.internals).toEqual(['KeyO', null]);
  });
});

