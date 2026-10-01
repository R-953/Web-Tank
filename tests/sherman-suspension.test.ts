import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VEHICLES } from '../src/data/vehicles';
import { ModelKit, palette } from '../src/game/models/kit';
import { shermanLayout, type ShermanVariant } from '../src/game/models/sherman/layout';
import { buildSuspension } from '../src/game/models/sherman/suspension';

const VARIANTS: Record<string, ShermanVariant> = {
  m4a3_76w: { suspension: 'vvss', turret: 't23', gun: 'm1a1', applique: false },
  m4a3e8: { suspension: 'hvss', turret: 't23', gun: 'm1a2', applique: false },
  m4a3e2: { suspension: 'vvss', turret: 'jumbo', gun: 'm3', applique: true },
};

function setupSuspension(id: string) {
  const spec = VEHICLES[id];
  const variant = VARIANTS[id];
  const L = shermanLayout(spec, variant);
  const C = palette(spec.color);
  const kit = new ModelKit();
  const root = new THREE.Group();
  const H = kit.batch(root);
  buildSuspension(L, kit, root, H, C);
  kit.finish();
  root.updateMatrixWorld(true);
  return { spec, variant, L, C, kit, root, H };
}

/** 计算行走机构中所有实际几何顶点的最高点 (避免 InstancedMesh 旋转造成的外接球 / 盒对角线膨胀) */
function getSuspensionMaxY(root: THREE.Object3D): number {
  let maxY = -Infinity;
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) {
      const posAttr = o.geometry.getAttribute('position');
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        m.premultiply(o.matrixWorld);
        for (let j = 0; j < posAttr.count; j++) {
          v.fromBufferAttribute(posAttr, j).applyMatrix4(m);
          if (v.y > maxY) maxY = v.y;
        }
      }
    } else if (o instanceof THREE.Mesh) {
      const posAttr = o.geometry.getAttribute('position');
      for (let j = 0; j < posAttr.count; j++) {
        v.fromBufferAttribute(posAttr, j).applyMatrix4(o.matrixWorld);
        if (v.y > maxY) maxY = v.y;
      }
    }
  });
  return maxY;
}

describe('谢尔曼行走机构测试 (docs/tasks/014-sherman-suspension.md)', () => {
  for (const id of ['m4a3_76w', 'm4a3e8', 'm4a3e2'] as const) {
    describe(id, () => {
      it('每侧履带板 79 ± 2 块', () => {
        const { root } = setupSuspension(id);
        const instanced = root.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
        const linkMesh = instanced.reduce((max, m) => (m.count > max.count ? m : max));
        const countPerSide = linkMesh.count / 2;
        expect(countPerSide).toBeGreaterThanOrEqual(77);
        expect(countPerSide).toBeLessThanOrEqual(81);
      });

      it('所有负重轮底部离地 = 履带厚 (误差 1 cm 以内)', () => {
        const { root, L, variant } = setupSuspension(id);
        const instanced = root.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
        const wheelR = variant.suspension === 'hvss' ? 0.26 : 0.254;

        // 负重轮组每侧 6 个轮子 (3 个轮架 × 2)
        const roadWheelMeshes = instanced.filter((m) => m.count === 6);
        expect(roadWheelMeshes.length).toBeGreaterThanOrEqual(2); // 左右两侧各有一个

        const mat = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        for (const mesh of roadWheelMeshes) {
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, mat);
            pos.setFromMatrixPosition(mat);
            const wheelBottom = pos.y - wheelR;
            const distFromGround = wheelBottom - L.ground;
            expect(Math.abs(distFromGround - L.track.thickness)).toBeLessThan(0.01);
          }
        }
      });

      it('行走机构的最高点低于 L.sponsonY (不顶到侧裙)', () => {
        const { root, L } = setupSuspension(id);
        const maxY = getSuspensionMaxY(root);
        expect(maxY).toBeLessThan(L.sponsonY);
      });

      it('负重轮架在履带内缘以外、L.lowerHalfW 以外 (不插进车体)', () => {
        const { root, L, spec } = setupSuspension(id);
        // root 下的普通 Mesh 即为 H 烘焙出的静态结构
        const staticMesh = root.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh && !(c instanceof THREE.InstancedMesh));
        expect(staticMesh).toBeDefined();
        if (!staticMesh) return;

        const posAttr = staticMesh.geometry.getAttribute('position');
        const v = new THREE.Vector3();
        let maxAbsX = 0;

        for (let i = 0; i < posAttr.count; i++) {
          v.fromBufferAttribute(posAttr, i);
          const absX = Math.abs(v.x);
          if (absX > maxAbsX) maxAbsX = absX;
          // 不插进下部车体内部 (|x| >= lowerHalfW, 留 1mm 浮点裕量)
          expect(absX).toBeGreaterThanOrEqual(L.lowerHalfW - 1e-3);
        }

        // 负重轮架延伸至履带内缘以外 (到达车轮位置)
        const trackInnerEdge = L.track.x - L.track.width / 2;
        expect(maxAbsX).toBeGreaterThan(trackInnerEdge);
        // 不超出车体允许全宽
        expect(maxAbsX).toBeLessThan(spec.hull.width / 2 + 0.1);
      });

      it('行走机构三角面不超过约 6,000', () => {
        const { root } = setupSuspension(id);
        let renderedTriangles = 0;
        let baseTriangles = 0;
        const seenGeometries = new Set<THREE.BufferGeometry>();
        root.traverse((o) => {
          if (o instanceof THREE.InstancedMesh) {
            const tris = o.geometry.getAttribute('position').count / 3;
            renderedTriangles += tris * o.count;
            if (!seenGeometries.has(o.geometry)) {
              seenGeometries.add(o.geometry);
              baseTriangles += tris;
            }
          } else if (o instanceof THREE.Mesh) {
            const tris = o.geometry.getAttribute('position').count / 3;
            renderedTriangles += tris;
            if (!seenGeometries.has(o.geometry)) {
              seenGeometries.add(o.geometry);
              baseTriangles += tris;
            }
          }
        });
        expect(renderedTriangles).toBeLessThanOrEqual(6000);
      });
    });
  }

  it('VVSS 与 HVSS 特征可明确区分', () => {
    const vvss = setupSuspension('m4a3_76w');
    const hvss = setupSuspension('m4a3e8');

    // 1. 负重轮单双:
    // VVSS 单负重轮宽度约 0.23m; HVSS 双负重轮由两片轮子组成,宽度跨度 > 0.35m
    const vvssWheels = vvss.root.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.count === 6);
    const hvssWheels = hvss.root.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.count === 6);

    const vvssWheelBBox = new THREE.Box3().setFromBufferAttribute(vvssWheels[0].geometry.getAttribute('position') as THREE.BufferAttribute);
    const hvssWheelBBox = new THREE.Box3().setFromBufferAttribute(hvssWheels[0].geometry.getAttribute('position') as THREE.BufferAttribute);

    const vvssWheelSpanX = vvssWheelBBox.max.x - vvssWheelBBox.min.x;
    const hvssWheelSpanX = hvssWheelBBox.max.x - hvssWheelBBox.min.x;
    expect(vvssWheelSpanX).toBeLessThan(0.28);
    expect(hvssWheelSpanX).toBeGreaterThan(0.35);

    // 2. 托带轮数量与组数:
    // VVSS: 每侧 3 个托带轮 (单组 count = 3); HVSS: 每侧 3 个单托带轮 + 2 个双托带轮 (两组分别 count = 3 与 count = 2)
    const vvssRollers = vvss.root.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.count === 3);
    const hvssSingleRollers = hvss.root.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.count === 3);
    const hvssTwinRollers = hvss.root.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.count === 2);

    expect(vvssRollers.length).toBe(2); // 左右两侧各 1 个 mesh (count 3)
    expect(hvssSingleRollers.length).toBe(2);
    expect(hvssTwinRollers.length).toBe(2);
  });
});
