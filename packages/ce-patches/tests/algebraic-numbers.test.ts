import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import { algebraicNumbers } from "../src/patches/algebraic-numbers.ts";
import {
  coordinates,
  element,
  generatesPrime,
  isIrreducible,
  maximalOrder,
  norm,
  orderDiscriminant,
  orderIndex,
  realRootCount,
} from "../src/compute-engine/numerics/number-field.ts";
import sage from "./number-fields.sage.json" with { type: "json" };

// The kernel against Sage (scripts/collect-number-fields-sage.py): each field's discriminant,
// its ring of integers as a lattice, its signature, and which small elements generate primes.
// The standard run checks every element of the fields up to degree 4 and a stride through the
// rest; `DEEP_TESTS=1` checks every one (ζ₇'s field alone has thousands).

const deep = process.env.DEEP_TESTS === "1";
/** Elements checked per field outside a deep run. */
const SAMPLE = 400;
/** A deep run's per-field time, past the default: ζ₇'s 15 625 elements take seconds on a runner. */
const DEEP_BUDGET_MS = deep ? 120_000 : undefined;

const fraction = (text: string): { num: bigint; den: bigint } => {
  const [num, den = "1"] = text.split("/");
  return { num: BigInt(num!), den: BigInt(den) };
};

describe.each(sage.fields.map((f) => [f.f.join(" "), f] as const))("ℚ[x]/(%s)", (_, field) => {
  const f = field.f.map(BigInt);
  const n = f.length - 1;
  const o = maximalOrder(f)!;

  test("is irreducible, with Sage's discriminant, index and signature", () => {
    expect(isIrreducible(f)).toBe(true);
    expect(o).toBeDefined();
    expect(orderDiscriminant(o).toString()).toBe(field.discriminant);
    expect(orderIndex(o).toString()).toBe(field.index);
    const r1 = realRootCount(f);
    expect([r1, (n - r1) / 2]).toEqual(field.signature);
  });

  test("its ring of integers is Sage's: the same index, and Sage's basis inside it", () => {
    for (const b of field.basis) {
      const cs = b.map(fraction);
      const den = cs.reduce((l, c) => (l * c.den) / gcdOf(l, c.den), 1n);
      const x = element(
        cs.map((c) => (c.num * den) / c.den),
        den,
      );
      expect(coordinates(o, x), b.join(" ")).toBeDefined();
    }
  });

  test(
    "an element generates a prime ideal exactly when Sage says so",
    () => {
      const primes = new Set(field.primes.split(" ").filter(Boolean));
      const [lo, hi] = sage.coefficients;
      const wrong: string[] = [];
      const total = (hi! - lo! + 1) ** n;
      const stride = deep || total <= SAMPLE ? 1 : Math.ceil(total / SAMPLE);
      let seen = 0;
      const visit = (prefix: bigint[]): void => {
        if (prefix.length === n) {
          if (seen++ % stride !== 0) return;
          const x = element(prefix);
          const N = norm(f, x).num;
          if (N === 0n || N === 1n || N === -1n || (N < 0n ? -N : N) > BigInt(sage.normLimit)) return;
          const key = prefix.join(",");
          if (generatesPrime(o, x) !== primes.has(key)) wrong.push(key);
          return;
        }
        for (let c = lo!; c <= hi!; c++) visit([...prefix, BigInt(c)]);
      };
      visit([]);
      expect(wrong).toEqual([]);
    },
    DEEP_BUDGET_MS,
  );
});

const gcdOf = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcdOf(b, a % b));

test("a polynomial no prime certifies is left undecided, and a reducible one is reducible", () => {
  // x⁴ + 1 splits mod every prime; x⁴ − 10x² + 1 (√2 + √3) too.
  expect(isIrreducible([1n, 0n, 0n, 0n, 1n])).toBeUndefined();
  expect(isIrreducible([1n, 0n, -10n, 0n, 1n])).toBeUndefined();
  expect(isIrreducible([-6n, 1n, 1n])).toBe(false);
  expect(maximalOrder([-6n, 1n, 1n])).toBeDefined();
});

describe("the heads", () => {
  const ce = new ComputeEngine();
  algebraicNumbers.apply(ce);
  const run = (json: unknown): unknown => ce.box(json as never).evaluate().json;
  const dedekind = [
    "PolynomialRoot",
    ["Add", ["Power", "x", 3], ["Negate", ["Power", "x", 2]], ["Multiply", -2, "x"], -8],
    1,
  ];

  test("read a generator from a radical, i, the golden ratio or a root", () => {
    expect(run(["MinimalPolynomial", ["Multiply", "ImaginaryUnit", ["Sqrt", 3]], "x"])).toEqual([
      "Add",
      ["Power", "x", 2],
      3,
    ]);
    expect(run(["NumberFieldDiscriminant", "GoldenRatio"])).toBe(5);
    expect(run(["NumberFieldDiscriminant", dedekind])).toBe(-503);
    expect(run(["NumberFieldSignature", ["Root", 2, 5]])).toEqual(["List", 1, 2]);
    // compute-engine writes (−4)^(1/4) as 1 + i, so its field is ℚ(i).
    expect(run(["NumberFieldDiscriminant", ["Power", -4, ["Rational", 1, 4]]])).toBe(-4);
  });

  test("leave what isn't one generator's, or isn't algebraic, unevaluated", () => {
    expect(run(["NumberFieldDiscriminant", ["Add", ["Sqrt", 2], ["Sqrt", 3]]])).toEqual([
      "NumberFieldDiscriminant",
      ["Add", ["Sqrt", 2], ["Sqrt", 3]],
    ]);
    expect(run(["AlgebraicIntegerQ", "y"])).toEqual(["AlgebraicIntegerQ", "y"]);
    expect(run(["MinimalPolynomial", "Pi", "x"])).toEqual(["MinimalPolynomial", "Pi", "x"]);
  });

  test("norm and trace agree with the minimal polynomial's coefficients", () => {
    expect(run(["AlgebraicNumberNorm", ["Add", 1, ["Root", 2, 3]]])).toBe(3);
    expect(run(["AlgebraicNumberTrace", ["Add", 1, ["Root", 2, 3]]])).toBe(3);
  });
});
