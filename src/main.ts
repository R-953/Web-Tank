import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FixedStepper } from './engine/FixedStepper';
import { InputManager } from './engine/Input';
import { ActionInput } from './engine/ActionInput';
import { OrbitCamera } from './engine/OrbitCamera';
import { FreeLook } from './engine/FreeLook';
import { Game, type GameEvent } from './game/Game';
import { readPlayerControls } from './game/PlayerController';
import { buildTerrain } from './game/terrain';
import { SIGHT_RANGE } from './game/Ballistics';
import { clampLoadout, defaultLoadout } from './game/Loadout';
import { MAPS, RIVER_VALLEY } from './data/maps';
import { VEHICLES } from './data/vehicles';
import { bindingShort, type ActionId } from './data/controls';
import { SHELL_SHORT } from './data/shells';
import { SURFACES } from './data/surfaces';
import type { Loadout, MapSpec, VehicleSpec } from './data/types';
import { SettingsStore, type GameSettings } from './settings/Settings';
import { ProfileStore, activeVehicleId, advanceTime, assignVehicle, selectCrew, setActiveNation, type Profile, type ProfileVehicle } from './settings/Profile';
import { progressAfter } from './game/crew/progress';
import { activeCrewSkill, crewSkillFor } from './game/crew/skill';
import { applyModifications } from './data/modifications';
import { applyPaint } from './data/paints';
import { ModificationStore } from './settings/ModificationStore';
import { PaintStore } from './settings/PaintStore';
import { SoundManager, type ImpactKind, type SoundSource } from './audio/Sound';
import { Hud, type HudState } from './ui/Hud';
import { SightOverlay, azimuthFromYaw } from './ui/SightOverlay';
import { KillCam, killcamRect } from './ui/KillCam';
import { killcamPlan } from './ui/killcamPolicy';
import { WorldReplay } from './ui/WorldReplay';
import { WorldXray } from './ui/WorldXray';
import { canShowResult, useWorldReplay, xrayFadeTarget } from './ui/worldReplayFlow';
import { Minimap, type MapLike, type MinimapMarker } from './ui/Minimap';
import { InternalsView } from './ui/InternalsView';
import { internalsSnapshot } from './game/internalsSnapshot';
import { MapScreen } from './ui/MapScreen';
import { currentSymbology, setSymbology } from './ui/symbols';
import { HangarScene } from './ui/menu/Hangar';
import { setThumbnailAppearance } from './ui/menu/thumbnails';
import { MainMenu, type MenuSelection } from './ui/menu/MainMenu';
import { PauseMenu } from './ui/menu/PauseMenu';
import { SettingsPanel } from './ui/menu/SettingsPanel';
import { ModificationsScreen } from './ui/menu/ModificationsScreen';
import { CustomizationScreen } from './ui/menu/CustomizationScreen';
import { CrewScreen } from './ui/menu/CrewScreen';

/** 准星射线的最远距离,m */
const AIM_DISTANCE = 4000;
const SKY = 0xa9cbe6;
/** 阴影只覆盖玩家周围这么大的范围(半边长,m),光源跟着玩家走 */
const SHADOW_RANGE = 150;
/** 胜负已分后多久(真实时间,秒)弹出结算 */
const RESULT_DELAY = 2.5;
/** Alt 光标模式:两次点击间隔多短算双击,毫秒 */
const DOUBLE_CLICK_MS = 380;

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

function saveLastSelection(vehicleId: string, mapId: string): void {
  try {
    localStorage.setItem('webtank.selection', JSON.stringify({ vehicleId, mapId }));
  } catch {
    /* 忽略 */
  }
}

/** 上次在机库里选的载具和地图 */
function loadLastSelection(): { vehicleId: string; mapId: string } {
  try {
    const raw = localStorage.getItem('webtank.selection');
    if (raw) {
      const s = JSON.parse(raw) as { vehicleId?: string; mapId?: string };
      return { vehicleId: s.vehicleId && VEHICLES[s.vehicleId] ? s.vehicleId : 'tiger_i', mapId: s.mapId && MAPS[s.mapId] ? s.mapId : RIVER_VALLEY.id };
    }
  } catch {
    /* 忽略 */
  }
  return { vehicleId: 'tiger_i', mapId: RIVER_VALLEY.id };
}

/** 页面开着的时候多久把「最后在线时刻」记一次,ms(在线时间不算挂机成长,见设计稿 3.2) */
const ONLINE_HEARTBEAT_MS = 30_000;

/**
 * 车组与编组存档。设置里打开了「离线挂机成长」时,打开页面补算上次关闭以来的离线成长(默认关闭,只把 lastSeen 记成现在);
 * 页面开着时定期把 lastSeen 记成当前时刻,这样下次打开只补算关掉以后的时间。
 * 第一次用新存档时,沿用旧版「上次选的车」决定当前国家和第一个车组的车。
 */
function openProfileStore(vehicles: readonly ProfileVehicle[], lastVehicleId: string, offlineGrowth: boolean): ProfileStore {
  let fresh = true;
  try {
    fresh = localStorage.getItem('webtank.profile.v1') === null;
  } catch {
    /* 无痕模式等:当作新存档 */
  }
  const store = new ProfileStore(vehicles);
  let p: Profile = store.get();
  const last = vehicles.find((v) => v.id === lastVehicleId);
  if (fresh && last) {
    p = setActiveNation(p, last.nation);
    p = assignVehicle(p, last.nation, p.nations[last.nation].activeLineup, 0, last.id, vehicles);
  }
  store.set(offlineGrowth ? advanceTime(p, Date.now(), progressAfter) : { ...p, lastSeen: Date.now() });

  const touch = () => store.set({ ...store.get(), lastSeen: Date.now() });
  window.setInterval(touch, ONLINE_HEARTBEAT_MS);
  window.addEventListener('pagehide', touch);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') touch();
  });
  return store;
}

async function start(): Promise<void> {
  await RAPIER.init();
  const settings = new SettingsStore();
  const cfg = () => settings.value;

  // --- 渲染(对数深度缓冲:3 km 的地图上远处地形不闪烁)。抗锯齿只能在创建时决定
  const renderer = new THREE.WebGLRenderer({ antialias: cfg().graphics.antialias, logarithmicDepthBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const fog = new THREE.Fog(SKY, 1500, 6000);
  scene.fog = fog;
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a5040, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -SHADOW_RANGE, right: SHADOW_RANGE, top: SHADOW_RANGE, bottom: -SHADOW_RANGE, near: 1, far: 800 });
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 8000);
  const orbit = new OrbitCamera(camera);
  const hangar = new HangarScene();
  hangar.resize(window.innerWidth, window.innerHeight);

  // --- 声音(浏览器要求用户操作之后才能出声:任何点击 / 按键都尝试恢复)
  const sound = new SoundManager(cfg().sound);
  const wake = () => sound.resume();
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
  const uiClick = () => sound.uiClick();

  // --- 输入
  const input = new InputManager();
  input.attach(window);
  const actions = new ActionInput(input, cfg().controls.bindings);

  // --- 界面:瞄准镜遮罩 < HUD < 小地图 < 击杀回放边框 < 暂停菜单 < 主界面 < 设置
  const sight = new SightOverlay(document.body);
  const hud = new Hud(document.body);
  const killcam = new KillCam(document.body);
  const worldReplay = new WorldReplay(scene, camera, document.body);
  let worldXray: WorldXray | null = null;
  let worldReplayFinishAt: number | null = null;
  const internalsView = new InternalsView(document.body);
  /** 玩家按 O 想看内构(地图界面开着时临时藏起来) */
  let internalsOn = false;
  const minimap = new Minimap(document.body);
  const settingsPanel = new SettingsPanel(document.body, settings, { onUiSound: uiClick });

  let appState: 'menu' | 'battle' = 'menu';
  let selection: MenuSelection | null = null;
  /** 这一局是怎么开的(试驾 / 正常出战);重新开始时沿用 */
  interface BattleKind {
    practice?: boolean;
    /** 试驾时右键点的车组序号(技能按这个车组算);缺省 = 当前车组 */
    crewIndex?: number;
  }
  let battleKind: BattleKind = {};
  let game: Game | null = null;
  let scoped = false;
  let zoomIndex = 0;
  let sightRange = 0;
  let cursor: { x: number; y: number } | null = null;
  const freeLook = new FreeLook();
  // 双击按事件时间判断(不受帧率影响)
  let lastDown = -1e9;
  let doubleClick = false;
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !cursor) return;
    if (e.timeStamp - lastDown < DOUBLE_CLICK_MS) {
      doubleClick = true;
      lastDown = -1e9;
    } else {
      lastDown = e.timeStamp;
    }
  });
  let resultAt: number | null = null;
  let resultShown = false;
  let wasLoaded = true;
  const stats = { shots: 0, hits: 0, kills: 0 };
  const stepper = new FixedStepper(1 / 60);

  const lockPointer = () => {
    if (document.pointerLockElement === canvas) return;
    // unadjustedMovement:绕过系统的鼠标加速,也避开 Chrome 在 Windows 上偶发的位移尖峰;不支持时退回普通锁定
    const request = (opts?: object) => (canvas.requestPointerLock as (o?: object) => Promise<void> | void).call(canvas, opts);
    try {
      const p = request({ unadjustedMovement: true });
      if (p && typeof (p as Promise<void>).catch === 'function') {
        (p as Promise<void>).catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'NotSupportedError') void request();
        });
      }
    } catch {
      void request();
    }
  };

  const lastSelection = loadLastSelection();
  const profileVehicles: ProfileVehicle[] = Object.values(VEHICLES)
    .filter((v) => v.nation)
    .map((v) => ({ id: v.id, nation: v.nation!, family: v.family ?? v.id }));
  const profiles = openProfileStore(profileVehicles, lastSelection.vehicleId, cfg().game.offlineGrowth);

  // --- 改装与涂装:存档在本机;改装只改玩家那一辆的数据(Game 的 playerSpec),涂装另外在机库里实时预览
  const modStore = new ModificationStore();
  const paintStore = new PaintStore();
  /** 机库里看到的样子:只套涂装 */
  const showcaseOf = (spec: VehicleSpec): VehicleSpec => applyPaint(spec, paintStore.get(spec.id));
  /** 进战斗时玩家那辆车的数据:改装(性能)+ 涂装(颜色) */
  // 编组栏 / 科技树 / 各界面里的缩略图也按已选涂装显示
  setThumbnailAppearance(showcaseOf);
  const playerSpecOf = (spec: VehicleSpec): VehicleSpec => applyPaint(applyModifications(spec, modStore.get(spec.id)), paintStore.get(spec.id));

  const modificationsScreen = new ModificationsScreen({
    parent: document.body,
    getEnabled: (id) => modStore.get(id),
    setEnabled: (id, ids) => modStore.set(id, ids),
    onUiSound: uiClick,
  });
  const customizationScreen = new CustomizationScreen({
    parent: document.body,
    getPaint: (id) => paintStore.get(id),
    setPaint: (id, paintId) => paintStore.set(id, paintId),
    // 选中方案时机库里的模型立刻换色;取消 / 关闭时 onClose 会按存档恢复
    onPreview: (spec) => hangar.setVehicle(spec),
    onClose: () => {
      hangar.setVehicle(showcaseOf(menu.selection().vehicle));
      menu.refresh();
    },
    onUiSound: uiClick,
  });
  const crewScreen = new CrewScreen({
    parent: document.body,
    vehicles: Object.values(VEHICLES),
    getProfile: () => profiles.get(),
    offlineGrowth: () => cfg().game.offlineGrowth,
    onUiSound: uiClick,
  });

  /** 右键菜单点了某辆车:先把这个车组选成当前车组,机库里的模型和后面的界面才对得上这辆车 */
  const focusCrew = (crewIndex: number): void => {
    const p = profiles.get();
    const nation = p.nations[p.activeNation];
    if (nation && nation.lineups.find((l) => l.id === nation.activeLineup)?.selected !== crewIndex) {
      profiles.set(selectCrew(p, p.activeNation, nation.activeLineup, crewIndex));
      menu.refresh();
    }
  };

  const menu = new MainMenu({
    parent: document.body,
    settings,
    settingsPanel,
    vehicles: Object.values(VEHICLES),
    maps: [RIVER_VALLEY, ...Object.values(MAPS).filter((m) => m.id !== RIVER_VALLEY.id)],
    initial: lastSelection,
    profile: { get: () => profiles.get(), set: (p) => profiles.set(p) },
    loadLoadout: loadSavedLoadout,
    onVehicleChange: (spec) => hangar.setVehicle(showcaseOf(spec)),
    onStart: (sel) => openSpawnMap(sel),
    onOpenModifications: (vehicleId, crewIndex) => {
      const spec = VEHICLES[vehicleId];
      if (!spec) return;
      focusCrew(crewIndex);
      modificationsScreen.open(spec);
    },
    onOpenCustomization: (vehicleId, crewIndex) => {
      const spec = VEHICLES[vehicleId];
      if (!spec) return;
      focusCrew(crewIndex);
      customizationScreen.open(spec);
    },
    onTestDrive: (vehicleId, crewIndex) => testDrive(vehicleId, crewIndex),
    onOpenCrew: (nation, crewIndex) => {
      focusCrew(crewIndex);
      crewScreen.open(nation, crewIndex);
    },
    onUiSound: uiClick,
  });
  hangar.setVehicle(showcaseOf(menu.selection().vehicle));
  hangar.bindDrag(menu.dragSurface);

  const pause = new PauseMenu(
    document.body,
    {
      onResume: () => lockPointer(),
      onSettings: () => settingsPanel.open(),
      onRestart: () => {
        restartBattle();
        lockPointer();
      },
      onExit: () => backToHangar(),
    },
    { onUiSound: uiClick },
  );

  // --- 地图界面:出战前(spawn)调携弹、选车组;战斗中(battle)按 M 查看大地图、调下一局的携弹
  /** 地图界面用的地形网格,按地图 id 缓存(开局之前就要用,不能等 Game 创建) */
  const mapViews = new Map<string, MapLike>();
  const mapViewOf = (spec: MapSpec): MapLike => {
    let v = mapViews.get(spec.id);
    if (!v) {
      v = { spec, grid: buildTerrain(spec) };
      mapViews.set(spec.id, v);
    }
    return v;
  };
  /** 机库点「进入战斗」时的选择:地图在这里定,车以出战那一刻存档里选中的车组为准 */
  let spawnSelection: MenuSelection | null = null;

  const mapScreen = new MapScreen({
    parent: document.body,
    vehicles: Object.values(VEHICLES),
    getProfile: () => profiles.get(),
    loadLoadout: loadSavedLoadout,
    saveLoadout,
    // 符号体系以设置为准:每次打开地图界面都重新读,不用构造时的值
    get symbology() {
      return cfg().game.symbology;
    },
    onSymbologyChange: (v) => settings.update((d) => (d.game.symbology = v)),
    onSelectCrew: (index) => {
      const p = profiles.get();
      profiles.set(selectCrew(p, p.activeNation, p.nations[p.activeNation].activeLineup, index));
      menu.refresh();
    },
    onConfirm: () => (appState === 'battle' ? closeBattleMap() : sortie()),
    onUiSound: uiClick,
  });

  function openSpawnMap(sel: MenuSelection): void {
    spawnSelection = sel;
    menu.hide();
    mapScreen.open(mapViewOf(sel.map), 'spawn');
  }

  /** 地图界面里点「出战」:载具和携弹都按存档重新读,再开局、锁鼠标 */
  function sortie(): void {
    if (!spawnSelection) return;
    const vehicle = VEHICLES[activeVehicleId(profiles.get())] ?? spawnSelection.vehicle;
    const sel: MenuSelection = { vehicle, map: spawnSelection.map, loadout: loadSavedLoadout(vehicle) };
    saveLastSelection(vehicle.id, sel.map.id);
    startBattle(sel);
    lockPointer();
  }

  /** 战斗中按 M:先打开地图界面再解锁鼠标,pointerlockchange 里看到地图开着就不弹暂停菜单 */
  function openBattleMap(): void {
    if (!game || mapScreen.isOpen) return;
    mapScreen.open(mapViewOf(game.map.spec), 'battle');
    worldXray?.disable();
    // 地图界面的遮罩是半透明的,不藏小地图和 HUD 会透出来
    minimap.setVisible(false);
    hud.setVisible(false);
    cursor = null;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  /** 关地图界面回战斗(再按 M / 点「返回战斗」);Esc 也走这里,锁不上时由 pointerlockerror 弹暂停菜单 */
  function closeBattleMap(): void {
    closeMapScreen();
    lockPointer();
  }

  /** 战斗中关地图界面:小地图和 HUD 跟着恢复 */
  function closeMapScreen(): void {
    mapScreen.close();
    minimap.setVisible(true);
    hud.setVisible(true);
  }

  function restartBattle(): void {
    if (selection) startBattle({ ...selection, loadout: loadSavedLoadout(selection.vehicle) }, battleKind);
  }

  /** 试驾:在机库里选的地图上开一局,靶车不还击、全灭也不结束(右键菜单「试驾」) */
  function testDrive(vehicleId: string, crewIndex: number): void {
    const vehicle = VEHICLES[vehicleId];
    if (!vehicle) return;
    startBattle({ vehicle, map: menu.selection().map, loadout: loadSavedLoadout(vehicle) }, { practice: true, crewIndex });
    lockPointer();
  }

  // --- 设置生效
  const applySettings = (s: GameSettings) => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * s.graphics.renderScale);
    renderer.setSize(window.innerWidth, window.innerHeight);
    const shadows = s.graphics.shadows !== 'off';
    const mapSize = s.graphics.shadows === 'high' ? 2048 : 1024;
    if (renderer.shadowMap.enabled !== shadows || sun.shadow.mapSize.x !== mapSize) {
      renderer.shadowMap.enabled = shadows;
      sun.castShadow = shadows;
      sun.shadow.mapSize.set(mapSize, mapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      // 阴影开关会改变着色器,已有材质要重新编译
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
      });
    }
    fog.near = s.graphics.viewDistance * 0.35;
    fog.far = s.graphics.viewDistance;
    camera.far = s.graphics.viewDistance + 800;
    camera.updateProjectionMatrix();
    orbit.setSensitivity({
      mouse: s.controls.mouseSensitivity,
      sight: s.controls.sightSensitivity,
      scaleWithZoom: s.controls.scaleWithZoom,
      invertY: s.controls.invertY,
    });
    actions.setBindings(s.controls.bindings);
    minimap.setShape(s.game.minimapShape);
    minimap.setMarkerStyle(s.game.minimapMarkers);
    if (s.game.symbology !== currentSymbology()) {
      setSymbology(s.game.symbology);
      menu.refresh();
    }
    sound.applySettings(s.sound);
  };
  applySettings(cfg());
  settings.subscribe(applySettings);
  // 玩家绑定了的键在战斗中拦截浏览器默认行为(Alt 聚焦菜单、空格滚动、侧键后退等);Esc 永远留给浏览器退出鼠标锁定
  input.setPreventDefault((code) => appState === 'battle' && document.pointerLockElement === canvas && code !== 'Escape' && actions.isBound(code));

  // --- 一局游戏
  function startBattle(sel: MenuSelection, kind: BattleKind = {}): void {
    selection = sel;
    battleKind = kind;
    game?.dispose();
    const g = cfg().graphics;
    game = new Game({
      map: sel.map,
      vehicles: VEHICLES,
      playerVehicleId: sel.vehicle.id,
      playerSpec: playerSpecOf(sel.vehicle),
      // 试驾的车不一定是当前车组的车,技能按右键点的那个车组算
      playerCrewSkill:
        kind.crewIndex === undefined
          ? activeCrewSkill(profiles.get(), profileVehicles)
          : crewSkillFor(profiles.get(), profileVehicles, sel.vehicle.nation ?? '', kind.crewIndex, sel.vehicle.id),
      playerLoadout: sel.loadout,
      enemyAi: kind.practice ? false : undefined,
      practice: kind.practice,
      aiPreset: cfg().game.aiPreset,
      vegetation: { density: g.vegetation, grassDistance: g.grassDistance },
    });
    scene.add(game.root);
    orbit.yaw = (sel.map.spawns.player.heading * Math.PI) / 180;
    orbit.pitch = -0.12;
    scoped = false;
    zoomIndex = 0;
    sightRange = 0;
    cursor = null;
    freeLook.reset();
    resultAt = null;
    resultShown = false;
    wasLoaded = true;
    Object.assign(stats, { shots: 0, hits: 0, kills: 0 });
    orbit.setThirdPerson();
    orbit.snapFov();
    internalsOn = false;
    worldXray?.disable();
    worldXray = new WorldXray(game.player);
    hud.reset();
    killcam.stop();
    worldReplay.stop();
    worldReplayFinishAt = null;
    minimap.setMap(game.map);
    stepper.reset();
    appState = 'battle';
    menu.hide();
    pause.hide();
    mapScreen.close();
    hud.setVisible(true);
    minimap.setVisible(true);
  }

  function backToHangar(): void {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    game?.dispose();
    game = null;
    appState = 'menu';
    pause.hide();
    mapScreen.close();
    killcam.stop();
    worldReplay.stop();
    worldReplayFinishAt = null;
    worldXray?.disable();
    worldXray = null;
    internalsOn = false;
    internalsView.setVisible(false);
    hud.setVisible(false);
    minimap.setVisible(false);
    sight.draw({ active: false, fovDeg: 70, magnification: 1, range: 0, reticle: 'german', cutout: null });
    sound.engine({ rpm: 0, load: 0, running: false });
    sound.fire(false);
    menu.show();
  }

  function showResult(): void {
    if (!game || resultShown) return;
    resultShown = true;
    if (mapScreen.isOpen) closeMapScreen();
    const t = Math.round(game.time);
    const lines = [
      `用时 ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`,
      `击毁 ${game.targetsDestroyed} / ${game.targets.length}`,
      `主炮开火 ${stats.shots} 发 · 命中 ${stats.hits} 发`,
    ];
    pause.show(game.state === 'victory' ? 'victory' : 'defeat', { lines });
  }

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (appState !== 'battle' || !game) return;
    if (locked) {
      if (mapScreen.isOpen) closeMapScreen();
      pause.hide();
      settingsPanel.close();
      input.reset();
      stepper.reset();
    } else if (mapScreen.isOpen) {
      // 按 M 主动解锁来看大地图,不弹暂停菜单
      cursor = null;
    } else if (game.state !== 'playing') {
      showResult();
    } else {
      cursor = null;
      worldXray?.disable();
      pause.show('pause');
    }
  });
  // 重新锁鼠标失败(比如在地图界面按 Esc 回来:Esc 不算用户操作,浏览器不让锁):弹暂停菜单,点「继续」再锁
  document.addEventListener('pointerlockerror', () => {
    if (appState === 'battle' && game && game.state === 'playing' && !mapScreen.isOpen && document.pointerLockElement !== canvas) {
      worldXray?.disable();
      pause.show('pause');
    }
  });
  // 地图界面里按 Esc:出战前回机库,战斗中回战斗
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !mapScreen.isOpen) return;
    if (appState === 'battle') {
      closeBattleMap();
    } else {
      mapScreen.close();
      menu.show();
    }
  });

  hud.setVisible(false);
  minimap.setVisible(false);
  menu.show();

  // 调试:地址栏加 ?debug 后,可在浏览器控制台用 __debug.game() 查看当前对局状态
  if (new URLSearchParams(location.search).has('debug')) {
    Object.assign(window, {
      __debug: {
        game: () => game,
        orbit,
        camera,
        killcam,
        worldReplay,
        worldXray: () => worldXray,
        minimap,
        mapScreen,
        internalsView,
        profiles,
        settings,
        input,
        actions,
        state: () => appState,
        pause: () => pause.mode,
        sight: () => ({ scoped, zoomIndex, sightRange }),
        cursor: () => cursor,
        sound,
        /** 不渲染、直接推进 seconds 秒游戏时间(沿用当前的玩家操作),给自动化测试快进用 */
        advance: (seconds: number) => {
          for (let i = 0; i < Math.round(seconds * 60) && game; i++) game.fixedUpdate(1 / 60);
        },
      },
    });
  }

  const aimPoint = new THREE.Vector3();
  const sightPos = new THREE.Vector3();
  const heightAt = (x: number, z: number) => game!.map.heightAt(x, z);
  /** dt 只在每帧第一次调用时传,让视场过渡每帧只推进一次;同一帧里再调用传 0 */
  const updateCamera = (dt: number) => {
    if (worldReplay.active) return;
    const g = game!;
    g.player.root.visible = !scoped;
    orbit.update(g.player.root.position, heightAt, scoped ? g.player.sightWorldPosition(sightPos) : undefined, dt);
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    hangar.resize(window.innerWidth, window.innerHeight);
  });

  /** 声源相对镜头的距离和左右声道 */
  const right = new THREE.Vector3();
  const toSrc = new THREE.Vector3();
  const soundAt = (p: THREE.Vector3): SoundSource => {
    toSrc.copy(p).sub(camera.position);
    const distance = toSrc.length();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    return { distance, pan: distance > 1 ? toSrc.dot(right) / distance : 0 };
  };
  const IMPACT_SOUND: Record<string, ImpactKind> = {
    penetration: 'penetration',
    nonpen: 'nonpen',
    ricochet: 'ricochet',
    ground: 'ground',
    water: 'ground',
    bush: 'tree',
    tree: 'tree',
  };
  const playEventSound = (e: GameEvent) => {
    if (e.type === 'fired') {
      const src = soundAt(e.origin);
      if (e.weapon === 'mg') sound.machineGun(src);
      else sound.cannon(e.caliber, src);
    } else if (e.type === 'impact') {
      const src = soundAt(e.point);
      // 远处的子弹弹着听不见,不浪费声道
      if (e.caliber < 20 && src.distance > 200) return;
      sound.impact(IMPACT_SOUND[e.kind] ?? 'ground', src);
    } else if (e.type === 'destroyed') {
      sound.explosion(e.cause === 'ammo' ? 25 : 6, soundAt(e.position));
    } else if (e.type === 'tree-felled') {
      sound.impact('tree', soundAt(e.point));
    }
  };

  const key = (a: ActionId) => bindingShort(cfg().controls.bindings[a][0] ?? cfg().controls.bindings[a][1]);
  const hints = () => {
    const move = [key('forward'), key('left'), key('back'), key('right')].join('');
    return `${move} 移动 · ${key('fireMain')} 主炮 · ${key('fireMg')} 机枪 · 1–4 弹种 · ${key('scope')} 开镜 · ${key('zoomCycle')} 放大 / 倍率 · 表尺 ${key('rangeUp')} / ${key('rangeDown')} · ${key('repair')} 维修 · ${key('extinguish')} 灭火 · 按住 ${key('freeLook')} 自由视角 · 按住 ${key('cursor')} 操作小地图 · ${key('mapScreen')} 地图 · ${key('internals')} 内构 · Esc 暂停`;
  };

  let last = performance.now();
  let wasLocked = false;
  let fps = 60;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    actions.beginFrame();

    if (appState === 'menu' || !game) {
      hangar.update(dt);
      renderer.render(hangar.scene, hangar.camera);
      input.consumeMouseDelta();
      input.endFrame();
      return;
    }

    const g = game;
    const locked = document.pointerLockElement === canvas;
    // 用来锁定鼠标的那一下点击不算开火
    const justLocked = locked && !wasLocked;
    wasLocked = locked;
    const player = g.player;
    const magnifications = player.spec.sight.magnifications;
    const alive = !player.isDead;

    // 0. Alt 光标模式:鼠标移动虚拟光标,操作小地图;绑定在鼠标上的操作全部停用(键盘照常)
    const cursorMode = locked && actions.isDown('cursor');
    actions.mouseEnabled = !cursorMode;
    minimap.setCursorMode(cursorMode);
    const { dx, dy } = input.consumeMouseDelta();
    if (cursorMode) {
      cursor ??= { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      cursor.x = THREE.MathUtils.clamp(cursor.x + dx, 0, window.innerWidth - 1);
      cursor.y = THREE.MathUtils.clamp(cursor.y + dy, 0, window.innerHeight - 1);
      const wheel = actions.wheel();
      if (wheel.up || wheel.down) minimap.zoomAt(cursor.x, cursor.y, wheel.down - wheel.up);
      if (doubleClick) {
        const w = minimap.screenToWorld(cursor.x, cursor.y);
        if (w) {
          // 双击已有标记附近 = 取消标记
          const m = minimap.marker;
          const near = m && Math.hypot(m.x - w.x, m.z - w.z) < g.map.spec.size * 0.015;
          minimap.setMarker(near ? null : w);
          sound.uiClick();
        }
      }
    } else if (cursor) {
      cursor = null;
    }
    doubleClick = false;

    // 1. 瞄准镜 / 弹种 / 维修 / 灭火 等按键
    if (locked && actions.pressed('restart') && selection) {
      restartBattle();
      // 提前结束这一帧也要清空「刚按下」,否则下一帧还会读到重开键,变成每帧都重开一局
      input.endFrame();
      return;
    }
    if (locked && actions.pressed('internals')) internalsOn = !internalsOn;
    if (actions.pressed('mapScreen')) {
      if (mapScreen.isOpen) closeBattleMap();
      else if (locked) openBattleMap();
    }
    if (locked && actions.pressed('minimapShape')) {
      settings.update((d) => (d.game.minimapShape = d.game.minimapShape === 'square' ? 'circle' : 'square'));
    }
    if (locked && alive) {
      if (actions.pressed('scope')) {
        scoped = !scoped;
        if (scoped) orbit.setSight(magnifications[zoomIndex]);
        else orbit.setThirdPerson();
      }
      const setZoom = (i: number) => {
        zoomIndex = THREE.MathUtils.clamp(i, 0, magnifications.length - 1);
        if (scoped) orbit.setSight(magnifications[zoomIndex]);
      };
      if (scoped) {
        if (actions.pressed('zoomCycle') && magnifications.length > 1) setZoom((zoomIndex + 1) % magnifications.length);
        if (actions.pressed('zoomIn')) setZoom(zoomIndex + 1);
        if (actions.pressed('zoomOut')) setZoom(zoomIndex - 1);
      } else {
        if (actions.pressed('zoomCycle')) orbit.toggleThirdZoom();
        if (actions.pressed('zoomIn')) orbit.setThirdZoom(true);
        if (actions.pressed('zoomOut')) orbit.setThirdZoom(false);
      }
      const steps = actions.count('rangeUp') - actions.count('rangeDown');
      if (steps !== 0) sightRange = THREE.MathUtils.clamp(sightRange + steps * SIGHT_RANGE.step, 0, SIGHT_RANGE.max);
      (['shell1', 'shell2', 'shell3', 'shell4'] as const).forEach((a, i) => {
        if (actions.pressed(a)) g.selectShell(i);
      });
      if (actions.pressed('nextShell')) g.nextShell();
      if (actions.pressed('repair')) g.toggleRepair();
      if (actions.pressed('extinguish')) g.extinguish();
    } else if (!alive && (scoped || orbit.thirdZoomed)) {
      scoped = false;
      orbit.setThirdPerson();
    }
    if (!alive) {
      internalsOn = false;
      if (worldXray?.enabled) worldXray.disable();
    }

    // 2. 鼠标转动视角(光标模式下不转)。自由视角:按住时瞄准点冻结,松开后视角复原(开镜时不可用)
    const looking = freeLook.update(locked && alive && !scoped && !cursorMode && actions.isDown('freeLook'), orbit);
    if (locked && !cursorMode) orbit.rotate(dx, dy);
    updateCamera(dt);

    // 3. 准星射线 → 世界瞄准点 → 玩家控制(自由视角期间沿用按下时的瞄准点)
    if (!looking) {
      const ray = orbit.getAimRay();
      const hit = g.raycast(ray.origin, ray.dir, AIM_DISTANCE, player);
      aimPoint.copy(hit ?? ray.origin.addScaledVector(ray.dir, AIM_DISTANCE));
    }
    const controls = readPlayerControls(actions, aimPoint, locked && alive, sightRange);
    if (justLocked) controls.fire = false;
    g.setPlayerControls(controls);

    // 4. 固定步长模拟 + 插值渲染;暂停(没锁定鼠标)时停住,胜负已分后继续跑(残骸冒烟等)
    // 地图界面开着时对局继续跑(玩家车不受控,敌人照常行动)
    const simulate = locked || mapScreen.isOpen || g.state !== 'playing';
    if (simulate) stepper.advance(dt, (step) => g.fixedUpdate(step));
    g.syncVisuals(stepper.alpha);
    updateCamera(0);
    if (worldReplay.active) {
      worldReplay.update(now);
      if (worldReplay.finished) {
        worldReplayFinishAt ??= now;
        if (now - worldReplayFinishAt >= 500) {
          worldReplay.stop();
          worldReplayFinishAt = null;
        }
      } else {
        worldReplayFinishAt = null;
      }
    }
    g.updateVisuals(dt, camera.position);
    const pp = player.root.position;
    sun.position.set(pp.x + 60, pp.y + 120, pp.z + 40);
    sun.target.position.copy(pp);

    // 5. 事件:HUD、回放、声音、统计
    for (const e of g.drainEvents()) {
      hud.onEvent(e, g.time);
      playEventSound(e);
      if (e.type === 'fired' && e.shooterId === player.id && e.weapon === 'main') stats.shots++;
      if (e.type === 'hit') {
        if (e.shooterId === player.id) stats.hits++;
        const settings = cfg().game;
        const killerName = g.vehicles.find((v) => v.id === e.shooterId)?.spec.name;
        const plan = killcamPlan({
          playerId: player.id,
          shooterId: e.shooterId,
          targetId: e.targetId,
          targetName: e.targetName,
          killerName,
          destroyed: e.replay.destroyed,
          killCam: settings.killCam,
          killCamAll: settings.killCamAll,
        });
        if (plan) {
          if (useWorldReplay(plan, settings.deathReplayStyle)) {
            if (worldXray?.enabled) worldXray.disable();
            killcam.stop();
            worldReplay.play(player, e.replay, now);
            worldReplayFinishAt = null;
          } else {
            worldReplay.stop();
            killcam.play(e.replay, plan);
          }
        }
      }
    }
    if (g.state !== 'playing') {
      resultAt ??= now;
      if (!resultShown && canShowResult({ gameState: g.state, resultAt, now, delaySec: RESULT_DELAY, killcamActive: killcam.active, worldReplayActive: worldReplay.active })) {
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        else showResult();
      }
    }
    // 装填完成提示音
    const loadedNow = !!player.loaded;
    if (loadedNow && !wasLoaded && alive) sound.reloadDone();
    wasLoaded = loadedNow;
    const engine = player.damage.modules.find((m) => m.type === 'engine');
    sound.engine({ rpm: player.engineRpm, load: Math.abs(player.controls.throttle), running: simulate && alive && (engine ? engine.hp > 0 : true) });
    sound.fire(simulate && !!player.damage.fire);

    // 6. HUD / 瞄准镜 / 小地图
    const weapon = player.primaryWeapon;
    const pos = player.physicsPosition();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(player.physicsQuaternion());
    const heading = Math.atan2(-fwd.x, -fwd.z);
    const bindings = cfg().controls.bindings;
    const mg = player.mg.weapon;
    const marker = minimap.marker;
    let markerState: HudState['marker'] = null;
    if (marker) {
      const mp = new THREE.Vector3(marker.x, g.map.heightAt(marker.x, marker.z) + 2, marker.z);
      const distance = Math.hypot(mp.x - pos.x, mp.z - pos.z);
      const ndc = mp.clone().project(camera);
      const behind = ndc.z > 1 || mp.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())) < 0;
      markerState = { distance, screen: behind ? null : { x: ((ndc.x + 1) / 2) * window.innerWidth, y: ((1 - ndc.y) / 2) * window.innerHeight } };
    }
    const showHud = !mapScreen.isOpen && !worldReplay.active;
    hud.setVisible(showHud);
    hud.update(
      {
        spec: player.spec,
        damage: player.damage,
        turretYaw: player.turretYaw,
        viewYaw: orbit.yaw - heading,
        compassYaw: orbit.yaw,
        speedKmh: player.forwardSpeed * 3.6,
        engineRpm: player.engineRpm,
        throttle: player.controls.throttle,
        surface: SURFACES[g.map.surfaceAt(pos.x, pos.z)].name,
        reloadRemaining: player.reloadRemaining,
        reloadTime: weapon?.reloadTime ?? 0,
        loaded: player.loaded ? player.loaded.shell.name : null,
        ammo: (weapon?.ammo ?? []).map((a, i) => ({
          id: a.id,
          name: a.name,
          type: SHELL_SHORT[a.type],
          count: player.damage.rounds(a.id) + (player.loaded?.shell.id === a.id ? 1 : 0),
          selected: i === player.selectedShell,
          loaded: player.loaded?.shell.id === a.id,
          key: bindingShort(bindings[`shell${i + 1}` as ActionId]?.[0] ?? null) || String(i + 1),
        })),
        mg: mg
          ? {
              name: mg.name,
              inBelt: player.mg.inBelt,
              beltSize: mg.beltSize ?? player.mg.inBelt,
              reserve: player.mg.reserve,
              reloading: player.mg.reloading,
              reloadTime: mg.reloadTime,
              firing: !!player.controls.fireMg && player.mg.inBelt > 0,
              key: key('fireMg'),
            }
          : null,
        keys: {
          fire: key('fireMain'),
          repair: key('repair'),
          extinguish: key('extinguish'),
          nextShell: key('nextShell'),
          scope: key('scope'),
          zoom: key('zoomCycle'),
          cursor: key('cursor'),
        },
        targetsDestroyed: g.targetsDestroyed,
        targetsTotal: g.targets.length,
        gunMarker: projectGunMarker(g, camera),
        scoped,
        sightRange,
        magnification: magnifications[zoomIndex],
        hints: cfg().game.showHints ? hints() : null,
        fps: cfg().game.showFps ? fps : null,
        cursor,
        marker: markerState,
        alive,
      },
      g.time,
    );
    sight.draw({
      active: scoped && !worldReplay.active,
      fovDeg: orbit.displayFov,
      magnification: magnifications[zoomIndex],
      range: sightRange,
      azimuth: azimuthFromYaw(orbit.yaw),
      reticle: player.spec.sight.reticle,
      // 击杀回放画在同一个 WebGL 画布上,瞄准镜遮罩要给它挖个洞
      cutout: killcam.active
        ? killcamRect(killcam.layout, window.innerWidth, window.innerHeight)
        : null,
    });
    const markers: MinimapMarker[] = g.targets.map((t) => {
      const p = t.physicsPosition();
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(t.physicsQuaternion());
      return { x: p.x, z: p.z, team: 'enemy', dead: t.isDead, heading: Math.atan2(-f.x, -f.z), vehicleClass: t.spec.vehicleClass };
    });
    minimap.setVisible(showHud);
    minimap.draw({ x: pos.x, z: pos.z, heading, view: orbit.yaw }, markers);
    if (mapScreen.isOpen) {
      mapScreen.draw({ player: { x: pos.x, z: pos.z, heading }, markers, objective: `摧毁全部靶车 ${g.targetsDestroyed} / ${g.targets.length}` });
    }

    const internalsStyle = cfg().game.internalsStyle;
    const canShowInternals = internalsOn && !mapScreen.isOpen && !pause.visible && alive && !worldReplay.active;

    if (internalsStyle === 'world') {
      internalsView.setVisible(false);
      if (canShowInternals && worldXray) {
        const snap = internalsSnapshot(player);
        if (!worldXray.enabled) {
          worldXray.enable(snap);
        } else {
          worldXray.update(snap);
        }
        worldXray.setFade(xrayFadeTarget({ enabled: true, scoped }));
      } else {
        if (worldXray?.enabled) {
          worldXray.disable();
        }
      }
    } else {
      if (worldXray?.enabled) {
        worldXray.disable();
      }
      internalsView.setVisible(canShowInternals);
      if (internalsView.visible) internalsView.update(internalsSnapshot(player));
    }

    renderer.render(scene, camera);
    killcam.update(now);
    killcam.render(renderer);
    internalsView.render(renderer);
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
