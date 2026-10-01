import { proficiency, type Profile, type ProfileVehicle } from '../../settings/Profile';

/** 计算指定国家、车组下标与载具的技能 = 该车组 progress × proficiency;找不到或车组不存在时返回 0,结果夹在 [0, 1] */
export function crewSkillFor(
  p: Profile,
  vehicles: readonly ProfileVehicle[],
  nation: string,
  crewIndex: number,
  vehicleId: string,
): number {
  if (!p || !p.nations || typeof nation !== 'string') {
    return 0;
  }
  const nationProfile = p.nations[nation];
  if (!nationProfile || !Array.isArray(nationProfile.crews)) {
    return 0;
  }
  if (typeof crewIndex !== 'number' || crewIndex < 0 || crewIndex >= nationProfile.crews.length) {
    return 0;
  }
  const crew = nationProfile.crews[crewIndex];
  if (!crew || !vehicleId) {
    return 0;
  }
  const prof = proficiency(crew, vehicleId, vehicles);
  const progress = typeof crew.progress === 'number' && Number.isFinite(crew.progress) ? crew.progress : 0;
  return Math.max(0, Math.min(1, progress * prof));
}

/** 当前出战车组对当前出战载具的技能 = 该车组 progress × proficiency;找不到时返回 0 */
export function activeCrewSkill(p: Profile, vehicles: readonly ProfileVehicle[]): number {
  if (!p || !p.nations || typeof p.activeNation !== 'string') {
    return 0;
  }
  const nationProfile = p.nations[p.activeNation];
  if (!nationProfile || !Array.isArray(nationProfile.lineups) || !Array.isArray(nationProfile.crews)) {
    return 0;
  }
  const lineup = nationProfile.lineups.find((l) => l.id === nationProfile.activeLineup);
  if (!lineup || typeof lineup.selected !== 'number') {
    return 0;
  }
  const selected = lineup.selected;
  if (!Array.isArray(lineup.slots) || selected < 0 || selected >= lineup.slots.length) {
    return 0;
  }
  const vehicleId = lineup.slots[selected];
  if (!vehicleId) {
    return 0;
  }
  return crewSkillFor(p, vehicles, p.activeNation, selected, vehicleId);
}
