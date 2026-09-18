// Browser-owned play state. Foundry continues to use its native Item documents.
export function browserAmmoState(character, weapon) {
  const capacity = Math.max(0, Math.floor(Number(weapon?.profile?.clip?.max) || 0));
  const saved = character.equipment?.ammunition?.[weapon.id];
  const integer = (value, fallback) => Number.isSafeInteger(value) && value >= 0 ? value : fallback;
  return { capacity, loaded: Math.min(capacity, integer(saved?.loaded, capacity)), reserve: integer(saved?.reserve, 0) };
}

export function setBrowserAmmo(character, weapon, loaded, reserve) {
  const { capacity } = browserAmmoState(character, weapon);
  if (![loaded, reserve].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100000) || loaded > capacity) {
    throw Error('Enter whole ammunition totals; loaded rounds cannot exceed the clip capacity.');
  }
  character.equipment.ammunition ||= {};
  character.equipment.ammunition[weapon.id] = { loaded, reserve };
}

export function browserAmmoCost(character, weapon, mode) {
  const { capacity, loaded } = browserAmmoState(character, weapon);
  if (!capacity || String(weapon.profile?.class).toLowerCase() === 'melee') return 0;
  const rate = weapon.profile?.rateOfFire || {};
  const cost = ['standard', 'called'].includes(mode) ? 1 : mode === 'semi' ? Number(rate.burst) : mode === 'full' ? Number(rate.full) : mode === 'suppressing' ? Number(rate.burst || rate.full) : NaN;
  if (!Number.isInteger(cost) || cost < 1) throw Error('This weapon cannot fire in that mode.');
  if (loaded < 1) throw Error(`${weapon.name} is empty. Reload before firing.`);
  return Math.min(cost, loaded);
}

export function reloadBrowserAmmo(character, weapon) {
  const { capacity, loaded, reserve } = browserAmmoState(character, weapon);
  const transfer = Math.min(capacity - loaded, reserve);
  if (transfer <= 0) throw Error(loaded >= capacity ? 'The weapon is already full.' : 'No spare ammunition recorded for this weapon.');
  setBrowserAmmo(character, weapon, loaded + transfer, reserve - transfer);
  return transfer;
}

export function appendBrowserRoll(character, { title, dice, sides, target, damage }) {
  character.combat ||= {};
  const kept = damage ? [...dice].sort((a,b) => b-a).slice(0, damage.keep || dice.length).map(n => damage.primitive ? Math.min(n, damage.primitive) : n) : dice;
  const total = Math.max(0, kept.reduce((a,b) => a+b, 0) + Number(damage?.modifier || 0));
  const record = { title: String(title).slice(0,200), dice: [...dice], sides, target, total, at: new Date().toISOString() };
  character.combat.rollHistory = [record, ...(Array.isArray(character.combat.rollHistory) ? character.combat.rollHistory : [])].slice(0, 100);
  return record;
}

export function importedPlayerCharacter(payload, catalogue = []) {
  const actor = payload?.type === 'acolyte' && payload?.system ? payload : null;
  const source = actor ? actor.flags?.dh2CharacterBuilder?.source : payload?.character || payload;
  if (!source || typeof source !== 'object' || Array.isArray(source) || !source.homeWorld || !source.background || !source.role) {
    throw Error('Choose a Portal Builder JSON file or a Foundry Acolyte export containing its Portal character record.');
  }
  const result = structuredClone(source);
  if (actor) {
    result.name = actor.name || result.name;
    result.combat ||= {};
    result.conditions ||= {};
    result.fate ||= {};
    if (Number.isFinite(actor.system.wounds?.value)) result.combat.damage = Math.max(0, Number(actor.system.wounds.max || result.wounds?.total || 0) - actor.system.wounds.value);
    if (Number.isFinite(actor.system.fate?.value)) result.fate.current = actor.system.fate.value;
    if (Number.isFinite(actor.system.fatigue?.value)) result.conditions.fatigue = actor.system.fatigue.value;
    result.equipment ||= {};
    result.equipment.ammunition ||= {};
    for (const item of actor.items || []) {
      const matches = catalogue.filter(entry => entry.name === item.name && entry.documentType === item.type);
      const id = item.flags?.dh2CharacterBuilder?.armouryId || (matches.length === 1 ? matches[0].id : null);
      if (id && item.type === 'weapon' && item.system?.clip) result.equipment.ammunition[id] = { loaded: item.system.clip.value, reserve: Number(item.flags?.dh2Ammo?.reserve || 0) };
    }
    result.playMode = true;
  }
  return result;
}
