import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  type EvalOptions,
  isFiniteNum,
  type NativeEval,
  numberResult,
  wantsNumber,
} from "./box.ts";
import { carlsonRF, carlsonRJ } from "./carlson.ts";
import { add, ccos, csin, cx, type Cx, mul, scale, sub } from "./complex.ts";

// The incomplete Legendre elliptic integrals, and two precision fixes for the native
// complete one. compute-engine already declares EllipticE/EllipticF/EllipticK/EllipticPi
// natively (see design/upstreaming.md §8), so nothing here redeclares those heads — one
// is patched in place at two call sites, the rest are read-only.

/**
 * Fix `EllipticE`'s precision loss at complex modulus (design/upstreaming.md §8: three
 * Fungrim identities catch it, e.g. m = 0.57 + 0.23i gives four correct digits against
 * mpmath and the engine's own Hypergeometric2F1 identity). The one-argument "complete"
 * form E(m) is the one that loses precision; the two-argument incomplete form E(φ, m) is
 * exact there — confirmed against mpmath across a spread of complex m, including points
 * where the complete form is fine and points where it visibly isn't, so the two forms are
 * not simply redundant paths through the same bug. E(m) = E(π/2, m) (DLMF 19.2.7), so a
 * complex-modulus complete call is routed through the accurate incomplete evaluator
 * instead of trusting the native reduction. Real modulus is untouched — already exact
 * there — and attached in place rather than redeclared, so `EllipticE`'s own canonical
 * form, LaTeX, and the rest of its definition survive (see derivatives.ts).
 */
function patchEllipticE(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("EllipticE");
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) return; // EllipticE not declared at all — nothing to patch

  const native: NativeEval = operator.evaluate;
  const halfPi = ce.box(["Divide", "Pi", 2]);
  operator.evaluate = (
    ops: readonly BoxedExpression[],
    options: EvalOptions,
  ): BoxedExpression | undefined => {
    const [m] = ops;
    if (
      ops.length === 1 &&
      m !== undefined &&
      wantsNumber(ops, options) &&
      isFiniteNum(m) &&
      m.im !== 0
    ) {
      return ce.box(["EllipticE", halfPi, m]).evaluate(options);
    }
    return native?.(ops, options);
  };
}

/**
 * Declare `IncompleteEllipticF(φ, m)` — Fungrim's name for the incomplete Legendre
 * elliptic integral of the first kind, same (amplitude, parameter) argument order and
 * `m = k²` convention as Wolfram's `EllipticF[φ, m]`. compute-engine's native two-argument
 * `EllipticF` already evaluates this exactly — confirmed against mpmath for complex φ, φ
 * outside [−π/2, π/2] (DLMF 19.2.10 quasi-periodicity), and complex m, all independently
 * and combined — so this is a thin delegate.
 */
function declareIncompleteF(ce: ComputeEngine): void {
  if (ce.lookupDefinition("IncompleteEllipticF") !== undefined) return; // never redeclare
  ce.declare("IncompleteEllipticF", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [phi, m] = ops;
      // Stay symbolic under a plain `evaluate()` at symbolic/exact operands, same as
      // every other head here — only delegate once a numeric answer is actually wanted,
      // so this head's own name survives an unevaluated call.
      if (phi === undefined || m === undefined || !wantsNumber(ops, options)) return undefined;
      return ce.box(["EllipticF", phi, m]).evaluate(options);
    },
  });
}

/**
 * Declare `IncompleteEllipticE(φ, m)` — Fungrim's name for the incomplete Legendre
 * elliptic integral of the second kind. Unlike `IncompleteEllipticF`, this is NOT a thin
 * delegate: native `EllipticE(φ, m)` is exact for φ inside [−π/2, π/2] at any m (checked
 * against mpmath, real and complex m alike — see `patchEllipticE` above), but loses
 * precision whenever m is complex AND φ's real part falls outside that range (e.g.
 * φ = 0.57 + π, m = 0.57 + 0.23i: native gives 3.1882…, mpmath and the quasi-periodicity
 * identity below both give 3.2028… — caught by Fungrim identity c28288). `EllipticF` at
 * the same points has no such bug (checked separately), so this is specific to native
 * `EllipticE`'s internal reduction for the incomplete case, not just the complete-case
 * bug `patchEllipticE` already covers.
 *
 * DLMF 19.2.10's quasi-periodicity, E(φ + kπ, m) = 2k·E(m) + E(φ, m) for integer k, holds
 * exactly for complex m too (checked against mpmath) — so it is applied explicitly here,
 * shifting φ's real part into [−π/2, π/2] before calling native `EllipticE`, and using the
 * ALREADY-patched complete form for the 2k·E(m) term, rather than trusting native's own
 * (buggy, for this case) internal reduction.
 */
function declareIncompleteE(ce: ComputeEngine): void {
  if (ce.lookupDefinition("IncompleteEllipticE") !== undefined) return; // never redeclare

  ce.declare("IncompleteEllipticE", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [phi, m] = ops;
      if (phi === undefined || m === undefined || !wantsNumber(ops, options)) return undefined;
      if (!isFiniteNum(phi) || !isFiniteNum(m))
        return ce.box(["EllipticE", phi, m]).evaluate(options);

      const k = m.im !== 0 ? Math.round(phi.re / Math.PI) : 0;
      if (k === 0) return ce.box(["EllipticE", phi, m]).evaluate(options);

      const phi0 =
        phi.im === 0
          ? ce.number(phi.re - k * Math.PI)
          : ce.number(ce.complex(phi.re - k * Math.PI, phi.im));
      const eComplete = ce.box(["EllipticE", m]).evaluate(options); // the patched complete form
      const eIncomplete = ce.box(["EllipticE", phi0, m]).evaluate(options); // φ0 is back in range
      return ce.box(["Add", ["Multiply", 2 * k, eComplete], eIncomplete]).evaluate(options);
    },
  });
}

/**
 * Is an `R_J(x, y, z, p)` call here at genuine risk of `carlsonRJ`'s documented branch
 * issue — a per-step `R_C` sum whose implicit branch choice can disagree with mpmath?
 * Found by testing IncompleteEllipticPi's own Fungrim identity 5f84d9 at
 * n = m = φ = 1.17 + 0.45i, k = 3: `RJ(0, 0.7, 1, −0.17−0.45i)` disagrees with mpmath's
 * `elliprj` by an order of magnitude (well outside this file's tolerance), even though
 * only `p` is off the positive real axis and `carlsonRJ`'s own decline heuristic
 * (`carlsonRJDeclines` in carlson.ts) does not catch it — it only declines at two or
 * more of the four arguments at Re < 0, and here it is one. Bisecting the failure
 * pinned it to `p` specifically: `RJ(0.5, 0.7, 1, −0.17−0.45i)` (same `p`, `x` moved
 * away from 0) agrees with mpmath, and `RJ(0.1, −0.3, 1, 0.5+0.1i)` (`y` negative,
 * `p` positive) agrees too — so this declines whenever `p` alone has Re < 0 and the
 * call is not the all-real case (where `carlsonRJ`'s reflection/CPV branches are
 * already verified), rather than trying to characterize exactly which `x` keeps it
 * safe. More conservative than strictly necessary, but a false decline costs
 * coverage; a wrong number costs correctness.
 */
function riskyRJ(x: Cx, y: Cx, z: Cx, p: Cx): boolean {
  if ([x, y, z, p].every((v) => v.im === 0)) return false;
  return p.re < 0;
}

/**
 * Π(n; m) = R_F(0, 1−m, 1) + (n/3)·R_J(0, 1−m, 1, 1−n) — the complete elliptic integral
 * of the third kind (DLMF 19.25.15 at φ = π/2: cosφ = 0, sinφ = 1), used below only to
 * bridge the quasi-periodicity identity across φ = π/2 + kπ. Matches Fungrim identity
 * 9ccaef, which states the same reduction for native `EllipticPi`. `undefined` when the
 * R_J call is at risk (see `riskyRJ`) — declining rather than trusting a number this
 * file cannot vouch for.
 */
function ellipticPiComplete(n: Cx, m: Cx): Cx | undefined {
  const one = cx(1);
  const oneMinusM = sub(one, m);
  const oneMinusN = sub(one, n);
  if (riskyRJ(cx(0), oneMinusM, one, oneMinusN)) return undefined;
  const rf = carlsonRF(cx(0), oneMinusM, one);
  const rj = carlsonRJ(cx(0), oneMinusM, one, oneMinusN);
  return add(rf, scale(mul(n, rj), 1 / 3));
}

/**
 * Π(n; φ, m) for Re(φ) ∈ [−π/2, π/2] — Fungrim identity 8f4e31 / DLMF 19.25.14:
 *   Π(n;φ,m) = sinφ·R_F(cos²φ, 1−m sin²φ, 1) + (n/3)·sin³φ·R_J(cos²φ, 1−m sin²φ, 1, 1−n sin²φ)
 * `undefined` when the R_J call is at risk (see `riskyRJ`).
 */
function incompleteEllipticPiBase(n: Cx, phi: Cx, m: Cx): Cx | undefined {
  const c = ccos(phi);
  const s = csin(phi);
  const c2 = mul(c, c);
  const s2 = mul(s, s);
  const s3 = mul(s2, s);
  const one = cx(1);
  const x = c2;
  const y = sub(one, mul(m, s2));
  const p = sub(one, mul(n, s2));
  if (riskyRJ(x, y, one, p)) return undefined;
  const rf = carlsonRF(x, y, one);
  const rj = carlsonRJ(x, y, one, p);
  return add(mul(s, rf), scale(mul(n, mul(s3, rj)), 1 / 3));
}

/**
 * Π(n; φ, m) for any φ: reduce Re(φ) into [−π/2, π/2] via Fungrim identity 5f84d9's
 * quasi-periodicity, Π(n; φ+kπ, m) = 2k·Π(n,m) + Π(n; φ, m) — the same shift-by-kπ
 * pattern `declareIncompleteE` above uses for `IncompleteEllipticE`, but applied
 * unconditionally (not gated on complex m): this is a from-scratch Carlson evaluator,
 * not a delegate to a native reduction that might already handle real φ correctly.
 * `undefined` propagates from either Carlson call it depends on.
 */
function incompleteEllipticPi(n: Cx, phi: Cx, m: Cx): Cx | undefined {
  const k = Math.round(phi.re / Math.PI);
  if (k === 0) return incompleteEllipticPiBase(n, phi, m);
  const phi0 = cx(phi.re - k * Math.PI, phi.im);
  const complete = ellipticPiComplete(n, m);
  const base = incompleteEllipticPiBase(n, phi0, m);
  if (complete === undefined || base === undefined) return undefined;
  return add(scale(complete, 2 * k), base);
}

/**
 * Declare `IncompleteEllipticPi(n, φ, m)` — Fungrim's name for the incomplete Legendre
 * elliptic integral of the third kind, same (characteristic, amplitude, parameter)
 * argument order and m = k² convention as Wolfram's `EllipticPi[n, φ, m]` and mpmath's
 * `ellippi(n, phi, m)` (checked: `EllipticPi(0.5, 0.4, 0.3)` under both conventions
 * agree with `mpmath.ellippi(0.5, 0.4, 0.3)` to machine precision).
 *
 * NOT a thin delegate to native `EllipticPi`: its optional third argument already
 * implements this same incomplete form and agrees with mpmath almost everywhere, but
 * returns NaN once φ picks up an imaginary part and its real part moves much past 1
 * (e.g. n = 0.2, φ = 1.2 + 0.5i, m = 0.3 — well inside the Re(φ) ∈ [−π/2, π/2] region
 * Fungrim identity 8f4e31 states, so this is a native bug, not a domain limit reached).
 * So this is built directly from Carlson's R_F/R_J (declared in carlson.ts) via
 * `incompleteEllipticPi` above, checked against mpmath's `ellippi` across real and
 * complex n, φ, m — including the case that breaks native, and φ shifted by several
 * multiples of π in both directions — and losslessly against native `EllipticPi` on the
 * inputs where native itself agrees with mpmath.
 */
function declareIncompleteEllipticPi(ce: ComputeEngine): void {
  if (ce.lookupDefinition("IncompleteEllipticPi") !== undefined) return; // never redeclare

  ce.declare("IncompleteEllipticPi", {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [n, phi, m] = ops;
      if (n === undefined || phi === undefined || m === undefined) return undefined;
      if (!wantsNumber(ops, options) || !isFiniteNum(n) || !isFiniteNum(phi) || !isFiniteNum(m)) {
        return undefined;
      }
      const result = incompleteEllipticPi(cx(n.re, n.im), cx(phi.re, phi.im), cx(m.re, m.im));
      return result === undefined ? undefined : numberResult(ce, result);
    },
  });
}

export function declareElliptic(ce: ComputeEngine): void {
  patchEllipticE(ce);
  declareIncompleteF(ce);
  declareIncompleteE(ce);
  declareIncompleteEllipticPi(ce);
}
