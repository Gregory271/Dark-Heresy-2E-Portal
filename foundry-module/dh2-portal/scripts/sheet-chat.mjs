import {ammoLock, ammoWeapon, ammunitionCost, ammunitionState} from './ammunition.mjs';
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function rollCard({ title, tone = "neutral", verdict, summary, facts = [], notes = [] }) {
  const factMarkup = facts.filter((fact) => fact?.value !== undefined && fact?.value !== "").map((fact) => `<div><dt>${escape(fact.label)}</dt><dd>${escape(fact.value)}</dd></div>`).join("");
  const noteMarkup = notes.filter(Boolean).map((note) => `<p>${escape(note)}</p>`).join("");
  return `<section class="dh2-roll-card dh2-roll-card--${escape(tone)}"><h3>${escape(title)}</h3><div class="dh2-roll-verdict"><strong>${escape(verdict)}</strong><span>${escape(summary)}</span></div>${factMarkup ? `<dl class="dh2-roll-facts">${factMarkup}</dl>` : ""}${noteMarkup ? `<div class="dh2-roll-notes">${noteMarkup}</div>` : ""}</section>`;
}
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
  const title = String(payload.title || "Sheet roll").slice(0, 200);
  let card = {
    title,
    verdict: "ROLL COMPLETE",
    summary: `${dice.reduce((sum, value) => sum + value, 0)} total`,
    facts: [
      { label: "Dice", value: `${quantity}d${sides}` },
      { label: "Results", value: dice.join(", ") },
    ],
    notes: [],
  };
  if (target != null && quantity === 1 && sides === 100) {
    const value = dice[0];
    const success = value === 1 || (value !== 100 && value <= target);
    const degrees = Math.max(1, 1 + (success ? Math.floor(target / 10) - Math.floor(value / 10) : Math.floor(value / 10) - Math.floor(target / 10)));
    const outcome = success ? "SUCCESS" : "FAILURE";
    card = {
      title,
      tone: success ? "success" : "failure",
      verdict: outcome,
      summary: `${degrees} ${degrees === 1 ? "DEGREE" : "DEGREES"} OF ${outcome}`,
      facts: [
        { label: "Rolled", value },
        { label: "Target", value: target },
      ],
      notes: [],
    };
    if (payload.attack && success) {
      const mode=payload.attack.mode;
      const hits=Math.min(payload.attack.maxHits, spent || Infinity, mode==='full'?degrees:mode==='semi'?1+Math.floor((degrees-1)/2):1);
      const locationNumber=Number(String(value).padStart(2,'0').split('').reverse().join('')) || 100;
      const location=locationNumber<=10?'Head':locationNumber<=20?'Right arm':locationNumber<=30?'Left arm':locationNumber<=70?'Body':locationNumber<=85?'Right leg':'Left leg';
      card.facts.push({ label: "Potential hits", value: hits });
      card.facts.push({ label: mode === "called" ? "Location" : "First location", value: mode === "called" ? "Called location" : `${location} (${locationNumber})` });
      card.notes = ["Potential hits are before evasion. Resolve additional hit locations, jams, target defences, and weapon qualities separately."];
    }
  }
  if (payload.damage) {
    const { keep, primitive, modifier } = payload.damage;
    if (!Number.isInteger(keep) || keep < 1 || keep > quantity || !Number.isFinite(primitive) || primitive < 0 || !Number.isFinite(modifier) || Math.abs(modifier) > 10000) throw new Error("Invalid damage request.");
    const kept = [...dice].sort((a, b) => b - a).slice(0, keep);
    const total = Math.max(0, kept.reduce((sum, value) => sum + (primitive ? Math.min(value, primitive) : value), 0) + modifier);
    card = {
      title,
      tone: "damage",
      verdict: "DAMAGE",
      summary: `${total} RAW DAMAGE`,
      facts: [
        { label: "Dice rolled", value: dice.join(", ") },
        { label: "Dice kept", value: kept.join(", ") },
        { label: "Modifier", value: modifier >= 0 ? `+${modifier}` : modifier },
        ...(primitive ? [{ label: "Primitive", value: primitive }] : []),
      ],
      notes: ["Before Armour and Toughness."],
    };
  }
  if (spent) {
    await weapon.update({'system.clip.value':loaded-spent}, {render:false});
    card.facts.push({ label: "Ammunition", value: `${spent} spent · ${loaded-spent} loaded` });
  }
  try {
    await roll.toMessage({ ...visibility, speaker: Chat.getSpeaker({ actor }), flavor: rollCard(card) });
  } catch (error) {
    if (spent) await weapon.update({'system.clip.value':loaded}, {render:false});
    throw error;
  }
  return visibility.blind && !game.user.isGM ? { hidden: true } : { dice, ...(spent ? {ammunitionSpent:spent} : {}) };
}
