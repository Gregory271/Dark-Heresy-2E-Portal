import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../hosted/src/main.js", import.meta.url), "utf8");
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0);
  const end = source.indexOf("\n}\n", start);
  return source.slice(start, end + 2);
}
const character = { rolls: { influence: { value: 30 }, strength: { value: 35 } }, advances: { characteristics: {} }, equipment: { inventory: ["lasgun"] }, xp: { starting: 1000 } };
const context = vm.createContext({ character,
  divinationCharacteristicModifiers: () => ({ influence: 2 }),
  exceptionalCharacteristicModifiers: () => ({}), hasEliteAdvance: () => false,
  characteristicXpCost: () => 0,
});
vm.runInContext(["characteristicBreakdown", "setCurrentInfluence", "foundryCharacteristicData"].map(extract).join("\n"), context);
assert.equal(context.characteristicBreakdown("influence").total, 32);
assert.equal(context.setCurrentInfluence("75"), true);
assert.equal(context.characteristicBreakdown("influence").total, 75);
assert.equal(character.rolls.influence.value, 30);
assert.equal(context.foundryCharacteristicData("influence").modifier, 45);
assert.equal(context.setCurrentInfluence("40"), true);
assert.equal(context.characteristicBreakdown("influence").total, 40);
for (const bad of ["", " ", "-1", "1.5", "NaN", "Infinity", "9007199254740992"]) {
  assert.equal(context.setCurrentInfluence(bad), false);
  assert.equal(context.characteristicBreakdown("influence").total, 40);
}
assert.equal(context.setCurrentInfluence("0"), true);
assert.equal(context.characteristicBreakdown("influence").total, 0);
assert.equal(context.characteristicBreakdown("strength").total, 35);
assert.equal(character.xp.starting, 1000);
assert.deepEqual(character.equipment.inventory, ["lasgun"]);
assert.equal(JSON.parse(JSON.stringify(character)).influenceAdjustment, -32);
console.log("Influence: legacy defaults, adjustments, exports, validation and unaffected inventory/XP passed.");
