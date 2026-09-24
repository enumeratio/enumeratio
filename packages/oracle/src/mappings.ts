// Head → external-system source, discriminated by SIGNATURE rather than by name.
//
// A name map is not enough, and `Zeta` is the reason. compute-engine's one-argument `Zeta`
// is Riemann's; its two-argument form is Hurwitz's. SymPy spells both `zeta` with an
// optional second argument; mpmath likewise; Sage has a separate `hurwitz_zeta` and its
// plain `zeta` takes one argument only. So "what does `Zeta` mean over there" has no
// answer — "what does `Zeta` of two arguments mean over there" does. Arity is the coarsest
// useful discriminator and the one used here; `when` is available for the cases where arity
// is not enough (a real versus complex branch, say).
//
// Templates substitute `$1`, `$2`, … with the emitted operands. A system absent from `emit`
// is UNMAPPED, which a scan reports as its own outcome — not as a disagreement, and not as
// evidence the function is missing. Growing this table is the iteration: the scan says which
// head is costing the most coverage, you add a row, you rescan.

import type { System } from "./systems.ts";

export interface Mapping {
  readonly head: string;
  /** Operand count this row applies to. Omitted matches any arity. */
  readonly arity?: number;
  /** Source template per system, `$n` for the n-th operand. */
  readonly emit: Partial<Record<System, string>>;
  /** A convention difference worth remembering when a scan disagrees. */
  readonly note?: string;
}

export const MAPPINGS: readonly Mapping[] = [
  // ── arithmetic and structure ────────────────────────────────────────────────
  { head: "Add", emit: { sympy: "($*+)", mpmath: "($*+)", sage: "($*+)" } },
  { head: "Multiply", emit: { sympy: "($***)", mpmath: "($***)", sage: "($***)" } },
  {
    head: "Subtract",
    arity: 2,
    emit: { sympy: "($1 - $2)", mpmath: "($1 - $2)", sage: "($1 - $2)" },
  },
  { head: "Divide", arity: 2, emit: { sympy: "Rational($1, $2)", sage: "($1 / $2)" } },
  { head: "Negate", arity: 1, emit: { sympy: "(-$1)", mpmath: "(-$1)", sage: "(-$1)" } },
  { head: "Power", arity: 2, emit: { sympy: "($1**$2)", mpmath: "($1**$2)", sage: "($1^$2)" } },
  { head: "Rational", arity: 2, emit: { sympy: "Rational($1, $2)", sage: "($1/$2)" } },
  { head: "Sqrt", arity: 1, emit: { sympy: "sqrt($1)", mpmath: "sqrt($1)", sage: "sqrt($1)" } },
  { head: "Abs", arity: 1, emit: { sympy: "Abs($1)", mpmath: "fabs($1)", sage: "abs($1)" } },
  { head: "Exp", arity: 1, emit: { sympy: "exp($1)", mpmath: "exp($1)", sage: "exp($1)" } },
  { head: "Ln", arity: 1, emit: { sympy: "log($1)", mpmath: "log($1)", sage: "log($1)" } },
  { head: "List", emit: { sympy: "[$*,]", sage: "[$*,]" } },

  // ── the special functions, where the oracles are authoritative ──────────────
  {
    head: "Zeta",
    arity: 1,
    emit: { wolfram: "Zeta[$1]", sympy: "zeta($1)", mpmath: "zeta($1)", sage: "zeta($1)" },
    note: "Riemann ζ at one argument, in every system.",
  },
  {
    head: "Zeta",
    arity: 2,
    emit: {
      wolfram: "Zeta[$1, $2]",
      sympy: "zeta($1, $2)",
      mpmath: "zeta($1, $2)",
      sage: "hurwitz_zeta($1, $2)",
    },
    note: "Two arguments is Hurwitz. Wolfram's Zeta[s, a] drops the n+a=0 term like ours does (its HurwitzZeta[s, 0] diverges); Sage spells it hurwitz_zeta; SymPy and mpmath overload zeta.",
  },
  {
    head: "HurwitzZeta",
    arity: 2,
    emit: {
      wolfram: "HurwitzZeta[$1, $2]",
      sympy: "zeta($1, $2)",
      mpmath: "zeta($1, $2)",
      sage: "hurwitz_zeta($1, $2)",
    },
    note: "mpmath is correct at negative-integer s where Wolfram's N[] is not — see analytic/scripts/validate-mpmath.ts.",
  },
  {
    head: "LerchPhi",
    arity: 3,
    emit: {
      wolfram: "LerchPhi[$1, $2, $3]",
      sympy: "lerchphi($1, $2, $3)",
      mpmath: "lerchphi($1, $2, $3)",
    },
  },
  {
    head: "PolyLog",
    arity: 2,
    emit: {
      wolfram: "PolyLog[$1, $2]",
      sympy: "polylog($1, $2)",
      mpmath: "polylog($1, $2)",
      sage: "polylog($1, $2)",
    },
  },
  {
    head: "PolyGamma",
    arity: 2,
    emit: {
      wolfram: "PolyGamma[$1, $2]",
      sympy: "polygamma($1, $2)",
      mpmath: "psi($1, $2)",
      sage: "psi($1, $2)",
    },
    note: "mpmath and Sage call it psi; the argument order matches.",
  },
  {
    head: "Gamma",
    arity: 1,
    emit: { wolfram: "Gamma[$1]", sympy: "gamma($1)", mpmath: "gamma($1)", sage: "gamma($1)" },
  },

  // ── combinatorics and number theory ─────────────────────────────────────────
  {
    head: "Binomial",
    arity: 2,
    emit: { wolfram: "Binomial[$1, $2]", sympy: "binomial($1, $2)", sage: "binomial($1, $2)" },
  },
  {
    head: "Factorial",
    arity: 1,
    emit: { wolfram: "Factorial[$1]", sympy: "factorial($1)", sage: "factorial($1)" },
  },
  {
    head: "Fibonacci",
    arity: 1,
    emit: { wolfram: "Fibonacci[$1]", sympy: "fibonacci($1)", sage: "fibonacci($1)" },
  },
  {
    head: "LucasL",
    arity: 1,
    emit: { wolfram: "LucasL[$1]", sympy: "lucas($1)", sage: "lucas_number2($1, 1, -1)" },
  },
  {
    head: "CatalanNumber",
    arity: 1,
    emit: { wolfram: "CatalanNumber[$1]", sympy: "catalan($1)", sage: "catalan_number($1)" },
  },
  {
    head: "BellNumber",
    arity: 1,
    emit: { wolfram: "BellB[$1]", sympy: "bell($1)", sage: "bell_number($1)" },
    note: "Wolfram spells it BellB.",
  },
  {
    head: "Stirling",
    arity: 2,
    emit: {
      wolfram: "StirlingS2[$1, $2]",
      sympy: "stirling($1, $2)",
      sage: "stirling_number2($1, $2)",
    },
    note: "compute-engine's Stirling is the SECOND kind; see design/upstreaming.md §3.5.",
  },
  {
    head: "StirlingS1",
    arity: 2,
    emit: { wolfram: "StirlingS1[$1, $2]", sage: "stirling_number1($1, $2)" },
    note: "Signed in Wolfram and compute-engine; Sage's stirling_number1 is UNSIGNED, so a sign difference here is expected, not a bug.",
  },
  {
    head: "Totient",
    arity: 1,
    emit: { wolfram: "EulerPhi[$1]", sympy: "totient($1)", sage: "euler_phi($1)" },
  },
  {
    head: "MoebiusMu",
    arity: 1,
    emit: { wolfram: "MoebiusMu[$1]", sympy: "mobius($1)", sage: "moebius($1)" },
  },
  {
    head: "PrimePi",
    arity: 1,
    emit: { wolfram: "PrimePi[$1]", sympy: "primepi($1)", sage: "prime_pi($1)" },
  },
  {
    head: "GCD",
    arity: 2,
    emit: { wolfram: "GCD[$1, $2]", sympy: "gcd($1, $2)", sage: "gcd($1, $2)" },
  },
  {
    head: "LCM",
    arity: 2,
    emit: { wolfram: "LCM[$1, $2]", sympy: "lcm($1, $2)", sage: "lcm($1, $2)" },
  },
  {
    head: "PowerModList",
    arity: 3,
    emit: { wolfram: "PowerModList[$1, $2, $3]" },
    note: "Sage reaches this through Zmod(m)(a).nth_root(b, all=True); no one-liner in SymPy.",
  },
  {
    head: "PrimitiveRootList",
    arity: 1,
    emit: { wolfram: "PrimitiveRootList[$1]" },
  },
  {
    head: "RationalReconstruction",
    arity: 2,
    emit: { sage: "rational_reconstruction($1, $2)" },
  },
  {
    head: "IntegerExponent",
    arity: 2,
    emit: { wolfram: "IntegerExponent[$1, $2]", sympy: "multiplicity($2, $1)" },
  },
  {
    head: "HermiteDecomposition",
    arity: 1,
    emit: { wolfram: "HermiteDecomposition[$1]" },
  },
  {
    head: "ContinuedFraction",
    arity: 1,
    emit: {
      wolfram: "ContinuedFraction[$1]",
      sympy: "list(continued_fraction($1))",
      sage: "continued_fraction($1)",
    },
  },

  // ── added from a scan's work queue; see reference/scripts/oracle-scan.ts ─────────────────────
  {
    head: "Equal",
    arity: 2,
    emit: {
      wolfram: "($1 == $2)",
      sympy: "bool(Eq($1, $2))",
      mpmath: "($1 == $2)",
      sage: "bool($1 == $2)",
    },
    note: "The single most valuable row: a large share of documented examples are identities written as Equal.",
  },
  {
    head: "Square",
    arity: 1,
    emit: { wolfram: "($1)^2", sympy: "($1)**2", mpmath: "($1)**2", sage: "($1)^2" },
  },
  {
    head: "Sin",
    arity: 1,
    emit: { wolfram: "Sin[$1]", sympy: "sin($1)", mpmath: "sin($1)", sage: "sin($1)" },
  },
  {
    head: "Cos",
    arity: 1,
    emit: { wolfram: "Cos[$1]", sympy: "cos($1)", mpmath: "cos($1)", sage: "cos($1)" },
  },
  {
    head: "Tan",
    arity: 1,
    emit: { wolfram: "Tan[$1]", sympy: "tan($1)", mpmath: "tan($1)", sage: "tan($1)" },
  },
  {
    head: "Sign",
    arity: 1,
    emit: { wolfram: "Sign[$1]", sympy: "sign($1)", mpmath: "sign($1)", sage: "sign($1)" },
  },
  {
    head: "Floor",
    arity: 1,
    emit: { wolfram: "Floor[$1]", sympy: "floor($1)", mpmath: "floor($1)", sage: "floor($1)" },
  },
  {
    head: "Ceil",
    arity: 1,
    emit: { wolfram: "Ceiling[$1]", sympy: "ceiling($1)", mpmath: "ceil($1)", sage: "ceil($1)" },
  },
  {
    head: "IsPrime",
    arity: 1,
    emit: { wolfram: "PrimeQ[$1]", sympy: "isprime($1)", sage: "is_prime($1)" },
  },
  {
    head: "Prime",
    arity: 1,
    emit: { wolfram: "Prime[$1]", sympy: "prime($1)", sage: "nth_prime($1)" },
  },
  {
    head: "BernoulliB",
    arity: 1,
    emit: { wolfram: "BernoulliB[$1]", sympy: "bernoulli($1)", sage: "bernoulli($1)" },
  },
  { head: "Max", emit: { wolfram: "Max[$*,]", sympy: "Max($*,)", sage: "max([$*,])" } },
  { head: "Min", emit: { wolfram: "Min[$*,]", sympy: "Min($*,)", sage: "min([$*,])" } },
  {
    head: "Mod",
    arity: 2,
    emit: { wolfram: "Mod[$1, $2]", sympy: "($1 % $2)", sage: "($1 % $2)" },
  },
  { head: "Length", arity: 1, emit: { wolfram: "Length[$1]", sympy: "len($1)", sage: "len($1)" } },
];

/** The mapping that applies to a head at a given arity, preferring the arity-specific one. */
export function mappingFor(head: string, arity: number): Mapping | undefined {
  const rows = MAPPINGS.filter((mapping) => mapping.head === head);
  return rows.find((mapping) => mapping.arity === arity) ?? rows.find((m) => m.arity === undefined);
}

/** Every head this table says anything about. */
export const mappedHeads = (): string[] => [...new Set(MAPPINGS.map((m) => m.head))].sort();
