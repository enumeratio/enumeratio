import { expect, test } from "vite-plus/test";
import {
  areFareyNeighbours,
  classify,
  continuedFraction,
  determinant,
  fareySequence,
  fromContinuedFraction,
  fromSternBrocotPath,
  hyperbolicClasses,
  IDENTITY,
  isPrimitiveWord,
  leastRotation,
  type Matrix,
  multiply,
  positiveWord,
  power,
  S,
  samePSL,
  sternBrocotPath,
  stWord,
  stWordToMatrix,
  T,
  U,
  wordToMatrix,
} from "../src/psl2z.ts";

const words = (length: number): string[] => {
  const out: string[] = [];
  for (let mask = 0; mask < 2 ** length; mask++) {
    let word = "";
    for (let i = 0; i < length; i++) word += (mask >> i) & 1 ? "R" : "L";
    out.push(word);
  }
  return out;
};
const allWords = [1, 2, 3, 4, 5, 6, 7].flatMap(words);

test("S has order 2 and U = ST has order 3, in PSL(2,Z)", () => {
  expect(samePSL(multiply(S, S), IDENTITY)).toBe(true);
  expect(samePSL(U, multiply(S, T))).toBe(true);
  expect(samePSL(multiply(U, multiply(U, U)), IDENTITY)).toBe(true);
  // …and neither has smaller order, so PSL(2,Z) really is Z/2 * Z/3 on these.
  expect(samePSL(U, IDENTITY)).toBe(false);
  expect(samePSL(multiply(U, U), IDENTITY)).toBe(false);
});

test("determinant 1 is preserved by every product", () => {
  for (const word of allWords) {
    const m = wordToMatrix(word)!;
    expect(determinant(m), word).toBe(1);
  }
  expect(determinant(multiply(S, T))).toBe(1);
  expect(determinant(power(T, 7)!)).toBe(1);
});

test("positive words and matrices are the same thing", () => {
  // The peel is the inverse of the fold, on every word up to length 7.
  for (const word of allWords) {
    expect(positiveWord(wordToMatrix(word)!), word).toBe(word);
  }
});

test("a positive LR word is hyperbolic exactly when it uses both letters", () => {
  for (const word of allWords) {
    const kind = classify(wordToMatrix(word)!);
    const mixed = word.includes("L") && word.includes("R");
    expect(kind, word).toBe(mixed ? "hyperbolic" : "parabolic");
  }
  expect(classify(IDENTITY)).toBe("identity");
  expect(classify(S)).toBe("elliptic");
  expect(classify(U)).toBe("elliptic");
});

test("the S/T factorisation rebuilds the matrix, up to the sign PSL quotients out", () => {
  const samples: Matrix[] = [
    [1, 0, 0, 1],
    [2, 1, 1, 1],
    [3, 2, 4, 3],
    [1, 5, 0, 1],
    [0, -1, 1, 0],
    [5, 3, 3, 2],
    [-2, 1, -5, 2],
    [7, -3, 5, -2],
  ];
  for (const m of samples) {
    const word = stWord(m);
    expect(word, JSON.stringify(m)).toBeDefined();
    expect(samePSL(stWordToMatrix(word!)!, m), JSON.stringify(m)).toBe(true);
  }
});

test("continued fractions round-trip, and are unique (no trailing 1)", () => {
  for (let q = 1; q <= 40; q++) {
    for (let p = -20; p <= 60; p++) {
      const quotients = continuedFraction(p, q)!;
      expect(quotients.length, `${p}/${q}`).toBeGreaterThan(0);
      if (quotients.length > 1) expect(quotients[quotients.length - 1], `${p}/${q}`).not.toBe(1);
      const [n, d] = fromContinuedFraction(quotients)!;
      // Equal as rationals: the expansion is of the reduced fraction.
      expect(n * q, `${p}/${q}`).toBe(p * d);
    }
  }
});

test("the Stern-Brocot path round-trips, and its letter runs are the continued fraction", () => {
  for (let p = 1; p <= 30; p++) {
    for (let q = 1; q <= 30; q++) {
      const path = sternBrocotPath(p, q);
      if (path === undefined) continue;
      const [n, d] = fromSternBrocotPath(path)!;
      expect(n * q, `${p}/${q}`).toBe(p * d);
    }
  }
  // 5/3 = [1; 1, 2]: one right turn, then one left, then one right — R L R.
  expect(sternBrocotPath(5, 3)).toBe("RLR");
  expect(continuedFraction(5, 3)).toEqual([1, 1, 2]);
  // The runs of the path are the continued fraction, less one from the first term.
  const runs = (word: string): number[] => (word.match(/(.)\1*/g) ?? []).map((run) => run.length);
  for (const [p, q] of [
    [7, 5],
    [13, 8],
    [22, 7],
    [355, 113],
  ] as const) {
    const path = sternBrocotPath(p, q)!;
    const quotients = continuedFraction(p, q)!;
    // The path is R^{a₀} L^{a₁} R^{a₂} … with the LAST exponent one short: the final step
    // is the arrival, not a turn. A leading a₀ = 0 just means the path starts leftwards.
    const expected = [...quotients];
    expected[expected.length - 1] = (expected[expected.length - 1] as number) - 1;
    expect(runs(path), `${p}/${q}`).toEqual(expected.filter((x) => x > 0));
  }
});

test("the Farey sequence has the right length and consecutive-determinant property", () => {
  const totient = (n: number): number => {
    let count = 0;
    for (let k = 1; k <= n; k++) {
      let [a, b] = [k, n];
      while (b !== 0) [a, b] = [b, a % b];
      if (a === 1) count++;
    }
    return count;
  };
  for (let n = 1; n <= 30; n++) {
    const farey = fareySequence(n)!;
    // |F_n| = 1 + Σ_{k=1..n} φ(k).
    let expected = 1;
    for (let k = 1; k <= n; k++) expected += totient(k);
    expect(farey.length, `F_${n}`).toBe(expected);
    for (let i = 0; i + 1 < farey.length; i++) {
      const [p, q] = farey[i]!;
      const [r, s] = farey[i + 1]!;
      expect(areFareyNeighbours(p, q, r, s), `F_${n} at ${i}`).toBe(true);
      expect(p * s - q * r, `F_${n} at ${i}`).toBe(-1); // strictly increasing
    }
  }
});

test("conjugacy classes of positive words are necklaces", () => {
  // Conjugating by the first letter rotates the word, so a class is a rotation orbit.
  for (const word of allWords) {
    if (word.length < 2) continue;
    const rotated = word.slice(1) + word[0];
    expect(leastRotation(rotated), word).toBe(leastRotation(word));
    // …and rotation really is conjugation: x⁻¹(xw)x = wx.
    const m = wordToMatrix(word)!;
    const x = wordToMatrix(word[0]!)!;
    const conjugated = multiply(multiply([x[3], -x[1], -x[2], x[0]], m), x);
    expect(positiveWord(conjugated), word).toBe(rotated);
  }
});

test("the number of hyperbolic classes matches the necklace closed forms", () => {
  const mobius = (n: number): number => {
    let value = 1;
    let rest = n;
    for (let p = 2; p * p <= rest; p++) {
      if (rest % p !== 0) continue;
      rest /= p;
      if (rest % p === 0) return 0;
      value = -value;
    }
    return rest > 1 ? -value : value;
  };
  const totient = (n: number): number => {
    let count = 0;
    for (let k = 1; k <= n; k++) {
      let [a, b] = [k, n];
      while (b !== 0) [a, b] = [b, a % b];
      if (a === 1) count++;
    }
    return count;
  };
  for (let n = 2; n <= 14; n++) {
    // All binary necklaces of length n, minus the two constant ones (which are parabolic).
    let necklaces = 0;
    for (let d = 1; d <= n; d++) if (n % d === 0) necklaces += totient(d) * 2 ** (n / d);
    expect(hyperbolicClasses(n)!.length, `length ${n}`).toBe(necklaces / n - 2);
    // The primitive ones are the aperiodic necklaces — Lyndon words — again less two.
    let lyndon = 0;
    for (let d = 1; d <= n; d++) if (n % d === 0) lyndon += mobius(d) * 2 ** (n / d);
    expect(hyperbolicClasses(n, true)!.length, `primitive ${n}`).toBe(
      lyndon / n - (n === 1 ? 2 : 0),
    );
  }
});

test("primitivity is aperiodicity", () => {
  expect(isPrimitiveWord("LR")).toBe(true);
  expect(isPrimitiveWord("LRLR")).toBe(false);
  expect(isPrimitiveWord("LRR")).toBe(true);
  expect(isPrimitiveWord("LLRLLR")).toBe(false);
  expect(isPrimitiveWord("")).toBe(false);
});

test("malformed input yields nothing", () => {
  expect(wordToMatrix("LX")).toBeUndefined();
  expect(positiveWord([1, 2, 3, 4])).toBeUndefined(); // determinant −2
  expect(positiveWord([2, -1, 1, 0])).toBeUndefined(); // negative entry
  expect(continuedFraction(1, 0)).toBeUndefined();
  expect(fareySequence(0)).toBeUndefined();
  expect(hyperbolicClasses(0)).toBeUndefined();
});
