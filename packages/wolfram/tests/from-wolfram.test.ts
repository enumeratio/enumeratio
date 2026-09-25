import { expect, test } from "vite-plus/test";
import { fromWolfram } from "../src/from-wolfram.ts";
import { type MathJson, toWolfram } from "../src/to-wolfram.ts";

test("numbers, in every shape FullForm prints", () => {
  expect(fromWolfram("42")).toBe(42);
  expect(fromWolfram("-3.5")).toBe(-3.5);
  expect(fromWolfram("2.")).toBe(2);
  expect(fromWolfram("1.5*^3")).toBe(1500);
  expect(fromWolfram("1.`*^-11")).toBe(1e-11);
  expect(fromWolfram("3.141592653589793`")).toBeCloseTo(Math.PI);
  expect(fromWolfram("3.1415926535897932385`20.")).toBeCloseTo(Math.PI);
  expect(fromWolfram("9.332621544394415`*^157")).toBeCloseTo(9.332621544394415e157);
});

test("symbols, with the reverse of the SYMBOLS map", () => {
  expect(fromWolfram("x")).toBe("x");
  expect(fromWolfram("Pi")).toBe("Pi");
  expect(fromWolfram("E")).toBe("ExponentialE");
  expect(fromWolfram("I")).toBe("ImaginaryUnit");
  expect(fromWolfram("Infinity")).toBe("PositiveInfinity");
  expect(fromWolfram("-Infinity")).toBe("NegativeInfinity");
  expect(fromWolfram("Indeterminate")).toBe("NaN");
});

test("FullForm's DirectedInfinity spellings", () => {
  expect(fromWolfram("DirectedInfinity[1]")).toBe("PositiveInfinity");
  expect(fromWolfram("DirectedInfinity[-1]")).toBe("NegativeInfinity");
  expect(fromWolfram("DirectedInfinity[]")).toBe("ComplexInfinity");
  expect(fromWolfram("DirectedInfinity[I]")).toEqual(["DirectedInfinity", "ImaginaryUnit"]);
});

test("Head[args], with the reverse of the HEADS map", () => {
  expect(fromWolfram("Binomial[10, 3]")).toEqual(["Binomial", 10, 3]);
  expect(fromWolfram("Plus[x, 1]")).toEqual(["Add", "x", 1]);
  expect(fromWolfram("Times[2, x]")).toEqual(["Multiply", 2, "x"]);
  expect(fromWolfram("EulerPhi[12]")).toEqual(["Totient", 12]);
  expect(fromWolfram("StirlingS2[5, 2]")).toEqual(["Stirling", 5, 2]);
  expect(fromWolfram("LogGamma[5]")).toEqual(["GammaLn", 5]);
  expect(fromWolfram("PrimeQ[7]")).toEqual(["IsPrime", 7]);
  expect(fromWolfram("Part[List[1, 2, 3], -1]")).toEqual(["At", ["List", 1, 2, 3], -1]);
  expect(fromWolfram("Complement[List[1, 2], List[2]]")).toEqual([
    "SetMinus",
    ["List", 1, 2],
    ["List", 2],
  ]);
  expect(fromWolfram("Rational[-7813, 3240]")).toEqual(["Rational", -7813, 3240]);
  expect(fromWolfram("Complex[0., 2.]")).toEqual(["Complex", 0, 2]);
  expect(fromWolfram("Det[List[List[1, 2], List[3, 4]]]")).toEqual([
    "Determinant",
    ["List", ["List", 1, 2], ["List", 3, 4]],
  ]);
  expect(fromWolfram("Select[List[1, 2, 3], EvenQ]")).toEqual([
    "Filter",
    ["List", 1, 2, 3],
    "EvenQ",
  ]);
  expect(fromWolfram("Dimensions[List[1, 2]]")).toEqual(["Shape", ["List", 1, 2]]);
  expect(fromWolfram("ConstantArray[5, 3]")).toEqual(["Repeat", 5, 3]);
  expect(fromWolfram("CompositeQ[9]")).toEqual(["IsComposite", 9]);
});

test("Total is our Sum given a plain list, no iterator", () => {
  expect(fromWolfram("Total[List[1, 2, 3]]")).toEqual(["Sum", ["List", 1, 2, 3]]);
});

test("Divisible(n, m) swaps to our Divides(a, b)", () => {
  expect(fromWolfram("Divisible[4, 2]")).toEqual(["Divides", 2, 4]);
});

test("nested expressions", () => {
  expect(fromWolfram("Equal[Binomial[10, 3], Binomial[10, 7]]")).toEqual([
    "Equal",
    ["Binomial", 10, 3],
    ["Binomial", 10, 7],
  ]);
});

test("{list} literal", () => {
  expect(fromWolfram("{1, 2, 3}")).toEqual(["List", 1, 2, 3]);
  expect(fromWolfram("{x, {1, 2}}")).toEqual(["List", "x", ["List", 1, 2]]);
});

test("string literals come back as the 'quoted' MathJSON shorthand", () => {
  expect(fromWolfram('"hello"')).toBe("'hello'");
  expect(fromWolfram('"with \\"quotes\\""')).toBe("'with \"quotes\"'");
  expect(fromWolfram('ModularTrace["LRLR"]')).toEqual(["ModularTrace", "'LRLR'"]);
});

test("Log arg-swap reverses cleanly for the explicit-base form", () => {
  expect(fromWolfram("Log[x]")).toEqual(["Ln", "x"]); // 1-arg Log is natural log
  expect(fromWolfram("Log[2, x]")).toEqual(["Log", "x", 2]); // base-first -> value-first
});

test("structural forms with an unambiguous shape are reversed", () => {
  expect(fromWolfram("Slot[1]")).toBe("_1");
  expect(fromWolfram(toWolfram(["Function", ["Power", "_", 2]]))).toEqual([
    "Function",
    ["Power", "_1", 2],
  ]);
  expect(fromWolfram("Function[Greater[Slot[1], Slot[2]]]")).toEqual([
    "Function",
    ["Greater", "_1", "_2"],
  ]);
  expect(fromWolfram("Clip[5, List[0, 3]]")).toEqual(["Clamp", 5, 0, 3]);
  expect(fromWolfram("Clip[1.5]")).toEqual(["Clamp", 1.5]);
  expect(fromWolfram("Total[List[1, 2]]")).toEqual(["Sum", ["List", 1, 2]]);
  expect(fromWolfram("Apply[Times, List[1, 2]]")).toEqual(["Product", ["List", 1, 2]]);
  expect(fromWolfram("Sum[f[k], List[k, 0, 4]]")).toEqual([
    "Sum",
    ["f", "k"],
    ["Tuple", "k", 0, 4],
  ]);
});

test("unmapped heads pass through unchanged", () => {
  expect(fromWolfram("Wibble[1, 2]")).toEqual(["Wibble", 1, 2]);
});

test("whitespace between tokens is insignificant", () => {
  expect(fromWolfram("Plus[ 1 ,  2 ]")).toEqual(["Add", 1, 2]);
});

test("round-trips through toWolfram for expressions using mapped heads", () => {
  const cases: MathJson[] = [
    42,
    -3.5,
    1e-11,
    "Pi",
    "ExponentialE",
    "ImaginaryUnit",
    "'LRLR'",
    ["Binomial", 10, 3],
    ["Add", "x", 1],
    ["Multiply", 2, "x"],
    ["Power", "x", 2],
    ["List", 1, 2, 3],
    ["Stirling", 5, 2],
    ["Totient", 12],
    ["GammaLn", 5],
    ["Arcsin", "x"],
    ["Ceil", 2.3],
    ["Log", "x", 2], // explicit-base Log round-trips; the 1-arg base-10 form doesn't
    ["Equal", ["Binomial", 10, 3], ["Binomial", 10, 7]],
    ["Clamp", 5, 0, 3],
    ["Sum", ["Stirling", 4, "k"], ["Tuple", "k", 0, 4]],
    ["Product", ["List", 1, 2, 3]],
    ["Sort", ["List", 3, 1, 2], ["Function", ["Greater", "_1", "_2"]]],
    ["ModularTrace", "'LRLR'"],
  ];
  for (const value of cases) {
    expect(fromWolfram(toWolfram(value))).toEqual(value);
  }
});

test("known-lossy cases are documented, not inverted, by fromWolfram", () => {
  // CE's 1-arg base-10 Log serialises to an explicit-base Wolfram call, which
  // parses back as an explicit-base CE Log rather than the original 1-arg form.
  expect(toWolfram(["Log", "x"])).toBe("Log[10, x]");
  expect(fromWolfram("Log[10, x]")).toEqual(["Log", "x", 10]);

  // Root(x, n) serialises to a plain Power/Divide expression; fromWolfram has
  // no way to recover the original "Root" head from that shape.
  expect(toWolfram(["Root", "x", 3])).toBe("Power[x, Divide[1, 3]]");
  expect(fromWolfram("Power[x, Divide[1, 3]]")).toEqual(["Power", "x", ["Divide", 1, 3]]);

  // A digits count becomes a step; a Set becomes a Union of one list.
  expect(fromWolfram(toWolfram(["Round", 3.14159, 2]))).toEqual([
    "Round",
    3.14159,
    ["Power", 10, -2],
  ]);
  expect(fromWolfram(toWolfram(["Set", 1, 2]))).toEqual(["Union", ["List", 1, 2]]);
});

test("a context-qualified name comes back as the bare head", () => {
  expect(fromWolfram("enumeratio`Area[DyckPath[List[1, 0]]]")).toEqual([
    "Area",
    ["DyckPath", ["List", 1, 0]],
  ]);
  expect(fromWolfram("enumeratio`Order")).toBe("Order");
});
