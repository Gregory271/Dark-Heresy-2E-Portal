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
  permit(actor);
  const Chat = foundry.documents?.ChatMessage || ChatMessage;
  const DiceRoll = foundry.dice?.Roll || Roll;
  const { quantity, sides } = payload;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30 || ![5, 10, 100].includes(sides)) throw new Error("Invalid dice request.");
  const target = payload.target;
  if (target != null && (!Number.isFinite(target) || Math.abs(target) > 10000)) throw new Error("Invalid roll target.");
  const visibility = {};
  (Chat.applyMode || Chat.applyRollMode).call(Chat, visibility);
  const roll = await new DiceRoll(`${quantity}d${sides}`).evaluate();
  const dice = roll.dice.flatMap((die) => die.results.map((result) => result.result));
  let detail = "";
  if (target != null && quantity === 1 && sides === 100) {
    const value = dice[0];
    const success = value === 1 || (value !== 100 && value <= target);
    const degrees = Math.max(1, 1 + (success ? Math.floor(target / 10) - Math.floor(value / 10) : Math.floor(value / 10) - Math.floor(target / 10)));
    detail = `Target ${target}: ${degrees} degree(s) of ${success ? "success" : "failure"}. Resolve situational effects and weapon jams on the sheet.`;
  }
  if (payload.damage) {
    const { keep, primitive, modifier } = payload.damage;
    if (!Number.isInteger(keep) || keep < 1 || keep > quantity || !Number.isFinite(primitive) || primitive < 0 || !Number.isFinite(modifier) || Math.abs(modifier) > 10000) throw new Error("Invalid damage request.");
    const kept = [...dice].sort((a, b) => b - a).slice(0, keep);
    const total = Math.max(0, kept.reduce((sum, value) => sum + (primitive ? Math.min(value, primitive) : value), 0) + modifier);
    detail = `Raw damage: ${total} (keep ${keep}, modifier ${modifier}${primitive ? `, Primitive ${primitive}` : ""}). Before Armour and Toughness. Dice pool shown below.`;
  }
  await roll.toMessage({ ...visibility, speaker: Chat.getSpeaker({ actor }), flavor: `<h3>${escape(String(payload.title || "Sheet roll").slice(0, 200))}</h3><p>${escape(detail)}</p>` });
  return visibility.blind && !game.user.isGM ? { hidden: true } : { dice };
}
