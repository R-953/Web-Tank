import * as THREE from 'three';
import type { VehicleSpec } from '../../data/types';
import { applyGunPose, buildVehicleModel } from '../../game/models';
import { clampYaw } from '../../game/casemate';
import { turretRingOffset } from '../../game/damage/geometry';

/**
 * 机库背景(3D):水泥地面、钢结构厂房、展示台上的载具,暖色主光 + 冷色补光。
 * 由 main.ts 用同一个 WebGLRenderer 渲染;镜头缓慢环绕,拖动旋转视角、滚轮缩放。
 */
export class HangarScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
  private vehicle: THREE.Group | null = null;
  private readonly target = new THREE.Vector3(0, 1.3, 0);
  private yaw = 0.75;
  private pitch = 0.16;
  private radius = 11.5;
  private idleSince = 0;
  private time = 0;
  private dragging = false;
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor() {
    const bg = 0x23272b;
    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.Fog(bg, 24, 60);
    this.buildShed();
    this.scene.add(new THREE.HemisphereLight(0xc7d6e4, 0x3a3128, 0.7));
    const key = new THREE.DirectionalLight(0xffe0b5, 2.4);
    key.position.set(-8, 14, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    const fill = new THREE.PointLight(0x8fb4ff, 30, 30, 1.6);
    fill.position.set(9, 5, -4);
    this.scene.add(fill);
    const rim = new THREE.PointLight(0xffc27a, 18, 26, 1.6);
    rim.position.set(-6, 6, -9);
    this.scene.add(rim);
    this.updateCamera();
  }

  /** 换展示的载具(旧模型的几何体 / 材质一起释放) */
  setVehicle(spec: VehicleSpec): void {
    if (this.vehicle) {
      this.scene.remove(this.vehicle);
      disposeTree(this.vehicle);
    }
    const root = new THREE.Group();
    const turretPivot = new THREE.Group();
    const gunPivot = new THREE.Group();
    turretPivot.position.copy(turretRingOffset(spec));
    gunPivot.position.set(0, spec.turret.height / 2, -spec.turret.length / 2);
    root.add(turretPivot);
    turretPivot.add(gunPivot);
    buildVehicleModel(spec, { root, turretPivot, gunPivot });
    // 炮管微微抬起、炮塔稍微偏一点,更有「展示」的感觉(固定战斗室只偏到射界以内)
    applyGunPose(spec, { turretPivot, gunPivot }, clampYaw(spec, 0.18), 0.05);
    root.position.set(0, spec.hull.height / 2 + PLATFORM_H, 0);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(root);
    this.vehicle = root;
    this.target.set(0, spec.hull.height * 0.55 + PLATFORM_H, 0);
    this.radius = Math.max(9, spec.hull.length * 1.7);
    this.updateCamera();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.time += dt;
    // 松手 3 秒后镜头慢慢自己转
    if (!this.dragging && this.time - this.idleSince > 3) this.yaw += dt * 0.06;
    this.updateCamera();
  }

  /** 在 el 上拖动旋转视角、滚轮缩放 */
  bindDrag(el: HTMLElement): void {
    let lastX = 0;
    let lastY = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yaw -= (e.clientX - lastX) * 0.006;
      this.pitch = Math.min(0.6, Math.max(0.02, this.pitch + (e.clientY - lastY) * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
      this.idleSince = this.time;
    });
    const end = () => {
      this.dragging = false;
      this.idleSince = this.time;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.radius = Math.min(20, Math.max(6.5, this.radius * (e.deltaY > 0 ? 1.08 : 1 / 1.08)));
        this.idleSince = this.time;
      },
      { passive: false },
    );
  }

  dispose(): void {
    if (this.vehicle) disposeTree(this.vehicle);
    disposeTree(this.scene);
    this.disposables.forEach((d) => d.dispose());
  }

  private updateCamera(): void {
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.radius,
      this.target.y + Math.sin(this.pitch) * this.radius,
      this.target.z + Math.cos(this.yaw) * cp * this.radius,
    );
    this.camera.lookAt(this.target);
  }

  /** 厂房:地面、展示台、后墙和两侧墙、立柱、屋架、吊灯、几个木箱和油桶 */
  private buildShed(): void {
    const mat = (color: number, rough = 0.9, metal = 0.05, emissive = 0x000000) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive });
      this.disposables.push(m);
      return m;
    };
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, shadow = true) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      mesh.castShadow = shadow;
      this.scene.add(mesh);
      return mesh;
    };
    const concrete = mat(0x6d6b66, 0.95);
    const wall = mat(0x4a4f54, 0.9);
    const steel = mat(0x33383d, 0.6, 0.5);
    const floor = add(new THREE.PlaneGeometry(80, 80), concrete, 0, 0, 0, false);
    floor.rotation.x = -Math.PI / 2;
    // 地面上的伸缩缝
    const seam = mat(0x55534f, 1);
    for (let i = -30; i <= 30; i += 6) {
      add(new THREE.BoxGeometry(80, 0.01, 0.06), seam, 0, 0.005, i, false);
      add(new THREE.BoxGeometry(0.06, 0.01, 80), seam, i, 0.005, 0, false);
    }
    // 展示台(黄黑警示边)
    add(new THREE.CylinderGeometry(5.2, 5.4, PLATFORM_H, 48), mat(0x3a3e42, 0.85, 0.2), 0, PLATFORM_H / 2, 0, false);
    add(new THREE.CylinderGeometry(5.45, 5.5, 0.03, 48), mat(0xc9a13a, 0.7), 0, 0.015, 0, false);
    // 墙
    add(new THREE.BoxGeometry(40, 12, 0.4), wall, 0, 6, -15);
    add(new THREE.BoxGeometry(0.4, 12, 40), wall, -17, 6, 0);
    add(new THREE.BoxGeometry(0.4, 12, 40), wall, 17, 6, 0);
    // 后墙上的大门(亮一点,像外面的天光)
    add(new THREE.BoxGeometry(10, 7, 0.1), mat(0x9fb3c4, 1, 0, 0x2a3440), 0, 3.5, -14.75, false);
    for (const x of [-15, -9, -3, 3, 9, 15]) {
      add(new THREE.BoxGeometry(0.45, 11, 0.45), steel, x, 5.5, -14.5);
    }
    for (const z of [-9, -3, 3, 9]) {
      add(new THREE.BoxGeometry(0.45, 11, 0.45), steel, -16.5, 5.5, z);
      add(new THREE.BoxGeometry(0.45, 11, 0.45), steel, 16.5, 5.5, z);
    }
    // 屋架与吊灯
    const lamp = mat(0xfff1d0, 0.5, 0, 0xffe2a8);
    for (const z of [-12, -6, 0, 6]) {
      add(new THREE.BoxGeometry(34, 0.5, 0.35), steel, 0, 10.5, z, false);
      for (const x of [-6, 6]) add(new THREE.BoxGeometry(1.2, 0.12, 0.5), lamp, x, 10.1, z, false);
    }
    // 木箱、油桶
    const crate = mat(0x7a6040, 0.95);
    add(new THREE.BoxGeometry(1.2, 1.2, 1.2), crate, -10, 0.6, -10);
    add(new THREE.BoxGeometry(1.2, 1.2, 1.2), crate, -8.7, 0.6, -10.4);
    add(new THREE.BoxGeometry(1.2, 1.2, 1.2), crate, -9.4, 1.8, -10.2);
    const drum = mat(0x4c5a3a, 0.7, 0.3);
    for (const [x, z] of [
      [10, -11],
      [10.8, -10.2],
      [11.2, -11.3],
      [12, -9],
    ]) {
      add(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 16), drum, x, 0.55, z);
    }
  }
}

const PLATFORM_H = 0.14;

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const m = o.material as THREE.Material | THREE.Material[];
      (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    }
  });
}
