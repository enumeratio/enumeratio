import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../../src/index.ts";
import { applyDefinition } from "../../src/statistics/declare.ts";
import { bySignature } from "../../src/statistics/types.ts";
import { DYCK_STATISTICS } from "../src/statistics.ts";
import { DYCK_READINGS, type Word } from "./dyck-findstat-readings.ts";

// The whole library, as a page evaluates: a definition that works on a bare engine can still not on this one.
const ce = bareEngine();
declareCombinatorics(ce);
const index = bySignature(DYCK_STATISTICS);

/** Every Dyck word of semilength n, as 1 = up and 0 = down. */
function dyckWords(n: number): number[][] {
  const out: number[][] = [];
  const walk = (word: number[], up: number, down: number): void => {
    if (word.length === 2 * n) {
      out.push(word);
      return;
    }
    if (up < n) walk([...word, 1], up + 1, down);
    if (down < up) walk([...word, 0], up, down + 1);
  };
  walk([], 0, 0);
  return out;
}

const evaluate = (head: string, w: Word): number =>
  applyDefinition(ce, index.get(`${head}@DyckPath`)!, ce.box(["List", ...w])).re;

test("every FindStat reading belongs to a definition", () => {
  for (const head of Object.keys(DYCK_READINGS)) expect(index.get(`${head}@DyckPath`), head).toBeDefined();
});

const SMALL = [0, 1, 2, 3, 4].flatMap(dyckWords);

for (const [head, expected] of Object.entries(DYCK_READINGS)) {
  test(`${head} agrees over every Dyck path of semilength 0..4`, () => {
    for (const w of SMALL) expect(evaluate(head, w), `[${w.join(", ")}]`).toBe(expected(w));
  });
}

test("each head called on the carrier value gives the reading", () => {
  for (const [head, expected] of Object.entries(DYCK_READINGS))
    for (const w of [0, 1, 2, 3].flatMap(dyckWords))
      expect(ce.box([head, ["DyckPath", ["List", ...w]]] as never).evaluate().re, `${head} [${w.join(", ")}]`).toBe(
        expected(w),
      );
});

// Longer paths run nightly (DEEP_TESTS=1).
test.skipIf(!process.env.DEEP_TESTS)(
  "every FindStat definition agrees over semilength 5..7",
  () => {
    for (const w of [5, 6, 7].flatMap(dyckWords))
      for (const [head, expected] of Object.entries(DYCK_READINGS))
        expect(evaluate(head, w), `${head} [${w.join(", ")}]`).toBe(expected(w));
  },
  1_800_000,
);
