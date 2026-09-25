import { expect, test } from "vite-plus/test";
import { hermiteDecomposition } from "../src/hermite.ts";

// Pinned against Wolfram 15.0. u is unique only for square nonsingular m, so the others check
// u·m = h and |det u| = 1 rather than u itself.
test("HermiteDecomposition: Wolfram's normal form", () => {
  // Singular / non-square: h pinned, u only up to u·m = h with u unimodular.
  const m = [
    [4n, 6n],
    [6n, 9n],
    [2n, 1n],
  ];
  const { u, h } = hermiteDecomposition(m);
  expect(h).toEqual([
    [2n, 1n],
    [0n, 2n],
    [0n, 0n],
  ]);
  expect(u.map((row) => m[0]!.map((_, j) => row.reduce((acc, x, k) => acc + x * m[k]![j]!, 0n)))).toEqual(h);
  const [[a, b, c], [d, e, f], [g, hh, i]] = u as [bigint[], bigint[], bigint[]];
  const det = a! * (e! * i! - f! * hh!) - b! * (d! * i! - f! * g!) + c! * (d! * hh! - e! * g!);
  expect(det === 1n || det === -1n).toBe(true);
  // The singular 2x2 case (h gains a zero row) is pinned as a reference example instead
  // of here.
});
