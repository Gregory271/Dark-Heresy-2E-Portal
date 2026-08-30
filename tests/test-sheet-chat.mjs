import assert from "node:assert/strict";
import { rollSheetDice, sendSheetText } from "../foundry-module/dh2-portal/scripts/sheet-chat.mjs";
const messages = [];
let dice = [32];
let blind = false;
globalThis.foundry = {};
globalThis.game = { user: { isGM: false } };
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor.id }),
  applyRollMode: (data) => { data.whisper = ["gm"]; data.blind = blind; },
  create: async (data) => messages.push(data),
};
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; }
  async evaluate() { this.dice = [{ results: dice.map((result) => ({ result })) }]; return this; }
  async toMessage(data) { messages.push({ ...data, formula: this.formula }); }
};
const actor = { id: "test-actor", isOwner: true };
assert.deepEqual(await rollSheetDice(actor, { quantity: 1, sides: 100, target: 50, title: "Attack" }), { dice: [32] });
assert.match(messages.at(-1).flavor, /3 degree\(s\) of success/);
assert.equal(messages.at(-1).speaker.actor, actor.id);
assert.deepEqual(messages.at(-1).whisper, ["gm"]);
dice = [100];
await rollSheetDice(actor, { quantity: 1, sides: 100, target: 150 });
assert.match(messages.at(-1).flavor, /failure/);
dice = [9, 4];
await rollSheetDice(actor, { quantity: 2, sides: 10, damage: { keep: 1, primitive: 7, modifier: 3 } });
assert.match(messages.at(-1).flavor, /Raw damage: 10/);
await sendSheetText(actor, { title: "<img>", text: "<script>alert(1)</script>\nRule" });
assert(!messages.at(-1).content.includes("<script>"));
assert.match(messages.at(-1).content, /<br>Rule/);
for (const payload of [{ quantity: 0, sides: 10 }, { quantity: 50, sides: 100 }, { quantity: 1, sides: 20 }, { quantity: 1, sides: 100, target: Infinity }]) await assert.rejects(rollSheetDice(actor, payload));
await assert.rejects(sendSheetText({ isOwner: false }, { text: "No" }));
await assert.rejects(rollSheetDice({ isOwner: false }, { quantity: 1, sides: 100 }));
blind = true;
assert.deepEqual(await rollSheetDice(actor, { quantity: 1, sides: 100 }), { hidden: true });
foundry.documents = { ChatMessage: { ...ChatMessage, applyMode: ChatMessage.applyRollMode, applyRollMode: undefined } };
foundry.dice = { Roll };
await sendSheetText(actor, { title: "Version 14" });
assert.equal(messages.at(-1).blind, true);
console.log("Sheet chat passed: native rolls, outcomes, damage, speaker, visibility, blind privacy, escaping, validation and permissions.");
