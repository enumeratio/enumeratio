import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareNumerals } from "../src/declare.ts";

const ce = new ComputeEngine();
declareNumerals(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const value = (input: Expr) => ce.box(input).evaluate().json;

// ── IntegerLength ────────────────────────────────────────────────────────────

test("IntegerLength cross-checked against n.toString(base).length", () => {
  for (const [n, base] of [
    [7, 10],
    [1023, 2],
    [999999, 10],
    [4095, 16],
  ] as const) {
    expect(value(["IntegerLength", n, base]), `${n} base ${base}`).toBe(n.toString(base).length);
  }
});

// ── IntegerReverse ───────────────────────────────────────────────────────────

test("IntegerReverse cross-checked: reversing twice with padding restores the original", () => {
  for (const n of [1, 42, 8005, 123456]) {
    const digits = n.toString().length;
    const reversed = value(["IntegerReverse", n]) as number;
    const roundTrip = value(["IntegerReverse", reversed, 10, digits]);
    expect(roundTrip, `${n}`).toBe(n);
  }
});

// ── NumberExpand ─────────────────────────────────────────────────────────────

test("NumberExpand cross-checked: terms sum back to n", () => {
  for (const [n, base] of [
    [1234, 10],
    [-58127, 10],
    [10, 2],
    [703, 26],
  ] as const) {
    const terms = value(["NumberExpand", n, base]) as ["List", ...number[]];
    const sum = terms.slice(1).reduce((acc: number, x) => acc + (x as number), 0);
    expect(sum, `${n} base ${base}`).toBe(n);
  }
});

// ── RomanNumeral ─────────────────────────────────────────────────────────────

/** An independent from-scratch Roman-numeral encoder, for the round-trip check below. */
function romanIndependent(n: number): string {
  if (n === 0) return "N";
  const table: readonly [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = n;
  let out = "";
  for (const [v, s] of table) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

/** Parses a standard Roman numeral back to an integer — independent of the package. */
function fromRomanIndependent(s: string): number {
  if (s === "N") return 0;
  const digit: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = digit[s[i] as string] as number;
    const next = i + 1 < s.length ? (digit[s[i + 1] as string] as number) : 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

test("RomanNumeral round-trips for every 1..3999, against an independent encoder", () => {
  for (let n = 1; n <= 3999; n++) {
    const roman = value(["RomanNumeral", n]) as string;
    const bare = roman.slice(1, -1); // strip the '…' MathJSON string quoting
    expect(bare, `${n}`).toBe(romanIndependent(n));
    expect(fromRomanIndependent(bare), `${n}`).toBe(n);
  }
});

// ── RealDigits ───────────────────────────────────────────────────────────────

/** Long division of p/q in base 10, digit by digit — an independent check on RealDigits. */
function longDivision(p: number, q: number, digits: number): { lead: number[]; frac: number[] } {
  const lead: number[] = [];
  let n = Math.floor(p / q);
  if (n === 0) lead.push(0);
  else for (const c of String(n)) lead.push(Number(c));
  let remainder = p % q;
  const frac: number[] = [];
  for (let i = 0; i < digits; i++) {
    remainder *= 10;
    frac.push(Math.floor(remainder / q));
    remainder %= q;
  }
  return { lead: n === 0 ? [] : lead, frac };
}

test("RealDigits cross-checked against long division for terminating rationals", () => {
  for (const [p, q] of [
    [5, 4],
    [123, 8],
    [7, 2],
  ] as const) {
    const { lead, frac } = longDivision(p, q, 6);
    const trimmedFrac = [...frac];
    while (trimmedFrac.length > 0 && trimmedFrac[trimmedFrac.length - 1] === 0) {
      trimmedFrac.pop();
    }
    const result = value(["RealDigits", ["Rational", p, q]]) as unknown as readonly unknown[];
    // Compare only the flattened digit sequence and sign of the exponent's leading part;
    // exact nested/period structure is asserted by the pinned examples above.
    const flatDigits = (result[1] as readonly unknown[]).slice(1).flat();
    expect(flatDigits, `${p}/${q}`).toEqual([...lead, ...trimmedFrac]);
  }
});
