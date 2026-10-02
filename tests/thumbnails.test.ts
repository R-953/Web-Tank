import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  THUMB_SIZE,
  thumbnailFraming,
  vehicleThumbnail,
  clearThumbnails,
} from '../src/ui/menu/thumbnails';
import * as thumbnailsModule from '../src/ui/menu/thumbnails';
import { LineupBar } from '../src/ui/menu/LineupBar';
import { TechTree } from '../src/ui/menu/TechTree';
import { VehicleCard } from '../src/ui/menu/VehicleCard';
import { TIGER_I, T34_85 } from '../src/data/vehicles';
import { ProfileStore, assignVehicle, type ProfileVehicle } from '../src/settings/Profile';
import type { Vec3 } from '../src/data/types';

describe('thumbnails: thumbnailFraming', () => {
  const aspect = THUMB_SIZE.width / THUMB_SIZE.height;
  const fovDeg = 28;
  const azimuthDeg = 45;
  const pitchDeg = 12;

  function projectBounds(
    bounds: { min: Vec3; max: Vec3 },
    position: Vec3,
    target: Vec3,
  ): THREE.Vector3[] {
    const camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, 100);
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const corners: THREE.Vector3[] = [];
    for (const x of [bounds.min[0], bounds.max[0]]) {
      for (const y of [bounds.min[1], bounds.max[1]]) {
        for (const z of [bounds.min[2], bounds.max[2]]) {
          const v = new THREE.Vector3(x, y, z);
          v.project(camera);
          corners.push(v);
        }
      }
    }
    return corners;
  }

  it('各种尺寸的包围盒都完整落在画面内,左右各留约 4% 边距', () => {
    const testCases: Array<{ name: string; bounds: { min: Vec3; max: Vec3 } }> = [
      {
        name: '标准中重型坦克',
        bounds: { min: [-1.85, -1.2, -4.2], max: [1.85, 1.6, 4.2] },
      },
      {
        name: '轻型小车',
        bounds: { min: [-1.1, -0.6, -2.4], max: [1.1, 1.0, 2.4] },
      },
      {
        name: '长车体重型车',
        bounds: { min: [-2.0, -1.5, -6.5], max: [2.0, 1.8, 6.5] },
      },
      {
        name: '偏离原点的包围盒',
        bounds: { min: [10, 5, -20], max: [14, 8, -12] },
      },
      {
        name: '细高型包围盒',
        bounds: { min: [-1, -4, -1], max: [1, 4, 1] },
      },
    ];

    for (const { name, bounds } of testCases) {
      const { position, target } = thumbnailFraming(bounds, aspect, fovDeg, azimuthDeg, pitchDeg);
      const projected = projectBounds(bounds, position, target);

      // 1. 所有 8 个角均落在 NDC 视口内 [-1, 1]
      for (const p of projected) {
        expect(p.x, `${name} p.x 超出边界`).toBeGreaterThanOrEqual(-1.0001);
        expect(p.x, `${name} p.x 超出边界`).toBeLessThanOrEqual(1.0001);
        expect(p.y, `${name} p.y 超出边界`).toBeGreaterThanOrEqual(-1.0001);
        expect(p.y, `${name} p.y 超出边界`).toBeLessThanOrEqual(1.0001);
      }

      const minX = Math.min(...projected.map((p) => p.x));
      const maxX = Math.max(...projected.map((p) => p.x));
      const minY = Math.min(...projected.map((p) => p.y));
      const maxY = Math.max(...projected.map((p) => p.y));

      // 对于横向主导的车辆包围盒, 左右各留约 4% 边距 (即 minX ≈ -0.92, maxX ≈ 0.92)
      if (maxX - minX >= maxY - minY) {
        expect(minX).toBeCloseTo(-0.92, 1);
        expect(maxX).toBeCloseTo(0.92, 1);
      }
    }
  });

  it('更长的车不比更短的车占画面更小', () => {
    const shortBounds: { min: Vec3; max: Vec3 } = {
      min: [-1.5, 0, -2.5],
      max: [1.5, 2.0, 2.5], // 长 5m
    };
    const longBounds: { min: Vec3; max: Vec3 } = {
      min: [-1.5, 0, -4.5],
      max: [1.5, 2.0, 4.5], // 长 9m
    };

    const framingShort = thumbnailFraming(shortBounds, aspect, fovDeg, azimuthDeg, pitchDeg);
    const framingLong = thumbnailFraming(longBounds, aspect, fovDeg, azimuthDeg, pitchDeg);

    const projShort = projectBounds(shortBounds, framingShort.position, framingShort.target);
    const projLong = projectBounds(longBounds, framingLong.position, framingLong.target);

    const spanXShort = Math.max(...projShort.map((p) => p.x)) - Math.min(...projShort.map((p) => p.x));
    const spanXLong = Math.max(...projLong.map((p) => p.x)) - Math.min(...projLong.map((p) => p.x));

    // 更长的车画面宽度不小于更短的车(两者均充分铺满画面宽度, 留出约 4% 边距)
    expect(spanXLong).toBeGreaterThanOrEqual(spanXShort - 0.01);
    expect(spanXLong).toBeGreaterThanOrEqual(1.8);
    expect(spanXShort).toBeGreaterThanOrEqual(1.8);
  });

  it('视角与朝向: 车头(-Z)在画面左侧, 车尾(+Z)在画面右侧, 相机位于(-X, +Y, -Z)半球', () => {
    const bounds: { min: Vec3; max: Vec3 } = {
      min: [-1.5, -1, -3],
      max: [1.5, 1, 3],
    };
    const { position, target } = thumbnailFraming(bounds, aspect, fovDeg, azimuthDeg, pitchDeg);

    // 相机相对 target 的方向应为 -X, +Y, -Z
    expect(position[0] - target[0]).toBeLessThan(0);
    expect(position[1] - target[1]).toBeGreaterThan(0);
    expect(position[2] - target[2]).toBeLessThan(0);

    const camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, 100);
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    // 车头在 -Z: 投影到屏幕左侧 (X < 0)
    const nose = new THREE.Vector3(0, 0, -3).project(camera);
    // 车尾在 +Z: 投影到屏幕右侧 (X > 0)
    const tail = new THREE.Vector3(0, 0, 3).project(camera);

    expect(nose.x).toBeLessThan(0);
    expect(tail.x).toBeGreaterThan(0);
    expect(nose.x).toBeLessThan(tail.x);
  });
});

describe('thumbnails: vehicleThumbnail in jsdom', () => {
  beforeEach(() => {
    clearThumbnails();
  });

  afterEach(() => {
    clearThumbnails();
    vi.restoreAllMocks();
  });

  it('jsdom 里没有 WebGL 返回 null 且不抛错', () => {
    expect(() => {
      const res = vehicleThumbnail(TIGER_I);
      expect(res).toBeNull();
    }).not.toThrow();
  });

  it('jsdom 里渲染失败后缓存为 null, 不重复尝试', () => {
    const spy = vi.spyOn(document, 'createElement');
    const first = vehicleThumbnail(TIGER_I);
    expect(first).toBeNull();
    const callsAfterFirst = spy.mock.calls.length;

    const second = vehicleThumbnail(TIGER_I);
    expect(second).toBeNull();
    // 第二次直接从缓存返回, 不再重复尝试 createElement('canvas')
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('thumbnails: UI 组件集成', () => {
  const profileVehicles: ProfileVehicle[] = [
    { id: TIGER_I.id, nation: TIGER_I.nation!, family: TIGER_I.family ?? TIGER_I.id },
    { id: T34_85.id, nation: T34_85.nation!, family: T34_85.family ?? T34_85.id },
  ];

  let container: HTMLElement;

  beforeEach(() => {
    clearThumbnails();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    clearThumbnails();
    vi.restoreAllMocks();
    container.remove();
  });

  describe('LineupBar', () => {
    it('vehicleThumbnail 返回 data URL 时渲染 <img>, 返回 null 时退回剪影', () => {
      const store = new ProfileStore(profileVehicles);
      let p = store.get();
      p = assignVehicle(p, 'germany', p.nations.germany.activeLineup, 0, TIGER_I.id, profileVehicles);
      store.set(p);

      // 1. mock vehicleThumbnail 返回 data URL
      const mockUrl = 'data:image/png;base64,fake_lineup_thumb';
      const spy = vi.spyOn(thumbnailsModule, 'vehicleThumbnail').mockReturnValue(mockUrl);

      const bar = new LineupBar(container, {
        vehicles: [TIGER_I, T34_85],
        getProfile: () => store.get(),
        setProfile: (nextP) => store.set(nextP),
        onActiveVehicle: vi.fn(),
        onPickVehicle: vi.fn(),
      });

      const silWrap = container.querySelector('.mm-lineup-slot[data-crew-index="0"] .mm-lineup-slot-sil');
      expect(silWrap).not.toBeNull();
      const img = silWrap?.querySelector('img.mm-lineup-slot-thumb') as HTMLImageElement | null;
      expect(img).not.toBeNull();
      expect(img?.src).toBe(mockUrl);

      bar.dispose();
      container.innerHTML = '';

      // 2. vehicleThumbnail 返回 null -> 退回剪影
      spy.mockReturnValue(null);
      const barNull = new LineupBar(container, {
        vehicles: [TIGER_I, T34_85],
        getProfile: () => store.get(),
        setProfile: (nextP) => store.set(nextP),
        onActiveVehicle: vi.fn(),
        onPickVehicle: vi.fn(),
      });

      const silWrapNull = container.querySelector('.mm-lineup-slot[data-crew-index="0"] .mm-lineup-slot-sil');
      expect(silWrapNull).not.toBeNull();
      expect(silWrapNull?.querySelector('img')).toBeNull();
      expect(silWrapNull?.querySelector('svg')).not.toBeNull();

      barNull.dispose();
    });
  });

  describe('TechTree', () => {
    it('vehicleThumbnail 返回 data URL 时渲染 <img>, 返回 null 时退回剪影', () => {
      const entries = [
        {
          id: TIGER_I.id,
          name: TIGER_I.name,
          nation: 'germany',
          vehicleClass: TIGER_I.vehicleClass ?? ('heavy' as const),
          serviceYear: TIGER_I.serviceYear ?? 1942,
          family: 'tiger',
        },
      ];

      // 1. mock 返回 data URL
      const mockUrl = 'data:image/png;base64,fake_techtree_thumb';
      const spy = vi.spyOn(thumbnailsModule, 'vehicleThumbnail').mockReturnValue(mockUrl);

      const tt = new TechTree(container, {
        entries,
        currentId: TIGER_I.id,
        onPick: vi.fn(),
        onClose: vi.fn(),
      });

      const card = container.querySelector('.tt-vehicle-card[data-vehicle-id="tiger_i"]');
      expect(card).not.toBeNull();
      const img = card?.querySelector('img.tt-vehicle-thumb') as HTMLImageElement | null;
      expect(img).not.toBeNull();
      expect(img?.src).toBe(mockUrl);

      tt.dispose();
      container.innerHTML = '';

      // 2. mock 返回 null -> 退回剪影 svg, 没有 img
      spy.mockReturnValue(null);
      const ttNull = new TechTree(container, {
        entries,
        currentId: TIGER_I.id,
        onPick: vi.fn(),
        onClose: vi.fn(),
      });

      const cardNull = container.querySelector('.tt-vehicle-card[data-vehicle-id="tiger_i"]');
      expect(cardNull).not.toBeNull();
      expect(cardNull?.querySelector('img')).toBeNull();
      expect(cardNull?.querySelector('svg')).not.toBeNull();

      ttNull.dispose();
    });
  });

  describe('VehicleCard', () => {
    it('vehicleThumbnail 返回 data URL 时在标题上方渲染 .vc-image, 返回 null 时不留空位', () => {
      const anchor = {
        left: 100,
        top: 100,
        right: 200,
        bottom: 200,
        width: 100,
        height: 100,
        x: 100,
        y: 100,
        toJSON: () => {},
      } as DOMRect;

      const card = new VehicleCard(container);

      // 1. mock 返回 data URL
      const mockUrl = 'data:image/png;base64,fake_card_thumb';
      const spy = vi.spyOn(thumbnailsModule, 'vehicleThumbnail').mockReturnValue(mockUrl);

      card.show(TIGER_I, 0, anchor);
      const img = card.element.querySelector('img.vc-image') as HTMLImageElement | null;
      expect(img).not.toBeNull();
      expect(img?.src).toBe(mockUrl);
      const header = card.element.querySelector('.vc-header');
      expect(img?.nextElementSibling).toBe(header);

      // 2. mock 返回 null -> 没有 .vc-image, 不留空位
      spy.mockReturnValue(null);
      card.show(TIGER_I, 0, anchor);
      expect(card.element.querySelector('.vc-image')).toBeNull();
      expect(card.element.firstElementChild).toBe(card.element.querySelector('.vc-header'));

      card.dispose();
    });
  });
});
