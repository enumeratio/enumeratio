// Binary GCD (issue #205): exact against a plain Euclidean reference, including 0, negative
// operands and equal operands -- the shapes Stein's algorithm has to fold in on top of
// ordinary Euclid.
import { expect, test } from "vite-plus/test";
import { gcd } from "../src/arith.ts";

function euclidGcd(a: bigint, b: bigint): bigint {
  let [x, y] = [a < 0n ? -a : a, b < 0n ? -b : b];
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

test("gcd agrees with plain Euclid over a range including 0, negatives and equal operands", () => {
  for (let a = -20n; a <= 20n; a++) {
    for (let b = -20n; b <= 20n; b++) {
      expect(gcd(a, b)).toBe(euclidGcd(a, b));
    }
  }
});

test("gcd agrees with plain Euclid on random large (10000-bit-scale) operands", () => {
  const rng = (seed: number) => {
    let s = seed;
    return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  };
  const next = rng(205);
  const randomBits = (bits: number): bigint => {
    let n = 1n;
    for (let i = 0; i < bits; i++) n = (n << 1n) | (next() < 0.5 ? 0n : 1n);
    return n;
  };
  for (let trial = 0; trial < 20; trial++) {
    const a = randomBits(1000);
    const b = randomBits(1000);
    expect(gcd(a, b)).toBe(euclidGcd(a, b));
  }
  // A pair sharing a large common factor -- exercises the shift-heavy path past the point
  // the two operands agree.
  const shared = 2n ** 500n + 12345n;
  expect(gcd(shared * 7n, shared * 11n)).toBe(shared);
});
