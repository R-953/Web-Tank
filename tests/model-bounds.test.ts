import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VEHICLES } from '../src/data/vehicles';
import { applyGunPose, buildVehicleModel, hasCustomModel } from '../src/game/models';
import { turretRingOffset } from '../src/game/damage/geometry';

/**
 * 专属模型的整体检查(防止零件沉到地下、行走机构悬空、零件跑到车外):
 * 按游戏里的节点层级搭好模型,火炮朝正前方,在车体坐标里量包围盒。
 */
function buildBounds(id: string) {
  const spec = VEHICLES[id];
  const root = new THREE.Group();
  const turretPivot = new THREE.Group();
  const gunPivot = new THREE.Group();
  turretPivot.position.copy(turretRingOffset(spec));
  gunPivot.position.set(0, spec.turret.height / 2, -spec.turret.length / 2);
  root.add(turretPivot);
  turretPivot.add(gunPivot);
  buildVehicleModel(spec, { root, turretPivot, gunPivot });
  applyGunPose(spec, { turretPivot, gunPivot }, 0, 0);
  root.updateMatrixWorld(true);
  const all = new THREE.Box3();
  const hullOnly = new THREE.Box3();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const b = new THREE.Box3().setFromObject(o);
    all.union(b);
    if (o.parent === root) hullOnly.union(b);
  });
  return { spec, all, hullOnly, meshes: { turret: turretPivot.children.length, gun: gunPivot.children.length } };
}

describe('专属模型的包围盒', () => {
  for (const id of Object.keys(VEHICLES).filter(hasCustomModel)) {
    it(id, () => {
      const { spec, all, hullOnly, meshes } = buildBounds(id);
      const hh = spec.hull.height / 2;
      // 炮塔 / 战斗室和火炮节点上都有网格
      expect(meshes.turret).toBeGreaterThan(0);
      expect(meshes.gun).toBeGreaterThan(0);
      // 没有东西沉到地面以下(履带齿允许 8 cm),履带贴地
      expect(all.min.y).toBeGreaterThan(-hh - 0.08);
      expect(hullOnly.min.y).toBeLessThan(-hh + 0.08);
      // 宽度不超出车宽太多(挡泥板、工具之类允许 0.15 m)
      expect(all.max.x).toBeLessThan(spec.hull.width / 2 + 0.15);
      expect(all.min.x).toBeGreaterThan(-spec.hull.width / 2 - 0.15);
      // 车体部分不超出车长太多(尾部工具箱、诱导轮允许 0.3 m)
      expect(hullOnly.min.z).toBeGreaterThan(-spec.hull.length / 2 - 0.3);
      expect(hullOnly.max.z).toBeLessThan(spec.hull.length / 2 + 0.3);
      // 顶部不高出车体盒 + 炮塔盒太多(指挥塔、天线底座允许 0.35 m)
      expect(all.max.y).toBeLessThan(hh + spec.turret.height + 0.35);
    });
  }
});
