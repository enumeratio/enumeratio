import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isFiniteNum, type NativeEval, wantsNumber } from "./box.ts";

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

export function declareElliptic(ce: ComputeEngine): void {
  patchEllipticE(ce);
  declareIncompleteF(ce);
  declareIncompleteE(ce);
}
