import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as data from '../hosted/src/data.js';
import * as creation from '../hosted/src/creation-data.js';
import * as exceptional from '../hosted/src/exceptional-data.js';
import * as advancement from '../hosted/src/advancement-data.js';
import { armoury } from '../hosted/src/armoury-data.js';
import { talentCatalogue } from '../hosted/src/talent-data.js';

const source = readFileSync(new URL('../hosted/src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
let seed = 123456789;
const seededMath = Object.create(Math);
seededMath.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const context = vm.createContext({ ...data, ...creation, ...exceptional, ...advancement, armoury,
  talentCatalogue: [...talentCatalogue, ...advancement.eliteTalentCatalogue], structuredClone, console, Math: seededMath,
  foundryActorSheetMode: false, save() {}, render() {}, pendingFocusSelector: '', step: 4,
});
// Exercise the shipped functions and real catalogues, without browser startup or user storage.
for (const match of source.matchAll(/^(?:async )?function \w+\([^]*?^}/gm)) {
  if (!match[0].includes('import.meta')) vm.runInContext(match[0], context);
}
for (const name of ['talentAdvanceCosts', 'grantedEquipmentAliases', 'compositeEquipmentGrants', 'availabilityOrder', 'carryingWeights', 'specialistSkillIdSet']) {
  const start = source.indexOf(`const ${name} =`);
  assert(start >= 0, name);
  vm.runInContext(source.slice(start, source.indexOf(';', start) + 1), context);
}
const worlds = new Set(), backgrounds = new Set(), roles = new Set();
vm.runInContext('save = () => {}; render = () => {};', context);
for (let run = 0; run < 240; run++) {
  vm.runInContext('character = prepareCharacter({name: "QA"}); randomizeCreationChoices();', context);
  const c = context.character;
  worlds.add(c.homeWorld); backgrounds.add(c.background); roles.add(c.role);
  assert.equal(c.name, 'QA');
  assert.equal(Object.keys(c.rolls).length, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(c.rolls.influence)), { value: 30, dice: [], formula: 'Fixed 30', keep: 'fixed', source: 'fixed' });
  for (const [id, result] of Object.entries(c.rolls)) {
    if (id === 'influence') continue;
    assert(result.value >= 22 && result.value <= 40);
    assert.equal(result.kept.length, 2);
    assert.equal(result.value, result.kept.reduce((sum, die) => sum + die, 20));
  }
  assert(c.wounds.total > 0 && c.fate.threshold > 0 && c.divination.roll > 0);
  assert.equal(context.creationConsequenceWarnings().length, 0);
  assert(context.grantAlternatives().every(choice => choice.options.includes(c.grantChoices[choice.id])));
  const aptitudes = context.resolvedAptitudes();
  assert.equal(c.aptitudeReplacements.length, aptitudes.duplicateCount);
  assert.equal(new Set(aptitudes.aptitudes).size, aptitudes.aptitudes.length);
  assert(context.xpSpent() <= 1000 && context.xpSpent() > 0);
  assert(!c.advances.characteristics.influence);
  assert(c.acquisitions.length <= context.characteristicBonus('influence'));
  assert(c.acquisitions.every(id => c.equipment.inventory.includes(id) && context.isStartingAcquisitionLegal(context.equipmentItem(id))));
  assert(context.resolvedGrantedEquipment().entries.filter(entry => entry.itemId).every(entry => c.equipment.inventory.includes(entry.itemId)));
  assert(c.advances.psychicPowers.every(power => !context.psychicPowerStatus(advancement.psychicPowerById(power.id)).missing.length));
  assert.equal(JSON.parse(JSON.stringify(c)).rolls.strength.value, c.rolls.strength.value);
}
assert.equal(worlds.size, data.catalogs.homeWorlds.length);
assert.equal(backgrounds.size, data.catalogs.backgrounds.length);
assert.equal(roles.size, data.catalogs.roles.length);
vm.runInContext('character = prepareCharacter({rolls: {influence: {value: 30}}});', context);
for (let index = 0; index < 3; index++) assert(context.addRandomStartingAcquisition());
assert.equal(context.addRandomStartingAcquisition(), null);
assert.equal(new Set(context.character.acquisitions).size, 3);
assert.equal(context.character.equipment.noCostGrants.length, 0);
context.character.acquisitions = [];
context.character.equipment.inventory = [];
context.character.background = 'mechanicus';
const cyber = {availability: 'Very Rare', category: 'Cybernetics'};
assert(context.isStartingAcquisitionLegal(cyber));
context.character.background = 'imperial-guard';
assert(!context.isStartingAcquisitionLegal(cyber));
context.character.rolls = {};
assert.equal(context.addRandomStartingAcquisition(), null);
let saved = 0;
context.save = () => { saved++; };
context.showCharacteristicRollResults = () => {};
vm.runInContext('let characteristicRollSequence = 0;', context);
for (let index = 0; index < 20; index++) context.rollAllCharacteristics();
assert.equal(saved, 20);
assert.equal(Object.keys(context.character.rolls).length, 10);
assert.equal(context.character.rolls.influence.value, 30);
assert.equal(context.character.rolls.influence.source, 'fixed');
assert.equal(context.character.characteristicReroll, null);
context.step = 4;
context.navigateCreationBack();
assert.equal(context.step, 3);
context.foundryActorSheetMode = true;
context.step = 9;
context.navigateCreationBack();
assert.equal(context.step, data.scenes.findIndex(scene => scene.id === 'review'));
assert(!source.includes('Use one re-roll'));
assert(!source.includes('rerollUnavailable'));
assert(source.includes('id="roll-all-characteristics"'));
console.log('Random creation passed: 240 characters, every origin catalogue represented, valid rolls, resolved choices, affordable XP, legal acquisitions, and Foundry editor return.');

const bridge = readFileSync(new URL('../foundry-module/dh2-portal/scripts/dh2-portal.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const attachStart = bridge.indexOf('function attachPortalFrame(');
const events = {};
let load, activations = 0;
const frame = {addEventListener: (_type, callback) => { load = callback; }, contentDocument: {addEventListener: (type, callback) => { events[type] = callback; }}};
const bridgeContext = vm.createContext({REMOTE_PORTAL_URL: 'https://example.invalid/', window: {location: {origin: 'http://localhost'}}});
vm.runInContext(bridge.slice(attachStart, bridge.indexOf('\n}', attachStart) + 2), bridgeContext);
bridgeContext.attachPortalFrame({bringToTop: () => { activations++; }}, frame, {portalUrl: 'http://localhost/test', portalHtml: ''});
load(); events.pointerdown(); events.focusin();
assert.equal(activations, 2);
assert.equal(frame.tabIndex, 0);
console.log('Input focus bridge passed without suppressing native input events.');
