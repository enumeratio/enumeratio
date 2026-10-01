import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { checkImplementations } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/entries.ts";
import { DEFINITIONS, PRIMITIVE } from "../src/definitions.ts";
import { declareStats } from "../src/stats.ts";

const ce = new ComputeEngine();
declareStats(ce);
const repoRoot = resolve(import.meta.dirname, "../../..");

/** Every permutation of 1..n, as MathJSON lists. */
function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}

const evaluate = (expr: unknown, p: number[]): number =>
  ce
    .box(expr as Parameters<ComputeEngine["box"]>[0])
    .subs({ _p: ce.box(["List", ...p]) })
    .evaluate().re;

test("every declared statistic either reduces or is on the frontier", () => {
  // The rule that keeps the frontier honest: nothing is silently irreducible.
  for (const head of Object.keys(DEFINITIONS)) expect(ce.lookupDefinition(head), head).toBeTruthy();
  for (const head of Object.keys(PRIMITIVE)) expect(ce.lookupDefinition(head), head).toBeTruthy();
});

// The differential. A reference definition that disagrees with the fast loop is the whole
// reason to write one down — and the reason a second implementation here cannot rot.
// Each of these evaluates the definition over every permutation of 1..6 — seconds of work
// under a parallel sweep, so the 5s default would be an arbitrary cliff.
for (const [head, definition] of Object.entries(DEFINITIONS)) {
  test(`${head}: the definition agrees with the implementation`, { timeout: 60_000 }, () => {
    for (let n = 0; n <= 6; n++) {
      for (const p of permutations(n)) {
        const native = ce.box([head, ["List", ...p]]).evaluate().re;
        expect(evaluate(definition, p), `${head}([${String(p)}])`).toBe(native);
      }
    }
  });
}

test("the collection entries' implementation blocks are well formed", () => {
  // Same rule as the reference package's own entries — the rule travels to the entries,
  // because the entries live in the package that owns the heads.
  expect(checkImplementations(entries, (path) => existsSync(resolve(repoRoot, path)))).toEqual([]);
});
