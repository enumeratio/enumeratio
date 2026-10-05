// Node-only: read and write the reference records. The reference package's loader
// (`@enumeratio/reference/node`) reads every package, validates and collision-checks; this
// is the writer every tool goes through, and the reader for a package's own tests, which
// can't depend on reference (it depends on them).
//
// A record is written in two passes: `stringifyYaml` decides the structure (block style,
// MathJSON in flow style) under the strict scalar schema, and oxfmt, the repo's formatter,
// decides the layout: quotes, spacing, where a long MathJSON value breaks. So a record is
// exactly what `vp fmt` would make of it.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { format } from "oxfmt";
import { FORMAT } from "./format.ts";
import type { ComponentStory, ReferenceEntry } from "./types.ts";
import { parseYaml, type StringifyOptions, stringifyYaml } from "./yaml.ts";
import { EXAMPLES_FILE, headExists, headFiles, headNames, readHead, removeHead, updateHead } from "./record.ts";

// A component's stories: `<Name>.stories.yaml` beside the element sources, one file per
// component (packages/components/reference/), a plain list.
export const STORIES_SUFFIX = ".stories.yaml";

/** The head's entry, from its folder (see ./record.ts). */
export function readEntry(dir: string, head: string): ReferenceEntry {
  return readHead(dir, head).entry;
}

/** Every entry in `dir`, by head name. */
export function readEntries(dir: string | URL): ReferenceEntry[] {
  const path = typeof dir === "string" ? dir : dir.pathname;
  return headNames(path).map((head) => readEntry(path, head));
}

/** One component's stories, in page order (absent file reads as none). */
export function readStories(dir: string | URL, name: string): ComponentStory[] {
  const path = join(typeof dir === "string" ? dir : dir.pathname, `${name}${STORIES_SUFFIX}`);
  return existsSync(path) ? (parseYaml(readFileSync(path, "utf8")) as ComponentStory[]) : [];
}

/** Write `stories` to `dir/<Name>.stories.yaml`, removed when there are none. */
export async function writeStories(dir: string | URL, name: string, stories: readonly ComponentStory[]): Promise<void> {
  const path = join(typeof dir === "string" ? dir : dir.pathname, `${name}${STORIES_SUFFIX}`);
  if (stories.length === 0) {
    rmSync(path, { force: true });
    return;
  }
  await writeYaml(path, stories);
}

/** A package's directory: in the tree, or installed beside it. */
export interface PackageDir {
  /** The package's name without its scope. */
  readonly package: string;
  readonly dir: string;
  /** From `node_modules`, not from the tree: read it, never write it. */
  readonly installed?: true;
}

const SCOPE = "@enumeratio/";

/** The first `node_modules/<name>` at or above `from` (an installed package is a symlink under pnpm). */
function installedAt(from: string, name: string): string | undefined {
  for (let dir = from; ; dir = dirname(dir)) {
    const found = join(dir, "node_modules", name);
    if (existsSync(join(found, "package.json"))) return found;
    if (dirname(dir) === dir) return undefined;
  }
}

/**
 * Every package under `packages/` (`<package>/`, a symbol library's `symbols/<group>/<package>/`), then
 * the `@enumeratio/*` libraries those depend on that the tree doesn't hold: installed ones, found as
 * Node would find them from the dependent. A name in the tree wins over an installed one. Only a
 * checkout merges the two; any other root (an installed scope, a test fixture) is what it holds.
 */
export function packageDirs(packagesRoot: string): PackageDir[] {
  // A package may be a symlink (an installed one is, under node_modules/@enumeratio).
  const subdirs = (dir: string): string[] =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isDirectory() || e.isSymbolicLink())
          .map((e) => e.name)
          .toSorted()
      : [];
  const inTree: PackageDir[] = [
    ...subdirs(packagesRoot).map((pkg) => ({ package: pkg, dir: join(packagesRoot, pkg) })),
    ...subdirs(join(packagesRoot, "symbols")).flatMap((group) =>
      subdirs(join(packagesRoot, "symbols", group)).map((pkg) => ({
        package: pkg,
        dir: join(packagesRoot, "symbols", group, pkg),
      })),
    ),
  ];
  if (!existsSync(join(packagesRoot, "symbols"))) return inTree;
  const known = new Set(inTree.map((p) => p.package));
  const installed = new Map<string, PackageDir>();
  for (const { dir } of inTree) {
    const file = join(dir, "package.json");
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, string> | undefined>;
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"])
      for (const name of Object.keys(pkg[field] ?? {})) {
        const library = name.slice(SCOPE.length);
        if (!name.startsWith(SCOPE) || known.has(library) || installed.has(library)) continue;
        const found = installedAt(dir, name);
        if (found !== undefined) installed.set(library, { package: library, dir: found, installed: true });
      }
  }
  return [...inTree, ...[...installed.values()].toSorted((a, b) => (a.package < b.package ? -1 : 1))];
}

/** Where the records live: `<package>/reference/` for each of `packageDirs`, and reference's own `entries/` (the engine's heads). */
export function recordDirs(packagesRoot: string): PackageDir[] {
  return packageDirs(packagesRoot)
    .map((p) => ({ ...p, dir: join(p.dir, p.package === "reference" ? "entries" : "reference") }))
    .filter(({ dir }) => existsSync(dir));
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

/** True if a head's folder is exactly what the writer makes of its own data. */
export async function isWrittenHead(dir: string, head: string): Promise<string[]> {
  const drift: string[] = [];
  for (const [file, text] of await headFiles(readHead(dir, head))) {
    const path = join(dir, head, file);
    if (!existsSync(path) || readFileSync(path, "utf8") !== text) drift.push(file);
  }
  return drift;
}

/** Write `entry` into its folder in `dir`, keeping the head's implementations and body. */
export async function writeEntry(dir: string, entry: ReferenceEntry): Promise<void> {
  await updateHead(dir, entry.name, { entry });
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
  if (!headExists(dir, entry.name)) return entry;
  const curated = Object.entries(readEntry(dir, entry.name)).filter(([key]) => !fields.has(key));
  return { ...entry, ...Object.fromEntries(curated) };
}

/** What `writeEntries` would change in `dir`: each file it would write, rewrite or remove. */
export async function staleEntries(dir: string | URL, { entries, owned, fields }: GeneratedEntries): Promise<string[]> {
  const path = typeof dir === "string" ? dir : dir.pathname;
  const stale: string[] = [];
  const heads = new Set(entries.map((e) => e.name));
  for (const head of owned) if (!heads.has(head) && headExists(path, head)) stale.push(`${head}/`);
  for (const entry of entries) {
    const current = headExists(path, entry.name) ? readHead(path, entry.name) : undefined;
    const want = await headFiles({
      entry: withCurated(path, entry, fields),
      implementations: current?.implementations,
      body: current?.body ?? "",
      notation: current?.notation,
    });
    const onDisk = existsSync(join(path, entry.name)) ? readdirSync(join(path, entry.name)) : [];
    for (const [file, text] of want) {
      const at = join(path, entry.name, file);
      if (!existsSync(at) || readFileSync(at, "utf8") !== text) stale.push(`${entry.name}/${file}`);
    }
    for (const file of onDisk)
      if (!want.has(file) && (file === EXAMPLES_FILE || file.startsWith("examples.values.")))
        stale.push(`${entry.name}/${file}`);
  }
  return stale;
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
  for (const entry of entries) await updateHead(path, entry.name, { entry: withCurated(path, entry, fields) });
  for (const head of owned) if (!heads.has(head)) removeHead(path, head);
}

export {
  decodeHead,
  EXAMPLES_FILE,
  headExists,
  headFiles,
  headNames,
  type HeadRecord,
  INDEX_FILE,
  isValuesFile,
  NOTATION_FILE,
  parseIndex,
  readHead,
  removeHead,
  updateHead,
  valuesFile,
  writeHead,
} from "./record.ts";
