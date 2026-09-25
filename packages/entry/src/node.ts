// Node-only: read (and, for a generator, write) one package's own reference YAML. The reference package's loader
// (`@enumeratio/reference/node`) reads every package, validates and collision-checks; this
// is for a package's own tests, which can't depend on reference (it depends on them).

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ReferenceEntry } from "./types.ts";
import { parseYaml, stringifyYaml } from "./yaml.ts";

/** Every `<Head>.yaml` in `dir` (not the `.implementations.yaml`), by file name. */
export function readEntries(dir: string | URL): ReferenceEntry[] {
  const path = typeof dir === "string" ? dir : dir.pathname;
  return readdirSync(path)
    .filter((f) => f.endsWith(".yaml") && !f.endsWith(".implementations.yaml"))
    .sort()
    .map((f) => parseYaml(readFileSync(join(path, f), "utf8")) as ReferenceEntry);
}

/** Write `entries` as `dir/<Head>.yaml`, one per entry, and remove any other record there:
 * how a generator (statistics, domains) owns its package's reference directory. */
export function writeEntries(dir: string | URL, entries: readonly ReferenceEntry[]): void {
  const path = typeof dir === "string" ? dir : dir.pathname;
  mkdirSync(path, { recursive: true });
  const names = new Set(entries.map((e) => `${e.name}.yaml`));
  for (const entry of entries)
    writeFileSync(
      join(path, `${entry.name}.yaml`),
      stringifyYaml(JSON.parse(JSON.stringify(entry))),
    );
  for (const file of readdirSync(path))
    if (file.endsWith(".yaml") && !file.endsWith(".implementations.yaml") && !names.has(file))
      rmSync(join(path, file));
}
