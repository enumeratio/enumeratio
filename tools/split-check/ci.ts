// Runs run.ts for one package of packages.json and applies its `expectFail`: a known failure keeps the job
// green, and an unexpected pass fails it so the entry gets removed.
//
//   node tools/split-check/ci.ts <package> [run.ts flags]
//   node tools/split-check/ci.ts --matrix       the package names, as a JSON array (for a workflow matrix)

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Entry {
  name: string;
  /** Why the check is known to fail; the entry must be removed once it passes. */
  expectFail?: string;
}
const entries = JSON.parse(readFileSync(join(import.meta.dirname, "packages.json"), "utf8")) as Entry[];

const arg = process.argv[2];
if (arg === "--matrix") {
  console.log(JSON.stringify(entries.map((e) => e.name)));
} else {
  const entry = entries.find((e) => e.name === arg);
  if (entry === undefined) throw new Error(`${arg}: not in tools/split-check/packages.json`);
  const run = spawnSync(process.execPath, [join(import.meta.dirname, "run.ts"), entry.name, ...process.argv.slice(3)], {
    stdio: "inherit",
  });
  const passed = run.status === 0;
  if (entry.expectFail === undefined) process.exitCode = passed ? 0 : 1;
  else if (passed) {
    console.log(`::error::${entry.name} passes now; drop its expectFail from tools/split-check/packages.json`);
    process.exitCode = 1;
  } else console.log(`::notice::${entry.name} fails as expected: ${entry.expectFail}`);
}
