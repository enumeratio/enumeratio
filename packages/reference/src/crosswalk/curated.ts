// The hand-kept half of the crosswalk: where a head lives in the encyclopaedias and the
// handbooks, which nothing derives for us. Keyed by head; a row with an `arity` is about
// one signature (Zeta at one argument is Riemann's, at two Hurwitz's).
//
// Every identity here is one the check script can resolve (`scripts/check-crosswalk.ts`
// fetches each URL), so a rename over there shows up as a dead link here rather than
// silently. Add rows freely; the order within a head is the order they are shown.

import type { Reference } from "./types.ts";

/**
 * Fungrim symbols spelled differently from our heads. A head whose name Fungrim uses as-is
 * needs no row -- `fungrim-symbols-data.ts` says which those are. A head Fungrim has no
 * page for gets nothing, however many of its entries mention it.
 */
export const FUNGRIM_NAMES: Readonly<Record<string, string>> = {
  Zeta: "RiemannZeta",
  Ln: "Log",
  Digamma: "DigammaFunction",
  GammaLn: "LogGamma",
  Beta: "BetaFunction",
  Factorial2: "DoubleFactorial",
  Pochhammer: "RisingFactorial",
  Arcsin: "Asin",
  Arccos: "Acos",
  Arctan: "Atan",
  Arctan2: "Atan2",
  Arccot: "Acot",
  Arsinh: "Asinh",
  Arcosh: "Acosh",
  Artanh: "Atanh",
  Real: "Re",
  Imaginary: "Im",
  Argument: "Arg",
  Power: "Pow",
  ExponentialE: "ConstE",
  ImaginaryUnit: "ConstI",
  EulerGamma: "ConstGamma",
  CatalanConstant: "ConstCatalan",
  NPartition: "PartitionsP",
};

/**
 * Heads whose catalog subject is spelled differently: the catalog's `Permutations` family is
 * what our `SymmetricGroup` enumerates, and its `Stirling1` function is our `StirlingS1`.
 * The catalog's rows for the alias are shown on the head, marked as recorded against it.
 */
export const CATALOG_ALIASES: Readonly<Record<string, string>> = {
  SymmetricGroup: "Permutations",
  StirlingS1: "Stirling1",
  Stirling: "StirlingSecond",
  NPartition: "PartitionNumber",
};

/**
 * The DLMF's own wording for heads whose Wikipedia title it does not share; a head whose
 * title the handbook uses verbatim ("gamma function", "Riemann zeta function") needs no row.
 * Names are matched loosely -- case, plurals and hyphens do not matter.
 */
export const DLMF_NAMES: Readonly<Record<string, string>> = {
  Digamma: "psi (or digamma) function",
  PolyGamma: "polygamma functions",
  Trigamma: "polygamma functions",
  LerchPhi: "Lerch's transcendent",
  Totient: "Euler's totient",
  PrimePi: "number of primes not exceeding a number",
  PrimeNu: "number of distinct primes dividing a number",
  DivisorSigma: "sum of powers of divisors of a number",
  Erfc: "complementary error function",
  ErfInv: "inverse error function",
  BarnesG: "Barnes' G-function (or double gamma function)",
  Exp: "exponential function",
  Ln: "principal branch of logarithm function",
  Sin: "sine function",
  Cos: "cosine function",
  Tan: "tangent function",
  Cot: "cotangent function",
  Sec: "secant function",
  Csc: "cosecant function",
  Arcsin: "arcsine function",
  Arccos: "arccosine function",
  Arctan: "arctangent function",
  Sinh: "hyperbolic sine function",
  Cosh: "hyperbolic cosine function",
  Tanh: "hyperbolic tangent function",
  Coth: "hyperbolic cotangent function",
  Arsinh: "inverse hyperbolic sine function",
  Arcosh: "inverse hyperbolic cosine function",
  Artanh: "inverse hyperbolic tangent function",
  Fibonacci: "Fibonacci number",
  StirlingS1: "Stirling number of the first kind",
  Stirling: "Stirling number of the second kind",
  EulerGamma: "Euler's constant",
  ExponentialE: "base of natural logarithm",
  DedekindEta: "Dedekind's eta function (or Dedekind modular function)",
  EllipticK: "Legendre's complete elliptic integral of the first kind",
  EllipticE: "Legendre's complete elliptic integral of the second kind",
  EllipticPi: "Legendre's complete elliptic integral of the third kind",
  BesselJ: "Bessel function of the first kind",
  BesselY: "Bessel function of the second kind",
  BesselI: "modified Bessel function of the first kind",
  BesselK: "modified Bessel function of the second kind",
  Sign: "sign of",
  AGM: "arithmetic-geometric mean",
};

/**
 * Wikidata ids the engine gets wrong, which is a great many of them: `scripts/audit-wikidata.ts`
 * fetches every id compute-engine 0.128 declares and finds 3 that do not resolve and 38 that
 * resolve to something else entirely -- `PlanckConstant` to Mount Vesuvius, `AiryAi` to an
 * Egyptian prime minister, `EllipticK` to a Donna Summer album. The ids look plausible and
 * are never checked by anything upstream, which is exactly why they are checked here. The
 * engine's id is REPLACED, not supplemented: a confidently wrong link is worse than none.
 *
 * Each of these was looked up by name and confirmed against the item's own label; rerun the
 * audit after an engine bump to see what has been fixed there and what is new.
 */
export const WIKIDATA_FIXES: Readonly<Record<string, string>> = {
  // ── dead ids ───────────────────────────────────────────────────────────────
  PolyGamma: "Q857956",
  StefanBoltzmannConstant: "Q51374",
  Pochhammer: "Q2339261",
  PolyLog: "Q1238449",
  SetMinus: "Q845126",
  Trigamma: "Q1244426",
  BesselI: "Q2607225",
  BesselJ: "Q219637",
  BesselK: "Q109559130",
  BesselY: "Q109545924",
  EllipticF: "Q109752309",
  EllipticPi: "Q109753363",
  ExpIntegralEi: "Q1419948",
  LogIntegral: "Q1350206",

  // ── ids about something else entirely ──────────────────────────────────────
  AiryAi: "Q109729241",
  AiryBi: "Q109729257",
  AiryAiPrime: "Q409415",
  AiryBiPrime: "Q409415",
  AppellF1: "Q4780998",
  AvogadroConstant: "Q6203",
  Beta: "Q468881",
  BoltzmannConstant: "Q5962",
  Combinations: "Q202805",
  DedekindEta: "Q1182161",
  Digamma: "Q905326",
  EllipticE: "Q109753012",
  EllipticK: "Q109752514",
  GasConstant: "Q182333",
  GravitationalConstant: "Q18373",
  Hypergeometric1F1: "Q783948",
  Hypergeometric2F1: "Q21028472",
  JacobiTheta: "Q17098064",
  LambertW: "Q429331",
  Nand: "Q3874243",
  Nor: "Q574946",
  PlanckConstant: "Q122894",
  PlusMinus: "Q260387",
  VacuumPermittivity: "Q6158",
};

/**
 * Ids the audit cannot recognise but which are right: the item is named for the concept
 * rather than the head (`Divide` is "division", `Nand` is the Sheffer stroke). Listed so the
 * audit's output stays a work queue rather than a list to re-check by hand every time.
 */
export const WIKIDATA_CONFIRMED: ReadonlySet<string> = new Set([
  "Arctan2",
  "Divide",
  "Multiply",
  "Mu0",
  "Nand",
  "Negate",
]);

const wp = (identity: string, extra: Partial<Reference> = {}): Reference => ({
  system: "wikipedia",
  identity,
  ...extra,
});
const mw = (identity: string, extra: Partial<Reference> = {}): Reference => ({
  system: "mathworld",
  identity,
  ...extra,
});
const dlmf = (identity: string, extra: Partial<Reference> = {}): Reference => ({
  system: "dlmf",
  identity,
  ...extra,
});
const oeis = (identity: string, extra: Partial<Reference> = {}): Reference => ({
  system: "oeis",
  identity,
  ...extra,
});
const rc = (identity: string, extra: Partial<Reference> = {}): Reference => ({
  system: "rosettacode",
  identity,
  ...extra,
});

export const CURATED: Readonly<Record<string, readonly Reference[]>> = {
  // ── combinatorics ──────────────────────────────────────────────────────────
  Binomial: [wp("Binomial coefficient"), mw("BinomialCoefficient"), dlmf("26.3")],
  Multinomial: [wp("Multinomial theorem"), mw("MultinomialCoefficient")],
  Factorial: [wp("Factorial"), mw("Factorial"), dlmf("5.2"), rc("Factorial")],
  Factorial2: [wp("Double factorial"), mw("DoubleFactorial")],
  CatalanNumber: [wp("Catalan number"), mw("CatalanNumber"), oeis("A000108")],
  Pochhammer: [wp("Falling and rising factorials"), mw("PochhammerSymbol"), dlmf("5.2")],
  Subfactorial: [wp("Derangement"), mw("Subfactorial"), oeis("A000166")],
  StirlingS1: [
    wp("Stirling numbers of the first kind"),
    mw("StirlingNumberoftheFirstKind"),
    dlmf("26.8"),
    oeis("A008275"),
  ],
  Stirling: [
    wp("Stirling numbers of the second kind"),
    mw("StirlingNumberoftheSecondKind"),
    dlmf("26.8"),
    oeis("A008277"),
  ],
  BellNumber: [wp("Bell number"), mw("BellNumber"), oeis("A000110")],
  NPartition: [wp("Integer partition"), mw("PartitionFunctionP"), dlmf("26.9"), oeis("A000041")],
  Permutations: [wp("Permutation"), mw("Permutation"), rc("Permutations")],
  Combinations: [wp("Combination"), mw("Combination"), rc("Combinations")],
  PowerSet: [wp("Power set"), mw("PowerSet"), rc("Power set")],

  // ── sequences ──────────────────────────────────────────────────────────────
  Fibonacci: [
    wp("Fibonacci sequence"),
    mw("FibonacciNumber"),
    oeis("A000045"),
    rc("Fibonacci sequence"),
  ],
  LucasL: [wp("Lucas number"), mw("LucasNumber"), oeis("A000032")],
  BernoulliB: [wp("Bernoulli number"), mw("BernoulliNumber"), dlmf("24.2"), oeis("A027641")],

  // ── number theory ──────────────────────────────────────────────────────────
  GCD: [wp("Greatest common divisor"), mw("GreatestCommonDivisor"), rc("Greatest common divisor")],
  LCM: [wp("Least common multiple"), mw("LeastCommonMultiple"), rc("Least common multiple")],
  Mod: [wp("Modulo"), mw("Mod")],
  PowerMod: [wp("Modular exponentiation"), rc("Modular exponentiation")],
  Totient: [wp("Euler's totient function"), mw("TotientFunction"), dlmf("27.2"), oeis("A000010")],
  NextPrime: [wp("Prime number"), mw("NextPrime")],
  NthPrime: [wp("Prime number"), oeis("A000040")],
  PrimePi: [
    wp("Prime-counting function"),
    mw("PrimeCountingFunction"),
    dlmf("27.12"),
    oeis("A000720"),
  ],
  IsPrime: [wp("Primality test"), mw("PrimalityTest"), rc("Primality by trial division")],
  FactorInteger: [wp("Integer factorization"), mw("PrimeFactorization"), rc("Prime decomposition")],
  PrimeNu: [wp("Prime omega function"), mw("DistinctPrimeFactors"), oeis("A001221")],
  PrimeOmega: [wp("Prime omega function"), mw("PrimeFactor"), oeis("A001222")],
  Divisors: [wp("Divisor"), mw("Divisor"), rc("Proper divisors")],
  DivisorSigma: [wp("Divisor function"), mw("DivisorFunction"), dlmf("27.2")],
  MoebiusMu: [wp("Möbius function"), mw("MoebiusFunction"), dlmf("27.2"), oeis("A008683")],
  IsSquareFree: [wp("Square-free integer"), mw("Squarefree"), oeis("A005117")],
  JacobiSymbol: [wp("Jacobi symbol"), mw("JacobiSymbol"), rc("Jacobi symbol")],
  LegendreSymbol: [wp("Legendre symbol"), mw("LegendreSymbol")],
  ChineseRemainder: [
    wp("Chinese remainder theorem"),
    mw("ChineseRemainderTheorem"),
    rc("Chinese remainder theorem"),
  ],
  ExtendedGCD: [wp("Extended Euclidean algorithm"), rc("Modular inverse")],
  MultiplicativeOrder: [wp("Multiplicative order"), mw("MultiplicativeOrder")],
  IntegerDigits: [wp("Numerical digit"), rc("Sum digits of an integer")],
  DigitSum: [wp("Digit sum"), mw("DigitSum"), rc("Sum digits of an integer")],
  ContinuedFraction: [wp("Continued fraction"), mw("ContinuedFraction"), rc("Continued fraction")],

  // ── arithmetic ─────────────────────────────────────────────────────────────
  Abs: [wp("Absolute value"), mw("AbsoluteValue")],
  Sign: [wp("Sign function"), mw("Sign")],
  Sqrt: [wp("Square root"), mw("SquareRoot")],
  Floor: [wp("Floor and ceiling functions"), mw("FloorFunction")],
  Ceil: [wp("Floor and ceiling functions"), mw("CeilingFunction")],
  Round: [wp("Rounding"), mw("NearestIntegerFunction")],

  // ── elementary functions ───────────────────────────────────────────────────
  Exp: [wp("Exponential function"), mw("ExponentialFunction"), dlmf("4.2")],
  Ln: [wp("Natural logarithm"), mw("NaturalLogarithm"), dlmf("4.2")],
  Log: [wp("Logarithm"), mw("Logarithm")],
  Sin: [wp("Sine and cosine"), mw("Sine"), dlmf("4.14")],
  Cos: [wp("Sine and cosine"), mw("Cosine"), dlmf("4.14")],
  Tan: [wp("Trigonometric functions"), mw("Tangent"), dlmf("4.14")],
  Arcsin: [wp("Inverse trigonometric functions"), mw("InverseSine"), dlmf("4.23")],
  Arccos: [wp("Inverse trigonometric functions"), mw("InverseCosine"), dlmf("4.23")],
  Arctan: [wp("Inverse trigonometric functions"), mw("InverseTangent"), dlmf("4.23")],
  Sinh: [wp("Hyperbolic functions"), mw("HyperbolicSine"), dlmf("4.28")],
  Cosh: [wp("Hyperbolic functions"), mw("HyperbolicCosine"), dlmf("4.28")],
  Tanh: [wp("Hyperbolic functions"), mw("HyperbolicTangent"), dlmf("4.28")],

  // ── special functions ──────────────────────────────────────────────────────
  Gamma: [wp("Gamma function"), mw("GammaFunction"), dlmf("5")],
  GammaLn: [wp("Gamma function"), mw("LogGammaFunction"), dlmf("5.2")],
  LogGamma: [wp("Gamma function"), mw("LogGammaFunction"), dlmf("5.2")],
  Digamma: [wp("Digamma function"), mw("DigammaFunction"), dlmf("5.2")],
  PolyGamma: [wp("Polygamma function"), mw("PolygammaFunction"), dlmf("5.15")],
  Trigamma: [wp("Trigamma function"), mw("TrigammaFunction"), dlmf("5.15")],
  Beta: [wp("Beta function"), mw("BetaFunction"), dlmf("5.12")],
  Erf: [wp("Error function"), mw("Erf"), dlmf("7.2")],
  Erfc: [wp("Error function"), mw("Erfc"), dlmf("7.2")],
  ErfInv: [wp("Error function"), mw("InverseErf")],
  Zeta: [
    wp("Riemann zeta function", { arity: 1 }),
    mw("RiemannZetaFunction", { arity: 1 }),
    dlmf("25.2", { arity: 1 }),
    wp("Hurwitz zeta function", { arity: 2 }),
    mw("HurwitzZetaFunction", { arity: 2 }),
    dlmf("25.11", { arity: 2 }),
    { system: "fungrim", identity: "HurwitzZeta", arity: 2 },
  ],
  HurwitzZeta: [wp("Hurwitz zeta function"), mw("HurwitzZetaFunction"), dlmf("25.11")],
  LerchPhi: [wp("Lerch transcendent"), mw("LerchTranscendent"), dlmf("25.14")],
  PolyLog: [wp("Polylogarithm"), mw("Polylogarithm"), dlmf("25.12")],
  BarnesG: [wp("Barnes G-function"), mw("BarnesG-Function"), dlmf("5.17")],
  LogBarnesG: [wp("Barnes G-function"), mw("BarnesG-Function"), dlmf("5.17")],
  ClausenCl: [wp("Clausen function"), mw("ClausenFunction")],
  DirichletEta: [wp("Dirichlet eta function"), mw("DirichletEtaFunction"), dlmf("25.2")],
  DirichletBeta: [wp("Dirichlet beta function"), mw("DirichletBetaFunction")],
  StieltjesGamma: [wp("Stieltjes constants"), mw("StieltjesConstants"), dlmf("25.2")],
  DirichletCharacter: [wp("Dirichlet character"), mw("DirichletCharacter"), dlmf("27.8")],
  DirichletL: [wp("Dirichlet L-function"), mw("DirichletL-Series"), dlmf("25.15")],
  LambertW: [wp("Lambert W function"), mw("LambertW-Function"), dlmf("4.13")],
  EisensteinE: [wp("Eisenstein series"), mw("EisensteinSeries")],
  DedekindEta: [wp("Dedekind eta function"), mw("DedekindEtaFunction"), dlmf("23.15")],
  JacobiTheta: [wp("Theta function"), mw("JacobiThetaFunctions"), dlmf("20")],
  EllipticK: [wp("Elliptic integral"), mw("CompleteEllipticIntegraloftheFirstKind"), dlmf("19.2")],
  EllipticE: [wp("Elliptic integral"), mw("CompleteEllipticIntegraloftheSecondKind"), dlmf("19.2")],
  BesselJ: [wp("Bessel function"), mw("BesselFunctionoftheFirstKind"), dlmf("10.2")],
  BesselY: [wp("Bessel function"), mw("BesselFunctionoftheSecondKind"), dlmf("10.2")],
  AiryAi: [wp("Airy function"), mw("AiryFunctions"), dlmf("9.2")],
  AiryBi: [wp("Airy function"), mw("AiryFunctions"), dlmf("9.2")],
  Hypergeometric2F1: [wp("Hypergeometric function"), mw("HypergeometricFunction"), dlmf("15.2")],
  AGM: [wp("Arithmetic–geometric mean"), mw("Arithmetic-GeometricMean"), dlmf("19.8")],

  // ── constants ──────────────────────────────────────────────────────────────
  Pi: [wp("Pi"), mw("Pi"), oeis("A000796")],
  ExponentialE: [wp("E (mathematical constant)"), mw("e"), oeis("A001113")],
  EulerGamma: [wp("Euler's constant"), mw("Euler-MascheroniConstant"), oeis("A001620")],
  GoldenRatio: [wp("Golden ratio"), mw("GoldenRatio"), oeis("A001622")],
  CatalanConstant: [wp("Catalan's constant"), mw("CatalansConstant"), oeis("A006752")],
  ImaginaryUnit: [wp("Imaginary unit"), mw("i")],

  // ── collections and carriers ───────────────────────────────────────────────
  Subsets: [wp("Power set"), mw("Subset"), rc("Power set")],
  KSubsets: [wp("Combination"), mw("k-Subset"), rc("Combinations")],
  Multisets: [wp("Multiset"), mw("Multiset")],
  Tuples: [wp("Tuple"), mw("n-Tuple")],
  SymmetricGroup: [wp("Symmetric group"), mw("SymmetricGroup")],
  Derangements: [wp("Derangement"), mw("Derangement"), oeis("A000166")],
  Involutions: [wp("Involution (mathematics)"), mw("PermutationInvolution"), oeis("A000085")],
  IntegerPartitions: [wp("Integer partition"), mw("Partition"), oeis("A000041")],
  IntegerCompositions: [wp("Composition (combinatorics)"), mw("Composition"), oeis("A011782")],
  SetPartitions: [wp("Partition of a set"), mw("SetPartition"), oeis("A000110")],
  DyckPaths: [wp("Dyck language"), mw("DyckPath"), oeis("A000108")],
  BinaryTrees: [wp("Binary tree"), mw("BinaryTree"), oeis("A000108")],
  Permutation: [wp("Permutation"), mw("Permutation")],
  IntegerPartition: [wp("Integer partition"), mw("Partition")],
  Composition: [wp("Composition (combinatorics)"), mw("Composition")],
  SetPartition: [wp("Partition of a set"), mw("SetPartition")],
  SetComposition: [wp("Weak ordering")],
  DyckPath: [wp("Dyck language"), mw("DyckPath")],
  StandardTableau: [wp("Young tableau"), mw("YoungTableau")],
  SemistandardTableau: [wp("Young tableau"), mw("YoungTableau")],
  Quaternions: [wp("Quaternion"), mw("Quaternion")],

  // ── statistics ─────────────────────────────────────────────────────────────
  Inversions: [wp("Inversion (discrete mathematics)"), mw("PermutationInversion")],
  Descents: [wp("Permutation#Ascents, descents, runs, exceedances")],
  Ascents: [wp("Permutation#Ascents, descents, runs, exceedances"), mw("PermutationAscent")],
  Excedances: [wp("Permutation#Ascents, descents, runs, exceedances")],
  FixedPoints: [wp("Fixed point (mathematics)"), mw("FixedPoint")],
  Cycles: [wp("Cyclic permutation"), mw("PermutationCycle")],
  Runs: [wp("Permutation#Ascents, descents, runs, exceedances"), mw("PermutationRun")],
  LongestIncreasingSubsequence: [
    wp("Longest increasing subsequence"),
    rc("Longest increasing subsequence"),
  ],
  LongestDecreasingSubsequence: [wp("Longest increasing subsequence")],
  DurfeeSquare: [wp("Durfee square"), mw("DurfeeSquare")],
  Crank: [wp("Crank of a partition")],
  DysonRank: [wp("Rank of a partition")],
  HookProduct: [wp("Hook length formula"), mw("HookLengthFormula")],
  SumOfHookLengths: [wp("Hook length formula"), mw("HookLengthFormula")],
  DistinctParts: [wp("Integer partition"), oeis("A000009")],
  StackSortable: [wp("Stack-sortable permutation"), oeis("A000108")],

  // ── maps ───────────────────────────────────────────────────────────────────
  Rsk: [wp("Robinson–Schensted correspondence")],
  RskInsertion: [wp("Robinson–Schensted correspondence")],
  RskRecording: [wp("Robinson–Schensted correspondence")],
  RskShape: [wp("Robinson–Schensted correspondence")],
  ToLehmerCode: [wp("Lehmer code"), rc("Permutations/Rank of a permutation")],
  BinarySearchTree: [wp("Binary search tree")],
  CycleType: [wp("Cyclic permutation"), mw("PermutationCycle")],
  Inverse: [wp("Permutation#Composition of permutations")],
  KrewerasComplement: [wp("Noncrossing partition")],

  // ── algebra ────────────────────────────────────────────────────────────────
  Root: [wp("Nth root"), mw("nthRoot")],
  Clamp: [wp("Clamp (function)")],
  Mode: [wp("Mode (statistics)"), mw("Mode")],
  Norm: [wp("Norm (mathematics)"), mw("Norm")],
  Basis: [wp("Basis (linear algebra)"), mw("VectorBasis")],
  AlgebraSignature: [wp("Metric signature")],
  AlgebraDimension: [wp("Dimension (vector space)")],
  MotzkinAlgebra: [wp("Motzkin number"), mw("MotzkinNumber"), oeis("A001006")],
  OrbitDiagram: [wp("Group action#Orbits and stabilizers")],
  HeckeT: [wp("Iwahori–Hecke algebra")],
  HeckeSpecialize: [wp("Iwahori–Hecke algebra")],
  PosetElements: [wp("Partially ordered set"), mw("PartiallyOrderedSet")],
  QuiverPath: [wp("Quiver (mathematics)")],
  QuiverCompose: [wp("Quiver (mathematics)")],
  QuiverIsAcyclic: [wp("Directed acyclic graph"), mw("AcyclicDigraph")],
  QSymM: [wp("Quasisymmetric function")],
  NSymR: [wp("Quasisymmetric function#Related algebras")],
  GroupBasis: [wp("Group ring"), mw("GroupRing")],
  ClassSum: [wp("Conjugacy class#Conjugacy class sum"), mw("ConjugacyClass")],
  ModularWord: [wp("Modular group"), mw("ModularGroupGamma")],
  ModularClasses: [wp("Modular group"), mw("ModularGroupGamma")],
  RademacherSymbol: [wp("Dedekind sum"), mw("DedekindSum")],
  FormClassNumber: [wp("Class number (number theory)"), mw("ClassNumber")],
  LorenzBraid: [wp("Lorenz system"), mw("LorenzAttractor")],
  Braid: [wp("Braid group"), mw("BraidGroup")],
  AlexanderPolynomial: [wp("Alexander polynomial"), mw("AlexanderPolynomial")],
  JonesPolynomial: [wp("Jones polynomial"), mw("JonesPolynomial")],
  TemperleyLiebAlgebra: [wp("Temperley–Lieb algebra")],
  BrauerAlgebra: [wp("Brauer algebra")],
  PartitionAlgebra: [wp("Partition algebra")],
  Coproduct: [wp("Hopf algebra"), mw("HopfAlgebra")],
  Antipode: [wp("Hopf algebra"), mw("HopfAlgebra")],
  MoebiusFunction: [wp("Incidence algebra"), mw("MoebiusFunction")],
  MoebiusInvert: [wp("Möbius inversion formula"), mw("MoebiusInversionFormula")],
  ConjugacyClasses: [wp("Conjugacy class"), mw("ConjugacyClass")],
};
