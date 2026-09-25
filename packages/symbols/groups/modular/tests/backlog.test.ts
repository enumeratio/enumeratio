import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareModular } from "../src/declare.ts";

const ce = new ComputeEngine();
declareModular(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const value = (input: Expr) => ce.box(input).evaluate().json;

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

// ── wrapOperator arity guards ────────────────────────────────────────────────
// `wrapOperator`'s `applies` sees every call to the widened native head, whatever its
// arity — a short or empty operand list must not read past the end of `ops` and throw.

test("MatrixPower and Inverse widened for ModularMatrix don't crash below their arity", () => {
  expect(() => ce.box(["MatrixPower"]).evaluate()).not.toThrow();
  expect(() => ce.box(["MatrixPower", ["ModularMatrix", 1, 1, 0, 1]]).evaluate()).not.toThrow();
  expect(() => ce.box(["Inverse"]).evaluate()).not.toThrow();
});
