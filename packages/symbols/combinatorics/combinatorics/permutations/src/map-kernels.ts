// Fast paths for the permutation maps whose nested Epsil can't compile. The Epsil stays the meaning:
// tests/map-kernels.test.ts holds each kernel to it. A kernel declines (`undefined`) off a permutation of 1..n.
import { isPermutationWord } from "../../tableaux/src/rsk-kernels.ts";

/** `kernel` on a permutation of 1..n; anything else declines. */
const onPermutation =
  <T>(kernel: (word: readonly number[]) => T) =>
  (word: readonly number[]): T | undefined =>
    isPermutationWord(word) ? kernel(word) : undefined;

/** `kernel` on a list of integers (a word over any alphabet); anything else declines. */
const onWord =
  <T>(kernel: (word: readonly number[]) => T) =>
  (word: readonly number[]): T | undefined =>
    Array.isArray(word) && word.every(Number.isInteger) ? kernel(word) : undefined;

/** The cycles of the permutation `word` (position i goes to word[i-1]), each starting at its own maximum,
 *  ordered by increasing maximum. */
function cyclesFromMax(word: readonly number[]): number[][] {
  const seen = new Set<number>();
  const cycles: number[][] = [];
  for (let start = 1; start <= word.length; start++) {
    if (seen.has(start)) continue;
    const cycle: number[] = [];
    for (let i = start; !seen.has(i); i = word[i - 1]!) {
      seen.add(i);
      cycle.push(i);
    }
    const top = cycle.indexOf(Math.max(...cycle));
    cycles.push([...cycle.slice(top), ...cycle.slice(0, top)]);
  }
  return cycles.toSorted((a, b) => a[0]! - b[0]!);
}

export const cycleTypeKernel = onPermutation((word) =>
  cyclesFromMax(word)
    .map((cycle) => cycle.length)
    .toSorted((a, b) => b - a),
);

export const foataKernel = onPermutation((word) => cyclesFromMax(word).flat());

/** Entry v is where v goes: on to the next entry of the word, or back to the running maximum when the
 *  next entry opens a new left-to-right maximum. */
export const inverseFoataKernel = onPermutation((word) => {
  const n = word.length;
  const out = Array.from<number>({ length: n });
  let top = 0;
  word.forEach((v, p) => {
    top = Math.max(top, v);
    out[v - 1] = p + 1 === n || word[p + 1]! > top ? top : word[p + 1]!;
  });
  return out;
});

/** Mp00067: each letter goes on the end of the image so far, which is cut into blocks, each rotated right. */
const foataMajorToInversionsOf = (word: readonly number[]): number[] => {
  if (word.length === 0) return [];
  let image = [word[0]!];
  for (const x of word.slice(1)) {
    const next = [...image, x];
    const last = image[image.length - 1]!;
    // A block ends at a letter x compares with as it does with the last one.
    let blockStart = 0;
    for (let k = 0; k < next.length; k++) {
      const ends = k === next.length - 1 || (x >= last ? x >= next[k]! : x < next[k]!);
      if (!ends) continue;
      next.splice(blockStart, k + 1 - blockStart, next[k]!, ...next.slice(blockStart, k));
      blockStart = k + 1;
    }
    image = next;
  }
  return image;
};
export const foataMajorToInversionsKernel = onPermutation(foataMajorToInversionsOf);
/** The same on a word with repeated letters: an equal letter counts as the smaller, as its standardization does. */
export const foataMajorToInversionsWordKernel = onWord(foataMajorToInversionsOf);

/** Mp00175: peel the last letter off, rotate the blocks of the rest back left, and go on with what is left. */
const foataInversionsToMajorOf = (word: readonly number[]): number[] => {
  let rest = [...word];
  const tail: number[] = [];
  while (rest.length > 1) {
    const x = rest.pop()!;
    tail.unshift(x);
    const first = rest[0]!;
    // A block starts at a letter that compares with x as the first letter does.
    const starts = rest.map((y) => (first <= x ? y <= x : y > x));
    const next: number[] = [];
    let blockEnd = rest.length;
    for (let k = rest.length - 1; k >= 0; k--) {
      if (!starts[k]) continue;
      next.unshift(...rest.slice(k + 1, blockEnd), rest[k]!);
      blockEnd = k;
    }
    rest = next;
  }
  return [...rest, ...tail];
};
export const foataInversionsToMajorKernel = onPermutation(foataInversionsToMajorOf);
export const foataInversionsToMajorWordKernel = onWord(foataInversionsToMajorOf);
