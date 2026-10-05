import { bareEngine, createEngine } from "@enumeratio/engine/testing";
import { collectMessages, messageLine, symbolNameOf } from "@enumeratio/engine";
import { expect, test } from "vite-plus/test";
import { declareNumerals, NUMERAL_ALIASES } from "../src/declare.ts";

const ce = createEngine(declareNumerals);

type Expr = number | string | readonly [string, ...Expr[]];
const value = (input: Expr) => ce.box(input).evaluate().json;
const L = (...xs: number[]): Expr => ["List", ...xs];

test("a plain integer base is still compute-engine's own", () => {
  // This package must not change what IntegerDigits already meant.
  const bare = bareEngine();
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

test("padding a fixed radix agrees with the native handler", () => {
  // 5 is 0·3! + 2·2! + 1·1! + 0·0!, and the Lehmer code of the 6th permutation of four
  // things needs one digit per position — see IntegerDigits' factoradic examples for the
  // pinned padded value; here we only cross-check the native (non-system) padded form.
  expect(value(["IntegerDigits", 10, 2, 8])).toEqual(bareEngine().box(["IntegerDigits", 10, 2, 8]).evaluate().json);
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

// Regression for A-129/farm: IntegerDigits(n, MixedRadix(bases)) used to always print
// bases.length + 1 digits (the overflow place shown even at 0), and IntegerReverse never
// recognised a numeral system in its base slot at all (silently defaulting to base 10).
// Pinned against Wolfram's own IntegerDigits/IntegerReverse documentation examples.
test("MixedRadixNumerals: IntegerDigits drops an unused overflow place, IntegerReverse reads the system", () => {
  expect(value(["IntegerDigits", 571, ["MixedRadixNumerals", L(12, 9, 6)]])).toEqual(L(10, 5, 1));
  expect(value(["IntegerDigits", 534, ["MixedRadixNumerals", L(15, 10, 5)]])).toEqual(L(10, 6, 4));
  expect(value(["IntegerDigits", 1000000, ["MixedRadixNumerals", L(19, 17, 13, 11, 7, 5, 3, 2)]])).toEqual(
    L(1, 16, 3, 9, 6, 1, 2, 0),
  );
  // An overflowing n still shows the (now nonzero) leading place.
  expect(value(["IntegerDigits", 93784, ["MixedRadixNumerals", L(24, 60, 60)]])).toEqual(L(1, 2, 3, 4));
  expect(value(["IntegerReverse", 1024, ["MixedRadixNumerals", L(6, 4, 2)]])).toBe(25);
});

// Regression for a CI break in #492: routing the base slot through `systemOf` dropped
// `broadcastable: true` from IntegerReverse's declare, so the plain one-arg listable form
// (no base given, threaded over a list of integers) stopped threading and answered an Error
// per element instead of reversing each integer's own decimal digits.
test("IntegerReverse(list) still threads over a list with no base argument", () => {
  expect(value(["IntegerReverse", L(12, 345)])).toEqual(L(21, 543));
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
  expect(Object.keys(ARGS).toSorted()).toEqual(Object.keys(NUMERAL_ALIASES).toSorted());
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
  // k big enough is the plain digit sum — see DigitSum's pinned examples for the values.
  expect(value(["DigitSum", 6345354, 10, 7])).toEqual(value(["DigitSum", 6345354, 10]));
  // The two-argument form is untouched.
  const bare = bareEngine();
  expect(value(["DigitSum", 58127, 2])).toEqual(bare.box(["DigitSum", 58127, 2]).evaluate().json);
});
