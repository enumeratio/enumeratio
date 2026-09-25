import { expect, test } from "vite-plus/test";
import { IDENTITY, type Matrix, multiply, positiveWord, power, S, T, wordToMatrix } from "../src/psl2z.ts";
import {
  dedekindSum,
  linkingWithTrefoil,
  normaliseWord,
  rademacherPhi,
  rademacherSymbol,
  type Rational,
  rational,
  wordSymbol,
  wordTrace,
} from "../src/rademacher.ts";

const add = (x: Rational, y: Rational): Rational => rational(x[0] * y[1] + y[0] * x[1], x[1] * y[1])!;
const same = (x: Rational, y: Rational): boolean => x[0] === y[0] && x[1] === y[1];

const mixedWords = (length: number): string[] => {
  const out: string[] = [];
  for (let mask = 0; mask < 2 ** length; mask++) {
    let word = "";
    for (let i = 0; i < length; i++) word += (mask >> i) & 1 ? "R" : "L";
    if (word.includes("L") && word.includes("R")) out.push(word);
  }
  return out;
};
const allMixed = [2, 3, 4, 5, 6, 7, 8].flatMap(mixedWords);

test("Dedekind sums satisfy the reciprocity law", () => {
  // s(h,k) + s(k,h) = −1/4 + (h² + k² + 1)/(12hk), for coprime h, k > 0. The sums are
  // computed by brute force from the definition, so this is a genuine check on them.
  const coprime = (a: number, b: number): boolean => {
    let [x, y] = [a, b];
    while (y !== 0) [x, y] = [y, x % y];
    return x === 1;
  };
  for (let h = 1; h <= 30; h++) {
    for (let k = 1; k <= 30; k++) {
      if (!coprime(h, k)) continue;
      const left = add(dedekindSum(h, k)!, dedekindSum(k, h)!);
      const right = add(rational(-1, 4)!, rational(h * h + k * k + 1, 12 * h * k)!);
      expect(same(left, right), `s(${h},${k}) + s(${k},${h})`).toBe(true);
    }
  }
});

test("Dedekind sums match the closed form at h = 1, and their two symmetries", () => {
  for (let k = 1; k <= 40; k++) {
    expect(dedekindSum(1, k), `s(1,${k})`).toEqual(rational((k - 1) * (k - 2), 12 * k));
  }
  for (let k = 2; k <= 20; k++) {
    for (let h = 1; h < k; h++) {
      const base = dedekindSum(h, k);
      if (base === undefined) continue;
      // s(−h, k) = −s(h, k), and s depends on h only mod k.
      expect(dedekindSum(-h, k), `s(−${h},${k})`).toEqual(rational(-base[0], base[1]));
      expect(dedekindSum(h + k, k), `s(${h}+${k},${k})`).toEqual(base);
    }
  }
  expect(dedekindSum(2, 4)).toBeUndefined(); // not coprime
  expect(dedekindSum(1, 0)).toBeUndefined();
});

test("the Rademacher symbol is the R's minus the L's", () => {
  // The point of the package. One side counts letters in a word; the other runs a
  // Dedekind sum over the matrix. Nothing connects them except the theorem.
  for (const word of allMixed) {
    const m = wordToMatrix(word)!;
    expect(rademacherSymbol(m), word).toBe(wordSymbol(word));
  }
});

test("the symbol is a class function; Rademacher's Φ is not", () => {
  for (const word of allMixed) {
    if (word.length < 2) continue;
    const rotated = word.slice(1) + word[0];
    expect(rademacherSymbol(wordToMatrix(rotated)!), word).toBe(rademacherSymbol(wordToMatrix(word)!));
  }
  // Φ alone is only a quasimorphism — conjugation moves it, which is exactly why the
  // −3·sign(c(a+d)) correction is needed to get an invariant of the closed geodesic.
  // Rotating a positive word cannot show this, because the correction is constant on the
  // positive cone; conjugating by S leaves the cone and does.
  const m = wordToMatrix("LLLR")!;
  const conjugated: Matrix = multiply(multiply([0, 1, -1, 0], m), S);
  expect(rademacherSymbol(conjugated)).toBe(rademacherSymbol(m));
  expect(rademacherPhi(conjugated)).not.toBe(rademacherPhi(m));
});

test("Φ on the parabolic and elliptic generators", () => {
  for (let n = -6; n <= 6; n++) expect(rademacherPhi(power(T, n)!), `T^${n}`).toBe(n);
  expect(rademacherPhi(IDENTITY)).toBe(0);
  expect(rademacherPhi(S)).toBe(0);
  // Neither S nor T has a symbol: the symbol is only defined on hyperbolic elements.
  expect(rademacherSymbol(S)).toBeUndefined();
  expect(rademacherSymbol(T)).toBeUndefined();
  expect(rademacherSymbol(IDENTITY)).toBeUndefined();
});

test("the linking number with the trefoil is the same number", () => {
  for (const word of allMixed.slice(0, 60)) {
    expect(linkingWithTrefoil(wordToMatrix(word)!), word).toBe(wordSymbol(word));
  }
  // A geodesic that turns equally both ways has linking number zero with the trefoil.
  expect(linkingWithTrefoil(wordToMatrix("LR")!)).toBe(0);
  expect(linkingWithTrefoil(wordToMatrix("LLRR")!)).toBe(0);
  // Turning only right winds around it once per letter, less the two it costs to close up.
  expect(linkingWithTrefoil(wordToMatrix("LRRRR")!)).toBe(3);
});

test("the trace grows with the word, and fixes the geodesic's length", () => {
  // Word length is the symbolic period; the trace is the geometric one. They are not the
  // same ordering — LLLR and LRLR both have length 4.
  expect(wordTrace("LRLR")).toBe(7);
  expect(wordTrace("LLLR")).toBe(5);
  expect(wordTrace("LR")).toBe(3);
  // ℓ = 2·arccosh(|tr|/2): the shortest closed geodesic is the one with the least trace.
  const lengths = mixedWords(4).map((w) => wordTrace(w)!);
  expect(Math.min(...lengths)).toBe(5);
  expect(wordTrace("LX")).toBeUndefined();
});

test("normalising a word is the identity on words, so the two directions agree", () => {
  for (const word of allMixed) expect(normaliseWord(word), word).toBe(word);
  expect(normaliseWord("")).toBeUndefined();
  expect(positiveWord(wordToMatrix("RRLL")!)).toBe("RRLL");
});
