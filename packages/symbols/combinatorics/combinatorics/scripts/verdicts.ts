// The memo of the compile steps' interpreter cross-checks (their one slow part), shared by
// the generators so an edit to one definition re-checks only that one. An answer is keyed by what
// it checked (the definition, its compiled code, the subjects), and trusted while the code doing
// the checking (`checkers`: a step's comparison, not its coordination) and the dists the
// interpreter runs on are unchanged. Naming only the checkers keeps an edit to a driver, the
// shard split say, from re-running every check.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Verdicts } from "../src/statistics/generate-compiled.ts";

// Imported by URL: a file outside the package in the program makes `vp pack` write its
// declarations beside it.
const { verdictCache } = (await import(new URL("../../../../manifest/scripts/stamp.ts", import.meta.url).href)) as {
  verdictCache: (
    step: string,
    inputs: { dir: string; roots: string[]; skip: (path: string) => boolean; omitDists: string[] },
  ) => Verdicts & { save(): void };
};

const at = (path: string): string => fileURLToPath(new URL(`../${path}`, import.meta.url));

/** Where each kind of cross-check lives, for `verdictsFor`. */
export const checkers = {
  /** compile-maps.ts's `agrees`. Its oracle, `evaluateDefinition`, is structures' (a dist, hashed
   *  anyway); src/maps.ts only re-exports it, so it stays out. */
  maps: ["scripts/compile-maps.ts"],
  /** The statistics areas' shared `agrees`. */
  statistics: ["src/statistics/generate-compiled.ts"],
  /** The families' `disagreements`, and the Epsil it reads them through (epsil.ts and what it
   *  imports locally). A family is read only through its own fields, which its verdict is keyed
   *  on, so an edit to one family's file leaves the others' verdicts; `familySourceHash` covers
   *  what a field can't carry. */
  families: [
    "scripts/family-checks.ts",
    "collections/src/families/epsil.ts",
    "collections/src/families/types.ts",
    "collections/src/families/work.ts",
  ],
} as const;

// Manifest's dist is built from every package's records, so any record edit would void every
// verdict. The checks run on a bare engine and structures' interpreter, which read none of that
// data; only manifest's code (src, minus what the build generates) reaches them, through boxes.
export const verdictsFor = (step: string, roots: readonly string[]) =>
  verdictCache(step, {
    dir: at(""),
    roots: [...roots.map(at), at("../../../manifest/src")],
    // Generated outputs are what the steps write, not what the checks read.
    skip: (path) => path.endsWith("/manifest/src/generated") || /\.generated\.(js|ts)$/.test(path),
    omitDists: ["@enumeratio/manifest"],
  });

/** A hash of every source file under the families directory (not the generated module), for the
 *  verdicts of a family whose `early` callbacks close over code in it. */
let familySource: string | undefined;
export function familySourceHash(): string {
  if (familySource !== undefined) return familySource;
  const dir = at("collections/src/families");
  const hash = createHash("sha256");
  for (const name of readdirSync(dir).toSorted()) {
    if (!name.endsWith(".ts") || name.endsWith(".generated.d.ts")) continue;
    hash.update(`${name}\0`).update(readFileSync(join(dir, name)));
  }
  return (familySource = hash.digest("hex"));
}
