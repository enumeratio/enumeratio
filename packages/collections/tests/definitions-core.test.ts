// Shard of definitions.test.ts: the frontier invariant, the entries well-formedness check, and
// a chunk of the reference-vs-implementation differential. See definitions-helpers.ts for
// shared setup, and definitions-inversions.test.ts / definitions-rest.test.ts for the rest of
// the differential.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { checkImplementations } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/entries.ts";
import { ce, DEFINITIONS, evaluate, permutations, PRIMITIVE } from "./definitions-helpers.ts";

const repoRoot = resolve(import.meta.dirname, "../../..");

test("every declared statistic either reduces or is on the frontier", () => {
  // The rule that keeps the frontier honest: nothing is silently irreducible.
  for (const head of Object.keys(DEFINITIONS)) expect(ce.lookupDefinition(head), head).toBeTruthy();
  for (const head of Object.keys(PRIMITIVE)) expect(ce.lookupDefinition(head), head).toBeTruthy();
});

// The differential. A reference definition that disagrees with the fast loop is the whole
// reason to write one down — and the reason a second implementation here cannot rot.
// Each of these evaluates the definition over every permutation of 1..6 — seconds of work
// under a parallel sweep, so the 5s default would be an arbitrary cliff.
const HEADS = ["Descents", "Records", "Excedances"] as const;
for (const head of HEADS) {
  const definition = DEFINITIONS[head];
  test(`${head}: the definition agrees with the implementation`, { timeout: 60_000 }, () => {
    for (let n = 0; n <= 6; n++) {
      for (const p of permutations(n)) {
        const native = ce.box([head, ["List", ...p]]).evaluate().re;
        expect(evaluate(definition, p), `${head}([${p}])`).toBe(native);
      }
    }
  });
}

test("the collection entries' implementation blocks are well formed", () => {
  // Same rule as the reference package's own entries — the rule travels to the entries,
  // because the entries live in the package that owns the heads.
  expect(checkImplementations(entries, (path) => existsSync(resolve(repoRoot, path)))).toEqual([]);
});
