// Regenerate every system's native harness under packages/bench/generated/ from the catalogue.
//
//   node packages/bench/scripts/generate.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogPlan } from "../src/generate.ts";
import { GENERATORS } from "../src/registry.ts";

const root = fileURLToPath(new URL("../generated/", import.meta.url));
const plan = catalogPlan();
for (const [system, generate] of Object.entries(GENERATORS)) {
  for (const [path, text] of Object.entries(generate(plan))) {
    const file = join(root, system, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    console.log(file);
  }
}
