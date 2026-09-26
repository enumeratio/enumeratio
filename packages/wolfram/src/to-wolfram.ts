// MathJSON → Wolfram Language source. Wolfram's uniform `Head[args]` syntax
// means most of the work is a name map (compute-engine head → WL symbol) plus a
// handful of structural forms; unmapped heads fall through as `Head[args]`, so
// coverage degrades gracefully. Pure (MathJSON in, string out): no compute-engine
// dependency, so it ports cleanly into a compute-engine LanguageTarget later.

export type MathJson =
  | number
  | string
  | boolean
  | { num: string }
  | { str: string }
  | { sym: string }
  | { fn: MathJson[] }
  | MathJson[];

/** compute-engine symbol constants whose Wolfram spelling differs. Exported so
 * `fromWolfram` can build the reverse mapping from the same source. */
export const SYMBOLS: Record<string, string> = {
  Pi: "Pi",
  ExponentialE: "E",
  ImaginaryUnit: "I",
  MachineEpsilon: "$MachineEpsilon",
  GoldenRatio: "GoldenRatio",
  EulerGamma: "EulerGamma",
  CatalanConstant: "Catalan",
  // Our analytic library declares `Catalan` under Wolfram's own spelling, so the constant
  // reaches here by two names. The reverse map keeps `CatalanConstant`, which is the one
  // compute-engine ships.
  Catalan: "Catalan",
  True: "True",
  False: "False",
  NaN: "Indeterminate",
  PositiveInfinity: "Infinity",
  NegativeInfinity: "-Infinity",
  ComplexInfinity: "ComplexInfinity",
  Nothing: "Null",
  // @enumeratio/aestimatio's own marker, under Wolfram's `$`-prefixed spelling — compute-engine's
  // symbol grammar rejects a leading `$` (see aestimatio/src/declare.ts).
  Aborted: "$Aborted",
};

/** compute-engine head → Wolfram head. Identity entries are listed on purpose: the
 * map doubles as the registry of heads the transpiler vouches for (`isWolframHead`),
 * as opposed to heads that merely fall through by name. Exported so `fromWolfram`
 * can build the reverse mapping from the same source. */
export const HEADS: Record<string, string> = {
  // arithmetic / structural
  Add: "Plus",
  Subtract: "Subtract",
  Multiply: "Times",
  Divide: "Divide",
  Negate: "Minus",
  Power: "Power",
  Sqrt: "Sqrt",
  Abs: "Abs",
  Sign: "Sign",
  Floor: "Floor",
  Ceil: "Ceiling",
  Round: "Round",
  Max: "Max",
  Min: "Min",
  Rational: "Rational",
  Complex: "Complex",
  Mod: "Mod",
  N: "N",
  Chop: "Chop",
  Rationalize: "Rationalize",
  Equal: "Equal",
  NotEqual: "Unequal",
  Less: "Less",
  Greater: "Greater",
  LessEqual: "LessEqual",
  GreaterEqual: "GreaterEqual",
  // Wolfram's chained-comparison form -- our `Inequality` takes the identical
  // value/operator/value/... shape, operator names included (they go through this same
  // map, since `symbolToWolfram` falls back to `HEADS`), so a straight rename round-trips.
  Inequality: "Inequality",
  // `x -> 1`: also how `FindInstance`'s `{{x -> 1}}` is built (a `List` of `List`s of
  // `Rule`s) -- see @enumeratio/analytic's find-instance.ts.
  Rule: "Rule",
  // Same argument order both sides: expr, vars, [domain], [n].
  FindInstance: "FindInstance",
  // Same argument order and `{f, cons}`/`{n, a, b}` shapes both sides -- see
  // @enumeratio/analytic's optimize.ts, nminmax.ts, nsum.ts.
  Minimize: "Minimize",
  Maximize: "Maximize",
  MinValue: "MinValue",
  MaxValue: "MaxValue",
  NMinimize: "NMinimize",
  NMaximize: "NMaximize",
  NSum: "NSum",
  And: "And",
  Or: "Or",
  Not: "Not",
  // Boolean normal forms (packages/symbols/combinatorics/collections/src/logic-frontier.ts).
  LogicalExpand: "LogicalExpand",
  BooleanConvert: "BooleanConvert",
  // Predicates — Wolfram's `…Q` names for what we spell `Is…` (same convention as
  // `IsPrime: "PrimeQ"` above). `IsTrue` is Wolfram's `TrueQ`, not a straight rename.
  IsTrue: "TrueQ",
  IsInteger: "IntegerQ",
  IsVector: "VectorQ",
  IsMatrix: "MatrixQ",
  IsArray: "ArrayQ",
  IsMersennePrimeExponent: "MersennePrimeExponentQ",
  IsIntervalMember: "IntervalMemberQ",
  List: "List",
  Tuple: "List", // Wolfram has no tuple; `{k, 0, 4}` is also how it spells an iterator
  Function: "Function",
  // Holonomic reductions (@enumeratio/analytic's difference-root.ts / differential-root.ts):
  // plain renames — the `Function[{y, n}, …][n]` operator-application shape is a SPECIAL case
  // below (see `Apply`), and `Function` itself needs one too (see `Function` in SPECIAL).
  DifferenceRoot: "DifferenceRoot",
  DifferenceRootReduce: "DifferenceRootReduce",
  DifferentialRoot: "DifferentialRoot",
  DifferentialRootReduce: "DifferentialRootReduce",
  Sum: "Sum",
  Product: "Product",
  // elementary
  Exp: "Exp",
  Ln: "Log",
  Log10: "Log10",
  Log2: "Log2",
  Lb: "Log2",
  Sin: "Sin",
  Cos: "Cos",
  Tan: "Tan",
  Cot: "Cot",
  Sec: "Sec",
  Csc: "Csc",
  Sinh: "Sinh",
  Cosh: "Cosh",
  Tanh: "Tanh",
  Coth: "Coth",
  Sech: "Sech",
  Csch: "Csch",
  Arcsin: "ArcSin",
  Arccos: "ArcCos",
  Arctan: "ArcTan",
  Arsinh: "ArcSinh",
  Arcosh: "ArcCosh",
  Artanh: "ArcTanh",
  // Arccot is NOT a straight rename to ArcCot — see SPECIAL: compute-engine's range is
  // (0, π) but Wolfram's is (-π/2, π/2], which disagree at negative arguments
  // (Arccot(-1) = 3π/4 vs ArcCot[-1] = -π/4).
  Arccsc: "ArcCsc",
  Arcsec: "ArcSec",
  Arcoth: "ArcCoth",
  Arcsch: "ArcCsch",
  Arsech: "ArcSech",
  // combinatorics / sequences
  Binomial: "Binomial",
  Factorial: "Factorial",
  Factorial2: "Factorial2",
  Subfactorial: "Subfactorial",
  Multinomial: "Multinomial",
  Fibonacci: "Fibonacci",
  LucasL: "LucasL",
  CatalanNumber: "CatalanNumber",
  BellNumber: "BellB",
  BernoulliB: "BernoulliB",
  BernoulliPolynomial: "BernoulliB",
  HarmonicNumber: "HarmonicNumber",
  Stirling: "StirlingS2", // compute-engine `Stirling` is the second kind
  StirlingS1: "StirlingS1",
  GeneratingFunction: "GeneratingFunction",
  ExponentialGeneratingFunction: "ExponentialGeneratingFunction",
  FindSequenceFunction: "FindSequenceFunction",
  DiscreteRatio: "DiscreteRatio",
  Pochhammer: "Pochhammer",
  // Fungrim's name for the same head — see @enumeratio/analytic's rising-factorial.ts.
  RisingFactorial: "Pochhammer",
  // Fungrim's name for falling factorial — see @enumeratio/analytic's falling-factorial.ts.
  FallingFactorial: "FactorialPower",
  // number theory
  IsPrime: "PrimeQ",
  IsOdd: "OddQ",
  IsEven: "EvenQ",
  IsSquareFree: "SquareFreeQ",
  Totient: "EulerPhi",
  MoebiusMu: "MoebiusMu",
  PrimePi: "PrimePi",
  NthPrime: "Prime",
  NextPrime: "NextPrime",
  Divisors: "Divisors",
  DivisorSigma: "DivisorSigma",
  PrimeNu: "PrimeNu",
  PrimeOmega: "PrimeOmega",
  FactorInteger: "FactorInteger",
  GCD: "GCD",
  LCM: "LCM",
  ExtendedGCD: "ExtendedGCD",
  PowerMod: "PowerMod",
  PowerModList: "PowerModList",
  MultiplicativeOrder: "MultiplicativeOrder",
  PrimitiveRootList: "PrimitiveRootList",
  // the Wolfram-sweep backlog (packages/reference/src/backlog.json), landed in number-theory.
  CarmichaelLambda: "CarmichaelLambda",
  DivisorSum: "DivisorSum",
  EulerE: "EulerE",
  FrobeniusNumber: "FrobeniusNumber",
  FrobeniusSolve: "FrobeniusSolve",
  IsCoprime: "CoprimeQ",
  IsPerfect: "PerfectNumberQ",
  IsPrimePower: "PrimePowerQ",
  LiouvilleLambda: "LiouvilleLambda",
  MangoldtLambda: "MangoldtLambda",
  MersennePrimeExponent: "MersennePrimeExponent",
  PartitionsQ: "PartitionsQ",
  PerfectNumber: "PerfectNumber",
  PowersRepresentations: "PowersRepresentations",
  RamanujanTau: "RamanujanTau",
  SquaresR: "SquaresR",
  // aestimatio: Wolfram's own concepts, named identically.
  TimeConstrained: "TimeConstrained",
  MemoryConstrained: "MemoryConstrained",
  VerificationTest: "VerificationTest",
  TestResultObject: "TestResultObject",
  Quotient: "Quotient",
  ModularInverse: "ModularInverse",
  ChineseRemainder: "ChineseRemainder",
  JacobiSymbol: "JacobiSymbol",
  // Wolfram has no LegendreSymbol; on its domain (p an odd prime) it is the Jacobi symbol.
  LegendreSymbol: "JacobiSymbol",
  KroneckerSymbol: "KroneckerSymbol",
  IntegerExponent: "IntegerExponent",
  HermiteDecomposition: "HermiteDecomposition",
  IntegerDigits: "IntegerDigits",
  FromDigits: "FromDigits",
  IntegerString: "IntegerString",
  DigitCount: "DigitCount",
  // Wolfram's own DigitSum[n, b, k]: k > 0 sums the first k digits, k < 0 the last |k|.
  // Not Total[IntegerDigits[n, b, k]], which keeps the last k digits (zero-padded).
  DigitSum: "DigitSum",
  ContinuedFraction: "ContinuedFraction",
  IntegerLength: "IntegerLength",
  IntegerReverse: "IntegerReverse",
  NumberExpand: "NumberExpand",
  RealDigits: "RealDigits",
  RomanNumeral: "RomanNumeral",
  ContinuedFractionK: "ContinuedFractionK",
  Convergents: "Convergents",
  // Wolfram's own spelling is `QuadraticIrrationalQ`; ours follows compute-engine's `Is…`
  // convention instead (see the backlog note on naming).
  IsQuadraticIrrational: "QuadraticIrrationalQ",
  // special functions
  Gamma: "Gamma",
  GammaLn: "LogGamma",
  Beta: "Beta",
  Erf: "Erf",
  Erfc: "Erfc",
  ErfInv: "InverseErf",
  Zeta: "Zeta", // one argument is Riemann, two is Hurwitz — in both systems
  HurwitzZeta: "HurwitzZeta",
  LerchPhi: "LerchPhi",
  // Function* real-analysis properties (function-properties.ts) — same argument
  // order as ours in every case, so a plain rename is enough.
  FunctionDomain: "FunctionDomain",
  FunctionRange: "FunctionRange",
  FunctionMonotonicity: "FunctionMonotonicity",
  FunctionConvexity: "FunctionConvexity",
  FunctionSign: "FunctionSign",
  FunctionInjective: "FunctionInjective",
  FunctionSurjective: "FunctionSurjective",
  FunctionSingularities: "FunctionSingularities",
  FunctionDiscontinuities: "FunctionDiscontinuities",
  FunctionAnalytic: "FunctionAnalytic",
  FunctionMeromorphic: "FunctionMeromorphic",
  FunctionPeriod: "FunctionPeriod",
  PolyLog: "PolyLog",
  Digamma: "PolyGamma",
  PolyGamma: "PolyGamma",
  GammaRegularized: "GammaRegularized",
  BetaRegularized: "BetaRegularized",
  ChebyshevT: "ChebyshevT",
  ChebyshevU: "ChebyshevU",
  // Fungrim's name for LegendreP — see @enumeratio/analytic's legendre.ts.
  LegendrePolynomial: "LegendreP",
  // Fungrim's names for the incomplete Legendre elliptic integrals, same (φ, m) order —
  // see @enumeratio/analytic's elliptic.ts. IncompleteEllipticPi's (n, φ, m) order also
  // matches Wolfram's own three-argument EllipticPi[n, φ, m] directly, so this is a plain
  // rename too, not a SPECIAL reordering.
  IncompleteEllipticF: "EllipticF",
  IncompleteEllipticE: "EllipticE",
  IncompleteEllipticPi: "EllipticPi",
  // collections
  At: "Part",
  First: "First",
  Last: "Last",
  Rest: "Rest",
  Most: "Most",
  Take: "Take",
  Drop: "Drop",
  Length: "Length",
  Count: "Count",
  Position: "Position",
  FirstPosition: "FirstPosition",
  Reverse: "Reverse",
  Sort: "Sort",
  Ordering: "Ordering",
  Partition: "Partition",
  Range: "Range",
  Join: "Join",
  Flatten: "Flatten",
  Append: "Append",
  Prepend: "Prepend",
  Union: "Union",
  Intersection: "Intersection",
  SetMinus: "Complement",
  Dot: "Dot",
  Covariance: "Covariance",
  Mean: "Mean",
  Median: "Median",
  Commonest: "Commonest",
  GeometricMean: "GeometricMean",
  HarmonicMean: "HarmonicMean",
  Nest: "Nest",
  NestList: "NestList",
  FixedPoint: "FixedPoint",
  Outer: "Outer",
  LinearRecurrence: "LinearRecurrence",
  RecurrenceTable: "RecurrenceTable",
  Association: "Association",
  With: "With",
  Module: "Module",
  Reap: "Reap",
  Sow: "Sow",
  Do: "Do",
  Switch: "Switch",
  While: "While",
  NestWhile: "NestWhile",
  NestWhileList: "NestWhileList",
  FixedPointList: "FixedPointList",
  Throw: "Throw",
  Catch: "Catch",
  Echo: "Echo",
  AbsoluteTiming: "AbsoluteTiming",
  Attributes: "Attributes",
  SetAttributes: "SetAttributes",
  AppendTo: "AppendTo",
  Riffle: "Riffle",
  Span: "Span",
  UpTo: "UpTo",
  Gather: "Gather",
  GatherBy: "GatherBy",
  Split: "Split",
  SplitBy: "SplitBy",
  SortBy: "SortBy",
  PadLeft: "PadLeft",
  PadRight: "PadRight",
  NoneTrue: "NoneTrue",
  Array: "Array",
  Accumulate: "Accumulate",
  FoldList: "FoldList",
  Cases: "Cases",
  SparseArray: "SparseArray",
  RandomInteger: "RandomInteger",
  SeedRandom: "SeedRandom",
  IsNumeric: "NumericQ",
  IsMachineNumber: "MachineNumberQ",
  Precision: "Precision",
  Thread: "Thread",
  MapAt: "MapAt",
  Normalize: "Normalize",
  Surd: "Surd",
  LetterNumber: "LetterNumber",
  FactorialPower: "FactorialPower",
  DifferenceDelta: "DifferenceDelta",
  HankelMatrix: "HankelMatrix",
  MovingMap: "MovingMap",
  PascalBinomial: "PascalBinomial",
  CellularAutomaton: "CellularAutomaton",
  Variance: "Variance",
  StandardDeviation: "StandardDeviation",
  // Distributions (@enumeratio/statistics/src/distributions.ts): PDF/CDF/Mean/Variance
  // above are compute-engine natives, extended in place for these — identity here already.
  Distributed: "Distributed",
  RandomVariate: "RandomVariate",
  EmpiricalDistribution: "EmpiricalDistribution",
  BetaDistribution: "BetaDistribution",
  GammaDistribution: "GammaDistribution",
  BinormalDistribution: "BinormalDistribution",
  Expectation: "Expectation",
  Probability: "Probability",
  NormalDistribution: "NormalDistribution",
  UniformDistribution: "UniformDistribution",
  PoissonDistribution: "PoissonDistribution",
  BinomialDistribution: "BinomialDistribution",
  PDF: "PDF",
  CDF: "CDF",
  // Second-wave distributions (@enumeratio/statistics/src/distributions-2.ts) and the
  // property functions that read any distribution — identity here already.
  GeometricDistribution: "GeometricDistribution",
  BernoulliDistribution: "BernoulliDistribution",
  DiscreteUniformDistribution: "DiscreteUniformDistribution",
  TriangularDistribution: "TriangularDistribution",
  ChiSquareDistribution: "ChiSquareDistribution",
  LogNormalDistribution: "LogNormalDistribution",
  NegativeBinomialDistribution: "NegativeBinomialDistribution",
  CauchyDistribution: "CauchyDistribution",
  StudentTDistribution: "StudentTDistribution",
  WeibullDistribution: "WeibullDistribution",
  LaplaceDistribution: "LaplaceDistribution",
  HypergeometricDistribution: "HypergeometricDistribution",
  RayleighDistribution: "RayleighDistribution",
  ParetoDistribution: "ParetoDistribution",
  LogisticDistribution: "LogisticDistribution",
  ErlangDistribution: "ErlangDistribution",
  ChiDistribution: "ChiDistribution",
  HalfNormalDistribution: "HalfNormalDistribution",
  MaxwellDistribution: "MaxwellDistribution",
  SurvivalFunction: "SurvivalFunction",
  HazardFunction: "HazardFunction",
  Moment: "Moment",
  CentralMoment: "CentralMoment",
  FactorialMoment: "FactorialMoment",
  Cumulant: "Cumulant",
  InverseCDF: "InverseCDF",
  // Third-wave distribution heads (@enumeratio/statistics/src/distributions-3.ts) —
  // identity here already.
  CharacteristicFunction: "CharacteristicFunction",
  MomentGeneratingFunction: "MomentGeneratingFunction",
  // Fourth-wave (compound) distribution heads (@enumeratio/statistics/src/distributions-4.ts)
  // — identity here already.
  TruncatedDistribution: "TruncatedDistribution",
  MixtureDistribution: "MixtureDistribution",
  ProductDistribution: "ProductDistribution",
  TransformedDistribution: "TransformedDistribution",
  MarginalDistribution: "MarginalDistribution",
  DirichletDistribution: "DirichletDistribution",
  // Fifth-wave (narrowed) probability heads (@enumeratio/statistics/src/distributions-5.ts) —
  // identity here already.
  NExpectation: "NExpectation",
  NProbability: "NProbability",
  Conditioned: "Conditioned",
  // Sixth-wave (deferred) distribution heads (@enumeratio/statistics/src/distributions-6.ts) —
  // identity here already.
  MultinomialDistribution: "MultinomialDistribution",
  MultinormalDistribution: "MultinormalDistribution",
  MultivariatePoissonDistribution: "MultivariatePoissonDistribution",
  ProbabilityDistribution: "ProbabilityDistribution",
  ParameterMixtureDistribution: "ParameterMixtureDistribution",
  HistogramDistribution: "HistogramDistribution",
  // Random-process heads (@enumeratio/statistics/src/processes.ts) — identity here already.
  // `RandomFunction` diverges in RESULT SHAPE (a plain list of {t, x} pairs, not a
  // `TemporalData` object) and `SliceDistribution` is our bridge for Wolfram's `proc[t]`
  // application, but both are the same Wolfram head used the same way, so `HEADS` (not
  // `FOREIGN`) is still the right list — see each head's own reference entry for the
  // divergence.
  WienerProcess: "WienerProcess",
  PoissonProcess: "PoissonProcess",
  SliceDistribution: "SliceDistribution",
  RandomFunction: "RandomFunction",
  Determinant: "Det",
  MatrixExp: "MatrixExp",
  MatrixRank: "MatrixRank",
  Rank: "ArrayDepth",
  Transpose: "Transpose",
  Filter: "Select",
  Shape: "Dimensions",
  Repeat: "ConstantArray",
  Random: "RandomReal",
  // AllTrue/AnyTrue require a test (Wolfram's 1-arg form doesn't evaluate either), so the
  // no-predicate form of All/Any is inert on both sides — no arity check needed here.
  All: "AllTrue",
  Any: "AnyTrue",
  // Same order on both sides: Fold(f, init, xs) is Fold[f, x, list].
  Fold: "Fold",
  // Divides(a, b) asks whether a divides b; Wolfram's Divisible(n, m) asks whether m
  // divides n — same relation, arguments swapped. See SPECIAL.
  Divides: "Divisible",
  IsComposite: "CompositeQ",
  // Same (collection, value) order as Wolfram's MemberQ[list, form]; ours is a structural
  // equality test rather than a pattern match, which agrees on any literal value.
  Contains: "MemberQ",
  // Both keep first-occurrence order.
  Unique: "DeleteDuplicates",

  // ── heads our own libraries add that Wolfram already has, under the same meaning ──
  //
  // These used to fall through by name, which gave the right answer by accident. Listing
  // them makes the claim explicit — and `isWolframHead` then tells the oracle it may probe
  // a kernel for them, which is the point: a head Wolfram can answer is a head we can be
  // cross-checked on.
  CircleTimes: "CircleTimes",
  NonCommutativeMultiply: "NonCommutativeMultiply",
  OverBar: "OverBar",
  CliffordAlgebra: "CliffordAlgebra",
  GrassmannAlgebra: "GrassmannAlgebra",
  // `@enumeratio/geometric`'s outer and regressive products. The rest of that package's
  // heads (Dual, Grade, GradePart, Pseudoscalar, Reversion, GradeInvolution,
  // CliffordConjugate, LeftContraction, RightContraction, ScalarProduct, Sandwich) are
  // names we coined — Wolfram's System` context has no symbol by any of those spellings —
  // so they are left out of both HEADS and FOREIGN and fall through by name, harmlessly.
  Wedge: "Wedge",
  Vee: "Vee",
  MixedRadixNumerals: "MixedRadix",
  // The old spelling, kept as a numerals-package alias (see `NUMERAL_ALIASES`) — same
  // head, same name as Wolfram's, so it belongs here too rather than falling through.
  MixedRadix: "MixedRadix",
  Coproduct: "Coproduct",
  SymmetricGroup: "SymmetricGroup",
  AlternatingGroup: "AlternatingGroup",
  CyclicGroup: "CyclicGroup",
  DihedralGroup: "DihedralGroup",
  GroupOrder: "GroupOrder",
  GroupElements: "GroupElements",
  GroupGenerators: "GroupGenerators",
  PermutationGroup: "PermutationGroup",
  Cycles: "Cycles",
  Permute: "Permute",
  InversePermutation: "InversePermutation",
  FareySequence: "FareySequence",
  IntegerPartitions: "IntegerPartitions",
  Subsets: "Subsets",
  Tuples: "Tuples",
  PermutationCycles: "PermutationCycles",
  PermutationList: "PermutationList",
  PermutationReplace: "PermutationReplace",
  Rasterize: "Rasterize",
  // The analytic heads. `LogGamma` is also what `GammaLn` lowers to, so the reverse map
  // keeps `GammaLn` (first entry wins) and this direction is one-way.
  LogGamma: "LogGamma",
  BarnesG: "BarnesG",
  LogBarnesG: "LogBarnesG",
  DirichletEta: "DirichletEta",
  DirichletBeta: "DirichletBeta",
  DirichletCharacter: "DirichletCharacter",
  DirichletL: "DirichletL",
  BesselJZero: "BesselJZero",
  StieltjesGamma: "StieltjesGamma",
  CarlsonRF: "CarlsonRF",
  CarlsonRC: "CarlsonRC",
  CarlsonRD: "CarlsonRD",
  CarlsonRJ: "CarlsonRJ",
  CarlsonRG: "CarlsonRG",
  // The Jacobi elliptic family (jacobi-elliptic.ts) and Jacobi theta functions (theta.ts) —
  // same names and (u,m)/(a,u,q) argument order as Wolfram, m = k² throughout.
  JacobiSN: "JacobiSN",
  JacobiCN: "JacobiCN",
  JacobiDN: "JacobiDN",
  JacobiCD: "JacobiCD",
  JacobiCS: "JacobiCS",
  JacobiDC: "JacobiDC",
  JacobiDS: "JacobiDS",
  JacobiNC: "JacobiNC",
  JacobiND: "JacobiND",
  JacobiNS: "JacobiNS",
  JacobiSC: "JacobiSC",
  JacobiSD: "JacobiSD",
  JacobiAmplitude: "JacobiAmplitude",
  JacobiZN: "JacobiZN",
  EllipticTheta: "EllipticTheta",
  EllipticThetaPrime: "EllipticThetaPrime",
  // The hypergeometric heads: 1F1 and 2F1 themselves are compute-engine natives (never
  // reach here via `declaredNames()`), so only what hypergeometric.ts / hypergeometric-ustar.ts
  // add. Hypergeometric3F2Regularized has no dedicated Wolfram head — it maps into the generic
  // `HypergeometricPFQRegularized` in SPECIAL below, not here.
  Hypergeometric0F1: "Hypergeometric0F1",
  Hypergeometric0F1Regularized: "Hypergeometric0F1Regularized",
  Hypergeometric1F1Regularized: "Hypergeometric1F1Regularized",
  Hypergeometric2F1Regularized: "Hypergeometric2F1Regularized",
  HypergeometricU: "HypergeometricU",
  // Backlog transformers and interval/uncertainty arithmetic (@enumeratio/analytic) — same
  // name, same meaning as Wolfram's, within the scope each declares.
  ComplexExpand: "ComplexExpand",
  ExpToTrig: "ExpToTrig",
  FunctionExpand: "FunctionExpand",
  PowerExpand: "PowerExpand",
  FullSimplify: "FullSimplify",
  MatrixFunction: "MatrixFunction",
  CenteredInterval: "CenteredInterval",
  Around: "Around",
  HypergeometricPFQ: "HypergeometricPFQ",
  // Same argument order both sides: LaplaceTransform[f, t, s], InverseLaplaceTransform[F, s, t].
  LaplaceTransform: "LaplaceTransform",
  InverseLaplaceTransform: "InverseLaplaceTransform",
  // FourierTransform[f, t, w] / InverseFourierTransform[F, w, t]; both sides default to
  // FourierParameters -> {0, 1}, which is all this transpiler's own heads implement.
  FourierTransform: "FourierTransform",
  InverseFourierTransform: "InverseFourierTransform",
  // Fourier[list] / InverseFourier[list]: same argument order, same default
  // FourierParameters -> {0, 1}, and an optional trailing FourierParameters rule both
  // sides read the same way.
  Fourier: "Fourier",
  InverseFourier: "InverseFourier",
  // FourierSeries[f, x, n] / FourierCoefficient[f, x, n]: same order, both always on
  // [-Pi, Pi] (no period argument on either side).
  FourierSeries: "FourierSeries",
  FourierCoefficient: "FourierCoefficient",
  // MeijerG[{{a..},{a..}}, {{b..},{b..}}, z] — same nested-list shape and argument order.
  MeijerG: "MeijerG",
  // MeijerGReduce[expr, x] — same order; Wolfram's own output may use its generalized
  // 5-argument MeijerG (an extra scale parameter), ours always emits the plain 4-argument form.
  MeijerGReduce: "MeijerGReduce",
  // Same λ = θ₂⁴/θ₃⁴ convention. ModularJ is unmapped: KleinInvariantJ is j/1728, and HEADS
  // can't carry a scale. EisensteinG has no Wolfram head.
  ModularLambda: "ModularLambda",
  KleinInvariantJ: "KleinInvariantJ",
  ExpIntegralE: "ExpIntegralE",
  InverseErfc: "InverseErfc",
  InverseGammaRegularized: "InverseGammaRegularized",
  InverseBetaRegularized: "InverseBetaRegularized",
  BellY: "BellY",
  NorlundB: "NorlundB",
  PrimeZetaP: "PrimeZetaP",
  // ConstGlaisher is our spelling; Wolfram's is Glaisher.
  ConstGlaisher: "Glaisher",
  // The elementary heads `@enumeratio/analytic` adds under Wolfram's own names.
  CubeRoot: "CubeRoot",
  IntegerPart: "IntegerPart",
  FractionalPart: "FractionalPart",
  RealAbs: "RealAbs",
  RealSign: "RealSign",
  UnitStep: "UnitStep",
  Gudermannian: "Gudermannian",
  // Refine/Assuming/Piecewise/PiecewiseExpand — same name and meaning as Wolfram's; see
  // packages/symbols/analysis/analytic/src/refine-assuming.ts and piecewise.ts for the (scoped)
  // subset of Wolfram's semantics each one covers.
  Refine: "Refine",
  Assuming: "Assuming",
  Piecewise: "Piecewise",
  PiecewiseExpand: "PiecewiseExpand",
  // The signal/piecewise-waveform family declared in signals.ts -- same names and meaning
  // as Wolfram's, boundary values included.
  UnitBox: "UnitBox",
  UnitTriangle: "UnitTriangle",
  HeavisideTheta: "HeavisideTheta",
  HeavisideLambda: "HeavisideLambda",
  HeavisidePi: "HeavisidePi",
  Ramp: "Ramp",
  SawtoothWave: "SawtoothWave",
  TriangleWave: "TriangleWave",
  SquareWave: "SquareWave",
  Rescale: "Rescale",
  DiracDelta: "DiracDelta",
  DiscreteDelta: "DiscreteDelta",
  DiscreteShift: "DiscreteShift",
  // SeriesCoefficient(f, {x, x0, n}) — the argument shape matches Wolfram's directly (see
  // series-coefficient.ts), so this is a plain rename, not a SPECIAL reordering.
  SeriesCoefficient: "SeriesCoefficient",
  // compute-engine's native `BigO(g)` (the Landau remainder term `Series` emits) is
  // Wolfram's `O` — but the exponent is spelled differently (`BigO(x^7)` vs. `O[x]^7`,
  // a `Power` wrapping the `O[...]` object rather than sitting inside it), so the
  // restructuring goes through SPECIAL below; this entry only exists so `REVERSE_HEADS`
  // (built from HEADS) has an entry for Wolfram's bare `O`.
  BigO: "O",
  // Khinchin's constant — same name and meaning as Wolfram's.
  Khinchin: "Khinchin",
  // Hyperfactorial — same name and meaning as Wolfram's.
  Hyperfactorial: "Hyperfactorial",
  // The q-series heads (packages/symbols/analysis/analytic/src/q-series.ts): same names, same argument
  // order as Wolfram's.
  QPochhammer: "QPochhammer",
  QFactorial: "QFactorial",
  QBinomial: "QBinomial",
  // Riemann-Siegel (packages/symbols/analysis/analytic/src/riemann-siegel.ts): theta and Z keep Wolfram's
  // names and single real argument. RiemannZetaZero is compute-engine/Fungrim's spelling
  // for what Wolfram calls ZetaZero — same single argument k, just a different name, so
  // a plain rename here (not SPECIAL) is enough.
  RiemannSiegelTheta: "RiemannSiegelTheta",
  RiemannSiegelZ: "RiemannSiegelZ",
  RiemannZetaZero: "ZetaZero",
  // Wolfram spells map composition `Composition`, and reads it right to left as we do.
  Compose: "Composition",

  // Graphs (packages/symbols/combinatorics/collections/src/graphs.ts). Wolfram's InputForm
  // prints UndirectedEdge/DirectedEdge infix (`1 <-> 2`, `1 -> 2`); `Head[args]` call form
  // is equivalent WL syntax and evaluates identically, so a plain rename is enough here —
  // no SPECIAL entry needed. `ConnectedGraphQ`/`TreeGraphQ`/`BipartiteGraphQ` are Wolfram's
  // names for what we spell `Is…` (same convention as `IsPrime: "PrimeQ"` above).
  //
  // PathGraph is deliberately NOT here (see FOREIGN below instead): `PathGraph(n)` is our
  // own convenience extension over a call shape real Wolfram ERRORS on (kernel-verified:
  // `PathGraph[3]` only accepts a vertex list), and HEADS has no way to map conditionally
  // on call shape -- a plain rename here would "vouch for" (`isWolframHead`) every call,
  // including the one that errors.
  UndirectedEdge: "UndirectedEdge",
  DirectedEdge: "DirectedEdge",
  Graph: "Graph",
  VertexList: "VertexList",
  EdgeList: "EdgeList",
  VertexCount: "VertexCount",
  EdgeCount: "EdgeCount",
  VertexDegree: "VertexDegree",
  AdjacencyMatrix: "AdjacencyMatrix",
  IncidenceMatrix: "IncidenceMatrix",
  CompleteGraph: "CompleteGraph",
  CycleGraph: "CycleGraph",
  StarGraph: "StarGraph",
  GridGraph: "GridGraph",
  HypercubeGraph: "HypercubeGraph",
  CompleteKaryTree: "CompleteKaryTree",
  PetersenGraph: "PetersenGraph",
  ConnectedComponents: "ConnectedComponents",
  IsConnectedGraph: "ConnectedGraphQ",
  FindShortestPath: "FindShortestPath",
  GraphDistance: "GraphDistance",
  IsTreeGraph: "TreeGraphQ",
  IsBipartiteGraph: "BipartiteGraphQ",
  NeighborhoodGraph: "NeighborhoodGraph",
  Subgraph: "Subgraph",

  // Second wave (packages/symbols/combinatorics/collections/src/graphs-2.ts): distance
  // measures, more `Is…`-for-`…Q` predicates, and a few more named/random constructors.
  // Same plain-rename story as the block above -- every one of these is Wolfram's own name.
  GraphDistanceMatrix: "GraphDistanceMatrix",
  VertexEccentricity: "VertexEccentricity",
  GraphRadius: "GraphRadius",
  GraphDiameter: "GraphDiameter",
  GraphCenter: "GraphCenter",
  GraphPeriphery: "GraphPeriphery",
  VertexIndex: "VertexIndex",
  VertexInDegree: "VertexInDegree",
  VertexOutDegree: "VertexOutDegree",
  ClosenessCentrality: "ClosenessCentrality",
  EigenvectorCentrality: "EigenvectorCentrality",
  IsPathGraph: "PathGraphQ",
  IsAcyclicGraph: "AcyclicGraphQ",
  IsCompleteGraph: "CompleteGraphQ",
  IsLoopFreeGraph: "LoopFreeGraphQ",
  IsSimpleGraph: "SimpleGraphQ",
  IsIsomorphicGraph: "IsomorphicGraphQ",
  WheelGraph: "WheelGraph",
  CirculantGraph: "CirculantGraph",
  TuranGraph: "TuranGraph",
  HararyGraph: "HararyGraph",
  LineGraph: "LineGraph",
  AdjacencyGraph: "AdjacencyGraph",
  RandomGraph: "RandomGraph",

  // Edge weights (graph-weights.ts): `EdgeWeight` is Wolfram's own option name, same call
  // shape (`Graph(edges, EdgeWeight -> {…})` is legal WL too), so no SPECIAL entry is
  // needed for Graph itself; WeightedAdjacencyMatrix is a plain rename like the rest of
  // this file's graph heads.
  WeightedAdjacencyMatrix: "WeightedAdjacencyMatrix",

  // ── notatio's graphics and control heads (`@enumeratio/formats/src/graphics.ts`) ──
  //
  // Deliberately Wolfram-named: "Wolfram's `Plot`, `Histogram`, `Manipulate` print as
  // pictures, not formulas" (see that file). We declare them inert — the expression is
  // held rather than computed, for a worksheet or REPL to draw — so this is the same
  // concept under the same name, not a numeric result a kernel oracle could cross-check.
  Plot: "Plot",
  Plot3D: "Plot3D",
  ContourPlot: "ContourPlot",
  DensityPlot: "DensityPlot",
  PolarPlot: "PolarPlot",
  VectorPlot: "VectorPlot",
  StreamPlot: "StreamPlot",
  ComplexPlot: "ComplexPlot",
  ComplexPlot3D: "ComplexPlot3D",
  ListPlot: "ListPlot",
  ListLinePlot: "ListLinePlot",
  ListPlot3D: "ListPlot3D",
  BarChart: "BarChart",
  BarChart3D: "BarChart3D",
  PieChart: "PieChart",
  BoxWhiskerChart: "BoxWhiskerChart",
  ArrayPlot: "ArrayPlot",
  DiscretePlot: "DiscretePlot",
  GraphPlot: "GraphPlot",
  TreeGraph: "TreeGraph",
  LayeredGraphPlot: "LayeredGraphPlot",
  Dendrogram: "Dendrogram",
  Manipulate: "Manipulate",
  Slider: "Slider",
  VerticalSlider: "VerticalSlider",
  Animator: "Animator",
  Slider2D: "Slider2D",
  IntervalSlider: "IntervalSlider",
  SetterBar: "SetterBar",
  RadioButtonBar: "RadioButtonBar",
  TogglerBar: "TogglerBar",
  Toggler: "Toggler",
  PopupMenu: "PopupMenu",
  ListPicker: "ListPicker",
  Checkbox: "Checkbox",
  ColorSlider: "ColorSlider",
  Locator: "Locator",
  InputField: "InputField",
  Dynamic: "Dynamic",
  DynamicModule: "DynamicModule",
  Cell: "Cell",
  Notebook: "Notebook",
  Row: "Row",
  Column: "Column",
  Grid: "Grid",
  Panel: "Panel",
  Labeled: "Labeled",
  Point: "Point",
  Line: "Line",
  Arrow: "Arrow",
  Circle: "Circle",
  Disk: "Disk",
  Rectangle: "Rectangle",

  // Wolfram-frontier expression/pattern/string heads (@enumeratio/collections's
  // expression-ops.ts): genuinely Wolfram's own names, waiting on a coverage run to fill in
  // `elsewhere` — see NOVEL in packages/reference/tests/provenance.test.ts.
  ToString: "ToString",
  MapThread: "MapThread",
  MatchQ: "MatchQ",
  MapIndexed: "MapIndexed",
  StringLength: "StringLength",
  FreeQ: "FreeQ",
  StringTake: "StringTake",
  Replace: "Replace",
  Through: "Through",
  ToCharacterCode: "ToCharacterCode",
  FromCharacterCode: "FromCharacterCode",
  Level: "Level",
  Pick: "Pick",
  ReplacePart: "ReplacePart",
  AssociationThread: "AssociationThread",

  // Wolfram-frontier misc heads (@enumeratio/collections's misc-frontier.ts): genuinely
  // Wolfram's own names, same call shape and semantics, waiting on a coverage run to fill in
  // `elsewhere` — see NOVEL in packages/reference/tests/provenance.test.ts.
  DiagonalMatrix: "DiagonalMatrix",
  HilbertMatrix: "HilbertMatrix",
  Extract: "Extract",
  DeleteCases: "DeleteCases",
  Key: "Key",
  CharacterRange: "CharacterRange",
  NumberQ: "NumberQ",
  ReIm: "ReIm",
  RandomComplex: "RandomComplex",
  KaryTree: "KaryTree",
};

/** Wolfram heads we answer under one of our own heads, but only in a particular CALL
 *  SHAPE rather than as a straight rename — so they cannot live in `HEADS`, which maps
 *  one Wolfram spelling per compute-engine head. `Total[list]` is our `Sum[list]` with
 *  no iterator (see the `Sum` case in `SPECIAL`, and its reverse in `fromWolfram`); a
 *  `Sum` WITH an iterator is Wolfram's own `Sum`, which already occupies that spelling
 *  in `HEADS`. Exported so the frontier generator can exclude these from the gap list
 *  the same way it excludes a plain rename. */
export const STRUCTURAL: Record<string, string> = {
  Total: "Sum",
  Clip: "Clamp",
};

/** The context our heads emit into when Wolfram has the name for something else.
 *
 *  Wolfram's own answer to a name clash, and the reason it has contexts at all. An
 *  `` enumeratio`Area `` is an inert symbol in a context the kernel owns nothing in, so it
 *  cannot be mistaken for `System`Area` — where falling through by NAME would be, silently
 *  and with a plausible-looking result. */
export const CONTEXT = "enumeratio`";

/**
 * Our heads whose Wolfram spelling is taken by an unrelated function, mapped to what
 * Wolfram means by the name. Renaming our side is the wrong fix — a statistic is scoped to
 * its carrier, so sharing a name is an overload — but emitting it as the Wolfram symbol is
 * a wrong answer rather than a missing one, which is worse than either.
 */
export const FOREIGN: Record<string, string> = {
  Area: "the area of a geometric region",
  Perimeter: "the perimeter of a geometric region",
  Depth: "the number of indices needed to reach any part of an expression",
  Order: "the canonical-order comparison Order[a, b]",
  Composition: "a composition of functions, Composition[f, g]",
  Word: "the token specification used by Read and Find",
  Restricted: "an Interpreter form narrowed by a condition",
  // Ours is the carrier's plural type-space symbol (design/domains.md §2 — Element(x,
  // GaussianIntegers) checks x's carrier); Wolfram's is an option flag (IsPrime[n,
  // GaussianIntegers -> True]), never a value on its own.
  GaussianIntegers: "the GaussianIntegers -> True/False option several number-theory functions take",
  // Nearly ours, which is the trap: Wolfram's is a raster image built from a pixel array or
  // a graphics object, never from a URI, so `Image["data:image/png;…"]` is not an image over
  // there — it is an Image of a string.
  Image: "a raster image built from a pixel array or a graphics object",
  // Not unrelated like the rest of this list -- same graph, same vertex-list call shape --
  // but ours ALSO accepts a bare integer (PathGraph(n), our own convenience extension) that
  // real Wolfram's PathGraph rejects outright. HEADS can't map conditionally on call shape,
  // and a plain rename would "vouch for" (isWolframHead) the call that errors, so every
  // PathGraph(...) emits into our context instead -- conservative over precise, since the
  // alternative risks handing a kernel oracle a call it doesn't accept.
  PathGraph: "a path graph over an explicit vertex list only -- unlike ours, no bare-integer form",
};

/** Heads that need a bespoke emission rather than a plain rename. */
const SPECIAL: Record<string, (args: MathJson[]) => string> = {
  // LambertW(z) / LambertW(z, k) is compute-engine's own order (branch index second, checked
  // directly: `LambertW(-0.14, -1)` is the k = -1 branch); Wolfram's `ProductLog` puts the
  // branch first: `ProductLog[z]` / `ProductLog[k, z]`.
  LambertW: (a) =>
    a.length === 1 ? `ProductLog[${toWolfram(a[0])}]` : `ProductLog[${toWolfram(a[1])}, ${toWolfram(a[0])}]`,
  // compute-engine `Log` is base-10 in the 1-arg form and value-first in the
  // 2-arg form (`Log(value, base)`); Wolfram's `Log` is natural and base-first
  // (`Log[base, value]`), so map and swap.
  Log: (a) => (a.length === 1 ? `Log[10, ${toWolfram(a[0])}]` : `Log[${toWolfram(a[1])}, ${toWolfram(a[0])}]`),
  // Root(x, n) is the n-th root; Wolfram `Root` means a polynomial root object.
  Root: (a) => `Power[${toWolfram(a[0])}, Divide[1, ${toWolfram(a[1])}]]`,
  // Wolfram has no `Square`; it is x^2.
  Square: (a) => `Power[${toWolfram(a[0])}, 2]`,
  // compute-engine `Mode` returns the value; Wolfram's `Commonest` returns a list.
  Mode: (a) => `First[Commonest[${toWolfram(a[0])}]]`,
  // Round(x, n) rounds to n decimal places; Wolfram's second argument is a step
  // to round to a multiple of, so n digits is the step 10^-n.
  Round: (a) =>
    a.length === 2
      ? `Round[${toWolfram(a[0])}, Power[10, ${typeof a[1] === "number" ? toWolfram(-a[1]) : `Minus[${toWolfram(a[1])}]`}]]`
      : call("Round", a),
  // Wolfram has no set type; `Union` of one list is the sorted, deduplicated list,
  // which is the closest thing to a canonical set — and what `Intersection` et al
  // return, so set identities still compare Equal.
  Set: (a) => `Union[${call("List", a)}]`,
  // Clamp(x, lo, hi) is Clip[x, {lo, hi}]; the 1-arg form clips to [-1, 1] in both.
  Clamp: (a) =>
    a.length === 3 ? `Clip[${toWolfram(a[0])}, List[${toWolfram(a[1])}, ${toWolfram(a[2])}]]` : call("Clip", a),
  // Wolfram's Sum/Product only take an iterator; the 1-arg list form is Total /
  // Times-apply. With an iterator the names agree and `Tuple` becomes `{k, a, b}`.
  Sum: (a) => (a.length === 1 ? `Total[${toWolfram(a[0])}]` : call("Sum", a)),
  Product: (a) => (a.length === 1 ? `Apply[Times, ${toWolfram(a[0])}]` : call("Product", a)),
  // A definite integral's `Limits(x, a, b)` is Wolfram's iterator `{x, a, b}`.
  Integrate: (a) =>
    call(
      "Integrate",
      a.map((it) => (Array.isArray(it) && it[0] === "Limits" ? ["List", ...it.slice(1)] : it)),
    ),
  // Wolfram's interval is closed and takes its bounds as a list: `Interval[{a, b}]`.
  Interval: (a) =>
    a.length === 2 && !a.some((b) => Array.isArray(b) && b[0] === "Open")
      ? `Interval[${call("List", a)}]`
      : call("Interval", a),
  // IndexOf returns 0 when absent; FirstPosition returns Missing unless given a default.
  IndexOf: (a) => `First[FirstPosition[${toWolfram(a[0])}, ${toWolfram(a[1])}, List[0]]]`,
  // Degrees(x) is the angle x° — Wolfram multiplies by the `Degree` constant.
  Degrees: (a) => `Times[${toWolfram(a[0])}, Degree]`,
  // Divides(a, b) is "a divides b"; Divisible(n, m) is "n is divisible by m" — the
  // same relation with divisor and multiple swapped.
  Divides: (a) => `Divisible[${toWolfram(a[1])}, ${toWolfram(a[0])}]`,
  // Tabulate(f, n) is Array[f, n]; Tabulate(f, n1, n2, ...) needs the dims collected into
  // a list for Wolfram's multi-dimensional Array[f, {n1, n2, ...}].
  Tabulate: (a) =>
    a.length >= 3
      ? `Array[${toWolfram(a[0])}, List[${a
          .slice(1)
          .map((d) => toWolfram(d))
          .join(", ")}]]`
      : call("Array", a),
  // Scan(xs, f) is same-length as xs, matching Wolfram's no-seed FoldList[f, list] with
  // the args reordered. Scan(xs, f, init) is ALSO same-length while FoldList[f, x, list]
  // is length+1, so only the 2-arg form maps; the seeded form goes out in our context,
  // since Wolfram's Scan is an unrelated side-effecting map.
  Scan: (a) => (a.length === 2 ? `FoldList[${toWolfram(a[1])}, ${toWolfram(a[0])}]` : call(`${CONTEXT}Scan`, a)),
  // PositionalNumerals(b) is ordinary base b wrapped as a system value (see
  // packages/symbols/arithmetic/numerals) — the same digits Wolfram's own bare integer base already gives in
  // IntegerDigits[n, b]/FromDigits[digits, b], so it unwraps to the plain number rather than
  // a head call. One-way: a bare Wolfram base comes back bare, not rewrapped as this.
  PositionalNumerals: (a) => toWolfram(a[0]),
  // Arccot(x) has range (0, π) on compute-engine's side; Wolfram's ArcCot has range
  // (-π/2, π/2], which disagrees at negative x (Arccot(-1) = 3π/4, ArcCot[-1] = -π/4). The
  // two agree everywhere via this identity, so emit the equivalent that matches our range
  // rather than the (sometimes wrong) rename. One-way: Wolfram's ArcCot does not reverse to
  // this — see REVERSE_HEADS, built from HEADS, which no longer lists Arccot at all.
  Arccot: (a) => `Subtract[Divide[Pi, 2], ArcTan[${toWolfram(a[0])}]]`,
  // Hypergeometric3F2Regularized(a1,a2,a3,b1,b2,z) has no dedicated Wolfram head — it is the
  // 3,2 case of the generic HypergeometricPFQRegularized[{a1,a2,a3},{b1,b2},z], which takes
  // its upper and lower parameters as lists rather than flat arguments.
  // BigO(x^n) is Wolfram's `O[x]^n` — the exponent sits OUTSIDE `O[...]` there, not
  // inside it, so this is a restructuring, not a rename. `BigO(x)` alone (n = 1) is the
  // bare `O[x]`, since `Power[O[x], 1]` is how Wolfram would print it anyway.
  BigO: (a) => {
    const arg = a[0];
    if (Array.isArray(arg) && arg[0] === "Power") {
      return `Power[O[${toWolfram(arg[1])}], ${toWolfram(arg[2])}]`;
    }
    return `O[${toWolfram(arg)}]`;
  },
  Hypergeometric3F2Regularized: (a) =>
    `HypergeometricPFQRegularized[List[${a
      .slice(0, 3)
      .map((x) => toWolfram(x))
      .join(", ")}], List[${a
      .slice(3, 5)
      .map((x) => toWolfram(x))
      .join(", ")}], ${toWolfram(a[5])}]`,
  // compute-engine's `Function` is `[body, ...params]`, canonicalized with `body` wrapped in
  // its own scoping `Block` (see function-utils.d.ts) — CE-internal, not something Wolfram's
  // own `Function` ever shows, so it's unwrapped here. Wolfram's shape is `Function[{params},
  // body]` (or bare `Function[body]` for the anonymous-parameter case, 0 params). Needed for
  // any multi-parameter Function literal, holonomic reductions included.
  // A single parameter is Wolfram's own bare form (its FullForm agrees: `Function[x, x^2]`,
  // not `Function[{x}, x^2]` — both parse, but the bare form is canonical there); 2+ needs the
  // list.
  Function: (a) => {
    const [rawBody, ...params] = a;
    const body = Array.isArray(rawBody) && rawBody[0] === "Block" ? rawBody[1] : rawBody;
    if (params.length === 0) return `Function[${toWolfram(body)}]`;
    if (params.length === 1) return `Function[${toWolfram(params[0])}, ${toWolfram(body)}]`;
    return `Function[List[${params.map((p) => toWolfram(p)).join(", ")}], ${toWolfram(body)}]`;
  },
  // compute-engine boxes a call whose head is itself a compound expression (rather than a
  // bare symbol) as `Apply(head, arg)` — see difference-root.ts / differential-root.ts, whose
  // `DifferenceRoot(fn)(n)` / `DifferentialRoot(fn)(x)` take exactly this shape, and whose ODE
  // equations write `y'(x)` as `Apply(Derivative(y, 1), x)`. Wolfram spells all of these the
  // way it spells any curried call: `head[arg]`, not `Apply[head, arg]` (genuine `Apply` —
  // replacing a list's head — is a different operation there). Only these heads are curried
  // this way today, so this is narrowly scoped to them; every other `Apply` call still means
  // Wolfram's own `Apply`.
  Apply: (a) => {
    const [head, ...rest] = a;
    const curried = ["DifferenceRoot", "DifferentialRoot", "Derivative"];
    if (Array.isArray(head) && curried.includes(head[0] as string)) {
      return `${toWolfram(head)}[${rest.map((r) => toWolfram(r)).join(", ")}]`;
    }
    return call("Apply", a);
  },
  // `Derivative(y, k)`: compute-engine's order is (function, order); Wolfram's `Derivative[k]`
  // is the order-k derivative OPERATOR, applied to the function as its own curried call:
  // `Derivative[k][y]`. Bare — the `Apply` case above adds the further `[x]` when this is
  // itself applied to a point, as difference-root.ts / differential-root.ts always do.
  Derivative: (a) => `Derivative[${toWolfram(a[1])}][${toWolfram(a[0])}]`,
};

/** Whether the transpiler vouches for a head — as opposed to passing it through by name. */
export const isWolframHead = (head: string): boolean => head in HEADS || head in SPECIAL;

const call = (head: string, args: MathJson[]): string => `${head}[${args.map((a) => toWolfram(a)).join(", ")}]`;

/** Serialise a MathJSON value to a Wolfram Language expression string. */
export function toWolfram(node: MathJson): string {
  if (typeof node === "number") return numberToWolfram(node);
  if (typeof node === "boolean") return node ? "True" : "False";
  if (typeof node === "string") return symbolToWolfram(node);

  if (Array.isArray(node)) return applyHead(node[0], node.slice(1));

  if (typeof node === "object") {
    if ("num" in node) return numberToWolfram(node.num);
    if ("str" in node) return JSON.stringify(node.str);
    if ("sym" in node) return symbolToWolfram(node.sym);
    if ("fn" in node) return applyHead(node.fn[0], node.fn.slice(1));
  }
  return "Null";
}

function applyHead(head: MathJson, args: MathJson[]): string {
  if (typeof head !== "string") return call(toWolfram(head), args);
  const special = SPECIAL[head];
  if (special) return special(args);
  if (head in FOREIGN) return call(`${CONTEXT}${head}`, args);
  return call(HEADS[head] ?? head, args);
}

/** A bare MathJSON string is a symbol, a `'quoted'` one a string literal, and
 * `_n` the n-th anonymous-function parameter, which Wolfram spells `Slot[n]` (bare
 * `_` is compute-engine's shorthand for `_1`). An
 * underscore is a pattern in Wolfram, never part of a name, so a subscripted
 * symbol like `e_1` becomes `Subscript[e, 1]`. */
function symbolToWolfram(s: string): string {
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return JSON.stringify(s.slice(1, -1));
  const slot = /^_(\d*)$/.exec(s);
  if (slot) return `Slot[${slot[1] || 1}]`;
  const subscript = /^([A-Za-z][A-Za-z0-9]*)_([A-Za-z0-9]+)$/.exec(s);
  if (subscript) return `Subscript[${subscript[1]}, ${subscript[2]}]`;
  // A head passed as a value (`Scan(xs, Add)`) takes its Wolfram name too. FOREIGN is
  // deliberately NOT consulted here: `GaussianIntegers` bare is genuinely ambiguous between
  // our own carrier's type-space symbol and Wolfram's real option flag (`PrimeQ[n,
  // GaussianIntegers -> True]` has to keep the UNPREFIXED name, since that IS the real
  // option) -- `applyHead` below still contextualises a CALL to one of our own heads, which
  // is the case that actually needs it.
  return SYMBOLS[s] ?? HEADS[s] ?? s;
}

function numberToWolfram(n: number | string): string {
  const s = String(n).replace(/^\+/, "");
  if (s === "Infinity") return "Infinity";
  if (s === "-Infinity") return "-Infinity";
  if (s === "NaN") return "Indeterminate";
  // Wolfram's exponent marker is `*^`; `1.5e3` would parse as `1.5 * e3`.
  return s.replace(/[eE]\+?/, "*^");
}
