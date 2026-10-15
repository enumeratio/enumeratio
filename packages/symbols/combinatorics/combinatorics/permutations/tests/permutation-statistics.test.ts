import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { applyDefinition, declareStatistics } from "../../src/statistics/declare.ts";
import { PERMUTATION_STATISTICS } from "../src/statistics.ts";
import { FINDSTAT_READINGS as EXPECTED } from "./permutation-findstat-readings.ts";

const ce = bareEngine();
const index = declareStatistics(ce, PERMUTATION_STATISTICS);

/** Every permutation of 1..n, in one-line notation. */
function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}
const upTo = (n: number) => Array.from({ length: n + 1 }, (_, k) => k).flatMap((k) => permutations(k));

const evaluate = (head: string, p: number[]): number =>
  applyDefinition(ce, index.get(`${head}@Permutation`)!, ce.box(["List", ...p])).re;

test("every new permutation definition has an independent reading", () => {
  for (const head of Object.keys(EXPECTED)) expect(index.has(`${head}@Permutation`), head).toBe(true);
});

const ALL = upTo(5);
for (const [head, expected] of Object.entries(EXPECTED)) {
  test(`${head} agrees over every permutation of 1..5`, () => {
    for (const p of ALL) expect(evaluate(head, p), `[${p.join(", ")}]`).toBe(expected(p));
  });
}

// Larger permutations run nightly (DEEP_TESTS=1).
test.skipIf(!process.env.DEEP_TESTS)(
  "every new permutation definition agrees over every permutation of 6 and 7",
  () => {
    for (const p of [6, 7].flatMap((n) => permutations(n)))
      for (const [head, expected] of Object.entries(EXPECTED))
        expect(evaluate(head, p), `${head} [${p.join(", ")}]`).toBe(expected(p));
  },
  3_600_000,
);
