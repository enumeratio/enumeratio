import { expect, test } from "vite-plus/test";
import { check, checkFamily, random } from "../scripts/properties.ts";
import { entriesBeforeDyckPathsByHeight } from "../src/families/paths-partitions.ts";
import { numberKernel } from "../src/families/types.ts";

// Self-cert every family in this module (mirrors tests/subsets.test.ts): for every rank r in
// [0, count), valid(unrank(p, r), p) === true AND rank(unrank(p, r), p) === r. Params are kept
// small so counts stay well under ~1000. DyckPathsByHeight moved to the lattice-paths area,
// RestrictedGrowthStrings to the set-partitions area, and NonCrossingPartitions/
// NonNestingPartitions/NonCrossingMatchings/NonNestingMatchings there too (now carrying
// "SetPartition") — §4 step 5 — each with its tests
// (set-partitions/tests/{paths-partitions,matchings}.test.ts). DelannoyPaths/LukasiewiczPaths/
// MotzkinPathsByPeaks moved to lattice-paths/tests/paths-partitions.test.ts (wire-carriers lane
// A-90), now carrying their area carriers.
const PARAMS: Record<string, number[]> = {
  GrandDyckPaths: [5],
  RiordanPaths: [8],
  FinePaths: [7],
  BallotSequences: [6],
};

const byHead = new Map(entriesBeforeDyckPathsByHeight.map((e) => [e.head, e]));

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
// PARAMS above (mirrors tests/plausible.test.ts's use of scripts/properties.ts).
const draw = random(20260924);
const PLAUSIBLE_PARAMS: Record<string, number[]> = {
  GrandDyckPaths: [4],
  RiordanPaths: [7],
  FinePaths: [6],
  BallotSequences: [5],
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

// Counts vs. known OEIS sequences (offsets confirmed by hand — see paths-partitions.ts for the
// per-family derivations). NOT golden JSON: these are independently-known closed sequences, not
// this codebase's own output.
test("counts match their OEIS sequences", () => {
  const count = (head: string, p: number[]) => byHead.get(head)!.count(p);
  const seq = (head: string, n: number) => Array.from({ length: n }, (_, i) => count(head, [i]));

  expect(seq("BallotSequences", 7)).toEqual([1, 1, 2, 5, 14, 42, 132]); // A000108
  expect(seq("GrandDyckPaths", 6)).toEqual([1, 2, 6, 20, 70, 252]); // A000984
  expect(seq("RiordanPaths", 9)).toEqual([1, 0, 1, 1, 3, 6, 15, 36, 91]); // A005043
  expect(seq("FinePaths", 9)).toEqual([1, 0, 1, 2, 6, 18, 57, 186, 622]); // A000957
});
