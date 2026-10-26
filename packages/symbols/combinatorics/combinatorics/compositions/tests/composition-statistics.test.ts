import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../../src/index.ts";
import { applyDefinition } from "../../src/statistics/declare.ts";
import { bySignature } from "../../src/statistics/types.ts";
import { COMPOSITION_STATISTICS } from "../src/statistics.ts";
import { COMPOSITION_READINGS } from "./composition-findstat-readings.ts";

// The whole library, as a page evaluates it.
const ce = bareEngine();
declareCombinatorics(ce);
const index = bySignature(COMPOSITION_STATISTICS);

/** Every composition of n, the parts in order. */
function compositions(n: number): number[][] {
  if (n === 0) return [[]];
  return Array.from({ length: n }, (_, k) => k + 1).flatMap((first) =>
    compositions(n - first).map((rest) => [first, ...rest]),
  );
}
const upTo = (n: number): number[][] => Array.from({ length: n + 1 }, (_, k) => k).flatMap(compositions);

const evaluate = (head: string, parts: readonly number[]): number =>
  applyDefinition(ce, index.get(`${head}@Composition`)!, ce.box(["List", ...parts] as never)).re;

test("every composition definition has an independent reading", () => {
  for (const { head } of COMPOSITION_STATISTICS) expect(COMPOSITION_READINGS[head], head).toBeDefined();
  expect(Object.keys(COMPOSITION_READINGS).length).toBe(COMPOSITION_STATISTICS.length);
});

// The brute-force readings (tableaux, subsequences) are the slow ones: every composition of 0..7.
const SMALL = upTo(7);
// The subset dynamic program behind these takes tens of seconds on the compositions of 7; size 7
// is nightly (DEEP_TESTS=1) for them.
const SLOW = new Set(["StandardCompositionTableauCount"]);
for (const [head, expected] of Object.entries(COMPOSITION_READINGS)) {
  const sizes = SLOW.has(head) ? upTo(6) : SMALL;
  test(`${head} agrees over every composition of 0..${SLOW.has(head) ? 6 : 7}`, () => {
    for (const c of sizes) expect(evaluate(head, c), JSON.stringify(c)).toBe(expected(c));
  });
}

test("each head called on the carrier value gives the reading", () => {
  for (const [head, expected] of Object.entries(COMPOSITION_READINGS))
    for (const c of upTo(4))
      expect(
        ce.box([head, ["Composition", ["List", ...c]]] as never).evaluate().re,
        `${head} ${JSON.stringify(c)}`,
      ).toBe(expected(c));
});

// Larger compositions run nightly (DEEP_TESTS=1).
test.skipIf(!process.env.DEEP_TESTS)(
  "every composition definition agrees over the compositions of 8",
  () => {
    for (const c of compositions(8))
      for (const [head, expected] of Object.entries(COMPOSITION_READINGS))
        expect(evaluate(head, c), `${head} ${JSON.stringify(c)}`).toBe(expected(c));
    for (const c of compositions(7))
      for (const head of SLOW)
        expect(evaluate(head, c), `${head} ${JSON.stringify(c)}`).toBe(COMPOSITION_READINGS[head]!(c));
  },
  1_800_000,
);
