import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { abs, cx, mul, sub } from "./complex.ts";
import { type EvalOptions, isFiniteNum, isRealInt, numberResult, wantsNumber } from "./box.ts";

// The q-series heads: QPochhammer(a, q, n), QFactorial(n, q), QBinomial(n, k, q).
// Wolfram names all three; compute-engine has none of them (`ce.lookupDefinition`
// returns undefined for each — checked before writing this).
//
// Every finite case is built from exact boxed arithmetic (Add/Multiply/Power/Subtract),
// never floating point, so an exact rational a/q/coefficient stays exact and a symbolic
// q gives back a genuine polynomial that `Expand` can open up. QBinomial in particular
// uses the Gaussian-binomial Pascal recurrence
//   C(n,k)_q = C(n-1,k-1)_q + q^k C(n-1,k)_q,   C(n,0)_q = C(n,n)_q = 1,
// rather than [n]_q! / ([k]_q! [n-k]_q!): that quotient is exact numerically, but for
// symbolic q it's a division `Expand` alone won't cancel down to a polynomial. The
// recurrence only ever adds and multiplies, so it never needs to.
//
// Only the infinite q-Pochhammer product (n = PositiveInfinity) forces a numeric
// limit — it has no exact closed form in general, so it's numeric-only and requires
// |q| < 1 for convergence.

/** [k]_q = 1 + q + ... + q^(k-1), k ≥ 1. */
function qInteger(ce: ComputeEngine, k: number, q: BoxedExpression): BoxedExpression {
  const terms: BoxedExpression[] = [ce.One];
  for (let j = 1; j < k; j++) terms.push(ce.function("Power", [q, ce.number(j)]));
  return terms.length === 1 ? terms[0] : ce.function("Add", terms).evaluate();
}

/** [n]_q! = product_{k=1}^n [k]_q, n ≥ 0 (empty product at n = 0). */
function qFactorialExpr(ce: ComputeEngine, n: number, q: BoxedExpression): BoxedExpression {
  let r: BoxedExpression = ce.One;
  for (let k = 1; k <= n; k++) r = ce.function("Multiply", [r, qInteger(ce, k, q)]).evaluate();
  return r;
}

/** The Gaussian binomial, via the Pascal-like recurrence described above. */
function qBinomialExpr(ce: ComputeEngine, n: number, k: number, q: BoxedExpression): BoxedExpression {
  if (k < 0 || k > n) return ce.Zero;
  let row: BoxedExpression[] = [ce.One];
  for (let i = 1; i <= n; i++) {
    const next: BoxedExpression[] = [ce.One];
    for (let j = 1; j < i; j++) {
      const term2 = ce.function("Multiply", [ce.function("Power", [q, ce.number(j)]), row[j]]).evaluate();
      next.push(ce.function("Add", [row[j - 1], term2]).evaluate());
    }
    next.push(ce.One);
    row = next;
  }
  return row[k];
}

/** (a; q)_n = product_{k=0}^{n-1} (1 - a q^k), n ≥ 0 (empty product at n = 0). */
function qPochhammerFinite(ce: ComputeEngine, a: BoxedExpression, q: BoxedExpression, n: number): BoxedExpression {
  let r: BoxedExpression = ce.One;
  for (let k = 0; k < n; k++) {
    const qPowK = k === 0 ? ce.One : ce.function("Power", [q, ce.number(k)]);
    const term = ce.function("Subtract", [ce.One, ce.function("Multiply", [a, qPowK]).evaluate()]);
    r = ce.function("Multiply", [r, term]).evaluate();
  }
  return r;
}

/** The infinite q-Pochhammer product, |q| < 1: (a; q)_∞ = lim_{n→∞} (a; q)_n. */
function qPochhammerInfinite(
  a: { re: number; im: number },
  q: { re: number; im: number },
): {
  re: number;
  im: number;
} {
  let r = cx(1, 0);
  let qk = cx(1, 0);
  // The terms shrink geometrically once |q| < 1, so a fixed cap comfortably reaches
  // double-precision convergence without needing a tolerance tied to |a|.
  for (let k = 0; k < 100_000; k++) {
    r = mul(r, sub(cx(1, 0), mul(a, qk)));
    qk = mul(qk, q);
    if (abs(qk) < 1e-17) break;
  }
  return r;
}

export function declareQSeries(ce: ComputeEngine): void {
  // QPochhammer has no Expand example in the backlog, so a plain `evaluate` handler
  // is enough — unlike QFactorial/QBinomial below. (compute-engine's `declare` only
  // attaches one of `canonical` or `evaluate` per head; supplying both silently
  // drops `evaluate`, confirmed by inspecting `operatorDefinition.evaluate` — so
  // the finite and infinite cases share this one hook rather than splitting.)
  ce.declare("QPochhammer", {
    signature: "(complex, complex, integer | infinity) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const a = ops[0];
      const q = ops[1];
      const n = ops[2];
      if (a === undefined || q === undefined || n === undefined) return undefined;
      if (isRealInt(n) && n.re >= 0) return qPochhammerFinite(ce, a, q, n.re);
      // The infinite product: numeric-only, and only where it converges (|q| < 1).
      if (n.isInfinity && n.re > 0) {
        if (!wantsNumber(ops, options) || !isFiniteNum(a) || !isFiniteNum(q)) return undefined;
        if (Math.hypot(q.re, q.im) >= 1) return undefined; // diverges; stay symbolic
        return numberResult(ce, qPochhammerInfinite({ re: a.re, im: a.im }, { re: q.re, im: q.im }));
      }
      return undefined; // negative or symbolic n: not implemented, stays symbolic
    },
  });

  // QFactorial and QBinomial use `canonical` instead: it runs at box time regardless
  // of what wraps the call, so `Expand(QFactorial(3, q))` sees the Multiply-of-Adds
  // tree to expand. An `evaluate`-only handler never fires there — `Expand` reads its
  // operand's canonical form without forcing `.evaluate()` on it first, so a custom
  // head with only `evaluate` would come back opaque (confirmed: adding `evaluate`
  // alongside `canonical` here is a no-op, see the QPochhammer comment above).
  ce.declare("QFactorial", {
    signature: "(integer, complex) -> number",
    canonical: (ops: readonly BoxedExpression[]) => {
      const n = ops[0];
      const q = ops[1];
      if (n === undefined || q === undefined || !isRealInt(n) || n.re < 0) return null;
      return qFactorialExpr(ce, n.re, q);
    },
  });

  ce.declare("QBinomial", {
    signature: "(integer, integer, complex) -> number",
    canonical: (ops: readonly BoxedExpression[]) => {
      const n = ops[0];
      const k = ops[1];
      const q = ops[2];
      if (n === undefined || k === undefined || q === undefined) return null;
      if (!isRealInt(n) || n.re < 0 || !isRealInt(k)) return null;
      return qBinomialExpr(ce, n.re, k.re, q);
    },
  });
}
