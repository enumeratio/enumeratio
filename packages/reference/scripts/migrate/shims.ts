// The generated TS shims that stand in for the entries modules between step 4 (the data
// flip) and step 5 (consumers onto the loader) of design/examples-as-data.md §8. A shim
// embeds its entries as data, in page order, and names the YAML each came from; the YAML
// is the source, and `shims.test.ts` fails when the two disagree.
//
//   node packages/reference/scripts/migrate/shims.ts          # regenerate every shim from its YAML
//   node packages/reference/scripts/migrate/shims.ts --add <shim.ts> <path/to/Head.yaml>

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseYaml, type ReferenceEntry, stringifyYaml } from "@enumeratio/entry";

export const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/** Every shim: its path from the repo root, and the name its entries are exported under. */
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

export const readEntry = (source: string): ReferenceEntry =>
  parseYaml(readFileSync(`${ROOT}${source}`, "utf8")) as ReferenceEntry;

/** A shim's text for `sources`, in order. Formatted by the caller. */
export function renderShim(name: string, sources: readonly string[]): string {
  const entries = sources.map(readEntry);
  return `// GENERATED from YAML by packages/reference/scripts/migrate/shims.ts -- do not edit.
// Edit the YAML named in \`sources\`, then run \`node packages/reference/scripts/migrate/shims.ts\`.

import type { ReferenceEntry } from "@enumeratio/entry";

/** The YAML each entry below was generated from, in the same order. */
export const sources: readonly string[] = ${JSON.stringify(sources)};

export const ${name}: readonly ReferenceEntry[] = ${JSON.stringify(entries)};
`;
}

/** The \`sources\` list a shim on disk was generated from. */
export function sourcesOf(path: string): string[] {
  const text = readFileSync(`${ROOT}${path}`, "utf8");
  const match = /export const sources: readonly string\[\] = (\[[\s\S]*?\]);/.exec(text);
  if (match === null) throw new Error(`${path}: not a generated shim`);
  // Formatting may leave a trailing comma; the list is otherwise JSON.
  return JSON.parse(match[1]!.replace(/,(\s*\])$/, "$1")) as string[];
}

export function writeShims(
  shims: readonly { path: string; name: string; sources: readonly string[] }[],
): void {
  for (const { path, name, sources } of shims)
    writeFileSync(`${ROOT}${path}`, renderShim(name, sources));
  execFileSync("pnpm", ["exec", "vp", "fmt", ...shims.map((s) => s.path)], {
    cwd: ROOT,
    stdio: "ignore",
  });
}

/**
 * For the statistics and domains generators, which build an entries module as text: evaluate
 * it, write one YAML per entry into the package's `reference/` (dropping heads that are
 * gone), and regenerate the package's shim from them.
 */
export async function writeGeneratedEntries(packageDir: string, moduleText: string): Promise<void> {
  const shim = SHIMS.find((s) => s.path === `${packageDir}/src/entries.ts`);
  if (shim === undefined) throw new Error(`${packageDir}: no shim`);
  const temp = `${ROOT}${packageDir}/src/.entries-${process.pid}.ts`;
  writeFileSync(temp, moduleText);
  let entries: readonly ReferenceEntry[];
  try {
    entries = ((await import(temp)) as { entries: readonly ReferenceEntry[] }).entries;
  } finally {
    rmSync(temp);
  }
  const dir = dataDir(packageDir);
  mkdirSync(`${ROOT}${dir}`, { recursive: true });
  const sources = entries.map((entry) => {
    const source = `${dir}/${entry.name}.yaml`;
    writeFileSync(`${ROOT}${source}`, stringifyYaml(JSON.parse(JSON.stringify(entry))));
    return source;
  });
  for (const file of readdirSync(`${ROOT}${dir}`))
    if (file.endsWith(".yaml") && !sources.includes(`${dir}/${file}`))
      rmSync(`${ROOT}${dir}/${file}`);
  writeShims([{ ...shim, sources }]);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === "--add") {
    const [, path, source] = args;
    const shim = SHIMS.find((s) => s.path === path);
    if (shim === undefined || source === undefined)
      throw new Error("usage: shims.ts --add <shim.ts> <path/to/Head.yaml>");
    writeShims([{ ...shim, sources: [...sourcesOf(shim.path), source] }]);
  } else {
    writeShims(SHIMS.map((s) => ({ ...s, sources: sourcesOf(s.path) })));
  }
}
