// ── the classic invariant ─────────────────────────────────────────────────────────────────
//
// Crossings and nestings are equidistributed over set partitions of [n] (Kasraoui–Zeng), and
// the noncrossing partitions — like the nonnesting ones — are counted by the Catalan numbers.
// Checked against the JS reference (`countArcPairs`) rather than the engine: the reference is
// exercised against the engine's own answer, exhaustively, up to n = 6 and by sample at n = 7
// in setpartition-crossing-nesting-total.test.ts, so it stands in here for what would
// otherwise be an 877-partition-by-877-partition engine sweep at n = 7 alone. No engine calls
// here, so this file is cheap — split out purely so it doesn't serialize with the expensive
// groups above on one worker.
import { expect, test } from "vite-plus/test";
import { countArcPairs, setPartitions } from "./setpartition-helpers.ts";

const CATALAN = [1, 1, 2, 5, 14, 42, 132, 429];

test("Crossings and nestings are equidistributed over set partitions of [n], n <= 7", () => {
  for (let n = 0; n <= 7; n++) {
    const parts = setPartitions(n);
    const crossings = parts.map((b) => countArcPairs(b, "crossing")).sort((a, c) => a - c);
    const nestings = parts.map((b) => countArcPairs(b, "nesting")).sort((a, c) => a - c);
    expect(crossings, `n=${n}`).toEqual(nestings);
  }
});

test("noncrossing and nonnesting set partitions of [n] are each counted by Catalan(n), n <= 7", () => {
  for (let n = 0; n <= 7; n++) {
    const parts = setPartitions(n);
    const noncrossing = parts.filter((b) => countArcPairs(b, "crossing") === 0).length;
    const nonnesting = parts.filter((b) => countArcPairs(b, "nesting") === 0).length;
    expect(noncrossing, `noncrossing n=${n}`).toBe(CATALAN[n]);
    expect(nonnesting, `nonnesting n=${n}`).toBe(CATALAN[n]);
  }
});
