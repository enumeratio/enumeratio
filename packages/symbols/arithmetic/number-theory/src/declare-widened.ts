import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  mayBeInteger,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { extendedGcd, factorInteger, isPrime } from "@enumeratio/residues";

// compute-engine's integer functions, widened to the arguments Wolfram also answers and the
// native handler leaves unevaluated or rejects: φ(0), σ of a negative order, the GCD and LCM
// of rationals, Mod's offset, and ExtendedGCD past two arguments. Each wrapper applies only
// to what the native handler does not answer, so no result compute-engine already gives changes.

type Ops = readonly BoxedExpression[];

const abs = (n: bigint): bigint => (n < 0n ? -n : n);
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? abs(a) : gcd(b, a % b));
const lcm = (a: bigint, b: bigint): bigint => (a === 0n || b === 0n ? 0n : abs(a * b) / gcd(a, b));

/** Every operand as a rational, when all are and at least one is not an integer. */
const properRationals = (ops: Ops): (readonly [bigint, bigint])[] | undefined => {
  const values = ops.map(bigRationalAt);
  if (values.some((q) => q === undefined)) return undefined;
  const rationals = values as (readonly [bigint, bigint])[];
  return rationals.some(([, den]) => den !== 1n) ? rationals : undefined;
};

export function declareWidened(ce: ComputeEngine): void {
  // Wolfram's EulerPhi[0] is 0, and EulerPhi[-n] = EulerPhi[n]; compute-engine asks for a
  // positive integer, so both a zero and a negative n need widening past it.
  widenSignature(ce, "Totient", "(number) -> integer", mayBeInteger);
  wrapOperator(
    ce,
    ["Totient", 1],
    (ops) => {
      const n = bigIntegerAt(ops[0]);
      return n !== undefined && n <= 0n;
    },
    () => (ops) => {
      const n = bigIntegerAt(ops[0])!;
      if (n === 0n) return ce.Zero;
      return ce.function("Totient", [ce.number(-n)]).evaluate();
    },
    1,
  );

  // σₖ(n) for k < 0 is σ₋ₖ(n) / n⁻ᵏ — the sum of 1/dᵏ over the divisors d of n.
  wrapOperator(
    ce,
    ["DivisorSigma", 1, 1],
    (ops) => {
      const [k, n] = ops.map(bigIntegerAt);
      return k !== undefined && k < 0n && n !== undefined && n > 0n;
    },
    () => (ops) => {
      const [k, n] = ops;
      return ce
        .function("Divide", [ce.function("DivisorSigma", [k!.neg(), n!]), ce.function("Power", [n!, k!.neg()])])
        .evaluate();
    },
    2,
  );

  // Wolfram counts a negative prime: NextPrime(n) for n < -2 is -p, the negation of the
  // largest prime p < -n. compute-engine's native handler only knows positive primes and
  // skips straight ahead to 2.
  widenSignature(ce, "NextPrime", "(number, number?) -> integer", mayBeInteger);
  wrapOperator(
    ce,
    ["NextPrime", 1, 1],
    (ops) => {
      const n = bigIntegerAt(ops[0]);
      return n !== undefined && n < -2n;
    },
    () => (ops) => {
      const n = bigIntegerAt(ops[0])!;
      for (let p = -n - 1n; p >= 2n; p--) if (isPrime(p)) return ce.number(-p);
      return ce.number(2);
    },
    1,
  );

  // NextPrime of a non-integer real or rational n: the smallest prime past ⌈n⌉ — a strictly
  // greater integer, since n is not one itself. compute-engine's native handler requires an
  // integer.
  wrapOperator(
    ce,
    ["NextPrime", 1, 1],
    (ops) => {
      if (bigIntegerAt(ops[0]) !== undefined) return false;
      const q = bigRationalAt(ops[0]);
      return (q !== undefined && q[1] !== 1n) || Number.isFinite(ops[0]?.re);
    },
    () => (ops) => {
      const q = bigRationalAt(ops[0]);
      let ceil: bigint;
      if (q !== undefined) {
        const [num, den] = q;
        const floor = (num - (((num % den) + den) % den)) / den;
        ceil = floor + 1n;
      } else {
        ceil = BigInt(Math.ceil(ops[0]!.re!));
      }
      for (let p = ceil < 2n ? 2n : ceil; ; p++) if (isPrime(p)) return ce.number(p);
    },
    1,
  );

  // DivisorSigma with a symbolic k: the symbolic sum of dᵏ over the divisors of n — n must
  // still be a concrete positive integer to enumerate the divisors at all.
  wrapOperator(
    ce,
    ["DivisorSigma", 1, 1],
    (ops) => {
      const n = bigIntegerAt(ops[1]);
      return n !== undefined && n > 0n && bigIntegerAt(ops[0]) === undefined && symbolNameOf(ops[0]!) !== undefined;
    },
    () => (ops) => {
      const divisors = operandsOf(ce.function("Divisors", [ops[1]!]).evaluate());
      if (divisors.length === 0) return undefined;
      return ce
        .function(
          "Add",
          divisors.map((d) => ce.function("Power", [d, ops[0]!])),
        )
        .evaluate();
    },
    2,
  );

  // DivisorSigma with a non-integer rational k: the exact sum Σ dᵏ over the divisors of n
  // — d^(1/2) for a non-square d is a genuine radical (Sqrt(2), Sqrt(3), …), so this stays
  // symbolic the same way the free-symbol-k wrapper above does, just for a concrete k that
  // happens not to be an integer instead of a free variable.
  wrapOperator(
    ce,
    ["DivisorSigma", 1, 1],
    (ops) => {
      const n = bigIntegerAt(ops[1]);
      const k = bigRationalAt(ops[0]);
      return ops.length === 2 && n !== undefined && n > 0n && k !== undefined && k[1] !== 1n;
    },
    () => (ops) => {
      const divisors = operandsOf(ce.function("Divisors", [ops[1]!]).evaluate());
      if (divisors.length === 0) return undefined;
      return ce
        .function(
          "Add",
          divisors.map((d) => ce.function("Power", [d, ops[0]!])),
        )
        .evaluate();
    },
  );

  // Over the rationals: gcd(p/q, …) = gcd(p, …)/lcm(q, …), and lcm(p/q, …) = lcm(p, …)/gcd(q, …) —
  // the largest rational whose integer multiples include all of them, and the smallest
  // positive one that is an integer multiple of each.
  for (const [head, onNumerators, onDenominators] of [
    ["GCD", gcd, lcm],
    ["LCM", lcm, gcd],
  ] as const) {
    wrapOperator(
      ce,
      [head, 1, 1],
      (ops) => properRationals(ops) !== undefined,
      () => (ops) => {
        const rationals = properRationals(ops)!;
        const num = rationals.map(([p]) => p).reduce(onNumerators);
        const den = rationals.map(([, q]) => q).reduce(onDenominators);
        return ce.number([num, den]);
      },
    );
  }

  // compute-engine's native GCD/LCM round a big integer through a double past ~2⁵³, giving a
  // wrong answer rather than an error: GCD(20!, 10¹⁰⁰+3) comes back 163840000 (right answer 7),
  // and LCM the same pair as a float. Every plain-integer call goes through bigints instead —
  // exact at every size, and unchanged from the native answer wherever that was already right.
  for (const [head, fold] of [
    ["GCD", gcd],
    ["LCM", lcm],
  ] as const) {
    wrapOperator(
      ce,
      [head, 1, 1],
      (ops) => ops.every((op) => bigIntegerAt(op) !== undefined),
      () => (ops) => ce.number(ops.map((op) => bigIntegerAt(op)!).reduce(fold)),
      { min: 1 },
    );
  }

  // IsSquareFree of a rational: numerator and denominator both squarefree — compute-engine's
  // native handler asks for an integer.
  const isSquareFreeInteger = (n: bigint): boolean | undefined => {
    const abs = n < 0n ? -n : n;
    if (abs <= 1n) return true;
    const factors = factorInteger(abs);
    return factors === undefined ? undefined : factors.every(([, e]) => e === 1);
  };
  wrapOperator(
    ce,
    ["IsSquareFree", 1],
    (ops) => {
      const q = bigRationalAt(ops[0]);
      return q !== undefined && q[1] !== 1n;
    },
    () => (ops) => {
      const [num, den] = bigRationalAt(ops[0])!;
      const squareFree = isSquareFreeInteger(num) && isSquareFreeInteger(den);
      return ce.symbol(squareFree ? "True" : "False");
    },
    1,
  );

  // IsSquareFree of a polynomial: gcd(f, ∂f/∂x) = 1 for every variable x present -- a
  // repeated factor p (multiplicity ≥ 2) divides ∂f/∂x for any x that p itself depends
  // on, so ONE variable finding a non-unit gcd is enough to answer False; concluding True
  // needs every variable to come back a unit. `IsSquareFree(f, x)` (Wolfram's variable
  // form) checks only that one x, treating every other symbol in f as a coefficient --
  // which is exactly what `PolynomialGCD(f, g, x)` itself already does. Both `D` and
  // `PolynomialGCD` are compute-engine's own; multivariate GCD (`x^3 - x^2 y`) and content
  // extraction are handled by its own `polynomialGCDMulti`/`PolynomialGCD` machinery, not
  // reimplemented here.
  widenSignature(ce, "IsSquareFree", "(any, any?) -> boolean");
  wrapOperator(
    ce,
    ["IsSquareFree", 1, 1],
    (ops) => {
      if (ops.length < 1 || ops.length > 2 || ops[0] === undefined) return false;
      if (ops[0].unknowns.length === 0) return false; // a plain number: leave to the other wrappers
      if (ops.length === 2 && symbolNameOf(ops[1]!) === undefined) return false;
      return true;
    },
    () => (ops) => {
      const f = ops[0]!;
      const variables = ops.length === 2 ? [symbolNameOf(ops[1]!)!] : f.unknowns;
      if (variables.length === 0) return undefined;
      for (const v of variables) {
        const derivative = ce.function("D", [f, ce.symbol(v)]).evaluate();
        const g = ce.function("PolynomialGCD", [f, derivative, ce.symbol(v)]).evaluate();
        if (g.unknowns.length > 0) return ce.False; // a non-unit gcd: a repeated factor in v
      }
      return ce.True;
    },
  );

  // FactorInteger of a rational p/q: the prime factors of p, and of q with their exponents
  // negated, merged — a prime cannot appear in both once p/q is reduced. compute-engine's
  // native handler asks for an integer.
  wrapOperator(
    ce,
    ["FactorInteger", 1],
    (ops) => {
      const q = bigRationalAt(ops[0]);
      return q !== undefined && q[1] !== 1n;
    },
    () => (ops) => {
      const [num, den] = bigRationalAt(ops[0])!;
      const numFactors = factorInteger(abs(num));
      const denFactors = factorInteger(den);
      if (numFactors === undefined || denFactors === undefined) return undefined;
      const sign: [bigint, number][] = num < 0n ? [[-1n, 1]] : [];
      const merged = [...sign, ...numFactors, ...denFactors.map(([p, e]) => [p, -e] as [bigint, number])].sort(
        ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
      );
      return ce.function(
        "List",
        merged.map(([p, e]) => ce.function("Tuple", [ce.number(p), ce.number(e)])),
      );
    },
    1,
  );

  // Wolfram's Listable GCD/LCM broadcasts a single list argument against the rest, held
  // fixed: GCD(12, {3,7,40}) is {3,1,4}. `threadOverLists` doesn't fit — it only widens a
  // head that otherwise rejects or ignores a list, and GCD/LCM already answer one by
  // flattening it into more arguments (kept, elsewhere, as a documented divergence); this
  // only takes over the one-list-argument shape, which nothing else already answers.
  for (const head of ["GCD", "LCM"] as const) {
    wrapOperator(
      ce,
      [head, 1, 1],
      (ops) => ops.filter((op) => op.operator === "List").length === 1,
      () => (ops) => {
        const index = ops.findIndex((op) => op.operator === "List");
        const items = operandsOf(ops[index]!);
        return ce.function(
          "List",
          items.map((item) =>
            ce
              .function(
                head,
                ops.map((op, i) => (i === index ? item : op)),
              )
              .evaluate(),
          ),
        );
      },
      { min: 2 },
    );
  }

  // Wolfram's Mod[m, n, d]: the x ≡ m (mod n) with d ≤ x < d + n. The operand types stay
  // `number` so the Gaussian Mod (declare-gaussian.ts) still reaches its handler.
  widenSignature(ce, "Mod", "(number, number, number?) -> number");
  wrapOperator(
    ce,
    ["Mod", 1, 1],
    () => true,
    () => (ops) => {
      const [m, n, d] = ops.map(bigIntegerAt);
      if (m === undefined || n === undefined || d === undefined || n === 0n) return undefined;
      const r = (m - d) % n;
      return ce.number(d + (r !== 0n && r < 0n !== n < 0n ? r + n : r));
    },
    3,
  );

  // compute-engine already has CarmichaelLambda and IsPerfect, undocumented here — the gaps
  // are Wolfram's λ(-n)=λ(n) and PerfectNumberQ's "no negative number is perfect", both of
  // which the native handlers currently leave unevaluated.
  wrapOperator(
    ce,
    ["CarmichaelLambda", 1],
    (ops) => {
      const n = bigIntegerAt(ops[0]);
      return n !== undefined && n < 0n;
    },
    (native) => (ops, options) => native?.([ce.number(-bigIntegerAt(ops[0])!)], options),
    1,
  );
  wrapOperator(
    ce,
    ["IsPerfect", 1],
    (ops) => {
      const n = bigIntegerAt(ops[0]);
      return n !== undefined && n < 0n;
    },
    () => () => ce.symbol("False"),
    1,
  );

  // Wolfram's ExtendedGCD accepts any number of arguments: {g, {x₁, …, xₙ}} with
  // g = Σ xᵢaᵢ = gcd(a₁, …, aₙ). Folds the two-argument case pairwise — after each step the
  // gcd-so-far's own coefficient distributes back over every earlier argument's — which is
  // ours' flat `Tuple(g, x₁, …, xₙ)` shape, the same divergence from Wolfram's nested one the
  // two-argument case already documents. Gaussian integers stay declare-gaussian.ts's: this
  // only fires when every operand reads as a plain bigint.
  widenSignature(ce, "ExtendedGCD", "(number, number, number*) -> tuple");
  wrapOperator(
    ce,
    ["ExtendedGCD", 1, 1, 1],
    (ops) => ops.every((op) => bigIntegerAt(op) !== undefined),
    () => (ops) => {
      const values = ops.map((op) => bigIntegerAt(op)!);
      let g = values[0]!;
      let coefficients = [1n];
      for (const value of values.slice(1)) {
        const [nextG, p, q] = extendedGcd(g, value);
        coefficients = [...coefficients.map((c) => c * p), q];
        g = nextG;
      }
      return ce.function(
        "Tuple",
        [g, ...coefficients].map((n) => ce.number(n)),
      );
    },
    { min: 3 },
  );
}
