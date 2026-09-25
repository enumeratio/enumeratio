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

test("padding a fixed radix agrees with the native handler", () => {
  // 5 is 0·3! + 2·2! + 1·1! + 0·0!, and the Lehmer code of the 6th permutation of four
  // things needs one digit per position — see IntegerDigits' factoradic examples for the
  // pinned padded value; here we only cross-check the native (non-system) padded form.
  expect(value(["IntegerDigits", 10, 2, 8])).toEqual(
    new ComputeEngine().box(["IntegerDigits", 10, 2, 8]).evaluate().json,
  );
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
  // k big enough is the plain digit sum — see DigitSum's pinned examples for the values.
  expect(value(["DigitSum", 6345354, 10, 7])).toEqual(value(["DigitSum", 6345354, 10]));
  // The two-argument form is untouched.
  const bare = new ComputeEngine();
  expect(value(["DigitSum", 58127, 2])).toEqual(bare.box(["DigitSum", 58127, 2]).evaluate().json);
});
