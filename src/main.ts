import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FixedStepper } from './engine/FixedStepper';
import { InputManager } from './engine/Input';
import { OrbitCamera } from './engine/OrbitCamera';
import { Game } from './game/Game';
import { KEYS, pressed, readPlayerControls } from './game/PlayerController';
import { SIGHT_RANGE } from './game/Ballistics';
import { clampLoadout, defaultLoadout } from './game/Loadout';
import { RIVER_VALLEY } from './data/maps';
import { VEHICLES } from './data/vehicles';
import { DEFAULT_CONTROLS } from './data/controls';
import { SHELL_SHORT } from './data/shells';
import { SURFACES } from './data/surfaces';
import type { Loadout, VehicleSpec } from './data/types';
import { Hud } from './ui/Hud';
import { SightOverlay } from './ui/SightOverlay';
import { KILLCAM, KillCam } from './ui/KillCam';
import { Minimap } from './ui/Minimap';

const MAP = RIVER_VALLEY;
/** 准星射线的最远距离,m */
const AIM_DISTANCE = 4000;
const SKY = 0xa9cbe6;
/** 阴影只覆盖玩家周围这么大的范围(半边长,m),光源跟着玩家走 */
const SHADOW_RANGE = 150;
const CONTROLS = DEFAULT_CONTROLS;

/** 玩家携弹方案存在本机浏览器里(每种车一份);读写失败就用缺省方案 */
function loadSavedLoadout(spec: VehicleSpec): Loadout {
  try {
    const raw = localStorage.getItem(`webtank.loadout.${spec.id}`);
    if (raw) return clampLoadout(spec, JSON.parse(raw) as Loadout);
  } catch {
    /* 无痕模式等:忽略 */
  }
  return defaultLoadout(spec);
}

function saveLoadout(spec: VehicleSpec, loadout: Loadout): void {
  try {
    localStorage.setItem(`webtank.loadout.${spec.id}`, JSON.stringify(loadout));
  } catch {
    /* 忽略 */
  }
}

async function start(): Promise<void> {
  await RAPIER.init();

  // --- 渲染(对数深度缓冲:3 km 的地图上远处地形不闪烁)
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 1500, 6000);
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a5040, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -SHADOW_RANGE,
    right: SHADOW_RANGE,
    top: SHADOW_RANGE,
    bottom: -SHADOW_RANGE,
    near: 1,
    far: 800,
  });
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 8000);
  const orbit = new OrbitCamera(camera);

  // --- 输入、HUD、瞄准镜、击杀回放、小地图
  const input = new InputManager();
  input.attach(window);
  const canvas = renderer.domElement;
  const lockPointer = () => {
    if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
  };
  canvas.addEventListener('click', lockPointer);
  const sight = new SightOverlay(document.body);
  const hud = new Hud(document.body, lockPointer);
  const killcam = new KillCam(document.body);
  const minimap = new Minimap(document.body);

  // 瞄准镜状态:是否开镜、当前倍率档位、表尺距离
  let scoped = false;
  let zoomIndex = 0;
  let sightRange = 0;

  // --- 一局游戏
  const playerSpec = VEHICLES[MAP.spawns.player.vehicleId];
  let loadout = loadSavedLoadout(playerSpec);
  let game!: Game;
  const newGame = () => {
    game?.dispose();
    game = new Game({ map: MAP, vehicles: VEHICLES, playerLoadout: loadout });
    scene.add(game.root);
    orbit.yaw = (MAP.spawns.player.heading * Math.PI) / 180;
    orbit.pitch = -0.12;
    scoped = false;
    zoomIndex = 0;
    sightRange = 0;
    orbit.setThirdPerson();
    hud.reset();
    hud.setLoadoutEditor({
      spec: playerSpec,
      loadout,
      onApply: (next) => {
        loadout = clampLoadout(playerSpec, next);
        saveLoadout(playerSpec, loadout);
        newGame();
        stepper.reset();
      },
    });
    minimap.setMap(game.map);
  };
  const stepper = new FixedStepper(1 / 60);
  newGame();

  // 调试:地址栏加 ?debug 后,可在浏览器控制台用 __debug.game() 查看当前对局状态
  if (new URLSearchParams(location.search).has('debug')) {
    Object.assign(window, { __debug: { game: () => game, orbit, camera, killcam, sight: () => ({ scoped, zoomIndex, sightRange }) } });
  }

  const aimPoint = new THREE.Vector3();
  const sightPos = new THREE.Vector3();
  const heightAt = (x: number, z: number) => game.map.heightAt(x, z);
  const updateCamera = () => {
    game.player.root.visible = !scoped;
    orbit.update(game.player.root.position, heightAt, scoped ? game.player.sightWorldPosition(sightPos) : undefined);
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let last = performance.now();
  let wasLocked = false;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    const locked = document.pointerLockElement === canvas;
    // 用来锁定鼠标的那一下点击不算开火
    const justLocked = locked && !wasLocked;
    wasLocked = locked;
    const player = game.player;
    const magnifications = player.spec.sight.magnifications;

    if (pressed(input, KEYS.restart)) {
      newGame();
      stepper.reset();
    }

    // 0. 瞄准镜:Shift 开/关镜,Z 切倍率,滚轮调表尺;数字键换弹;F 维修
    const alive = !game.player.isDead;
    if (locked && alive) {
      if (pressed(input, KEYS.scope)) {
        scoped = !scoped;
        if (scoped) orbit.setSight(magnifications[zoomIndex]);
        else orbit.setThirdPerson();
      }
      if (pressed(input, KEYS.zoom) && magnifications.length > 1) {
        zoomIndex = (zoomIndex + 1) % magnifications.length;
        if (scoped) orbit.setSight(magnifications[zoomIndex]);
      }
      const steps = input.consumeWheelSteps();
      // steps > 0 = 滚轮往下(朝自己)
      const dir = CONTROLS.wheelDownIncreasesRange ? 1 : -1;
      if (steps !== 0) sightRange = THREE.MathUtils.clamp(sightRange + dir * steps * SIGHT_RANGE.step, 0, SIGHT_RANGE.max);
      KEYS.ammo.forEach((codes, i) => {
        if (pressed(input, codes)) game.selectShell(i);
      });
      if (pressed(input, KEYS.repair)) game.toggleRepair();
    } else {
      input.consumeWheelSteps();
      if (!alive && scoped) {
        scoped = false;
        orbit.setThirdPerson();
      }
    }

    // 1. 鼠标转动视角
    const { dx, dy } = input.consumeMouseDelta();
    if (locked) orbit.rotate(dx, dy);
    updateCamera();

    // 2. 准星射线 → 世界瞄准点 → 玩家控制
    const ray = orbit.getAimRay();
    const hit = game.raycast(ray.origin, ray.dir, AIM_DISTANCE, game.player);
    aimPoint.copy(hit ?? ray.origin.addScaledVector(ray.dir, AIM_DISTANCE));
    const controls = readPlayerControls(input, aimPoint, locked && !game.player.isDead, sightRange);
    if (justLocked) controls.fire = false;
    game.setPlayerControls(controls);

    // 3. 固定步长模拟 + 插值渲染;鼠标没锁定(开始界面 / Esc)时暂停
    if (locked) stepper.advance(dt, (step) => game.fixedUpdate(step));
    game.syncVisuals(stepper.alpha);
    updateCamera();
    const pp = game.player.root.position;
    sun.position.set(pp.x + 60, pp.y + 120, pp.z + 40);
    sun.target.position.copy(pp);

    // 4. HUD / 击杀回放 / 小地图
    for (const e of game.drainEvents()) {
      hud.onEvent(e, game.time);
      if (e.type === 'hit' && e.shooterId === game.player.id && e.replay.destroyed) killcam.play(e.replay);
    }
    const weapon = game.player.primaryWeapon;
    const pos = game.player.physicsPosition();
    hud.update(
      {
        damage: game.player.damage,
        reloadRemaining: game.player.reloadRemaining,
        reloadTime: weapon?.reloadTime ?? 0,
        loaded: game.player.loaded ? `${game.player.loaded.shell.name}` : null,
        ammo: (weapon?.ammo ?? []).map((a, i) => ({
          name: a.name,
          type: SHELL_SHORT[a.type],
          count: game.player.damage.rounds(a.id) + (game.player.loaded?.shell.id === a.id ? 1 : 0),
          selected: i === game.player.selectedShell,
        })),
        speedKmh: Math.abs(game.player.forwardSpeed) * 3.6,
        surface: SURFACES[game.map.surfaceAt(pos.x, pos.z)].name,
        targetsDestroyed: game.targetsDestroyed,
        targetsTotal: game.targets.length,
        gunMarker: projectGunMarker(game, camera),
        pointerLocked: locked,
        victory: game.state === 'victory',
        defeat: game.state === 'defeat',
        scoped,
        sightRange,
        magnification: magnifications[zoomIndex],
      },
      game.time,
    );
    sight.draw({
      active: scoped,
      fovDeg: orbit.fov,
      magnification: magnifications[zoomIndex],
      range: sightRange,
      reticle: player.spec.sight.reticle,
      // 击杀回放画在同一个 WebGL 画布的右上角,瞄准镜遮罩要给它挖个洞
      cutout: killcam.active
        ? { x: window.innerWidth - KILLCAM.width - KILLCAM.margin, y: KILLCAM.margin, w: KILLCAM.width, h: KILLCAM.height }
        : null,
    });
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(game.player.physicsQuaternion());
    minimap.draw(
      { x: pos.x, z: pos.z, heading: Math.atan2(-fwd.x, -fwd.z), view: orbit.yaw },
      game.targets.map((t) => {
        const p = t.physicsPosition();
        return { x: p.x, z: p.z, dead: t.isDead, alerted: game.isAlerted(t) };
      }),
    );

    renderer.render(scene, camera);
    killcam.update(now);
    killcam.render(renderer);
    input.endFrame();
  };
  requestAnimationFrame(frame);
}

/** 火炮实际指向(扣掉表尺抬高量后的瞄准线命中点)在屏幕上的位置 */
function projectGunMarker(game: Game, camera: THREE.PerspectiveCamera): { x: number; y: number } | null {
  const m = game.player.boresight();
  const p = game.raycast(m.origin, m.dir, AIM_DISTANCE, game.player) ?? m.origin.clone().addScaledVector(m.dir, AIM_DISTANCE);
  const ndc = p.project(camera);
  if (ndc.z > 1 || Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return null;
  return { x: ((ndc.x + 1) / 2) * window.innerWidth, y: ((1 - ndc.y) / 2) * window.innerHeight };
}

start().catch((err) => {
  console.error(err);
  document.body.textContent = `启动失败:${String(err)}`;
});
