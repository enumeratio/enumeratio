import { ComputeEngine } from "@cortex-js/compute-engine";
import { HEADS } from "@enumeratio/wolfram";
import { expect, test } from "vite-plus/test";
import { referenceData, referenceEntries } from "../src/node.ts";

const entries = referenceEntries();
import { coverage } from "../src/coverage-data.ts";
import { provenance } from "../src/provenance-data.ts";
import { declaredEngine } from "../scripts/engines.ts";
import { classify, collect, divergences, divergingHeads, headOf, provenanceLedger } from "../scripts/provenance.ts";
import type { MathJSON, ReferenceEntry } from "../src/types.ts";

// One shared pair for the whole file — `divergences`/`provenanceLedger` isolate each
// example's own free symbols as they go (see `isolateFreeSymbols`'s comment in
// provenance.ts), so reusing one engine across the whole catalogue here is safe. `classify`
// stops at a head's first diverging example, so the whole ledger takes seconds, not minutes.
const bare = new ComputeEngine();
const ours = declaredEngine();
const ledger = provenanceLedger(bare, ours, entries);

test("every documented head's provenance matches what its entry claims", () => {
  // The claim is the `library` field; the answer is what a bare engine actually does with
  // the head. `StirlingS1` sat documented as ours long after it was compute-engine's, and
  // only a hand probe caught it — this is that probe, for the whole catalogue.
  // A bare engine resolving a head a package declares is compute-engine shipping it (BL-62).
  const why = (row: (typeof ledger)[number]): string =>
    row.provenance === "compute-engine" && row.declared !== undefined
      ? `compute-engine now ships ${row.name}: delete our redeclaration in ${row.declared}`
      : `${row.name}: computed ${row.provenance}, declared ${row.declared ?? "compute-engine"}`;
  expect(ledger.filter((row) => !row.agrees).map(why)).toEqual([]);
});

test("the catalogue is mostly compute-engine's, and we know which part is not", () => {
  const counts = new Map<string, number>();
  for (const row of ledger) counts.set(row.provenance, (counts.get(row.provenance) ?? 0) + 1);
  // Not pinned exactly — it moves as the catalogue grows — but every head lands somewhere,
  // and an entry whose examples never call its own head cannot be classified at all.
  expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(entries.length);
  // Trails the actual count: heads move to extension (or override) as we widen them.
  // Interval/CenteredInterval/Around now genuinely diverge bare compute-engine's Sin, Cos,
  // Tan, Sec, Csc, Sqrt, Sign, Exp and Arctan (enumeratio/enumeratio#113 §2);
  // All/Any/Count/Flatten now genuinely diverge it too (level arguments, infinite depth,
  // dimension permutation, any-head nesting — #113 §7); and #113's elementary backlog
  // (elementary-remaining.ts) moved Cos/Tan/Cot/Sec/Csc/Arccos/Arctan/Arcoth/Arcsch/Arsech/
  // Log2/Log10/Lb/TrigToExp there as well. The threshold tracks the combined drop, well
  // below the current count so it still catches a real regression.
  expect(counts.get("compute-engine") ?? 0).toBeGreaterThan(10);
  expect(counts.get("extension") ?? 0).toBeGreaterThan(20);
});

/**
 * Plain compute-engine expressions over the heads we REPLACE. Not one of them mentions a
 * unit, a numeral system or any other invention of ours, so a bare engine and ours must
 * agree on every line. This is the net under the overrides: `Add` once lost its `type`
 * handler to a redeclaration and broke `Conjugate(1 + x)` nowhere near the change.
 */
const VANILLA: MathJSON[] = [
  // The arithmetic family, all of which the hypercomplex units wrap.
  ["Add", 1, 2, 3],
  ["Add", "x", "x"],
  ["Add", 1, ["Multiply", 2, "x"]],
  ["Multiply", 3, 4],
  ["Multiply", "x", "y", "x"],
  ["Negate", ["Add", "x", 1]],
  ["Power", 2, 10],
  ["Power", "x", 0],
  ["Divide", 6, 4],
  ["Divide", "x", "x"],
  ["Conjugate", ["Add", 1, "x"]],
  ["Conjugate", ["Complex", 3, 4]],
  ["Abs", -7],
  ["Norm", ["List", 3, 4]],
  ["Sqrt", 16],
  ["Subtract", 10, ["Add", 2, 3]],
  // Types and containment.
  ["Element", 3, "Integers"],
  ["Element", ["Rational", 1, 2], "RationalNumbers"],
  ["Element", "Pi", "RealNumbers"],
  // The special functions we extend.
  ["Zeta", 2],
  ["Zeta", 4],
  ["Zeta", -1],
  ["PolyLog", 2, 1],
  // PolyGamma(0, 1) used to sit here too, but #113 routes PolyGamma's order-0 case
  // through Digamma (closed-forms-113.ts) whenever Digamma has something to add, and a
  // positive integer is exactly the first such case (PolyGamma(0, 1) = -γ) — no longer
  // a vanilla, unaffected call.
  // Digits, whose base slot we widen.
  ["IntegerDigits", 255, 16],
  ["IntegerDigits", 10, 2],
  ["IntegerDigits", 0, 2],
  ["FromDigits", ["List", 1, 0, 1], 2],
  ["FromDigits", ["List", 2, 5, 5], 10],
  // Residues, which also take ResidueClass classes.
  ["ChineseRemainder", ["List", 3, 4], ["List", 4, 5]],
  ["ChineseRemainder", ["List", 1, 2], ["List", 6, 10]],
  ["PowerMod", 3, -1, 7],
  // Continued fractions, which we used to shadow outright.
  ["ContinuedFraction", ["Rational", 355, 113]],
  ["ContinuedFraction", 355, 113],
  ["FromContinuedFraction", ["List", 3, 7, 16]],
  // Combinatorics that sits next to ours.
  ["Stirling", 6, 3],
  ["StirlingS1", 6, 3],
  ["Binomial", 10, 3],
  ["Factorial", 6],
  // Symbolic work that must survive the wrapped operators untouched.
  ["Expand", ["Power", ["Add", "x", 1], 3]],
  ["Simplify", ["Divide", ["Multiply", "x", "y"], "x"]],
  ["Solve", ["Equal", ["Add", "x", 1], 3], "x"],
  ["D", ["Power", "x", 3], "x"],
  ["Integrate", ["Power", "x", 2], "x"],
];

test("declaring our libraries changes nothing about vanilla compute-engine", () => {
  const broken = divergences(bare, ours, VANILLA);
  expect(
    broken.map((d) => `${JSON.stringify(d.expression)}: ${JSON.stringify(d.bare)} → ${JSON.stringify(d.ours)}`),
  ).toEqual([]);
});

/**
 * The heads we knowingly change the behaviour of. Every one is a compute-engine head we
 * extend — a wider domain, a wider argument slot, or our own structures recognised — and
 * each falls back to the native handler when the input is not ours. `Gamma` and
 * `GammaRegularized` are here for the third argument (Wolfram's generalized incomplete
 * gamma, which a bare engine rejects as an unexpected argument), plus Γ(1, z) = e^{−z}.
 * Most of the integer and special functions are here for threading over a list, which a
 * bare engine rejects as a type error (`threadOverLists` in @enumeratio/engine).
 * `ModularInverse` is widened to Gaussian integers (number-theory) and `PolyGamma` is
 * redeclared for complex z (analytic); a wrong-typed argument now fails in the widened
 * signature rather than the native one, so even the error differs. `LambertW` is here for
 * exact values at algebraically nice points (0, e, -1/e, ...) that a bare engine leaves
 * unevaluated outside `N()`, and for branches other than 0/-1 — additive in both cases, never
 * changing a value the native handler already gave concretely. `Beta` is here for the
 * third and fourth arguments (the incomplete and generalized incomplete beta) and for
 * `B(a, 1) = 1/a`, exactly the same additive shape as `Gamma`'s third argument.
 * `Floor`, `Ceil`, `Round`,
 * `Max`, `Min` and `IsOdd` are here for folding an exact constant expression (Pi, e, ...) a
 * bare engine leaves symbolic, plus Floor/Ceil/Round's own idempotence and Max/Min dropping
 * an exactly-repeated argument; `Sin`, `Sinh`, `Cosh`, `Tanh`, `Arccot`, `Arccsc` and
 * `Arcsec` are here for symbolic normalisations (parity, a pi-multiple shift, an imaginary
 * argument, an inverse composition) and special values a bare engine leaves standing —
 * every one additive, never overriding a value the native handler already gave.
 * #113 also adds `GammaLn` (an exact
 * positive-integer argument now reduces, `threading-113.ts`/`closed-forms-113.ts`),
 * `Rationalize` (threads over a list or a symbolic expression, `threading-113.ts`) and
 * `FromContinuedFraction` (a list of plain symbols builds the nested fraction,
 * `closed-forms-113.ts`) — each additive the same way, native for anything not exact.
 * #113 also adds `GCD` and `LCM`: every plain-integer call now goes through bigints (the
 * native pair round a big argument through a double — `GCD(20!, 10^100+3)` came back
 * 163840000 instead of 7 — so this is a correction, not only an addition), plus threading a
 * single list argument against the rest (`declare-widened.ts`, number-theory).
 * Also from #113: `Chop`'s second-argument tolerance, `Stirling`/`StirlingS1` at k > n
 * (0, past the diagonal) and threading `Stirling` over a list, `Binomial`/`CatalanNumber`/
 * `Multinomial`/`Factorial2`/`Subfactorial`/`Pochhammer` through Gamma for real and complex
 * arguments, `Fibonacci`/`LucasL` at a real index and as the two-argument polynomial (and
 * `BellNumber`'s own Touchard-polynomial form), `IntegerString`'s bigint arithmetic, and
 * `FromDigits`'s symbolic/negative base and Roman-numeral reading -- all in number-theory,
 * numerals or collections, additive in the same way: native for anything not ours.
 * Issue #113's elementary backlog (`elementary-remaining.ts`) adds `Cos`/`Tan`/`Cot`/`Sec`/
 * `Csc`/`Arccos`/`Arctan`/`Arcoth`/`Arcsch` for the same additive shapes `Sin`/`Sinh`/
 * `Cosh`/`Tanh`/`Arccot`/`Arccsc`/`Arcsec` are already here for (parity, an imaginary
 * argument, an inverse composition, a special value), `Arsech` for its value at 1 and past
 * its real branch point, and `TrigToExp` for the logarithmic form of `Arcsin`/`Arctan`/
 * `Arcoth`/`Arcsch` (it already had one for `Sin`/`Cos`/`Tan`/`Sinh`/`Cosh`/`Tanh`, none of
 * which needed adding here since compute-engine's own `TrigToExp` already handled them).
 * `Log2`/`Log10`/`Lb` (which canonicalize to `Log` at box time) are here for folding an
 * exact rational power of the base below 1, in either direction (`Log2(1/8) = -3`) --
 * `Log` itself picks up the same fold for an explicit non-default base -- and for
 * `ComplexInfinity` going to `+Infinity`, the same convention `Ln` already had.
 * The #113 list-stats sweep (`list-stats.ts`) adds `Tabulate` at three or more dimensions,
 * or a literal 0 in any dimension (materialized directly rather than left truncated or
 * unevaluated), and `Unique`'s second-argument sameness test — both additive, native for
 * anything not ours. `Mean`/`Median` on symbolic or exact-constant data is the same sweep,
 * already covered above since those heads were already overridden for their matrix form.
 * `Take(xs, UpTo(n))` and `Fold`'s unseeded 2-argument form are ALSO from that sweep but
 * don't appear here: a bare engine's own `.json` for the unmaterialized/rejected call is
 * textually identical to (`Take`) or excluded from comparison by (`Fold`, whose malformed
 * 2-argument call a bare engine's own canonical fails to validate) this ledger's plain,
 * non-materializing comparison — see their own overrides' comments in `list-stats.ts`.
 *
 * Pinned in BOTH directions. A new name appearing here means an override nobody decided
 * on; a name disappearing means an override that has silently stopped taking effect.
 */
const OVERRIDDEN = [
  "Abs",
  // Not itself overridden -- two Floor examples are wrapped in a bare `Add` (Legendre's
  // formula, and the decimal-digit-count identity), so Add is the corpus expression's own
  // outer head even though the divergence is Floor's.
  "Add",
  "All",
  "Any",
  // Also overridden itself (operator forms, a Function literal that would capture, a process
  // called at a time); `Apply(Derivative(UnitBox, n), x)` is the Derivative rule's own value.
  "Apply",
  "Arccos",
  "Arccsc",
  "Arcosh",
  "Arcoth",
  "Arcsch",
  "Arcsec",
  "Arcsin",
  "Arctan",
  "Arsech",
  "Artanh",
  "At",
  "BarnesG",
  "BellNumber",
  "BernoulliB",
  "Beta",
  "BetaRegularized",
  "Binomial",
  "CarmichaelLambda",
  "CatalanNumber",
  "Ceil",
  "ChineseRemainder",
  "Chop",
  "Clamp",
  // Hypercomplex widens its argument to `value`, so Conjugate(Transpose(m)) of an unevaluated
  // Transpose holds, where a bare engine rejects it as an incompatible type.
  "Conjugate",
  "ContinuedFraction",
  "Cos",
  "Cosh",
  "Cot",
  "Count",
  "Csc",
  "D",
  "Derivative",
  "Digamma",
  "DigitCount",
  "DigitSum",
  "DirichletEta",
  "DirichletL",
  "Divide",
  "DivisorSigma",
  "Divisors",
  "Dot",
  "Element",
  // Not itself overridden -- Wolfram's documented identities compare our heads
  // (Fibonacci(2, -x) == -Fibonacci(2, x)); Equal is the corpus expression's outer head.
  "Equal",
  "Erf",
  "ErfInv",
  "Erfc",
  "Exp",
  "Expand",
  "ExtendedGCD",
  "FactorInteger",
  "Factorial2",
  "Fibonacci",
  "First",
  "FixedPoint",
  "Flatten",
  "Floor",
  // compute-engine 0.139 changed Fold's own canonicalization/evaluation enough that a
  // corpus example comparable against ours before (`compute-engine`) now genuinely
  // diverges (`override`) -- see collect-provenance.ts's diff. Not something this upgrade
  // set out to change; worth a closer look if it matters.
  "FromContinuedFraction",
  "FromDigits",
  "GCD",
  "Gamma",
  "GammaLn",
  "GammaRegularized",
  "Histogram",
  // #340: HurwitzZeta/Zeta's own declarations landed in compute-engine 0.139, but only in
  // double precision -- the zeta-hurwitz patch still overrides both for the arbitrary-
  // precision N(x, d) path (see ce-patches/src/patches/zeta-hurwitz.ts), so
  // HurwitzZeta now genuinely diverges bare compute-engine (it didn't exist there before).
  "IntegerDigits",
  "IntegerString",
  "Integrate",
  "Inverse",
  "IsOdd",
  "IsPerfect",
  "IsPrime",
  "IsSquareFree",
  "JacobiSymbol",
  "Join",
  "LCM",
  "LambertW",
  "Last",
  "Lb",
  "LegendreSymbol",
  "Length",
  "LerchPhi",
  // Not itself overridden -- a chain like 2 < Khinchin < 3 compares a constant only we
  // declare.
  "Less",
  // Not itself overridden -- Wolfram's CarmichaelLambda/LCM identity lists two of our
  // heads' answers in a bare List, the same reason Add is here.
  "List",
  "Ln",
  "Log10",
  "Log2",
  "LogBarnesG",
  "LogGamma",
  "LucasL",
  "Mandelbrot",
  "MatrixPower",
  "MatrixRank",
  "Max",
  "Mean",
  "Median",
  "Min",
  "Mod",
  "Mode",
  "ModularInverse",
  "MoebiusMu",
  "Multinomial",
  "MultiplicativeOrder",
  "Multiply",
  // Our N rounds to the requested digits; a bare `N(Pi, 30)` prints 34.
  "N",
  "NextPrime",
  "Norm",
  // Not itself overridden -- the Normal of the Series of Zeta at 1 carries our StieltjesGamma
  // terms, where a bare engine stops at the Laurent constant.
  "Normal",
  "NthPrime",
  "Ordering",
  "Partition",
  "Pochhammer",
  "PolyGamma",
  "PolyLog",
  "Position",
  "Power",
  "PowerMod",
  "PowerModList",
  "PrimeNu",
  "PrimeOmega",
  "PrimePi",
  "PrimitiveRootList",
  "Product",
  "Rank",
  "RationalReconstruction",
  "Rationalize",
  // Not itself overridden -- the Khinchin example takes the 1000th root of a product of
  // our ContinuedFraction's terms.
  // Not itself overridden -- compute-engine's fold over our Permute and Partition, which a bare
  // engine leaves unevaluated.
  "Reduce",
  "ReplaceAll",
  "Root",
  "Round",
  // Not itself overridden -- it compares the values of Derivative(UnitBox, 2) and Derivative(UnitBox, 3),
  // which a bare engine leaves as inert derivatives, so the two differ there.
  "Same",
  "Sec",
  // Not itself overridden -- the Series of ExpIntegralE(1, x) at 0 stays held (E1(0) is infinite
  // here), where a bare engine builds a Taylor expansion around an unevaluated E1(0).
  "Series",
  "SetMinus",
  "Sign",
  "Simplify",
  "Sin",
  "Sinh",
  "Solve",
  "Sort",
  "Sqrt",
  "StieltjesGamma",
  "Stirling",
  "StirlingS1",
  "Subfactorial",
  "Subtract",
  // Not itself overridden -- the StirlingS1/Stirling orthogonality identity sums a term
  // that used to stay unevaluated (S(1, 2), past the k > n boundary); Sum is the corpus
  // expression's own outer head, the same reason Add is here.
  "Sum",
  "Tabulate",
  "Tan",
  "Tanh",
  "Totient",
  "TrigToExp",
  "Union",
  "Unique",
  "Zeta",
];

// The full sweep runs every example through both engines, a minute or more on a busy box, so it is
// nightly (`DEEP_TESTS=1`) and pins the list exactly. The standard run keeps the direction that
// matters at review: every example of a head we don't override, where an unexpected override
// would show, and the first few of each head we do. No head off the list may diverge in either.
const deep = process.env["DEEP_TESTS"] === "1";
const SAMPLE_PER_OVERRIDDEN_HEAD = 3;

test(
  "we change exactly the compute-engine heads we mean to, and no others",
  { timeout: deep ? 900_000 : 60_000 },
  () => {
    const corpus = entries.flatMap((entry) =>
      entry.examples.filter((example) => example.role !== "triage").map((example) => example.expr),
    );
    if (deep) {
      expect(divergingHeads(bare, ours, corpus)).toEqual(OVERRIDDEN);
      return;
    }
    const taken = new Map<string, number>();
    const sample = corpus.filter((expression) => {
      const head = headOf(expression);
      if (head === undefined || !OVERRIDDEN.includes(head)) return true;
      const n = taken.get(head) ?? 0;
      taken.set(head, n + 1);
      return n < SAMPLE_PER_OVERRIDDEN_HEAD;
    });
    expect(divergingHeads(bare, ours, sample).filter((head) => !OVERRIDDEN.includes(head))).toEqual([]);
  },
);

test("the built provenance data is what the engines say", () => {
  // `src/provenance-data.ts` is built (gitignored) by the package's `build`; re-deriving it
  // here checks the build ran against these records and engines. A change in the diff of a
  // rebuild means a head moved between compute-engine's and ours, which is worth noticing.
  // `elsewhere` is the committed kernel snapshot (`coverage-data.ts`), folded in by `collect`.
  // Fresh engines, as the collector uses: not because reusing `bare`/`ours` from the ledger
  // above would be wrong (it wouldn't -- see `isolateFreeSymbols`), just to check `collect`
  // does the same thing collect-provenance.ts does, starting from the same blank state.
  expect(collect(new ComputeEngine(), declaredEngine(), entries, HEADS, coverage)).toEqual(
    provenance.map((record) => ({ ...record })),
  );
});

test("the Wolfram rename column is reflected from the transpiler, not copied", () => {
  // `wolframAlias` is a RENAME (Stirling → StirlingS2). It is deliberately not the answer
  // to "does Wolfram have this" — `HurwitzZeta` needs no rename and Wolfram has it. That
  // question is `elsewhere`, and only a kernel can answer it.
  for (const record of provenance) {
    expect(record.wolframAlias, record.name).toBe(HEADS[record.name] ?? null);
  }
});

/**
 * Our heads that no external system has. Adding a head appends to this list when the
 * coverage script next runs, and the pin then fails — which is the point: a new head should
 * not land without someone having asked whether Wolfram, SymPy or mpmath already has it, or
 * whether it is a short expression in terms of something they do.
 *
 * `elsewhere` is filled by `scripts/collect-coverage.ts`, which asks the kernels by NAME, plus
 * "wolfram" for any head the Wolfram transpiler renames (`IsCoprime` → `CoprimeQ`). A head
 * spelled differently elsewhere with no such rename still lands here. Most of this list is
 * domain objects and classical combinatorial families a general CAS doesn't carry; the
 * exceptions are spellings: ClausenCl (Wolfram's Im[PolyLog[n, E^(I θ)]], mpmath's
 * clsin/clcos), RationalReconstruction (Sage's `rational_reconstruction`, Maple's `iratrecon`),
 * IntegerMod and IntegerModRing (Sage's `Mod(a, m)` and `Zmod(m)`), SetPartitions (SymPy's
 * `multiset_partitions`), ModularJ (KleinInvariantJ) and EisensteinG (EisensteinE, up to
 * normalization). KeiperLiLambda has no known equivalent anywhere.
 */
const NOVEL = [
  "AdditionTable",
  "MultiplicationTable",
  "IntervalSliderBox",
  "KnobBox",
  "StepperBox",
  "AlgebraicIntegers",
  "AlgebraicOrder",
  "PolynomialRoot",
  "Adele",
  "AdicDigits",
  "AdicExpansion",
  "AdicNorm",
  "AdicNumeral",
  "AdicNumerals",
  "AdicSqrt",
  "AdicUnitPart",
  "AdicValuation",
  "AdjacentTranspositionInvolutions",
  "AlexanderPolynomial",
  "AlgebraDimension",
  "AlgebraSignature",
  "AlternatingPermutations",
  "AlternatingSignMatrices",
  "Antiexcedances",
  "Antipode",
  "Area",
  "ArmOfFirstCell",
  "Arrangements",
  "Ascents",
  "BalancedNumerals",
  "BalancedRadix",
  "BallotSequences",
  "Basis",
  "BaxterPermutations",
  "BijectiveNumerals",
  "BijectiveRadix",
  "BinaryBracelets",
  "BinaryNecklaces",
  "BinaryPalindromes",
  "BinaryStrings",
  "BinaryTreeParentArrays",
  "BinaryTrees",
  "BinaryWord",
  "BinaryWords",
  "BinaryWordsByWeight",
  "BlockSizeSpan",
  "Blocks",
  "BlocksAtLeastTwo",
  "BlocksSizeTwo",
  "BooleanLattice",
  "BooleanPermutations",
  "Bounce",
  "BoxedPlanePartitions",
  "BracketInvariant",
  "Braid",
  "BraidClosure",
  "BraidComponents",
  "BraidCrossings",
  "BraidInverse",
  "BraidIsKnot",
  "BraidIsPositive",
  "BraidPermutation",
  "BraidPower",
  "BraidProduct",
  "BraidStrands",
  "BraidWrithe",
  "BrauerAlgebra",
  "BurauMatrix",
  "CarlitzCompositions",
  "Chain",
  "Chart",
  "ClassSum",
  "CliffordConjugate",
  "Coarea",
  "CograssmannianPermutations",
  "CollectionTable",
  "ColoredPermutations",
  "CombinatorialMap",
  "CombinatorialNumerals",
  "CombinatorialStat",
  "CombinatorialSystem",
  "Compare",
  "CompositionsIntoKParts",
  "CongruentMod",
  "ConjugateComposition",
  "ConjugateDistinctParts",
  "ConjugateOddParts",
  "ConnectedPermutations",
  "Coordinates",
  "Corners",
  "Counit",
  "Crank",
  "CrossingNestingTotal",
  "Crossings",
  "Csgn",
  "CycleCount",
  "CycleDecomposition",
  "CyclicDescents",
  "CyclicPermutations",
  "DedekindSum",
  "DelannoyPaths",
  "Denert",
  "Depth",
  "Derangements",
  "Descents",
  "Diagram",
  "DiagramCoarsenings",
  "DigammaFunctionZero",
  "Dinv",
  "DistinctCycleLengths",
  "DistinctPartitions",
  "DistinctParts",
  "DivisorLattice",
  "DoubleRises",
  "Dual",
  "DualAlgebra",
  "DurfeeSquare",
  "DyadicCompositions",
  "DyckPaths",
  "DyckPathsByHeight",
  "DysonRank",
  "EisensteinG",
  "Endofunctions",
  "EvaluateForm",
  "EvenParts",
  "EvenPermutations",
  "EvenSubsets",
  "Excedances",
  "FareyNeighbours",
  "FibStrings",
  "FibonacciCompositions",
  "FibonacciWords",
  "FigureEightKnot",
  "FinePaths",
  "Finset",
  "FirstDescent",
  "FixedPoints",
  "FormAction",
  "FormAutomorph",
  "FormClassNumber",
  "FormClasses",
  "FormCycle",
  "FormDiscriminant",
  "FormRho",
  "FromSternBrocotPath",
  "GelfandTsetlin",
  "GeometricProduct",
  "Grade",
  "GradeInvolution",
  "GradePart",
  "GrandDyckPaths",
  "GrassmannianPermutations",
  "GrayCodeSubsets",
  "GrayCodes",
  "GreatestLowerBound",
  "GroupAlgebra",
  "GroupBasis",
  "GroupCentreDimension",
  "GroupDirectProduct",
  "GroupIsAbelian",
  "GroupProduct",
  "HasElement",
  "HeckeAlgebra",
  "HeckeIdentity",
  "HeckeSpecialize",
  "HeckeT",
  "Height",
  "HenselLift",
  "Hills",
  "HookProduct",
  "HopfDegree",
  "Hypergeometric3F2Regularized",
  "HypergeometricUStar",
  "Idele",
  "InCompleteBasis",
  "InDiagramBasis",
  "InFundamentalBasis",
  "InMonomialBasis",
  "InOrbitBasis",
  "InRibbonBasis",
  "IncidenceAlgebra",
  "IncreasingBinaryTrees",
  "InitialRise",
  "IntegerCeil",
  "IntegerCompositions",
  "IntegerFloor",
  "IntegerMod",
  "IntegerModRing",
  "IntegerPartition",
  "InteriorReturns",
  "Inversions",
  "Involutions",
  "IsCentral",
  "IsEvenTick",
  "IsIndefinite",
  "IsPrimitiveClass",
  "IsReducedForm",
  "IsSelfConjugate",
  "JonesPolynomial",
  "KAlmostPrimes",
  "KBracelets",
  "KCyclePermutations",
  "KDescentPermutations",
  "KFreeIntegers",
  "KInversionPermutations",
  "KLyndonWords",
  "KNecklaces",
  "KPermutations",
  "KSubsets",
  "KauffmanBracket",
  "KeiperLiLambda",
  "Knob",
  "KnotCurve",
  "LargestBlock",
  "LargestCycleLength",
  "LargestPart",
  "LargestPartPartitions",
  "LargestRunLength",
  "LastBlockSize",
  "LastDescent",
  "LatticePaths",
  "LeastUpperBound",
  "LeftContraction",
  "LeftToRightMaxima",
  "LeftToRightMinima",
  "LegOfFirstCell",
  "LehmerCodes",
  "LinearQuiver",
  "LinkingWithTrefoil",
  "LongestAscent",
  "LongestCycleLength",
  "LongestDecreasingSubsequence",
  "LongestDescent",
  "LongestIncreasingSubsequence",
  "LongestRun",
  "LorenzCurve",
  "LorenzPermutation",
  "LowerTick",
  "LucasStrings",
  "LukasiewiczPaths",
  "LyndonWords",
  "MajorIndex",
  "MinorIndex",
  "ModularClass",
  "ModularClasses",
  "ModularFromSTWord",
  "ModularJ",
  "ModularKind",
  "ModularMatrix",
  "ModularSTWord",
  "ModularTrace",
  "ModularWord",
  "MoebiusFunction",
  "MoebiusInvert",
  "MotzkinAlgebra",
  "MotzkinPathsByPeaks",
  "MultiZetaValue",
  "MulticomplexAlgebra",
  "MultiplicityOfLargestPart",
  "Multisets",
  "NSymAlgebra",
  "NSymH",
  "NSymR",
  "NegativeNumerals",
  "NegativeRadix",
  "Nestings",
  "NonCrossingCycleSupportPermutations",
  "NonCrossingMatchings",
  "NonCrossingPartitions",
  "NonCrossingPermutations",
  "NonCrossingTrees",
  "NonNestingMatchings",
  "NonNestingPartitions",
  "NumeralSystemShape",
  "OccurrencesOf123",
  "OccurrencesOf132",
  "OccurrencesOf213",
  "OddCompositions",
  "OddPartitions",
  "OddParts",
  "OddSubsets",
  "Ostrowski",
  "OstrowskiNumerals",
  "PalindromicCompositions",
  "ParametricCurve",
  "PartCountBoundedCompositions",
  "PartSizeBoundedCompositions",
  "PartitionAlgebra",
  "PartitionMobius",
  "PartitionsInBox",
  "PartitionsIntoKParts",
  "PartitionsMaxPart",
  "PartsAtLeastTwo",
  "PartsEqualOne",
  "PathAlgebra",
  "Peaks",
  "PellSolution",
  "Perimeter",
  "Permutation",
  "PermutationsAsCycles",
  "PermutationsAvoiding123",
  "PermutationsAvoiding132",
  "PermutationsAvoiding213",
  "PermutationsAvoiding231",
  "PermutationsAvoiding312",
  "PermutationsAvoiding321",
  "PhylogeneticTrees",
  "PlanarPartitionAlgebra",
  "PlanePartitions",
  "PolygonalNumbers",
  "PosetElements",
  "PosetInterval",
  "PosetSumDown",
  "PosetZeta",
  "PositionalNumerals",
  "PositivePermutationBraid",
  "PretzelKnot",
  "PrimeCompositions",
  "PrimePairs",
  "PrimePartitions",
  "PrimitiveBinaryStrings",
  "ProfiniteDecomposition",
  "ProfiniteNumber",
  "ProfinitePlot",
  "ProperCompositions",
  "PruferSequences",
  "Pseudoscalar",
  "QSymAlgebra",
  "QSymF",
  "QSymM",
  "QuadraticForm",
  "QuadraticInteger",
  "QuadraticIntegers",
  "QuadraticOrder",
  "Quiver",
  "QuiverCompose",
  "QuiverIsAcyclic",
  "QuiverPath",
  "QuiverPathEnd",
  "RademacherPhi",
  "RademacherSymbol",
  "Radix",
  "Records",
  "RecursiveTrees",
  "ReduceForm",
  "ReducedForms",
  "ReflectionLength",
  "ResidueNumerals",
  "ResidueSystem",
  "Resource",
  "RestrictedGrowthStrings",
  "Returns",
  "Reversion",
  "RightContraction",
  "RightToLeftMaxima",
  "RightToLeftMinima",
  "RiordanPaths",
  "RookAlgebra",
  "RootedForests",
  "RootedUnlabeledTrees",
  "RoughNumbers",
  "RowSource",
  "Runs",
  "Sandwich",
  "ScalarProduct",
  "SchroederPaths",
  "SeifertGenus",
  "SemistandardTableaux",
  "SeparablePermutations",
  "SetCompositions",
  "SetPartitions",
  "SetPartitionsIntoKBlocks",
  "ShiftedStandardTableaux",
  "SignedPermutations",
  "SimplePermutations",
  "SingletonBlocks",
  "SkewPartitions",
  "SkewStandardTableaux",
  "SloaneA",
  "SmallestBlock",
  "SmoothNumbers",
  "SmoothPermutations",
  "SplitAlgebra",
  "SquarePartitions",
  "StackSortable",
  "StandardTableau",
  "StandardTableauPairs",
  "StandardTableaux",
  "SternBrocotPath",
  "StirlingPermutations",
  "SubexcedantSeq",
  "SubexcedantSeqs",
  "SubsetsOfSizeAtMost",
  "SubsetsWithoutConsecutive",
  "SumOfHookLengths",
  "Surjections",
  "SymmetricGroupAlgebra",
  "SytHookShape",
  "SytTwoColumn",
  "SytTwoRow",
  "TemperleyLiebAlgebra",
  "TemplateExpression",
  "TernaryGrayCodes",
  "TetraCompositions",
  "ThreeCycleCount",
  "TorusBraid",
  "TorusKnot",
  "TorusSquare",
  "TouchPointCount",
  "Tournaments",
  "TriCompositions",
  "TriStrings",
  "TriangularCompositions",
  "TriangularPartitions",
  "TripNumber",
  "TwistKnot",
  "TwoCycleCount",
  "UnlabeledFreeTrees",
  "UpperTick",
  "Valleys",
  "Variable",
  "VexillaryPermutations",
  "WeakCompositions",
  "WeakExceedances",
  "WithCoordinates",
  "WordSymbol",
  "Words",
  "XGCD",
  "ZigzagCompositions",
];

// What formats holds inert that is Wolfram's own (`Plot`, `Slider`, `Cell`): known elsewhere because
// its record says so, not listed here.
const extensions = new Set(
  provenance.filter((record) => record.provenance === "extension").map((record) => record.name),
);
const FORMATS_KNOWN = referenceData()
  .heads.filter((h) => h.package === "formats" && h.entry.names?.wolframIdentity === true)
  .map((h) => h.head)
  .filter((head) => extensions.has(head));

test("every head we invented is either novel or known to exist elsewhere", () => {
  const ours = provenance.filter((record) => record.provenance === "extension");
  const novel = ours.filter((record) => record.elsewhere.length === 0).map((r) => r.name);
  // The entries come in the loader's order (domain, then name); what matters is the set.
  expect([...novel].toSorted()).toEqual([...NOVEL].toSorted());
  // …and the rest exist elsewhere, which is the upstreaming shortlist: a function a
  // general system already carries, that we implemented again.
  const known = ours.filter((record) => record.elsewhere.length > 0);
  expect(known.map((record) => record.name).toSorted()).toEqual(
    [
      ...FORMATS_KNOWN,
      "PermutationLength",
      "PermutationMax",
      "PermutationMin",
      "PermutationOrder",
      "PermutationPower",
      "PermutationProduct",
      "PermutationSupport",
      "AbsoluteTiming",
      "Accumulate",
      "AdjacencyGraph",
      "AdjacencyMatrix",
      "AlgebraicIntegerQ",
      "AlgebraicNumberNorm",
      "AlgebraicNumberTrace",
      "AlternatingGroup",
      "AppendTo",
      "Around",
      "Array",
      "ArrowBox",
      "Association",
      "AssociationThread",
      "Assuming",
      "Attributes",
      "BellY",
      "BernoulliPolynomial",
      "BesselJZero",
      "BooleanConvert",
      "ButtonBox",
      "CaputoD",
      "CarlsonRC",
      "CarlsonRD",
      "CarlsonRF",
      "CarlsonRG",
      "CarlsonRJ",
      "Cases",
      "Catch",
      "CellularAutomaton",
      "CenteredInterval",
      "CharacterRange",
      "ChebyshevT",
      "ChebyshevU",
      "CheckboxBox",
      "CircleTimes",
      "CirculantGraph",
      "CliffordAlgebra",
      "ClosenessCentrality",
      "ColorSetterBox",
      "Commonest",
      "CompleteGraph",
      "CompleteKaryTree",
      "ComplexExpand",
      "Compose",
      "ConnectedComponents",
      "ContinuedFractionK",
      "Convergents",
      "Coproduct",
      "CubeRoot",
      "CycleGraph",
      "Cycles",
      "CyclicGroup",
      "DSolveValue",
      "DeleteCases",
      "DiagonalMatrix",
      "DifferenceDelta",
      "DifferenceRootReduce",
      "DifferentialRootReduce",
      "DihedralGroup",
      "DiracDelta",
      "DirectedEdge",
      "DiscreteDelta",
      "DiscreteRatio",
      "DiscreteShift",
      "DiskBox",
      "DisplayForm",
      "DivisorSum",
      "Do",
      "DynamicBox",
      "DynamicModuleBox",
      "Echo",
      "EdgeCount",
      "EdgeList",
      "EigenvectorCentrality",
      "EllipticTheta",
      "EllipticThetaPrime",
      "ErrorBox",
      "EulerE",
      "ExpIntegralE",
      "ExpToTrig",
      "ExponentialGeneratingFunction",
      "Extract",
      "FactorialPower",
      "FallingFactorial",
      "FareySequence",
      "FindInstance",
      "FindSequenceFunction",
      "FindShortestPath",
      "FirstPosition",
      "FixedPointList",
      "FoldList",
      "FormBox",
      "Fourier",
      "FourierCoefficient",
      "FourierSeries",
      "FourierTransform",
      "FractionBox",
      "FractionalPart",
      "FrameBox",
      "FreeQ",
      "FrobeniusNumber",
      "FrobeniusSolve",
      "FromCharacterCode",
      "FullSimplify",
      "FunctionAnalytic",
      "FunctionContinuous",
      "FunctionConvexity",
      "FunctionDiscontinuities",
      "FunctionDomain",
      "FunctionExpand",
      "FunctionInjective",
      "FunctionMeromorphic",
      "FunctionMonotonicity",
      "FunctionPeriod",
      "FunctionRange",
      "FunctionSign",
      "FunctionSingularities",
      "FunctionSurjective",
      "Gather",
      "GatherBy",
      "GeneratingFunction",
      "GeometricMean",
      "Graph",
      "GraphCenter",
      "GraphDiameter",
      "GraphDistance",
      "GraphDistanceMatrix",
      "GraphPeriphery",
      "GraphRadius",
      "GraphicsComplexBox",
      "GrassmannAlgebra",
      "GridBox",
      "GridGraph",
      "GroupElements",
      "GroupGenerators",
      "GroupOrder",
      "Gudermannian",
      "HankelMatrix",
      "HankelTransform",
      "HararyGraph",
      "HarmonicMean",
      "HarmonicNumber",
      "HeavisideLambda",
      "HeavisidePi",
      "HeavisideTheta",
      "HermiteDecomposition",
      "HermiteH",
      "HilbertMatrix",
      "HypercubeGraph",
      "Hyperfactorial",
      "Hypergeometric0F1",
      "Hypergeometric0F1Regularized",
      "Hypergeometric1F1Regularized",
      "Hypergeometric2F1Regularized",
      "HypergeometricPFQ",
      "HypergeometricU",
      "Image",
      "IncidenceMatrix",
      "IncompleteEllipticE",
      "IncompleteEllipticF",
      "IncompleteEllipticPi",
      "Inequality",
      "InputFieldBox",
      "InsetBox",
      "IntegerExponent",
      "IntegerLength",
      "IntegerPart",
      "IntegerPartitions",
      "IntegerReverse",
      "InterpretationBox",
      "InverseBetaRegularized",
      "InverseErfc",
      "InverseFourier",
      "InverseFourierTransform",
      "InverseGammaRegularized",
      "InverseLaplaceTransform",
      "InverseMellinTransform",
      "InversePermutation",
      "IsAcyclicGraph",
      "IsArray",
      "IsBipartiteGraph",
      "IsCompleteGraph",
      "IsConnectedGraph",
      "IsCoprime",
      "IsInteger",
      "IsIntervalMember",
      "IsIsomorphicGraph",
      "IsLoopFreeGraph",
      "IsMachineNumber",
      "IsMatrix",
      "IsMersennePrimeExponent",
      "IsNumeric",
      "IsPathGraph",
      "IsPrimePower",
      "IsQuadraticIrrational",
      "IsSimpleGraph",
      "IsTreeGraph",
      "IsTrue",
      "IsVector",
      "JacobiAmplitude",
      "JacobiCD",
      "JacobiCN",
      "JacobiCS",
      "JacobiDC",
      "JacobiDN",
      "JacobiDS",
      "JacobiNC",
      "JacobiND",
      "JacobiNS",
      "JacobiSC",
      "JacobiSD",
      "JacobiSN",
      "JacobiZN",
      "KaryTree",
      "Key",
      "KleinInvariantJ",
      "KroneckerSymbol",
      "LaguerreL",
      "LaplaceTransform",
      "LegendrePolynomial",
      "LetterNumber",
      "Level",
      "LineBox",
      "LineGraph",
      "LinearRecurrence",
      "LiouvilleLambda",
      "LocatorBox",
      "LogicalExpand",
      "MakeBoxes",
      "MangoldtLambda",
      "MapAt",
      "MapIndexed",
      "MapThread",
      "MatchQ",
      "MatrixExp",
      "MatrixFunction",
      "MaxValue",
      "Maximize",
      "MeijerG",
      "MeijerGReduce",
      "MellinTransform",
      "MemoryConstrained",
      "MersennePrimeExponent",
      "Midpoint",
      "MinValue",
      "MinimalPolynomial",
      "Minimize",
      "MixedRadix",
      "MixedRadixNumerals",
      "ModularLambda",
      "Module",
      "MovingMap",
      "NMaximize",
      "NMinimize",
      "NSum",
      "NeighborhoodGraph",
      "Nest",
      "NestList",
      "NestWhile",
      "NestWhileList",
      "NonCommutativeMultiply",
      "NoneTrue",
      "NorlundB",
      "Normalize",
      "NumberExpand",
      "NumberFieldDiscriminant",
      "NumberFieldIntegralBasis",
      "NumberFieldSignature",
      "NumberQ",
      "Outer",
      "OverscriptBox",
      "PadLeft",
      "PadRight",
      "PaneBox",
      "PanelBox",
      "PartitionsQ",
      "PascalBinomial",
      "PathGraph",
      "PerfectNumber",
      "PermutationCycles",
      "PermutationGroup",
      "PermutationList",
      "PermutationReplace",
      "Permute",
      "PetersenGraph",
      "Pick",
      "Piecewise",
      "PiecewiseExpand",
      "PointBox",
      "PolygonBox",
      "PolyhedronBox",
      "PowerExpand",
      "PowersRepresentations",
      "Precision",
      "Prepend",
      "PrimeZetaP",
      "QBinomial",
      "QFactorial",
      "QPochhammer",
      "Quotient",
      "RadicalBox",
      "RadioButtonBox",
      "RamanujanTau",
      "Ramp",
      "RandomComplex",
      "RandomGraph",
      "RandomInteger",
      "RawBoxes",
      "ReIm",
      "RealAbs",
      "RealDigits",
      "RealSign",
      "Reap",
      "RectangleBox",
      "RecurrenceTable",
      "Refine",
      "Replace",
      "ReplacePart",
      "Rescale",
      "RiemannSiegelTheta",
      "RiemannSiegelZ",
      "RiemannZetaZero",
      "Riffle",
      "RisingFactorial",
      "RomanNumeral",
      "RowBox",
      "SawtoothWave",
      "SeedRandom",
      "SeriesCoefficient",
      "SetAttributes",
      "SortBy",
      "Sow",
      "Span",
      "SparseArray",
      "Split",
      "SplitBy",
      "SqrtBox",
      "SquareWave",
      "SquaresR",
      "StarGraph",
      "StringLength",
      "StringTake",
      "StyleBox",
      "Subgraph",
      "SubscriptBox",
      "Subsets",
      "SubsuperscriptBox",
      "SuperscriptBox",
      "Surd",
      "Switch",
      "SymmetricGroup",
      "TableViewBox",
      "TagBox",
      "TemplateSlot",
      "TextBox",
      "TextCell",
      "TextData",
      "Thread",
      "Through",
      "Throw",
      "TimeConstrained",
      "ToBoxes",
      "ToCharacterCode",
      "ToString",
      "Total",
      "TriangleWave",
      "TrigFactor",
      "Tuples",
      "TuranGraph",
      "UnderoverscriptBox",
      "UnderscriptBox",
      "UndirectedEdge",
      "UnitBox",
      "UnitStep",
      "UnitTriangle",
      "UpTo",
      "Vee",
      "VerificationTest",
      "VertexCount",
      "VertexDegree",
      "VertexEccentricity",
      "VertexInDegree",
      "VertexIndex",
      "VertexList",
      "VertexOutDegree",
      "Wedge",
      "WeightedAdjacencyMatrix",
      "WheelGraph",
      "While",
      "With",
    ].toSorted(),
  );
});

// Regression for the free-symbol leak `isolateFreeSymbols` (provenance.ts) guards against:
// `Sqrt(x^2)` types its free symbol `x` as `number`; `Or(x, True, z)` short-circuits to
// `True` while `x` is untyped, but THROWS an incompatible-type error once something else
// has typed `x` first on the SAME engine. A free symbol boxed outside any scope keeps its
// type; `isolateFreeSymbols` runs each example in a scope of its own. Two entries whose
// examples hit exactly this, sharing one engine pair — the normal way
// `provenanceLedger`/`collect` run the whole catalogue.
const typesXAsNumber: ReferenceEntry = {
  name: "Sqrt",
  domain: "arithmetic",
  signature: "Sqrt(x)",
  summary: "",
  examples: [{ id: "types-x", expr: ["Sqrt", ["Power", "x", 2]], expected: ["Sqrt", ["Power", "x", 2]] }],
};
const usesXInOr: ReferenceEntry = {
  name: "Or",
  domain: "logic",
  signature: "Or(a, b, c)",
  summary: "",
  examples: [{ id: "uses-x", expr: ["Or", "x", true, "z"], expected: "True" }],
};

test("classifying one entry does not change how a later entry classifies, on a shared engine", () => {
  const isolated = classify(new ComputeEngine(), declaredEngine(), usesXInOr);

  // `Or` classified right after `Sqrt`, reusing the SAME engine pair — without
  // `isolateFreeSymbols`, `x`'s type would still be `number` here and `Or`'s divergence
  // check would throw instead of matching `isolated`.
  const sharedBare = new ComputeEngine();
  const sharedOurs = declaredEngine();
  classify(sharedBare, sharedOurs, typesXAsNumber);
  const afterSqrt = classify(sharedBare, sharedOurs, usesXInOr);
  expect(afterSqrt).toEqual(isolated);

  // Order shouldn't matter either.
  const [viaLedgerReversed] = provenanceLedger(new ComputeEngine(), declaredEngine(), [usesXInOr, typesXAsNumber]);
  expect(viaLedgerReversed).toEqual(isolated);
});
