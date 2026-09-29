// Write each package's contribution to the engine into the records (https://github.com/enumeratio/enumeratio/wiki/Manifest):
// declare every package in order, and for each head a step adds or re-signs, or whose
// handler it replaces, give the head's record a typed row for that package -- `type` as the
// engine prints it, `overrides` naming who had the head before, `HoldAll` for `lazy`. A
// head with no record gets a skeleton one, its summary marked for a person to write.
//
//   vp node packages/census/scripts/type-records.ts

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReferenceEntry, ReferenceSignature } from "@enumeratio/entry";
import { headNames, readEntry, recordDirs, writeEntry } from "@enumeratio/entry/node";
import { contributions as contributionsOf, ENGINE } from "../src/contributions.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
export const TODO_SUMMARY = "TODO: summary";

const packageOf = (library: string | undefined): string =>
  library === undefined ? ENGINE : library.replace(/^@enumeratio\//, "").replace(/^enumeratio-/, "");
const libraryOf = (pkg: string): string => (pkg === ENGINE ? ENGINE : `enumeratio-${pkg}`);

const contributions = contributionsOf();

// --- the records -------------------------------------------------------------------------

interface Located {
  dir: string;
  pkg: string;
  entry: ReferenceEntry;
}
const records = new Map<string, Located>();
const dirOf = new Map<string, string>();
// reference's own copy is the canonical one (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §9).
const dirs = recordDirs(PACKAGES).toSorted(
  (a, b) => Number(b.package === "reference") - Number(a.package === "reference"),
);
for (const { package: pkg, dir } of dirs) {
  dirOf.set(pkg, dir);
  for (const head of headNames(dir)) {
    const entry = readEntry(dir, head);
    if (!records.has(entry.name)) records.set(entry.name, { dir, pkg, entry });
  }
}

/** Where a package keeps its records: its `reference/`, found by its directory name. */
function recordDirFor(pkg: string): string {
  const known = dirOf.get(pkg);
  if (known !== undefined) return known;
  const candidates = [
    join(PACKAGES, pkg),
    ...readdirSync(join(PACKAGES, "symbols")).map((group) => join(PACKAGES, "symbols", group, pkg)),
  ];
  const home = candidates.find(existsSync);
  if (home === undefined) throw new Error(`type-records: no package directory for ${pkg}`);
  const dir = join(home, "reference");
  mkdirSync(dir, { recursive: true });
  dirOf.set(pkg, dir);
  return dir;
}

/** The domain most of a package's records share, for a skeleton record. */
function domainFor(pkg: string): string {
  const counts = new Map<string, number>();
  for (const r of records.values())
    if (r.pkg === pkg) counts.set(r.entry.domain, (counts.get(r.entry.domain) ?? 0) + 1);
  return [...counts].toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? pkg;
}

// --- writing -----------------------------------------------------------------------------

const touched = new Set<Located>();
let created = 0;
let typed = 0;
for (const [name, list] of [...contributions].toSorted(([a], [b]) => (a < b ? -1 : 1))) {
  let located = records.get(name);
  if (located === undefined) {
    // A head of the engine's own lives with the engine's records, in reference's entries.
    const pkg = list[0].previous === ENGINE ? "reference" : list[0].pkg;
    const entry: ReferenceEntry = {
      name,
      domain: pkg === "reference" ? "Compute engine" : domainFor(pkg),
      signature: `${name}(…)`,
      summary: TODO_SUMMARY,
      examples: [],
    };
    located = { dir: recordDirFor(pkg), pkg, entry };
    records.set(name, located);
    created++;
  }
  const entry = located.entry as { -readonly [K in keyof ReferenceEntry]: ReferenceEntry[K] };
  const rows: ReferenceSignature[] = [...(entry.signatures ?? [])];
  for (const c of list) {
    const at = rows.findIndex((row) => packageOf(row.library) === c.pkg);
    const row: ReferenceSignature = {
      ...(at >= 0 ? rows[at] : { call: entry.signature, description: entry.summary, library: libraryOf(c.pkg) }),
      type: c.type,
      ...(c.previous !== undefined ? { overrides: libraryOf(c.previous) } : {}),
    };
    if (c.previous === undefined) delete (row as { overrides?: string }).overrides;
    if (at >= 0) rows[at] = row;
    else rows.push(row);
    typed++;
  }
  entry.signatures = rows;
  // The package that has the last word decides whether the head holds its arguments.
  const holds = list[list.length - 1].lazy;
  const others = (entry.attributes ?? []).filter((a) => a !== "HoldAll");
  entry.attributes = holds ? ["HoldAll", ...others] : others;
  if (entry.attributes.length === 0) delete entry.attributes;
  touched.add(located);
}

for (const { dir, entry } of touched) await writeEntry(dir, entry);
console.log(`${contributions.size} heads contributed to; ${typed} typed rows; ${created} skeleton records`);
