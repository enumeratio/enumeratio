import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isRealInt } from "./box.ts";

// SloaneA(id, n) — Fungrim's "the n-th term of OEIS sequence `id`" head, id a quoted
// A-number string. A general OEIS lookup is out of reach (most sequences have no
// closed form at all, and Fungrim's own crosswalk only *cites* an A-number as a name
// for a value it computes some other way) — so this is scoped to exactly the
// sequences the crosswalk's SloaneA identities use, aliasing each to a head that
// already computes it:
//
//   A000045 Fibonacci        → Fibonacci(n)
//   A000040 primes           → PrimeNumber(n)      (1-indexed n-th prime)
//   A000720 prime-counting   → PrimePi(n)
//   A000041 partitions       → NPartition(n)
//   A000110 Bell numbers     → BellNumber(n)
//   A000142 factorials       → Factorial(n)
//   A027641/A027642          → numerator/denominator of BernoulliB(n)
//   A000793 Landau's g(n)    → landauFunction(n) below (compute-engine's `LandauG`
//                              is declared but does not evaluate numerically — probed
//                              `LandauG(5.0).N()` stays symbolic — so this package
//                              supplies the value directly rather than aliasing a stub)
//
// A060691 (the AGM Taylor-coefficient sequence, Fungrim id fungrim:447541) is left
// undeclared: that identity names SloaneA only as one factor inside a derivative
// formula, not as an equation for the sequence's value, and the sequence itself has
// no simpler description than the coefficients it enumerates — implementing it would
// mean reverse-engineering AGM's Taylor series independently of the identity that
// uses it, which is out of scope here.

const primeSieve = (limit: number): number[] => {
  if (limit < 2) return [];
  const composite = new Uint8Array(limit + 1);
  const primes: number[] = [];
  for (let p = 2; p <= limit; p++) {
    if (composite[p]) continue;
    primes.push(p);
    for (let m = p * p; m <= limit; m += p) composite[m] = 1;
  }
  return primes;
};

/**
 * Landau's function g(n): the largest order of an element of the symmetric group
 * S_n, i.e. max over partitions of n of the lcm of the parts. Equivalently — since
 * lcm only sees the highest power of each prime present — a knapsack over prime
 * powers p^e ≤ n: choose at most one power per prime to maximize the product subject
 * to the powers summing to at most n. `before` snapshots the DP row ahead of each
 * prime so its several powers (p, p², …) compete as mutually exclusive alternatives
 * rather than compounding (which would double-count that prime).
 *
 * Exact for n up to a few dozen in float64 (g(n) stays well under 2^53 there, e.g.
 * g(40) = 4620); Fungrim's own use of A000793 is at small n.
 */
export function landauFunction(n: number): number {
  if (n <= 0) return 1;
  const dp = Array.from<number>({ length: n + 1 }).fill(1);
  for (const p of primeSieve(n)) {
    const before = dp.slice();
    for (let pe = p; pe <= n; pe *= p) {
      for (let s = n; s >= pe; s--) {
        const candidate = before[s - pe] * pe;
        if (candidate > dp[s]) dp[s] = candidate;
      }
    }
  }
  return dp[n];
}

type Alias = (ce: ComputeEngine, n: number) => BoxedExpression;

const ALIASES: Readonly<Record<string, Alias>> = {
  A000045: (ce, n) => ce.box(["Fibonacci", n]),
  A000040: (ce, n) => ce.box(["PrimeNumber", n]),
  A000720: (ce, n) => ce.box(["PrimePi", n]),
  A000041: (ce, n) => ce.box(["NPartition", n]),
  A000110: (ce, n) => ce.box(["BellNumber", n]),
  A000142: (ce, n) => ce.box(["Factorial", n]),
  A027641: (ce, n) => ce.box(["BernoulliB", n]).N().numerator,
  A027642: (ce, n) => ce.box(["BernoulliB", n]).N().denominator,
  A000793: (ce, n) => ce.number(landauFunction(n)),
};

export function declareSloaneA(ce: ComputeEngine): void {
  ce.declare("SloaneA", {
    signature: "(string, integer) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [id, n] = ops;
      if (id === undefined || n === undefined || !isRealInt(n)) return undefined;
      // `id` is the boxed string literal (e.g. 'A000045'); `.string` is a BoxedExpression
      // property the shared `EvalOptions`-based signature above doesn't surface, so it is
      // read structurally rather than widening this file's operand type everywhere else.
      const idString = (id as unknown as { string?: string }).string ?? "";
      const alias = ALIASES[idString];
      if (!alias) return undefined;
      const result = alias(ce, n.re);
      return options.numericApproximation ? result.N() : result.evaluate();
    },
  });
}
