import { ComputeEngine } from "@cortex-js/compute-engine";
import { collectMessages, messageLine, symbolNameOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareNumerals, NUMERAL_ALIASES } from "../src/declare.ts";

const ce = new ComputeEngine();
declareNumerals(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const value = (input: Expr) => ce.box(input).evaluate().json;
const L = (...xs: number[]): Expr => ["List", ...xs];

test("a plain integer base is still compute-engine's own", () => {
  // This package must not change what IntegerDigits already meant.
  const bare = new ComputeEngine();
  for (const call of [
    ["IntegerDigits", 10, 2],
    ["IntegerDigits", 255, 16],
    ["IntegerDigits", 0, 2],
    ["FromDigits", L(1, 0, 1, 0), 2],
    ["FromDigits", L(1, 2, 3)],
  ] as Expr[]) {
    expect(value(call), JSON.stringify(call)).toEqual(bare.box(call).evaluate().json);
  }
});

test("the base slot takes a SYSTEM, as in Wolfram's MixedRadix", () => {
  expect(value(["IntegerDigits", 93784, ["MixedRadixNumerals", L(24, 60, 60)]])).toEqual(L(1, 2, 3, 4));
  expect(value(["FromDigits", L(1, 2, 3, 4), ["MixedRadixNumerals", L(24, 60, 60)]])).toBe(93784);
});

test("factoradic digits are the Lehmer code", () => {
  expect(value(["IntegerDigits", 5, "FactorialNumerals"])).toEqual(L(2, 1, 0));
  expect(value(["IntegerDigits", 463, "FactorialNumerals"])).toEqual(L(3, 4, 1, 0, 1, 0));
  expect(value(["FromDigits", L(3, 4, 1, 0, 1, 0), "FactorialNumerals"])).toBe(463);
});

test("padding lines the factoradic digits up with a Lehmer code", () => {
  // 5 is 0·3! + 2·2! + 1·1! + 0·0!, and the Lehmer code of the 6th permutation of four
  // things needs one digit per position — so the padded width is what makes them equal.
  expect(value(["IntegerDigits", 5, "FactorialNumerals", 4])).toEqual(L(0, 2, 1, 0));
  expect(value(["FromDigits", L(0, 2, 1, 0), "FactorialNumerals"])).toBe(5);
  expect(value(["IntegerDigits", 10, 2, 8])).toEqual(
    new ComputeEngine().box(["IntegerDigits", 10, 2, 8]).evaluate().json,
  );
});

test("Zeckendorf, and the forbidden pattern", () => {
  expect(value(["IntegerDigits", 100, "ZeckendorfNumerals"])).toEqual(L(1, 0, 0, 0, 0, 1, 0, 1, 0, 0));
  expect(value(["FromDigits", L(1, 0, 0, 0, 0, 1, 0, 1, 0, 0), "ZeckendorfNumerals"])).toBe(100);
  // Two adjacent ones is not a numeral, so it denotes nothing.
  expect(ce.box(["FromDigits", L(1, 1), "ZeckendorfNumerals"]).evaluate().operator).toBe("FromDigits");
});

test("signless systems represent negatives", () => {
  expect(value(["IntegerDigits", 5, ["BalancedNumerals", 3]])).toEqual(L(1, -1, -1));
  expect(value(["IntegerDigits", -5, ["BalancedNumerals", 3]])).toEqual(L(-1, 1, 1));
  expect(value(["FromDigits", L(-1, 1, 1), ["BalancedNumerals", 3]])).toBe(-5);
  expect(value(["IntegerDigits", 3, ["NegativeNumerals", 2]])).toEqual(L(1, 1, 1)); // 4 − 2 + 1
  expect(value(["IntegerDigits", -2, ["NegativeNumerals", 2]])).toEqual(L(1, 0));
  // compute-engine's own fixed radix drops the sign; these systems do not need one.
  expect(value(["IntegerDigits", -5, 2])).toEqual(L(1, 0, 1));
});

test("bijective base 26 has no zero digit", () => {
  expect(value(["IntegerDigits", 27, ["BijectiveNumerals", 26]])).toEqual(L(1, 1)); // AA
  expect(value(["IntegerDigits", 702, ["BijectiveNumerals", 26]])).toEqual(L(26, 26)); // ZZ
  // Zero is the EMPTY numeral, which is what makes the system bijective — there is one
  // string over {1…26} per non-negative integer, and the empty one belongs to zero.
  expect(value(["IntegerDigits", 0, ["BijectiveNumerals", 26]])).toEqual(L());
  expect(value(["FromDigits", L(), ["BijectiveNumerals", 26]])).toBe(0);
});

test("residue systems, and where they stop being a numeral system", () => {
  expect(value(["IntegerDigits", 23, ["ResidueNumerals", L(3, 5, 7)]])).toEqual(L(2, 3, 2));
  expect(value(["FromDigits", L(2, 3, 2), ["ResidueNumerals", L(3, 5, 7)]])).toBe(23);
  // Past the product there is no numeral.
  expect(ce.box(["IntegerDigits", 105, ["ResidueNumerals", L(3, 5, 7)]]).evaluate().operator).toBe("IntegerDigits");
  // Non-coprime moduli: an inconsistent digit string denotes nothing.
  expect(ce.box(["FromDigits", L(1, 2), ["ResidueNumerals", L(4, 6)]]).evaluate().operator).toBe("FromDigits");
});

test("PositionalNumerals agrees with the native fixed-radix handler for b ≥ 2", () => {
  for (const [n, b] of [
    [2147, 2],
    [255, 16],
    [93784, 10],
    [0, 7],
  ] as const) {
    expect(value(["IntegerDigits", n, ["PositionalNumerals", b]]), `${n} base ${b}`).toEqual(
      value(["IntegerDigits", n, b]),
    );
  }
  const digits = L(1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1); // 2147 in base 2
  expect(value(["FromDigits", digits, ["PositionalNumerals", 2]])).toBe(value(["FromDigits", digits, 2]));
});

test("PositionalNumerals declines a negative — unlike the native handler, which drops the sign", () => {
  // compute-engine's own fixed radix drops the sign (see "signless systems" above); as a
  // system value PositionalNumerals instead declines, consistent with every sibling whose
  // domain is the non-negative integers (FactorialNumerals, ZeckendorfNumerals, …).
  expect(value(["IntegerDigits", -5, 2])).toEqual(L(1, 0, 1));
  expect(ce.box(["IntegerDigits", -5, ["PositionalNumerals", 2]]).evaluate().operator).toBe("IntegerDigits");
});

test("the combinatorial system and the primorial base", () => {
  expect(value(["IntegerDigits", 0, ["CombinatorialNumerals", 3]])).toEqual(L(2, 1, 0));
  expect(value(["FromDigits", L(3, 2, 1), ["CombinatorialNumerals", 3]])).toBe(3);
  expect(value(["IntegerDigits", 30, "PrimorialNumerals"])).toEqual(L(1, 0, 0, 0));
});

test("systems describe their own shape as a Dictionary", () => {
  expect(value(["NumeralSystemShape", ["ResidueNumerals", L(4, 6)]])).toEqual([
    "Dictionary",
    ["KeyValuePair", { str: "Bijective" }, "False"],
    ["KeyValuePair", { str: "Integers" }, ["Range", 0, 23]],
    ["KeyValuePair", { str: "Digits" }, ["List", ["Range", 0, 3], ["Range", 0, 5]]],
    ["KeyValuePair", { str: "Width" }, 2],
  ]);
  expect(value(["NumeralSystemShape", "ZeckendorfNumerals"])).toEqual([
    "Dictionary",
    ["KeyValuePair", { str: "Bijective" }, "True"],
    ["KeyValuePair", { str: "Integers" }, "NonNegativeIntegers"],
    ["KeyValuePair", { str: "Digits" }, ["Range", 0, 1]],
    ["KeyValuePair", { str: "Rule" }, "'no two adjacent ones'"],
  ]);
  // Balanced digits spell every integer, negatives included, with no sign.
  expect(value(["NumeralSystemShape", ["BalancedNumerals", 3]])).toContainEqual([
    "KeyValuePair",
    { str: "Integers" },
    "Integers",
  ]);
});

test("an unreadable system leaves the call alone", () => {
  expect(ce.box(["IntegerDigits", 10, ["BalancedNumerals", 4]]).evaluate().operator).toBe("IntegerDigits"); // even base
  expect(ce.box(["IntegerDigits", 10, "NotASystem"]).evaluate().operator).toBe("IntegerDigits");
});

test("Ostrowski takes a continued fraction in the base slot", () => {
  const golden: Expr = ["OstrowskiNumerals", L(1, 1, 1, 1, 1, 1, 1, 1)];
  // 12 = 8 + 3 + 1, over the convergent denominators 21, 13, 8, 5, 3, 2, 1, 1.
  expect(value(["IntegerDigits", 12, golden])).toEqual(L(0, 0, 1, 0, 1, 0, 1, 0));
  expect(value(["FromDigits", L(0, 0, 1, 0, 1, 0, 1, 0), golden])).toBe(12);
  // Its digits are Zeckendorf's, less the forced lowest zero and the leading zeros.
  expect(value(["IntegerDigits", 12, "ZeckendorfNumerals"])).toEqual(L(1, 0, 1, 0, 1));
  expect(value(["IntegerDigits", 9, ["OstrowskiNumerals", L(2, 2, 2)]])).toEqual(L(1, 2, 0));
});

test("Ostrowski declines a string its ceiling rule forbids", () => {
  // The middle digit is at its ceiling, so nothing below it may be non-zero.
  expect(ce.box(["FromDigits", L(1, 2, 1), ["OstrowskiNumerals", L(2, 2, 2)]]).evaluate().operator).toBe("FromDigits");
  expect(ce.box(["IntegerDigits", 12, ["OstrowskiNumerals", L(2, 2, 2)]]).evaluate().operator).toBe("IntegerDigits"); // out of range: q₃ = 12
});

test("a system that declines says why", () => {
  const said = (input: Expr): string[] => collectMessages(ce, () => ce.box(input).evaluate()).messages.map(messageLine);
  expect(said(["IntegerDigits", -3, "FactorialNumerals"])).toEqual([
    "IntegerDigits::nonum: -3 has no numeral in FactorialNumerals. FactorialNumerals spells the integers ≥ 0.",
  ]);
  expect(said(["FromDigits", L(1, 1, 0), "ZeckendorfNumerals"])).toEqual([
    "FromDigits::nonum: [1, 1, 0] is not a numeral in ZeckendorfNumerals. In ZeckendorfNumerals: digits 0–1; no two adjacent ones.",
  ]);
  const ncop =
    "ResidueNumerals::ncop: The moduli [4, 6] are not pairwise coprime (gcd(4, 6) = 2), so this is not a bijection.";
  expect(said(["IntegerDigits", 5, ["ResidueNumerals", L(4, 6)]])).toEqual([ncop]);
  expect(said(["IntegerDigits", 5, ["ResidueNumerals", L(3, 5)]])).toEqual([]);
});

test("every old spelling is a working alias for its `…Numerals` name", () => {
  // The base-slot args each old head takes, and an n in its domain — same shape (bare
  // symbol or call) is used to build both the old and the canonical expression below.
  const ARGS: Record<string, { args: readonly Expr[]; n: number }> = {
    Radix: { args: [10], n: 463 },
    Factoradic: { args: [], n: 5 },
    PrimorialRadix: { args: [], n: 30 },
    BalancedRadix: { args: [3], n: -5 },
    NegativeRadix: { args: [2], n: 3 },
    BijectiveRadix: { args: [26], n: 703 },
    Zeckendorf: { args: [], n: 100 },
    Ostrowski: { args: [L(1, 1, 1, 1, 1, 1, 1, 1)], n: 20 },
    CombinatorialSystem: { args: [3], n: 0 },
    ResidueSystem: { args: [L(3, 5, 7)], n: 23 },
    MixedRadix: { args: [L(24, 60, 60)], n: 93784 },
  };
  expect(Object.keys(ARGS).sort()).toEqual(Object.keys(NUMERAL_ALIASES).sort());
  for (const [alias, canonical] of Object.entries(NUMERAL_ALIASES)) {
    const { args, n } = ARGS[alias]!;
    const aliasExpr: Expr = args.length === 0 ? alias : [alias, ...args];
    const canonicalExpr: Expr = args.length === 0 ? canonical : [canonical, ...args];
    // Same digits as the canonical spelling.
    expect(value(["IntegerDigits", n, aliasExpr]), alias).toEqual(value(["IntegerDigits", n, canonicalExpr]));
    // The base slot itself normalises to the canonical name on evaluation.
    const evaluated = ce.box(aliasExpr).evaluate();
    expect(symbolNameOf(evaluated) ?? evaluated.operator, alias).toBe(canonical);
  }
});

test("DigitSum(n, base, k): the first k digits, or the last |k| when k is negative", () => {
  // 6345354 in base 10 is 6 3 4 5 3 5 4 — the first four are 6 3 4 5.
  expect(value(["DigitSum", 6345354, 10, 4])).toBe(18);
  // The last three are 3 5 4.
  expect(value(["DigitSum", 6345354, 10, -3])).toBe(12);
  // k at least the digit count is the plain digit sum.
  expect(value(["DigitSum", 6345354, 10, 7])).toBe(30);
  expect(value(["DigitSum", 6345354, 10, 7])).toEqual(value(["DigitSum", 6345354, 10]));
  // Sign is discarded, as in the two-argument form.
  expect(value(["DigitSum", -6345354, 10, 4])).toBe(18);
  // The two-argument form is untouched.
  const bare = new ComputeEngine();
  expect(value(["DigitSum", 58127, 2])).toEqual(bare.box(["DigitSum", 58127, 2]).evaluate().json);
});
