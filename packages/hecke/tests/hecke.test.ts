import { expect, test } from "vite-plus/test";
import {
  add,
  basisElement,
  compose,
  type Coefficients,
  type Element,
  identityPermutation,
  length,
  multiply,
  type Permutation,
  permutationKey,
  permutations,
  reducedWord,
  simpleReflection,
} from "../src/hecke.ts";

// Coefficients as honest polynomials in q — an array of coefficients by degree. Exact,
// and entirely independent of compute-engine, so the algebra is tested on its own.
type Poly = number[];
const trim = (p: Poly): Poly => {
  const out = [...p];
  while (out.length > 0 && out[out.length - 1] === 0) out.pop();
  return out;
};
const polynomials: Coefficients<Poly> = {
  zero: [],
  one: [1],
  q: [0, 1],
  qMinusOne: [-1, 1],
  add: (a, b) =>
    trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0))),
  multiply: (a, b) => {
    const out = Array.from({ length: a.length + b.length }, () => 0);
    a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
    return trim(out);
  },
  isZero: (a) => trim(a).length === 0,
};

/** Evaluate every coefficient at a value of q — the bridge to the group algebra. */
const at = (element: Element<Poly>, q: number): Map<string, number> => {
  const out = new Map<string, number>();
  for (const [key, term] of element) {
    const value = term.coefficient.reduce((acc, c, i) => acc + c * q ** i, 0);
    if (value !== 0) out.set(key, value);
  }
  return out;
};

const T = (w: Permutation) => basisElement(polynomials, w);
const times = (...parts: Element<Poly>[]) => parts.reduce((a, b) => multiply(polynomials, a, b));

test("length and reduced words agree", () => {
  for (const n of [1, 2, 3, 4]) {
    for (const w of permutations(n)) {
      const word = reducedWord(w);
      expect(word.length, `length of ${String(w)}`).toBe(length(w));
      // The word really does spell w.
      const spelled = word.reduce(
        (acc, i) => compose(acc, simpleReflection(n, i)),
        identityPermutation(n),
      );
      expect(permutationKey(spelled)).toBe(permutationKey(w));
    }
  }
});

test("the quadratic relation: T_s² = q + (q−1)T_s", () => {
  for (const n of [2, 3, 4]) {
    for (let i = 1; i < n; i++) {
      const s = simpleReflection(n, i);
      const square = times(T(s), T(s));
      const expected = add(polynomials, [
        // q·T_identity
        new Map([
          [
            permutationKey(identityPermutation(n)),
            { w: identityPermutation(n), coefficient: polynomials.q },
          ],
        ]),
        new Map([[permutationKey(s), { w: s, coefficient: polynomials.qMinusOne }]]),
      ]);
      expect(
        [...square]
          .map(([k, v]) => [k, v.coefficient])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ).toEqual(
        [...expected]
          .map(([k, v]) => [k, v.coefficient])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      );
    }
  }
});

test("the braid relations hold", () => {
  const n = 5;
  const key = (e: Element<Poly>) =>
    JSON.stringify(
      [...e]
        .map(([k, v]) => [k, v.coefficient])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  for (let i = 1; i < n - 1; i++) {
    const s = T(simpleReflection(n, i));
    const t = T(simpleReflection(n, i + 1));
    expect(key(times(s, t, s)), `braid at ${i}`).toBe(key(times(t, s, t)));
  }
  // Distant generators commute.
  const a = T(simpleReflection(n, 1));
  const b = T(simpleReflection(n, 3));
  expect(key(times(a, b))).toBe(key(times(b, a)));
});

test("at q = 1 the algebra IS the symmetric group algebra", () => {
  // The deformation vanishes: T_u·T_v must be exactly T_{uv}, with coefficient 1.
  for (const n of [2, 3, 4]) {
    for (const u of permutations(n)) {
      for (const v of permutations(n)) {
        const product = at(times(T(u), T(v)), 1);
        expect(product.size, `${String(u)} times ${String(v)}`).toBe(1);
        const [[key, coefficient]] = [...product];
        expect(key).toBe(permutationKey(compose(u, v)));
        expect(coefficient).toBe(1);
      }
    }
  }
});

test("at q ≠ 1 it is NOT the group algebra", () => {
  // The same product at q = 2 spreads over more than one basis element.
  const s = simpleReflection(3, 1);
  const spread = at(times(T(s), T(s)), 2);
  expect(spread.size).toBe(2); // q·T_id + (q−1)·T_s
  expect(spread.get(permutationKey(identityPermutation(3)))).toBe(2);
  expect(spread.get(permutationKey(s))).toBe(1);
});

test("the product is associative", () => {
  const n = 4;
  const key = (e: Element<Poly>) =>
    JSON.stringify(
      [...e]
        .map(([k, v]) => [k, v.coefficient])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  const sample = permutations(n).slice(0, 10);
  for (const u of sample) {
    for (const v of sample) {
      for (const w of sample.slice(0, 5)) {
        expect(key(times(times(T(u), T(v)), T(w)))).toBe(key(times(T(u), times(T(v), T(w)))));
      }
    }
  }
});

test("T_w is the product over ANY reduced word for w", () => {
  // Word-independence is the braid relation doing its job; if it failed, the whole
  // basis would be ill-defined.
  const n = 4;
  const key = (e: Element<Poly>) =>
    JSON.stringify(
      [...e]
        .map(([k, v]) => [k, v.coefficient])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  for (const w of permutations(n)) {
    const word = reducedWord(w);
    const spelled =
      word.length === 0
        ? T(identityPermutation(n))
        : times(...word.map((i) => T(simpleReflection(n, i))));
    expect(key(spelled), `T of ${String(w)}`).toBe(key(T(w)));
  }
});

test("the identity acts as one, and the basis has n! elements", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    expect(permutations(n).length).toBe([1, 1, 2, 6, 24, 120][n]);
  }
  const n = 4;
  const one = T(identityPermutation(n));
  for (const w of permutations(n)) {
    const key = (e: Element<Poly>) => JSON.stringify([...e].map(([k, v]) => [k, v.coefficient]));
    expect(key(times(one, T(w)))).toBe(key(T(w)));
    expect(key(times(T(w), one))).toBe(key(T(w)));
  }
});
