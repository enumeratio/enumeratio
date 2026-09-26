// Binary-GCD override for real-integer GCD calls through the engine (declare-fast-gcd.ts,
// issue #205). Unit coverage of the binary-GCD algorithm itself lives in
// packages/symbols/arithmetic/residues/tests/gcd.test.ts; this file is the engine wiring,
// including that Gaussian-integer GCD (declare-gaussian.ts) is untouched.
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";

const ce = new ComputeEngine();
declareResidues(ce);
declareNumberTheory(ce);
const run = (expr: unknown): unknown => ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

test("GCD of real integers through the engine, including negatives, 0 and a single argument", () => {
  expect(run(["GCD", 12, 18])).toBe(6);
  expect(run(["GCD", -12, 18])).toBe(6);
  expect(run(["GCD", 0, 5])).toBe(5);
  expect(run(["GCD", 5])).toBe(5);
  expect(run(["GCD", -5])).toBe(5);
  expect(run(["GCD", 12, 18, 30])).toBe(6);
});

test("GCD of two large (10000-bit-scale) integers is exact", () => {
  const shared = 2n ** 500n + 12345n;
  const a = { num: String(shared * 7n) };
  const b = { num: String(shared * 11n) };
  expect(run(["GCD", a, b])).toEqual({ num: shared.toString() });
});

test("GCD is exact either side of the Lehmer/Stein hybrid threshold", () => {
  // Below LEHMER_THRESHOLD_BITS (Stein's binary GCD).
  const smallShared = 2n ** 300n + 7n;
  expect(run(["GCD", { num: String(smallShared * 13n) }, { num: String(smallShared * 17n) }])).toEqual({
    num: smallShared.toString(),
  });
  // Well above it (Lehmer's algorithm) -- the bench's 10000-bit pair, at 10000 bits.
  const bigShared = 2n ** 9990n + 91n;
  expect(run(["GCD", { num: String(bigShared * 19n) }, { num: String(bigShared * 23n) }])).toEqual({
    num: bigShared.toString(),
  });
});

test("a genuinely Gaussian GCD call is unaffected", () => {
  const c = (re: number, im: number): unknown => ["Complex", re, im];
  // gcd(3+i, 1+3i) in Z[i]: the point isn't the specific associate, just that the call
  // still evaluates as a Gaussian integer, not a real one.
  const result = ce.box(["GCD", c(3, 1), c(1, 3)] as Parameters<ComputeEngine["box"]>[0]).evaluate();
  expect(result.operator).toBe("Complex");
});
