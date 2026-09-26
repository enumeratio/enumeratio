// Move each record's `examples:` out of `<Head>.yaml` into `<Head>.examples.yaml`
// (design/speculative/symbol-metadata.md, step 1). Re-runnable: a branch that still adds
// examples inline runs it again after merging main.
//
//   node packages/reference/scripts/migrate/split-examples.ts

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseYaml, type ReferenceEntry } from "@enumeratio/entry";
import { isEntryFile, writeEntry } from "@enumeratio/entry/node";

const PACKAGES = new URL("../../../", import.meta.url).pathname;

function* referenceDirs(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name === "reference" || (name === "entries" && dir.endsWith("/reference"))) yield path;
    yield* referenceDirs(path);
  }
}

let moved = 0;
for (const dir of referenceDirs(PACKAGES))
  for (const file of readdirSync(dir).filter(isEntryFile)) {
    const entry = parseYaml(readFileSync(join(dir, file), "utf8")) as Partial<ReferenceEntry>;
    if (entry.examples === undefined || entry.name === undefined) continue;
    await writeEntry(dir, entry as ReferenceEntry);
    moved++;
  }
console.log(`${moved} records split`);
