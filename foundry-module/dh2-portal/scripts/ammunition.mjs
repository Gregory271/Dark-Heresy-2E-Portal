// Native weapon Items own ammunition independently of builder snapshots.
const queues = new Map();
export function ammoWeapon(actor, ref) {
  const items = Array.from(actor.items?.contents || actor.items || []);
  const matches = items.filter(i => i.type === 'weapon' && (ref.id ? i.id === ref.id : i.name === ref.name));
  if (matches.length !== 1) throw Error('Select a unique weapon in the Actor inventory.');
  return matches[0];
}
export function ammunitionState(item) {
  const capacity = Number(item.system?.clip?.max || 0);
  return { capacity, loaded: Number(item.system?.clip?.value || 0), reserve: Number(item.flags?.dh2Ammo?.reserve || 0) };
}
export async function ammoLock(actor, action) {
  if (!(actor?.isOwner || game.user.isGM)) throw Error('You must own this Actor.');
  const key = actor.uuid || actor.id;
  const previous = queues.get(key) || Promise.resolve();
  const pending = previous.catch(() => {}).then(action);
  queues.set(key, pending);
  try { return await pending; } finally { if (queues.get(key) === pending) queues.delete(key); }
}
export function ammunitionCost(item, mode) {
  const state = ammunitionState(item);
  if (String(item.system?.class).toLowerCase() === 'melee' || !state.capacity) return 0;
  const rate = item.system?.rateOfFire || {};
  const cost = ['standard','called'].includes(mode) ? 1 : mode === 'semi' ? Number(rate.burst) : mode === 'full' ? Number(rate.full) : mode === 'suppressing' ? Number(rate.burst || rate.full) : NaN;
  if (!Number.isInteger(cost) || cost < 1) throw Error('This weapon cannot fire in that mode.');
  if (state.loaded < 1) throw Error(`${item.name} is empty. Reload before firing.`);
  // Core p.144: excess shots are disregarded when the clip is partly empty.
  return Math.min(cost, state.loaded);
}
export async function setAmmunition(actor, ref, loaded, reserve) {
  return ammoLock(actor, async () => {
    const item = ammoWeapon(actor, ref), state = ammunitionState(item);
    if (![loaded,reserve].every(n => Number.isInteger(n) && n >= 0 && n <= 100000) || loaded > state.capacity) throw Error('Enter valid ammunition totals within the clip capacity.');
    await item.update({'system.clip.value':loaded, 'flags.dh2Ammo.reserve':reserve});
  });
}
export async function reloadAmmunition(actor, ref) {
  return ammoLock(actor, async () => {
    const item = ammoWeapon(actor, ref), {capacity,loaded,reserve} = ammunitionState(item);
    const transfer = Math.min(capacity-loaded, reserve);
    if (transfer <= 0) throw Error(loaded >= capacity ? 'The weapon is already full.' : 'No spare ammunition recorded for this weapon.');
    await item.update({'system.clip.value':loaded+transfer, 'flags.dh2Ammo.reserve':reserve-transfer});
    return transfer;
  });
}
