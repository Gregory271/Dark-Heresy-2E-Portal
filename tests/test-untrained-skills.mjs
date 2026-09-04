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
assert.ok(portal.includes('class="review-skill-test"') && portal.includes('data-roll-review-skill="${skill.id}"'), "Acolyte skill rows must be the test controls instead of using separate Roll buttons.");
assert.ok(!portal.includes('<b>Test</b>'), "Clickable skill rows should not include a redundant visible Test label.");
assert.ok(!portal.includes('class="compact-button review-skill-roll"'), "Acolyte skill rows must not duplicate each test with a separate Roll button.");

assert.ok(npcTemplate.includes("data-roll-untrained-skill"), "NPC sheets need explicit untrained roll controls.");
assert.ok(portal.includes('displayName: `${skill.name} specialities`'), "Acolyte sheet must identify Specialist entries as skill families rather than generic tests.");
assert.ok(npcTemplate.includes("Each entry is a family of separate specialities, not a generic test."), "NPC sheets must explain Specialist families and their locks.");
assert.ok(combat.includes("target:base-20"), "NPC untrained targets must apply -20 automatically.");
assert.ok(combat.includes("Operate is a Specialist skill and cannot be attempted untrained"), "Vehicle crew dialog must enforce the Operate training rule.");

console.log("Untrained skill QA passed: -20 applies only to ordinary skills, Specialist skills remain locked, and vehicle crew guidance is explicit.");
