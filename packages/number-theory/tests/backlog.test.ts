import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareResidues } from "@enumeratio/residues/src";
import { declareNumberTheory } from "../src/declare.ts";

// Heads landed from the Wolfram-sweep backlog (packages/reference/src/backlog.json →
// entries/number-theory.ts). Each is brute-force cross-checked here against an independent,
// naive implementation — not just the worked examples an entry carries.

const ce = new ComputeEngine();
declareResidues(ce);
declareNumberTheory(ce);
const run = (expr: unknown): unknown =>
  ce.box(expr as Parameters<ComputeEngine["box"]>[0]).evaluate().json;

test("CarmichaelLambda and IsPerfect widen to negative n and thread over lists", () => {
  expect(run(["CarmichaelLambda", -100])).toBe(20);
  expect(run(["CarmichaelLambda", ["List", 8, 15]])).toEqual(["List", 2, 4]);
  expect(run(["IsPerfect", -6])).toBe("False");
  expect(run(["IsPerfect", ["List", 6, 28, 12]])).toEqual(["List", "True", "True", "False"]);
});

test("DivisorSum: brute force over the divisors", () => {
  const naiveDivisorSum = (n: number, f: (d: number) => number, cond?: (d: number) => boolean) => {
    let sum = 0;
    for (let d = 1; d <= n; d++) if (n % d === 0 && (cond === undefined || cond(d))) sum += f(d);
    return sum;
  };
  for (const n of [1, 2, 6, 12, 20, 30, 97, 100]) {
    expect(run(["DivisorSum", n, ["Function", ["Power", "d", 2], "d"]])).toBe(
      naiveDivisorSum(n, (d) => d * d),
    );
    expect(run(["DivisorSum", n, ["Function", "d", "d"], ["Function", ["IsOdd", "d"], "d"]])).toBe(
      naiveDivisorSum(
        n,
        (d) => d,
        (d) => d % 2 === 1,
      ),
    );
  }
});

test("IsCoprime: brute force pairwise gcd, and Wolfram's pairwise-not-collective gap", () => {
  const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
  for (let a = 1; a <= 20; a++) {
    for (let b = 1; b <= 20; b++) {
      expect(run(["IsCoprime", a, b])).toBe(gcd(a, b) === 1 ? "True" : "False");
    }
  }
  // gcd(6,10,15) = 1 collectively, but no pair is coprime.
  expect(run(["IsCoprime", 6, 10, 15])).toBe("False");
});

test("IsPrimePower: brute force factor-count against FactorInteger", () => {
  for (let n = 1; n <= 100; n++) {
    const factors = run(["FactorInteger", n]) as unknown[];
    const distinctPrimes = factors.length - 1; // factors[0] is the "List" head
    expect(run(["IsPrimePower", n])).toBe(n >= 2 && distinctPrimes === 1 ? "True" : "False");
  }
});

test("LiouvilleLambda: brute force against (-1)^Ω(n) from FactorInteger", () => {
  for (let n = 2; n <= 100; n++) {
    const factors = (run(["FactorInteger", n]) as unknown[]).slice(1) as [string, number, number][];
    const omega = factors.reduce((sum, tuple) => sum + tuple[2], 0);
    expect(run(["LiouvilleLambda", n])).toBe(omega % 2 === 0 ? 1 : -1);
  }
  // n = 1: Ω(1) = 0 (the empty factorisation), so λ(1) = 1 — compute-engine's own
  // FactorInteger(1) represents it as [Tuple(1, 1)], which would misread as Ω(1) = 1.
  expect(run(["LiouvilleLambda", 1])).toBe(1);
});

test("MangoldtLambda: 0 off the prime powers, ln p on them", () => {
  const isPrime = (n: number) => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  };
  for (let n = 1; n <= 60; n++) {
    let prime: number | undefined;
    let m = n;
    for (let p = 2; p <= n; p++) {
      if (!isPrime(p)) continue;
      let k = m;
      while (k % p === 0) k /= p;
      if (k === 1) prime = p;
    }
    expect(run(["MangoldtLambda", n])).toEqual(prime === undefined ? 0 : ["Ln", prime]);
  }
});

test("MersennePrimeExponent and PerfectNumber: the table gives 2^(p-1)(2^p-1)", () => {
  const table = [2n, 3n, 5n, 7n, 13n];
  for (const [i, p] of table.entries()) {
    expect(run(["MersennePrimeExponent", i + 1])).toBe(Number(p));
    const perfect = (1n << (p - 1n)) * ((1n << p) - 1n);
    expect(run(["PerfectNumber", i + 1])).toBe(Number(perfect));
  }
  // Past the known table, calls stay unevaluated rather than guessing.
  expect(run(["MersennePrimeExponent", 1000])).toEqual(["MersennePrimeExponent", 1000]);
});

test("PartitionsQ: brute force against partitions into distinct parts", () => {
  const distinctPartitionCount = (n: number): number => {
    const count = (remaining: number, maxPart: number): number => {
      if (remaining === 0) return 1;
      let total = 0;
      for (let part = Math.min(maxPart, remaining); part >= 1; part--) {
        total += count(remaining - part, part - 1);
      }
      return total;
    };
    return count(n, n);
  };
  for (let n = 0; n <= 20; n++) {
    expect(run(["PartitionsQ", n])).toBe(distinctPartitionCount(n));
  }
});

test("PowersRepresentations: brute force enumeration for small n, k, p", () => {
  const naive = (n: number, k: number, p: number): number[][] => {
    const results: number[][] = [];
    const rec = (remaining: number, count: number, minVal: number, acc: number[]) => {
      if (count === 0) {
        if (remaining === 0) results.push([...acc]);
        return;
      }
      for (let v = minVal; v ** p <= remaining; v++) {
        acc.push(v);
        rec(remaining - v ** p, count - 1, v, acc);
        acc.pop();
      }
    };
    rec(n, k, 0, []);
    return results;
  };
  for (const [n, k, p] of [
    [25, 2, 2],
    [50, 2, 2],
    [30, 3, 2],
    [1729, 2, 3],
  ] as const) {
    expect(run(["PowersRepresentations", n, k, p])).toEqual([
      "List",
      ...naive(n, k, p).map((rep) => ["List", ...rep]),
    ]);
  }
});

test("RamanujanTau: brute force against the q-expansion of Δ = q∏(1-q^n)^24", () => {
  const N = 15;
  // Coefficients of ∏_{k=1}^{N}(1-q^k)^24 up to q^(N-1), by direct truncated poly multiply —
  // an independent computation of the same series, not the implementation's own algorithm.
  let poly = new Array(N).fill(0);
  poly[0] = 1;
  for (let k = 1; k < N; k++) {
    // (1-q^k)^24 truncated, via repeated squaring-free direct binomial expansion.
    const binom = (n: number, r: number): number => {
      let result = 1;
      for (let i = 0; i < r; i++) result = (result * (n - i)) / (i + 1);
      return Math.round(result);
    };
    const factor = new Array(N).fill(0);
    for (let j = 0; j * k < N; j++) factor[j * k] = binom(24, j) * (j % 2 === 0 ? 1 : -1);
    const next = new Array(N).fill(0);
    for (let a = 0; a < N; a++) {
      if (poly[a] === 0) continue;
      for (let b = 0; a + b < N; b++) next[a + b] += poly[a] * factor[b];
    }
    poly = next;
  }
  for (let n = 1; n < N; n++) {
    expect(run(["RamanujanTau", n])).toBe(poly[n - 1]);
  }
});

test("SquaresR: brute force lattice-point count for small d, n", () => {
  const naive = (d: number, n: number): number => {
    const bound = Math.floor(Math.sqrt(Math.max(n, 0)));
    const rec = (remaining: number, count: number): number => {
      if (count === 0) return remaining === 0 ? 1 : 0;
      let total = 0;
      for (let v = -bound; v <= bound; v++) {
        if (v * v > remaining) continue;
        total += rec(remaining - v * v, count - 1);
      }
      return total;
    };
    return rec(n, d);
  };
  for (const d of [1, 2, 3, 4]) {
    for (let n = 0; n <= 12; n++) {
      expect(run(["SquaresR", d, n])).toBe(naive(d, n));
    }
  }
});

test("EulerE: numbers match the sech(x) recurrence; polynomials match Eₙ = 2ⁿEₙ(1/2)", () => {
  // E₀..E₁₀, from OEIS A122045 / the standard table.
  const known = [1, 0, -1, 0, 5, 0, -61, 0, 1385, 0, -50521];
  for (const [n, value] of known.entries()) {
    expect(run(["EulerE", n])).toBe(value);
  }
  for (let n = 0; n <= 6; n++) {
    // Eₙ = 2ⁿ Eₙ(1/2).
    const atHalf = run(["EulerE", n, ["Rational", 1, 2]]);
    expect(run(["Multiply", ["Power", 2, n], atHalf])).toBe(known[n]);
  }
});

test("FrobeniusNumber: brute force search for the largest unreachable value", () => {
  const naiveFrobenius = (values: readonly number[]): number => {
    const reachable = new Set<number>([0]);
    const limit = 2000;
    for (let target = 1; target <= limit; target++) {
      for (const v of values) {
        if (v <= target && reachable.has(target - v)) {
          reachable.add(target);
          break;
        }
      }
    }
    for (let target = limit; target >= 0; target--) if (!reachable.has(target)) return target;
    throw new Error("search limit too small");
  };
  for (const values of [
    [6, 9, 20],
    [3, 5],
    [4, 7],
    [5, 7, 11],
  ]) {
    expect(run(["FrobeniusNumber", ["List", ...values]])).toBe(naiveFrobenius(values));
  }
});

test("FrobeniusSolve: every returned tuple actually solves a·x = b, and none is missing", () => {
  const naiveSolve = (a: readonly number[], b: number): number[][] => {
    const results: number[][] = [];
    const rec = (index: number, remaining: number, acc: number[]) => {
      if (index === a.length - 1) {
        if (remaining % a[index]! === 0) results.push([...acc, remaining / a[index]!]);
        return;
      }
      for (let x = 0; a[index]! * x <= remaining; x++) {
        acc.push(x);
        rec(index + 1, remaining - a[index]! * x, acc);
        acc.pop();
      }
    };
    rec(0, b, []);
    return results;
  };
  for (const [a, b] of [
    [[2, 3], 7],
    [[2, 3, 5], 10],
    [[6, 9, 20], 43],
    [[3, 5, 7], 30],
  ] as const) {
    expect(run(["FrobeniusSolve", ["List", ...a], b])).toEqual([
      "List",
      ...naiveSolve(a, b).map((sol) => ["List", ...sol]),
    ]);
  }
});
