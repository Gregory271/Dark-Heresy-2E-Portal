import {ammoLock, ammoWeapon, ammunitionCost, ammunitionState} from './ammunition.mjs';
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function permit(actor) {
  if (!actor || !(actor.isOwner || game.user.isGM)) throw new Error("You must own this Actor to use its chat controls.");
}
export async function sendSheetText(actor, payload) {
  permit(actor);
  const Chat = foundry.documents?.ChatMessage || ChatMessage;
  const title = String(payload.title || "Rules").slice(0, 200);
  const text = String(payload.text || "").slice(0, 20000);
  const data = { speaker: Chat.getSpeaker({ actor }), content: `<h3>${escape(title)}</h3><p>${escape(text).replace(/\n/g, "<br>")}</p>` };
  (Chat.applyMode || Chat.applyRollMode).call(Chat, data);
  await Chat.create(data);
  return {};
}
export async function rollSheetDice(actor, payload) {
  return ammoLock(actor, () => performRoll(actor, payload));
}
async function performRoll(actor, payload) {
  permit(actor);
  const Chat = foundry.documents?.ChatMessage || ChatMessage;
  const DiceRoll = foundry.dice?.Roll || Roll;
  const { quantity, sides } = payload;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30 || ![5, 10, 100].includes(sides)) throw new Error("Invalid dice request.");
  const target = payload.target;
  if (target != null && (!Number.isFinite(target) || Math.abs(target) > 10000)) throw new Error("Invalid roll target.");
  if (payload.attack && (!['standard','charge','all-out','called','semi','full'].includes(payload.attack.mode) || !Number.isInteger(payload.attack.maxHits) || payload.attack.maxHits < 1 || payload.attack.maxHits > 100)) throw new Error('Invalid attack mode.');
  const visibility = {};
  const weapon = payload.ammunition ? ammoWeapon(actor, payload.ammunition) : null;
  if (weapon && (quantity !== 1 || sides !== 100 || target == null || payload.damage)) throw Error('Ammunition can only be spent on an attack test.');
  const spent = weapon ? ammunitionCost(weapon, payload.ammunition.mode) : 0;
  const loaded = weapon ? ammunitionState(weapon).loaded : 0;
  (Chat.applyMode || Chat.applyRollMode).call(Chat, visibility);
  const roll = await new DiceRoll(`${quantity}d${sides}`).evaluate();
  const dice = roll.dice.flatMap((die) => die.results.map((result) => result.result));
  let detail = "";
  if (target != null && quantity === 1 && sides === 100) {
    const value = dice[0];
    const success = value === 1 || (value !== 100 && value <= target);
    const degrees = Math.max(1, 1 + (success ? Math.floor(target / 10) - Math.floor(value / 10) : Math.floor(value / 10) - Math.floor(target / 10)));
    detail = `Target ${target}: ${degrees} degree(s) of ${success ? "success" : "failure"}. Resolve situational effects and weapon jams on the sheet.`;
    if (payload.attack && success) {
      const mode=payload.attack.mode;
      const hits=Math.min(payload.attack.maxHits, spent || Infinity, mode==='full'?degrees:mode==='semi'?1+Math.floor((degrees-1)/2):1);
      const locationNumber=Number(String(value).padStart(2,'0').split('').reverse().join('')) || 100;
      const location=locationNumber<=10?'Head':locationNumber<=20?'Right arm':locationNumber<=30?'Left arm':locationNumber<=70?'Body':locationNumber<=85?'Right leg':'Left leg';
      detail+=` ${hits} potential hit(s) before evasion. ${mode==='called'?'Use the called location.':`First location: ${location} (${locationNumber}).`} Resolve additional hit locations, ammunition, jams and qualities separately.`;
    }
  }
  if (payload.damage) {
    const { keep, primitive, modifier } = payload.damage;
    if (!Number.isInteger(keep) || keep < 1 || keep > quantity || !Number.isFinite(primitive) || primitive < 0 || !Number.isFinite(modifier) || Math.abs(modifier) > 10000) throw new Error("Invalid damage request.");
    const kept = [...dice].sort((a, b) => b - a).slice(0, keep);
    const total = Math.max(0, kept.reduce((sum, value) => sum + (primitive ? Math.min(value, primitive) : value), 0) + modifier);
    detail = `Raw damage: ${total} (keep ${keep}, modifier ${modifier}${primitive ? `, Primitive ${primitive}` : ""}). Before Armour and Toughness. Dice pool shown below.`;
  }
  if (spent) {
    await weapon.update({'system.clip.value':loaded-spent}, {render:false});
    detail = detail.replace('additional hit locations, ammunition, jams', 'additional hit locations, jams');
    detail += ` Ammunition: ${spent} spent; ${loaded-spent} loaded.`;
  }
  try {
    await roll.toMessage({ ...visibility, speaker: Chat.getSpeaker({ actor }), flavor: `<h3>${escape(String(payload.title || "Sheet roll").slice(0, 200))}</h3><p>${escape(detail)}</p>` });
  } catch (error) {
    if (spent) await weapon.update({'system.clip.value':loaded}, {render:false});
    throw error;
  }
  return visibility.blind && !game.user.isGM ? { hidden: true } : { dice, ...(spent ? {ammunitionSpent:spent} : {}) };
}
