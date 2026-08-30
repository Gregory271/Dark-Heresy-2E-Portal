import assert from "node:assert/strict";

const hooks = { once: new Map(), on: new Map() };
globalThis.Hooks = {
  once: (name, callback) => hooks.once.set(name, callback),
  on: (name, callback) => hooks.on.set(name, callback),
};
globalThis.Application = class {
  static get defaultOptions() { return {}; }
  render() {}
  close() {}
};
globalThis.foundry = {
  utils: {
    deepClone: structuredClone,
    getRoute: (path) => `/${path}`,
    mergeObject: (base, update) => ({ ...base, ...update }),
  },
};
globalThis.window = {
  addEventListener() {},
  innerHeight: 900,
  innerWidth: 1400,
  location: { origin: "http://localhost:30000" },
};
globalThis.HTMLElement = class {};
globalThis.document = {};
globalThis.ui = { notifications: { error() {}, info() {}, warn() {} } };
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };

const moduleRecord = {};
const users = new Map([
  ["gm", { id: "gm", isGM: true, active: true, name: "GM" }],
  ["player", { id: "player", isGM: false, active: true, name: "Player" }],
]);
users.filter = (callback) => [...users.values()].filter(callback);
globalThis.game = {
  actors: [],
  folders: [],
  modules: new Map([["dh2-portal", moduleRecord]]),
  socket: { on() {}, emit() {} },
  system: { id: "dark-heresy-2nd" },
  user: users.get("gm"),
  users,
};

const createdRecords = [];
globalThis.Actor = {
  async create(data) {
    const actor = {
      id: `actor-${createdRecords.length + 1}`,
      name: data.name,
      type: data.type,
      flags: data.flags || {},
      sheet: { render() {} },
    };
    createdRecords.push(data);
    game.actors.push(actor);
    return actor;
  },
};
globalThis.Folder = {
  async create(data) {
    const folder = { ...data, id: `folder-${game.folders.length + 1}` };
    game.folders.push(folder);
    return folder;
  },
};

const moduleUrl = new URL("../foundry-module/dh2-portal/scripts/dh2-portal.mjs", import.meta.url);
await import(`${moduleUrl.href}?test=${Date.now()}`);
hooks.once.get("init")();

const payload = {
  name: "Gregor",
  type: "acolyte",
  system: { wounds: { max: 10, value: 10 } },
  items: [{ name: "Autogun", type: "weapon", system: {} }],
  flags: { dh2CharacterBuilder: { format: "mrkeathley-dark-heresy-2nd" } },
};

assert.equal(moduleRecord.api.validateActorData(payload).type, "acolyte");
assert.throws(
  () => moduleRecord.api.validateActorData({ format: "dh2-character-builder" }),
  /Builder JSON/,
);

const actor = await moduleRecord.api.importActorData(payload, {
  ownerUserId: "player",
  openSheet: false,
  notify: false,
});
assert.equal(actor.id, "actor-1");
assert.equal(createdRecords[0].ownership.player, 3);
assert.equal(createdRecords[0].items[0].name, "Autogun");
assert.equal(createdRecords[0].system.wounds.max, 10);

const libraryPayload = {
  format: "dh2-foundry-actor-library",
  version: 1,
  actors: [
    {
      recordId: "library-record-1",
      updatedAt: "2026-08-29T12:00:00.000Z",
      origin: "Web roster",
      actor: {
        ...structuredClone(payload),
        name: "Archivist",
        flags: {
          dh2CharacterBuilder: {
            format: "mrkeathley-dark-heresy-2nd",
            source: { name: "Archivist", homeWorld: "forge-world" },
          },
        },
      },
    },
  ],
};

assert.equal(moduleRecord.api.validateActorLibrary(libraryPayload)[0].recordId, "library-record-1");
const firstLibraryImport = await moduleRecord.api.importActorLibrary(libraryPayload);
assert.equal(firstLibraryImport.created.length, 1);
assert.equal(firstLibraryImport.skipped.length, 0);
assert.equal(createdRecords[1].folder, "folder-1");
assert.equal(createdRecords[1].flags.dh2CharacterBuilder.libraryRecordId, "library-record-1");

const repeatedLibraryImport = await moduleRecord.api.importActorLibrary(libraryPayload);
assert.equal(repeatedLibraryImport.created.length, 0);
assert.equal(repeatedLibraryImport.skipped.length, 1);
assert.equal(createdRecords.length, 2);

const reinforcementPayload = {
  name: "Sister of Battle Canoness",
  type: "npc",
  img: "./public/assets/choices/adepta-sororitas.webp",
  system: {
    wounds: { max: 22, value: 22 },
    characteristics: { weaponSkill: { base: 50 } },
  },
  items: [{ name: "Boltgun", type: "weapon", system: { description: "Profile" } }],
  flags: {
    core: { sheetClass: "dh2-portal.PortalReinforcementSheet" },
    dh2CharacterBuilder: {
      reinforcementId: "rc-sister-of-battle-canoness",
      reinforcement: { name: "Sister of Battle Canoness", tier: "Master" },
    },
  },
};

const validatedReinforcement = moduleRecord.api.validateReinforcementActorData(reinforcementPayload);
assert.equal(validatedReinforcement.type, "npc");
assert.equal(validatedReinforcement.img, "modules/dh2-portal/portal/public/assets/choices/adepta-sororitas.webp");
const reinforcementActor = await moduleRecord.api.importReinforcementActorData(reinforcementPayload, { openSheet: false, notify: false });
assert.equal(reinforcementActor.type, "npc");
assert.equal(createdRecords[2].folder, "folder-2");
assert.equal(createdRecords[2].items[0].name, "Boltgun");
const repeatedReinforcement = await moduleRecord.api.importReinforcementActorData(reinforcementPayload, { openSheet: false, notify: false });
assert.equal(repeatedReinforcement.id, reinforcementActor.id);
assert.equal(createdRecords.length, 3);

const reinforcementLibrary = {
  format: "dh2-reinforcement-actor-library",
  version: 1,
  actors: [
    { reinforcementId: "rc-sister-of-battle-canoness", actor: reinforcementPayload },
    {
      reinforcementId: "rc-kroot-mercenary",
      actor: {
        ...structuredClone(reinforcementPayload),
        name: "Kroot Mercenary",
        flags: {
          ...structuredClone(reinforcementPayload.flags),
          dh2CharacterBuilder: {
            reinforcementId: "rc-kroot-mercenary",
            reinforcement: { name: "Kroot Mercenary", tier: "Troop" },
          },
        },
      },
    },
  ],
};
const reinforcementLibraryResult = await moduleRecord.api.importReinforcementActorLibrary(reinforcementLibrary);
assert.equal(reinforcementLibraryResult.created.length, 1);
assert.equal(reinforcementLibraryResult.skipped.length, 1);
assert.equal(createdRecords.length, 4);

const vehiclePayload = {
  name: "Chimera Tracked",
  type: "vehicle",
  img: "./public/assets/choices/equipment.webp",
  system: {
    front: 30,
    side: 22,
    rear: 16,
    availability: "Extremely Rare",
    speed: { cruising: 70, tactical: 15 },
    crew: "Commander, Driver, Gunner",
    manoeuverability: 0,
    carryingCapacity: 12,
    integrity: { max: 35, value: 35, critical: 0 },
    type: "Tracked",
    threatLevel: 30,
  },
  items: [{ name: "Amphibious", type: "trait", system: { description: "Vehicle trait" } }],
  flags: {
    dh2CharacterBuilder: {
      vehicleId: "vehicle-chimera",
      vehicle: { name: "Chimera Tracked", source: "Core Rulebook", page: 192 },
    },
  },
};

const validatedVehicle = moduleRecord.api.validateVehicleActorData(vehiclePayload);
assert.equal(validatedVehicle.type, "vehicle");
assert.equal(validatedVehicle.system.front, 30);
assert.equal(validatedVehicle.img, "modules/dh2-portal/portal/public/assets/choices/equipment.webp");
const vehicleActor = await moduleRecord.api.importVehicleActorData(vehiclePayload, { openSheet: false, notify: false });
assert.equal(vehicleActor.type, "vehicle");
assert.equal(createdRecords[4].folder, "folder-3");
assert.equal(createdRecords[4].system.integrity.max, 35);
const repeatedVehicle = await moduleRecord.api.importVehicleActorData(vehiclePayload, { openSheet: false, notify: false });
assert.equal(repeatedVehicle.id, vehicleActor.id);
assert.equal(createdRecords.length, 5);

const vehicleLibrary = {
  format: "dh2-vehicle-actor-library",
  version: 1,
  actors: [
    { vehicleId: "vehicle-chimera", actor: vehiclePayload },
    {
      vehicleId: "vehicle-sentinel-walker",
      actor: {
        ...structuredClone(vehiclePayload),
        name: "Sentinel Walker",
        flags: {
          dh2CharacterBuilder: {
            vehicleId: "vehicle-sentinel-walker",
            vehicle: { name: "Sentinel Walker", source: "Enemies Without", page: 57 },
          },
        },
      },
    },
  ],
};
const vehicleLibraryResult = await moduleRecord.api.importVehicleActorLibrary(vehicleLibrary);
assert.equal(vehicleLibraryResult.created.length, 1);
assert.equal(vehicleLibraryResult.skipped.length, 1);
assert.equal(createdRecords.length, 6);

const portraitWrites = [];
let directoryRefreshes = 0;
ui.actors = { render() { directoryRefreshes += 1; } };
const portraitActor = {
  name: payload.name,
  isOwner: true, img: "old.webp", items: [],
  prototypeToken: { texture: { src: "token.webp" } },
  async update(change) {
    portraitWrites.push(change);
    if (change.img) this.img = change.img;
    hooks.on.get("updateActor")(this, change);
  },
};
await moduleRecord.api.saveActorPortrait(portraitActor, "worlds/my-game/portraits/new portrait.webp");
assert.deepEqual(portraitWrites[0], { img: "worlds/my-game/portraits/new portrait.webp" });
assert.equal(portraitActor.prototypeToken.texture.src, "token.webp");
assert.equal(directoryRefreshes, 1, "Changing a portrait refreshes the native Actor thumbnail");
await moduleRecord.api.updateActorFromPortal(portraitActor, payload);
assert.equal(portraitActor.img, "worlds/my-game/portraits/new portrait.webp");
assert.ok(!("img" in portraitWrites[1]), "Sheet autosave must preserve custom artwork");
assert.equal(directoryRefreshes, 1, "Ordinary autosaves do not redraw the directory");
hooks.on.get("updateActor")(portraitActor, { img: "worlds/my-game/remote.webp" });
assert.equal(directoryRefreshes, 2, "Portrait updates received from another client refresh the directory too");
await moduleRecord.api.updateActorFromPortal(portraitActor, { ...payload, name: "Renamed Acolyte" });
assert.equal(portraitWrites.at(-1).name, "Renamed Acolyte");
assert.equal(directoryRefreshes, 3, "Renaming an Actor refreshes the sidebar");
assert.equal(portraitActor.prototypeToken.texture.src, "token.webp", "Renaming preserves token artwork");
game.user = users.get("player");
await assert.rejects(moduleRecord.api.saveActorPortrait({ ...portraitActor, isOwner: false }, "denied.webp"), /own/);
game.user = users.get("gm");
console.log("Foundry module QA passed: imports, duplicate protection, portrait permissions, token isolation, and autosave preservation.");
