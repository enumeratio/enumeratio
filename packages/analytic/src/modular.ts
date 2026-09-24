import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isFiniteNum, isRealInt, numberResult, wantsNumber } from "./box.ts";
import { abs, cx, type Cx, div, mul, scale, sub } from "./complex.ts";

// ModularJ, ModularLambda, EisensteinG — Fungrim-frontier heads over τ in the upper
// half-plane, delegating to compute-engine's own native EisensteinE/JacobiTheta rather
// than reimplementing a q-series (design/namespaces.md §6: extend, don't reimplement).
//
// Both EisensteinE (Eisenstein series, a naive q-series here) and the theta-ratio behind
// λ grow the way the true functions genuinely do near a cusp (Im τ → 0), which is real
// math, not an artifact — but that growth also means catastrophic cancellation eats
// precision at a double once τ is far from the standard fundamental domain (checked
// empirically: E4 at τ = 0.05 + 0.005i loses several digits versus the same value
// recovered through the reduction below). So every head here first reduces τ to the
// standard SL2(Z) fundamental domain (|Re τ| ≤ ½, |τ| ≥ 1) by the textbook algorithm —
// alternate T: τ → τ − round(Re τ) and S: τ → −1/τ until both bounds hold — and evaluates
// the native kernel there, where the q-series converges fast and cleanly (Im τ ≥ √3/2).
//
// j is invariant under the FULL modular group, so the reduced value IS j(τ) — no
// back-transform needed. E_k (weight k, level 1) transforms by E_k(τ+1) = E_k(τ) (T is
// always the identity — period exactly 1, not just parity) and E_k(−1/τ) = τ^k·E_k(τ)
// (S), so unwinding the S-steps in reverse — dividing by the PRE-inversion τ at that
// step, raised to the k — recovers E_k(τ) from E_k(reduced τ); this is what EisensteinG
// rides on. λ is invariant only under Γ(2) (index 6 in PSL2(Z)), so plain SL2(Z)
// reduction does NOT land on an equivalent point for λ the way it does for j — instead
// each step's known transform law (λ(τ+1) = λ/(λ−1), λ(−1/τ) = 1−λ, both self-inverse)
// is applied, in reverse step order, to carry the reduced-domain λ back to λ(τ). All
// three back-transforms were checked against direct native evaluation at points already
// inside the fundamental domain (where no correction applies) and against the T/S
// identities directly (λ(τ0+1) and λ(−1/τ0) recomputed through the same machinery)
// before trusting them on points where direct evaluation is imprecise.

const MAX_REDUCE_STEPS = 200;
const REDUCE_EPS = 1e-12;

interface ReduceStep {
  kind: "T" | "S";
  /** τ immediately before this step (needed only by S: the weight-k correction is pre^k). */
  pre: Cx;
}

/** ½: τ − round(Re τ) folds the real part into [−½, ½]; τ → −1/τ folds |τ| up past 1. */
function reduceToFundamentalDomain(tau0: Cx): { tau: Cx; steps: ReduceStep[] } {
  let tau = tau0;
  const steps: ReduceStep[] = [];
  for (let i = 0; i < MAX_REDUCE_STEPS; i++) {
    const n = Math.round(tau.re);
    if (n !== 0) {
      const pre = tau;
      tau = cx(tau.re - n, tau.im);
      // E_k has period exactly 1 (T is the identity for it either way); λ only sees
      // T's square as the identity (h_T is an involution), so an even n contributes
      // nothing there either — only record the step when n is odd.
      if (Math.abs(n % 2) === 1) steps.push({ kind: "T", pre });
    }
    if (abs(tau) < 1 - REDUCE_EPS) {
      const pre = tau;
      tau = scale(div(cx(1), tau), -1); // −1/τ
      steps.push({ kind: "S", pre });
    } else {
      break;
    }
  }
  return { tau, steps };
}

/** z^n for a nonnegative integer n, by repeated squaring (n is always small here). */
function intPow(z: Cx, n: number): Cx {
  let r = cx(1);
  let base = z;
  let e = n;
  while (e > 0) {
    if (e & 1) r = mul(r, base);
    base = mul(base, base);
    e >>= 1;
  }
  return r;
}

const square = (z: Cx): Cx => mul(z, z);
const cube = (z: Cx): Cx => mul(square(z), z);
const pow4 = (z: Cx): Cx => square(square(z));

/** Call compute-engine's native `EisensteinE`/`JacobiTheta` at a concrete complex point. */
function callNative(ce: ComputeEngine, head: string, args: readonly (number | Cx)[]): Cx {
  const json = args.map((a) =>
    typeof a === "number" ? a : (["Complex", a.re, a.im] as unknown as number),
  );
  const r = ce.box([head, ...json] as never).N();
  return cx(r.re, r.im);
}

/** E_k(τ) for even k ≥ 4, native at the reduced point, unwound back to τ. */
function eisensteinE(ce: ComputeEngine, k: number, tau0: Cx): Cx {
  const { tau, steps } = reduceToFundamentalDomain(tau0);
  let val = callNative(ce, "EisensteinE", [k, tau]);
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.kind === "S") val = div(val, intPow(step.pre, k));
    // T: E_k(τ+1) = E_k(τ) exactly — nothing to unwind.
  }
  return val;
}

/** j(τ) = E4³/Δ with Δ = η²⁴ — SL2(Z)-invariant, so the reduced point IS the answer. Δ from
 * η rather than (E4³ − E6²)/1728, which cancels to |q| and loses every digit as Im τ grows. */
function modularJ(ce: ComputeEngine, tau0: Cx): Cx {
  const { tau } = reduceToFundamentalDomain(tau0);
  const e4cubed = cube(callNative(ce, "EisensteinE", [4, tau]));
  const delta = intPow(callNative(ce, "DedekindEta", [tau]), 24);
  return div(e4cubed, delta);
}

const hT = (x: Cx): Cx => div(x, sub(x, cx(1))); // λ(τ+1) = λ/(λ−1), an involution
const hS = (x: Cx): Cx => sub(cx(1), x); // λ(−1/τ) = 1−λ, an involution

/** λ(τ) = θ₂⁴/θ₃⁴ (nome q = e^{iπτ}) — only Γ(2)-invariant, so each step is undone by
 * its own λ-transform law rather than by re-evaluating at the reduced point directly. */
function modularLambda(ce: ComputeEngine, tau0: Cx): Cx {
  const { tau, steps } = reduceToFundamentalDomain(tau0);
  const theta2 = callNative(ce, "JacobiTheta", [2, 0, tau]);
  const theta3 = callNative(ce, "JacobiTheta", [3, 0, tau]);
  let val = div(pow4(theta2), pow4(theta3));
  for (let i = steps.length - 1; i >= 0; i--) val = steps[i].kind === "T" ? hT(val) : hS(val);
  return val;
}

/** G_k(τ) = 2ζ(k)·E_k(τ), for even k ≥ 4 — the un-normalized Eisenstein series (DLMF
 * 23.16, Fungrim's convention), delegating entirely to the normalized E_k above. */
function eisensteinG(ce: ComputeEngine, k: number, tau0: Cx): Cx {
  const zetaK = ce.box(["Zeta", k] as never).N();
  return scale(mul(cx(zetaK.re, zetaK.im), eisensteinE(ce, k, tau0)), 2);
}

/**
 * Declare `ModularJ`, `ModularLambda`, `EisensteinG`. Numeric only — like Carlson's
 * heads, none of the three has a widely useful closed form to reduce to symbolically
 * beyond what the native q-series kernels already cover, so a non-numeric call is left
 * symbolic.
 */
export function declareModular(ce: ComputeEngine): void {
  if (ce.lookupDefinition("ModularJ") !== undefined) return; // never redeclare a native head

  ce.declare("ModularJ", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [tau] = ops;
      if (tau === undefined || !wantsNumber(ops, options) || !isFiniteNum(tau)) return undefined;
      return numberResult(ce, modularJ(ce, cx(tau.re, tau.im)));
    },
  });

  ce.declare("ModularLambda", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [tau] = ops;
      if (tau === undefined || !wantsNumber(ops, options) || !isFiniteNum(tau)) return undefined;
      return numberResult(ce, modularLambda(ce, cx(tau.re, tau.im)));
    },
  });

  ce.declare("EisensteinG", {
    signature: "(integer, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [k, tau] = ops;
      if (k === undefined || tau === undefined) return undefined;
      if (!isRealInt(k) || k.re < 4 || k.re % 2 !== 0) return undefined;
      if (!wantsNumber(ops, options) || !isFiniteNum(tau)) return undefined;
      return numberResult(ce, eisensteinG(ce, k.re, cx(tau.re, tau.im)));
    },
  });
}
