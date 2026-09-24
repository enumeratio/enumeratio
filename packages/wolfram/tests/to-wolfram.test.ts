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
  expect(toWolfram(["SetMinus", ["List", 1, 2], ["List", 2]])).toBe(
    "Complement[List[1, 2], List[2]]",
  );
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

test("special forms: log base and n-th root", () => {
  expect(toWolfram(["Ln", "x"])).toBe("Log[x]"); // natural log
  expect(toWolfram(["Log", "x"])).toBe("Log[10, x]"); // CE Log is base-10
  expect(toWolfram(["Root", "x", 3])).toBe("Power[x, Divide[1, 3]]");
});

test("special forms: digits become a step, sets a sorted list, clamp a Clip range", () => {
  expect(toWolfram(["Round", 2.5])).toBe("Round[2.5]");
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
  expect(toWolfram(["Sum", ["Stirling", 4, "k"], ["Tuple", "k", 0, 4]])).toBe(
    "Sum[StirlingS2[4, k], List[k, 0, 4]]",
  );
});

test("special forms: anonymous functions use slots", () => {
  expect(toWolfram(["Sort", ["List", 3, 1, 2], ["Function", ["Greater", "_1", "_2"]]])).toBe(
    "Sort[List[3, 1, 2], Function[Greater[Slot[1], Slot[2]]]]",
  );
});

test("special forms lowered to a Wolfram expression with no head of its own", () => {
  expect(toWolfram(["IndexOf", ["List", 1, 2, 3], 9])).toBe(
    "First[FirstPosition[List[1, 2, 3], 9, List[0]]]",
  );
  expect(toWolfram(["DigitSum", 58127, 2])).toBe("Total[IntegerDigits[58127, 2]]");
  expect(toWolfram(["Degrees", 30])).toBe("Times[30, Degree]");
  expect(toWolfram(["Mode", ["List", 1, 2, 2]])).toBe("First[Commonest[List[1, 2, 2]]]");
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
  expect(toWolfram(["Area", ["DyckPath", ["List", 1, 0]]])).toBe(
    "enumeratio`Area[DyckPath[List[1, 0]]]",
  );
  expect(toWolfram(["Composition", ["List", 2, 1]])).toBe("enumeratio`Composition[List[2, 1]]");
  // And we do not claim a kernel can answer it.
  expect(isWolframHead("Area")).toBe(false);
});

test("extension heads Wolfram shares are vouched for, not passed through", () => {
  expect(toWolfram(["Subsets", ["List", 1, 2]])).toBe("Subsets[List[1, 2]]");
  expect(toWolfram(["Compose", "Inverse", "Reverse"])).toBe("Composition[Inverse, Reverse]");
  expect(isWolframHead("Subsets")).toBe(true);
  expect(isWolframHead("CircleTimes")).toBe(true);
  expect(isWolframHead("FareySequence")).toBe(true);
});
