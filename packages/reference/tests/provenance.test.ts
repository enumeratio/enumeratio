import { ComputeEngine } from "@cortex-js/compute-engine";
import { HEADS } from "@enumeratio/wolfram/src";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/index.ts";
import { provenance } from "../src/provenance-data.ts";
import { declaredEngine } from "../scripts/engines.ts";
import { collect, divergences, divergingHeads, provenanceLedger } from "../scripts/provenance.ts";
import type { MathJSON } from "../src/types.ts";

const bare = new ComputeEngine();
const ours = declaredEngine();
const ledger = provenanceLedger(bare, ours, entries);

test("every documented head's provenance matches what its entry claims", () => {
  // The claim is the `library` field; the answer is what a bare engine actually does with
  // the head. `StirlingS1` sat documented as ours long after it was compute-engine's, and
  // only a hand probe caught it — this is that probe, for the whole catalogue.
  const wrong = ledger.filter((row) => !row.agrees);
  expect(
    wrong.map((row) => `${row.name}: computed ${row.provenance}, declared ${row.declared}`),
  ).toEqual([]);
});

test("the catalogue is mostly compute-engine's, and we know which part is not", () => {
  const counts = new Map<string, number>();
  for (const row of ledger) counts.set(row.provenance, (counts.get(row.provenance) ?? 0) + 1);
  // Not pinned exactly — it moves as the catalogue grows — but every head lands somewhere,
  // and an entry whose examples never call its own head cannot be classified at all.
  expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(entries.length);
  // Trails the actual count: heads move to extension as we widen them.
  expect(counts.get("compute-engine") ?? 0).toBeGreaterThan(30);
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
  // Residues, which also take IntegerMod classes.
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
    broken.map(
      (d) =>
        `${JSON.stringify(d.expression)}: ${JSON.stringify(d.bare)} → ${JSON.stringify(d.ours)}`,
    ),
  ).toEqual([]);
});

/**
 * The heads we knowingly change the behaviour of. Every one is a compute-engine head we
 * extend — a wider domain, a wider argument slot, or our own structures recognised — and
 * each falls back to the native handler when the input is not ours. `Gamma` and
 * `GammaRegularized` are here for the third argument (Wolfram's generalized incomplete
 * gamma, which a bare engine rejects as an unexpected argument), plus Γ(1, z) = e^{−z}.
 * Most of the integer and special functions are here for threading over a list, which a
 * bare engine rejects as a type error (`threadOverLists` in @enumeratio/boxed).
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
  "Arccot",
  "Arccsc",
  "Arcsec",
  "Arcsin",
  "At",
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
  "ContinuedFraction",
  "Cosh",
  "Digamma",
  "DigitCount",
  "DigitSum",
  "Divide",
  "DivisorSigma",
  "Divisors",
  "Dot",
  "Element",
  "Erf",
  "ErfInv",
  "Erfc",
  "ExtendedGCD",
  "FactorInteger",
  "Factorial2",
  "Fibonacci",
  "First",
  "FixedPoint",
  "Floor",
  "FromContinuedFraction",
  "FromDigits",
  "GCD",
  "Gamma",
  "GammaLn",
  "GammaRegularized",
  "IntegerDigits",
  "IntegerString",
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
  "LegendreSymbol",
  "Length",
  "Ln",
  "LucasL",
  "MatrixPower",
  "Max",
  "Mean",
  "Median",
  "Min",
  "Mod",
  "ModularInverse",
  "MoebiusMu",
  "Multinomial",
  "MultiplicativeOrder",
  "Multiply",
  "NextPrime",
  "Norm",
  "NthPrime",
  "Ordering",
  "Partition",
  "Pochhammer",
  "PolyGamma",
  "PolyLog",
  "Position",
  "Power",
  "PowerMod",
  "PrimeNu",
  "PrimeOmega",
  "PrimePi",
  "QuotientRing",
  "Rationalize",
  "Round",
  "Sin",
  "Sinh",
  "Sort",
  "Stirling",
  "StirlingS1",
  "Subfactorial",
  "Subtract",
  // Not itself overridden -- the StirlingS1/Stirling orthogonality identity sums a term
  // that used to stay unevaluated (S(1, 2), past the k > n boundary); Sum is the corpus
  // expression's own outer head, the same reason Add is here.
  "Sum",
  "Tanh",
  "Totient",
  "Union",
  "Zeta",
];

// Evaluates the whole corpus in both engines: seconds, not the default 5s budget on a busy box.
test(
  "we change exactly the compute-engine heads we mean to, and no others",
  { timeout: 60_000 },
  () => {
    const corpus = entries.flatMap((entry) => entry.examples.map((example) => example.expr));
    expect(divergingHeads(bare, ours, corpus)).toEqual(OVERRIDDEN);
  },
);

test("the committed provenance data is still what the engines say", { timeout: 60_000 }, () => {
  // `src/provenance-data.ts` is generated, and generated data goes stale silently. This is
  // the only thing stopping that: re-derive it here and compare. If it fails, run
  // `vp node packages/reference/scripts/collect-provenance.ts` and read the diff — a change
  // means a head moved between compute-engine's and ours, which is worth noticing.
  // Coverage comes from an external kernel, so it is carried forward rather than re-derived
  // here — this check is about the offline columns, which CI can always compute.
  expect(collect(bare, ours, entries, HEADS, provenance)).toEqual(
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
 * Everything here is a domain object rather than a function a general CAS would carry —
 * except ClausenCl, a textbook special function that Wolfram simply has no head for (it is
 * spelled Im[PolyLog[n, E^(I θ)]] there; mpmath has it as clsin/clcos, under other names) —
 * and RationalReconstruction, which the three leave to private helpers but SageMath and Maple
 * expose (`rational_reconstruction`, `iratrecon`). IntegerMod and IntegerModRing are Sage's
 * `Mod(a, m)` and `Zmod(m)`.
 *
 * TimeConstrained, MemoryConstrained, VerificationTest, Commonest, and the Wolfram-sweep list
 * heads (Span, UpTo, Riffle, Gather, GatherBy, Split, SplitBy, SortBy, PadLeft, PadRight,
 * NoneTrue, Nest, NestList, Outer, LinearRecurrence, RecurrenceTable, Association,
 * GeometricMean, HarmonicMean) are genuinely Wolfram's own (see `HEADS` in @enumeratio/wolfram)
 * — they land here only because `elsewhere` is filled in by the external-kernel coverage
 * script, which needs a Wolfram kernel this offline test suite doesn't have. Remove them once
 * a coverage run records `elsewhere: ["wolfram"]`. BesselJZero (Wolfram, mpmath) waits on the
 * same run, and so do IntegerPartitions (Wolfram) and SetPartitions (SymPy's
 * `multiset_partitions`): the collection families read as `unknown` until their entries
 * carried examples. IncompleteEllipticPi (Wolfram's own EllipticPi[n, φ, m], mpmath's
 * ellippi) waits too; KeiperLiLambda has no known equivalent elsewhere and should stay novel
 * even after a coverage run.
 *
 * ExpIntegralE, InverseErfc, InverseGammaRegularized, InverseBetaRegularized, BellY,
 * NorlundB, PrimeZetaP, HypergeometricPFQ and KleinInvariantJ are the same story: all nine
 * are genuinely Wolfram's own names (BellY and NorlundB also have a mpmath/sympy analogue in
 * some form), waiting on the same coverage run to fill in `elsewhere`.
 */
const NOVEL = [
  "TimeConstrained",
  "MemoryConstrained",
  "VerificationTest",
  "IntegerMod",
  "IntegerModRing",
  "RationalReconstruction",
  // The Wolfram-sweep backlog (packages/reference/src/backlog.json), landed in number-theory:
  // Wolfram has every one of these (see HEADS in @enumeratio/wolfram), but this offline suite
  // has no kernel to confirm it, so they land here rather than in the "known" list below.
  "DivisorSum",
  "IsCoprime",
  "IsPrimePower",
  "LiouvilleLambda",
  "MangoldtLambda",
  "MersennePrimeExponent",
  "PartitionsQ",
  "PerfectNumber",
  "PowersRepresentations",
  "RamanujanTau",
  "SquaresR",
  "EulerE",
  "FrobeniusSolve",
  "FrobeniusNumber",
  "ProfiniteNumber",
  "Adele",
  "Idele",
  "ProfiniteDecomposition",
  "ProfinitePlot",
  "MatrixExp",
  "IncompleteEllipticPi",
  "KeiperLiLambda",
  "ClausenCl",
  "BesselJZero",
  "DigammaFunctionZero",
  "MultiZetaValue",
  "HypergeometricUStar",
  "SloaneA",
  "QPochhammer",
  "QFactorial",
  "QBinomial",
  "RiemannSiegelTheta",
  "RiemannSiegelZ",
  "RiemannZetaZero",
  "Hypergeometric0F1",
  "Hypergeometric0F1Regularized",
  "Hypergeometric1F1Regularized",
  "Hypergeometric2F1Regularized",
  "Hypergeometric3F2Regularized",
  "HypergeometricU",
  "Hyperfactorial",
  "ExpIntegralE",
  "InverseErfc",
  "InverseGammaRegularized",
  "InverseBetaRegularized",
  "BellY",
  "NorlundB",
  "PrimeZetaP",
  "HypergeometricPFQ",
  "KleinInvariantJ",
  "ComplexExpand",
  "ExpToTrig",
  "FunctionExpand",
  "PowerExpand",
  "FullSimplify",
  "MatrixFunction",
  "CenteredInterval",
  "Around",
  "CubeRoot",
  "IntegerPart",
  "FractionalPart",
  "RealAbs",
  "RealSign",
  "UnitStep",
  "Gudermannian",
  "Basis",
  "AlgebraSignature",
  "AlgebraDimension",
  "Diagram",
  "PartitionAlgebra",
  "BrauerAlgebra",
  "TemperleyLiebAlgebra",
  "MotzkinAlgebra",
  "NumeralSystemShape",
  "IntegerLength",
  "IntegerReverse",
  "NumberExpand",
  "RomanNumeral",
  "RealDigits",
  "AdicNumeral",
  "AdicExpansion",
  "AdicValuation",
  "HenselLift",
  "HeckeT",
  "HeckeSpecialize",
  "MoebiusFunction",
  "MoebiusInvert",
  "PosetElements",
  "QuiverPath",
  "QuiverCompose",
  "QuiverIsAcyclic",
  "QSymM",
  "Antipode",
  "NSymR",
  "GroupBasis",
  "ClassSum",
  "ModularMatrix",
  "ModularWord",
  "Convergents",
  "ContinuedFractionK",
  "IsQuadraticIrrational",
  "ModularClasses",
  "RademacherSymbol",
  "FormClassNumber",
  "Braid",
  "AlexanderPolynomial",
  "JonesPolynomial",
  "Commonest",
  "Nest",
  "NestList",
  "Outer",
  "LinearRecurrence",
  "RecurrenceTable",
  "Association",
  "GeometricMean",
  "HarmonicMean",
  "Span",
  "UpTo",
  "Riffle",
  "Gather",
  "GatherBy",
  "Split",
  "SplitBy",
  "SortBy",
  "PadLeft",
  "PadRight",
  "NoneTrue",
  "IntegerPartitions",
  "SetPartitions",
];

test("every head we invented is either novel or known to exist elsewhere", () => {
  const ours = provenance.filter((record) => record.provenance === "extension");
  const novel = ours.filter((record) => record.elsewhere.length === 0).map((r) => r.name);
  expect(novel).toEqual(NOVEL);
  // …and the rest exist elsewhere, which is the upstreaming shortlist: a function a
  // general system already carries, that we implemented again.
  const known = ours.filter((record) => record.elsewhere.length > 0);
  expect(known.map((record) => record.name)).toEqual([
    "PowerModList",
    "PrimitiveRootList",
    "Quotient",
    "KroneckerSymbol",
    "IntegerExponent",
    "HermiteDecomposition",
    "HurwitzZeta",
    "LerchPhi",
    "BarnesG",
    "LogBarnesG",
    "LogGamma",
    "DirichletEta",
    "DirichletBeta",
    "StieltjesGamma",
    "DirichletCharacter",
    "DirichletL",
    "HarmonicNumber",
    "NonCommutativeMultiply",
    "Coproduct",
    "Subsets",
    "SymmetricGroup",
  ]);
  // LerchPhi is in all three, so it has the strongest oracle coverage of anything we add.
  expect(known.find((record) => record.name === "LerchPhi")?.elsewhere).toEqual([
    "wolfram",
    "sympy",
    "mpmath",
  ]);
});
