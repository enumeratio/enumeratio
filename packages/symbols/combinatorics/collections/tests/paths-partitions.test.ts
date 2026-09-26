import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vite-plus/test";
import { check, checkFamily, random } from "../scripts/properties.ts";
import { entries } from "../src/families/paths-partitions.ts";
import { numberKernel } from "../src/families/types.ts";

// Self-cert every family in this module (mirrors tests/subsets.test.ts): for every rank r in
// [0, count), valid(unrank(p, r), p) === true AND rank(unrank(p, r), p) === r. Params are kept
// small so counts stay well under ~1000.
const PARAMS: Record<string, number[]> = {
  RestrictedGrowthStrings: [6],
  NonCrossingPartitions: [6],
  NonNestingPartitions: [6],
  NonCrossingMatchings: [6],
  NonNestingMatchings: [6],
  DelannoyPaths: [4],
  GrandDyckPaths: [5],
  RiordanPaths: [8],
  FinePaths: [7],
  BallotSequences: [6],
  LukasiewiczPaths: [6],
  DyckPathsByHeight: [6, 3],
  MotzkinPathsByPeaks: [7, 2],
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
// PARAMS above (mirrors tests/plausible.test.ts's use of scripts/properties.ts).
const draw = random(20260924);
const PLAUSIBLE_PARAMS: Record<string, number[]> = {
  RestrictedGrowthStrings: [5],
  NonCrossingPartitions: [5],
  NonNestingPartitions: [5],
  NonCrossingMatchings: [5],
  NonNestingMatchings: [5],
  DelannoyPaths: [3],
  GrandDyckPaths: [4],
  RiordanPaths: [7],
  FinePaths: [6],
  BallotSequences: [5],
  LukasiewiczPaths: [5],
  DyckPathsByHeight: [5, 2],
  MotzkinPathsByPeaks: [6, 1],
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

  expect(seq("RestrictedGrowthStrings", 8)).toEqual([1, 1, 2, 5, 15, 52, 203, 877]); // A000110
  const catalan = [1, 1, 2, 5, 14, 42, 132];
  for (const head of [
    "NonCrossingPartitions",
    "NonNestingPartitions",
    "NonCrossingMatchings",
    "NonNestingMatchings",
    "BallotSequences",
    "LukasiewiczPaths",
  ]) {
    expect(seq(head, 7)).toEqual(catalan); // A000108
  }
  expect(seq("DelannoyPaths", 6)).toEqual([1, 3, 13, 63, 321, 1683]); // A001850
  expect(seq("GrandDyckPaths", 6)).toEqual([1, 2, 6, 20, 70, 252]); // A000984
  expect(seq("RiordanPaths", 9)).toEqual([1, 0, 1, 1, 3, 6, 15, 36, 91]); // A005043
  expect(seq("FinePaths", 9)).toEqual([1, 0, 1, 2, 6, 18, 57, 186, 622]); // A000957
});

test("DyckPathsByHeight rows sum to the Catalan numbers", () => {
  const entry = byHead.get("DyckPathsByHeight")!;
  const catalan = [1, 1, 2, 5, 14, 42, 132]; // A000108
  for (let n = 0; n <= 6; n++) {
    let sum = 0;
    for (let h = 0; h <= n; h++) sum += entry.count([n, h]);
    expect(sum).toBe(catalan[n]);
  }
});

test("MotzkinPathsByPeaks rows sum to the Motzkin numbers", () => {
  const entry = byHead.get("MotzkinPathsByPeaks")!;
  const motzkin = [1, 1, 2, 4, 9, 21, 51]; // A001006
  for (let n = 0; n <= 6; n++) {
    let sum = 0;
    for (let k = 0; k <= n; k++) sum += entry.count([n, k]);
    expect(sum).toBe(motzkin[n]);
  }
});

// Golden JSON: the first few elements of each family at a fixed small parameter, exactly as this
// codebase's own unrank produces them — a change here is a real behavior change, not drift.
// Regenerate with `UPDATE_PATHS_PARTITIONS=1 vp test` after an intended change.
const GOLDEN_PARAMS: Record<string, number[]> = {
  RestrictedGrowthStrings: [4],
  NonCrossingPartitions: [4],
  NonNestingPartitions: [4],
  NonCrossingMatchings: [4],
  NonNestingMatchings: [4],
  DelannoyPaths: [3],
  GrandDyckPaths: [3],
  RiordanPaths: [6],
  FinePaths: [5],
  BallotSequences: [4],
  LukasiewiczPaths: [4],
  DyckPathsByHeight: [4, 2],
  MotzkinPathsByPeaks: [5, 1],
};

const GOLDEN = fileURLToPath(new URL("./paths-partitions.golden.json", import.meta.url));
const updating = process.env.UPDATE_PATHS_PARTITIONS === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const [head, p] of Object.entries(GOLDEN_PARAMS)) {
  test(`${head}(${p.join(", ")}) first elements match golden`, () => {
    const entry = byHead.get(head)!;
    const total = entry.count(p);
    const firstFew = Array.from({ length: Math.min(total, 5) }, (_, r) => entry.unrank(p, r));
    if (updating) {
      fresh[head] = firstFew;
      return;
    }
    expect(firstFew).toEqual(golden[head]);
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
