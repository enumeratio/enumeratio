import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareNumerals } from "../src/declare.ts";

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
  expect(value(["IntegerDigits", 93784, ["MixedRadix", L(24, 60, 60)]])).toEqual(L(1, 2, 3, 4));
  expect(value(["FromDigits", L(1, 2, 3, 4), ["MixedRadix", L(24, 60, 60)]])).toBe(93784);
});

test("factoradic digits are the Lehmer code", () => {
  expect(value(["IntegerDigits", 5, "Factoradic"])).toEqual(L(2, 1, 0));
  expect(value(["IntegerDigits", 463, "Factoradic"])).toEqual(L(3, 4, 1, 0, 1, 0));
  expect(value(["FromDigits", L(3, 4, 1, 0, 1, 0), "Factoradic"])).toBe(463);
});

test("padding lines the factoradic digits up with a Lehmer code", () => {
  // 5 is 0·3! + 2·2! + 1·1! + 0·0!, and the Lehmer code of the 6th permutation of four
  // things needs one digit per position — so the padded width is what makes them equal.
  expect(value(["IntegerDigits", 5, "Factoradic", 4])).toEqual(L(0, 2, 1, 0));
  expect(value(["FromDigits", L(0, 2, 1, 0), "Factoradic"])).toBe(5);
  expect(value(["IntegerDigits", 10, 2, 8])).toEqual(
    new ComputeEngine().box(["IntegerDigits", 10, 2, 8]).evaluate().json,
  );
});

test("Zeckendorf, and the forbidden pattern", () => {
  expect(value(["IntegerDigits", 100, "Zeckendorf"])).toEqual(L(1, 0, 0, 0, 0, 1, 0, 1, 0, 0));
  expect(value(["FromDigits", L(1, 0, 0, 0, 0, 1, 0, 1, 0, 0), "Zeckendorf"])).toBe(100);
  // Two adjacent ones is not a numeral, so it denotes nothing.
  expect(ce.box(["FromDigits", L(1, 1), "Zeckendorf"]).evaluate().operator).toBe("FromDigits");
});

test("signless systems represent negatives", () => {
  expect(value(["IntegerDigits", 5, ["BalancedRadix", 3]])).toEqual(L(1, -1, -1));
  expect(value(["IntegerDigits", -5, ["BalancedRadix", 3]])).toEqual(L(-1, 1, 1));
  expect(value(["FromDigits", L(-1, 1, 1), ["BalancedRadix", 3]])).toBe(-5);
  expect(value(["IntegerDigits", 3, ["NegativeRadix", 2]])).toEqual(L(1, 1, 1)); // 4 − 2 + 1
  expect(value(["IntegerDigits", -2, ["NegativeRadix", 2]])).toEqual(L(1, 0));
  // compute-engine's own fixed radix drops the sign; these systems do not need one.
  expect(value(["IntegerDigits", -5, 2])).toEqual(L(1, 0, 1));
});

test("bijective base 26 has no zero digit", () => {
  expect(value(["IntegerDigits", 27, ["BijectiveRadix", 26]])).toEqual(L(1, 1)); // AA
  expect(value(["IntegerDigits", 702, ["BijectiveRadix", 26]])).toEqual(L(26, 26)); // ZZ
  // Zero is the EMPTY numeral, which is what makes the system bijective — there is one
  // string over {1…26} per non-negative integer, and the empty one belongs to zero.
  expect(value(["IntegerDigits", 0, ["BijectiveRadix", 26]])).toEqual(L());
  expect(value(["FromDigits", L(), ["BijectiveRadix", 26]])).toBe(0);
});

test("residue systems, and where they stop being a numeral system", () => {
  expect(value(["IntegerDigits", 23, ["ResidueSystem", L(3, 5, 7)]])).toEqual(L(2, 3, 2));
  expect(value(["FromDigits", L(2, 3, 2), ["ResidueSystem", L(3, 5, 7)]])).toBe(23);
  // Past the product there is no numeral.
  expect(ce.box(["IntegerDigits", 105, ["ResidueSystem", L(3, 5, 7)]]).evaluate().operator).toBe(
    "IntegerDigits",
  );
  // Non-coprime moduli: an inconsistent digit string denotes nothing.
  expect(ce.box(["FromDigits", L(1, 2), ["ResidueSystem", L(4, 6)]]).evaluate().operator).toBe(
    "FromDigits",
  );
});

test("the combinatorial system and the primorial base", () => {
  expect(value(["IntegerDigits", 0, ["CombinatorialSystem", 3]])).toEqual(L(2, 1, 0));
  expect(value(["FromDigits", L(3, 2, 1), ["CombinatorialSystem", 3]])).toBe(3);
  expect(value(["IntegerDigits", 30, "PrimorialRadix"])).toEqual(L(1, 0, 0, 0));
});

test("systems describe their own digit shape", () => {
  expect(value(["NumeralSystemShape", "Zeckendorf"])).toContain("no two adjacent ones");
  expect(value(["NumeralSystemShape", ["ResidueSystem", L(4, 6)]])).toContain(
    "NOT pairwise coprime",
  );
  expect(value(["NumeralSystemShape", ["BijectiveRadix", 26]])).toContain("EMPTY numeral");
});

test("an unreadable system leaves the call alone", () => {
  expect(ce.box(["IntegerDigits", 10, ["BalancedRadix", 4]]).evaluate().operator).toBe(
    "IntegerDigits",
  ); // even base
  expect(ce.box(["IntegerDigits", 10, "NotASystem"]).evaluate().operator).toBe("IntegerDigits");
});

test("Ostrowski takes a continued fraction in the base slot", () => {
  const golden: Expr = ["Ostrowski", L(1, 1, 1, 1, 1, 1, 1, 1)];
  // 12 = 8 + 3 + 1, over the convergent denominators 21, 13, 8, 5, 3, 2, 1, 1.
  expect(value(["IntegerDigits", 12, golden])).toEqual(L(0, 0, 1, 0, 1, 0, 1, 0));
  expect(value(["FromDigits", L(0, 0, 1, 0, 1, 0, 1, 0), golden])).toBe(12);
  // Its digits are Zeckendorf's, less the forced lowest zero and the leading zeros.
  expect(value(["IntegerDigits", 12, "Zeckendorf"])).toEqual(L(1, 0, 1, 0, 1));
  expect(value(["IntegerDigits", 9, ["Ostrowski", L(2, 2, 2)]])).toEqual(L(1, 2, 0));
  expect(value(["NumeralSystemShape", ["Ostrowski", L(2, 2, 2)]])).toContain("ceiling");
});

test("Ostrowski declines a string its ceiling rule forbids", () => {
  // The middle digit is at its ceiling, so nothing below it may be non-zero.
  expect(ce.box(["FromDigits", L(1, 2, 1), ["Ostrowski", L(2, 2, 2)]]).evaluate().operator).toBe(
    "FromDigits",
  );
  expect(ce.box(["IntegerDigits", 12, ["Ostrowski", L(2, 2, 2)]]).evaluate().operator).toBe(
    "IntegerDigits",
  ); // out of range: q₃ = 12
});
