import { expect, test } from "vite-plus/test";
import { bareEngine } from "@enumeratio/engine/testing";
import { kernelsOn } from "../../collections/src/families/epsil.ts";
import { entries } from "../src/families/core.ts";

// Self-cert the partitions-area families split out of collections/src/families/core.ts --
// https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5 -- split from collections/tests/core.test.ts, same recipe: for every rank r in
// [0, count), valid(unrank(p, r), p) === true AND rank(unrank(p, r), p) === r.
const PARAMS: Record<string, number[]> = {
  IntegerPartitions: [6],
};

const byHead = new Map(kernelsOn(bareEngine(), entries).map((e) => [e.head, e]));

for (const [head, p] of Object.entries(PARAMS)) {
  const entry = byHead.get(head);
  test(`${head}(${p.join(", ")}) round-trips`, () => {
    expect(entry).toBeDefined();
    if (!entry) return;
    const total = entry.count(p) as bigint;
    for (let r = 0n; r < total; r++) {
      const element = entry.unrank(p, r);
      expect(entry.valid(element, p)).toBe(true);
      expect(entry.rank(element, p)).toBe(r);
    }
  });
}
