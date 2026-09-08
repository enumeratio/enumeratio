// Groupings(n): the ways to parenthesize n ordered items 1..n with a binary operator (Wolfram Groupings[n, 2]).
// Count = Catalan(n-1). Element is a nested binary structure: a leaf is its label 1..n (left-to-right), a node
// is [left, right]. E.g. Groupings(3) = { [[1,2],3], [1,[2,3]] }.
import type { PackEntry } from "./types.js";
import { CatalanNumber } from "../kernels-extra.js";

type G = number | G[];

function build(leaves: number[], r: number): G {
  const m = leaves.length;
  if (m === 1) return leaves[0];
  let rem = r;
  for (let i = 1; i < m; i++) {
    const rc = CatalanNumber(m - i - 1);
    const block = CatalanNumber(i - 1) * rc;
    if (rem < block) {
      return [build(leaves.slice(0, i), Math.floor(rem / rc)), build(leaves.slice(i), rem % rc)];
    }
    rem -= block;
  }
  return leaves[0]; // unreachable
}

function rankRec(t: G): { r: number; m: number } {
  if (!Array.isArray(t)) return { r: 0, m: 1 };
  const [L, R] = t;
  const { r: lr, m: lm } = rankRec(L);
  const { r: rr, m: rm } = rankRec(R);
  const m = lm + rm;
  let base = 0;
  for (let k = 1; k < lm; k++) base += CatalanNumber(k - 1) * CatalanNumber(m - k - 1);
  const rc = CatalanNumber(m - lm - 1);
  return { r: base + lr * rc + rr, m };
}

function collectLeaves(t: G, out: number[]): boolean {
  if (!Array.isArray(t)) { if (!Number.isInteger(t)) return false; out.push(t); return true; }
  if (t.length !== 2) return false; // a binary node has exactly two children
  return collectLeaves(t[0], out) && collectLeaves(t[1], out);
}

export const entries: PackEntry[] = [
  {
    head: "Groupings",
    paramCount: 1,
    kind: "nested",
    count: ([n]) => (n < 1 ? 0 : CatalanNumber(n - 1)),
    unrank: ([n], r) => build(Array.from({ length: n }, (_, i) => i + 1), r),
    rank: (e) => rankRec(e as G).r,
    valid: (e, [n]) => {
      const leaves: number[] = [];
      if (!collectLeaves(e as G, leaves)) return false;
      if (leaves.length !== n) return false;
      for (let i = 0; i < n; i++) if (leaves[i] !== i + 1) return false; // labels 1..n, in order
      return true;
    },
  },
];
