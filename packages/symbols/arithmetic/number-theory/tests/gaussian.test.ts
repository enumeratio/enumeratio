import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { gaussianRoots } from "../src/gaussian-roots.ts";
import {
  add,
  equal,
  extendedGcd,
  type Gaussian,
  mod,
  mul,
  norm,
  ONE,
  powerMod,
  powerModRaw,
} from "../src/gaussian.ts";
import { type GoldenCase, ours } from "./gaussian-cases.ts";

// Pinned against a Wolfram kernel over a seeded random corpus. Regenerate with
// `node scripts/collect-gaussian-golden.ts` (requires wolframscript on PATH).
const golden: readonly GoldenCase[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("./gaussian.golden.json", import.meta.url)), "utf8"),
);

const read = (v: GoldenCase["args"][number]): Gaussian =>
  typeof v === "object" ? [BigInt(v[0]), BigInt(v[1])] : [BigInt(v), 0n];

/**
 * Where we deliberately differ. Bézout coefficients are not unique, and in a handful of runs
 * Wolfram picks another pair than its own Euclid would suggest; ours still satisfy s·a + t·b = g.
 * And Wolfram's PowerMod refuses a negative exponent unless a is a unit modulo the NORM of m,
 * not m itself, so it leaves some invertible cases unevaluated that we answer.
 */
function divergence(c: GoldenCase): boolean {
  if (c.op === "ExtendedGCD") {
    const [a, b] = c.args.map(read) as [Gaussian, Gaussian];
    const [g, s, t] = extendedGcd(a, b);
    expect(equal(add(mul(s, a), mul(t, b)), g), JSON.stringify(c.args)).toBe(true);
    return JSON.stringify(ours(c)).startsWith(`[${JSON.stringify((c.wolfram as unknown[])[0])},`);
  }
  if (c.op === "PowerMod" && c.wolfram === null && BigInt(c.args[1] as number) < 0n) {
    const [z, , m] = c.args.map(read) as [Gaussian, Gaussian, Gaussian];
    const e = BigInt(c.args[1] as number);
    const x = powerMod(z, e, m);
    return x !== undefined && equal(mod(mul(x, powerMod(z, -e, m)!), m)!, ONE);
  }
  return false;
}

test("the Gaussian kernels match the Wolfram kernel", () => {
  const differing = golden.filter((c) => JSON.stringify(ours(c)) !== JSON.stringify(c.wolfram));
  const unexplained = differing.filter((c) => !divergence(c));
  expect(unexplained.map((c) => `${c.op}${JSON.stringify(c.args)}`)).toEqual([]);
  // The corpus is large enough that the documented divergences stay a sliver of it.
  expect(differing.length).toBeLessThan(golden.length / 200);
});

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
        const label = `x^${r} ≡ ${b} mod ${m}`;
        expect(got, label).toBeDefined();
        expect(new Set(got!.map((x) => key(x, m))), label).toEqual(want);
        expect(got!.length, label).toBe(want.size);
      }
    }
  }
});
