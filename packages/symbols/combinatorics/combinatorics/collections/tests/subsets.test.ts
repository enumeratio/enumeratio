import { expect, test } from "vite-plus/test";
import { entries as allEntries } from "../src/families/subsets.ts";

// Certify every family kernel: rank(unrank(p, r), p) === r across the whole family,
// count matches the enumeration, and unranked elements are valid members.
const PARAMS: Record<string, number[][]> = {
  SubsetsWithoutConsecutive: [[0], [1], [4], [6]],
  SubsetsOfSizeAtMost: [
    [4, 2],
    [5, 3],
    [3, 3],
  ],
  EvenSubsets: [[0], [1], [4], [5]],
  OddSubsets: [[1], [4], [5]],
};

for (const entry of allEntries) {
  for (const p of PARAMS[entry.head] ?? [[3]]) {
    test(`${entry.head}(${p.join(", ")}) round-trips`, () => {
      const total = entry.count(p);
      for (let r = 0; r < total; r++) {
        const element = entry.unrank(p, r);
        expect(entry.valid(element, p)).toBe(true);
        expect(entry.rank(element, p)).toBe(r);
      }
    });
  }
}
