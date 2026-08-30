import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { vehicleCatalogue } from "../hosted/src/reinforcement-data.js";

// Exercise the shipped parser, including the comma-formatted aircraft speeds.
const source = readFileSync(new URL("../hosted/src/main.js", import.meta.url), "utf8");
const parserSource = source.match(/function vehicleProfileNumber\(value\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(parserSource, "The shipped vehicle number parser must exist");
const parse = runInNewContext(`${parserSource}; vehicleProfileNumber`);
const aquila = vehicleCatalogue.find(entry => entry.id === "vehicle-aquila-lander");
const arvus = vehicleCatalogue.find(entry => entry.id === "vehicle-arvus-lighter");
assert.equal(parse(aquila.profile.cruising), 2200);
assert.equal(parse(aquila.profile.tactical), 1200);
assert.equal(parse(arvus.profile.cruising), 1600);
assert.equal(parse(arvus.profile.tactical), 1000);
assert.equal(parse(arvus.profile.manoeuvrability), -15);
assert.equal(parse("+0"), 0);
for (const entry of vehicleCatalogue) {
  assert.ok(parse(entry.profile.cruising) > 0, `${entry.name} cruising speed`);
  assert.ok(parse(entry.profile.tactical) > 0, `${entry.name} tactical speed`);
}
console.log(`Vehicle number QA passed for ${vehicleCatalogue.length} shipped profiles.`);
