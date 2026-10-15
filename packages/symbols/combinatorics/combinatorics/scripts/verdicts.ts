// The memo of the compile steps' interpreter cross-checks (their one slow part), shared by
// the generators so an edit to one definition re-checks only that one. An answer is keyed by what
// it checked (the definition, its compiled code, the subjects), and trusted while the code doing
// the checking (`checkers`: a step's comparison, not its coordination) and the dists the
// interpreter runs on are unchanged. Naming only the checkers keeps an edit to a driver, the
// shard split say, from re-running every check.

import { fileURLToPath } from "node:url";
import type { Verdicts } from "../src/statistics/generate-compiled.ts";

// Imported by URL: a file outside the package in the program makes `vp pack` write its
// declarations beside it.
const { verdictCache } = (await import(new URL("../../../../manifest/scripts/stamp.ts", import.meta.url).href)) as {
  verdictCache: (step: string, inputs: { dir: string; roots: string[] }) => Verdicts & { save(): void };
};

const at = (path: string): string => fileURLToPath(new URL(`../${path}`, import.meta.url));

/** Where each kind of cross-check lives, for `verdictsFor`. */
export const checkers = {
  /** compile-maps.ts's `agrees`. Its oracle, `evaluateDefinition`, is structures' (a dist, hashed
   *  anyway); src/maps.ts only re-exports it, so it stays out. */
  maps: ["scripts/compile-maps.ts"],
  /** The statistics areas' shared `agrees`. */
  statistics: ["src/statistics/generate-compiled.ts"],
  /** The families' `disagreements`, and the Epsil it reads them through. */
  families: ["scripts/family-checks.ts", "collections/src/families/epsil.ts", "collections/src/families/types.ts"],
} as const;

export const verdictsFor = (step: string, roots: readonly string[]) =>
  verdictCache(step, { dir: at(""), roots: roots.map(at) });
