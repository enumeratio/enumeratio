import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareModular } from "../src/declare.ts";

const ce = new ComputeEngine();
declareModular(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const value = (input: Expr) => ce.box(input).evaluate().json;
const same = (input: Expr, expected: Expr) => expect(value(input)).toEqual(value(expected));
const L = (...xs: Expr[]): Expr => ["List", ...xs];
const R = (n: number, d: number): Expr => ["Rational", n, d];

// ── ContinuedFractionK ───────────────────────────────────────────────────────

test("ContinuedFractionK: a finite fraction, the backlog example", () => {
  same(["ContinuedFractionK", 1, "k", ["Tuple", "k", 1, 5]], R(157, 225));
});

test("ContinuedFractionK: the infinite all-ones fraction is 1/phi", () => {
  same(
    ["ContinuedFractionK", 1, 1, ["Tuple", "k", 1, "PositiveInfinity"]],
    ["Divide", ["Subtract", ["Sqrt", 5], 1], 2],
  );
});

/** An independent from-scratch evaluator for a FINITE f/g continued fraction over integers. */
function kIndependent(f: (i: number) => number, g: (i: number) => number, lo: number, hi: number) {
  let num = f(hi);
  let den = g(hi);
  for (let i = hi - 1; i >= lo; i--) {
    // f(i) / (g(i) + num/den) = f(i)*den / (g(i)*den + num)
    const newNum = f(i) * den;
    const newDen = g(i) * den + num;
    num = newNum;
    den = newDen;
  }
  return [num, den] as const;
}

test("ContinuedFractionK cross-checked against an independent right-to-left evaluator", () => {
  const [num, den] = kIndependent(
    () => 1,
    (k) => k,
    1,
    5,
  );
  // The evaluated result is a Rational(num, den); read it back out and cross-multiply.
  const json = value(["ContinuedFractionK", 1, "k", ["Tuple", "k", 1, 5]]);
  const [rp, rq] = Array.isArray(json) && json[0] === "Rational" ? [json[1], json[2]] : [json, 1];
  expect((rp as number) * den).toBe(num * (rq as number));
});

// ── Convergents ──────────────────────────────────────────────────────────────

test("Convergents: from a list of terms", () => {
  same(["Convergents", L(3, 7, 15, 1)], L(3, R(22, 7), R(333, 106), R(355, 113)));
});

test("Convergents: the first five convergents of Pi", () => {
  same(["Convergents", "Pi", 5], L(3, R(22, 7), R(333, 106), R(355, 113), R(103993, 33102)));
});

test("Convergents: a rational — the last convergent is the number itself", () => {
  same(["Convergents", R(47, 17)], L(2, 3, R(11, 4), R(47, 17)));
});

test("Convergents: Sqrt(2), whose convergents solve Pell's equation", () => {
  same(["Convergents", ["Sqrt", 2], 5], L(1, R(3, 2), R(7, 5), R(17, 12), R(41, 29)));
});

/** The standard two-term convergent recurrence, reimplemented independently. */
function convergentsIndependent(terms: readonly number[]): (readonly [number, number])[] {
  let [pPrev2, pPrev1] = [0, 1];
  let [qPrev2, qPrev1] = [1, 0];
  const out: (readonly [number, number])[] = [];
  for (const a of terms) {
    const p = a * pPrev1 + pPrev2;
    const q = a * qPrev1 + qPrev2;
    out.push([p, q]);
    [pPrev2, pPrev1] = [pPrev1, p];
    [qPrev2, qPrev1] = [qPrev1, q];
  }
  return out;
}

test("Convergents cross-checked against the recurrence, for several term lists", () => {
  for (const terms of [
    [3, 7, 15, 1],
    [2, 1, 3, 4],
    [1, 2, 2, 2, 2],
  ]) {
    const expected = convergentsIndependent(terms);
    const got = value(["Convergents", ["List", ...terms]]) as unknown as readonly unknown[];
    const flat = (Array.isArray(got) ? got.slice(1) : []).map((c: unknown) =>
      Array.isArray(c) && c[0] === "Rational" ? ([c[1], c[2]] as const) : ([c, 1] as const),
    );
    expect(flat, JSON.stringify(terms)).toEqual(expected);
  }
});

// ── IsQuadraticIrrational ────────────────────────────────────────────────────

test("IsQuadraticIrrational: the backlog examples", () => {
  same(["IsQuadraticIrrational", ["Sqrt", 2]], "True");
  same(["IsQuadraticIrrational", ["Divide", ["Add", 1, ["Sqrt", 5]], 2]], "True");
  same(["IsQuadraticIrrational", ["Power", 2, R(1, 3)]], "False");
  same(["IsQuadraticIrrational", R(3, 4)], "False");
  same(["IsQuadraticIrrational", "Pi"], "False");
});

test("IsQuadraticIrrational: scope — more surd shapes", () => {
  same(["IsQuadraticIrrational", ["Sqrt", 4]], "False"); // rational once simplified
  same(["IsQuadraticIrrational", 5], "False");
  same(["IsQuadraticIrrational", ["Multiply", 3, ["Sqrt", 2]]], "True");
  same(["IsQuadraticIrrational", ["Subtract", 1, ["Sqrt", 3]]], "True");
});

// ── wrapOperator arity guards ────────────────────────────────────────────────
// `wrapOperator`'s `applies` sees every call to the widened native head, whatever its
// arity — a short or empty operand list must not read past the end of `ops` and throw.

test("MatrixPower and Inverse widened for ModularMatrix don't crash below their arity", () => {
  expect(() => ce.box(["MatrixPower"]).evaluate()).not.toThrow();
  expect(() => ce.box(["MatrixPower", ["ModularMatrix", 1, 1, 0, 1]]).evaluate()).not.toThrow();
  expect(() => ce.box(["Inverse"]).evaluate()).not.toThrow();
});
