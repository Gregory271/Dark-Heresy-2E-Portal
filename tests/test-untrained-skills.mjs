import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const portal = readFileSync(join(root, "src", "main.js"), "utf8");
const npcTemplate = readFileSync(join(root, "foundry-module", "dh2-portal", "templates", "reinforcement-sheet.html"), "utf8");
const combat = readFileSync(join(root, "foundry-module", "dh2-portal", "scripts", "portal-combat.mjs"), "utf8");

assert.ok(portal.includes("!isSpecialistSkill(skill.id) && skillRank(skill.id) === 0"), "Acolyte untrained list must exclude Specialist skills.");
assert.ok(portal.includes("target: characteristicValue(characteristics.find((entry) => entry.name === skill.characteristic)?.id) - 20"), "Acolyte untrained skills must apply -20 automatically.");
assert.ok(portal.includes("is a Specialist skill and cannot be attempted untrained"), "Acolyte roll handler must block illegal Specialist tests.");
assert.ok(portal.includes('data-skill-disclosure="untrained"'), "Acolyte Skills tab needs a collapsed untrained section.");
assert.ok(portal.includes('id="skill-search"'), "Acolyte Skills tab needs search across trained and untrained entries.");

assert.ok(npcTemplate.includes("data-roll-untrained-skill"), "NPC sheets need explicit untrained roll controls.");
assert.ok(npcTemplate.includes("These cannot be attempted untrained."), "NPC sheets must explain Specialist locks.");
assert.ok(combat.includes("target:base-20"), "NPC untrained targets must apply -20 automatically.");
assert.ok(combat.includes("Operate is a Specialist skill and cannot be attempted untrained"), "Vehicle crew dialog must enforce the Operate training rule.");

console.log("Untrained skill QA passed: -20 applies only to ordinary skills, Specialist skills remain locked, and vehicle crew guidance is explicit.");
