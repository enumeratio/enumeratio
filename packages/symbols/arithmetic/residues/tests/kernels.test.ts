import { expect, test } from "vite-plus/test";
import {
  crtSolve,
  discreteLog,
  factorInteger,
  isPrime,
  multiplicativeOrder,
  powerModList,
  powerModRoots,
  primitiveRootCount,
  primitiveRootList,
  primitiveRoots,
} from "../src/index.ts";

/** Brute force: every x in [0, m) with xʳ ≡ b. Independent of CRT, Hensel and Sylow. */
function scan(b: number, r: number, m: number): bigint[] {
  const found: bigint[] = [];
  const target = BigInt(((b % m) + m) % m);
  for (let x = 0n; x < BigInt(m); x++) if (x ** BigInt(r) % BigInt(m) === target) found.push(x);
  return found;
}

test("roots agree with a scan for every b, r ≤ 6, m ≤ 120", () => {
  for (let m = 1; m <= 120; m++) {
    for (let r = 1; r <= 6; r++) {
      for (let b = 0; b < m; b++) {
        expect(powerModRoots(BigInt(b), BigInt(r), BigInt(m)), `x^${r} ≡ ${b} (mod ${m})`).toEqual(scan(b, r, m));
      }
    }
  }
});

test("roots agree with a scan for large primes past the scanning threshold", () => {
  // p − 1 carries 2, 3 and 5 to several powers, so every Sylow branch is exercised.
  for (const p of [241, 601, 1201, 2161]) {
    for (const r of [2, 3, 4, 5, 6, 8, 12, 15]) {
      for (const b of [1, 2, 3, 7, 10, p - 1]) {
        expect(powerModRoots(BigInt(b), BigInt(r), BigInt(p)), `x^${r} ≡ ${b} (mod ${p})`).toEqual(scan(b, r, p));
      }
    }
  }
  // …and through Hensel, including the singular channels p | r and p | b.
  for (const [b, r, m] of [
    [4, 2, 241 ** 2],
    [0, 2, 67 ** 3],
    [67, 2, 67 ** 3],
    [5, 67, 67 ** 2],
  ] as const) {
    expect(powerModRoots(BigInt(b), BigInt(r), BigInt(m)), `x^${r} ≡ ${b} (mod ${m})`).toEqual(scan(b, r, m));
  }
});

test("the exponent s/r and a rational base", () => {
  // x³ ≡ 2² (mod 13)
  expect(powerModList([2n, 1n], 2n, 3n, 13n)).toEqual(scan(4, 3, 13));
  // a negative exponent inverts; a non-unit has no inverse
  expect(powerModList([3n, 1n], -1n, 1n, 7n)).toEqual([5n]);
  expect(powerModList([2n, 1n], -1n, 1n, 4n)).toEqual([]);
  // 2/3 in ℤ/7 is 2·5 = 3
  expect(powerModList([2n, 3n], 1n, 1n, 7n)).toEqual([3n]);
  expect(powerModList([1n, 7n], 1n, 1n, 7n)).toEqual([]);
});

test("primality and factorisation", () => {
  const mersenne = 2n ** 89n - 1n;
  expect(isPrime(mersenne)).toBe(true);
  expect(isPrime(mersenne * 3n)).toBe(false);
  expect(isPrime(3215031751n)).toBe(false); // strong pseudoprime to bases 2, 3, 5, 7
  expect(factorInteger(2n ** 64n + 1n)).toEqual([
    [274177n, 1],
    [67280421310721n, 1],
  ]);
  expect(factorInteger(600851475143n)).toEqual([
    [71n, 1],
    [839n, 1],
    [1471n, 1],
    [6857n, 1],
  ]);
});

test("orders and discrete logs", () => {
  for (let n = 2n; n <= 60n; n++) {
    for (let k = 1n; k < n; k++) {
      let naive: bigint | undefined;
      for (let m = 1n, x = k % n; m <= n; m++, x = (x * k) % n) {
        if (x === 1n % n) {
          naive = m;
          break;
        }
      }
      expect(multiplicativeOrder(k, n), `ord ${k} mod ${n}`).toBe(naive);
    }
  }
  expect(discreteLog(5n, 7n, [2n, 3n, 4n])).toBe(2n);
  expect(discreteLog(2n, 7n, [3n])).toBeUndefined(); // ⟨2⟩ = {1, 2, 4}
  expect(discreteLog(3n, 7n, [1n])).toBe(6n); // least POSITIVE m
});

test("primitive roots", () => {
  expect(primitiveRootList(7n)).toEqual([3n, 5n]);
  expect(primitiveRootList(8n)).toEqual([]);
  expect(primitiveRootList(18n)).toEqual([5n, 11n]);
  expect(primitiveRootList(2n)).toEqual([1n]);
  expect(primitiveRootList(1000003n)).toBeUndefined(); // past MAX_PRIMITIVE_ROOTS
  for (const n of [1n, 2n, 4n, 7n, 8n, 18n, 1000003n]) {
    const listed = primitiveRootList(n);
    if (listed !== undefined) expect([...primitiveRoots(n)]).toEqual(listed);
  }
  expect(primitiveRootCount(1000003n)).toBe(333332n);
  expect(primitiveRootCount(8n)).toBe(0n);
  expect(primitiveRoots(1000003n).next().value).toBe(2n);
});

test("crtSolve agrees with a scan, coprime or not", () => {
  for (const [m, n] of [
    [4n, 6n],
    [3n, 5n],
    [8n, 12n],
    [9n, 9n],
  ] as const) {
    for (let a = 0n; a < m; a++) {
      for (let b = 0n; b < n; b++) {
        let found: bigint | undefined;
        for (let x = 0n; x < m * n && found === undefined; x++) if (x % m === a && x % n === b) found = x;
        const solved = crtSolve([
          [a, m],
          [b, n],
        ]);
        expect(solved?.[0]).toBe(found);
        // The answer is modulo lcm(m, n): both divide it, and it divides m·n.
        if (solved !== undefined) expect([solved[1] % m, solved[1] % n, (m * n) % solved[1]]).toEqual([0n, 0n, 0n]);
      }
    }
  }
});
