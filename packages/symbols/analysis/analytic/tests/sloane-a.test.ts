import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";
import { landauFunction } from "../src/sloane-a.ts";

// SloaneA(id, n) — see sloane-a.ts for the scope (the specific OEIS ids Fungrim's own
// SloaneA identities cite) and why A060691 is left undeclared. Every value below is a
// well-known OEIS term, not an oracle call — these sequences don't need one.

const ce = new ComputeEngine();
declareAnalytic(ce);

const sloaneA = (id: string, n: number): number => ce.box(["SloaneA", `'${id}'`, n]).N().re;

test("fungrim:373aa1 — A000045 is Fibonacci", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => sloaneA("A000045", n))).toEqual([0, 1, 1, 2, 3, 5, 8, 13, 21, 34]);
});

test("fungrim:9d0839 — A000040 is the n-th prime, 1-indexed", () => {
  expect([1, 2, 3, 4, 5].map((n) => sloaneA("A000040", n))).toEqual([2, 3, 5, 7, 11]);
});

test("fungrim:4fa169 — A000720 is the prime-counting function", () => {
  expect([0, 1, 2, 10, 20].map((n) => sloaneA("A000720", n))).toEqual([0, 0, 1, 4, 8]);
});

test("fungrim:8eed2c — A000041 is the partition function", () => {
  expect([0, 1, 2, 3, 4, 5, 10].map((n) => sloaneA("A000041", n))).toEqual([1, 1, 2, 3, 5, 7, 42]);
});

test("fungrim:60dc3e — A000110 is the Bell numbers", () => {
  expect([0, 1, 2, 3, 4, 5].map((n) => sloaneA("A000110", n))).toEqual([1, 1, 2, 5, 15, 52]);
});

test("fungrim:d12aa0 — A000142 is the factorials", () => {
  expect([0, 1, 2, 3, 4, 5].map((n) => sloaneA("A000142", n))).toEqual([1, 1, 2, 6, 24, 120]);
});

test("fungrim:b6111c — A027641/A027642 are BernoulliB's numerator/denominator", () => {
  for (const n of [0, 1, 2, 3, 4, 5, 6, 12]) {
    const b = ce.box(["BernoulliB", n]).N();
    expect(sloaneA("A027641", n)).toBe(b.numerator.re);
    expect(sloaneA("A027642", n)).toBe(b.denominator.re);
  }
});

test("fungrim:6af603 — A000793 is Landau's function g(n)", () => {
  // OEIS A000793, offset 0.
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => sloaneA("A000793", n))).toEqual([
    1, 1, 2, 3, 4, 6, 6, 12, 15, 20, 30,
  ]);
  expect(landauFunction(15)).toBe(105);
});

test("declines an OEIS id it does not carry, e.g. A060691", () => {
  expect(ce.box(["SloaneA", "'A060691'", 5]).N().operator).toBe("SloaneA");
});
