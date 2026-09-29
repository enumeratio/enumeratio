import { expect, test } from "vite-plus/test";
import { check, checkFamily, random } from "../../collections/scripts/properties.ts";
import { entries } from "../src/families/paths-partitions.ts";
import { numberKernel } from "../../collections/src/families/types.ts";

// DyckPathsByHeight split out of collections/tests/paths-partitions.test.ts with the family (§4
// step 5, https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible)
// -- same recipe: for every rank r in [0, count), valid(unrank(p, r), p) === true AND
// rank(unrank(p, r), p) === r.
const PARAMS: Record<string, number[]> = {
  DyckPathsByHeight: [6, 3],
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

// The Plausible properties at a second, independent set of parameters (mirrors
// collections/tests/paths-partitions.test.ts's use of scripts/properties.ts).
const draw = random(20260924);
const PLAUSIBLE_PARAMS: Record<string, number[]> = {
  DyckPathsByHeight: [5, 2],
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

test("DyckPathsByHeight rows sum to the Catalan numbers", () => {
  const entry = byHead.get("DyckPathsByHeight")!;
  const catalan = [1, 1, 2, 5, 14, 42, 132]; // A000108
  for (let n = 0; n <= 6; n++) {
    let sum = 0;
    for (let h = 0; h <= n; h++) sum += entry.count([n, h]);
    expect(sum).toBe(catalan[n]);
  }
});
