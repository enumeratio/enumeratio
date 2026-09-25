import { expect, test } from "vite-plus/test";
import {
  alexanderPolynomial,
  components,
  crossings,
  isPositive,
  permutationOf,
  positiveBraidGenus,
  positivePermutationBraid,
  torusAlexander,
  torusBraid,
} from "../src/braid.ts";
import { format, normalise } from "../src/laurent.ts";
import { isPrimitive, lorenzBraid, lorenzPermutation, tripNumber } from "../src/lorenz.ts";

const coprime = (a: number, b: number): boolean => {
  let [x, y] = [a, b];
  while (y !== 0) [x, y] = [y, x % y];
  return x === 1;
};

/** Every primitive mixed necklace up to a given length, one representative each. */
function necklaces(maxLength: number): string[] {
  const out: string[] = [];
  for (let n = 2; n <= maxLength; n++) {
    const seen = new Set<string>();
    for (let mask = 0; mask < 2 ** n; mask++) {
      let word = "";
      for (let i = 0; i < n; i++) word += (mask >> i) & 1 ? "R" : "L";
      if (!word.includes("L") || !word.includes("R") || !isPrimitive(word)) continue;
      let least = word;
      for (let i = 1; i < n; i++) {
        const rotation = word.slice(i) + word.slice(0, i);
        if (rotation < least) least = rotation;
      }
      if (!seen.has(least)) {
        seen.add(least);
        out.push(least);
      }
    }
  }
  return out;
}

/** If a permutation is i ↦ i + k (mod n), that k; otherwise undefined. */
function rotationStep(permutation: readonly number[]): number | undefined {
  const n = permutation.length;
  const k = (((permutation[0] as number) % n) + n) % n;
  return permutation.every((image, i) => image === (i + k) % n) ? k : undefined;
}

test("the induced map really is a permutation, and the braid realises it", () => {
  for (const word of necklaces(10)) {
    const permutation = lorenzPermutation(word)!;
    expect(
      [...permutation].sort((a, b) => a - b),
      word,
    ).toEqual(permutation.map((_, i) => i));
    const b = lorenzBraid(word)!;
    expect(permutationOf(b), word).toEqual(permutation);
    // The template's two branches only ever cross one way, so the braid is positive…
    expect(isPositive(b), word).toBe(true);
    // …and the flow is a single cycle on the orbit's points, so the closure is a KNOT.
    expect(components(b), word).toBe(1);
    expect(b.strands, word).toBe(word.length);
  }
});

test("a rotation permutation closes to the torus knot T(k, n−k)", () => {
  // The oracle for the braid machinery: the positive permutation braid of i ↦ i+k on n
  // points is the torus link, and the closed-form polynomial knows nothing about braids.
  for (let n = 3; n <= 9; n++) {
    for (let k = 1; k < n; k++) {
      if (!coprime(k, n)) continue;
      const rotation = Array.from({ length: n }, (_, i) => (i + k) % n);
      const knot = alexanderPolynomial(positivePermutationBraid(rotation)!)!;
      const [a, b] = [k, n - k];
      const expected = a === 1 || b === 1 ? "1" : format(normalise(torusAlexander(a, b)!));
      expect(format(knot), `rotation ${k} of ${n} vs T(${a},${b})`).toBe(expected);
    }
  }
});

test("the Lorenz knots that ARE torus knots are the ones with rotation permutations", () => {
  // Which words those are is not obvious in advance; that they land on torus knots is the
  // check. (They are the Christoffel words — the same rotation sequences as Sturmian
  // dynamics, which is why the modular flow keeps meeting continued fractions.)
  let found = 0;
  for (const word of necklaces(11)) {
    const step = rotationStep(lorenzPermutation(word)!);
    if (step === undefined) continue;
    found++;
    const n = word.length;
    const [a, b] = [step, n - step];
    const expected = a === 1 || b === 1 ? "1" : format(normalise(torusAlexander(a, b)!));
    expect(format(alexanderPolynomial(lorenzBraid(word)!)!), `${word} vs T(${a},${b})`).toBe(expected);
  }
  expect(found).toBeGreaterThan(10); // not a vacuous test
});

test("the trip number is the braid index", () => {
  // The trip number counts the LR corners of the cyclic word — how many points cross the
  // branch line rightwards. Birman and Williams: it is the braid index of the Lorenz link.
  // Braid index 1 means the unknot, and that is checkable on every word at once.
  for (const word of necklaces(11)) {
    const trivial = format(alexanderPolynomial(lorenzBraid(word)!)!) === "1";
    expect(tripNumber(word) === 1, word).toBe(trivial);
  }
  // A single hump each way is an unknotted orbit, however long the word.
  for (let p = 1; p <= 6; p++) {
    for (let q = 1; q <= 6; q++) {
      if (p + q < 2 || !coprime(p, q)) continue;
      const word = "L".repeat(p) + "R".repeat(q);
      expect(tripNumber(word), word).toBe(1);
      expect(format(alexanderPolynomial(lorenzBraid(word)!)!), word).toBe("1");
    }
  }
  // …and where the knot is a torus knot, the trip number is its braid index min(a, b).
  for (const word of necklaces(11)) {
    const step = rotationStep(lorenzPermutation(word)!);
    if (step === undefined) continue;
    expect(tripNumber(word), word).toBe(Math.min(step, word.length - step));
  }
});

test("the knot depends on the geodesic, not on where you enter it", () => {
  for (const word of ["LLRLR", "LLRLRR", "LLLRLLR"]) {
    const base = format(alexanderPolynomial(lorenzBraid(word)!)!);
    for (let i = 1; i < word.length; i++) {
      const rotated = word.slice(i) + word.slice(0, i);
      expect(format(alexanderPolynomial(lorenzBraid(rotated)!)!), rotated).toBe(base);
    }
  }
});

test("the first few genuinely knotted geodesics", () => {
  // LR is the shortest closed geodesic and draws the unknot. The shortest that draws a
  // TREFOIL is LLRLR, of symbolic length 5.
  expect(format(alexanderPolynomial(lorenzBraid("LR")!)!)).toBe("1");
  expect(format(alexanderPolynomial(lorenzBraid("LLRLR")!)!)).toBe("1 - t + t^2");
  expect(positiveBraidGenus(lorenzBraid("LLRLR")!)).toBe(1);
  expect(crossings(lorenzBraid("LLRLR")!)).toBe(6);
  // …and it is the same trefoil the torus braid gives, by a completely different route.
  expect(format(alexanderPolynomial(lorenzBraid("LLRLR")!)!)).toBe(format(alexanderPolynomial(torusBraid(2, 3)!)!));
  // The next one up is the (2,5) torus knot, at length 7.
  expect(format(alexanderPolynomial(lorenzBraid("LLLRLLR")!)!)).toBe(format(normalise(torusAlexander(2, 5)!)));
});

test("degenerate words yield nothing", () => {
  expect(lorenzPermutation("LLLL")).toBeUndefined(); // parabolic, not a closed geodesic
  expect(lorenzPermutation("LRLR")).toBeUndefined(); // not primitive
  expect(lorenzPermutation("LX")).toBeUndefined();
  expect(tripNumber("LRLR")).toBeUndefined();
  expect(isPrimitive("")).toBe(false);
});
