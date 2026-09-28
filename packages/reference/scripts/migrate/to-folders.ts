// Move every record from `<Head>.yaml` + `<Head>.examples.yaml` + `<Head>.implementations.yaml`
// into its folder, `<Head>/index.md` + `examples.tsv` + `examples.values.<system>.tsv`
// (design/speculative/symbol-metadata.md). Re-runnable: a branch that still has old-style
// files runs it again after merging main.
//
//   node packages/reference/scripts/migrate/to-folders.ts

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { type HeadImplementations, parseYaml, type ReferenceEntry, type ReferenceExample } from "@enumeratio/entry";
import { writeHead } from "@enumeratio/entry/node";

const PACKAGES = new URL("../../../", import.meta.url).pathname;
const OLD = [".examples.yaml", ".implementations.yaml", ".stories.yaml"];

function* referenceDirs(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name === "reference" || (name === "entries" && dir.endsWith("/reference"))) yield path;
    yield* referenceDirs(path);
  }
}

const read = (path: string): unknown => (existsSync(path) ? parseYaml(readFileSync(path, "utf8")) : undefined);

let moved = 0;
const orphans: string[] = [];
for (const dir of referenceDirs(PACKAGES))
  for (const file of readdirSync(dir).toSorted()) {
    if (!file.endsWith(".yaml") || OLD.some((suffix) => file.endsWith(suffix))) continue;
    const head = file.slice(0, -".yaml".length);
    const fields = read(join(dir, file)) as Omit<ReferenceEntry, "examples"> & { examples?: ReferenceExample[] };
    if (fields === undefined || typeof fields !== "object" || !("name" in fields)) continue;
    const examples =
      (read(join(dir, `${head}.examples.yaml`)) as ReferenceExample[] | undefined) ?? fields.examples ?? [];
    const implementations = read(join(dir, `${head}.implementations.yaml`)) as HeadImplementations | undefined;
    const ids = new Set(examples.map((e) => e.id));
    for (const id of Object.keys(implementations ?? {})) if (!ids.has(id)) orphans.push(`${dir}/${head}: ${id}`);
    const { examples: _inline, ...entry } = fields;
    await writeHead(dir, head, { entry: { ...entry, examples } as ReferenceEntry, implementations, body: "" });
    for (const suffix of [".yaml", ".examples.yaml", ".implementations.yaml"])
      rmSync(join(dir, `${head}${suffix}`), { force: true });
    moved++;
  }
console.log(`${moved} records moved`);
if (orphans.length > 0) console.log(`implementations rows with no example, dropped:\n  ${orphans.join("\n  ")}`);
