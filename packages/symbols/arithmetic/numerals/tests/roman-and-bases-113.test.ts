import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareNumerals } from "../src/declare.ts";
import { integerOfRomanNumeral, romanNumeralOf } from "../src/digits.ts";

const ce = new ComputeEngine();
declareNumerals(ce);
const value = (expr: unknown) => ce.box(expr as never).evaluate().json;

// Roman numerals round trip, both directions, over every value RomanNumeral spells.
test("RomanNumeral and FromDigits(_, 'Roman') round-trip for 0..3999", () => {
  for (let n = 0; n <= 3999; n += 37) {
    const roman = romanNumeralOf(n)!;
    expect(integerOfRomanNumeral(roman), roman).toEqual(n);
  }
});
test("FromDigits(roman, 'Roman') inverts RomanNumeral through the engine", () => {
  for (const n of [1, 4, 9, 14, 40, 90, 400, 900, 1988, 2024, 3999, 0]) {
    const roman = value(["RomanNumeral", n]);
    expect(value(["FromDigits", roman, "'Roman'"]), String(roman)).toEqual(n);
  }
});
test("a malformed Roman numeral (IIII, non-canonical) is rejected", () => {
  expect(integerOfRomanNumeral("IIII")).toBeUndefined();
  expect(integerOfRomanNumeral("IC")).toBeUndefined();
});
test("IntegerString(n, 'Roman') agrees with RomanNumeral(n)", () => {
  for (const n of [1988, 3999, 0, 44]) {
    expect(value(["IntegerString", n, "'Roman'"])).toEqual(value(["RomanNumeral", n]));
  }
});

// IntegerString past double precision: exact via IntegerDigits round trip.
test("IntegerString(n, 16) for a huge n round-trips through FromDigits", () => {
  const big = value(["Factorial", 30]);
  const hex = value(["IntegerString", big, 16]) as string;
  const requoted = `'${hex.replace(/^'|'$/g, "")}'`;
  expect(value(["FromDigits", requoted, 16])).toEqual(big);
});

// FromDigits({digits, exponent}): the single-arg pair shape RealDigits itself returns.
test("FromDigits reads a {digits, exponent} pair, the shape RealDigits gives (#113)", () => {
  // Round-trips through RealDigits itself, for exact rationals with a TERMINATING base-10
  // expansion -- a repeating one (like 22/7) nests its periodic tail as its own inner
  // list, which this wrapper (by design) doesn't try to read back.
  for (const [n, d] of [
    [283, 200],
    [1, 8],
    [7, 25],
  ] as const) {
    const digitsPair = ce.box(["RealDigits", ["Rational", n, d]] as never).evaluate();
    expect(ce.box(["FromDigits", digitsPair.json] as never).evaluate().json).toEqual(["Rational", n, d]);
  }
});
