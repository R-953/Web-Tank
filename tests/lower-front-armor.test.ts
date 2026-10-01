import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import type { ArmorSpec, ShellSpec } from '../src/data/types';
import { frontArmorAt, resolveHit } from '../src/game/Damage';
import { TIGER_II, VEHICLES } from '../src/data/vehicles';
import { flyShell } from './sim';

beforeAll(async () => {
  await RAPIER.init();
});

const shellOf = (vehicleId: string, shellId: string): ShellSpec =>
  VEHICLES[vehicleId].weapons[0].ammo.find((a) => a.id === shellId)!;

describe('首上 / 首下装甲判定 frontArmorAt', () => {
  const armorWithLower: ArmorSpec = {
    front: 233,
    side: 80,
    rear: 92,
    lowerFront: { thickness: 148, height: 0.9 },
  };

  const armorWithoutLower: ArmorSpec = {
    front: 100,
    side: 80,
    rear: 80,
  };

  const hullBottomY = -1.05;
  const splitY = hullBottomY + armorWithLower.lowerFront!.height; // -0.15

  it('正好在分界上:退回首上 front', () => {
    expect(frontArmorAt(armorWithLower, splitY, hullBottomY)).toBe(233);
  });

  it('分界下一点:使用首下 lowerFront.thickness', () => {
    expect(frontArmorAt(armorWithLower, splitY - 1e-4, hullBottomY)).toBe(148);
  });

  it('分界上一点:使用首上 front', () => {
    expect(frontArmorAt(armorWithLower, splitY + 1e-4, hullBottomY)).toBe(233);
  });

  it('没设 lowerFront 时退回 front', () => {
    expect(frontArmorAt(armorWithoutLower, splitY - 0.5, hullBottomY)).toBe(100);
    expect(frontArmorAt(armorWithoutLower, splitY + 0.5, hullBottomY)).toBe(100);
  });

  it('命中点高度未提供时退回 front', () => {
    expect(frontArmorAt(armorWithLower, undefined, hullBottomY)).toBe(233);
  });
});

describe('穿透判定 resolveHit 对首下装甲的支持', () => {
  const frontDir = { x: 0, y: 0, z: 1 };
  const frontNormal = { x: 0, y: 0, z: -1 };
  const sideDir = { x: 1, y: 0, z: 0 };
  const sideNormal = { x: -1, y: 0, z: 0 };

  const armor: ArmorSpec = {
    front: 233,
    side: 80,
    rear: 92,
    lowerFront: { thickness: 148, height: 0.9 },
  };
  const hullBottomY = -1.05;

  it('打中首下(低于分界线)采用首下厚度', () => {
    const res = resolveHit({ penetration: 170 }, armor, frontDir, frontNormal, undefined, -0.5, hullBottomY);
    expect(res.armor).toBe(148);
    expect(res.penetrated).toBe(true);
  });

  it('打中首上(高于分界线)采用首上厚度', () => {
    const res = resolveHit({ penetration: 170 }, armor, frontDir, frontNormal, undefined, 0.2, hullBottomY);
    expect(res.armor).toBe(233);
    expect(res.penetrated).toBe(false);
  });

  it('侧面受击不受 lowerFront 影响', () => {
    const res = resolveHit({ penetration: 100 }, armor, sideDir, sideNormal, undefined, -0.5, hullBottomY);
    expect(res.face).toBe('side');
    expect(res.armor).toBe(80);
    expect(res.penetrated).toBe(true);
  });
});

describe('历史战术校验:BR-471(ISU-122)对虎王正面', () => {
  const frontDir = { x: 0, y: 0, z: 1 };
  const frontNormal = { x: 0, y: 0, z: -1 };
  const tigerII = TIGER_II;
  const hullBottomY = -tigerII.hull.height / 2; // -1.05

  it('BR-471(ISU-122)在 500 m 打虎王首上打不穿、打首下能打穿', () => {
    const br471 = shellOf('isu_122', 'br471');
    const [s500] = flyShell(br471, [500]);

    // 首上:高于分界线 (-0.15m), 取 y = 0.2
    const hitUpper = resolveHit(
      { ...br471, penetration: s500.penetration },
      tigerII.armor,
      frontDir,
      frontNormal,
      undefined,
      0.2,
      hullBottomY,
    );
    expect(hitUpper.armor).toBe(tigerII.armor.front);
    expect(hitUpper.penetrated).toBe(false);

    // 首下:低于分界线 (-0.15m), 取 y = -0.5
    const hitLower = resolveHit(
      { ...br471, penetration: s500.penetration },
      tigerII.armor,
      frontDir,
      frontNormal,
      undefined,
      -0.5,
      hullBottomY,
    );
    expect(hitLower.armor).toBe(tigerII.armor.lowerFront!.thickness);
    expect(hitLower.penetrated).toBe(true);
  });
});

describe('各车辆 lowerFront 数据完整性与一致性', () => {
  it('T-34-85 首下弱点配置', () => {
    expect(VEHICLES.t34_85.armor.lowerFront).toEqual({ thickness: 75, height: 0.71 });
  });

  it('虎王首下弱点配置', () => {
    expect(VEHICLES.tiger_ii.armor.lowerFront).toEqual({ thickness: 148, height: 0.9 });
  });

  it('谢尔曼车系传动罩配置', () => {
    expect(VEHICLES.m4a3_76w.armor.lowerFront).toEqual({ thickness: 108, height: 1.0 });
    expect(VEHICLES.m4a3e8.armor.lowerFront).toEqual({ thickness: 108, height: 1.0 });
    expect(VEHICLES.m4a3e2.armor.lowerFront).toEqual({ thickness: 140, height: 1.0 });
  });

  it('虎式、SU-100、ISU-122 首下与首上同厚或更厚,不设 lowerFront', () => {
    expect(VEHICLES.tiger_i.armor.lowerFront).toBeUndefined();
    expect(VEHICLES.su_100.armor.lowerFront).toBeUndefined();
    expect(VEHICLES.isu_122.armor.lowerFront).toBeUndefined();
  });
});
