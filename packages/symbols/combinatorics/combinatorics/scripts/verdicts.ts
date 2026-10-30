// The memo of the compile steps' interpreter cross-checks (their one slow part), shared by
// the generators so an edit to one definition re-checks only that one. An answer is keyed by what
// it checked (the definition, its compiled code, the subjects), and trusted while the code doing
// the checking (`checkers`: a step's comparison, not its coordination) is unchanged. When only
// the dists the interpreter runs on moved, most answers are carried and a sample re-checked
// (manifest's `verdictCache`). Naming only the checkers keeps an edit to a driver, the
// shard split say, from re-running every check.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Verdicts } from "../src/statistics/generate-compiled.ts";

/** The memo manifest keeps (its `Verdicts`): it also plans a step's items, hands its answers across
 *  a process boundary (see shards.ts) and re-checks everything after a sampled divergence. */
export type SharedVerdicts = Verdicts & {
  plan(labels: readonly string[]): void;
  costs(): Readonly<Record<string, number>>;
  settle<T>(work: () => T): T;
  escalate(): void;
  save(): void;
  share(): Share;
  adopt(share: Share): void;
};

/** What one process learned (manifest's `VerdictShare`), for the process that saves the memo. */
interface Share {
  answers: Record<string, unknown>;
  verified: Record<string, string>;
  costs: Record<string, number>;
  hits: number;
  misses: number;
  carried: number;
  diverged: boolean;
}

// Imported by URL: a file outside the package in the program makes `vp pack` write its
// declarations beside it.
const { verdictCache, recheckAll } = (await import(
  new URL("../../../../manifest/scripts/stamp.ts", import.meta.url).href
)) as {
  verdictCache: (
    step: string,
    inputs: {
      dir: string;
      roots: string[];
      skip: (path: string) => boolean;
      omitDists: string[];
      imports?: string[];
    },
  ) => SharedVerdicts;
  recheckAll: () => boolean;
};

export { recheckAll };

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

/** The workspace packages the checks load (and so the dists, with what those import, that a
 *  verdict depends on); a dependency of this package outside them, such as plausible, cannot
 *  change one. tests/verdict-inputs.test.ts holds the checks' module graph to it. */
export const CHECKED_ON = ["@enumeratio/engine", "@enumeratio/structures", "@enumeratio/residues"];

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
    imports: CHECKED_ON,
  });

let familySource: string | undefined;

/**
 * A hash of the family sources an `early` callback can reach: the files that mention `early`
 * and everything they import locally (a closure reaches no further). Keyed into the verdict of
 * a family that has such a callback, so editing another family's file leaves it alone. An
 * import from outside the directory widens it to the whole directory.
 */
export function familySourceHash(): string {
  if (familySource !== undefined) return familySource;
  const dir = at("collections/src/families");
  const names = readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".generated.d.ts"));
  const text = new Map(names.map((n) => [n, readFileSync(join(dir, n), "utf8")]));
  const seen = new Set<string>();
  let whole = false;
  const visit = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    if (/\bimport\s*\(|^import\s+"/m.test(text.get(name)!)) whole = true;
    for (const m of text.get(name)!.matchAll(/\bfrom\s+"(\.[^"]*)"/g)) {
      const target = m[1]!.replace(/\.(js|ts)$/, "");
      if (target.startsWith("./") && text.has(`${target.slice(2)}.ts`)) visit(`${target.slice(2)}.ts`);
      else if (!target.endsWith(".generated")) whole = true;
    }
  };
  for (const [name, source] of text) if (/\bearly\b/.test(source)) visit(name);
  const hash = createHash("sha256");
  for (const name of names.toSorted()) if (whole || seen.has(name)) hash.update(`${name}\0`).update(text.get(name)!);
  return (familySource = hash.digest("hex"));
}
