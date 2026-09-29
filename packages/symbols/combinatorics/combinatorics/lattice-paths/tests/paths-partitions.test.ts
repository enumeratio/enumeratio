import { expect, test } from "vite-plus/test";
import { check, checkFamily, random } from "../../collections/scripts/properties.ts";
import { entriesBeforeDyckPathsByHeight, entries } from "../src/families/paths-partitions.ts";
import { numberKernel } from "../../collections/src/families/types.ts";

// DyckPathsByHeight split out of collections/tests/paths-partitions.test.ts with the family (§4
// step 5, https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- same recipe: for every rank r in [0, count), valid(unrank(p, r), p) === true AND
// rank(unrank(p, r), p) === r. DelannoyPaths/LukasiewiczPaths/MotzkinPathsByPeaks joined it
// (wire-carriers lane A-90), each now carrying its area carrier.
const PARAMS: Record<string, number[]> = {
  DelannoyPaths: [4],
  LukasiewiczPaths: [6],
  DyckPathsByHeight: [6, 3],
  MotzkinPathsByPeaks: [7, 2],
};

const byHead = new Map([...entriesBeforeDyckPathsByHeight, ...entries].map((e) => [e.head, e]));

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

// The Plausible properties at a second, independent set of parameters (mirrors
// collections/tests/paths-partitions.test.ts's use of scripts/properties.ts).
const draw = random(20260924);
const PLAUSIBLE_PARAMS: Record<string, number[]> = {
  DelannoyPaths: [3],
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

  expect(seq("LukasiewiczPaths", 7)).toEqual([1, 1, 2, 5, 14, 42, 132]); // A000108
  expect(seq("DelannoyPaths", 6)).toEqual([1, 3, 13, 63, 321, 1683]); // A001850
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
