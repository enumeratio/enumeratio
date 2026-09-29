import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/core.ts";

// Endofunctions split out of collections/src/families/core.ts (which mixed every area) --
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 (wire-carriers lane A-91) -- same recipe: for every rank r in [0, count),
// valid(unrank(p, r), p) === true AND rank(unrank(p, r), p) === r.
const PARAMS: Record<string, number[]> = {
  Endofunctions: [3],
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

test("Endofunctions(n) = n^n", () => {
  const e = byHead.get("Endofunctions")!;
  expect([0, 1, 2, 3, 4].map((n) => e.count([n]))).toEqual([1, 1, 4, 27, 256]);
});
