// Reference definitions — each analytic special function written AS AN EXPRESSION, over
// `_`-prefixed wildcards in parameter order, in terms of heads compute-engine already has.
//
// These are not what runs; the kernels in this package stay the implementation. What these
// are for (design/namespaces.md §6):
//
//   1. they SAY what the head means, in a form a reader can unfold (≝) and evaluate;
//   2. they are a differential oracle for the kernel — `tests/definitions.test.ts` evaluates
//      both and checks they agree, which is what stops a second implementation from rotting;
//   3. they place each head against the primitive frontier. `@enumeratio/reference` reads
//      them straight from here, so the symbol pages and the definitions cannot drift apart.
//
// WILDCARD ORDER IS LOAD-BEARING: the unfold binds call arguments to wildcards in order of
// FIRST APPEARANCE, so each definition is spelled to introduce them in parameter order. That
// is why the Dirichlet series below is written `exp(-s·ln(n+a))` rather than `(n+a)^{-s}`:
// same principal branch, but `_s` comes first.

import type { Json } from "./bernoulli.ts";

/** Σ over n ≥ 0 of `summand`. */
const seriesOverN = (summand: Json): Json => ["Sum", summand, ["Triple", "n", 0, "Infinity"]];

/** (n + a)^{-s}, on the principal branch, with `_s` introduced before `_a`. */
const term = (s: Json, a: Json): Json => ["Exp", ["Multiply", ["Negate", s], ["Ln", ["Add", "n", a]]]];

/** Li_ν(e^{iθ}) — the polylogarithm on the unit circle, which the Clausen functions cut in two. */
const polyLogOnCircle: Json = ["PolyLog", "_n", ["Exp", ["Multiply", "ImaginaryUnit", "_theta"]]];

/** ln G(1+w) by the Weierstrass product, in logarithms. The terms are O(w³/k²), so it converges. */
const logBarnesGShifted = (w: Json): Json => [
  "Add",
  ["Divide", ["Multiply", w, ["Ln", ["Multiply", 2, "Pi"]]], 2],
  ["Negate", ["Divide", ["Multiply", w, ["Add", w, 1]], 2]],
  ["Negate", ["Divide", ["Multiply", "EulerGamma", ["Power", w, 2]], 2]],
  [
    "Sum",
    [
      "Add",
      ["Multiply", "k", ["Ln", ["Add", 1, ["Divide", w, "k"]]]],
      ["Divide", ["Power", w, 2], ["Multiply", 2, "k"]],
      ["Negate", w],
    ],
    ["Triple", "k", 1, "Infinity"],
  ],
];

const LOG_BARNES_G: Json = logBarnesGShifted(["Subtract", "_z", 1]);

export const DEFINITIONS: Readonly<Record<string, Json>> = {
  /** The Dirichlet series ζ(s, a) = Σ_{n≥0} (n+a)^{-s}, continued elsewhere. */
  HurwitzZeta: seriesOverN(term("_s", "_a")),

  /** H_z = ψ(z+1) + γ — the standard digamma identity, exact at the integers too. */
  HarmonicNumber: ["Add", ["PolyGamma", 0, ["Add", "_z", 1]], "EulerGamma"],

  /** Φ(z, s, a) = Σ_{n≥0} zⁿ (n+a)^{-s}; ζ(s, a) is the z = 1 case. */
  LerchPhi: seriesOverN(["Multiply", ["Power", "_z", "n"], term("_s", "_a")]),

  // Cl_n splits Li_n(e^{iθ}) by parity: the even orders are the sine series (its imaginary
  // part), the odd orders the cosine series (its real part).
  // `Which`, not `If`: compute-engine hands back the chosen branch of an `If` unevaluated,
  // so an `If` here would need a second N() to produce a number.
  ClausenCl: ["Which", ["IsEven", "_n"], ["Im", polyLogOnCircle], "True", ["Re", polyLogOnCircle]],

  /** The continuation fixed by lnΓ(1) = 0 and (lnΓ)' = ψ — not `Ln(Gamma(z))`, whose branch differs. */
  LogGamma: ["Integrate", ["PolyGamma", 0, "t"], ["Triple", "t", 1, "_z"]],

  LogBarnesG: LOG_BARNES_G,

  BarnesG: ["Exp", LOG_BARNES_G],

  /** η(s) = (1 − 2^{1−s}) ζ(s) — except at s = 1, where the kernel sums the alternating series. */
  DirichletEta: ["Multiply", ["Subtract", 1, ["Power", 2, ["Subtract", 1, "_s"]]], ["Zeta", "_s"]],

  /** β(s) = 4^{-s}(ζ(s, ¼) − ζ(s, ¾)) — the odd character mod 4, split across two Hurwitz zetas. */
  DirichletBeta: [
    "Multiply",
    ["Power", 4, ["Negate", "_s"]],
    ["Subtract", ["HurwitzZeta", "_s", ["Rational", 1, 4]], ["HurwitzZeta", "_s", ["Rational", 3, 4]]],
  ],

  /**
   * L(s, χ) = k^{-s} Σ_{r=1}^{k} χ(r) ζ(s, r/k) — the Hurwitz decomposition. The sum leads so
   * that the wildcards appear in the head's own order (k, j, s).
   */
  DirichletL: [
    "Multiply",
    [
      "Sum",
      ["Multiply", ["DirichletCharacter", "_k", "_j", "r"], ["HurwitzZeta", "_s", ["Divide", "r", "_k"]]],
      ["Triple", "r", 1, "_k"],
    ],
    ["Power", "_k", ["Negate", "_s"]],
  ],
};

/**
 * Heads that do NOT reduce, with the reason — the primitive frontier for this package
 * (design/namespaces.md §6.1). Being on it is a claim to be justified, not a place to put
 * anything inconvenient.
 */
export const PRIMITIVE: Readonly<Record<string, string>> = {
  // The indexing of (ℤ/k)ˣ into cyclic factors, then a mixed-radix read of j − 1. A table
  // built by an algorithm over mutable state; the tree would teach a reader nothing.
  DirichletCharacter: "kernel",
  // γ_n(a) IS a Laurent coefficient of ζ(s, a) at s = 1, so the definition is a limit of an
  // n-th derivative. compute-engine cannot take it: the head collapses to the pole at s = 1
  // before `Limit` sees a limit, and the partial-sum form converges too slowly to extrapolate.
  StieltjesGamma: "numeric",
};
