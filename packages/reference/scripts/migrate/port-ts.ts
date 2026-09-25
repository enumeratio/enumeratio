// Step 4 of design/examples-as-data.md §8 turned the TS entries into YAML, one file per head
// in the package that declares it (routes.json, from route.ts). What's left here is the
// replay, for a branch that still carries entries edits made to the TS before the flip:
//
//   node packages/reference/scripts/migrate/port-ts.ts --replay <base> <lane>
//       For a lane caught mid-flight: its entries edits were made to the TS before the flip.
//       Evaluates each TS entries file as it was at <base> (the merge base) and at <lane>
//       (the lane's own commit), and writes YAML only for heads the lane changed. Run it after
//       merging main, on the merged tree.
//
// Evaluating the modules, not parsing them, is what flattens the computed values (`DOMAIN`
// constants, helpers, spreads, analytic's DEFINITIONS) into plain data.

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { ReferenceEntry } from "@enumeratio/entry";
import { writeYaml as write } from "@enumeratio/entry/node";
import routes from "./routes.json" with { type: "json" };
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/** The entries modules before the flip: path, and the name their entries were exported under. */
export const SHIMS: readonly { readonly path: string; readonly name: string }[] = [
  ...[
    ["aestimatio", "aestimatio"],
    ["combinatorics", "combinatorics"],
    ["sequences", "sequences"],
    ["residues", "residues"],
    ["number-theory", "numberTheory"],
    ["adeles", "adeles"],
    ["arithmetic", "arithmetic"],
    ["elementary", "elementary"],
    ["linear-algebra", "linearAlgebra"],
    ["special-functions", "specialFunctions"],
    ["analytic-special", "analyticSpecial"],
    ["analytic-elementary", "analyticElementary"],
    ["hypercomplex", "hypercomplex"],
    ["diagram", "diagramAlgebras"],
    ["numerals", "numerals"],
    ["hecke", "hecke"],
    ["incidence", "incidence"],
    ["quiver", "quiverAlgebras"],
    ["hopf", "hopf"],
    ["groupalgebra", "groupAlgebras"],
    ["modular", "modular"],
    ["braid", "braids"],
    ["collections", "collections"],
    ["lists", "lists"],
    ["enumerable-families", "enumerableFamilies"],
  ].map(([stem, name]) => ({ path: `packages/reference/src/entries/${stem}.ts`, name: name! })),
  { path: "packages/symbols/combinatorics/collections/src/entries.ts", name: "entries" },
  { path: "packages/symbols/combinatorics/statistics/src/entries.ts", name: "entries" },
  { path: "packages/symbols/combinatorics/domains/src/entries.ts", name: "entries" },
];

/** Where a package's YAML lives: `<package>/reference/`, or reference's own `entries/`. */
export const dataDir = (packageDir: string): string =>
  packageDir === "packages/reference" ? "packages/reference/entries" : `${packageDir}/reference`;

const PACKAGE_DIRS: Readonly<Record<string, string>> = {
  "packages/symbols/combinatorics/collections/src/entries.ts":
    "packages/symbols/combinatorics/collections",
  "packages/symbols/combinatorics/statistics/src/entries.ts":
    "packages/symbols/combinatorics/statistics",
  "packages/symbols/combinatorics/domains/src/entries.ts": "packages/symbols/combinatorics/domains",
};
const EXAMPLES_JSON = "packages/reference/src/entries/special-functions.examples.json";

const stemOf = (path: string): string | undefined =>
  /^packages\/reference\/src\/entries\/([\w-]+)\.ts$/.exec(path)?.[1];

/** Where a head of `path`'s YAML goes. */
function yamlPath(path: string, head: string): string {
  const stem = stemOf(path);
  const dir =
    stem === undefined
      ? PACKAGE_DIRS[path]
      : (routes as Record<string, { dir: string }>)[`${stem}/${head}`]?.dir;
  if (dir === undefined) throw new Error(`${path} ${head}: unrouted`);
  return `${dataDir(dir)}/${head}.yaml`;
}

/** A JSON-clean copy: what YAML can hold. Fails on anything it would drop. */
function plain(entry: ReferenceEntry, where: string): ReferenceEntry {
  const copy = JSON.parse(JSON.stringify(entry)) as ReferenceEntry;
  if (!isDeepStrictEqual(copy, entry)) throw new Error(`${where}: not plain data`);
  return copy;
}

/** A module's entries, from a file (at a git revision, when given). */
async function entriesAt(
  path: string,
  name: string,
  rev?: string,
): Promise<readonly ReferenceEntry[]> {
  let file = `${ROOT}${path}`;
  if (rev !== undefined) {
    // Next to the original, so its relative imports still resolve.
    file = `${ROOT}${path.replace(/\.ts$/, `.replay-${rev.slice(0, 12)}.ts`)}`;
    const text = execFileSync("git", ["show", `${rev}:${path}`], { cwd: ROOT, encoding: "utf8" });
    writeFileSync(file, text);
  }
  try {
    const mod = (await import(`${file}?${Date.now()}`)) as Record<string, unknown>;
    const entries = mod[name] as readonly ReferenceEntry[] | undefined;
    if (!Array.isArray(entries)) throw new Error(`${path}: no export ${name}`);
    return withJsonExamples(path, entries, rev);
  } finally {
    if (rev !== undefined) rmSync(file);
  }
}

/** special-functions.ts's heads carry more examples in its `.examples.json`, hidden by default. */
function withJsonExamples(
  path: string,
  entries: readonly ReferenceEntry[],
  rev?: string,
): readonly ReferenceEntry[] {
  if (stemOf(path) !== "special-functions") return entries;
  let text: string;
  try {
    text =
      rev === undefined
        ? execFileSync("cat", [EXAMPLES_JSON], { cwd: ROOT, encoding: "utf8" })
        : execFileSync("git", ["show", `${rev}:${EXAMPLES_JSON}`], { cwd: ROOT, encoding: "utf8" });
  } catch {
    return entries; // Already folded into the YAML.
  }
  const more = JSON.parse(text) as Record<string, object[]>;
  return entries.map((entry) => {
    const extra = more[entry.name] ?? [];
    return extra.length === 0
      ? entry
      : {
          ...entry,
          examples: [
            ...entry.examples,
            ...extra.map((e) => ({ hidden: true, ...e }) as ReferenceEntry["examples"][number]),
          ],
        };
  });
}

const writeYaml = async (path: string, entry: ReferenceEntry): Promise<void> => {
  mkdirSync(dirname(`${ROOT}${path}`), { recursive: true });
  await write(`${ROOT}${path}`, entry);
};

const args = process.argv.slice(2);
if (args[0] === "--replay" && args.length === 3) {
  const [, base, lane] = args as [string, string, string];
  const changed = execFileSync("git", ["diff", "--name-only", base, lane], {
    cwd: ROOT,
    encoding: "utf8",
  }).split("\n");
  let replayed = 0;
  for (const shim of SHIMS) {
    const touched =
      changed.includes(shim.path) ||
      (stemOf(shim.path) === "special-functions" && changed.includes(EXAMPLES_JSON));
    if (!touched) continue;
    const before = new Map((await entriesAt(shim.path, shim.name, base)).map((e) => [e.name, e]));
    for (const entry of await entriesAt(shim.path, shim.name, lane)) {
      if (isDeepStrictEqual(before.get(entry.name), entry)) continue;
      const path = yamlPath(shim.path, entry.name);
      await writeYaml(path, plain(entry, `${shim.path} ${entry.name}`));
      replayed++;
      console.log(`  ${path}`);
    }
  }
  console.log(`${replayed} heads replayed into YAML`);
} else {
  console.error("usage: port-ts.ts --replay <base> <lane>");
  process.exitCode = 1;
}
