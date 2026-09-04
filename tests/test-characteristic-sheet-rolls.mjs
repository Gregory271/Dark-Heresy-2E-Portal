import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const portal = readFileSync(join(root, "src", "main.js"), "utf8");
const portalStyles = readFileSync(join(root, "src", "styles.css"), "utf8");
const npcTemplate = readFileSync(join(root, "foundry-module", "dh2-portal", "templates", "reinforcement-sheet.html"), "utf8");
const foundryBridge = readFileSync(join(root, "foundry-module", "dh2-portal", "scripts", "dh2-portal.mjs"), "utf8");

assert.ok(portal.includes('data-roll-review-characteristic="${entry.id}"'), "Live Acolyte characteristic cells are not marked as roll controls.");
assert.ok(portal.includes("function openCharacteristicTest(characteristicId)"), "Live Acolyte characteristic-test dialog is missing.");
assert.ok(portal.includes('type: "Test"'), "Characteristic checks do not use the shared test presentation.");
assert.ok(portal.includes('openCharacteristicTest(cell.dataset.rollReviewCharacteristic)'), "Mouse and keyboard activation are not wired to characteristic checks.");
assert.ok(portalStyles.includes(".rollable-characteristic:focus-visible"), "Characteristic cells lack a visible keyboard focus state.");

assert.ok(npcTemplate.includes('data-roll-characteristic="{{key}}"'), "NPC characteristic cells are not marked as roll controls.");
assert.ok(foundryBridge.includes('querySelectorAll?.("[data-roll-characteristic]")'), "NPC characteristic roll listeners are missing.");
assert.ok(foundryBridge.includes("openTest(this.actor"), "NPC characteristic checks do not open the Foundry roll dialog.");

console.log("Characteristic roll QA passed: Acolyte and NPC sheets expose keyboard-accessible Foundry test controls.");
