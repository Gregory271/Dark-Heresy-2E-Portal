import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../hosted/src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bridge = readFileSync(new URL('../foundry-module/dh2-portal/scripts/dh2-portal.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function extract(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert(start >= 0, name);
  return text.slice(start, text.indexOf('\n}', start) + 2);
}
const state = vm.createContext({
  foundryActorSheetMode: true, foundryActorLoaded: false,
  foundryActorLoadError: '', foundryActorId: 'actor-a',
  foundryActorSaveRequests: new Map(), scenes: [{id:'identity'}, {id:'review'}],
  prepareCharacter: structuredClone, syncCreationConsequences() {},
  render() {}, setFoundrySaveState() {},
  activeCharacterId: '', character: {}, activeRecord: null, appView:'builder', step:0,
  foundryActorSheetReady:false, foundryActorRevision:0,
});
vm.runInContext(extract(app, 'loadFoundryActor'), state);
assert.equal(state.loadFoundryActor({name:'Wrong'}, 'actor-b'), false);
assert.equal(state.loadFoundryActor({name:'Missing'}, 'actor-a'), false);
assert.match(state.foundryActorLoadError, /no Portal character record/);
assert.equal(state.appView, 'builder');
assert(state.loadFoundryActor({name:'Correct actor', flags:{dh2CharacterBuilder:{source:{name:'Old name'}}}}, 'actor-a'));
assert.equal(state.character.name, 'Correct actor');
assert.equal(state.step, 1);
state.character.name = 'Unsaved edit';
state.loadFoundryActor({name:'Duplicate load'}, 'actor-a');
assert.equal(state.character.name, 'Unsaved edit', 'Duplicate load must not reset live edits');
vm.runInContext(extract(app, 'renderRoster'), state);
state.renderRoster();
assert.equal(state.appView, 'builder', 'Sheet cannot enter roster');

const messages = [];
const frameA = {postMessage: (message) => messages.push(message)};
const frameB = {postMessage: (message) => messages.push(message)};
const actor = (name) => ({id:'shared-base-id', name, isOwner:true, toObject(){return {name:this.name};}});
const contexts = [
  {kind:'actor-sheet', frame:{contentWindow:frameA}, application:{actor:actor('World Actor')}},
  {kind:'actor-sheet', frame:{contentWindow:frameB}, application:{actor:actor('Unlinked token Actor')}},
];
const parent = vm.createContext({
  portalContexts: () => contexts, window:{location:{origin:'http://localhost'}},
  portraitState: () => ({}),
});
vm.runInContext('async ' + extract(bridge, 'handlePortalMessage'), parent);
for (const frame of [frameA, frameB]) await parent.handlePortalMessage({
  source:frame, origin:'http://localhost', data:{source:'dh2-portal-frame', type:'actor-sheet-ready', requestId:'ready'},
});
assert.deepEqual(messages.map(m => m.actor.name), ['World Actor', 'Unlinked token Actor']);
await parent.handlePortalMessage({source:frameA, origin:'https://untrusted.invalid', data:{source:'dh2-portal-frame', type:'actor-sheet-ready', requestId:'bad'}});
assert.equal(messages.length, 2);
assert(app.includes('if (foundryActorSheetMode) {\n  render();\n  requestFoundryActor();'));
assert(app.includes('const actorSheetEditor = foundryActorSheetMode && ["equipment", "advances"].includes(scene.id);'), 'Live Inventory and Advancement must be recognized as sheet editors');
assert(app.includes('id="return-to-sheet"'), 'Live editors need an explicit Return to Sheet action');
assert(app.includes('scene.id === "review" || actorSheetEditor ? "" : `<div class="progress"'), 'Live editors must hide creation progress');
assert(app.includes('document.querySelector("#continue")?.addEventListener'), 'Live editors render without a creation Continue control');
assert(app.includes('reviewTabState = scenes[step]?.id === "equipment" ? "inventory" : "advancement";'), 'Returning from a live editor must restore its matching sheet tab');
assert(app.includes('globalThis.localStorage?.setItem(reviewTabStorageKey, reviewTabState);'), 'Restoring the matching tab must remain safe in embedded contexts');
console.log('Actor routing passed: correct Actor/token, delayed handshake, missing data, duplicate load, roster isolation, origin checks, and live-editor return flow.');
