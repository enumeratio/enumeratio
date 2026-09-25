import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// ─── Rationalize(x, 0) ──────────────────────────────────────────────────────────────

// Independent cross-check: the returned p/q must equal x bit-for-bit when converted back
// to a double, and its denominator must be a power of 2 (every double is dyadic).
test("Rationalize(x, 0) is the exact dyadic rational a double denotes", () => {
  for (const x of [0.1, 0.5, 2.5, -0.125, 1 / 3, Math.PI, 6.75]) {
    const json = run(["Rationalize", x, 0]);
    // An integer past 2^53 serialises as {num: "…"}; read either form exactly.
    const int = (j: unknown): bigint =>
      BigInt(typeof j === "object" && j !== null ? (j as { num: string }).num : (j as number));
    const [p, q] =
      Array.isArray(json) && json[0] === "Rational"
        ? [int(json[1]), int(json[2])]
        : [int(json), 1n];
    expect(Number(p) / Number(q)).toBe(x);
    expect((q & (q - 1n)) === 0n, `denominator ${q} should be a power of 2`).toBe(true);
  }
});

test("Rationalize(2, 0) returns the exact integer unchanged", () => {
  expect(run(["Rationalize", 2, 0])).toBe(2);
});

test("Rationalize(x, dx) with dx > 0 still routes to a tolerance search, not the exact form", () => {
  // 0.1's exact dyadic value has a huge denominator; with a generous tolerance the
  // simplest-rational search should find 1/10 instead.
  expect(run(["Rationalize", 0.1, 0.01])).toEqual(["Rational", 1, 10]);
});

// ─── Floor/Ceil/Round of a Complex number ──────────────────────────────────────────

test("Floor/Ceil/Round of a Complex number round the real and imaginary parts separately", () => {
  expect(run(["Floor", ["Complex", 5.37, -1.3]])).toEqual(["Complex", 5, -2]);
  expect(run(["Ceil", ["Complex", 5.37, -1.3]])).toEqual(["Complex", 6, -1]);
  expect(run(["Round", ["Complex", 5.37, -1.3]])).toEqual(["Complex", 5, -1]);
});

test("Floor/Ceil/Round of a real number are untouched by the Complex wrapper", () => {
  expect(run(["Floor", 3.7])).toBe(3);
  expect(run(["Ceil", 3.7])).toBe(4);
  expect(run(["Round", 3.7])).toBe(4);
});

// ─── Sign of an exact numeric expression ───────────────────────────────────────────

test("Sign decides an exact radical expression's sign by certified bignum evaluation", () => {
  expect(run(["Sign", ["Subtract", ["Sqrt", 2], 2]])).toBe(-1);
  expect(run(["Sign", ["Subtract", 2, ["Sqrt", 2]]])).toBe(1);
});

test("Sign of a plain number is untouched by the exact-expression wrapper", () => {
  expect(run(["Sign", -3])).toBe(-1);
  expect(run(["Sign", 0])).toBe(0);
  expect(run(["Sign", 3])).toBe(1);
});
