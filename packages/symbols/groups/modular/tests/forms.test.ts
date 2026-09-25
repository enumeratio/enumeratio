import { expect, test } from "vite-plus/test";
import {
  actOn,
  automorph,
  classNumber,
  cycleOf,
  discriminant,
  evaluateForm,
  type Form,
  form,
  formClasses,
  isIndefinite,
  isReduced,
  pellSolution,
  reduceForm,
  reducedForms,
  rho,
  sameForm,
} from "../src/forms.ts";
import { type Matrix, determinant, multiply, positiveWord, trace } from "../src/psl2z.ts";

/** Indefinite discriminants in a workable range: D > 0, not a perfect square. */
const discriminants = (limit: number): number[] => {
  const out: number[] = [];
  for (let d = 5; d <= limit; d++) {
    if (d % 4 !== 0 && d % 4 !== 1) continue; // b² − 4ac is 0 or 1 mod 4
    const root = Math.round(Math.sqrt(d));
    if (root * root === d) continue;
    out.push(d);
  }
  return out;
};

const gcd = (a: number, b: number): number => {
  let [x, y] = [Math.abs(a), Math.abs(b)];
  while (y !== 0) [x, y] = [y, x % y];
  return x;
};

/** Extended Euclid: returns [g, s, t] with a·s + b·t = g. */
function extendedGcd(a: number, b: number): [number, number, number] {
  let [oldRest, rest] = [a, b];
  let [oldS, s] = [1, 0];
  let [oldT, t] = [0, 1];
  while (rest !== 0) {
    const quotient = Math.trunc(oldRest / rest);
    [oldRest, rest] = [rest, oldRest - quotient * rest];
    [oldS, s] = [s, oldS - quotient * s];
    [oldT, t] = [t, oldT - quotient * t];
  }
  return oldRest < 0 ? [-oldRest, -oldS, -oldT] : [oldRest, oldS, oldT];
}

/**
 * Whether f and g are properly equivalent, decided WITHOUT ρ — the oracle.
 *
 * Enumerating matrices is hopeless (the entries get large fast). Instead: the first column
 * (p, r) of a transforming matrix must satisfy f(p, r) = g.a and be coprime, and then the
 * second column is determined up to adding multiples of the first. Along that family the
 * middle coefficient moves in steps of exactly 2·g.a, so there is at most ONE candidate
 * and it is solved for, not searched. That makes the check exact for every matrix whose
 * first column is in range, which is far beyond what enumeration reaches.
 */
function equivalentBySearch(f: Form, g: Form, limit = 60): boolean {
  if (g.a === 0) return false;
  for (let p = -limit; p <= limit; p++) {
    for (let r = -limit; r <= limit; r++) {
      if (gcd(p, r) !== 1) continue;
      if (evaluateForm(f, p, r) !== g.a) continue;
      const [, columnS, columnT] = extendedGcd(p, r);
      const [s0, q0] = [columnS, -columnT]; // p·s₀ − q₀·r = p·s + r·t = 1
      if (p * s0 - q0 * r !== 1) continue;
      const middle = 2 * f.a * p * q0 + f.b * (p * s0 + q0 * r) + 2 * f.c * r * s0;
      if ((g.b - middle) % (2 * g.a) !== 0) continue;
      const k = (g.b - middle) / (2 * g.a);
      const image = actOn(f, [p, q0 + k * p, r, s0 + k * r]);
      if (image !== undefined && sameForm(image, g)) return true;
    }
  }
  return false;
}

test("the action preserves the discriminant, and is an action", () => {
  const samples: Form[] = [
    { a: 1, b: 1, c: -1 },
    { a: 2, b: 3, c: -1 },
    { a: -3, b: 5, c: 2 },
    { a: 1, b: 0, c: -7 },
  ];
  const matrices: Matrix[] = [
    [1, 1, 0, 1],
    [0, -1, 1, 0],
    [2, 1, 1, 1],
    [1, 0, 3, 1],
  ];
  for (const f of samples) {
    for (const m of matrices) {
      expect(determinant(m)).toBe(1);
      const image = actOn(f, m)!;
      expect(discriminant(image), JSON.stringify([f, m])).toBe(discriminant(f));
      // (f∘M)∘N = f∘(MN): the substitution really is a right action.
      for (const n of matrices) {
        expect(actOn(image, n), "associativity").toEqual(actOn(f, multiply(m, n)));
      }
    }
  }
  // …and the value at a transformed point is the transformed form's value.
  const f: Form = { a: 2, b: 3, c: -1 };
  const m: Matrix = [2, 1, 1, 1];
  expect(evaluateForm(actOn(f, m)!, 3, 5)).toBe(evaluateForm(f, 2 * 3 + 1 * 5, 1 * 3 + 1 * 5));
});

test("reduction lands on a reduced form, and cycles close", () => {
  for (const d of discriminants(200)) {
    for (const f of reducedForms(d)!) {
      expect(isReduced(f), `${d}: ${JSON.stringify(f)}`).toBe(true);
      expect(discriminant(f), `${d}`).toBe(d);
      // ρ stays inside the reduced forms…
      const next = rho(f)!;
      expect(isReduced(next), `${d}: ρ of ${JSON.stringify(f)}`).toBe(true);
      expect(discriminant(next), `${d}`).toBe(d);
      // …and the cycle through f comes back to f.
      const cycle = cycleOf(f)!;
      expect(cycle.length, `${d}`).toBeGreaterThan(0);
      expect(
        cycle.some((g) => sameForm(g, f)),
        `${d}`,
      ).toBe(true);
      // The cycle length is even: ρ flips the sign of the leading coefficient.
      expect(cycle.length % 2, `${d}: ${JSON.stringify(f)}`).toBe(0);
    }
  }
});

test("an unreduced form reduces to a member of its own class", () => {
  const samples: Form[] = [
    { a: 1, b: 0, c: -7 },
    { a: 11, b: 3, c: -1 },
    { a: 1, b: 1, c: -25 },
    { a: -5, b: 4, c: 7 },
    { a: 7, b: 13, c: -3 },
  ];
  for (const f of samples) {
    const reduced = reduceForm(f)!;
    expect(isReduced(reduced), JSON.stringify(f)).toBe(true);
    expect(discriminant(reduced), JSON.stringify(f)).toBe(discriminant(f));
    expect(equivalentBySearch(f, reduced), JSON.stringify(f)).toBe(true);
  }
});

test("the cycles are exactly the equivalence classes", () => {
  // The oracle: classify by brute-force search over SL(2,Z) matrices with small entries,
  // which knows nothing about ρ, and check it agrees with the cycle partition both ways.
  for (const d of discriminants(60)) {
    const classes = formClasses(d)!;
    // Every form in a cycle is genuinely equivalent to the cycle's first — no over-merging.
    for (const cycle of classes) {
      for (const f of cycle) {
        expect(equivalentBySearch(cycle[0] as Form, f), `${d}: ${JSON.stringify(f)}`).toBe(true);
      }
    }
    // And forms in different cycles are not — no over-splitting.
    for (let i = 0; i < classes.length; i++) {
      for (let j = i + 1; j < classes.length; j++) {
        expect(equivalentBySearch(classes[i]![0] as Form, classes[j]![0] as Form), `${d}: classes ${i} and ${j}`).toBe(
          false,
        );
      }
    }
    // The cycles partition the reduced forms.
    const total = classes.reduce((sum, cycle) => sum + cycle.length, 0);
    expect(total, `${d}`).toBe(reducedForms(d)!.length);
  }
});

test("the class number is what the partition says, and at least one", () => {
  for (const d of discriminants(200)) {
    const h = classNumber(d)!;
    expect(h, `${d}`).toBeGreaterThanOrEqual(1);
    expect(h, `${d}`).toBe(formClasses(d)!.length);
  }
  // The principal form x² − (D/4)y² (or x² + xy − ((D−1)/4)y²) is always present.
  expect(classNumber(5)).toBe(1);
  expect(classNumber(8)).toBe(1);
  expect(classNumber(12)).toBe(2);
  expect(classNumber(60)).toBe(4);
});

test("Pell's equation, and the automorph it builds", () => {
  // t² − Du² = 4, found by search — nothing here depends on forms at all. A few
  // discriminants (97 is the first) have a fundamental unit far past any search, and those
  // are skipped rather than pretended about.
  let checked = 0;
  for (const d of discriminants(120)) {
    const pell = pellSolution(d);
    if (pell === undefined) continue;
    checked++;
    const { t, u } = pell;
    expect(t * t - d * u * u, `${d}`).toBe(4);
    for (const f of reducedForms(d)!) {
      const m = automorph(f)!;
      expect(determinant(m), `${d}: ${JSON.stringify(f)}`).toBe(1);
      // It stabilises the form — which is the defining property, checked directly.
      expect(actOn(f, m), `${d}: ${JSON.stringify(f)}`).toEqual(f);
      // Its trace is t, so |trace| > 2: the automorph is HYPERBOLIC, and the form's class
      // is a closed geodesic.
      expect(trace(m), `${d}`).toBe(t);
      expect(Math.abs(trace(m)), `${d}`).toBeGreaterThan(2);
    }
  }
  expect(checked).toBeGreaterThan(25);
});

test("an automorph with non-negative entries has an LR word, like any hyperbolic element", () => {
  // The bridge to the rest of the package: the class of forms IS the closed geodesic, so
  // where the automorph lands in the positive cone it spells out as a word in L and R.
  let found = 0;
  for (const d of discriminants(120)) {
    for (const f of reducedForms(d)!) {
      const m = automorph(f);
      if (m === undefined || m.some((x) => x < 0)) continue;
      const word = positiveWord(m);
      expect(word, `${d}: ${JSON.stringify(f)}`).toBeDefined();
      expect(word!.includes("L") && word!.includes("R"), `${d}`).toBe(true);
      found++;
    }
  }
  expect(found).toBeGreaterThan(20); // not a vacuous test
});

test("definite and square discriminants are refused", () => {
  expect(isIndefinite({ a: 1, b: 0, c: 1 })).toBe(false); // D = −4, definite
  expect(isIndefinite({ a: 1, b: 3, c: 2 })).toBe(false); // D = 1, a perfect square
  expect(isIndefinite({ a: 1, b: 1, c: -1 })).toBe(true); // D = 5
  expect(reduceForm({ a: 1, b: 0, c: 1 })).toBeUndefined();
  expect(reducedForms(9)).toBeUndefined(); // a perfect square
  expect(reducedForms(-4)).toBeUndefined();
  expect(classNumber(7)).toBe(0); // 7 ≢ 0, 1 (mod 4), so no form has that discriminant
  expect(form(1.5, 0, 0)).toBeUndefined();
});
