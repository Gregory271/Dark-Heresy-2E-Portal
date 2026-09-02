import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../hosted/src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('const actionSectionDefinitions =');
const end = source.indexOf('function renderActionIndex(', start);
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);
const attack = (weaponId, weaponName, mode, available = true) => ({
  id:`weapon-${weaponId}-${mode}`, name:`${mode} - ${weaponName}`, available, group:'Attacks', test:{weaponId, weaponName, mode},
});
const actions = [
  attack('pistol', 'Pistol', 'Standard Attack'),
  attack('long-las', 'Long Las', 'Called Shot'),
  attack('pistol', 'Pistol', 'Called Shot'),
  attack('long-las', 'Long Las', 'Standard Attack'),
  attack('spare', 'Spare weapon', 'Standard Attack', false),
  {id:'weapon-unarmed-standard', name:'Unarmed', available:true, group:'Attacks'},
  {id:'gear-medikit', name:'Use Medikit', equipmentId:'medikit', equipmentName:'Medikit', available:true, group:'Utility'},
];
const sections = context.groupedActionSections(actions, ['long-las', 'pistol']);
assert.deepEqual(Array.from(sections, s => s.title), ['Long Las', 'Pistol', 'Spare weapon', 'Basic Attacks', 'Medikit']);
assert.deepEqual(Array.from(sections[0].actions, a => a.test.mode), ['Standard Attack', 'Called Shot']);
assert(sections[0].actions.every(a => a.test.weaponId === 'long-las'));
assert.equal(sections.flatMap(s => s.actions).length, actions.length);
assert.equal(new Set(sections.flatMap(s => s.actions).map(a => a.id)).size, actions.length);
const filtered = context.groupedActionSections(actions.filter(a => a.available && a.name.includes('Called Shot')), ['long-las', 'pistol']);
assert.deepEqual(Array.from(filtered, s => s.title), ['Long Las', 'Pistol']);
assert(filtered.every(s => s.actions.length === 1));
assert.equal(context.groupedActionSections([], []).length, 0);
console.log('Action grouping passed: primary weapon first, per-item attack order, separate unarmed/gear, filtering, and no duplicates.');
