import {
  type BoxedExpression,
  type ComputeEngine,
  isNumber,
  isSymbol,
} from "@cortex-js/compute-engine";
import { barnesG, logBarnesG } from "./barnes-g.ts";
import { bernoulliPolyExpr } from "./bernoulli.ts";
import { type BoxInput, type EvalOptions, isFiniteNum, isRealInt, numberResult } from "./box.ts";
import { evaluateChebyshevT, evaluateChebyshevU } from "./chebyshev.ts";
import { clausen } from "./clausen.ts";
import { cx } from "./complex.ts";
import { dirichletBeta, dirichletEta } from "./dirichlet.ts";
import { characterExponent, dirichletL, eulerPhi } from "./dirichlet-l.ts";
import { evaluateHarmonicNumber } from "./harmonic.ts";
import { evaluateLegendreP } from "./legendre.ts";
import { logGamma } from "./loggamma.ts";
import { atEnginePrecision } from "./precise.ts";
import { evaluateRisingFactorial } from "./rising-factorial.ts";
import { stieltjesGamma } from "./stieltjes.ts";

// The heads for the special functions beyond the zeta family — BarnesG, LogBarnesG,
// LogGamma, ClausenCl, DirichletEta, DirichletBeta, StieltjesGamma, DirichletCharacter,
// DirichletL, HarmonicNumber, ChebyshevT, ChebyshevU, LegendrePolynomial, RisingFactorial —
// plus the Catalan constant several of their closed forms land on. Same shape as the zeta
// heads: exact Wolfram reductions first, then the numeric kernel when a number is wanted,
// symbolic otherwise. Declared by `declareAnalytic`.

type Json = number | string | { num: string } | Json[];
const box = (ce: ComputeEngine, expr: Json): BoxedExpression => ce.box(expr as unknown as BoxInput);
const json = (x: BoxedExpression): Json => x.json as unknown as Json;

/** Evaluate `expr` the way the caller asked — to a number or symbolically. */
const finish = (expr: BoxedExpression, numeric: boolean): BoxedExpression =>
  numeric ? expr.N() : expr.evaluate();

const isNonPosInt = (x: BoxedExpression): boolean => isRealInt(x) && x.re <= 0;

/** Superfactorial Π_{k=0}^{n−2} k! = G(n) for a positive integer n, exact. */
function superfactorial(n: number): bigint {
  let g = 1n;
  let f = 1n;
  for (let k = 1; k <= n - 2; k++) {
    f *= BigInt(k);
    g *= f;
  }
  return g;
}

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

function evaluateLogGamma(ce: ComputeEngine, z: BoxedExpression, numeric: boolean) {
  if (isNonPosInt(z)) return ce.symbol("PositiveInfinity"); // Wolfram: Infinity at the poles
  if (isRealInt(z)) return finish(box(ce, ["Ln", ["Factorial", z.re - 1]]), numeric);
  if (!numeric && z.im === 0 && z.re === 0.5)
    return box(ce, ["Divide", ["Ln", "Pi"], 2]).evaluate();
  // z > 0: compute-engine's own GammaLn agrees with the continuation there, and carries
  // arbitrary precision where the double kernel below is stuck at ~1e-15. Left of the origin
  // the continuation is complex (GammaLn keeps the real part but drops the winding, which is
  // −iπ⌈−z⌉ there) — and a compute-engine complex number is a pair of doubles, so routing
  // gains nothing. The kernel keeps that side.
  if (numeric && isFiniteNum(z) && z.im === 0 && z.re > 0) {
    const native = atEnginePrecision(ce, box(ce, ["GammaLn", json(z)]).N());
    if (native !== undefined) return native;
  }
  if (numeric && isFiniteNum(z)) return numberResult(ce, logGamma(cx(z.re, z.im)));
  return undefined;
}

function evaluateBarnesG(ce: ComputeEngine, z: BoxedExpression, numeric: boolean, log: boolean) {
  if (isNonPosInt(z)) return log ? ce.symbol("NegativeInfinity") : ce.number(0);
  if (isRealInt(z)) {
    const g = bigint(superfactorial(z.re));
    return finish(box(ce, log ? ["Ln", g] : g), numeric);
  }
  if (numeric && isFiniteNum(z)) {
    const v = cx(z.re, z.im);
    return numberResult(ce, log ? logBarnesG(v) : barnesG(v));
  }
  return undefined;
}

function evaluateClausen(
  ce: ComputeEngine,
  n: BoxedExpression,
  theta: BoxedExpression,
  numeric: boolean,
) {
  if (!isRealInt(n) || n.re < 1) return undefined;
  const even = n.re % 2 === 0;
  // Cl_n(0): 0 for the sine series, ζ(n) for the cosine one (and Cl₁(0) = ∞).
  if (theta.im === 0 && theta.re === 0) {
    if (n.re === 1) return ce.symbol("PositiveInfinity");
    return finish(box(ce, even ? 0 : ["Zeta", n.re]), numeric);
  }
  // Cl_n(π) = 0 (even) or −η(n) (odd); Cl_n(π/2) = β(n) (even) or −2^{−n} η(n) (odd).
  if (isSymbol(theta) && theta.symbol === "Pi") {
    return finish(box(ce, even ? 0 : ["Negate", ["DirichletEta", n.re]]), numeric);
  }
  if (isHalfPi(theta)) {
    const r: Json = even
      ? ["DirichletBeta", n.re]
      : ["Negate", ["Multiply", ["Power", 2, -n.re], ["DirichletEta", n.re]]];
    return finish(box(ce, r), numeric);
  }
  if (numeric && isFiniteNum(theta) && theta.im === 0) {
    return numberResult(ce, cx(clausen(n.re, theta.re)));
  }
  return undefined;
}

/** Is this expression literally π/2 (as CE canonicalises it: Half·Pi or Pi/2)? */
const isHalfPi = (x: BoxedExpression): boolean => {
  const j = JSON.stringify(x.json);
  return (
    j === JSON.stringify(["Multiply", ["Rational", 1, 2], "Pi"]) ||
    j === JSON.stringify(["Divide", "Pi", 2]) ||
    j === JSON.stringify(["Multiply", "Half", "Pi"])
  );
};

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
      box(ce, [
        "Multiply",
        ["Subtract", 1, ["Power", 2, ["Subtract", 1, json(s)]]],
        ["Zeta", json(s)],
      ]).N(),
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
        [
          "Subtract",
          ["HurwitzZeta", json(s), ["Rational", 1, 4]],
          ["HurwitzZeta", json(s), ["Rational", 3, 4]],
        ],
      ]).N(),
    );
    if (viaHurwitz !== undefined) return viaHurwitz;
  }
  if (numeric && isFiniteNum(s)) return numberResult(ce, dirichletBeta(cx(s.re, s.im)));
  return undefined;
}

/** Past this order the double-precision Euler–Maclaurin kernel drifts beyond ~1e-7. */
const STIELTJES_MAX_ORDER = 30;

function evaluateStieltjes(
  ce: ComputeEngine,
  n: BoxedExpression,
  a: BoxedExpression | undefined,
  numeric: boolean,
) {
  if (!isRealInt(n) || n.re < 0) return undefined;
  if (a === undefined) {
    if (n.re === 0) return finish(ce.symbol("EulerGamma"), numeric);
  } else {
    if (isNonPosInt(a)) return ce.symbol("ComplexInfinity");
    if (n.re === 0) {
      // γ₀(a) = −ψ(a); the native digamma is real-only, so a complex a that it leaves
      // unevaluated falls through to the kernel below.
      const r = finish(box(ce, ["Negate", ["PolyGamma", 0, json(a)]]), numeric);
      if (!numeric || isNumber(r)) return r;
    }
  }
  if (n.re > STIELTJES_MAX_ORDER) return undefined;
  const av = a === undefined ? cx(1) : cx(a.re, a.im);
  if (numeric && Number.isFinite(av.re) && Number.isFinite(av.im)) {
    return numberResult(ce, stieltjesGamma(n.re, av));
  }
  return undefined;
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
    const factors = primeFactors(m).map((p): Json => [
      "Subtract",
      1,
      ["Power", p, ["Negate", sJson]],
    ]);
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
    return finish(
      box(ce, ["Negate", ["Divide", ["Multiply", ["Power", m, n], total], n + 1]]),
      numeric,
    );
  }

  if (numeric && isFiniteNum(s)) return numberResult(ce, dirichletL(m, j.re, cx(s.re, s.im)));
  return undefined;
}

/** A float literal operand — a float in means a float out, as CE's own handlers behave. */
const inexact = (x: BoxedExpression): boolean =>
  (x as Partial<{ isExact: boolean }>).isExact === false;

/** The evaluate option plus the float-operand rule, as one flag. */
const wants = (ops: readonly BoxedExpression[], options: EvalOptions): boolean =>
  (options.numericApproximation ?? false) || ops.some(inexact);

export function declareSpecialFunctions(ce: ComputeEngine): void {
  // Catalan's constant G = β(2) = Cl₂(π/2) = 0.9159655941…; Wolfram's `Catalan`.
  if (ce.lookupDefinition("Catalan") === undefined) {
    ce.declare("Catalan", {
      type: "real",
      isConstant: true,
      holdUntil: "N",
      value: ce.number(
        "0.9159655941772190150546035149323841107741493742816721342664981196217630197762547694794",
      ),
    });
  }

  ce.declare("LogGamma", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops, options) =>
      ops[0] === undefined ? undefined : evaluateLogGamma(ce, ops[0], wants(ops, options)),
  });

  ce.declare("BarnesG", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops, options) =>
      ops[0] === undefined ? undefined : evaluateBarnesG(ce, ops[0], wants(ops, options), false),
  });

  ce.declare("LogBarnesG", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops, options) =>
      ops[0] === undefined ? undefined : evaluateBarnesG(ce, ops[0], wants(ops, options), true),
  });

  ce.declare("ClausenCl", {
    signature: "(integer, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateClausen(ce, ops[0], ops[1], wants(ops, options)),
  });

  ce.declare("DirichletEta", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops, options) =>
      ops[0] === undefined ? undefined : evaluateEta(ce, ops[0], wants(ops, options)),
  });

  ce.declare("DirichletBeta", {
    signature: "(number) -> number",
    broadcastable: true,
    evaluate: (ops, options) =>
      ops[0] === undefined ? undefined : evaluateBeta(ce, ops[0], wants(ops, options)),
  });

  ce.declare("DirichletCharacter", {
    signature: "(integer, integer, integer) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined || ops[2] === undefined
        ? undefined
        : evaluateCharacter(ce, ops[0], ops[1], ops[2], wants(ops, options)),
  });

  ce.declare("DirichletL", {
    signature: "(integer, integer, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined || ops[2] === undefined
        ? undefined
        : evaluateDirichletL(ce, ops[0], ops[1], ops[2], wants(ops, options)),
  });

  ce.declare("StieltjesGamma", {
    signature: "(integer, number?) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined ? undefined : evaluateStieltjes(ce, ops[0], ops[1], wants(ops, options)),
  });

  ce.declare("HarmonicNumber", {
    signature: "(number, number?) -> number",
    evaluate: (ops, options) => evaluateHarmonicNumber(ce, ops, wants(ops, options)),
  });

  ce.declare("ChebyshevT", {
    signature: "(integer, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateChebyshevT(ce, ops[0], ops[1], wants(ops, options)),
  });

  ce.declare("ChebyshevU", {
    signature: "(integer, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateChebyshevU(ce, ops[0], ops[1], wants(ops, options)),
  });

  ce.declare("LegendrePolynomial", {
    signature: "(integer, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateLegendreP(ce, ops[0], ops[1], wants(ops, options)),
  });

  ce.declare("RisingFactorial", {
    signature: "(number, number) -> number",
    evaluate: (ops, options) =>
      ops[0] === undefined || ops[1] === undefined
        ? undefined
        : evaluateRisingFactorial(ce, ops[0], ops[1], wants(ops, options)),
  });
}
