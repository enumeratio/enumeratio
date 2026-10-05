import { ComputeEngine } from "@enumeratio/engine/unstable"; // unstable: a kernel test builds its own engine
import { expect, test } from "vite-plus/test";
import { kernelOn } from "../../collections/src/families/epsil.ts";
import { entries } from "../src/families/core.ts";

// Self-cert Tournaments/LabeledGraphs/LabeledGraphsByEdges split out of
// collections/tests/tableaux-trees.test.ts (wire-carriers lane A-92) -- for every rank r in
// [0, count), unrank produces a valid element and rank(unrank(r)) === r.
const PARAMS: Record<string, number[][]> = {
  Tournaments: [[1], [2], [3], [4]],
  LabeledGraphs: [[1], [2], [3], [4]],
  LabeledGraphsByEdges: [
    [4, 0],
    [4, 3],
    [4, 6],
  ],
};

const ce = new ComputeEngine();
const byHead = new Map(entries.map((e) => [e.head, kernelOn(ce, e)]));

for (const [head, paramSets] of Object.entries(PARAMS)) {
  const entry = byHead.get(head);
  test(`${head} is registered`, () => expect(entry).toBeDefined());
  if (!entry) continue;
  for (const p of paramSets) {
    test(`${head}(${p.join(", ")}) round-trips`, () => {
      const total = Number(entry.count(p));
      for (let r = 0; r < total; r++) {
        const element = entry.unrank(p, BigInt(r));
        expect(entry.valid(element, p)).toBe(true);
        expect(entry.rank(element, p)).toBe(BigInt(r));
      }
    });
  }
}

test("Tournaments(n) = LabeledGraphs(n) = 2^C(n,2)", () => {
  const t = byHead.get("Tournaments")!;
  const g = byHead.get("LabeledGraphs")!;
  expect([1, 2, 3, 4].map((n) => t.count([n]))).toEqual([1n, 2n, 8n, 64n]);
  expect([1, 2, 3, 4].map((n) => g.count([n]))).toEqual([1n, 2n, 8n, 64n]);
});

// Golden first-few elements (rank 0 in each family), pinned as plain data — never a snapshot.
test("golden: rank-0 elements of each family at a fixed size", () => {
  const golden: Record<string, unknown> = {
    Tournaments: byHead.get("Tournaments")!.unrank([3], 0n),
    LabeledGraphs: byHead.get("LabeledGraphs")!.unrank([3], 0n),
  };
  expect(golden).toEqual({
    Tournaments: [
      [1, 2],
      [1, 3],
      [2, 3],
    ],
    LabeledGraphs: [],
  });
});
