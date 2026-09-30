import { expect, test } from "vite-plus/test";
import { entries } from "../src/families/labeled.ts";

// Self-cert LabeledTrees split out of collections/src/families/core.ts (wire-carriers lane
// A-92): for every rank r in [0, count), unrank produces a valid element and
// rank(unrank(r)) === r.
const PARAMS: Record<string, number[]> = {
  LabeledTrees: [4],
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
