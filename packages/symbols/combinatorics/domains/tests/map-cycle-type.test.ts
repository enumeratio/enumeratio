// Shard of map.test.ts: CycleType and CyclePartition — the two priciest carrier-crossing maps
// besides the conjugation family. See map-helpers.ts for shared setup.
import { expect, test } from "vite-plus/test";
import { ALL, ce, perm, result } from "./map-helpers.ts";

test("CycleType crosses carriers and partitions n", () => {
  const cycleLengths = (p: number[]): number[] => {
    const seen = new Array<boolean>(p.length).fill(false);
    const lengths: number[] = [];
    for (let start = 0; start < p.length; start++) {
      if (seen[start]) continue;
      let length = 0;
      let at = start;
      do {
        seen[at] = true;
        at = p[at]! - 1;
        length++;
      } while (at !== start);
      lengths.push(length);
    }
    return lengths.sort((a, b) => b - a);
  };
  expect(String(ce.box(["CycleType", perm(2, 3, 1)] as never).evaluate().type)).toBe("integer_partition");
  for (const p of ALL) expect(result(["CycleType", perm(...p)]), `[${p}]`).toEqual(["List", ...cycleLengths(p)]);
});

test("CyclePartition labels each position with its cycle's rank", () => {
  // A set partition IS a restricted growth string, so the block label is the rank of the
  // cycle's least element — not an arbitrary identifier.
  const rgs = (p: number[]): number[] => {
    const seen = new Array<boolean>(p.length).fill(false);
    const labels = new Array<number>(p.length).fill(0);
    let block = 0;
    for (let start = 0; start < p.length; start++) {
      if (seen[start]) continue;
      block++;
      let at = start;
      do {
        seen[at] = true;
        labels[at] = block;
        at = p[at]! - 1;
      } while (at !== start);
    }
    return labels;
  };
  for (const p of ALL) expect(result(["CyclePartition", perm(...p)]), `[${p}]`).toEqual(["List", ...rgs(p)]);
});
