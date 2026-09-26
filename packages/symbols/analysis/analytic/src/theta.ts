import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { abs, add, ccos, cpow, csin, cx, type Cx, mul, scale } from "./complex.ts";

// EllipticTheta(a, u, q) and EllipticThetaPrime(a, u, q) — the four Jacobi theta
// functions (a = 1..4) and their u-derivatives, Wolfram's nome convention |q| < 1
// (matches mpmath.jtheta(n, z, q), DLMF 20.2). Direct q-series (DLMF 20.2.1-20.2.4 and
// their termwise u-derivatives), each verified against mpmath.jtheta at complex u,
// complex q, AND real negative q (`(-0.3)^{n²}`/`(-0.3)^{(n+1/2)²}` via `cpow`'s principal
// branch — negative q is a single real number for every INTEGER exponent, and matches
// mpmath there to machine precision; the half-integer exponents of θ1/θ2 pass through the
// same principal branch and also verified, so no separate case is needed for either).
//
// Convergence: term magnitude is `|q|^{n²}` (or `|q|^{(n+1/2)²}`) times a factor that
// grows at most like `cosh(n·Im(u))` — single-exponential in n against the series'
// double-exponential decay, so the tail always wins eventually; declared converged once
// three consecutive terms fall under `TOL`, declined (not "0") if that never happens
// inside `MAX_ITERS` (only reachable for |q| within a whisker of 1 — see `declineNome`).

const TOL = 1e-15;
const MAX_ITERS = 20_000;

/** |q| ≥ 1 is refused outright (the series does not converge there at all); values of
 * |q| close enough to 1 that `MAX_ITERS` terms can't reach `TOL` decline too, rather than
 * silently returning a truncated sum. No modular (Jacobi imaginary) transform is
 * implemented to extend this further — see the file header. */
function declineNome(q: Cx): boolean {
  return abs(q) >= 1;
}

interface Series {
  sum: Cx;
  converged: boolean;
}

/** Runs `term(n)` for n = start, start+1, ... into a running sum, stopping once three
 * consecutive terms are below `TOL` (converged) or `MAX_ITERS` is reached (declined). */
function sumSeries(start: number, term: (n: number) => Cx): Series {
  let sum = cx(0);
  let smallStreak = 0;
  for (let n = start; n < start + MAX_ITERS; n++) {
    const t = term(n);
    sum = add(sum, t);
    if (abs(t) < TOL) {
      smallStreak++;
      if (smallStreak >= 3) return { sum, converged: true };
    } else {
      smallStreak = 0;
    }
  }
  return { sum, converged: false };
}

/** q^e for a real exponent e (always real here — n² or (n+½)²), principal branch. */
const qPow = (q: Cx, e: number): Cx => cpow(q, cx(e));

/**
 * θ_a(u,q) or its u-derivative θ_a'(u,q), a = 1..4 (DLMF 20.2.1-20.2.4, differentiated
 * termwise for the prime case — see the file header for the verification this rests on).
 * `undefined` when `declineNome` refuses q, or the series doesn't converge in
 * `MAX_ITERS` terms.
 */
function theta(a: 1 | 2 | 3 | 4, u: Cx, q: Cx, derivative: boolean): Cx | undefined {
  if (declineNome(q)) return undefined;

  if (a === 1 || a === 2) {
    const { sum, converged } = sumSeries(0, (n) => {
      const qn = qPow(q, (n + 0.5) ** 2);
      const angle = 2 * n + 1;
      const trigArg = scale(u, angle);
      if (a === 1) {
        const sign = n % 2 === 0 ? 1 : -1;
        return derivative ? scale(mul(qn, ccos(trigArg)), sign * angle) : scale(mul(qn, csin(trigArg)), sign);
      }
      return derivative ? scale(mul(qn, csin(trigArg)), -angle) : mul(qn, ccos(trigArg));
    });
    return converged ? scale(sum, 2) : undefined;
  }

  // a === 3 || a === 4
  const constant = derivative ? cx(0) : cx(1);
  const { sum, converged } = sumSeries(1, (n) => {
    const qn = qPow(q, n * n);
    const angle = 2 * n;
    const trigArg = scale(u, angle);
    const sign = a === 4 && n % 2 === 1 ? -1 : 1;
    if (derivative) return scale(mul(qn, csin(trigArg)), -2 * sign * angle);
    return scale(mul(qn, ccos(trigArg)), 2 * sign);
  });
  return converged ? add(constant, sum) : undefined;
}

// --- compute-engine declarations -----------------------------------------------------

const cxOf = (x: BoxedExpression): Cx => cx(x.re, x.im);

const isValidOrder = (a: BoxedExpression): a is BoxedExpression & { re: 1 | 2 | 3 | 4 } =>
  a.im === 0 && Number.isInteger(a.re) && a.re >= 1 && a.re <= 4;

function declareOne(ce: ComputeEngine, head: string, derivative: boolean): void {
  ce.declare(head, {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [a, u, q] = ops;
      if (a === undefined || u === undefined || q === undefined) return undefined;
      if (!wantsNumber(ops, options) || !isFiniteNum(a) || !isFiniteNum(u) || !isFiniteNum(q)) return undefined;
      if (!isValidOrder(a)) return undefined; // a must be a concrete integer 1..4
      const result = theta(a.re as 1 | 2 | 3 | 4, cxOf(u), cxOf(q), derivative);
      return result === undefined ? undefined : numberResult(ce, result);
    },
  });
}

export function declareEllipticTheta(ce: ComputeEngine): void {
  if (ce.lookupDefinition("EllipticTheta") !== undefined) return; // never redeclare
  declareOne(ce, "EllipticTheta", false);
  declareOne(ce, "EllipticThetaPrime", true);
}
