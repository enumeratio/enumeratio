import { expect, test } from "vite-plus/test";
import { asNumbers } from "./number-kernels.ts";
import {
  entriesBeforeSurjections,
  entriesBeforeDyckPaths,
  entriesBeforeSetPartitions,
  entriesBeforeTrees,
  entries,
} from "../src/families/core.ts";

// Self-cert a sample of core.ts families (kept small so counts stay well under ~5000):
// for every rank r in [0, count), valid(unrank(p, r), p) === true AND rank(unrank(p, r), p) === r.
// core.ts is not yet wired into allEntries (its Subsets/Tuples heads intentionally differ from the
// existing hand-rolled ones), so this reads `entries` straight from the family module. The
// permutation-area families this file used to also cover (Derangements, SymmetricGroup) moved to
// permutations/tests/core.test.ts, the partitions-area ones (IntegerPartitions) to
// partitions/tests/core.test.ts, the compositions-area ones (IntegerCompositions) to
// compositions/tests/core.test.ts, the lattice-paths-area ones (DyckPaths) to
// lattice-paths/tests/core.test.ts, the trees-area ones (BinaryTrees) to
// trees/tests/core.test.ts, and the set-partitions-area ones (Surjections, SetPartitions) to
// set-partitions/tests/core.test.ts -- https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 5.
const PARAMS: Record<string, number[]> = {
  KSubsets: [5, 2],
  Tuples: [3, 2],
};

const byHead = new Map(
  [
    ...entriesBeforeSurjections,
    ...entriesBeforeDyckPaths,
    ...entriesBeforeSetPartitions,
    ...entriesBeforeTrees,
    ...entries,
  ].map((e) => [e.head, asNumbers(e)]),
);

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
