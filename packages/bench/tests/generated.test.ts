import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { catalogPlan } from "../src/generate.ts";
import { GENERATORS } from "../src/registry.ts";

// The committed harnesses are what CI runs; regenerating must be a no-op.
// Fix with `node packages/bench/scripts/generate.ts`.
const root = fileURLToPath(new URL("../generated/", import.meta.url));
const plan = catalogPlan();

for (const [system, generate] of Object.entries(GENERATORS)) {
  test(`generated/${system} is up to date`, () => {
    for (const [path, text] of Object.entries(generate(plan))) {
      expect(readFileSync(join(root, system, path), "utf8"), path).toBe(text);
    }
  });
}
