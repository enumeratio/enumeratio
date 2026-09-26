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

/** `entry` as the files it's written to, by name: `<Head>.yaml`, and `<Head>.examples.yaml`
 * when it has examples. */
export async function entryFiles(entry: ReferenceEntry): Promise<Map<string, string>> {
  const { examples, ...rest } = JSON.parse(JSON.stringify(entry)) as ReferenceEntry;
  const files = new Map([[`${entry.name}.yaml`, await formatYaml(rest)]]);
  if (examples.length > 0) files.set(`${entry.name}${EXAMPLES_SUFFIX}`, await formatYaml(examples));
  return files;
}

/** Write `entry` as `dir/<Head>.yaml` and `dir/<Head>.examples.yaml` (removed when it has none). */
export async function writeEntry(dir: string, entry: ReferenceEntry): Promise<void> {
  const files = await entryFiles(entry);
  for (const [file, text] of files) writeFileSync(join(dir, file), text);
  if (!files.has(`${entry.name}${EXAMPLES_SUFFIX}`))
    rmSync(join(dir, `${entry.name}${EXAMPLES_SUFFIX}`), { force: true });
}

/** A generator's output: its entries, every head it owns (written or not) and the fields it
 * writes. A head it owns but leaves out (one compute-engine now declares, say) has its record
 * removed; any other field on its records (`formerly`, `references`, …) is curated by hand and
 * kept. */
export interface GeneratedEntries {
  readonly entries: readonly ReferenceEntry[];
  readonly owned: ReadonlySet<string>;
  readonly fields: ReadonlySet<string>;
}

/** `entry` with the hand-curated fields of the record already in `dir`, after its own. */
function withCurated(dir: string, entry: ReferenceEntry, fields: ReadonlySet<string>): ReferenceEntry {
  if (!existsSync(join(dir, `${entry.name}.yaml`))) return entry;
  const curated = Object.entries(readEntry(dir, entry.name)).filter(([key]) => !fields.has(key));
  return { ...entry, ...Object.fromEntries(curated) };
}

/** What `writeEntries` would change in `dir`: each file it would write, rewrite or remove. */
export async function staleEntries(dir: string | URL, { entries, owned, fields }: GeneratedEntries): Promise<string[]> {
  const path = typeof dir === "string" ? dir : dir.pathname;
  const onDisk = (file: string): string | undefined =>
    existsSync(join(path, file)) ? readFileSync(join(path, file), "utf8") : undefined;
  const expected = new Map<string, string | undefined>();
  for (const head of owned)
    for (const suffix of [".yaml", EXAMPLES_SUFFIX]) expected.set(`${head}${suffix}`, undefined);
  for (const entry of entries)
    for (const [file, text] of await entryFiles(withCurated(path, entry, fields))) expected.set(file, text);
  return [...expected].filter(([file, text]) => onDisk(file) !== text).map(([file]) => file);
}

/** Write a generator's entries into `dir`, one head each, and remove the records of heads it
 * owns but left out, keeping their curated fields. Any other record there (a hand-written one)
 * is never touched. */
export async function writeEntries(dir: string | URL, { entries, owned, fields }: GeneratedEntries): Promise<void> {
  const path = typeof dir === "string" ? dir : dir.pathname;
  const stray = entries.filter((e) => !owned.has(e.name)).map((e) => e.name);
  if (stray.length > 0) throw new Error(`writeEntries: not owned: ${stray.join(", ")}`);
  mkdirSync(path, { recursive: true });
  const heads = new Set(entries.map((e) => e.name));
  for (const entry of entries) await writeEntry(path, withCurated(path, entry, fields));
  for (const head of owned)
    if (!heads.has(head))
      for (const suffix of [".yaml", EXAMPLES_SUFFIX]) rmSync(join(path, `${head}${suffix}`), { force: true });
}
