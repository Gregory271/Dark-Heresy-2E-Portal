import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const testRoot = join(projectRoot, "tests");
const tests = readdirSync(testRoot)
  .filter((name) => /^test-.+\.mjs$/.test(name))
  .sort();

if (!tests.length) throw new Error("No test files were found.");

for (const test of tests) {
  process.stdout.write(`\n[QA] ${test}\n`);
  const result = spawnSync(process.execPath, [join(testRoot, test)], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nAll ${tests.length} focused QA tests passed.`);
