import { expect, test } from "vite-plus/test";
import { isWolframHead, toWolfram } from "../src/to-wolfram.ts";

test("atoms and symbols", () => {
  expect(toWolfram(42)).toBe("42");
  expect(toWolfram({ num: "-3.5" })).toBe("-3.5");
  expect(toWolfram("x")).toBe("x");
  expect(toWolfram("Pi")).toBe("Pi");
  expect(toWolfram("ExponentialE")).toBe("E");
  expect(toWolfram("ImaginaryUnit")).toBe("I");
});

test("numbers use Wolfram's *^ exponent, never e (which is a symbol there)", () => {
  expect(toWolfram(1.5e3)).toBe("1500");
  expect(toWolfram(1e-11)).toBe("1*^-11");
  expect(toWolfram(1e21)).toBe("1*^21");
  expect(toWolfram({ num: "1.17520119364380145688" })).toBe("1.17520119364380145688");
  expect(toWolfram({ num: "+Infinity" })).toBe("Infinity");
  expect(toWolfram({ num: "NaN" })).toBe("Indeterminate");
  expect(toWolfram(Number.NEGATIVE_INFINITY)).toBe("-Infinity");
});

test("our NaN and Indeterminate both print as Wolfram's one Indeterminate", () => {
  expect(toWolfram("NaN")).toBe("Indeterminate");
  expect(toWolfram("Indeterminate")).toBe("Indeterminate");
});

test("string literals: the 'quoted' shorthand and the {str} form both become strings", () => {
  expect(toWolfram("'LRLR'")).toBe('"LRLR"');
  expect(toWolfram({ str: "LRLR" })).toBe('"LRLR"');
  expect(toWolfram(["ModularTrace", "'LRLR'"])).toBe('ModularTrace["LRLR"]');
});

test("uniform Head[args] with a name map", () => {
  expect(toWolfram(["Binomial", 10, 3])).toBe("Binomial[10, 3]");
  expect(toWolfram(["Add", "x", 1])).toBe("Plus[x, 1]");
  expect(toWolfram(["Multiply", 2, "x"])).toBe("Times[2, x]");
  expect(toWolfram(["Power", "x", 2])).toBe("Power[x, 2]");
  expect(toWolfram(["List", 1, 2, 3])).toBe("List[1, 2, 3]");
});

test("compute-engine names that differ from Wolfram", () => {
  expect(toWolfram(["Stirling", 5, 2])).toBe("StirlingS2[5, 2]"); // CE Stirling = 2nd kind
  expect(toWolfram(["Totient", 12])).toBe("EulerPhi[12]");
  expect(toWolfram(["GammaLn", 5])).toBe("LogGamma[5]");
  expect(toWolfram(["Arcsin", "x"])).toBe("ArcSin[x]");
  expect(toWolfram(["Ceil", 2.3])).toBe("Ceiling[2.3]");
  expect(toWolfram(["IsPrime", 7])).toBe("PrimeQ[7]");
  expect(toWolfram(["IsSquareFree", 10])).toBe("SquareFreeQ[10]");
  expect(toWolfram(["At", ["List", 1, 2, 3], -1])).toBe("Part[List[1, 2, 3], -1]");
  expect(toWolfram(["SetMinus", ["List", 1, 2], ["List", 2]])).toBe("Complement[List[1, 2], List[2]]");
  expect(toWolfram(["NotEqual", 1, 2])).toBe("Unequal[1, 2]");
  expect(toWolfram(["Determinant", ["List", ["List", 1, 2], ["List", 3, 4]]])).toBe(
    "Det[List[List[1, 2], List[3, 4]]]",
  );
  expect(toWolfram(["Filter", ["List", 1, 2, 3], "EvenQ"])).toBe("Select[List[1, 2, 3], EvenQ]");
  expect(toWolfram(["Shape", ["List", 1, 2]])).toBe("Dimensions[List[1, 2]]");
  expect(toWolfram(["Repeat", 5, 3])).toBe("ConstantArray[5, 3]");
  expect(toWolfram(["Random"])).toBe("RandomReal[]");
  expect(toWolfram(["IsComposite", 9])).toBe("CompositeQ[9]");
  // Fungrim's names for the incomplete Legendre elliptic integrals — see
  // @enumeratio/analytic's elliptic.ts.
  expect(toWolfram(["IncompleteEllipticF", "phi", "m"])).toBe("EllipticF[phi, m]");
  expect(toWolfram(["IncompleteEllipticE", "phi", "m"])).toBe("EllipticE[phi, m]");
});

test("Divides(a, b) swaps to Wolfram's Divisible(n, m)", () => {
  // Divides(2, 4): does 2 divide 4? Divisible(4, 2): is 4 divisible by 2? Same fact.
  expect(toWolfram(["Divides", 2, 4])).toBe("Divisible[4, 2]");
});

test("All/Any rename to AllTrue/AnyTrue; the no-predicate form is inert on both sides", () => {
  expect(toWolfram(["All", ["List", 1, 2, 3], "Positive"])).toBe("AllTrue[List[1, 2, 3], Positive]");
  expect(toWolfram(["Any", ["List", 1, 2, 3], "Negative"])).toBe("AnyTrue[List[1, 2, 3], Negative]");
});

test("Fold keeps the same (f, init, xs) order as Wolfram's Fold[f, x, list]", () => {
  expect(toWolfram(["Fold", "Add", 0, ["List", 1, 2, 3]])).toBe("Fold[Plus, 0, List[1, 2, 3]]");
});

test("Tabulate(f, n) renames to Array; the multi-dim form reshapes dims into a list", () => {
  expect(toWolfram(["Tabulate", "f", 3])).toBe("Array[f, 3]");
  expect(toWolfram(["Tabulate", "f", 2, 3])).toBe("Array[f, List[2, 3]]");
});

test("Scan(xs, f) reorders to Wolfram's no-seed FoldList[f, list]; the seeded form doesn't map", () => {
  expect(toWolfram(["Scan", ["List", 1, 2, 3], "Add"])).toBe("FoldList[Plus, List[1, 2, 3]]");
  // Seeded form: length-preserving on our side, length+1 on Wolfram's — left unmapped.
  expect(toWolfram(["Scan", ["List", 1, 2, 3], "Add", 10])).toBe("enumeratio`Scan[List[1, 2, 3], Plus, 10]");
});

test("special forms: log base and n-th root", () => {
  expect(toWolfram(["Ln", "x"])).toBe("Log[x]"); // natural log
  expect(toWolfram(["Log", "x"])).toBe("Log[10, x]"); // CE Log is base-10
  expect(toWolfram(["Root", "x", 3])).toBe("Power[x, Divide[1, 3]]");
});

test("special forms: digits become a step, sets a sorted list, clamp a Clip range", () => {
  expect(toWolfram(["Round", 2.5])).toBe("Round[2.5]");
  // 3.14159 is an arbitrary value here, not Math.PI: numbers serialize via String(n),
  // so the expected output is this literal's exact digits, not full precision.
  expect(toWolfram(["Round", 3.14159, 2])).toBe("Round[3.14159, Power[10, -2]]");
  expect(toWolfram(["Round", 1234, -2])).toBe("Round[1234, Power[10, 2]]");
  expect(toWolfram(["Round", "x", "n"])).toBe("Round[x, Power[10, Minus[n]]]");
  expect(toWolfram(["Set", 3, 1, 2])).toBe("Union[List[3, 1, 2]]");
  expect(toWolfram(["Clamp", 5, 0, 3])).toBe("Clip[5, List[0, 3]]");
  expect(toWolfram(["Clamp", 1.5])).toBe("Clip[1.5]");
});

test("special forms: list-fold Sum/Product versus the iterator form", () => {
  expect(toWolfram(["Sum", ["List", 1, 2, 3]])).toBe("Total[List[1, 2, 3]]");
  expect(toWolfram(["Product", ["List", 1, 2, 3]])).toBe("Apply[Times, List[1, 2, 3]]");
  expect(toWolfram(["Sum", ["Stirling", 4, "k"], ["Tuple", "k", 0, 4]])).toBe("Sum[StirlingS2[4, k], List[k, 0, 4]]");
});

test("special forms: anonymous functions use slots", () => {
  expect(toWolfram(["Sort", ["List", 3, 1, 2], ["Function", ["Greater", "_1", "_2"]]])).toBe(
    "Sort[List[3, 1, 2], Function[Greater[Slot[1], Slot[2]]]]",
  );
  expect(toWolfram(["Function", ["Power", "_", 2]])).toBe("Function[Power[Slot[1], 2]]");
});

test("DigitSum is Wolfram's own head, third argument included", () => {
  expect(toWolfram(["DigitSum", 58127, 2])).toBe("DigitSum[58127, 2]");
  // DigitSum[n, b, k] sums the FIRST k digits: 18 here. Total[IntegerDigits[n, b, k]] would
  // keep the last k and give 17, which is what the old lowering sent the kernel.
  expect(toWolfram(["DigitSum", 6345354, 10, 4])).toBe("DigitSum[6345354, 10, 4]");
});

test("special forms lowered to a Wolfram expression with no head of its own", () => {
  // Level spec List[1]: IndexOf scans the collection's own elements only, not every depth —
  // FirstPosition without it would find a value nested inside a sublist too (#A-72).
  expect(toWolfram(["IndexOf", ["List", 1, 2, 3], 9])).toBe("First[FirstPosition[List[1, 2, 3], 9, List[0], List[1]]]");
  expect(toWolfram(["Degrees", 30])).toBe("Times[30, Degree]");
  expect(toWolfram(["Mode", ["List", 1, 2, 2]])).toBe("First[Commonest[List[1, 2, 2]]]");
});

// A-126 farm scan: compute-engine's own `Reduce(collection, f, x0)` is a fold (`Reduce([1,2,3,4],
// Add, 0)` evaluates to 10, same as `Fold(Add, 0, [1,2,3,4])`) — an unrelated name collision
// with Wolfram's OWN `Reduce` (equation/inequality solving). Passed through unchanged it isn't
// even the right call shape for Wolfram's Reduce, let alone the right answer.
test("Reduce(collection, f, x0) — our fold, not Wolfram's equation solver — maps to Fold", () => {
  expect(toWolfram(["Reduce", ["List", "a", "b", "c", "d"], "List", "x"])).toBe("Fold[List, x, List[a, b, c, d]]");
});
// Wolfram's own Reduce (a system list, `isWolframHead`) still passes through at any OTHER
// arity — the SPECIAL case only intercepts the exact 3-ary fold shape.
test("Reduce at another arity is left as Wolfram's own Reduce", () => {
  expect(toWolfram(["Reduce", ["Equal", "x", 1]])).toBe("Reduce[Equal[x, 1]]");
});

// A-126 head survey, #495: `Sign` is overloaded over `complex | permutation` — a `Permutation`
// argument is our permutation-parity statistic (Wolfram's `Signature`), not Wolfram's own
// numeric `Sign`. `Order` is the identical trap (found in the same survey) but has no clean
// single-arity Wolfram rename, so it stays isolated via `FOREIGN` (`enumeratio\`Order[...]`)
// rather than remapped here.
test("Sign(Permutation(...)) — permutation parity, not Wolfram's numeric Sign — maps to Signature", () => {
  expect(toWolfram(["Sign", ["Permutation", ["List", 2, 3, 1]]])).toBe("Signature[List[2, 3, 1]]");
});
// The composed cycle-notation form (`Permutation(CycleDecomposition(...))`) needs the same
// Cycles[...] conversion the Permutation/CycleDecomposition SPECIAL cases already do —
// Wolfram's Signature takes either representation.
test("Sign(Permutation(CycleDecomposition(...))) converts to Signature[Cycles[...]]", () => {
  expect(toWolfram(["Sign", ["Permutation", ["CycleDecomposition", ["List", ["List", 1, 2, 3]]]]])).toBe(
    "Signature[Cycles[List[List[1, 2, 3]]]]",
  );
});
// A numeric/complex argument is Wolfram's own Sign — untouched.
test("Sign of a number or symbol is left as Wolfram's own Sign", () => {
  expect(toWolfram(["Sign", -5])).toBe("Sign[-5]");
  expect(toWolfram(["Sign", "x"])).toBe("Sign[x]");
});

test("nested expressions compose", () => {
  expect(toWolfram(["Equal", ["Binomial", 10, 3], ["Binomial", 10, 7]])).toBe(
    "Equal[Binomial[10, 3], Binomial[10, 7]]",
  );
});

test("unmapped heads fall through unchanged, and say so", () => {
  expect(toWolfram(["Wibble", 1, 2])).toBe("Wibble[1, 2]");
  expect(isWolframHead("Wibble")).toBe(false);
  expect(isWolframHead("Binomial")).toBe(true);
  expect(isWolframHead("Round")).toBe(true);
  expect(isWolframHead("IndexOf")).toBe(true);
});

test("a head whose Wolfram name means something else emits into our context", () => {
  // Falling through by name would produce `Area[DyckPath[…]]`, which a kernel reads as the
  // area of a region — a wrong answer rather than a missing one.
  expect(toWolfram(["Area", ["DyckPath", ["List", 1, 0]]])).toBe("enumeratio`Area[DyckPath[List[1, 0]]]");
  expect(toWolfram(["Composition", ["List", 2, 1]])).toBe("enumeratio`Composition[List[2, 1]]");
  // And we do not claim a kernel can answer it.
  expect(isWolframHead("Area")).toBe(false);
});

test("GaussianIntegers stays genuinely ambiguous: bare passes through, called is ours", () => {
  // Wolfram's PrimeQ[n, GaussianIntegers -> True] needs the real, UNPREFIXED option name --
  // FOREIGN is not consulted for a bare symbol, only for a call (see symbolToWolfram's own
  // comment). Our carrier's plural type-space symbol is never itself CALLED, so this loses
  // nothing: `GaussianIntegers([2, 3])` is not a thing we declare.
  expect(toWolfram("GaussianIntegers")).toBe("GaussianIntegers");
  // KeyValuePair is now vouched for (Wolfram's own option-rule head, Rule); GaussianIntegers
  // itself is still the point of this test -- it stays bare either way.
  expect(toWolfram(["KeyValuePair", "GaussianIntegers", true])).toBe("Rule[GaussianIntegers, True]");
});

test("extension heads Wolfram shares are vouched for, not passed through", () => {
  expect(toWolfram(["Subsets", ["List", 1, 2]])).toBe("Subsets[List[1, 2]]");
  expect(toWolfram(["Compose", "Inverse", "Reverse"])).toBe("Composition[Inverse, Reverse]");
  expect(isWolframHead("Subsets")).toBe(true);
  expect(isWolframHead("CircleTimes")).toBe(true);
  expect(isWolframHead("FareySequence")).toBe(true);
});

test("the reciprocal inverse trig/hyperbolic heads rename straight to Wolfram's Arc*/ArcC*", () => {
  expect(toWolfram(["Arccsc", 2])).toBe("ArcCsc[2]");
  expect(toWolfram(["Arcsec", 2])).toBe("ArcSec[2]");
  expect(toWolfram(["Arcoth", 2])).toBe("ArcCoth[2]");
  expect(toWolfram(["Arcsch", 2])).toBe("ArcCsch[2]");
  expect(toWolfram(["Arsech", ["Rational", 1, 2]])).toBe("ArcSech[Rational[1, 2]]");
});

// A negative argument for each: Wolfram's principal range agrees with compute-engine's for
// all five straight renames, but NOT for Arccot (see the next test) — this is the check
// that would have caught that one before it shipped.
test("the reciprocal inverse trig/hyperbolic renames hold at a negative argument", () => {
  expect(toWolfram(["Arccsc", -2])).toBe("ArcCsc[-2]");
  expect(toWolfram(["Arcsec", -2])).toBe("ArcSec[-2]");
  expect(toWolfram(["Arcoth", -2])).toBe("ArcCoth[-2]");
  expect(toWolfram(["Arcsch", -2])).toBe("ArcCsch[-2]");
});

test("Arccot is NOT a straight rename to ArcCot — the principal ranges disagree at negative x", () => {
  // compute-engine's Arccot has range (0, π); Wolfram's ArcCot has range (-π/2, π/2], so
  // Arccot(-1) = 3π/4 but ArcCot[-1] = -π/4 — a straight rename would silently misanswer.
  // Pi/2 - ArcTan[x] matches compute-engine's range everywhere, so that's what's emitted.
  expect(toWolfram(["Arccot", 1])).toBe("Subtract[Divide[Pi, 2], ArcTan[1]]");
  expect(toWolfram(["Arccot", -1])).toBe("Subtract[Divide[Pi, 2], ArcTan[-1]]");
  expect(isWolframHead("Arccot")).toBe(true);
});

test("IsOdd/IsEven rename to OddQ/EvenQ", () => {
  expect(toWolfram(["IsOdd", 3])).toBe("OddQ[3]");
  expect(toWolfram(["IsEven", 4])).toBe("EvenQ[4]");
});

test("Contains(xs, v) renames to Wolfram's MemberQ[list, form], same argument order", () => {
  expect(toWolfram(["Contains", ["List", 1, 2, 3], 2])).toBe("MemberQ[List[1, 2, 3], 2]");
});

test("Unique(xs) renames to Wolfram's DeleteDuplicates[list]", () => {
  expect(toWolfram(["Unique", ["List", 1, 2, 2, 3]])).toBe("DeleteDuplicates[List[1, 2, 2, 3]]");
});

test("PositionalNumerals(b) unwraps to the bare base Wolfram's IntegerDigits/FromDigits take", () => {
  expect(toWolfram(["IntegerDigits", 2147, ["PositionalNumerals", 2]])).toBe("IntegerDigits[2147, 2]");
  expect(toWolfram(["FromDigits", ["List", 1, 0, 1], ["PositionalNumerals", 2]])).toBe("FromDigits[List[1, 0, 1], 2]");
});

test("Limit unwraps its Function argument to Wolfram's body + Rule binding", () => {
  // Anonymous (Slot-based) function: no named parameter, so a fresh `x` is minted and
  // substituted for `_1` throughout the body.
  expect(toWolfram(["Limit", ["Function", ["Divide", ["Sin", "_1"], "_1"]], 0])).toBe(
    "Limit[Divide[Sin[x], x], Rule[x, 0]]",
  );
  // Named-parameter function: the parameter's own name is the bound variable.
  expect(toWolfram(["Limit", ["Function", ["Arctan", "x"], "x"], "PositiveInfinity"])).toBe(
    "Limit[ArcTan[x], Rule[x, Infinity]]",
  );
});

test('Limit\'s direction (our +1/-1) becomes Wolfram\'s Direction -> "FromAbove"/"FromBelow"', () => {
  // dir = 1: x approaches 0 from values ABOVE it -- the right-hand limit (confirmed
  // directly: Limit(1/x, 0, 1) evaluates to PositiveInfinity).
  expect(toWolfram(["Limit", ["Function", ["Divide", 1, "_1"]], 0, 1])).toBe(
    'Limit[Divide[1, x], Rule[x, 0], Rule[Direction, "FromAbove"]]',
  );
  expect(toWolfram(["Limit", ["Function", ["Divide", 1, "_1"]], 0, -1])).toBe(
    'Limit[Divide[1, x], Rule[x, 0], Rule[Direction, "FromBelow"]]',
  );
});

test("Map(f, xs, ys, …) with more than one collection zips them via Wolfram's MapThread", () => {
  expect(toWolfram(["Map", "Add", ["List", 1, 2, 3], ["List", 10, 20, 30]])).toBe(
    "MapThread[Plus, List[List[1, 2, 3], List[10, 20, 30]]]",
  );
  // A single collection stays the plain Map.
  expect(toWolfram(["Map", "Square", ["List", 1, 2, 3, 4]])).toBe("Map[Square, List[1, 2, 3, 4]]");
});

test("Table(Function(body), n) unwraps to Wolfram's body + {i, n} iterator", () => {
  expect(toWolfram(["Table", ["Function", ["Power", "_1", 2]], 5])).toBe("Table[Power[i, 2], List[i, 5]]");
  // A real iterator spec (Set/Limits/Tuple) is left as a plain rename -- Table already
  // agrees with Wolfram's own shape there. (Set's own head is separately overloaded as our
  // set-literal constructor -- see the "special forms" test above -- so this pre-existing
  // quirk is unaffected by the Function-unwrapping added here.)
  expect(toWolfram(["Table", "i", ["Limits", "i", 1, 10]])).toBe("Table[i, Limits[i, 1, 10]]");
});

test("bare `All` stays Wolfram's own level-spec/wildcard symbol; only the predicate head means AllTrue", () => {
  expect(toWolfram(["Ordering", ["List", 2, 6, 1, 9, 3], "All", "Greater"])).toBe(
    "Ordering[List[2, 6, 1, 9, 3], All, Greater]",
  );
  expect(toWolfram(["At", ["List", ["List", 1, 2, 3], ["List", 4, 5, 6]], "All", 2])).toBe(
    "Part[List[List[1, 2, 3], List[4, 5, 6]], All, 2]",
  );
  // The head call still means the predicate.
  expect(toWolfram(["All", ["List", 1, 2, 3], "Positive"])).toBe("AllTrue[List[1, 2, 3], Positive]");
});

test("Clamp(x, lo, hi, vlo, vhi) is Clip's {lo, hi}, {vlo, vhi} replacement-value form", () => {
  expect(toWolfram(["Clamp", -5, 0, 3, -1, 10])).toBe("Clip[-5, List[0, 3], List[-1, 10]]");
  expect(toWolfram(["Clamp", 5, 0, 3, -1, 10])).toBe("Clip[5, List[0, 3], List[-1, 10]]");
});

test("Count(list, predicate) is Wolfram's Count[list, _?pred]; a plain value stays exact equality", () => {
  expect(toWolfram(["Count", ["List", 1, 2, 3, 4], ["Function", ["Greater", "_1", 2]]])).toBe(
    "Count[List[1, 2, 3, 4], PatternTest[Blank[], Function[Greater[Slot[1], 2]]]]",
  );
  expect(toWolfram(["Count", ["List", 1, 2, 2, 3], 2])).toBe("Count[List[1, 2, 2, 3], 2]");
});

test("Count(collection) with no value/predicate is Wolfram's Length -- Count always needs a pattern there", () => {
  expect(toWolfram(["Count", ["List", 1, 2, 3]])).toBe("Length[List[1, 2, 3]]");
  expect(toWolfram(["Count", "FactorialNumbers"])).toBe("Length[FactorialNumbers]");
});

test("IsArray(a, test) inserts ArrayQ's level pattern between the array and the test", () => {
  expect(toWolfram(["IsArray", ["List", ["List", 2, 4], ["List", 6, 8]], "IsEven"])).toBe(
    "ArrayQ[List[List[2, 4], List[6, 8]], Blank[], EvenQ]",
  );
});

test("Thread(Equal(l1, l2)) defers Equal's evaluation so Thread has something to thread over", () => {
  expect(toWolfram(["Thread", ["Equal", ["List", 1, 2, 3], ["List", 1, 5, 3]]])).toBe(
    "Thread[Unevaluated[Equal[List[1, 2, 3], List[1, 5, 3]]]]",
  );
});

test("Random(collection, n) draws with replacement via RandomChoice; a distribution/interval domain keeps RandomReal", () => {
  expect(toWolfram(["Random", ["IntegerPartitions", 10], 3])).toBe("RandomChoice[IntegerPartitions[10], 3]");
  expect(toWolfram(["Random", ["Range", 10, 20]])).toBe("RandomChoice[Range[10, 20]]");
  expect(toWolfram(["Random"])).toBe("RandomReal[]");
  expect(toWolfram(["Random", ["NormalDistribution", 0, 1]])).toBe("RandomReal[NormalDistribution[0, 1]]");
});

test("Subsets(n, spec)/Tuples(n, k) with an integer n draw from Range(n), our carrier-sized overload", () => {
  expect(toWolfram(["Subsets", 4, 2])).toBe("Subsets[Range[4], 2]");
  expect(toWolfram(["Subsets", 4, ["List", 2]])).toBe("Subsets[Range[4], List[2]]");
  expect(toWolfram(["Tuples", 2, 3])).toBe("Tuples[Range[2], 3]");
  // An actual collection is left alone.
  expect(toWolfram(["Subsets", ["List", "a", "b", "c"]])).toBe("Subsets[List[a, b, c]]");
});

test("CycleDecomposition/Permutation round-trip via Wolfram's own PermutationCycles/PermutationList∘Cycles", () => {
  expect(toWolfram(["CycleDecomposition", ["Permutation", ["List", 2, 3, 1, 4]]])).toBe(
    "PermutationCycles[List[2, 3, 1, 4]]",
  );
  expect(toWolfram(["Permutation", ["CycleDecomposition", ["List", ["List", 1, 3], ["List", 2]]]])).toBe(
    "PermutationList[Cycles[List[List[1, 3], List[2]]]]",
  );
  // Outside that composition, a bare call stays the literal, unmapped rename it always was
  // (the oracle's own carrier-contents unwrap handles the bare case separately — see
  // `emit.test.ts`).
  expect(toWolfram(["Permutation", ["List", 2, 3, 1, 4]])).toBe("Permutation[List[2, 3, 1, 4]]");
  expect(toWolfram(["CycleDecomposition", ["List", ["List", 1, 2, 3], ["List", 4]]])).toBe(
    "CycleDecomposition[List[List[1, 2, 3], List[4]]]",
  );
});

test("Solve(eqs, x, y) lists its unknowns; a list or a single unknown is left as written", () => {
  const eqs = ["List", ["Equal", ["Add", "x", "y"], 3], ["Equal", ["Subtract", "x", "y"], 1]];
  expect(toWolfram(["Solve", eqs, "x", "y"])).toBe(`Solve[${toWolfram(eqs)}, List[x, y]]`);
  expect(toWolfram(["Solve", eqs, ["List", "x", "y"]])).toBe(`Solve[${toWolfram(eqs)}, List[x, y]]`);
  expect(toWolfram(["Solve", ["Equal", "x", 1], "x"])).toBe("Solve[Equal[x, 1], x]");
});

test("ClosenessCentrality(g, v) selects one vertex via Part, Wolfram having no 2-argument form", () => {
  expect(toWolfram(["ClosenessCentrality", ["StarGraph", 5], 1])).toBe("Part[ClosenessCentrality[StarGraph[5]], 1]");
});
