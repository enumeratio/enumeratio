// CrossingNestingTotal plus the n=7 sample check — split out of setpartition.test.ts (see
// setpartition-crossings.test.ts and setpartition-helpers.ts) so this group's cost doesn't
// serialize with Crossings/Nestings or the cheap block-size statistics on one worker.
import { checkAgainstEngine, EXPECTED, evaluate, setPartitions } from "./setpartition-helpers.ts";
import { expect, test } from "vite-plus/test";

checkAgainstEngine(["CrossingNestingTotal"]);

// A sample of [7], rather than all Bell(7) = 877 of them, against the engine — the full sweep
// at this size costs minutes for Crossings/Nestings (see setpartition-helpers.ts) for the same
// answer the JS reference already gives instantly, and setpartition-invariants.test.ts covers
// n = 7 exhaustively through that reference.
test("Crossings, Nestings and CrossingNestingTotal agree on a sample of set partitions of [7]", () => {
  const sample = setPartitions(7).filter((_, i) => i % 29 === 0); // ~30 of the 877
  for (const head of ["Crossings", "Nestings", "CrossingNestingTotal"]) {
    const expected = EXPECTED[head]!;
    for (const b of sample) expect(evaluate(head, b), JSON.stringify(b)).toBe(expected(b));
  }
});
