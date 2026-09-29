import { expect, test } from "vite-plus/test";
import { bigintEntries, entries } from "../src/families/core.ts";

// Self-cert the permutation-area families split out of collections/src/families/core.ts --
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- split from collections/tests/core.test.ts, same recipe: for every rank r in
// [0, count), valid(unrank(p, r), p) === true AND rank(unrank(p, r), p) === r.
const PARAMS: Record<string, number[]> = {
  Derangements: [4],
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

for (const entry of bigintEntries) {
  const p = [4];
  test(`${entry.head}(4) round-trips`, () => {
    const total = entry.count(p) as bigint;
    for (let r = 0n; r < total; r++) {
      const element = entry.unrank(p, r);
      expect(entry.valid(element, p)).toBe(true);
      expect(entry.rank(element, p)).toBe(r);
    }
  });
}
