import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";
import { factorInteger, gcd as gcdBig, isqrt } from "@enumeratio/residues";

// Heads new to compute-engine, from the Wolfram-sweep backlog (design/symbols.md §4, issue
// #113). Every one stays unevaluated — never approximate — when it cannot answer: a
// non-integer, an out-of-range table lookup, or a search past what its guard allows.

/** An exact rational as [numerator, denominator], denominator > 0. */
type Q = readonly [bigint, bigint];

const qgcd = (a: bigint, b: bigint): bigint => {
  let [x, y] = [a < 0n ? -a : a, b < 0n ? -b : b];
  while (y !== 0n) [x, y] = [y, x % y];
  return x === 0n ? 1n : x;
};
const qnorm = (n: bigint, d: bigint): Q => {
  const sign = d < 0n ? -1n : 1n;
  const [num, den] = [n * sign, d * sign];
  const g = qgcd(num, den);
  return [num / g, den / g];
};
const qadd = (a: Q, b: Q): Q => qnorm(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qmul = (a: Q, b: Q): Q => qnorm(a[0] * b[0], a[1] * b[1]);
const qpow = (a: Q, e: number): Q => {
  let r: Q = [1n, 1n];
  for (let i = 0; i < e; i++) r = qmul(r, a);
  return r;
};

/** C(n, k) for bigint n ≥ 0, computed exactly (each partial product divides evenly). */
function binomialBig(n: bigint, k: bigint): bigint {
  if (k < 0n || k > n) return 0n;
  const kk = k > n - k ? n - k : k;
  let result = 1n;
  for (let i = 0n; i < kk; i++) result = (result * (n - i)) / (i + 1n);
  return result;
}

/** ⌊remaining^(1/p)⌋ for remaining ≥ 0, p ≥ 1, by Newton's method from above. */
function nthRoot(remaining: bigint, p: bigint): bigint {
  if (remaining < 2n || p === 1n) return remaining;
  let x = 1n << (BigInt(remaining.toString(2).length) / p + 1n);
  for (;;) {
    const y = ((p - 1n) * x + remaining / x ** (p - 1n)) / p;
    if (y >= x) return x;
    x = y;
  }
}

/** Every positive divisor of n, ascending — from its factorisation, or undefined past the
 *  factoring budget. */
function divisorsOf(n: bigint): bigint[] | undefined {
  const factors = factorInteger(n);
  if (factors === undefined) return undefined;
  let divisors = [1n];
  for (const [p, e] of factors) {
    const powers: bigint[] = [];
    let pk = 1n;
    for (let i = 0; i <= e; i++) {
      powers.push(pk);
      pk *= p;
    }
    divisors = divisors.flatMap((d) => powers.map((pw) => d * pw));
  }
  return divisors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Apply a `Function` literal (or symbol naming one) to a single boxed argument. */
const applyFn = (ce: ComputeEngine, fn: BoxedExpression, arg: BoxedExpression): BoxedExpression =>
  ce.box([fn.json, arg.json] as never).evaluate();

const isTrue = (expr: BoxedExpression): boolean => symbolNameOf(expr) === "True";

/** The Euler numbers E₀..E_n. Odd-indexed ones past E₀ are 0; the even ones come from
 *  ∑_{k=0}^{n/2} C(n,2k) Eₖ = 0 (n ≥ 2 even), the recurrence behind sech's series. */
function eulerNumbers(maxN: number): bigint[] {
  const E = Array.from<bigint>({ length: maxN + 1 }).fill(0n);
  if (maxN >= 0) E[0] = 1n;
  for (let n = 2; n <= maxN; n += 2) {
    let sum = 0n;
    for (let k = 0; k < n / 2; k++) sum += binomialBig(BigInt(n), BigInt(2 * k)) * E[2 * k]!;
    E[n] = -sum;
  }
  return E;
}

/** The Euler polynomial Eₙ(x)'s coefficients in the monomial basis (index = power of x), from
 *  Eₙ(x) = ∑ₖ C(n,k)(Eₖ/2ᵏ)(x−½)ⁿ⁻ᵏ expanded by the binomial theorem. */
function eulerPolynomialCoeffs(n: number, E: readonly bigint[]): Q[] {
  const coeffs: Q[] = Array.from({ length: n + 1 }, () => [0n, 1n] as Q);
  const half: Q = [-1n, 2n];
  for (let k = 0; k <= n; k++) {
    if (E[k] === 0n) continue;
    const ekOver2k: Q = qnorm(E[k]!, 1n << BigInt(k));
    for (let j = 0; j <= n - k; j++) {
      const term = qmul(
        qmul([binomialBig(BigInt(n), BigInt(k)), 1n], ekOver2k),
        qmul([binomialBig(BigInt(n - k), BigInt(j)), 1n], qpow(half, n - k - j)),
      );
      coeffs[j] = qadd(coeffs[j]!, term);
    }
  }
  return coeffs;
}

/** A polynomial from its monomial coefficients, over the boxed expression `x` — built as raw
 *  arithmetic and handed to `evaluate()`, so compute-engine's own canonicalisation (dropping
 *  a zero term, collapsing ×1 and ×(−1), sorting by degree) decides the printed form. */
function polynomialExpr(
  ce: ComputeEngine,
  coeffs: readonly Q[],
  x: BoxedExpression,
): BoxedExpression {
  const terms: BoxedExpression[] = [];
  for (let j = 0; j < coeffs.length; j++) {
    const [num, den] = coeffs[j]!;
    if (num === 0n) continue;
    const coeffExpr = den === 1n ? ce.number(num) : ce.number([num, den]);
    const power = j === 0 ? undefined : j === 1 ? x : ce.function("Power", [x, ce.number(j)]);
    terms.push(power === undefined ? coeffExpr : ce.function("Multiply", [coeffExpr, power]));
  }
  if (terms.length === 0) return ce.Zero;
  return terms.length === 1 ? terms[0]!.evaluate() : ce.function("Add", terms).evaluate();
}

/** Every non-negative integer solution x of coeffs·x = b, lexicographically — x₀ ascending,
 *  then x₁ ascending within each, and so on. */
function frobeniusSolve(coeffs: readonly bigint[], b: bigint): bigint[][] {
  const rec = (index: number, remaining: bigint): bigint[][] => {
    const a = coeffs[index]!;
    if (index === coeffs.length - 1) return remaining % a === 0n ? [[remaining / a]] : [];
    const results: bigint[][] = [];
    for (let x = 0n; a * x <= remaining; x++) {
      for (const rest of rec(index + 1, remaining - a * x)) results.push([x, ...rest]);
    }
    return results;
  };
  return rec(0, b);
}

/** The Frobenius number of a coprime set: `undefined` for an invalid input, `"infinite"` when
 *  the generators share a common factor (infinitely many multiples of it are unreachable),
 *  otherwise the value — by the round-robin algorithm: n[r], the least number ≡ r (mod a₀)
 *  reachable, relaxed by every other generator (a shortest-path search over ℤ/a₀); the answer
 *  is max(n[r]) − a₀. */
function frobeniusNumber(values: readonly bigint[]): bigint | "infinite" | undefined {
  if (values.length === 0 || values.some((v) => v <= 0n)) return undefined;
  if (values.length === 1) return values[0] === 1n ? -1n : "infinite";
  let g = values[0]!;
  for (const v of values.slice(1)) g = gcdBig(g, v);
  if (g !== 1n) return "infinite";
  const a0 = values.reduce((m, v) => (v < m ? v : m));
  if (a0 === 1n) return -1n;
  const others = values.filter((v) => v !== a0);
  const width = Number(a0);
  const n: (bigint | undefined)[] = Array.from({ length: width });
  n[0] = 0n;
  const visited = Array.from<boolean>({ length: width }).fill(false);
  for (let iter = 0; iter < width; iter++) {
    let u = -1;
    for (let r = 0; r < width; r++) {
      if (!visited[r] && n[r] !== undefined && (u === -1 || n[r]! < n[u]!)) u = r;
    }
    if (u === -1) break;
    visited[u] = true;
    for (const a of others) {
      const r2 = Number((BigInt(u) + a) % a0);
      const candidate = n[u]! + a;
      if (n[r2] === undefined || candidate < n[r2]!) n[r2] = candidate;
    }
  }
  let max = -1n;
  for (let r = 1; r < width; r++) {
    if (n[r] === undefined) return undefined;
    if (n[r]! > max) max = n[r]!;
  }
  return max - a0;
}

/** The ways to write `remaining` as a non-decreasing list of `count` non-negative pᵗʰ powers,
 *  each ≥ `minVal` — lexicographic because the outer value is chosen ascending first. */
function powersRepresentations(
  remaining: bigint,
  count: number,
  p: bigint,
  minVal = 0n,
): bigint[][] {
  if (count === 0) return remaining === 0n ? [[]] : [];
  const results: bigint[][] = [];
  const max = nthRoot(remaining, p);
  for (let v = minVal; v <= max; v++) {
    for (const rest of powersRepresentations(remaining - v ** p, count - 1, p, v)) {
      results.push([v, ...rest]);
    }
  }
  return results;
}

/** r_d(n): the number of ordered d-tuples of (signed) integers whose squares sum to n. */
function squaresR(d: number, n: bigint): bigint {
  if (n < 0n) return 0n;
  const rec = (remaining: bigint, count: number): bigint => {
    if (count === 0) return remaining === 0n ? 1n : 0n;
    const bound = isqrt(remaining);
    let total = 0n;
    for (let v = -bound; v <= bound; v++) total += rec(remaining - v * v, count - 1);
    return total;
  };
  return rec(n, d);
}

/** τ(n): the coefficient of qⁿ in Δ(q) = q·∏_{k≥1}(1−qᵏ)²⁴, by truncated power-series
 *  multiplication — τ(n) is the coefficient of q^(n−1) in the product, expanded one factor
 *  (1−qᵏ)²⁴ at a time via the binomial theorem. */
function ramanujanTau(n: bigint): bigint | undefined {
  if (n < 1n || n > 4000n) return undefined;
  const degree = Number(n) - 1;
  let poly = Array.from<bigint>({ length: degree + 1 }).fill(0n);
  poly[0] = 1n;
  for (let k = 1; k <= degree; k++) {
    const factor = Array.from<bigint>({ length: degree + 1 }).fill(0n);
    for (let j = 0; j <= 24 && j * k <= degree; j++) {
      factor[j * k] = binomialBig(24n, BigInt(j)) * (j % 2 === 0 ? 1n : -1n);
    }
    const next = Array.from<bigint>({ length: degree + 1 }).fill(0n);
    for (let a = 0; a <= degree; a++) {
      if (poly[a] === 0n) continue;
      for (let b = 0; a + b <= degree; b++) {
        if (factor[b] === 0n) continue;
        next[a + b]! += poly[a]! * factor[b]!;
      }
    }
    poly = next;
  }
  return poly[degree]!;
}

/** The number q(n) of partitions of n into distinct parts, by the standard 0/1-knapsack DP
 *  over parts 1..n (Euler: as many as partitions into odd parts). */
function partitionsIntoDistinctParts(n: number): bigint {
  const dp = Array.from<bigint>({ length: n + 1 }).fill(0n);
  dp[0] = 1n;
  for (let part = 1; part <= n; part++) {
    for (let s = n; s >= part; s--) dp[s]! += dp[s - part]!;
  }
  return dp[n]!;
}

// The first 20 known Mersenne prime exponents, in order — proven complete this far since the
// 1950s, long before GIMPS. PerfectNumber and MersennePrimeExponent stay unevaluated past
// this table rather than searching for the next one.
const MERSENNE_EXPONENTS: readonly bigint[] = [
  2n,
  3n,
  5n,
  7n,
  13n,
  17n,
  19n,
  31n,
  61n,
  89n,
  107n,
  127n,
  521n,
  607n,
  1279n,
  2203n,
  2281n,
  3217n,
  4253n,
  4423n,
];

export function declareBacklog(ce: ComputeEngine): void {
  ce.declare("DivisorSum", {
    description:
      "The sum of f(d) over the positive divisors d of n, optionally only those with cond(d) true.",
    signature: "(integer, function, function?) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      const f = ops[1];
      if (n === undefined || n <= 0n || f === undefined) return undefined;
      const divisors = divisorsOf(n);
      if (divisors === undefined) return undefined;
      const cond = ops[2];
      let sum: BoxedExpression = ce.Zero;
      for (const d of divisors) {
        const dExpr = ce.number(d);
        if (cond !== undefined && !isTrue(applyFn(ce, cond, dExpr))) continue;
        sum = ce.function("Add", [sum, applyFn(ce, f, dExpr)]).evaluate();
      }
      return sum;
    },
  });

  ce.declare("IsCoprime", {
    description: "Tests whether the arguments are pairwise relatively prime.",
    signature: "(number+) -> boolean",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      if (ops.length < 2) return undefined;
      for (let i = 0; i < ops.length; i++) {
        for (let j = i + 1; j < ops.length; j++) {
          const g = ce.function("GCD", [ops[i]!, ops[j]!]).evaluate();
          if (bigIntegerAt(g) !== 1n) return ce.symbol("False");
        }
      }
      return ce.symbol("True");
    },
  });

  ce.declare("IsPrimePower", {
    description: "Tests whether n is a positive integer power of a single prime.",
    signature: "(integer) -> boolean",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      if (n === undefined) return undefined;
      if (n < 2n) return ce.symbol("False");
      const factors = factorInteger(n);
      if (factors === undefined) return undefined;
      return ce.symbol(factors.length === 1 ? "True" : "False");
    },
  });

  ce.declare("LiouvilleLambda", {
    description: "λ(n) = (−1)^Ω(n), Ω the count of prime factors of n counted with multiplicity.",
    signature: "(integer) -> integer",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      if (n === undefined || n === 0n) return undefined;
      const factors = factorInteger(n < 0n ? -n : n);
      if (factors === undefined) return undefined;
      const omega = factors.reduce((sum, [, e]) => sum + e, 0);
      return ce.number(omega % 2 === 0 ? 1 : -1);
    },
  });

  ce.declare("MangoldtLambda", {
    description: "Λ(n) = ln p when n is a power of the prime p, else 0.",
    signature: "(integer) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      if (n === undefined || n < 1n) return undefined;
      if (n === 1n) return ce.Zero;
      const factors = factorInteger(n);
      if (factors === undefined) return undefined;
      return factors.length === 1
        ? ce.function("Ln", [ce.number(factors[0]![0])]).evaluate()
        : ce.Zero;
    },
  });

  ce.declare("MersennePrimeExponent", {
    description: "The exponent p of the nth Mersenne prime 2ᵖ−1, from the known table.",
    signature: "(integer) -> integer",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      if (n === undefined || n < 1n || n > BigInt(MERSENNE_EXPONENTS.length)) return undefined;
      return ce.number(MERSENNE_EXPONENTS[Number(n) - 1]!);
    },
  });

  ce.declare("PerfectNumber", {
    description:
      "The nth perfect number, 2^(p−1)(2^p−1) for the nth known Mersenne prime exponent p.",
    signature: "(integer) -> integer",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      if (n === undefined || n < 1n || n > BigInt(MERSENNE_EXPONENTS.length)) return undefined;
      const p = MERSENNE_EXPONENTS[Number(n) - 1]!;
      return ce.number((1n << (p - 1n)) * ((1n << p) - 1n));
    },
  });

  ce.declare("PartitionsQ", {
    description: "q(n): the number of partitions of n into distinct parts.",
    signature: "(integer) -> integer",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      if (n === undefined || n < 0n || n > 10_000n) return undefined;
      return ce.number(partitionsIntoDistinctParts(Number(n)));
    },
  });

  ce.declare("PowersRepresentations", {
    description:
      "The ways to write n as a sum of k non-negative pth powers, as non-decreasing lists.",
    signature: "(integer, integer, integer) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      const k = bigIntegerAt(ops[1]);
      const p = bigIntegerAt(ops[2]);
      if (
        n === undefined ||
        k === undefined ||
        p === undefined ||
        n < 0n ||
        k < 0n ||
        k > 16n ||
        p < 1n
      )
        return undefined;
      const reps = powersRepresentations(n, Number(k), p);
      return ce.function(
        "List",
        reps.map((rep) =>
          ce.function(
            "List",
            rep.map((x) => ce.number(x)),
          ),
        ),
      );
    },
  });

  ce.declare("RamanujanTau", {
    description: "Ramanujan's τ: the coefficients of the discriminant form Δ(q)=q∏(1−qⁿ)²⁴.",
    signature: "(integer) -> integer",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      if (n === undefined) return undefined;
      const tau = ramanujanTau(n);
      return tau === undefined ? undefined : ce.number(tau);
    },
  });

  ce.declare("SquaresR", {
    description:
      "r_d(n): the number of ways to write n as an ordered sum of d squares, signs counted.",
    signature: "(integer, integer) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const d = bigIntegerAt(ops[0]);
      const n = bigIntegerAt(ops[1]);
      if (d === undefined || n === undefined || d < 0n || d > 12n) return undefined;
      return ce.number(squaresR(Number(d), n));
    },
  });

  ce.declare("EulerE", {
    description: "The Euler numbers Eₙ, or — with x — the Euler polynomials Eₙ(x).",
    signature: "(value, expression?) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => {
      if (ops[1] === undefined && ops[0]?.operator === "List") {
        const ns = operandsOf(ops[0]).map(bigIntegerAt);
        if (ns.some((v) => v === undefined || v < 0n)) return undefined;
        const values = ns as bigint[];
        const maxN = Number(values.reduce((a, b) => (a > b ? a : b)));
        const E = eulerNumbers(maxN);
        return ce.function(
          "List",
          values.map((v) => ce.number(E[Number(v)]!)),
        );
      }
      const n = bigIntegerAt(ops[0]);
      if (n === undefined || n < 0n || n > 2000n) return undefined;
      const E = eulerNumbers(Number(n));
      if (ops[1] === undefined) return ce.number(E[Number(n)]!);
      return polynomialExpr(ce, eulerPolynomialCoeffs(Number(n), E), ops[1]);
    },
  });

  ce.declare("FrobeniusSolve", {
    description: "Every non-negative integer solution x of a·x = b, lexicographically.",
    signature: "(list<integer>, integer) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const coeffs = operandsOf(ops[0]).map(bigIntegerAt);
      const b = bigIntegerAt(ops[1]);
      if (
        coeffs.length === 0 ||
        coeffs.some((c) => c === undefined || c <= 0n) ||
        b === undefined ||
        b < 0n
      )
        return undefined;
      const solutions = frobeniusSolve(coeffs as bigint[], b);
      return ce.function(
        "List",
        solutions.map((sol) =>
          ce.function(
            "List",
            sol.map((x) => ce.number(x)),
          ),
        ),
      );
    },
  });

  ce.declare("FrobeniusNumber", {
    description:
      "The largest integer that is not a non-negative integer combination of the given ones.",
    signature: "(list<integer>) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const values = operandsOf(ops[0]).map(bigIntegerAt);
      if (values.length === 0 || values.some((v) => v === undefined)) return undefined;
      const result = frobeniusNumber(values as bigint[]);
      if (result === undefined) return undefined;
      return result === "infinite" ? ce.symbol("PositiveInfinity") : ce.number(result);
    },
  });
}
