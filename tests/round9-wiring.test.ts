import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RIVER_VALLEY } from '../src/data/maps';
import { VEHICLES } from '../src/data/vehicles';
import { assignVehicle, defaultProfile, recruitCrew, selectCrew, type Profile, type ProfileVehicle } from '../src/settings/Profile';
import type { SettingsStore } from '../src/settings/Settings';
import { MapScreen } from '../src/ui/MapScreen';
import { MainMenu } from '../src/ui/menu/MainMenu';
import type { SettingsPanel } from '../src/ui/menu/SettingsPanel';
import { currentSymbology, setSymbology } from '../src/ui/symbols';

const vehicleList = Object.values(VEHICLES);
const profileVehicles: ProfileVehicle[] = vehicleList.map((v) => ({ id: v.id, nation: v.nation ?? '', family: v.family ?? v.id }));

/** 德国两个车组:车组 0 虎式,车组 1 虎王 */
function twoCrewProfile(): Profile {
  let p = defaultProfile(profileVehicles, 1000);
  p = recruitCrew(p, 'germany');
  return assignVehicle(p, 'germany', 'lineup-1', 1, 'tiger_ii', profileVehicles);
}

describe('046 接线用到的组件改动', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    setSymbology('nato');
  });

  afterEach(() => {
    container.remove();
    setSymbology('nato');
  });

  describe('MainMenu.refresh', () => {
    function createMenu(getProfile: () => Profile) {
      const onVehicleChange = vi.fn();
      const menu = new MainMenu({
        parent: container,
        settings: {} as unknown as SettingsStore,
        settingsPanel: { open: vi.fn() } as unknown as SettingsPanel,
        vehicles: vehicleList,
        maps: [RIVER_VALLEY],
        initial: { vehicleId: 'tiger_i', mapId: RIVER_VALLEY.id },
        loadLoadout: () => ({}),
        onVehicleChange,
        onStart: vi.fn(),
        profile: { get: getProfile, set: vi.fn() },
      });
      return { menu, onVehicleChange };
    }

    it('在别处换了选中的车组以后,机库跟着换车', () => {
      let profile = twoCrewProfile();
      const { menu, onVehicleChange } = createMenu(() => profile);
      expect(menu.selection().vehicle.id).toBe('tiger_i');

      profile = selectCrew(profile, 'germany', 'lineup-1', 1);
      menu.refresh();

      expect(menu.selection().vehicle.id).toBe('tiger_ii');
      expect(onVehicleChange).toHaveBeenCalledTimes(1);
      expect(onVehicleChange.mock.calls[0][0].id).toBe('tiger_ii');
    });

    it('车没换时不重复通知,但会按当前符号体系重画类型图标', () => {
      const profile = twoCrewProfile();
      const { menu, onVehicleChange } = createMenu(() => profile);
      const iconOf = () => container.querySelector('.mm-info svg')?.outerHTML ?? '';
      const nato = iconOf();
      expect(nato).not.toBe('');

      setSymbology('warsaw');
      menu.refresh();

      expect(iconOf()).not.toBe('');
      expect(iconOf()).not.toBe(nato);
      expect(onVehicleChange).not.toHaveBeenCalled();
    });
  });

  describe('MapScreen 切换符号体系', () => {
    it('顶栏车组卡片的类型图标跟着换,选中状态和携弹面板不动', () => {
      const profile = twoCrewProfile();
      const screen = new MapScreen({
        parent: container,
        vehicles: vehicleList,
        getProfile: () => profile,
        loadLoadout: () => ({}),
        saveLoadout: vi.fn(),
        symbology: currentSymbology(),
        // 和 main.ts 一样:选了以后全局符号体系随之改变
        onSymbologyChange: (v) => setSymbology(v),
        onConfirm: vi.fn(),
      });
      screen.open({ spec: RIVER_VALLEY, grid: { resolution: 2, cellSize: 1, half: 1, heights: new Float32Array(4), surfaces: new Uint8Array(4) } }, 'battle');

      const cardIcon = (i: number) => screen.root.querySelectorAll('.ms-card')[i].querySelector('svg')?.outerHTML ?? '';
      const selectedBefore = [...screen.root.querySelectorAll('.ms-card')].map((c) => c.classList.contains('sel'));
      const ammoBefore = screen.root.querySelector('.ms-ammo-wrap')!.innerHTML;
      const natoIcons = [cardIcon(0), cardIcon(1)];
      expect(natoIcons[0]).not.toBe('');

      const select = screen.root.querySelector<HTMLSelectElement>('.ms-symbology-select')!;
      select.value = 'warsaw';
      select.dispatchEvent(new Event('change'));

      expect(currentSymbology()).toBe('warsaw');
      expect(cardIcon(0)).not.toBe(natoIcons[0]);
      expect(cardIcon(1)).not.toBe(natoIcons[1]);
      expect([...screen.root.querySelectorAll('.ms-card')].map((c) => c.classList.contains('sel'))).toEqual(selectedBefore);
      expect(screen.root.querySelector('.ms-ammo-wrap')!.innerHTML).toBe(ammoBefore);
    });
  });
});
