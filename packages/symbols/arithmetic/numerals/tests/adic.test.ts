import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { stringAt } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { invMod, mod } from "@enumeratio/residues";
import * as adic from "../src/adic.ts";
import { declareNumerals } from "../src/declare.ts";

const ce = new ComputeEngine();
declareNumerals(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const value = (input: Expr) => ce.box(input).evaluate().json;
const text = (input: Expr) => stringAt(ce.box(input).evaluate());
const A = (b: number, x: Expr, prec?: number): Expr =>
  prec === undefined ? ["AdicNumeral", b, x] : ["AdicNumeral", b, x, prec];
const Q = (n: number, d: number): Expr => ["Rational", n, d];
const L = (...xs: number[]): Expr => ["List", ...xs];

// ── pinned against Sage (prime p) ────────────────────────────────────────────

// Regenerate with `node scripts/collect-adic-golden.ts` (requires sage on PATH).
const GOLDEN = fileURLToPath(new URL("./adic.golden.json", import.meta.url));
const golden: {
  expansions: { p: number; x: string; digits: number[]; valuation: number | null }[];
  sqrts: { p: number; x: number; root: string | null }[];
  products: { p: number; x: string; y: string; value: string }[];
} = JSON.parse(readFileSync(GOLDEN, "utf8"));

const PREC = 12;
const parseRational = (s: string): [bigint, bigint] => {
  const [n, d = "1"] = s.split("/");
  return [BigInt(n!), BigInt(d)];
};

test("expansions and valuations match Sage's Qp", () => {
  for (const c of golden.expansions) {
    const x = adic.exact(BigInt(c.p), ...parseRational(c.x))!;
    const ours = adic.expansion(x, PREC);
    expect(ours.digits, `${c.p}-adic ${c.x}`).toEqual(c.digits);
    if (c.valuation !== null) expect(ours.start, `v_${c.p}(${c.x})`).toBe(c.valuation);
  }
});

test("square roots match Sage's Zp (up to sign) and decline where Sage does", () => {
  for (const c of golden.sqrts) {
    const root = adic.sqrt(adic.exact(BigInt(c.p), BigInt(c.x), 1n)!, PREC);
    if (c.root === null) {
      expect(root, `sqrt(${c.x}) in Z_${c.p}`).toBeUndefined();
      continue;
    }
    const candidates = [root?.num.toString(), adic.negate(root!)?.num.toString()];
    expect(candidates, `sqrt(${c.x}) in Z_${c.p}`).toContain(c.root);
  }
});

test("products at fixed precision match Sage's representatives", () => {
  for (const c of golden.products) {
    const x = adic.capped(BigInt(c.p), ...parseRational(c.x), PREC)!;
    const y = adic.capped(BigInt(c.p), ...parseRational(c.y), PREC)!;
    const z = adic.multiply(x, y)!;
    // Sage's `lift()` is the representative of the unit part times p^v, as a rational
    // when v < 0. Compare modulo p^(absolute precision) on the integer side.
    const [num, den] = parseRational(c.value);
    const modulus = adic.pow(BigInt(c.p), z.prec!);
    const sage = mod(num * (invMod(den, modulus) ?? 1n), modulus);
    const ours = mod(z.num * (invMod(z.den, modulus) ?? 1n), modulus);
    expect(ours, `${c.x} · ${c.y} in Q_${c.p}`).toBe(sage);
  }
});

// ── composite bases, pinned by their algebra ─────────────────────────────────

test("Z_10 has zero divisors: the two idempotents multiply to zero", () => {
  const e = value(["HenselLift", ["Subtract", ["Power", "x", 2], "x"], 5, 10, 8]);
  const f = value(["HenselLift", ["Subtract", ["Power", "x", 2], "x"], 6, 10, 8]);
  expect(e).toEqual(A(10, 12890625, 8));
  expect(f).toEqual(A(10, 87109376, 8));
  expect(value(["Multiply", e as Expr, f as Expr])).toEqual(A(10, 0, 8));
  expect(value(["Add", e as Expr, f as Expr])).toEqual(A(10, 1, 8));
  expect(value(["Power", e as Expr, 2])).toEqual(e);
});

test("Z_10: 1/3 exists and inverts, 1/2 does not, and there is no 10-adic field", () => {
  expect(value(["Multiply", A(10, Q(1, 3)), 3])).toEqual(A(10, 1));
  expect(text(["AdicExpansion", A(10, Q(1, 3)), 8])).toBe("…66666667");
  expect(value(A(10, Q(1, 2)))).toEqual(A(10, Q(1, 2))); // declined: stays as written
  expect(value(["Divide", A(10, 3), 2])).toEqual(["Multiply", Q(1, 2), A(10, 3)]);
  // A prime base gives the field: dividing by p just moves the point.
  expect(value(["Divide", A(5, 3), 5])).toEqual(A(5, Q(3, 5)));
  expect(value(["AdicValuation", A(5, Q(3, 25))])).toBe(-2);
  expect(text(["AdicExpansion", A(5, Q(7, 25)), 8])).toBe("0.12");
});

test("HenselLift needs a simple root: x³ − x from 1 in Z_2 has f′(1) = 2, not a unit", () => {
  expect(value(["HenselLift", ["Subtract", ["Power", "x", 3], "x"], 1, 2, 6])).toEqual([
    "HenselLift",
    ["Add", ["Power", "x", 3], ["Negate", "x"]],
    1,
    2,
    6,
  ]);
  expect(value(["HenselLift", ["Subtract", ["Power", "x", 2], 2], 3, 7, 6])).toEqual(value(["AdicSqrt", A(7, 2), 6]));
});

test("arithmetic through the engine: exact stays exact, capped caps at the weakest operand", () => {
  expect(value(["Add", A(10, Q(1, 3)), 2])).toEqual(A(10, Q(7, 3)));
  expect(value(["Subtract", A(10, 2), 5])).toEqual(A(10, -3));
  expect(value(["Negate", A(10, 2)])).toEqual(A(10, -2));
  expect(value(["Power", A(10, 2), 10])).toEqual(A(10, 1024));
  expect(value(["Power", A(10, 3), -1])).toEqual(A(10, Q(1, 3)));
  expect(value(["Add", A(10, Q(1, 3), 8), A(10, Q(1, 3), 5)])).toEqual(A(10, 33334, 5));
  // Multiplying by p^2 raises absolute precision by 2 — the O-term scales too.
  expect(value(["Multiply", A(5, 3, 6), 25])).toEqual(A(5, 75, 8));
  // Different bases never combine.
  expect(value(["Add", A(7, 2), A(5, 2)])).toEqual(["Add", A(7, 2), A(5, 2)]);
});

test("valuation, norm and unit part", () => {
  expect(value(["AdicValuation", A(5, 75)])).toBe(2);
  expect(value(["AdicNorm", A(5, 75)])).toEqual(Q(1, 25));
  expect(value(["AdicNorm", A(5, Q(3, 25))])).toBe(25);
  expect(value(["AdicUnitPart", A(5, 75)])).toEqual(A(5, 3));
  expect(value(["AdicValuation", A(10, 0)])).toBe("PositiveInfinity");
  // A capped zero is O(b^prec): its valuation is the precision.
  expect(value(["AdicValuation", A(10, 0, 8)])).toBe(8);
});

test("digits run least significant first; the expansion prints with the infinite end marked", () => {
  expect(value(["AdicDigits", A(10, Q(1, 3)), 6])).toEqual(L(7, 6, 6, 6, 6, 6));
  expect(value(["AdicDigits", A(10, -1), 4])).toEqual(L(9, 9, 9, 9));
  expect(text(["AdicExpansion", A(10, 42)])).toBe("42");
  expect(text(["AdicExpansion", A(10, -1), 6])).toBe("…999999");
  expect(text(["AdicExpansion", A(2, Q(1, 3)), 8])).toBe("…10101011");
  expect(text(["AdicExpansion", A(10, Q(1, 3), 8)])).toBe("…66666667 + O(10^8)");
  expect(text(["AdicExpansion", A(16, -1), 3])).toBe("…[15][15][15]");
});

// ── the digit-slot system ────────────────────────────────────────────────────

test("AdicNumerals in the base slot: non-negatives are plain radix, negatives are truncations", () => {
  expect(value(["IntegerDigits", 42, ["AdicNumerals", 10, 4]])).toEqual(L(0, 0, 4, 2));
  expect(value(["IntegerDigits", -3, ["AdicNumerals", 10, 6]])).toEqual(L(9, 9, 9, 9, 9, 7));
  expect(value(["IntegerDigits", -1, ["AdicNumerals", 2, 5]])).toEqual(L(1, 1, 1, 1, 1));
  expect(value(["FromDigits", L(9, 9, 9, 9, 9, 7), ["AdicNumerals", 10]])).toBe(-3);
  expect(value(["FromDigits", L(0, 0, 4, 2), ["AdicNumerals", 10]])).toBe(42);
  // 7 does not fit two 10-adic digits read nearest zero: [0, 7] would read back as 7,
  // but [7] alone is −3. The width is part of the numeral.
  expect(value(["FromDigits", L(7), ["AdicNumerals", 10]])).toBe(-3);
  // Round trip over a range that includes negatives, which fixed radix cannot spell.
  for (let n = -300; n <= 300; n += 7) {
    const digits = value(["IntegerDigits", n, ["AdicNumerals", 7, 8]]) as Expr;
    expect(value(["FromDigits", digits, ["AdicNumerals", 7, 8]]), String(n)).toBe(n);
  }
});

test("where the systems agree and differ on the same integers", () => {
  // ℕ: adic digits ARE the positional digits, behind the leading zeros of the fixed width.
  for (const n of [0, 1, 9, 10, 255, 1000]) {
    expect(value(["IntegerDigits", n, ["AdicNumerals", 10, 6]])).toEqual(value(["IntegerDigits", n, 10, 6]));
  }
  // A residue system with moduli p^k is the b-adic truncation read mod each p^k: for
  // 10^4 = 2^4 · 5^4, the last four adic digits of n determine (n mod 16, n mod 625).
  for (const n of [3, 42, 1234, 4999]) {
    const digits = value(["IntegerDigits", n, ["AdicNumerals", 10, 4]]) as Expr;
    const truncated = value(["FromDigits", digits, 10]) as number;
    expect(value(["IntegerDigits", n, ["ResidueNumerals", L(16, 625)]])).toEqual(L(truncated % 16, truncated % 625));
  }
});
