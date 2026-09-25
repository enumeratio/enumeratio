// Node-only: read and write reference YAML. The reference package's loader
// (`@enumeratio/reference/node`) reads every package, validates and collision-checks; this
// is the writer every tool goes through, and the reader for a package's own tests, which
// can't depend on reference (it depends on them).
//
// A record is written in two passes: `stringifyYaml` decides the structure (block style,
// MathJSON in flow style) under the strict scalar schema, and oxfmt, the repo's formatter,
// decides the layout: quotes, spacing, where a long MathJSON value breaks. So a record is
// exactly what `vp fmt` would make of it.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "oxfmt";
import { FORMAT } from "./format.ts";
import type { ReferenceEntry } from "./types.ts";
import { parseYaml, type StringifyOptions, stringifyYaml } from "./yaml.ts";

/** Every `<Head>.yaml` in `dir` (not the `.implementations.yaml`), by file name. */
export function readEntries(dir: string | URL): ReferenceEntry[] {
  const path = typeof dir === "string" ? dir : dir.pathname;
  return readdirSync(path)
    .filter((f) => f.endsWith(".yaml") && !f.endsWith(".implementations.yaml"))
    .sort()
    .map((f) => parseYaml(readFileSync(join(path, f), "utf8")) as ReferenceEntry);
}

/** `value` as a record's text: the writer's structure, laid out by oxfmt. */
export async function formatYaml(value: unknown, options?: StringifyOptions): Promise<string> {
  const { code, errors } = await format("record.yaml", stringifyYaml(value, options), FORMAT);
  if (errors.length > 0) throw new Error(`oxfmt: ${JSON.stringify(errors)}`);
  return code;
}

/** Write `value` to `path` as a record. */
export async function writeYaml(path: string, value: unknown, options?: StringifyOptions): Promise<void> {
  writeFileSync(path, await formatYaml(value, options));
}

/** True if the text at `path` is what the writer makes of its own data. */
export async function isWrittenYaml(path: string, options?: StringifyOptions): Promise<boolean> {
  const text = readFileSync(path, "utf8");
  return (await formatYaml(parseYaml(text), options)) === text;
}

/** Write `entries` as `dir/<Head>.yaml`, one per entry, and remove any other record there:
 * how a generator (statistics, domains) owns its package's reference directory. */
export async function writeEntries(dir: string | URL, entries: readonly ReferenceEntry[]): Promise<void> {
  const path = typeof dir === "string" ? dir : dir.pathname;
  mkdirSync(path, { recursive: true });
  const names = new Set(entries.map((e) => `${e.name}.yaml`));
  for (const entry of entries) await writeYaml(join(path, `${entry.name}.yaml`), JSON.parse(JSON.stringify(entry)));
  for (const file of readdirSync(path))
    if (file.endsWith(".yaml") && !file.endsWith(".implementations.yaml") && !names.has(file)) rmSync(join(path, file));
}
