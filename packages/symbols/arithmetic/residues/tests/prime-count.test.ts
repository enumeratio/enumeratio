// The combinatorial π(x) (prime-count.ts) against the sieve and Lucy_Hedgehog tiers of
// primeCountUpTo where they overlap, and against published values past them. The standard run
// holds fixed cases at 10^12–10^13; DEEP_TESTS adds a wider cross-check and 10^14 … 10^17.
import { expect, test } from "vite-plus/test";
import { PRIME_COUNT_LIMIT, PRIME_COUNT_MAX, primeCount, primeCountDR } from "../src/prime-count.ts";
import { primeCountUpTo } from "../src/sieve.ts";

const deep = process.env.DEEP_TESTS === "1";

/** Deterministic samples: a fixed LCG, so a failure names the same x every run. */
function sampler(seed: number): () => number {
  let state = seed;
  return () => (state = (Math.imul(state, 1103515245) + 12345) >>> 0) / 2 ** 32;
}

test("agrees with the sieve around cubes, squares and primes, across every parameter", () => {
  const xs = [10_000, 10_007, 12_345, 99_999, 100_000, 1_000_003, 1_594_323, 9_938_375, 9_000_000, 20_000_001];
  for (const x of xs) expect(primeCountDR(BigInt(x))).toBe(primeCountUpTo(x));
  // Pre-sieve depth and segment length move the leaf classes; the count stays put.
  const x = 5_000_017;
  const want = primeCountUpTo(x);
  for (const c of [3, 5, 6, 7]) {
    for (const segmentBits of [10, 12, 15]) {
      expect(primeCountDR(BigInt(x), { c, segmentBits, alpha: 3 })).toBe(want);
    }
  }
});

test("agrees with Lucy_Hedgehog at 10^9 – 10^11", () => {
  for (const x of [1_000_000_000, 2_000_000_017, 54_321_987_654, 80_000_000_001]) {
    expect(primeCountDR(BigInt(x))).toBe(primeCountUpTo(x));
  }
});

test("π(10^12) and π(10^13), OEIS A006880", () => {
  expect(primeCountDR(10n ** 12n)).toBe(37607912018);
  expect(primeCountDR(10n ** 13n)).toBe(346065536839);
});

test("π(2^40), a non-power, against Wolfram's PrimePi", () => {
  expect(primeCountDR(2n ** 40n)).toBe(41203088796);
});

test("primeCount answers up to PRIME_COUNT_LIMIT and declines past it, or off the integers", () => {
  expect(primeCount(0)).toBe(0);
  expect(primeCount(5)).toBe(3);
  expect(primeCount(1_000_000)).toBe(78498);
  expect(primeCount(10 ** 12)).toBe(37607912018);
  expect(primeCount(PRIME_COUNT_LIMIT + 1)).toBeUndefined();
  expect(primeCount(-1)).toBeUndefined();
  expect(primeCount(2.5)).toBeUndefined();
});

test("primeCountDR refuses what it cannot count exactly", () => {
  expect(() => primeCountDR(PRIME_COUNT_MAX + 1n)).toThrow(RangeError);
});

test.runIf(deep)(
  "agrees with Lucy_Hedgehog on samples across 10^6 – 10^11, and around every cube root's edge",
  () => {
    const next = sampler(20261009);
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(10 ** (9 + 2 * next()));
      expect(primeCountDR(BigInt(x))).toBe(primeCountUpTo(x));
    }
    // Just below, at and above k^3 and k^2: y³ ≥ x and p ≤ √x sit on the edge there.
    for (const k of [101, 463, 1000, 2154, 4641, 10_000]) {
      for (const x of [k ** 3 - 1, k ** 3, k ** 3 + 1, k ** 2 - 1, k ** 2, k ** 2 + 1]) {
        if (x >= 10_000) expect(primeCountDR(BigInt(x))).toBe(primeCountUpTo(x));
      }
    }
  },
  600_000,
);

// Past 10^13 the references are published tables: OEIS A006880 for the powers, Wolfram's PrimePi
// for the rest. 10^16 and up cross 2^53, where the kernel divides through a double-double.
test.runIf(deep)(
  "π(10^14) … π(10^15), powers and non-powers",
  () => {
    expect(primeCountDR(10n ** 14n)).toBe(3204941750802);
    expect(primeCountDR(10n ** 15n)).toBe(29844570422669);
    expect(primeCountDR(31_415_926_535_897n)).toBe(1045715118501);
    expect(primeCountDR(2n ** 45n)).toBe(1166746786182);
    expect(primeCountDR(123_456_789_012_345n)).toBe(3930144644714);
    expect(primeCountDR(2n ** 49n)).toBe(17094432576778);
    expect(primeCountDR(999_999_999_999_989n)).toBe(29844570422669);
  },
  600_000,
);

test.runIf(deep)(
  "π(10^16) and π(2^53), across 2^53",
  () => {
    expect(primeCountDR(10n ** 16n)).toBe(279238341033925);
    expect(primeCountDR(2n ** 53n)).toBe(252252704148404);
    expect(primeCountDR(2n ** 53n - 1n)).toBe(252252704148404);
  },
  600_000,
);

test.runIf(deep)(
  "π(10^17) and the non-powers 2^55, 2^56, 123456789012345678 past it",
  () => {
    expect(primeCountDR(10n ** 17n)).toBe(2623557157654233);
    expect(primeCountDR(2n ** 55n)).toBe(971269945245201);
    expect(primeCountDR(2n ** 56n)).toBe(1906879381028850);
    expect(primeCountDR(123_456_789_012_345_678n)).toBe(3221138040879199);
  },
  1_800_000,
);
