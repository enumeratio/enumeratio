import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  type EvalOptions,
  isFiniteNum,
  numberResult,
  wantsNumber,
  add,
  cexp,
  cpow,
  cx,
  type Cx,
  div,
  mul,
  scale,
  sub,
  logGamma,
} from "@enumeratio/ce-patches";

// HypergeometricUStar(a, b, z) — Fungrim's regularized Tricomi confluent
// hypergeometric function, U*(a, b, z) = z^a U(a, b, z) (fungrim:c8fcc7 is exactly
// this equation). compute-engine 0.128 declares `HypergeometricU` but does not
// evaluate it numerically (probed: `HypergeometricU(1,2,3).N()` stays symbolic), so
// U itself is supplied here via Kummer's connection formula (Abramowitz & Stegun
// 13.1.3, Kummer's M is the pure-series confluent hypergeometric ₁F₁):
//
//   U(a,b,z) = Γ(1−b)/Γ(a−b+1) · M(a,b,z) + Γ(b−1)/Γ(a) · z^{1−b} · M(a−b+1,2−b,z)
//
// M(a,b,z) = Σ_{m≥0} (a)_m/(b)_m · zᵐ/m! is entire and computed directly by its term
// ratio; the connection formula's two Γ(1−b), Γ(b−1) factors blow up at integer b,
// which is the formula's only real limitation (b integer needs a separate log-case
// limit) — declining there rather than returning a formula that divides by a pole.
//
// z^{1−b} and the closing z^a both take the principal branch (`cpow`), matching the
// convention Fungrim's own guards use (`part-cmp z re gt 0` on most of the identities
// that cite this head).

const MAX_TERMS = 400;
const NEAR_INT_EPS = 1e-8;
/** Rounding noise per unit of term magnitude, with room for the Γ factors' own error. */
const UNIT_ROUNDOFF = 4e-15;
/**
 * Worst relative error `tricomiU` answers with. The connection formula's two terms are each
 * ~e^z/|b − n| against a U of order z^(−a), so near an integer b or at a large z they cancel
 * to nothing (measured against mpmath: relative error 1e-6 at b = 1.001, z = 8); past this
 * bound the kernel declines.
 */
const MAX_RELATIVE_ERROR = 1e-12;

interface Summed {
  readonly value: Cx;
  /** Σ|term|, the magnitude the roundoff scales with (cancellation in an alternating series). */
  readonly magnitude: number;
}

/** M(a,b,z), Kummer's confluent hypergeometric ₁F₁ — entire, by direct series. */
function kummerM(a: Cx, b: Cx, z: Cx): Summed {
  let term = cx(1, 0);
  let sum = cx(1, 0);
  let magnitude = 1;
  for (let m = 0; m < MAX_TERMS; m++) {
    // t_{m+1} = t_m · (a+m)(z) / ((b+m)(m+1))
    const num = mul(add(a, cx(m)), z);
    const den = mul(add(b, cx(m)), cx(m + 1));
    term = div(mul(term, num), den);
    sum = add(sum, term);
    magnitude += Math.hypot(term.re, term.im);
    if (Math.hypot(term.re, term.im) < 1e-17 * (1 + Math.hypot(sum.re, sum.im))) break;
  }
  return { value: sum, magnitude };
}

const cGamma = (z: Cx): Cx => cexp(logGamma(z));

/** Is z a non-positive integer — a pole of Γ, and so a zero of 1/Γ? */
const isNonPositiveInt = (z: Cx): boolean => z.im === 0 && z.re <= 0 && Number.isInteger(z.re);

/**
 * 1/Γ(z), entire (zero at the non-positive integers rather than the NaN a naive
 * `1/Γ(z)` gets from `logGamma`'s pole there). `a − b + 1` lands on one of these
 * zeros whenever a and b differ by a non-negative integer, which is not an edge
 * case Fungrim's own identities avoid (e.g. a = ½, b = 3/2 ⇒ a − b + 1 = 0).
 */
const invGamma = (z: Cx): Cx => (isNonPositiveInt(z) ? cx(0) : cexp(scale(logGamma(z), -1)));

const norm = (z: Cx): number => Math.hypot(z.re, z.im);

/** U(a,b,z), Tricomi's confluent hypergeometric — undefined at (near-)integer b, or where the
 * two terms cancel past `MAX_RELATIVE_ERROR`. A real U (real a, b and z > 0) has no imaginary part. */
function tricomiU(a: Cx, b: Cx, z: Cx): Cx | undefined {
  if (b.im === 0 && Math.abs(b.re - Math.round(b.re)) < NEAR_INT_EPS) return undefined;
  const aMinusB1 = add(sub(a, b), cx(1)); // a − b + 1, the second M's first argument
  const coeff1 = mul(cGamma(sub(cx(1), b)), invGamma(aMinusB1));
  const m1 = kummerM(a, b, z);
  const zTo1MinusB = cpow(z, sub(cx(1), b));
  const m2 = kummerM(aMinusB1, sub(cx(2), b), z); // M(a-b+1, 2-b, z)
  const coeff2 = mul(mul(cGamma(sub(b, cx(1))), invGamma(a)), zTo1MinusB);
  const value = add(mul(coeff1, m1.value), mul(coeff2, m2.value));
  const noise = UNIT_ROUNDOFF * (norm(coeff1) * m1.magnitude + norm(coeff2) * m2.magnitude);
  if (!(noise <= MAX_RELATIVE_ERROR * norm(value))) return undefined;
  const real = a.im === 0 && b.im === 0 && z.im === 0 && z.re > 0;
  return real ? cx(value.re, 0) : value;
}

/** U*(a,b,z) = z^a U(a,b,z), Fungrim's `HypergeometricUStar`. */
export function hypergeometricUStar(a: Cx, b: Cx, z: Cx): Cx | undefined {
  const u = tricomiU(a, b, z);
  if (u === undefined) return undefined;
  return mul(cpow(z, a), u);
}

const toCx = (x: BoxedExpression): Cx => cx(x.re, x.im);

export function declareHypergeometricUStar(ce: ComputeEngine): void {
  ce.declare("HypergeometricUStar", {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [a, b, z] = ops;
      if (a === undefined || b === undefined || z === undefined) return undefined;
      if (!isFiniteNum(a) || !isFiniteNum(b) || !isFiniteNum(z)) return undefined;
      if (z.re === 0 && z.im === 0) return undefined; // pole/branch point, Fungrim guards z ≠ 0
      if (!wantsNumber(ops, options)) return undefined;
      const r = hypergeometricUStar(toCx(a), toCx(b), toCx(z));
      if (r === undefined) return undefined;
      return numberResult(ce, r);
    },
  });
}

// HypergeometricU(a, b, z) — Tricomi's confluent hypergeometric itself, U*'s z^{-a} factor
// undone. compute-engine 0.128 references the head only inside `identities.ts` (the rewrite
// rule fungrim:c8fcc7 that relates it to `HypergeometricUStar`) but never actually declares it
// as an operator — `ce.lookupDefinition("HypergeometricU")` is `undefined`, so there is nothing
// to widen with `wrapOperator`; it is declared outright here, the same way `HypergeometricUStar`
// above is, reusing `tricomiU` directly rather than dividing `HypergeometricUStar` by z^a (which
// would reintroduce the branch-cut/pole bookkeeping `tricomiU` already does correctly).
export function declareHypergeometricU(ce: ComputeEngine): void {
  ce.declare("HypergeometricU", {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [a, b, z] = ops;
      if (a === undefined || b === undefined || z === undefined) return undefined;
      if (!isFiniteNum(a) || !isFiniteNum(b) || !isFiniteNum(z)) return undefined;
      if (z.re === 0 && z.im === 0) return undefined; // pole/branch point
      if (!wantsNumber(ops, options)) return undefined;
      const r = tricomiU(toCx(a), toCx(b), toCx(z));
      if (r === undefined) return undefined;
      return numberResult(ce, r);
    },
  });
}
