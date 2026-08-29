import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(projectRoot, "foundry-module", "dh2-portal");
const hostedRoot = join(projectRoot, "hosted");
const distRoot = join(projectRoot, "dist");
const moduleRoot = join(distRoot, "dh2-portal");

if (!existsSync(join(hostedRoot, "index.html"))) {
  throw new Error("Build the hosted Portal before packaging the Foundry module.");
}

rmSync(moduleRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });
cpSync(sourceRoot, moduleRoot, { recursive: true });
cpSync(hostedRoot, join(moduleRoot, "portal"), { recursive: true });

console.log(`Prepared Foundry module at ${moduleRoot}`);
