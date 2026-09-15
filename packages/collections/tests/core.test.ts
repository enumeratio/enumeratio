import { expect, test } from "vite-plus/test";
import { entries } from "../src/packs/core.ts";

// Self-cert a sample of core.ts families (kept small so counts stay well under ~5000):
// for every rank r in [0, count), valid(unrank(p, r), p) === true AND rank(unrank(p, r), p) === r.
// core.ts is not yet wired into allEntries (its Subsets/Tuples heads intentionally differ from the
// existing hand-rolled ones), so this reads `entries` straight from the pack module.
const PARAMS: Record<string, number[]> = {
  SymmetricGroup: [4],
  Derangements: [4],
  IntegerPartitions: [6],
  IntegerCompositions: [5],
  KSubsets: [5, 2],
  Tuples: [3, 2],
  DyckPaths: [4],
  SetPartitions: [4],
  BinaryTrees: [4],
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
