// `Mod(f(args), m)` computed modulo m (declare-modular-kernels.ts, issue #205): every fast
// answer must equal `Mod` of the exact value, for moduli of every shape, and every call the
// registry declines must run as it always did.
import { type Json, registerModularKernel } from "@enumeratio/engine";
import { createEngine } from "@enumeratio/engine/testing";
import { declareNumerals } from "@enumeratio/numerals";
import { declareResidues } from "@enumeratio/residues";
import { expect, test } from "vite-plus/test";
import { declareNumberTheory } from "../src/declare.ts";
import { MODULAR_KERNELS } from "../src/declare-modular-kernels.ts";
import {
  bellMod,
  binomialMod,
  catalanMod,
  factorialMod,
  multinomialMod,
  pochhammerMod,
  stirlingMod,
  subfactorialMod,
} from "../src/modular-kernels.ts";
import { fibonacciMod, lucasLMod } from "../src/fast-recurrence.ts";

const ce = createEngine(declareResidues, declareNumerals, declareNumberTheory);
const run = (expr: unknown): unknown => ce.box(expr as Json).evaluate().json;

/** Positive moduli of every shape: 1, 2, primes, prime powers (odd and 2ᵉ), squarefree and
 *  repeated-factor composites, and a prime past 2⁶⁴. */
const MODULI = [
  1n,
  2n,
  3n,
  4n,
  5n,
  6n,
  7n,
  8n,
  9n,
  12n,
  16n,
  25n,
  27n,
  30n,
  49n,
  64n,
  97n,
  100n,
  121n,
  243n,
  360n,
  1024n,
  1009n,
  1000003n,
  2n ** 31n - 1n,
  1000000007n,
  2n ** 40n,
  3n ** 25n,
  2n ** 61n - 1n,
  2n ** 64n + 13n,
];

const factorial = (n: bigint): bigint => (n <= 1n ? 1n : n * factorial(n - 1n));
const binomial = (n: bigint, k: bigint): bigint =>
  k < 0n || k > n ? 0n : factorial(n) / (factorial(k) * factorial(n - k));

test("fibonacciMod, lucasLMod, factorialMod, binomialMod, catalanMod match the exact value reduced", () => {
  let [f, g, a, b] = [0n, 1n, 2n, 1n]; // F(n), F(n+1), L(n), L(n+1)
  for (let n = 0n; n <= 300n; n++, [f, g, a, b] = [g, f + g, b, a + b]) {
    for (const m of MODULI) {
      expect(fibonacciMod(n, m)).toBe(f % m);
      expect(lucasLMod(n, m)).toBe(a % m);
      expect(factorialMod(n, m)).toBe(factorial(n) % m);
    }
  }
  for (let n = 0n; n <= 70n; n++) {
    for (const m of MODULI) {
      for (let k = -1n; k <= n + 1n; k++) expect(binomialMod(n, k, m)).toBe(binomial(n, k) % m);
      expect(catalanMod(n, m)).toBe((binomial(2n * n, n) / (n + 1n)) % m);
    }
  }
});

test("a kernel declines outside its range rather than guess", () => {
  expect(factorialMod(-3n, 7n)).toBeUndefined();
  expect(binomialMod(-3n, 2n, 7n)).toBeUndefined();
  expect(catalanMod(-1n, 7n)).toBeUndefined();
  expect(factorialMod(10n ** 12n, 1000000007n)).toBe(0n); // n ≥ m
  expect(factorialMod(1000000006n, 1000000007n)).toBe(1000000006n); // Wilson
  expect(factorialMod(10n ** 9n, 1000000007n + 2n ** 40n)).toBeUndefined(); // past the step budget
  // 2^64 + 13 is prime (Lucas handles it); a product of two large primes is a composite past 2^64
  // that is not factored, so the binomial kernels decline while factorialMod, which needs no
  // factoring, still answers.
  const unfactorable = (2n ** 61n - 1n) * (2n ** 64n + 13n);
  expect(binomialMod(10n, 3n, unfactorable)).toBeUndefined();
  expect(catalanMod(10n, unfactorable)).toBeUndefined();
  expect(factorialMod(10n, unfactorable)).toBe(3628800n);
  expect(run(["Mod", ["Binomial", 10, 3], { num: unfactorable.toString() }])).toBe(120);
  expect(run(["Mod", ["Binomial", 1000, 500], { num: unfactorable.toString() }])).toEqual(
    run(["Mod", { num: binomial(1000n, 500n).toString() }, { num: unfactorable.toString() }]),
  );
});

test("powers: exponent zero is left to compute-engine, a large exponent on a registered base is modular", () => {
  expect(run(["Mod", ["Power", ["Fibonacci", 0], 0], 7])).toEqual(run(["Mod", ["Power", 0, 0], 7]));
  const p = 1000000007n;
  expect(run(["Mod", ["Power", ["Fibonacci", 30], 300], 1000000007])).toBe(Number(832040n ** 300n % p));
  let [base, e, expected] = [832040n, 100000000000n, 1n];
  for (; e > 0n; e >>= 1n, base = (base * base) % p) if (e & 1n) expected = (expected * base) % p;
  expect(run(["Mod", ["Power", ["Fibonacci", 30], { num: "100000000000" }], 1000000007])).toBe(Number(expected));
});

test("known values at the bench sizes", () => {
  expect(run(["Mod", ["Fibonacci", 1000000], 1000000007])).toBe(918091266);
  expect(run(["Mod", ["Factorial", 100000], 1000000007])).toBe(457992974);
  expect(run(["Mod", ["Factorial", 1000000], 1000000007])).toBe(641102369);
  expect(run(["Mod", ["Binomial", 1000000, 500000], 1000000007])).toBe(996692777);
  expect(run(["Mod", ["CatalanNumber", 100000], 1000000007])).toBe(945729344);
});

// The reference evaluates f exactly, then takes `Mod` of that literal, which the registry never sees.
const reference = (f: Json, m: number | bigint): unknown => {
  const exact = ce.box(f).evaluate();
  return ce.box(["Mod", exact.json, typeof m === "bigint" ? { num: m.toString() } : m] as Json).evaluate().json;
};
const fast = (f: Json, m: number | bigint): unknown =>
  ce.box(["Mod", f, typeof m === "bigint" ? { num: m.toString() } : m] as Json).evaluate().json;

const MODULI_FOR_MOD = [...MODULI, 0n, -1n, -2n, -7n, -12n, -1000000007n].map((m) => (m < 2n ** 53n ? Number(m) : m));

test("Mod(f(args), m) equals Mod of the exact value: Fibonacci, LucasL, Factorial", () => {
  for (const m of MODULI_FOR_MOD) {
    for (let n = -3; n <= 300; n += n < 40 ? 1 : 7) {
      for (const head of ["Fibonacci", "LucasL", "Factorial"]) {
        const f = [head, n] as Json;
        expect(fast(f, m), `Mod(${head}(${n}), ${m})`).toEqual(reference(f, m));
      }
    }
  }
});

test("Mod(Binomial(n, k), m) and Mod(CatalanNumber(n), m) equal Mod of the exact value", () => {
  for (const m of MODULI_FOR_MOD) {
    for (let n = -2; n <= 36; n += 2) {
      for (let k = -1; k <= n + 1; k += 3) {
        const f = ["Binomial", n, k] as Json;
        expect(fast(f, m), `Mod(Binomial(${n}, ${k}), ${m})`).toEqual(reference(f, m));
      }
      const c = ["CatalanNumber", n] as Json;
      expect(fast(c, m), `Mod(CatalanNumber(${n}), ${m})`).toEqual(reference(c, m));
    }
  }
});

test("the ring operations stay modular around a registered call", () => {
  const expressions: Json[] = [
    ["Add", ["Multiply", 2, ["Fibonacci", 200]], 1],
    ["Subtract", ["Factorial", 30], ["Binomial", 40, 20]],
    ["Negate", ["LucasL", 99]],
    ["Power", ["Fibonacci", 25], 40],
    ["Multiply", ["Fibonacci", 90], ["Fibonacci", 91], ["Factorial", 20]],
    ["Fibonacci", ["Add", ["Factorial", 5], 7]],
    ["Power", 3, 1000],
  ];
  for (const m of [7, 97, 360, 1000000007, -13]) {
    for (const f of expressions) expect(fast(f, m), `Mod(${JSON.stringify(f)}, ${m})`).toEqual(reference(f, m));
  }
  expect(run(["Mod", ["Power", 3, 100000000], 1000000007])).toEqual(run(["PowerMod", 3, 100000000, 1000000007]));
});

test("a call the registry has no say in runs as it always did", () => {
  // Symbolic argument or modulus, zero modulus, non-integer argument, numeric approximation.
  expect(run(["Mod", ["Fibonacci", "x"], 7])).toEqual(["Mod", ["Fibonacci", "x"], 7]);
  expect(run(["Mod", ["Factorial", 10], "m"])).toEqual(["Mod", 3628800, "m"]);
  expect(fast(["Factorial", 10] as Json, 0)).toEqual(run(["Mod", 3628800, 0]));
  expect(run(["Mod", ["Add", ["Fibonacci", 50], "x"], 7])).toEqual(run(["Mod", ["Add", 12586269025, "x"], 7]));
  expect(ce.box(["Mod", ["Factorial", 20], 1000] as Json).N().json).toEqual(
    ce.box(["Mod", 2432902008176640000, 1000] as Json).N().json,
  );
  expect(run(["Mod", ["List", ["Factorial", 5], ["Factorial", 6]], 7])).toEqual(["List", 1, 6]);
});

// ─── Multinomial, Pochhammer, Subfactorial, StirlingS1/S2, BellNumber ───

const mod = (a: bigint, m: bigint): bigint => ((a % m) + m) % m;
const rising = (a: bigint, n: bigint): bigint => {
  let r = 1n;
  for (let i = 0n; i < n; i++) r *= a + i;
  return r;
};
const multinomial = (parts: readonly bigint[]): bigint =>
  parts.reduce((r, n) => r / factorial(n), factorial(parts.reduce((a, b) => a + b, 0n)));
const derangements = (n: bigint): bigint => {
  let [d, sign] = [1n, 1n];
  for (let k = 1n; k <= n; k++) [d, sign] = [k * d - sign, -sign];
  return d;
};
/** Row n of a Stirling triangle: second kind kS(n-1,k)+S(n-1,k-1); signed first kind S(n-1,k-1)-(n-1)S(n-1,k). */
const stirlingRow = (n: number, kind: 1 | 2): bigint[] => {
  let row = [1n];
  for (let l = 1; l <= n; l++) {
    const next = new Array<bigint>(l + 1).fill(0n);
    for (let d = 1; d <= l; d++) {
      const [above, aboveLeft] = [row[d] ?? 0n, row[d - 1] ?? 0n];
      next[d] = kind === 2 ? BigInt(d) * above + aboveLeft : aboveLeft - BigInt(l - 1) * above;
    }
    row = next;
  }
  return row;
};
const bell = (n: number): bigint => {
  let row = [1n];
  for (let i = 1; i <= n; i++) {
    const next = [row[i - 1]!];
    for (let j = 0; j < i; j++) next.push(next[j]! + row[j]!);
    row = next;
  }
  return row[0]!;
};

test("multinomialMod, pochhammerMod, subfactorialMod, stirlingMod, bellMod match the exact value reduced", () => {
  const sizes = [0n, 1n, 2n, 3n, 4n, 5n, 7n, 9n];
  const lists: bigint[][] = [[], ...sizes.map((a) => [a])];
  for (const a of sizes) {
    for (const b of sizes) {
      lists.push([a, b]);
      for (const c of [0n, 2n, 5n]) lists.push([a, b, c], [c, a, 1n, b]);
    }
  }
  for (const m of MODULI) {
    for (const parts of lists) {
      expect(multinomialMod(parts, m), `Multinomial(${parts.join(", ")}) mod ${m}`).toBe(multinomial(parts) % m);
    }
    for (let a = -15n; a <= 15n; a += a < 8n ? 1n : 3n) {
      for (let n = 0n; n <= 40n; n++) {
        expect(pochhammerMod(a, n, m), `(${a})_${n} mod ${m}`).toBe(mod(rising(a, n), m));
      }
    }
    for (let n = 0n; n <= 300n; n++) expect(subfactorialMod(n, m), `!${n} mod ${m}`).toBe(derangements(n) % m);
    for (let n = 0; n <= 40; n++) expect(bellMod(BigInt(n), m), `B(${n}) mod ${m}`).toBe(bell(n) % m);
  }
  for (let n = 0; n <= 24; n++) {
    const [first, second] = [stirlingRow(n, 1), stirlingRow(n, 2)];
    for (const m of MODULI) {
      for (let k = 0; k <= n + 1; k++) {
        expect(stirlingMod(BigInt(n), BigInt(k), m, 2), `S2(${n}, ${k}) mod ${m}`).toBe(mod(second[k] ?? 0n, m));
        expect(stirlingMod(BigInt(n), BigInt(k), m, 1), `S1(${n}, ${k}) mod ${m}`).toBe(mod(first[k] ?? 0n, m));
      }
    }
  }
});

test("the new kernels decline outside their range or past the step budget", () => {
  expect(multinomialMod([3n, -1n], 7n)).toBeUndefined();
  expect(pochhammerMod(3n, -2n, 7n)).toBeUndefined();
  expect(subfactorialMod(-1n, 7n)).toBeUndefined();
  expect(bellMod(-1n, 7n)).toBeUndefined();
  expect(stirlingMod(-1n, 2n, 7n, 2)).toBeUndefined();
  const unfactorable = (2n ** 61n - 1n) * (2n ** 64n + 13n);
  expect(multinomialMod([5n, 5n], unfactorable)).toBeUndefined();
  expect(pochhammerMod(1n, 10n ** 9n, 10n ** 12n + 39n)).toBeUndefined(); // past the budget
  expect(subfactorialMod(10n ** 12n, 2n ** 40n)).toBeUndefined();
  expect(bellMod(10n ** 6n, 1000000007n)).toBeUndefined();
  expect(stirlingMod(10n ** 6n, 5n * 10n ** 5n, 1000000007n, 2)).toBeUndefined();
  expect(pochhammerMod(5n, 10n ** 12n, 1000000007n)).toBe(0n); // wraps past a multiple of m
});

test("known values at the bench sizes, from an independent computation", () => {
  expect(run(["Mod", ["Multinomial", 20000, 20000, 20000], 1000000007])).toBe(539817501);
  expect(run(["Mod", ["Multinomial", 3000, 2000, 1000, 500], 1000000007])).toBe(561853302);
  expect(run(["Mod", ["Pochhammer", 100003, 100000], 1000000007])).toBe(321522096);
  expect(run(["Mod", ["Pochhammer", 100000000, 1000000], 1000000007])).toBe(527220029);
  expect(run(["Mod", ["Pochhammer", 500000000, 500000], 1000000007])).toBe(84772848);
  // 10·11·…·(p − 11) = (p − 11)!/9!, which Wilson turns into −1/(10!·9!).
  expect(run(["Mod", ["Pochhammer", 10, 999999987], 1000000007])).toBe(927374667);
  expect(run(["Mod", ["Subfactorial", 100000], 1000000007])).toBe(183389504);
  expect(run(["Mod", ["Subfactorial", 1000000], 1000000007])).toBe(102701088);
  expect(run(["Mod", ["BellNumber", 1000], 1000000007])).toBe(465231251);
  expect(run(["Mod", ["StirlingS2", 1000, 500], 1000000007])).toBe(596728287);
  expect(run(["Mod", ["StirlingS1", 1000, 500], 1000000007])).toBe(761367694);
});

// A second engine whose every registered kernel counts its calls, so each agreement below also shows
// the kernel was consulted rather than compute-engine's own evaluation.
const counted = createEngine(declareResidues, declareNumerals, declareNumberTheory);
const hits = new Map<string, number>();
for (const [head, kernel, arity] of MODULAR_KERNELS) {
  registerModularKernel(
    counted,
    head,
    (args, m) => {
      hits.set(head, (hits.get(head) ?? 0) + 1);
      return kernel(args, m);
    },
    arity,
  );
}
const total = (): number => [...hits.values()].reduce((a, b) => a + b, 0);
/** `Mod(f, m)` on the counting engine, and how many kernel calls it took. */
const asked = (f: Json, m: number | bigint): [unknown, number] => {
  const before = total();
  const value = counted.box(["Mod", f, typeof m === "bigint" ? { num: m.toString() } : m] as Json).evaluate().json;
  return [value, total() - before];
};

const ENGINE_MODULI = [1, 2, 5, 12, 16, 27, 97, 360, 1000000007, 0, -7, -12, 2n ** 61n - 1n, 2n ** 64n + 13n];

test("Mod(f(args), m) equals Mod of the exact value, and consults the kernel: Multinomial, Pochhammer, Subfactorial", () => {
  const calls: Json[] = [];
  for (const parts of [[], [4], [0, 0], [3, 2], [5, 0, 5], [2, 2, 2], [7, 3, 1, 1], [12, 8, 6]]) {
    calls.push(["Multinomial", ...parts] as Json);
  }
  for (let a = -6; a <= 6; a += 2) for (let n = 0; n <= 9; n += 3) calls.push(["Pochhammer", a, n] as Json);
  for (const n of [0, 1, 2, 5, 11, 30, 100]) calls.push(["Subfactorial", n] as Json);
  for (const m of ENGINE_MODULI) {
    for (const f of calls) {
      const [value, consulted] = asked(f, m);
      expect(value, `Mod(${JSON.stringify(f)}, ${m})`).toEqual(reference(f, m));
      if (m !== 0) expect(consulted, `Mod(${JSON.stringify(f)}, ${m}) consulted`).toBeGreaterThan(0);
    }
  }
});

test("Mod(f(args), m) equals Mod of the exact value, and consults the kernel: Stirling and Bell numbers", () => {
  const calls: Json[] = [];
  for (let n = 0; n <= 12; n += 3) {
    calls.push(["BellNumber", n] as Json);
    for (let k = 0; k <= n + 1; k += 2) calls.push(["StirlingS2", n, k] as Json, ["StirlingS1", n, k] as Json);
  }
  for (const m of ENGINE_MODULI) {
    for (const f of calls) {
      const [value, consulted] = asked(f, m);
      expect(value, `Mod(${JSON.stringify(f)}, ${m})`).toEqual(reference(f, m));
      if (m !== 0) expect(consulted, `Mod(${JSON.stringify(f)}, ${m}) consulted`).toBeGreaterThan(0);
    }
  }
  expect(hits.get("Stirling")).toBeGreaterThan(0);
});

test("a rational part declines: Mod of a rational is its rational remainder, not a modular inverse", () => {
  const fibonacci5 = ["Power", ["Fibonacci", 5], -1] as Json; // 1/5, a rational once canonical
  const calls: Json[] = [
    ["Add", ["Fibonacci", 10], ["Rational", 1, 3]],
    ["Add", ["Fibonacci", 10], ["Power", 3, -1]],
    ["Add", ["Fibonacci", 10], ["Divide", 1, 3]],
    ["Add", ["Factorial", 6], ["Power", 3, -300]],
    ["Divide", ["Factorial", 6], 7],
    fibonacci5,
    ["Add", ["Fibonacci", 100], fibonacci5],
  ];
  for (const m of [1, 5, 7, 9, 97, 360, 1000000007, -7]) {
    for (const f of calls) {
      expect(fast(f, m), `Mod(${JSON.stringify(f)}, ${m})`).toEqual(reference(f, m));
    }
  }
  expect(run(["Mod", ["Add", ["Fibonacci", 10], ["Rational", 1, 3]], 7])).toEqual(["Rational", 19, 3]); // 166/3 − 49
});
