// Lorenz braids: turning a closed geodesic on the modular surface into an actual knot.
//
// This is the bridge between the modular package and this one. Ghys's theorem says the
// closed orbits of the modular flow — the LR necklaces — are precisely the periodic orbits
// of the Lorenz attractor, and those have a completely combinatorial braid:
//
//   1. Take the word's n cyclic rotations. Each names one point where the orbit meets the
//      branch line of the Lorenz template.
//   2. Order those points. On the Lorenz template BOTH branches preserve orientation, so
//      the order is simply lexicographic on itineraries with L < R. (On a tent map one
//      branch flips and this would be the alternating order instead — the orientation is
//      the whole reason Lorenz knots are as well behaved as they are.)
//   3. The flow advances each point to the next rotation, so it induces a permutation of
//      those positions. Its POSITIVE PERMUTATION BRAID is the Lorenz braid: positive,
//      because the template's two branches only ever cross one way.
//
// Close it up and you have the knot the geodesic draws.

import { type Braid, positivePermutationBraid } from "./braid.ts";

/** Whether a word is aperiodic — a repeated word traverses one geodesic several times. */
export function isPrimitive(word: string): boolean {
  const n = word.length;
  if (n === 0) return false;
  for (let period = 1; period < n; period++) {
    if (n % period === 0 && word.slice(0, period).repeat(n / period) === word) return false;
  }
  return true;
}

/** The i-th cyclic rotation of a word. */
const rotate = (word: string, i: number): string => word.slice(i) + word.slice(0, i);

/**
 * The permutation the flow induces on the orbit's branch-line points, in their left-to-right
 * order. Requires a primitive word using both letters — a repeated word has coincident
 * rotations and no well-defined order, and a constant word is parabolic, not a closed orbit.
 */
export function lorenzPermutation(word: string): number[] | undefined {
  if (!/^[LR]+$/.test(word) || !isPrimitive(word)) return undefined;
  if (!word.includes("L") || !word.includes("R")) return undefined;
  const n = word.length;
  // Comparing one period is enough for distinct rotations of a primitive word, but two
  // periods costs nothing and removes the need to argue about it.
  const key = (i: number): string => rotate(word, i).repeat(2);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (key(a) < key(b) ? -1 : 1));
  const rank = new Array<number>(n);
  order.forEach((index, position) => {
    rank[index] = position;
  });
  // The flow sends the point with itinerary w^(i) to the one with itinerary w^(i+1).
  const permutation = new Array<number>(n);
  for (let i = 0; i < n; i++) permutation[rank[i] as number] = rank[(i + 1) % n] as number;
  return permutation;
}

/** The Lorenz braid of a modular word: the positive permutation braid of that permutation. */
export function lorenzBraid(word: string): Braid | undefined {
  const permutation = lorenzPermutation(word);
  return permutation === undefined ? undefined : positivePermutationBraid(permutation);
}

/**
 * The trip number of the orbit — the braid index of the Lorenz link, and the number of
 * points that move rightwards across the branch line. It is the count of positions where an
 * L is followed by an R in the cyclic word.
 */
export function tripNumber(word: string): number | undefined {
  if (!/^[LR]+$/.test(word) || !isPrimitive(word)) return undefined;
  let count = 0;
  for (let i = 0; i < word.length; i++) {
    if (word[i] === "L" && word[(i + 1) % word.length] === "R") count++;
  }
  return count;
}
