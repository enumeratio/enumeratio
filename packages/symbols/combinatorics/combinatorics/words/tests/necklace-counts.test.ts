// Necklace and bracelet counts are exact closed forms (Burnside over C_n and D_n), bigint past 2^53.
// They are held to the enumeration of orbits, to Burnside run on the actual permutations of the
// positions, and to OEIS terms.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { braceletCountExact, necklaceCountExact } from "../../collections/src/families/exact-counts.ts";
import { allFamilies, kernelOn } from "../../collections/src/families/index.ts";
import { declareCombinatorics } from "../../src/index.ts";

const ce = bareEngine();
const kernelFor = (head: string) =>
  kernelOn(
    ce,
    allFamilies.find((family) => family.head === head)!,
  );
const necklaces = kernelFor("KNecklaces");
const bracelets = kernelFor("KBracelets");

/** Burnside's lemma over the n rotations (and n reflections) as permutations of the positions:
 *  a coloring is fixed by a permutation iff it is constant on each cycle, k^cycles of them. */
function burnside(n: number, k: number, reflections: boolean): bigint {
  const cycles = (image: (i: number) => number): number => {
    const seen = new Set<number>();
    let count = 0;
    for (let start = 0; start < n; start++) {
      if (seen.has(start)) continue;
      count++;
      for (let i = start; !seen.has(i); i = image(i)) seen.add(i);
    }
    return count;
  };
  let total = 0n;
  for (let j = 0; j < n; j++) {
    total += BigInt(k) ** BigInt(cycles((i) => (i + j) % n));
    if (reflections) total += BigInt(k) ** BigInt(cycles((i) => (((j - i) % n) + n) % n));
  }
  return total / BigInt(n * (reflections ? 2 : 1));
}

test("the exact counts agree with Burnside on the permutations, past 2^53 too", () => {
  for (let n = 1; n <= 70; n++)
    for (const k of [1, 2, 3, 4, 7, 10]) {
      expect([n, k, necklaceCountExact(n, k)]).toEqual([n, k, burnside(n, k, false)]);
      expect([n, k, braceletCountExact(n, k)]).toEqual([n, k, burnside(n, k, true)]);
    }
});

test("the kernels count the orbits the families enumerate", () => {
  /** The least form of a word under its rotations (and reversals). */
  const orbit = (word: number[], flips: boolean): string => {
    const forms: number[][] = [];
    for (const w of flips ? [word, word.toReversed()] : [word])
      for (let s = 0; s < Math.max(1, w.length); s++) forms.push([...w.slice(s), ...w.slice(0, s)]);
    return forms.map((f) => f.join("")).toSorted()[0]!;
  };
  for (let n = 0; n <= 8; n++)
    for (const k of [1, 2, 3, 4]) {
      if ((k === 4 && n > 6) || (k === 3 && n > 7)) continue;
      const words = Array.from({ length: k ** n }, (_, i) =>
        Array.from({ length: n }, (_, j) => Math.floor(i / k ** j) % k),
      );
      expect([n, k, necklaces.count([n, k])]).toEqual([n, k, BigInt(new Set(words.map((w) => orbit(w, false))).size)]);
      expect([n, k, bracelets.count([n, k])]).toEqual([n, k, BigInt(new Set(words.map((w) => orbit(w, true))).size)]);
    }
});

test("the binary heads agree with the k = 2 families, past 2^53 too", () => {
  for (const n of [0, 1, 2, 5, 12, 58, 64]) {
    expect(kernelFor("BinaryNecklaces").count([n])).toBe(necklaces.count([n, 2]));
    expect(kernelFor("BinaryBracelets").count([n])).toBe(bracelets.count([n, 2]));
  }
  expect(necklaces.count([64, 2])).toBeGreaterThan(2n ** 53n);
});

test("Count through the engine is exact past 2^53", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const count = (head: string, ...args: number[]): unknown =>
    engine.box(["Count", [head, ...args]] as never).evaluate().json;
  expect(count("KNecklaces", 40, 3)).toEqual({ num: String(burnside(40, 3, false)) });
  expect(count("KBracelets", 41, 3)).toEqual({ num: String(burnside(41, 3, true)) });
  expect(count("BinaryNecklaces", 64)).toEqual({ num: String(burnside(64, 2, false)) });
  expect(count("BinaryBracelets", 64)).toEqual({ num: String(burnside(64, 2, true)) });
});

test("edge params: no colors, no beads", () => {
  for (const kernel of [necklaces, bracelets]) {
    expect(kernel.count([0, 0])).toBe(0n);
    expect(kernel.count([5, 0])).toBe(0n);
    expect(kernel.count([0, 3])).toBe(1n);
    expect(kernel.count([1, 5])).toBe(5n);
  }
});

// OEIS data, offset 0.
const OEIS = {
  A000031: [1, 2, 3, 4, 6, 8, 14, 20, 36, 60, 108, 188, 352, 632, 1182, 2192, 4116, 7712, 14602, 27596, 52488],
  A000029: [1, 2, 3, 4, 6, 8, 13, 18, 30, 46, 78, 126, 224, 380, 687, 1224, 2250, 4112, 7685, 14310, 27012],
  A001867: [1, 3, 6, 11, 24, 51, 130, 315, 834, 2195, 5934, 16107, 44368, 122643, 341802, 956635, 2690844, 7596483],
  A027671: [1, 3, 6, 10, 21, 39, 92, 198, 498, 1219, 3210, 8418, 22913, 62415, 173088, 481598, 1351983, 3808083],
};

test("OEIS: A000031 and A000029 (k = 2), A001867 and A027671 (k = 3)", () => {
  const terms = (kernel: typeof necklaces, k: number, length: number) =>
    Array.from({ length }, (_, n) => Number(kernel.count([n, k])));
  expect(terms(necklaces, 2, OEIS.A000031.length)).toEqual(OEIS.A000031);
  expect(terms(bracelets, 2, OEIS.A000029.length)).toEqual(OEIS.A000029);
  expect(terms(necklaces, 3, OEIS.A001867.length)).toEqual(OEIS.A001867);
  expect(terms(bracelets, 3, OEIS.A027671.length)).toEqual(OEIS.A027671);
});
