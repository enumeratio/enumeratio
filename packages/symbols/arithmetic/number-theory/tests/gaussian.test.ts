import { expect, test } from "vite-plus/test";
import { gaussianRoots } from "../src/gaussian-roots.ts";
import { type Gaussian, norm, mul, powerModRaw } from "../src/gaussian.ts";

// The Wolfram-kernel golden this file used to check the arithmetic kernels against
// (Mod/Quotient/GCD/LCM/ExtendedGCD/ModularInverse/PowerMod, plus IsPrime/FactorInteger/
// Divisors with GaussianIntegers -> True) is gone: every one of those heads now carries a
// verified `wolfram` binding, and the grid is sampled as `role: test` examples on each
// head's own record (<Head>/examples.tsv), scanned the same way `oracle-scan.ts` scans
// everything else. The handful of genuine conventions the golden's `divergence()` used to
// carry by hand -- ExtendedGCD's non-unique Bezout coefficients and its shape (flat Tuple vs
// Wolfram's nested pair), and PowerMod's negative-exponent invertibility check against
// N(m) rather than m for a Gaussian modulus -- are now classified on the disagreeing rows in
// each head's <Head>/examples.values.*.tsv instead.

test("Gaussian roots agree with a scan of ℤ[i]/(m)", () => {
  // x ≡ y (mod m) iff (x − y)·m̄ ≡ 0 componentwise mod N(m): a canonical key per class.
  const key = (x: Gaussian, m: Gaussian): string => {
    const n = norm(m);
    const [re, im] = mul(x, [m[0], -m[1]]);
    return `${((re % n) + n) % n},${((im % n) + n) % n}`;
  };
  const moduli: Gaussian[] = [
    [3n, 0n],
    [2n, 0n],
    [4n, 0n],
    [1n, 1n],
    [2n, 1n],
    [5n, 0n],
    [3n, 3n],
    [9n, 0n],
    [7n, 0n],
    [2n, 2n],
    [4n, 1n],
    [6n, 1n],
    [5n, 5n],
    [8n, 0n],
    [3n, 5n],
  ];
  for (const m of moduli) {
    const n = norm(m);
    for (const r of [1n, 2n, 3n, 4n]) {
      for (const b of [
        [1n, 0n],
        [0n, 1n],
        [-1n, 0n],
        [2n, 1n],
        [0n, 0n],
        [3n, -2n],
      ] as Gaussian[]) {
        const want = new Set<string>();
        for (let re = 0n; re < n; re++) {
          for (let im = 0n; im < n; im++) {
            const x: Gaussian = [re, im];
            if (key(powerModRaw(x, r, m), m) === key(b, m)) want.add(key(x, m));
          }
        }
        const got = gaussianRoots(b, r, m);
        const label = `x^${r} ≡ ${b.join(",")} mod ${m.join(",")}`;
        expect(got, label).toBeDefined();
        expect(new Set(got!.map((x) => key(x, m))), label).toEqual(want);
        expect(got!.length, label).toBe(want.size);
      }
    }
  }
});
