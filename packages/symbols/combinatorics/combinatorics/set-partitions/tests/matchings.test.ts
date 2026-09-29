import { expect, test } from "vite-plus/test";
import { check, checkFamily, random } from "../../collections/scripts/properties.ts";
import { entries } from "../src/families/matchings.ts";
import { numberKernel } from "../../collections/src/families/types.ts";

// Self-cert every family in this module (mirrors collections/tests/paths-partitions.test.ts,
// which this split out of -- §4 step 5): for every rank r in [0, count), valid(unrank(p, r), p)
// === true AND rank(unrank(p, r), p) === r. Params are kept small so counts stay well under
// ~1000.
const PARAMS: Record<string, number[]> = {
  NonCrossingPartitions: [6],
  NonNestingPartitions: [6],
  NonCrossingMatchings: [6],
  NonNestingMatchings: [6],
};

const byHead = new Map(entries.map((e) => [e.head, e]));

for (const [head, p] of Object.entries(PARAMS)) {
  const entry = byHead.get(head);
  test(`${head}(${p.join(", ")}) round-trips`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    const total = entry.count(p);
    for (let r = 0; r < total; r++) {
      const element = entry.unrank(p, r);
      expect(entry.valid(element, p)).toBe(true);
      expect(entry.rank(element, p)).toBe(r);
    }
  });
}

// The Plausible properties (round trip, validity, injectivity, count) at a second,
// independent set of parameters — a backstop against a bug that happens to be invisible at the
// PARAMS above (mirrors collections/tests/plausible.test.ts's use of scripts/properties.ts).
const draw = random(20260924);
const PLAUSIBLE_PARAMS: Record<string, number[]> = {
  NonCrossingPartitions: [5],
  NonNestingPartitions: [5],
  NonCrossingMatchings: [5],
  NonNestingMatchings: [5],
};
for (const [head, p] of Object.entries(PLAUSIBLE_PARAMS)) {
  const entry = byHead.get(head);
  test(`${head}(${p.join(", ")}) passes the Plausible properties`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    const family = numberKernel(entry);
    expect(checkFamily(family, p, draw)).toBeUndefined();
    const total = entry.count(p);
    for (let r = 0n; r < BigInt(Math.min(total, 20)); r++) expect(check(family, p, r)).toBeUndefined();
  });
}

// Counts vs. the Catalan numbers (OEIS A000108) -- independently known, not this codebase's own
// output.
test("counts match the Catalan numbers", () => {
  const count = (head: string, p: number[]) => byHead.get(head)!.count(p);
  const seq = (head: string, n: number) => Array.from({ length: n }, (_, i) => count(head, [i]));
  const catalan = [1, 1, 2, 5, 14, 42, 132];
  for (const head of ["NonCrossingPartitions", "NonNestingPartitions", "NonCrossingMatchings", "NonNestingMatchings"]) {
    expect(seq(head, 7)).toEqual(catalan);
  }
});

// Each family also carries "SetPartition" -- a restriction, not the "PerfectMatching" carrier,
// which is a different (flat) encoding these kernels never produce -- see matchings.ts.
test("every family here declares the SetPartition carrier", () => {
  for (const entry of entries) expect(entry.carrier).toBe("SetPartition");
});
