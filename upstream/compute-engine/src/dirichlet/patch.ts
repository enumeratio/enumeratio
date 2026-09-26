import { type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { isFiniteNum, isRealInt, numberResult, wantsNumber } from "../shared/box.ts";
import { bernoulliPolyExpr } from "../shared/bernoulli.ts";
import { atEnginePrecision } from "../shared/precise.ts";
import { cx } from "../shared/complex.ts";
import type { Patch } from "../patch.ts";
import { dirichletBeta, dirichletBetaReal, dirichletEta, dirichletEtaReal } from "./dirichlet.ts";
import { character, characterExponent, dirichletL, dirichletLReal, eulerPhi } from "./dirichlet-l.ts";

// cortex-js/compute-engine#340: the Dirichlet family — DirichletEta(s), DirichletBeta(s),
// DirichletCharacter(k, j, n) and DirichletL(k, j, s). Wolfram has all four; compute-engine
// has none.

type Json = number | string | { num: string } | Json[];
const box = (ce: ComputeEngine, expr: Json): BoxedExpression => ce.box(expr as never);
const json = (x: BoxedExpression): Json => x.json as unknown as Json;
const finish = (expr: BoxedExpression, numeric: boolean): BoxedExpression => (numeric ? expr.N() : expr.evaluate());

/** Euler numbers E₀, E₂, E₄, … (E₂ₖ at index k), exact: Σ_j C(2k, 2j) E₂ⱼ = 0. */
const eulerNumber = (() => {
  const cache: bigint[] = [1n];
  const binom = (n: number, k: number): bigint => {
    let r = 1n;
    for (let i = 0; i < k; i++) r = (r * BigInt(n - i)) / BigInt(i + 1);
    return r;
  };
  return (k: number): bigint => {
    for (let m = cache.length; m <= k; m++) {
      let sum = 0n;
      for (let j = 0; j < m; j++) sum += binom(2 * m, 2 * j) * cache[j];
      cache[m] = -sum;
    }
    return cache[k];
  };
})();

const bigint = (v: bigint): Json => ({ num: v.toString() });

function evaluateEta(ce: ComputeEngine, s: BoxedExpression, numeric: boolean) {
  if (isRealInt(s) && s.re === 1) return finish(box(ce, ["Ln", 2]), numeric); // removable
  // Integer s: (1 − 2^{1−s}) ζ(s), which CE reduces at the even and nonpositive integers.
  if (isRealInt(s)) {
    const r: Json = ["Multiply", ["Subtract", 1, ["Power", 2, 1 - s.re]], ["Zeta", s.re]];
    return finish(box(ce, r), numeric);
  }
  // Real s: the same identity, left to compute-engine's arbitrary-precision Zeta rather than
  // to the double-precision alternating-series kernel.
  if (numeric && isFiniteNum(s) && s.im === 0) {
    const viaZeta = atEnginePrecision(
      ce,
      box(ce, ["Multiply", ["Subtract", 1, ["Power", 2, ["Subtract", 1, json(s)]]], ["Zeta", json(s)]]).N(),
    );
    if (viaZeta !== undefined) return viaZeta;
  }
  if (numeric && isFiniteNum(s)) return numberResult(ce, dirichletEta(cx(s.re, s.im)));
  return undefined;
}

function evaluateBeta(ce: ComputeEngine, s: BoxedExpression, numeric: boolean) {
  if (isRealInt(s)) {
    const n = s.re;
    let r: Json | undefined;
    if (n === 1) r = ["Divide", "Pi", 4];
    else if (n === 2) r = "Catalan";
    else if (n > 2 && n % 2 === 1) {
      // β(2k+1) = (−1)^k E₂ₖ π^{2k+1} / (4^{k+1} (2k)!)
      const k = (n - 1) / 2;
      let fact = 1n;
      for (let i = 2; i <= 2 * k; i++) fact *= BigInt(i);
      const sign = k % 2 === 0 ? 1n : -1n;
      const num = sign * eulerNumber(k);
      const den = 4n ** BigInt(k + 1) * fact;
      r = ["Multiply", ["Rational", bigint(num), bigint(den)], ["Power", "Pi", n]];
    } else if (n <= 0 && n % 2 === 0) r = ["Rational", bigint(eulerNumber(-n / 2)), 2]; // β(−2k) = E₂ₖ/2
    else if (n < 0) r = 0; // β(−(2k+1)) = 0
    if (r !== undefined) return finish(box(ce, r), numeric);
  }
  // Real s: β(s) = 4^{-s}(ζ(s, ¼) − ζ(s, ¾)), which rides HurwitzZeta's arbitrary-precision
  // path rather than the double-precision kernel.
  if (numeric && isFiniteNum(s) && s.im === 0) {
    const viaHurwitz = atEnginePrecision(
      ce,
      box(ce, [
        "Multiply",
        ["Power", 4, ["Negate", json(s)]],
        ["Subtract", ["HurwitzZeta", json(s), ["Rational", 1, 4]], ["HurwitzZeta", json(s), ["Rational", 3, 4]]],
      ]).N(),
    );
    if (viaHurwitz !== undefined) return viaHurwitz;
  }
  if (numeric && isFiniteNum(s)) return numberResult(ce, dirichletBeta(cx(s.re, s.im)));
  return undefined;
}

/** χ_j(n) mod k as MathJSON: 0, ±1, ±i exactly, otherwise a root of unity e^{2πi·num/den}. */
function characterExpr(k: number, j: number, n: number): Json {
  const q = characterExponent(k, j, n);
  if (q === undefined) return 0;
  const [num, den] = q;
  if (num === 0) return 1;
  if (2 * num === den) return -1;
  if (4 * num === den) return "ImaginaryUnit";
  if (4 * num === 3 * den) return ["Negate", "ImaginaryUnit"];
  return ["Exp", ["Multiply", 2, "Pi", "ImaginaryUnit", ["Rational", num, den]]];
}

/** A modulus/index pair naming a character: k ≥ 1 and 1 ≤ j ≤ φ(k), both concrete integers. */
const isCharacterIndex = (k: BoxedExpression, j: BoxedExpression): boolean =>
  isRealInt(k) && isRealInt(j) && k.re >= 1 && j.re >= 1 && j.re <= eulerPhi(k.re);

function evaluateCharacter(
  ce: ComputeEngine,
  k: BoxedExpression,
  j: BoxedExpression,
  n: BoxedExpression,
  numeric: boolean,
) {
  if (!isCharacterIndex(k, j) || !isRealInt(n)) return undefined;
  return finish(box(ce, characterExpr(k.re, j.re, n.re)), numeric);
}

/** The primes dividing k, ascending. */
function primeFactors(k: number): number[] {
  const out: number[] = [];
  for (let p = 2; p * p <= k; p++) {
    if (k % p) continue;
    while (k % p === 0) k /= p;
    out.push(p);
  }
  if (k > 1) out.push(k);
  return out;
}

function evaluateDirichletL(
  ce: ComputeEngine,
  k: BoxedExpression,
  j: BoxedExpression,
  s: BoxedExpression,
  numeric: boolean,
) {
  if (!isCharacterIndex(k, j)) return undefined;
  const m = k.re;
  const sJson = json(s);

  // The principal character: L(s, χ₁) = ζ(s) Π_{p | k} (1 − p^{−s}) — exact, symbolic in s,
  // and it carries ζ's pole at s = 1. Skipped for a concretely complex s, whose ζ(s)
  // compute-engine cannot evaluate numerically; those fall through to the kernel.
  const complexS = isFiniteNum(s) && s.im !== 0;
  if (j.re === 1 && !complexS) {
    const factors = primeFactors(m).map((p): Json => ["Subtract", 1, ["Power", p, ["Negate", sJson]]]);
    return finish(box(ce, ["Multiply", ["Zeta", sJson], ...factors]), numeric);
  }
  // The odd character mod 4 IS the Dirichlet beta function.
  if (m === 4 && j.re === 2) return finish(box(ce, ["DirichletBeta", sJson]), numeric);

  // Nonpositive integer s: L(−n, χ) = −k^n Σ_r χ(r) B_{n+1}(r/k) / (n+1), exact.
  if (isRealInt(s) && s.re <= 0) {
    const n = -s.re;
    const terms: Json[] = [];
    for (let r = 1; r <= m; r++) {
      const chi = characterExpr(m, j.re, r);
      if (chi === 0) continue;
      terms.push(["Multiply", chi, bernoulliPolyExpr(n + 1, ["Rational", r, m])]);
    }
    const total: Json = terms.length === 1 ? terms[0] : ["Add", ...terms];
    return finish(box(ce, ["Negate", ["Divide", ["Multiply", ["Power", m, n], total], n + 1]]), numeric);
  }

  if (numeric && isFiniteNum(s)) return numberResult(ce, dirichletL(m, j.re, cx(s.re, s.im)));
  return undefined;
}

export const dirichlet: Patch = {
  id: "dirichlet",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "DirichletEta, DirichletBeta, DirichletCharacter and DirichletL",

  fixed: (ce) =>
    ce.lookupDefinition("DirichletEta") !== undefined &&
    ce.lookupDefinition("DirichletBeta") !== undefined &&
    ce.lookupDefinition("DirichletL") !== undefined,

  apply: (ce) => {
    // Catalan's constant G = β(2) = Cl₂(π/2); DirichletBeta's exact value there. Wolfram's
    // `Catalan`. @enumeratio/analytic also declares this (its own special-functions.ts, for
    // heads that stayed there); guarded so whichever declarant runs first wins, harmlessly.
    if (ce.lookupDefinition("Catalan") === undefined) {
      ce.declare("Catalan", {
        type: "real",
        isConstant: true,
        holdUntil: "N",
        value: ce.number("0.9159655941772190150546035149323841107741493742816721342664981196217630197762547694794"),
      });
    }

    ce.declare("DirichletEta", {
      signature: "(number) -> number",
      broadcastable: true,
      evaluate: (ops, options) =>
        ops[0] === undefined ? undefined : evaluateEta(ce, ops[0], wantsNumber(ops, options)),
    });

    ce.declare("DirichletBeta", {
      signature: "(number) -> number",
      broadcastable: true,
      evaluate: (ops, options) =>
        ops[0] === undefined ? undefined : evaluateBeta(ce, ops[0], wantsNumber(ops, options)),
    });

    ce.declare("DirichletCharacter", {
      signature: "(integer, integer, integer) -> number",
      evaluate: (ops, options) =>
        ops[0] === undefined || ops[1] === undefined || ops[2] === undefined
          ? undefined
          : evaluateCharacter(ce, ops[0], ops[1], ops[2], wantsNumber(ops, options)),
    });

    ce.declare("DirichletL", {
      signature: "(integer, integer, number) -> number",
      evaluate: (ops, options) =>
        ops[0] === undefined || ops[1] === undefined || ops[2] === undefined
          ? undefined
          : evaluateDirichletL(ce, ops[0], ops[1], ops[2], wantsNumber(ops, options)),
    });
  },
};

export {
  dirichletEta,
  dirichletEtaReal,
  dirichletBeta,
  dirichletBetaReal,
  character,
  characterExponent,
  dirichletL,
  dirichletLReal,
  eulerPhi,
};
