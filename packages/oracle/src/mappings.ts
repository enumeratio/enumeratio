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
  {
    head: "Add",
    emit: {
      sympy: "($*+)",
      mpmath: "($*+)",
      sage: "($*+)",
      oscar: "($*+)",
      julia: "($*+)",
      mathlib4: "($*+)",
      rust: "($*+)",
    },
  },
  {
    head: "Multiply",
    emit: {
      sympy: "($**)",
      mpmath: "($**)",
      sage: "($**)",
      oscar: "($**)",
      julia: "($**)",
      mathlib4: "($**)",
      rust: "($**)",
    },
  },
  {
    head: "Subtract",
    arity: 2,
    emit: {
      sympy: "($1 - $2)",
      mpmath: "($1 - $2)",
      sage: "($1 - $2)",
      oscar: "($1 - $2)",
      julia: "($1 - $2)",
      mathlib4: "($1 - $2)",
      rust: "($1 - $2)",
    },
  },
  {
    head: "Divide",
    arity: 2,
    emit: {
      sympy: "Rational($1, $2)",
      sage: "($1 / $2)",
      oscar: "($1 // $2)",
      julia: "($1 // $2)",
      mathlib4: "(($1 : ℚ) / $2)",
      rust: "($1 / $2)",
    },
  },
  {
    head: "Negate",
    arity: 1,
    emit: {
      sympy: "(-$1)",
      mpmath: "(-$1)",
      sage: "(-$1)",
      oscar: "(-($1))",
      julia: "(-($1))",
      mathlib4: "(-($1))",
      rust: "(-($1))",
    },
  },
  {
    head: "Power",
    arity: 2,
    emit: {
      sympy: "($1**$2)",
      mpmath: "($1**$2)",
      sage: "($1^$2)",
      oscar: "(big($1)^$2)",
      julia: "(big($1)^$2)",
      mathlib4: "($1 ^ $2)",
      rust: "power($1, $2)",
    },
  },
  {
    head: "Rational",
    arity: 2,
    emit: {
      sympy: "Rational($1, $2)",
      sage: "($1/$2)",
      oscar: "($1 // $2)",
      julia: "($1 // $2)",
      mathlib4: "(($1 : ℚ) / $2)",
      rust: "rational($1, $2)",
    },
  },
  {
    head: "Sqrt",
    arity: 1,
    emit: { sympy: "sqrt($1)", mpmath: "sqrt($1)", sage: "sqrt($1)", rust: "sqrt($1)" },
  },
  {
    head: "Abs",
    arity: 1,
    emit: { sympy: "Abs($1)", mpmath: "fabs($1)", sage: "abs($1)", rust: "abs($1)" },
  },
  {
    head: "Exp",
    arity: 1,
    emit: { sympy: "exp($1)", mpmath: "exp($1)", sage: "exp($1)", rust: "exp($1)" },
  },
  {
    head: "Ln",
    arity: 1,
    emit: { sympy: "log($1)", mpmath: "log($1)", sage: "log($1)", rust: "ln($1)" },
  },
  {
    head: "List",
    emit: {
      sympy: "[$*,]",
      sage: "[$*,]",
      oscar: "[$*,]",
      julia: "[$*,]",
      mathlib4: "[$*,]",
      rust: "list(vec![$*,])",
    },
  },

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
    emit: {
      wolfram: "Gamma[$1]",
      sympy: "gamma($1)",
      mpmath: "gamma($1)",
      sage: "gamma($1)",
      rust: "gamma($1)",
    },
  },

  // ── combinatorics and number theory ─────────────────────────────────────────
  {
    head: "Binomial",
    arity: 2,
    emit: {
      wolfram: "Binomial[$1, $2]",
      sympy: "binomial($1, $2)",
      sage: "binomial($1, $2)",
      oscar: "binomial(ZZ($1), ZZ($2))",
      julia: "binomial(ZZ($1), ZZ($2))",
      mathlib4: "(Nat.choose $1 $2)",
      rust: "binomial($1, $2)",
    },
  },
  {
    head: "Factorial",
    arity: 1,
    emit: {
      wolfram: "Factorial[$1]",
      sympy: "factorial($1)",
      sage: "factorial($1)",
      oscar: "factorial(ZZ($1))",
      julia: "factorial(ZZ($1))",
      mathlib4: "(Nat.factorial $1)",
      rust: "factorial($1)",
    },
  },
  {
    head: "Fibonacci",
    arity: 1,
    emit: {
      wolfram: "Fibonacci[$1]",
      sympy: "fibonacci($1)",
      sage: "fibonacci($1)",
      oscar: "fibonacci($1)",
      julia: "fibonacci($1)",
      mathlib4: "(Nat.fib $1)",
    },
  },
  {
    head: "LucasL",
    arity: 1,
    emit: {
      wolfram: "LucasL[$1]",
      sympy: "lucas($1)",
      sage: "lucas_number2($1, 1, -1)",
      julia: "Combinatorics.lucasnum($1)",
    },
  },
  {
    head: "CatalanNumber",
    arity: 1,
    emit: {
      wolfram: "CatalanNumber[$1]",
      sympy: "catalan($1)",
      sage: "catalan_number($1)",
      julia: "Combinatorics.catalannum($1)",
      mathlib4: "(catalan $1)",
    },
  },
  {
    head: "BellNumber",
    arity: 1,
    emit: {
      wolfram: "BellB[$1]",
      sympy: "bell($1)",
      sage: "bell_number($1)",
      oscar: "bell($1)",
      julia: "bell($1)",
    },
    note: "Wolfram spells it BellB.",
  },
  {
    head: "Stirling",
    arity: 2,
    emit: {
      wolfram: "StirlingS2[$1, $2]",
      sympy: "stirling($1, $2)",
      sage: "stirling_number2($1, $2)",
      julia: "Combinatorics.stirlings2($1, $2)",
      mathlib4: "(Nat.stirlingSecond $1 $2)",
    },
    note: "compute-engine's Stirling is the SECOND kind; see design/upstreaming.md §3.5.",
  },
  {
    head: "StirlingS1",
    arity: 2,
    emit: {
      wolfram: "StirlingS1[$1, $2]",
      sage: "stirling_number1($1, $2)",
      julia: "Combinatorics.stirlings1($1, $2)",
      mathlib4: "(Nat.stirlingFirst $1 $2)",
    },
    note: "Signed in Wolfram and compute-engine; Sage's stirling_number1, Combinatorics.jl's stirlings1 and Mathlib's Nat.stirlingFirst are UNSIGNED, so a sign difference here is expected, not a bug.",
  },
  {
    head: "Totient",
    arity: 1,
    emit: {
      wolfram: "EulerPhi[$1]",
      sympy: "totient($1)",
      sage: "euler_phi($1)",
      oscar: "euler_phi(ZZ($1))",
      julia: "euler_phi(ZZ($1))",
      mathlib4: "(Nat.totient $1)",
    },
  },
  {
    head: "MoebiusMu",
    arity: 1,
    emit: {
      wolfram: "MoebiusMu[$1]",
      sympy: "mobius($1)",
      sage: "moebius($1)",
      oscar: "moebius_mu($1)",
      julia: "moebius_mu($1)",
      mathlib4: "(ArithmeticFunction.moebius $1)",
    },
  },
  {
    head: "PrimePi",
    arity: 1,
    emit: {
      wolfram: "PrimePi[$1]",
      sympy: "primepi($1)",
      sage: "prime_pi($1)",
      mathlib4: "(Nat.primeCounting $1)",
      rust: "prime_pi($1)",
    },
  },
  {
    head: "GCD",
    arity: 2,
    emit: {
      wolfram: "GCD[$1, $2]",
      sympy: "gcd($1, $2)",
      sage: "gcd($1, $2)",
      oscar: "gcd(ZZ($1), ZZ($2))",
      julia: "gcd(ZZ($1), ZZ($2))",
      mathlib4: "(Int.gcd $1 $2)",
      rust: "gcd($1, $2)",
    },
  },
  {
    head: "LCM",
    arity: 2,
    emit: {
      wolfram: "LCM[$1, $2]",
      sympy: "lcm($1, $2)",
      sage: "lcm($1, $2)",
      oscar: "lcm(ZZ($1), ZZ($2))",
      julia: "lcm(ZZ($1), ZZ($2))",
      mathlib4: "(Int.lcm $1 $2)",
      rust: "lcm($1, $2)",
    },
  },
  {
    head: "PowerMod",
    arity: 3,
    emit: { sage: "power_mod($1, $2, $3)", rust: "powermod($1, $2, $3)" },
    note: "Sage's power_mod takes a negative exponent, like ours; no rational base or exponent.",
  },
  {
    head: "PowerModList",
    arity: 3,
    emit: { wolfram: "PowerModList[$1, $2, $3]", sage: "enumeratio_power_mod_list($1, $2, $3)" },
    note: "Sage reaches this through Zmod(m)(a).nth_root(b, all=True) (run.ts's SAGE_PREAMBLE); no one-liner in SymPy.",
  },
  {
    head: "PrimitiveRootList",
    arity: 1,
    emit: { wolfram: "PrimitiveRootList[$1]", sage: "enumeratio_primitive_root_list($1)" },
    note: "Sage's primitive_root gives one root only; run.ts's SAGE_PREAMBLE walks the powers coprime to phi(n).",
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
    head: "MultiplicativeOrder",
    arity: 2,
    emit: { sage: "Mod($1, $2).multiplicative_order()" },
  },
  {
    head: "ModularInverse",
    arity: 2,
    emit: { sage: "inverse_mod($1, $2)" },
  },
  {
    head: "FactorInteger",
    arity: 1,
    emit: { sage: "list(factor($1))" },
    note: "Sage has no unit factor for 1, 0 or a negative n — a shape difference from compute-engine's explicit 1^1/0^1/-1^1, not a bug.",
  },
  {
    head: "Divisors",
    arity: 1,
    emit: { sage: "divisors($1)" },
  },
  {
    head: "ContinuedFraction",
    arity: 1,
    emit: {
      wolfram: "ContinuedFraction[$1]",
      sympy: "list(continued_fraction($1))",
      sage: "list(continued_fraction($1))",
    },
    note: "Sage's continued_fraction returns a ContinuedFraction object (str() is '[3; 7, 16]'); list(...) gives the plain quotients, like the SymPy row.",
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
      oscar: "($1 == $2)",
      julia: "($1 == $2)",
      mathlib4: "(decide ($1 = $2))",
      rust: "equal($1, $2)",
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
    emit: {
      wolfram: "Sin[$1]",
      sympy: "sin($1)",
      mpmath: "sin($1)",
      sage: "sin($1)",
      rust: "sin($1)",
    },
  },
  {
    head: "Cos",
    arity: 1,
    emit: {
      wolfram: "Cos[$1]",
      sympy: "cos($1)",
      mpmath: "cos($1)",
      sage: "cos($1)",
      rust: "cos($1)",
    },
  },
  {
    head: "Tan",
    arity: 1,
    emit: {
      wolfram: "Tan[$1]",
      sympy: "tan($1)",
      mpmath: "tan($1)",
      sage: "tan($1)",
      rust: "tan($1)",
    },
  },
  {
    head: "Sign",
    arity: 1,
    emit: { wolfram: "Sign[$1]", sympy: "sign($1)", mpmath: "sign($1)", sage: "sign($1)" },
  },
  {
    head: "Floor",
    arity: 1,
    emit: {
      wolfram: "Floor[$1]",
      sympy: "floor($1)",
      mpmath: "floor($1)",
      sage: "floor($1)",
      rust: "floor($1)",
    },
  },
  {
    head: "Ceil",
    arity: 1,
    emit: {
      wolfram: "Ceiling[$1]",
      sympy: "ceiling($1)",
      mpmath: "ceil($1)",
      sage: "ceil($1)",
      rust: "ceil($1)",
    },
  },
  {
    head: "IsPrime",
    arity: 1,
    emit: {
      wolfram: "PrimeQ[$1]",
      sympy: "isprime($1)",
      sage: "is_prime($1)",
      oscar: "is_prime(ZZ($1))",
      julia: "is_prime(ZZ($1))",
      mathlib4: "(decide (Nat.Prime $1))",
      rust: "is_prime($1)",
    },
  },
  {
    head: "Prime",
    arity: 1,
    emit: {
      wolfram: "Prime[$1]",
      sympy: "prime($1)",
      sage: "nth_prime($1)",
      rust: "nth_prime($1)",
    },
  },
  {
    head: "BernoulliB",
    arity: 1,
    emit: { wolfram: "BernoulliB[$1]", sympy: "bernoulli($1)", sage: "bernoulli($1)" },
  },
  {
    head: "Max",
    emit: { wolfram: "Max[$*,]", sympy: "Max($*,)", sage: "enumeratio_max($*,)" },
    note: "Wolfram (and our Max) flattens nested lists into one pool; Sage's builtin max() on a list of lists compares them lexicographically instead, so it is routed through a flattening helper (run.ts's SAGE_PREAMBLE).",
  },
  {
    head: "Min",
    emit: { wolfram: "Min[$*,]", sympy: "Min($*,)", sage: "enumeratio_min($*,)" },
    note: "Same flattening as Max.",
  },
  {
    head: "Mod",
    arity: 2,
    emit: {
      wolfram: "Mod[$1, $2]",
      sympy: "($1 % $2)",
      sage: "($1 % $2)",
      oscar: "mod($1, $2)",
      julia: "mod($1, $2)",
      mathlib4: "(($1 : ℤ) % $2)",
      rust: "mod_floor($1, $2)",
    },
  },
  { head: "Length", arity: 1, emit: { wolfram: "Length[$1]", sympy: "len($1)", sage: "len($1)" } },

  // ── groups and group algebras: Oscar, through oscar/preamble.jl ──────────────
  // A group comes back labelled as ours (packages/groupalgebra), so element-level heads can
  // name elements the way our examples do.
  {
    head: "CyclicGroup",
    arity: 1,
    emit: { oscar: "enumeratio_cyclic(cyclic_group(PermGroup, $1), $1)" },
  },
  {
    head: "DihedralGroup",
    arity: 1,
    emit: { oscar: "enumeratio_dihedral(dihedral_group(PermGroup, 2 * $1), $1)" },
    note: "Our DihedralGroup(n) is the symmetries of an n-gon; Oscar and GAP index dihedral groups by order, so it is dihedral_group(2n) there.",
  },
  { head: "GroupDirectProduct", arity: 2, emit: { oscar: "enumeratio_direct_product($1, $2)" } },
  { head: "GroupOrder", arity: 1, emit: { oscar: "order(($1).G)" } },
  { head: "GroupIsAbelian", arity: 1, emit: { oscar: "is_abelian(($1).G)" } },
  {
    head: "GroupCentreDimension",
    arity: 1,
    emit: { oscar: "number_of_conjugacy_classes(($1).G)" },
  },
  { head: "GroupAlgebra", arity: 1, emit: { oscar: "($1).A" } },
  { head: "AlgebraDimension", arity: 1, emit: { oscar: "dim($1)", sage: "($1).dimension()" } },
  { head: "GroupBasis", arity: 1, emit: { oscar: "EnumeratioBasis($1)" } },
  { head: "GroupProduct", arity: 3, emit: { oscar: "enumeratio_product($1, $2, $3)" } },
  {
    head: "ClassSum",
    arity: 2,
    emit: { oscar: "enumeratio_class_sum($1, $2)" },
    note: "Classes are numbered in our order, by each class's smallest element; Oscar's conjugacy_classes order differs, so the helper re-sorts.",
  },
  { head: "IsCentral", arity: 2, emit: { oscar: "enumeratio_is_central($1, $2)" } },

  // ── diagram algebras: Sage in full over ZZ[delta]; Oscar by dimension formula ─
  { head: "Diagram", arity: 1, emit: { sage: "enumeratio_diagram($1)" } },
  { head: "NonCommutativeMultiply", emit: { sage: "($**)" } },
  {
    head: "PartitionAlgebra",
    arity: 1,
    emit: {
      sage: "PartitionAlgebra($1, enumeratio_delta, enumeratio_ring)",
      oscar: "EnumeratioDiagramAlgebra(:partition, $1)",
    },
    note: "Oscar has no diagram algebras; its row checks the dimension against the closed form (oscar/preamble.jl), not against a second implementation.",
  },
  {
    head: "PlanarPartitionAlgebra",
    arity: 1,
    emit: {
      sage: "PlanarAlgebra($1, enumeratio_delta, enumeratio_ring)",
      oscar: "EnumeratioDiagramAlgebra(:planar, $1)",
    },
  },
  {
    head: "BrauerAlgebra",
    arity: 1,
    emit: {
      sage: "BrauerAlgebra($1, enumeratio_delta, enumeratio_ring)",
      oscar: "EnumeratioDiagramAlgebra(:brauer, $1)",
    },
  },
  {
    head: "TemperleyLiebAlgebra",
    arity: 1,
    emit: {
      sage: "TemperleyLiebAlgebra($1, enumeratio_delta, enumeratio_ring)",
      oscar: "EnumeratioDiagramAlgebra(:temperley_lieb, $1)",
    },
  },
  {
    head: "MotzkinAlgebra",
    arity: 1,
    emit: { oscar: "EnumeratioDiagramAlgebra(:motzkin, $1)" },
    note: "Sage has no Motzkin algebra.",
  },
  {
    head: "RookAlgebra",
    arity: 1,
    emit: { oscar: "EnumeratioDiagramAlgebra(:rook, $1)" },
    note: "Sage has no rook algebra.",
  },
  {
    head: "SymmetricGroupAlgebra",
    arity: 1,
    emit: {
      sage: "SymmetricGroupAlgebra(QQ, $1)",
      oscar: "group_algebra(QQ, symmetric_group($1))",
    },
  },
  { head: "Element", arity: 2, emit: { sage: "enumeratio_element($1, $2)" } },
  { head: "Basis", arity: 1, emit: { sage: "list(($1).basis())" } },
  {
    head: "PartitionMobius",
    arity: 2,
    emit: { sage: "enumeratio_partition_mobius($1, $2)" },
    note: "Sage's posets.SetPartitions, on the 2k points relabelled 1…2k: finer below coarser.",
  },

  // ── p-adics, Rust only: the adic crate ────────────────────────────────────────
  {
    head: "AdicNumeral",
    arity: 2,
    emit: { rust: "adic($1, $2)" },
    note: "The adic crate is p-adic only: our composite bases (10-adic) have no counterpart there.",
  },
  { head: "AdicValuation", arity: 1, emit: { rust: "adic_valuation($1)" } },
  { head: "AdicNorm", arity: 1, emit: { rust: "adic_norm($1)" } },
];

/** The mapping that applies to a head at a given arity, preferring the arity-specific one. */
export function mappingFor(head: string, arity: number): Mapping | undefined {
  const rows = MAPPINGS.filter((mapping) => mapping.head === head);
  return rows.find((mapping) => mapping.arity === arity) ?? rows.find((m) => m.arity === undefined);
}

/** Every head this table says anything about. */
export const mappedHeads = (): string[] => [...new Set(MAPPINGS.map((m) => m.head))].sort();
