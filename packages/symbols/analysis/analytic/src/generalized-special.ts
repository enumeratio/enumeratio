import { type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import { bigRationalAt, operandsOf, widenSignature, wrapOperator } from "@enumeratio/boxed";
import { declined, type EvalOptions, isRealInt, type NativeEval } from "./box.ts";

type Q = readonly [bigint, bigint];
const gcdBig = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcdBig(b, a % b));
const mkQ = (p: bigint, q: bigint): Q => {
  if (q < 0n) {
    p = -p;
    q = -q;
  }
  const g = gcdBig(p, q) || 1n;
  return [p / g, q / g];
};
const addQ = (a: Q, b: Q): Q => mkQ(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const mulQ = (a: Q, b: Q): Q => mkQ(a[0] * b[0], a[1] * b[1]);
const powQ = (a: Q, n: bigint): Q => {
  let r: Q = [1n, 1n];
  for (let i = 0n; i < n; i++) r = mulQ(r, a);
  return r;
};
const binom = (n: bigint, k: bigint): bigint => {
  if (k < 0n || k > n) return 0n;
  let r = 1n;
  for (let i = 0n; i < k; i++) r = (r * (n - i)) / (i + 1n);
  return r;
};

/**
 * The incomplete beta B_z(a, b) = Σ_{j=0}^{b-1} C(b-1,j)(-1)^j z^{a+j}/(a+j), exact for a
 * rational z and non-negative integers a, b — the binomial expansion of (1-t)^{b-1}
 * integrated term by term, valid because every exponent a+j is then itself an integer.
 * Matches `wolframscript`'s `Beta[1/2, 2, 3] = 11/192` and `Beta[1/4, 1/2, 2, 3] = 109/3072`.
 */
function incompleteBetaExact(z: Q, a: bigint, b: bigint): Q | undefined {
  if (a < 0n || b < 1n) return undefined;
  let sum: Q = [0n, 1n];
  for (let j = 0n; j < b; j++) {
    const c = binom(b - 1n, j) * (j % 2n === 0n ? 1n : -1n);
    sum = addQ(sum, mulQ(mkQ(c, a + j), powQ(z, a + j)));
  }
  return sum;
}

// New call forms and structural identities for heads whose numeric kernels already exist
// elsewhere in this package: the incomplete/generalized Beta and BetaRegularized, the
// generalized Erf/ErfInv, one-argument PolyGamma, and the three-argument Nielsen PolyLog.
// Each is either a difference of two calls the head already answers, a direct algebraic
// identity, or (Nielsen PolyLog) a small numeric kernel of its own. Registered by
// `declareAnalytic` in hurwitz-zeta.ts.

const finish = (expr: BoxedExpression, options: EvalOptions): BoxedExpression =>
  options.numericApproximation ? expr.N() : expr.evaluate();

/** Does `r`'s JSON still mention `head`? (same test `incomplete-gamma.ts` uses for Gamma.) */
const stillMentions = (r: BoxedExpression, head: string): boolean =>
  JSON.stringify(r.json).includes(`"${head}"`);

// --- Beta: complete (a, b), incomplete (z, a, b) and generalized incomplete (z0, z1, a, b) ---

/**
 * `Beta` widened from Wolfram's `Beta[a, b]` to also cover `Beta[z, a, b]` (the incomplete
 * beta function, an integral from 0 to z) and `Beta[z0, z1, a, b]` (the generalized
 * incomplete beta, `Beta[z1,a,b] - Beta[z0,a,b]`) — plus `B(a, 1) = 1/a`, the one exact
 * reduction the plain two-argument case is missing. The three- and four-argument forms
 * are expressed through `BetaRegularized`, which compute-engine already evaluates
 * numerically for the three-argument call: `B_z(a,b) = I_z(a,b)·B(a,b)`.
 */
export function declareGeneralizedBeta(ce: ComputeEngine): void {
  const nativeBeta: NativeEval = ce.box(["Beta", 2, 3]).operatorDefinition?.evaluate;
  ce.declare("Beta", {
    signature: "(number, number, number?, number?) -> number",
    broadcastable: true, // preserve native threading over a list of a (or b)
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      if (ops.length === 2) {
        const r = nativeBeta?.(ops, options);
        if (!declined(r, "Beta")) return r;
        const [a, b] = ops;
        // B(a, 1) = Γ(a)Γ(1)/Γ(a+1) = 1/a, exact for any a (including symbolic).
        if (isRealInt(b) && b.re === 1) return finish(ce.function("Divide", [ce.One, a]), options);
        // B(a, n) = (n−1)!/(a(a+1)⋯(a+n−1)) at a small positive integer n, either side.
        const small = (x: BoxedExpression) => isRealInt(x) && x.re >= 2 && x.re <= 10;
        const [x, n] =
          small(b) && !isNumber(a) ? [a, b.re] : small(a) && !isNumber(b) ? [b, a.re] : [];
        if (x !== undefined && n !== undefined) {
          const factors = Array.from({ length: n }, (_, k) =>
            k === 0 ? x : ce.function("Add", [x, ce.number(k)]),
          );
          let factorial = 1;
          for (let k = 2; k < n; k++) factorial *= k;
          return finish(
            ce.function("Divide", [ce.number(factorial), ce.function("Multiply", factors)]),
            options,
          );
        }
        return r;
      }
      if (ops.length === 3) {
        const [z, a, b] = ops;
        const zq = bigRationalAt(z);
        const aq = bigRationalAt(a);
        const bq = bigRationalAt(b);
        if (
          zq !== undefined &&
          aq !== undefined &&
          bq !== undefined &&
          aq[1] === 1n &&
          bq[1] === 1n
        ) {
          const exact = incompleteBetaExact(zq, aq[0], bq[0]);
          if (exact !== undefined) return finish(ce.number([exact[0], exact[1]]), options);
        }
        const expr = ce.function("Multiply", [
          ce.function("BetaRegularized", [z, a, b]),
          ce.function("Beta", [a, b]),
        ]);
        const r = finish(expr, options);
        return stillMentions(r, "BetaRegularized") ? undefined : r;
      }
      if (ops.length === 4) {
        const [z0, z1, a, b] = ops;
        const expr = ce.function("Subtract", [
          ce.function("Beta", [z1, a, b]),
          ce.function("Beta", [z0, a, b]),
        ]);
        const r = finish(expr, options);
        return stillMentions(r, "Beta") ? undefined : r;
      }
      return undefined;
    },
  });
}

/**
 * `BetaRegularized` widened from Wolfram's three-argument `I_x(a, b)` to the four-argument
 * generalized form `I_{z1}(a,b) - I_{z0}(a,b)`, a plain difference of two calls the native
 * three-argument handler already answers.
 */
export function declareGeneralizedBetaRegularized(ce: ComputeEngine): void {
  widenSignature(ce, "BetaRegularized", "(number, number, number, number?) -> number");
  wrapOperator(
    ce,
    ["BetaRegularized", 0.2, 0.5, 2, 3],
    () => true,
    () => (ops, options) => {
      const [z0, z1, a, b] = ops;
      const expr = ce.function("Subtract", [
        ce.function("BetaRegularized", [z1, a, b]),
        ce.function("BetaRegularized", [z0, a, b]),
      ]);
      return finish(expr, options);
    },
    4,
  );
}

// --- Erf / ErfInv: generalized two-argument forms and symbolic identities ---

/**
 * `Erf` widened to Wolfram's two-argument `Erf[z0, z1] = erf(z1) - erf(z0)`, plus the odd
 * parity `Erf(-x) = -Erf(x)` and the inverse-composition `Erf(ErfInv(x)) = x`, both applied
 * symbolically (compute-engine's own `N(Erf(-x))` already takes this value; nothing here
 * changes a concrete answer, only fills in what the symbolic evaluator leaves standing).
 */
export function declareGeneralizedErf(ce: ComputeEngine): void {
  const nativeErf: NativeEval = ce.box(["Erf", 1]).operatorDefinition?.evaluate;
  ce.declare("Erf", {
    signature: "(number, number?) -> number",
    broadcastable: true, // Erf([0, 1]) still threads, like the native declaration
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      if (ops.length === 2) {
        const [z0, z1] = ops;
        const expr = ce.function("Subtract", [ce.function("Erf", [z1]), ce.function("Erf", [z0])]);
        return finish(expr, options);
      }
      const [x] = ops;
      if (x === undefined) return undefined;
      if (x.operator === "Negate") {
        const inner = operandsOf(x)[0];
        if (inner !== undefined) {
          return finish(ce.function("Negate", [ce.function("Erf", [inner])]), options);
        }
      }
      if (x.operator === "ErfInv") return operandsOf(x)[0];
      return nativeErf?.(ops, options);
    },
  });
}

/**
 * `ErfInv` widened to the two-argument `ErfInv(z0, z)`, which solves `z = erf(x) - erf(z0)`
 * for x — i.e. `ErfInv(z0, z) = ErfInv(z + Erf(z0))`, exactly the one-argument inverse at a
 * shifted target, plus the odd parity `ErfInv(-x) = -ErfInv(x)`.
 */
export function declareGeneralizedErfInv(ce: ComputeEngine): void {
  const nativeErfInv: NativeEval = ce.box(["ErfInv", 0.5]).operatorDefinition?.evaluate;
  ce.declare("ErfInv", {
    signature: "(number, number?) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      if (ops.length === 2) {
        const [z0, z] = ops;
        const expr = ce.function("ErfInv", [ce.function("Add", [z, ce.function("Erf", [z0])])]);
        return finish(expr, options);
      }
      const [x] = ops;
      if (x === undefined) return undefined;
      if (x.operator === "Negate") {
        const inner = operandsOf(x)[0];
        if (inner !== undefined) {
          return finish(ce.function("Negate", [ce.function("ErfInv", [inner])]), options);
        }
      }
      return nativeErfInv?.(ops, options);
    },
  });
}

// --- PolyGamma(z): the one-argument digamma call form ---

/**
 * `PolyGamma` widened to accept one argument, Wolfram's `PolyGamma[z]` — the digamma,
 * i.e. `PolyGamma(0, z)`. `hurwitz-zeta.ts` already declares the two-argument form
 * (native for real z at any integer order, and complex z via `evaluatePolygamma`); this
 * just inserts the implied order 0 ahead of it.
 */
export function declareOneArgumentPolyGamma(ce: ComputeEngine): void {
  widenSignature(ce, "PolyGamma", "(number, number?) -> number");
  wrapOperator(
    ce,
    ["PolyGamma", 1, 1],
    () => true,
    (native) => (ops, options) => {
      const z = ops[0];
      // Digamma carries the exact-integer closed form (widened.ts) and evaluates real z
      // natively; try it first and only fall back to the two-argument PolyGamma(0, z) path
      // (which adds complex z via `evaluatePolygamma`) when it too stays symbolic.
      const viaDigamma = finish(ce.function("Digamma", [z]), options);
      if (viaDigamma.operator !== "Digamma") return viaDigamma;
      return native?.([ce.Zero, z], options);
    },
    1,
  );
}

// --- PolyLog(n, p, z): the Nielsen generalized polylogarithm ---

/**
 * Nielsen's generalized polylogarithm S_{n,p}(z), Wolfram's three-argument
 * `PolyLog[n, p, z]`. Two general identities are exact for any z:
 *  - S_{n,1}(z) = Li_{n+1}(z) (p = 1 collapses straight to the classical polylog).
 *  - S_{1,p}(1) = ζ(p+1) (Lewin, *Polylogarithms and Associated Functions*, 6.2).
 * `S_{2,2}(1) = π⁴/360` is a single low-weight Euler-sum value (ζ(3,1) = π⁴/360) with no
 * general elementary form at this weight, so it is pinned as its own case rather than
 * derived. Anything else numeric goes through the defining integral,
 * `S_{n,p}(z) = (-1)^{n+p-1}/((n-1)!p!) ∫₀¹ ln(t)^{n-1}ln(1-zt)^p/t dt` (checked against
 * `NIntegrate` at several (n, p, z)), by tanh-sinh quadrature — robust across the
 * integrable log singularities at both endpoints.
 */
function factorial(n: number): number {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

/** Tanh-sinh (double-exponential) quadrature for ∫₀¹ f(t) dt, `f` possibly singular
 * (integrably) at either endpoint. Doubles the sample density each level until the
 * estimate settles, which is what makes it work on the log singularities here without
 * a bespoke substitution per case. */
function tanhSinhUnitInterval(f: (t: number) => number): number {
  const HALF_PI = Math.PI / 2;
  let h = 1;
  let prev = Number.NaN;
  let result = 0;
  for (let level = 0; level < 12; level++, h /= 2) {
    let sum = level === 0 ? 0 : 0;
    // Re-sum from scratch at each level (the point sets are not nested for tanh-sinh with
    // this parameterization) — the integrands here are cheap, and level count is capped.
    const maxK = Math.ceil(4.5 / h); // sinh grows fast; x = k·h stays inside double range
    for (let k = -maxK; k <= maxK; k++) {
      const x = k * h;
      const s = Math.sinh(x);
      const c = Math.cosh(x);
      const ec = Math.cosh(HALF_PI * s);
      const t = 0.5 * (1 + Math.tanh(HALF_PI * s));
      // weight = 0.5·(π/2)·cosh(x) / cosh²((π/2)sinh(x))
      const w = (0.5 * HALF_PI * c) / (ec * ec);
      if (!Number.isFinite(w) || w === 0) continue;
      if (t <= 0 || t >= 1) continue; // endpoint itself: f is (integrably) singular there
      const fv = f(t);
      if (Number.isFinite(fv)) sum += w * fv;
    }
    result = sum * h;
    if (Number.isFinite(prev) && Math.abs(result - prev) <= 1e-14 * Math.max(1, Math.abs(result))) {
      return result;
    }
    prev = result;
  }
  return result;
}

/** S_{n,p}(z) for positive integers n, p and real z ≤ 1, by the defining integral. */
function nielsenNumeric(n: number, p: number, z: number): number {
  const sign = (n + p - 1) % 2 === 0 ? 1 : -1;
  const norm = sign / (factorial(n - 1) * factorial(p));
  const integrand = (t: number): number => {
    const logT = n === 1 ? 0 : Math.log(t);
    const inner = 1 - z * t;
    if (inner <= 0) return 0; // outside the branch this kernel supports; not reached by our examples
    const logInner = Math.log(inner);
    return (Math.pow(logT, n - 1) * Math.pow(logInner, p)) / t;
  };
  return norm * tanhSinhUnitInterval(integrand);
}

export function declareNielsenPolyLog(ce: ComputeEngine): void {
  widenSignature(ce, "PolyLog", "(number, number, number?) -> number");
  wrapOperator(
    ce,
    ["PolyLog", 1, 2, 1],
    () => true,
    () => (ops, options) => {
      const [n, p, z] = ops;
      if (!isRealInt(n) || !isRealInt(p) || n.re < 1 || p.re < 1) return undefined;
      // S_{n,1}(z) = Li_{n+1}(z), for any z.
      if (p.re === 1) {
        const expr = ce.function("PolyLog", [ce.number(n.re + 1), z]);
        return finish(expr, options);
      }
      // S_{1,p}(1) = ζ(p+1).
      if (n.re === 1 && z.re === 1 && z.im === 0) {
        return finish(ce.function("Zeta", [ce.number(p.re + 1)]), options);
      }
      // S_{2,2}(1) = π⁴/360 (ζ(3,1), a single low-weight Euler sum).
      if (n.re === 2 && p.re === 2 && z.re === 1 && z.im === 0) {
        const expr = ce.function("Multiply", [
          ce.number([1, 360]),
          ce.function("Power", [ce.Pi, ce.number(4)]),
        ]);
        return finish(expr, options);
      }
      if (z.im !== 0 || !Number.isFinite(z.re) || z.re > 1) return undefined;
      return ce.number(nielsenNumeric(n.re, p.re, z.re));
    },
    3,
  );
}

export function declareGeneralizedSpecial(ce: ComputeEngine): void {
  declareGeneralizedBeta(ce);
  declareGeneralizedBetaRegularized(ce);
  declareGeneralizedErf(ce);
  declareGeneralizedErfInv(ce);
  declareOneArgumentPolyGamma(ce);
  declareNielsenPolyLog(ce);
}
