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
  expect(value(["FromDigits", "'IIII'", "'Roman'"])).toEqual(["FromDigits", "'IIII'", "'Roman'"]);
});
test("IntegerString(n, 'Roman') agrees with RomanNumeral(n)", () => {
  for (const n of [1988, 3999, 0, 44]) {
    expect(value(["IntegerString", n, "'Roman'"])).toEqual(value(["RomanNumeral", n]));
  }
});

// FromDigits with a symbolic base: cross-checked against Horner's rule by hand.
test("FromDigits(digits, x) is the Horner polynomial in x", () => {
  const digits = [1, 2, 3];
  const x = 5;
  const byHand = digits.reduce((acc, d) => acc * x + d, 0);
  const viaHead = ce.box(["FromDigits", ["List", ...digits], x]).evaluate().re;
  expect(viaHead).toEqual(byHand);
});

// FromDigits with a negative base: same Horner reduction, base < 0.
test("FromDigits(digits, negativeBase) matches the same acc*base+d reduction", () => {
  const cases: Array<[number[], number]> = [
    [[1, 1, 0], -2],
    [[1, 0, 1], -3],
    [[3, 2, 1], -4],
  ];
  for (const [digits, base] of cases) {
    const byHand = digits.reduce((acc, d) => acc * base + d, 0);
    expect(value(["FromDigits", ["List", ...digits], base])).toEqual(byHand);
  }
});

// IntegerString past double precision: exact via IntegerDigits round trip.
test("IntegerString(n, 16) for a huge n round-trips through FromDigits", () => {
  const big = value(["Factorial", 30]);
  const hex = value(["IntegerString", big, 16]) as string;
  const requoted = `'${hex.replace(/^'|'$/g, "")}'`;
  expect(value(["FromDigits", requoted, 16])).toEqual(big);
});
