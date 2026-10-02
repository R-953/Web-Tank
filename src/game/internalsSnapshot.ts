import type { AttachPart, CrewRole, ModuleType, Vec3, VehicleSpec } from '../data/types';
import type { Vehicle } from './Vehicle';
import { CREW } from '../data/modules';

export interface InternalsSnapshot {
  spec: VehicleSpec;
  turretYaw: number;
  gunPitch: number;
  modules: { id: string; type: ModuleType; part: AttachPart; center: Vec3; size: Vec3; ratio: number }[]; // ratio = hp / maxHp,0..1
  crew: { id: string; role: CrewRole; part: 'hull' | 'turret'; center: Vec3; ratio: number; alive: boolean }[]; // ratio = hp / 100;死亡 0
}

/**
 * 提取当前载具内构的实时纯数据快照(纯函数,不依赖 DOM / Three)。
 * 用于 UI 绘制车内 X 光模块和乘员状态。
 */
export function internalsSnapshot(v: Pick<Vehicle, 'spec' | 'turretYaw' | 'gunPitch' | 'damage'>): InternalsSnapshot {
  const damage = v.damage;
  const modules = damage.modules.map((m) => {
    const ratio = m.maxHp > 0 ? Math.max(0, Math.min(1, m.hp / m.maxHp)) : 0;
    return {
      id: m.id,
      type: m.type,
      part: m.spec.part,
      center: m.spec.center,
      size: m.spec.size,
      ratio,
    };
  });

  const crew = damage.crew.map((c) => {
    const alive = Boolean(c.alive && c.hp > 0);
    const ratio = alive ? Math.max(0, Math.min(1, c.hp / CREW.hp)) : 0;
    const role: CrewRole = c.seat ?? c.homeRole;
    return {
      id: `crew:${c.index}`,
      role,
      part: c.box.part as 'hull' | 'turret',
      center: [c.box.center.x, c.box.center.y, c.box.center.z] as Vec3,
      ratio,
      alive,
    };
  });

  return {
    spec: v.spec,
    turretYaw: v.turretYaw,
    gunPitch: v.gunPitch,
    modules,
    crew,
  };
}
