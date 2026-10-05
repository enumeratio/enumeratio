// Epsil pieces for the families ranked through the Prüfer bijection: a labeled tree on N vertices
// is peeled by removing its smallest leaf N − 2 times, and the leaf's neighbours, in order, are
// its Prüfer sequence (N − 2 entries over 1..N, ranked as a base-N number).
//
// A peel is a fold over a list of integers: entries 1..N are the vertices' degrees (a removed
// vertex has 0), and the entries after them hold what the family records as it goes.

import { add, and, at, equal, fold, iff, map, quotient, sub, upTo } from "../../../collections/src/families/tables.ts";

type MathJSON = unknown;

/** The smallest vertex of 1..N with degree 1 in `state`, 0 when there is none. */
export const smallestLeaf = (state: MathJSON, N: MathJSON, tag: string): MathJSON =>
  fold(
    iff(and(equal(`${tag}_f`, 0), equal(at(state, `${tag}_v`), 1)), `${tag}_v`, `${tag}_f`),
    `${tag}_f`,
    `${tag}_v`,
    0,
    upTo(1, N),
  );

/** The Prüfer sequence of rank `_r`: entry j is digit N − 2 − j of `_r` in base N, plus 1. */
export const pruferDigits = (N: MathJSON): MathJSON =>
  map(add(["Mod", quotient("_r", ["Power", N, sub(sub(N, 2), "pj")]), N], 1), "pj", upTo(1, sub(N, 2)));

/** Degrees 1..N of the tree a Prüfer sequence `seq` decodes to: 1 + the occurrences of each vertex. */
export const degreesOfSequence = (seq: MathJSON, N: MathJSON): MathJSON =>
  map(add(1, ["Count", ["Filter", seq, ["Function", equal("py", "pv"), "py"]]]), "pv", upTo(1, N));

/** A list of `count` zeros. */
export const zeros = (count: MathJSON): MathJSON => map(0, "pz", upTo(1, count));

/** Peel step on `state` with the leaf `leaf` removed and its neighbour `nb` losing a degree. */
export const removeLeaf = (state: MathJSON, leaf: MathJSON, nb: MathJSON): MathJSON => [
  "ReplaceAt",
  ["ReplaceAt", state, leaf, 0],
  nb,
  sub(at(state, nb), 1),
];
