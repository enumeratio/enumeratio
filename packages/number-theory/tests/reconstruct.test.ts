import { powerModList } from "@enumeratio/residues";
import { expect, test } from "vite-plus/test";
import { rationalReconstruction } from "../src/reconstruct.ts";

test("rational reconstruction inverts u·v⁻¹ for small fractions", () => {
  const p = 1000003n;
  for (const [u, v] of [
    [22n, 7n],
    [-355n, 113n],
    [1n, 1n],
    [0n, 1n],
  ] as const) {
    const [image] = powerModList([u, v], 1n, 1n, p)!;
    expect(rationalReconstruction(image!, p)).toEqual([u, v]);
  }
  // Mod 11 the bounds are |n|, d ≤ 2, whose images are 0, 1, 2, 5, 6, 9, 10 — not 3.
  expect(rationalReconstruction(6n, 11n)).toEqual([1n, 2n]);
  expect(rationalReconstruction(3n, 11n)).toBeUndefined();
});
