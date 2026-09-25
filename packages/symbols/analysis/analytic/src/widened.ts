import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt, mayBeInteger, widenSignature, wrapOperator } from "@enumeratio/boxed";

// compute-engine's Gamma-built combinatorial heads, widened to the exact values Wolfram gives
// and the native handler leaves unevaluated or rejects: Binomial, Beta and CatalanNumber at
// half-integers, n!! at negative odd n, and the Bernoulli polynomial BernoulliB(n, x). Each
// wrapper applies only to what the native handler does not answer, so no result
// compute-engine already gives changes. Declared by `declareAnalytic`.

type Ops = readonly BoxedExpression[];
export type Rational = readonly [bigint, bigint];

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const reduced = ([p, q]: Rational): Rational => {
  const g = gcd(p, q) * (q < 0n ? -1n : 1n);
  return [p / g, q / g];
};
const times = (a: Rational, b: Rational): Rational => reduced([a[0] * b[0], a[1] * b[1]]);
const over = (a: Rational, b: Rational): Rational => reduced([a[0] * b[1], a[1] * b[0]]);
const plus = (a: Rational, b: Rational): Rational => reduced([a[0] * b[1] + b[0] * a[1], a[1] * b[1]]);
const minus = (a: Rational, b: Rational): Rational => plus(a, [-b[0], b[1]]);

const factorial = (n: bigint): bigint => (n <= 1n ? 1n : n * factorial(n - 1n));

/**
 * Γ(x) = c·√π^h exactly, for x a positive integer (h = 0) or a half-integer (h = 1):
 * Γ(m + ½) = (2m)!/(4ᵐ m!)·√π, and Γ(½ − m) = (−4)ᵐ m!/(2m)!·√π. "pole" at the non-positive
 * integers; undefined for anything else.
 */
function gammaExact(x: Rational): { c: Rational; h: 0 | 1 } | "pole" | undefined {
  const [p, q] = x;
  if (q === 1n) return p <= 0n ? "pole" : { c: [factorial(p - 1n), 1n], h: 0 };
  if (q !== 2n) return undefined;
  const m = (p - 1n) / 2n; // x = m + ½; p is odd, so the division is exact
  if (m >= 0n) return { c: reduced([factorial(2n * m), 4n ** m * factorial(m)]), h: 1 };
  const k = -m;
  return { c: reduced([(-4n) ** k * factorial(k), factorial(2n * k)]), h: 1 };
}

/**
 * ∏Γ(up) / ∏Γ(down) as an exact expression, when every argument is an integer or a
 * half-integer and none upstairs is a pole. A pole downstairs makes the whole ratio 0, since
 * 1/Γ is entire.
 */
function gammaRatio(
  ce: ComputeEngine,
  up: readonly Rational[],
  down: readonly Rational[],
): BoxedExpression | undefined {
  let c: Rational = [1n, 1n];
  let h = 0; // the power of √π
  for (const [xs, sign] of [
    [up, 1],
    [down, -1],
  ] as const) {
    for (const x of xs) {
      const g = gammaExact(x);
      if (g === undefined || (g === "pole" && sign === 1)) return undefined;
      if (g === "pole") return ce.Zero;
      c = sign === 1 ? times(c, g.c) : over(c, g.c);
      h += sign * g.h;
    }
  }
  return ce
    .function("Multiply", [ce.number([c[0], c[1]]), ce.function("Power", [ce.Pi, ce.number([h, 2])])])
    .evaluate();
}

/** The operands as rationals, when all are and at least one is not an integer. */
const halfIntegerCall = (ops: Ops): Rational[] | undefined => {
  const values = ops.map(bigRationalAt);
  if (values.some((q) => q === undefined || (q[1] !== 1n && q[1] !== 2n))) return undefined;
  const rationals = values as Rational[];
  return rationals.some(([, q]) => q === 2n) ? rationals : undefined;
};

const ONE: Rational = [1n, 1n];
const TWO: Rational = [2n, 1n];

/** Each head as a ratio of Gammas: [numerator arguments, denominator arguments], over as
 * many operands as `GAMMA_ARITY` gives it. */
const GAMMA_RATIOS: Record<string, (x: readonly Rational[]) => [Rational[], Rational[]]> = {
  // Γ(n + 1) / (Γ(k + 1) Γ(n − k + 1))
  Binomial: (x) => {
    const [n, k] = x as [Rational, Rational];
    return [[plus(n, ONE)], [plus(k, ONE), plus(minus(n, k), ONE)]];
  },
  // Γ(a) Γ(b) / Γ(a + b)
  Beta: (x) => {
    const [a, b] = x as [Rational, Rational];
    return [[a, b], [plus(a, b)]];
  },
  // Γ(2n + 1) / (Γ(n + 1) Γ(n + 2))
  CatalanNumber: (x) => {
    const [n] = x as [Rational];
    return [[plus(times(TWO, n), ONE)], [plus(n, ONE), plus(n, TWO)]];
  },
};

const GAMMA_ARITY: Record<string, number> = {
  Binomial: 2,
  Beta: 2,
  CatalanNumber: 1,
};

/**
 * Γ(x) as an exact expression, at an integer or half-integer x, reusing `gammaExact`
 * directly (as opposed to `gammaRatio`, which combines several Gammas into a ratio and
 * so treats a pole specially depending on which side of the ratio it's on). A bare
 * `Gamma(x)` has no "side" — a pole is just `ComplexInfinity` — and anything neither an
 * integer nor a half-integer is left for the caller to fall back on.
 */
export function gammaExactValue(ce: ComputeEngine, x: Rational): BoxedExpression | undefined {
  const g = gammaExact(x);
  if (g === undefined) return undefined;
  if (g === "pole") return ce.symbol("ComplexInfinity");
  return ce
    .function("Multiply", [ce.number([g.c[0], g.c[1]]), ce.function("Power", [ce.Pi, ce.number([g.h, 2])])])
    .evaluate();
}

export function declareWidened(ce: ComputeEngine): void {
  // CatalanNumber is natively typed `integer`; its half-integers have to get past boxing.
  widenSignature(ce, "CatalanNumber", "(number) -> number", mayBeInteger);
  for (const [head, ratio] of Object.entries(GAMMA_RATIOS)) {
    wrapOperator(
      ce,
      [head, 1, 1],
      (ops) => halfIntegerCall(ops) !== undefined,
      () => (ops) => {
        const [up, down] = ratio(halfIntegerCall(ops)!);
        return gammaRatio(ce, up, down);
      },
      GAMMA_ARITY[head],
    );
  }

  // (−2k − 1)!! = (−1)ᵏ / (2k − 1)!!, running the recurrence n!! = n·(n − 2)!! downwards.
  wrapOperator(
    ce,
    ["Factorial2", 1],
    (ops) => {
      const n = bigIntegerAt(ops[0]);
      return n !== undefined && n < 0n && -n % 2n === 1n;
    },
    () => (ops) => {
      const k = (-bigIntegerAt(ops[0])! - 1n) / 2n;
      let den = 1n;
      for (let j = 2n * k - 1n; j > 1n; j -= 2n) den *= j;
      return ce.number([k % 2n === 0n ? 1n : -1n, den]);
    },
    1,
  );

  // Wolfram's BernoulliB[n, x] is the Bernoulli polynomial, which is BernoulliPolynomial here.
  widenSignature(ce, "BernoulliB", "(integer, number?) -> number");
  wrapOperator(
    ce,
    ["BernoulliB", 1],
    () => true,
    () => (ops) => ce.function("BernoulliPolynomial", [...ops]).evaluate(),
    2,
  );

  // ψ(n) = H_{n−1} − γ, the standard digamma identity, exact at every positive integer n.
  // Digamma already threads over a list natively; wrapping the scalar case is enough.
  // `finish` follows the caller: N() wants a decimal (EulerGamma has no exact value to stop
  // at), plain evaluate() keeps the exact symbolic form.
  wrapOperator(
    ce,
    ["Digamma", 1],
    (ops) => {
      const n = bigIntegerAt(ops[0]);
      return n !== undefined && n > 0n;
    },
    () => (ops, options) => {
      const n = bigIntegerAt(ops[0])!;
      const expr = ce.function("Subtract", [
        ce.function("HarmonicNumber", [ce.number(n - 1n)]),
        ce.symbol("EulerGamma"),
      ]);
      return options.numericApproximation ? expr.N() : expr.evaluate();
    },
    1,
  );

  // Ln(−q) = Ln(q) + iπ for a positive rational q — the principal branch past the cut,
  // which is Wolfram's convention and matches what N(Ln(−q)) already gives; plain
  // evaluate() otherwise leaves a negative-real Ln symbolic.
  wrapOperator(
    ce,
    ["Ln", 1],
    (ops) => {
      const q = bigRationalAt(ops[0]);
      return q !== undefined && q[0] < 0n;
    },
    () => (ops, options) => {
      const [p, q] = bigRationalAt(ops[0])!;
      const expr = ce.function("Add", [
        ce.function("Ln", [ce.number([-p, q])]),
        ce.function("Multiply", ["ImaginaryUnit", "Pi"]),
      ]);
      return options.numericApproximation ? expr.N() : expr.evaluate();
    },
    1,
  );

  // Arcsin(x) past the real domain [−1, 1]: sign(x)·(π/2 − i·ln(|x| + √(x² − 1))), the
  // branch compute-engine's own N(Arcsin(x)) already takes (checked against Wolfram's
  // documented continuation). Exact at a rational |x| > 1; Arccos is not touched here, as
  // no reference example calls for it.
  wrapOperator(
    ce,
    ["Arcsin", 1],
    (ops) => {
      const q = bigRationalAt(ops[0]);
      return q !== undefined && (q[0] > q[1] || q[0] < -q[1]);
    },
    () => (ops, options) => {
      const [p, q] = bigRationalAt(ops[0])!;
      const negative = p < 0n;
      const absP = negative ? -p : p;
      const magnitude = ce.function("Add", [
        ce.number([absP, q]),
        ce.function("Sqrt", [ce.number([absP * absP - q * q, q * q])]),
      ]);
      const principal = ce.function("Subtract", [
        ce.function("Divide", ["Pi", 2]),
        ce.function("Multiply", ["ImaginaryUnit", ce.function("Ln", [magnitude])]),
      ]);
      const expr = negative ? ce.function("Negate", [principal]) : principal;
      return options.numericApproximation ? expr.N() : expr.evaluate();
    },
    1,
  );
}
