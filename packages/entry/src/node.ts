// Node-only: read and write reference YAML. The reference package's loader
// (`@enumeratio/reference/node`) reads every package, validates and collision-checks; this
// is the writer every tool goes through, and the reader for a package's own tests, which
// can't depend on reference (it depends on them).
//
// A record is written in two passes: `stringifyYaml` decides the structure (block style,
// MathJSON in flow style) under the strict scalar schema, and oxfmt, the repo's formatter,
// decides the layout: quotes, spacing, where a long MathJSON value breaks. So a record is
// exactly what `vp fmt` would make of it.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "oxfmt";
import { FORMAT } from "./format.ts";
import type { ReferenceEntry, ReferenceExample } from "./types.ts";
import { parseYaml, type StringifyOptions, stringifyYaml } from "./yaml.ts";

// A head's record is up to three files side by side: `<Head>.yaml` (the entry, all but its
// examples), `<Head>.examples.yaml` (a list, absent when there are none) and
// `<Head>.implementations.yaml` (generated; see collect-forms and the oracle scan).
export const EXAMPLES_SUFFIX = ".examples.yaml";
export const IMPLEMENTATIONS_SUFFIX = ".implementations.yaml";

/** True for a `<Head>.yaml` entry file, not one of its companions. */
export const isEntryFile = (file: string): boolean =>
  file.endsWith(".yaml") && !file.endsWith(EXAMPLES_SUFFIX) && !file.endsWith(IMPLEMENTATIONS_SUFFIX);

/** The head's entry, with its examples from `<Head>.examples.yaml` (none if it's absent). */
export function readEntry(dir: string, head: string): ReferenceEntry {
  const entry = parseYaml(readFileSync(join(dir, `${head}.yaml`), "utf8")) as Omit<ReferenceEntry, "examples">;
  const examplesPath = join(dir, `${head}${EXAMPLES_SUFFIX}`);
  const examples = existsSync(examplesPath)
    ? (parseYaml(readFileSync(examplesPath, "utf8")) as ReferenceExample[])
    : [];
  return { ...entry, examples };
}

/** Every entry in `dir`, by file name. */
export function readEntries(dir: string | URL): ReferenceEntry[] {
  const path = typeof dir === "string" ? dir : dir.pathname;
  return readdirSync(path)
    .filter(isEntryFile)
    .sort()
    .map((f) => readEntry(path, f.slice(0, -".yaml".length)));
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

/** Write generated source to `path` as `vp fmt` lays it out, so a regeneration diffs clean. */
export async function writeFormatted(path: string | URL, source: string): Promise<void> {
  const name = typeof path === "string" ? path : path.pathname;
  const { code, errors } = await format(name, source, FORMAT);
  if (errors.length > 0) throw new Error(`oxfmt: ${JSON.stringify(errors)}`);
  writeFileSync(path, code);
}

/** True if the text at `path` is what the writer makes of its own data. */
export async function isWrittenYaml(path: string, options?: StringifyOptions): Promise<boolean> {
  const text = readFileSync(path, "utf8");
  return (await formatYaml(parseYaml(text), options)) === text;
}

/** Write `entry` as `dir/<Head>.yaml` and `dir/<Head>.examples.yaml` (removed when it has none). */
export async function writeEntry(dir: string, entry: ReferenceEntry): Promise<void> {
  const { examples, ...rest } = JSON.parse(JSON.stringify(entry)) as ReferenceEntry;
  await writeYaml(join(dir, `${entry.name}.yaml`), rest);
  const examplesPath = join(dir, `${entry.name}${EXAMPLES_SUFFIX}`);
  if (examples.length > 0) await writeYaml(examplesPath, examples);
  else rmSync(examplesPath, { force: true });
}

/** Write `entries` into `dir`, one head each, and remove any other entry and examples there:
 * how a generator (statistics, domains) owns its package's reference directory. */
export async function writeEntries(dir: string | URL, entries: readonly ReferenceEntry[]): Promise<void> {
  const path = typeof dir === "string" ? dir : dir.pathname;
  mkdirSync(path, { recursive: true });
  const heads = new Set(entries.map((e) => e.name));
  for (const entry of entries) await writeEntry(path, entry);
  for (const file of readdirSync(path)) {
    const head = file.endsWith(EXAMPLES_SUFFIX)
      ? file.slice(0, -EXAMPLES_SUFFIX.length)
      : isEntryFile(file)
        ? file.slice(0, -".yaml".length)
        : undefined;
    if (head !== undefined && !heads.has(head)) rmSync(join(path, file));
  }
}
