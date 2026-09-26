import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// MellinTransform(f, x, s) = ∫_0^∞ f(x) x^(s-1) dx and InverseMellinTransform(F, s, x): a
// rule table over nine standard pairs (Wolfram's own reference examples), plus the two
// theorems that generalize each of them: the scaling rule (an argument x -> a*x, a > 0,
// scales the transform by a^(-s)) and the power-shift rule (a factor x^c shifts s -> s+c).
// Every base formula and every strip of convergence below is confirmed against
// `wolframscript` directly (`MellinTransform[..., GenerateConditions -> True]`), not derived.
//
// Base table (f(x) -> F(s), strip):
//   e^(-x)        -> Gamma(s)                        Re(s) > 0
//   e^(-x^2)      -> Gamma(s/2)/2                     Re(s) > 0
//   1/(1+x)       -> Pi*Csc(Pi*s)                     0 < Re(s) < 1
//   1/(1+x)^A     -> Gamma(A-s)*Gamma(s)/Gamma(A)      0 < Re(s) < Re(A)
//   sin(x)        -> Gamma(s)*Sin(Pi*s/2)             -1 < Re(s) < 1
//   cos(x)        -> Gamma(s)*Cos(Pi*s/2)              0 < Re(s) < 1
//   log(1+x)      -> Pi*Csc(Pi*s)/s                   -1 < Re(s) < 0
// plus x^c*e^(-x) -> Gamma(c+s) (power-shift applied to the first pair) and the scaled
// e^(-a*x), sin(a*x), cos(a*x), 1/(1+a*x), 1/(1+a*x)^A, log(1+a*x) (scaling applied to
// each). `a`/`A` must be provably positive (`isPositive === true` — a positive literal, or
// a symbol under an active `ce.assume`); an unknown or non-positive sign declines.
//
// InverseMellinTransform mirrors the same nine pairs in reverse, confirmed the same way —
// note `Pi*Csc(Pi*s)/s` inverts to `Log(1 + 1/x)`, NOT `Log(1+x)`: Wolfram's default
// inversion contour for this particular F(s) sits in the strip 0 < Re(s) < 1 (log(1+x)'s
// own transform lives in -1 < Re(s) < 0), so the two are genuinely different pairs, not a
// round trip of each other — this file matches Wolfram's actual default, not an assumed
// symmetry. The power-shift direction is supported only for the Gamma(s) <-> e^(-x) pair
// (matching the one shifted example the table lists, `Gamma(a+s)` -> `x^a*e^(-x)`);
// combining a shift and a scale on the inverse side is declined (unverified).
//
// Declined (evaluate returns undefined): anything outside these nine shapes and their two
// theorems — a second exponent term, an unknown-sign scale/power parameter, a quadratic or
// higher argument to sin/cos/log, an opaque function, GenerateConditions-style strips
// finer than a single interval, and (for the inverse) any shape not among the nine.

const opAt = (expr: BoxedExpression, i: number): BoxedExpression => operandsOf(expr)[i];
const isSym = (x: BoxedExpression, name: string): boolean => symbolNameOf(x) === name;
const isE = (x: BoxedExpression): boolean => isSym(x, "ExponentialE");
const hasVar = (expr: BoxedExpression, name: string): boolean => expr.has(name);
const isOne = (x: BoxedExpression): boolean => x.re === 1 && x.im === 0;
const isHalf = (x: BoxedExpression): boolean => x.re === 0.5 && x.im === 0;

/** `expr` as `a*x` (no additive offset) — bare `x` gives `a = 1`. */
function linearCoeff(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
  if (isSym(expr, name)) return ce.One;
  if (expr.operator === "Negate") {
    const inner = linearCoeff(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const xFactors = ops.filter((o) => isSym(o, name));
    const rest = ops.filter((o) => !isSym(o, name));
    if (xFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    return rest.length === 1 ? rest[0] : ce.function("Multiply", rest).evaluate();
  }
  return undefined;
}

/** `expr` as `b*x^2` (any sign of `b`, `Negate` handled the same way `linearCoeff` does)
 * — the Gaussian's exponent shape (no scaling helper reuse: the argument is quadratic,
 * not linear). */
function quadraticCoeffSigned(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
  const isXSq = (o: BoxedExpression) => o.operator === "Power" && isSym(opAt(o, 0), name) && opAt(o, 1).re === 2;
  if (isXSq(expr)) return ce.One;
  if (expr.operator === "Negate") {
    const inner = quadraticCoeffSigned(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const sqFactors = ops.filter(isXSq);
    const rest = ops.filter((o) => !isXSq(o));
    if (sqFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    return rest.length === 1 ? rest[0] : ce.function("Multiply", rest).evaluate();
  }
  return undefined;
}

/** `expr` as `Power[x, c]` or bare `x` (`c = 1`) — the power-shift factor. */
function isPowerOfXFactor(expr: BoxedExpression, name: string): boolean {
  if (isSym(expr, name)) return true;
  return expr.operator === "Power" && isSym(opAt(expr, 0), name) && !hasVar(opAt(expr, 1), name);
}
function powerOfXExponent(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression {
  return isSym(expr, name) ? ce.One : opAt(expr, 1);
}

/** `Add[Y, 1]` (either order) — the `1 + Y` shape shared by `1/(1+x)`, `(1+x)^A`, and
 * `log(1+x)`. Returns `Y`, or undefined. */
function asOnePlus(expr: BoxedExpression): BoxedExpression | undefined {
  if (expr.operator !== "Add") return undefined;
  const ops = operandsOf(expr);
  if (ops.length !== 2) return undefined;
  const [p0, p1] = ops as [BoxedExpression, BoxedExpression];
  if (isOne(p0)) return p1;
  if (isOne(p1)) return p0;
  return undefined;
}

// --- Forward: MellinTransform ---------------------------------------------------------

/** One of the nine base shapes, `s` already shifted by any enclosing power-of-x factor. */
function atomicMellin(
  ce: ComputeEngine,
  expr: BoxedExpression,
  x: string,
  s: BoxedExpression,
): BoxedExpression | undefined {
  if (expr.operator === "Power" && isE(opAt(expr, 0))) {
    // The exponent must read as `-a*x` (linear) or `-b*x^2` (Gaussian) for some
    // provably positive `a`/`b`. A literal coefficient folds `Negate` away during
    // canonicalization (`Exp(-2x)` boxes as `Power[E, Multiply[-2, x]]`, no `Negate`
    // node at all) while a symbolic one keeps it (`Exp(-a x)` stays `Negate[Multiply[a,
    // x]]`) — so this reads the SIGNED coefficient directly rather than requiring a
    // `Negate` wrapper first, and checks `isNegative` on it either way.
    const exponent = opAt(expr, 1);
    const k = linearCoeff(ce, exponent, x);
    if (k !== undefined && k.isNegative === true) {
      const a = ce.function("Negate", [k]).evaluate();
      return ce
        .function("Multiply", [ce.function("Gamma", [s]), ce.function("Power", [a, ce.function("Negate", [s])])])
        .evaluate();
    }
    const m = quadraticCoeffSigned(ce, exponent, x);
    if (m !== undefined && m.isNegative === true) {
      const b = ce.function("Negate", [m]).evaluate();
      const halfS = ce.function("Divide", [s, 2]);
      return ce
        .function("Multiply", [
          ce.function("Divide", [ce.function("Gamma", [halfS]), 2]),
          ce.function("Power", [b, ce.function("Negate", [halfS])]),
        ])
        .evaluate();
    }
    return undefined;
  }
  if (expr.operator === "Divide") {
    const num = opAt(expr, 0);
    const den = opAt(expr, 1);
    if (isPowerOfXFactor(num, x)) {
      const c = powerOfXExponent(ce, num, x);
      const sShift = ce.function("Add", [s, c]).evaluate();
      return atomicMellin(ce, ce.function("Divide", [1, den]).evaluate(), x, sShift);
    }
    if (!isOne(num)) return undefined;
    const y = asOnePlus(den);
    if (y === undefined) return undefined;
    const a = linearCoeff(ce, y, x);
    if (a === undefined || a.isPositive !== true) return undefined;
    return ce
      .function("Multiply", [
        ce.function("Power", [a, ce.function("Negate", [s])]),
        ce.Pi,
        ce.function("Csc", [ce.function("Multiply", [ce.Pi, s])]),
      ])
      .evaluate();
  }
  if (expr.operator === "Power") {
    const base = opAt(expr, 0);
    const exponent = opAt(expr, 1);
    const y = asOnePlus(base);
    if (y === undefined) return undefined;
    const a = linearCoeff(ce, y, x);
    if (a === undefined || a.isPositive !== true) return undefined;
    let bigA: BoxedExpression | undefined;
    if (exponent.operator === "Negate") bigA = opAt(exponent, 0);
    else if (exponent.im === 0 && Number.isFinite(exponent.re) && exponent.re < 0) bigA = ce.number(-exponent.re);
    if (bigA === undefined || hasVar(bigA, x)) return undefined;
    return ce
      .function("Multiply", [
        ce.function("Power", [a, ce.function("Negate", [s])]),
        ce.function("Divide", [
          ce.function("Multiply", [
            ce.function("Gamma", [ce.function("Subtract", [bigA, s])]),
            ce.function("Gamma", [s]),
          ]),
          ce.function("Gamma", [bigA]),
        ]),
      ])
      .evaluate();
  }
  if (expr.operator === "Sin" || expr.operator === "Cos") {
    const a = linearCoeff(ce, opAt(expr, 0), x);
    if (a === undefined || a.isPositive !== true) return undefined;
    const halfPiS = ce.function("Multiply", [ce.Pi, ce.function("Divide", [s, 2])]);
    const trig = ce.function(expr.operator, [halfPiS]);
    return ce
      .function("Multiply", [ce.function("Power", [a, ce.function("Negate", [s])]), ce.function("Gamma", [s]), trig])
      .evaluate();
  }
  if (expr.operator === "Ln") {
    const y = asOnePlus(opAt(expr, 0));
    if (y === undefined) return undefined;
    const a = linearCoeff(ce, y, x);
    if (a === undefined || a.isPositive !== true) return undefined;
    return ce
      .function("Multiply", [
        ce.function("Power", [a, ce.function("Negate", [s])]),
        ce.Pi,
        ce.function("Divide", [ce.function("Csc", [ce.function("Multiply", [ce.Pi, s])]), s]),
      ])
      .evaluate();
  }
  return undefined;
}

export function matchMellin(
  ce: ComputeEngine,
  expr: BoxedExpression,
  x: BoxedExpression,
  s: BoxedExpression,
): BoxedExpression | undefined {
  const xName = symbolNameOf(x);
  if (xName === undefined || !hasVar(expr, xName)) return undefined;
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const consts = ops.filter((o) => !hasVar(o, xName));
    const rest = ops.filter((o) => hasVar(o, xName));
    const powIdx = rest.findIndex((o) => isPowerOfXFactor(o, xName));
    let core: BoxedExpression;
    let sEff: BoxedExpression;
    if (powIdx !== -1) {
      const c = powerOfXExponent(ce, rest[powIdx]!, xName);
      const others = rest.filter((_, i) => i !== powIdx);
      if (others.length === 0) return undefined;
      core = others.length === 1 ? others[0]! : ce.function("Multiply", others);
      sEff = ce.function("Add", [s, c]).evaluate();
    } else {
      if (rest.length !== 1) return undefined;
      core = rest[0]!;
      sEff = s;
    }
    const base = atomicMellin(ce, core, xName, sEff);
    if (base === undefined) return undefined;
    return consts.length === 0 ? base : ce.function("Multiply", [...consts, base]).evaluate();
  }
  return atomicMellin(ce, expr, xName, s);
}

// --- Inverse: InverseMellinTransform ---------------------------------------------------

/** A `Power[b, Negate[s]]` factor — the scale term every base pair above produces on
 * its own forward side (`b^(-s)`, `b` not containing `s`). */
function isScalePower(expr: BoxedExpression, sName: string): boolean {
  if (expr.operator !== "Power") return false;
  const exponent = opAt(expr, 1);
  return exponent.operator === "Negate" && isSym(opAt(exponent, 0), sName) && !hasVar(opAt(expr, 0), sName);
}

/** Pulls a `Power[b, Negate[s]]` factor out of `expr`'s top-level `Multiply` — or, for a
 * `Divide`, out of its numerator's `Multiply` (where the base pairs above put it,
 * alongside the rest of the numerator; the denominator, e.g. `Gamma(A)`, never carries
 * one). `b = 1` (no scale) when there is no such factor. */
function stripScale(
  ce: ComputeEngine,
  expr: BoxedExpression,
  sName: string,
): { readonly b: BoxedExpression; readonly rest: BoxedExpression } {
  const pullFrom = (
    mul: BoxedExpression,
  ): { readonly b: BoxedExpression; readonly rest: BoxedExpression } | undefined => {
    if (mul.operator !== "Multiply") return undefined;
    const ops = operandsOf(mul);
    const idx = ops.findIndex((o) => isScalePower(o, sName));
    if (idx === -1) return undefined;
    const b = opAt(ops[idx]!, 0);
    const others = ops.filter((_, i) => i !== idx);
    const rest = others.length === 1 ? others[0]! : ce.function("Multiply", others);
    return { b, rest };
  };
  if (expr.operator === "Divide") {
    const pulled = pullFrom(opAt(expr, 0));
    if (pulled !== undefined) return { b: pulled.b, rest: ce.function("Divide", [pulled.rest, opAt(expr, 1)]) };
    return { b: ce.One, rest: expr };
  }
  const pulled = pullFrom(expr);
  return pulled ?? { b: ce.One, rest: expr };
}

/** `s`, or `s + c` (`c` not containing `s`) — the one shift shape this table supports
 * (`Gamma(a+s)` <-> `x^a e^(-x)`). Returns `c` (zero for a bare `s`), or undefined. */
function sPlusShift(ce: ComputeEngine, expr: BoxedExpression, sName: string): BoxedExpression | undefined {
  if (isSym(expr, sName)) return ce.Zero;
  if (expr.operator !== "Add") return undefined;
  const ops = operandsOf(expr);
  const sOps = ops.filter((o) => isSym(o, sName));
  const rest = ops.filter((o) => !isSym(o, sName));
  if (sOps.length !== 1 || rest.some((o) => hasVar(o, sName))) return undefined;
  return rest.length === 1 ? rest[0]! : ce.function("Add", rest).evaluate();
}

const isPiTimesS = (expr: BoxedExpression, sName: string): boolean => {
  if (expr.operator !== "Multiply") return false;
  const ops = operandsOf(expr);
  return ops.length === 2 && ops.some((o) => isSym(o, "Pi")) && ops.some((o) => isSym(o, sName));
};
/** `Multiply[1/2, s]` — Wolfram's `Gamma(s/2)/2` canonicalizes its argument this way,
 * not as `Divide[s, 2]` (confirmed by boxing it directly). */
const isHalfS = (expr: BoxedExpression, sName: string): boolean => {
  if (expr.operator !== "Multiply") return false;
  const ops = operandsOf(expr);
  return ops.length === 2 && ops.some(isHalf) && ops.some((o) => isSym(o, sName));
};
const isHalfPiS = (expr: BoxedExpression, sName: string): boolean => {
  if (expr.operator !== "Multiply") return false;
  const ops = operandsOf(expr);
  return ops.length === 3 && ops.some(isHalf) && ops.some((o) => isSym(o, "Pi")) && ops.some((o) => isSym(o, sName));
};

function atomicInverseMellin(
  ce: ComputeEngine,
  expr: BoxedExpression,
  sName: string,
  x: BoxedExpression,
): BoxedExpression | undefined {
  if (expr.operator === "Gamma") {
    const c = sPlusShift(ce, opAt(expr, 0), sName);
    if (c === undefined) return undefined;
    const base = ce.function("Exp", [ce.function("Negate", [x])]);
    return (c.re === 0 && c.im === 0 ? base : ce.function("Multiply", [ce.function("Power", [x, c]), base])).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    if (ops.length === 2) {
      // Gaussian: Multiply[1/2, Gamma[Multiply[1/2, s]]]
      const half = ops.find(isHalf);
      const gam = ops.find((o) => o.operator === "Gamma");
      if (half !== undefined && gam !== undefined && isHalfS(opAt(gam, 0), sName)) {
        return ce.function("Exp", [ce.function("Negate", [ce.function("Power", [x, 2])])]).evaluate();
      }
      // Trig: Multiply[Sin|Cos[1/2*Pi*s], Gamma[s]]
      const trig = ops.find((o) => o.operator === "Sin" || o.operator === "Cos");
      const gamS = ops.find((o) => o.operator === "Gamma" && isSym(opAt(o, 0), sName));
      if (trig !== undefined && gamS !== undefined && isHalfPiS(opAt(trig, 0), sName)) {
        return ce.function(trig.operator, [x]).evaluate();
      }
      // 1/(1+x): Multiply[Pi, Csc[Pi*s]]
      const pi = ops.find((o) => isSym(o, "Pi"));
      const csc = ops.find((o) => o.operator === "Csc");
      if (pi !== undefined && csc !== undefined && isPiTimesS(opAt(csc, 0), sName)) {
        return ce.function("Power", [ce.function("Add", [1, x]), -1]).evaluate();
      }
    }
    return undefined;
  }
  if (expr.operator === "Divide") {
    const num = opAt(expr, 0);
    const den = opAt(expr, 1);
    // (1+x)^{-A}: Divide[Multiply[Gamma[s], Gamma[A - s]], Gamma[A]]
    if (den.operator === "Gamma" && num.operator === "Multiply") {
      const ops = operandsOf(num);
      if (ops.length === 2) {
        const gamS = ops.find((o) => o.operator === "Gamma" && isSym(opAt(o, 0), sName));
        const other = ops.find((o) => o !== gamS && o.operator === "Gamma");
        if (gamS !== undefined && other !== undefined) {
          const diff = opAt(other, 0);
          if (diff.operator === "Add") {
            const dOps = operandsOf(diff);
            const negS = dOps.find((o) => o.operator === "Negate" && isSym(opAt(o, 0), sName));
            const bigA = dOps.find((o) => o !== negS);
            const denA = opAt(den, 0);
            if (negS !== undefined && bigA !== undefined && bigA.isEqual(denA)) {
              return ce.function("Power", [ce.function("Add", [1, x]), ce.function("Negate", [bigA])]).evaluate();
            }
          }
        }
      }
      return undefined;
    }
    // log(1 + 1/x): Divide[Multiply[Pi, Csc[Pi*s]], s]
    if (isSym(den, sName) && num.operator === "Multiply") {
      const ops = operandsOf(num);
      if (ops.length === 2) {
        const pi = ops.find((o) => isSym(o, "Pi"));
        const csc = ops.find((o) => o.operator === "Csc");
        if (pi !== undefined && csc !== undefined && isPiTimesS(opAt(csc, 0), sName)) {
          return ce.function("Ln", [ce.function("Add", [1, ce.function("Power", [x, -1])])]).evaluate();
        }
      }
    }
    return undefined;
  }
  return undefined;
}

export function matchInverseMellin(
  ce: ComputeEngine,
  expr: BoxedExpression,
  s: BoxedExpression,
  x: BoxedExpression,
): BoxedExpression | undefined {
  const sName = symbolNameOf(s);
  if (sName === undefined || !hasVar(expr, sName)) return undefined;
  const { b, rest } = stripScale(ce, expr, sName);
  const f0 = atomicInverseMellin(ce, rest, sName, x);
  if (f0 === undefined) return undefined;
  if (b.re === 1 && b.im === 0) return f0;
  const xName = symbolNameOf(x);
  if (xName === undefined) return undefined;
  return f0.subs({ [xName]: ce.function("Multiply", [b, x]) }).evaluate();
}

export function declareMellinTransform(ce: ComputeEngine): void {
  ce.declare("MellinTransform", {
    signature: "(value, value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, x, s] = ops;
      if (f === undefined || x === undefined || s === undefined || ops.length > 3) return undefined;
      return matchMellin(ce, f, x, s);
    },
  });
  ce.declare("InverseMellinTransform", {
    signature: "(value, value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [F, s, x] = ops;
      if (F === undefined || s === undefined || x === undefined || ops.length > 3) return undefined;
      return matchInverseMellin(ce, F, s, x);
    },
  });
}
