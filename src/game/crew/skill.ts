import { proficiency, type Profile, type ProfileVehicle } from '../../settings/Profile';

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
  if (selected < 0 || selected >= nationProfile.crews.length) {
    return 0;
  }
  const crew = nationProfile.crews[selected];
  if (!crew) {
    return 0;
  }
  if (!Array.isArray(lineup.slots) || selected >= lineup.slots.length) {
    return 0;
  }
  const vehicleId = lineup.slots[selected];
  if (!vehicleId) {
    return 0;
  }
  const prof = proficiency(crew, vehicleId, vehicles);
  const progress = typeof crew.progress === 'number' && Number.isFinite(crew.progress) ? crew.progress : 0;
  return Math.max(0, Math.min(1, progress * prof));
}
