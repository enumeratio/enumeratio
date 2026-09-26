import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  integerAt,
  operandsOf,
  threadOverLists,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { valuation } from "@enumeratio/residues";
import { gaussianAt, gaussianExpression, isComplexGaussian } from "./boxed-gaussian.ts";
import { declareBacklog } from "./declare-backlog.ts";
import { declareFastFactorial } from "./declare-fast-factorial.ts";
import { declareFastGcd } from "./declare-fast-gcd.ts";
import { declareFastPrimes } from "./declare-fast-primes.ts";
import { declareFastRecurrence } from "./declare-fast-recurrence.ts";
import { declareGaussian, declareGaussianRationalGcdLcm, declareIntegerExponentGaussian } from "./declare-gaussian.ts";
import { declareWidened } from "./declare-widened.ts";
import { gaussianPowerModList } from "./gaussian-roots.ts";
import { type Gaussian, powerMod as gaussianPowerMod } from "./gaussian.ts";
import { hermiteDecomposition } from "./hermite.ts";
import { rationalReconstruction } from "./reconstruct.ts";
import { SUMMARIES } from "./summaries-data.ts";

// Number theory past ℤ/m, on top of @enumeratio/residues (declare that first): PowerMod and
// PowerModList reach ℤ[i], plus rational reconstruction, integer valuations and Hermite
// normal form. Every head stays unevaluated — never approximate — when it cannot answer.

export function declareNumberTheory(ce: ComputeEngine): void {
  declareGaussian(ce);
  declareGaussianRationalGcdLcm(ce);
  declareWidened(ce);
  declareBacklog(ce);

  // compute-engine's integer functions reject a list argument with a type error (or leave
  // the call unevaluated); Wolfram's thread over it: Totient([2, 4, 6]) is [1, 2, 2].
  threadOverLists(ce, [
    "Totient",
    "NextPrime",
    "NthPrime",
    "PrimePi",
    "FactorInteger",
    "Divisors",
    "PrimeNu",
    "PrimeOmega",
    "MoebiusMu",
    "IsSquareFree",
    "JacobiSymbol",
    "KroneckerSymbol",
    "LegendreSymbol",
    "DivisorSigma",
    "ExtendedGCD",
    "ModularInverse",
    "Multinomial",
    "CatalanNumber",
    "Subfactorial",
    "StirlingS1",
    "Stirling",
    "BellNumber",
    "Fibonacci",
    "LucasL",
    "CarmichaelLambda",
    "IsPerfect",
  ]);

  const list = (xs: readonly bigint[]): BoxedExpression =>
    ce.function(
      "List",
      xs.map((x) => ce.number(x)),
    );

  /** A call reaches into ℤ[i] when its base or modulus is a Gaussian integer off the real line. */
  const inGaussian = (ops: readonly BoxedExpression[]): boolean =>
    isComplexGaussian(ops[0]) || isComplexGaussian(ops[2]);

  /** The same list over ℤ[i] — beyond Wolfram, whose PowerModList stops at the integers. */
  const gaussianRoots = (ops: readonly BoxedExpression[]): Gaussian[] | undefined => {
    const [a, m] = [gaussianAt(ops[0]), gaussianAt(ops[2])];
    const exponent = bigRationalAt(ops[1]);
    if (a === undefined || m === undefined || exponent === undefined) return undefined;
    return gaussianPowerModList(a, exponent[0], exponent[1], m);
  };

  wrapOperator(
    ce,
    ["PowerModList", "a", "b", "m"],
    inGaussian,
    () => (ops) => {
      const found = gaussianRoots(ops);
      return found === undefined
        ? undefined
        : ce.function(
            "List",
            found.map((z) => gaussianExpression(ce, z)),
          );
    },
    3,
  );

  wrapOperator(
    ce,
    ["PowerMod", "a", "b", "m"],
    inGaussian,
    () => (ops) => {
      const [z, m] = [gaussianAt(ops[0]), gaussianAt(ops[2])];
      const exponent = bigRationalAt(ops[1]);
      if (z === undefined || m === undefined || exponent === undefined) return undefined;
      if (exponent[1] === 1n) {
        const value = gaussianPowerMod(z, exponent[0], m);
        return value === undefined ? undefined : gaussianExpression(ce, value);
      }
      const found = gaussianRoots(ops);
      return found === undefined || found.length === 0 ? undefined : gaussianExpression(ce, found[0]!);
    },
    3,
  );

  ce.declare("RationalReconstruction", {
    description: SUMMARIES.RationalReconstruction,
    signature: "(integer, integer, integer?, integer?) -> rational",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [a, m, n, d] = [0, 1, 2, 3].map((i) => bigIntegerAt(ops[i]));
      if (a === undefined || m === undefined) return undefined;
      if ((ops[2] !== undefined && n === undefined) || (ops[3] !== undefined && d === undefined)) return undefined;
      const found = rationalReconstruction(a, m, n, d);
      return found === undefined ? undefined : ce.number([found[0], found[1]]);
    },
  });

  // Wolfram's IntegerExponent[n, b]: the largest k with bᵏ | n; b defaults to 10, n = 0 gives
  // ∞. Rational integers here; ℤ[i] is declareIntegerExponentGaussian's, below, and a p-adic
  // valuation of a rational is AdicValuation's.
  ce.declare("IntegerExponent", {
    description: SUMMARIES.IntegerExponent,
    signature: "(number, number?) -> integer | number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      const b = ops[1] === undefined ? 10n : bigIntegerAt(ops[1]);
      if (n === undefined || b === undefined || b < 2n) return undefined;
      if (n === 0n) return ce.symbol("PositiveInfinity");
      return ce.number(valuation(n, b)[0]);
    },
  });
  // The Gaussian case: attached after IntegerExponent exists to declare in front of it.
  declareIntegerExponentGaussian(ce);

  // Wolfram's HermiteDecomposition[m] = {u, h}: u unimodular, u·m = h in Hermite normal form.
  ce.declare("HermiteDecomposition", {
    description: SUMMARIES.HermiteDecomposition,
    signature: "(list<list<integer>>) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const rows = operandsOf(ops[0]).map((row) => operandsOf(row).map(bigIntegerAt));
      const width = rows[0]?.length ?? 0;
      if (rows.length === 0 || rows.some((row) => row.length !== width || row.some((x) => x === undefined)))
        return undefined;
      const { u, h } = hermiteDecomposition(rows as bigint[][]);
      const matrix = (x: bigint[][]): BoxedExpression =>
        ce.function(
          "List",
          x.map((row) => list(row)),
        );
      return ce.function("List", [matrix(u), matrix(h)]);
    },
  });

  declareCombinatoricsGamma113(ce);
}

/**
 * #113: combinatorics heads through the Gamma function (real/complex arguments; symbolic
 * reduction), the Fibonacci/Lucas/Bell polynomial families, and the k > n boundary of the
 * Stirling numbers. Kept apart from the ℤ/m-adjacent code above, which this doesn't touch.
 */
function declareCombinatoricsGamma113(ce: ComputeEngine): void {
  /**
   * A genuinely non-real complex value (an evaluated `Complex`, `im !== 0`). `.im` is `NaN`
   * for a symbolic expression whose imaginary part is unknown rather than zero -- `NaN`
   * fails both the `undefined` and `!== 0` checks, so it has to be excluded explicitly.
   */
  const isNonReal = (op: BoxedExpression): boolean =>
    typeof op.im === "number" && Number.isFinite(op.im) && op.im !== 0;

  /** n(n-1)…(n-k+1), the falling factorial -- exact whenever `k` is a nonnegative integer. */
  const fallingFactorial = (n: BoxedExpression, k: number): BoxedExpression =>
    k <= 0
      ? ce.number(1)
      : ce
          .function(
            "Multiply",
            Array.from({ length: k }, (_, i) => ce.function("Subtract", [n, ce.number(i)])),
          )
          .evaluate();

  const smallFactorial = (k: number): bigint => {
    let f = 1n;
    for (let i = 2; i <= k; i++) f *= BigInt(i);
    return f;
  };

  const gamma = (x: BoxedExpression | number): BoxedExpression => ce.function("Gamma", [x]);
  const add = (...xs: (BoxedExpression | number)[]): BoxedExpression => ce.function("Add", xs);
  const sub = (a: BoxedExpression | number, b: BoxedExpression | number): BoxedExpression =>
    ce.function("Subtract", [a, b]);
  const mul = (...xs: (BoxedExpression | number)[]): BoxedExpression => ce.function("Multiply", xs);
  const div = (a: BoxedExpression | number, b: BoxedExpression | number): BoxedExpression =>
    ce.function("Divide", [a, b]);

  // Binomial(n, n-1) -> n, for symbolic n: recognised by VALUE (k reduces to n-1), not by
  // matching a literal Subtract node, so it also fires once k arrives pre-simplified.
  wrapOperator(
    ce,
    ["Binomial", "n", ["Subtract", "n", 1]],
    (ops) => integerAt(ops[0]) === undefined && sub(ops[0], ops[1]).evaluate().isSame(ce.number(1)),
    () => (ops) => ops[0],
    2,
  );

  // Binomial(n, n) -> 1 for symbolic n: choosing every one of n items is always 1 way,
  // recognised the same way as Binomial(n, n-1) above -- by value, so it also fires once
  // k arrives pre-simplified to something that just happens to equal n.
  wrapOperator(
    ce,
    ["Binomial", "n", "n"],
    (ops) => ops.length === 2 && integerAt(ops[0]) === undefined && sub(ops[0], ops[1]).evaluate().isSame(ce.Zero),
    () => () => ce.One,
  );

  // Binomial, CatalanNumber, Pochhammer, Multinomial, Factorial2 and Subfactorial through
  // the Gamma function, for real and complex arguments the native integer-only (or,
  // for Binomial/Pochhammer, real-only) declarations reject. Gamma is itself native and
  // already evaluates numerically for any real or complex argument -- including the
  // incomplete two-argument form Subfactorial needs -- so each of these builds the
  // ordinary Gamma-function identity and hands it to `.N()`.
  //
  // Each signature is widened to `any` in the slots that need it, gated so the ORIGINAL
  // native handler still only ever runs on the integer (or, for Binomial/Pochhammer, real)
  // arguments it already handled -- anything else reaches the wrapper below instead.
  const isInteger = (op: BoxedExpression): boolean => integerAt(op) !== undefined;
  // An inexact number -- `2.3`, `1.5 + 0.7i` -- is what the Gamma-ratio wrappers below are for.
  // Not an exact rational: CatalanNumber(1/2) and kin already have an exact closed form
  // elsewhere (analytic continuation via reflection), which a decimal approximation must not
  // shadow. And not a non-number either: a symbol, an `Interval`, an `Around` or a
  // `ProfiniteNumber` goes on down the handler chain, where whatever knows that kind of value
  // (analytic's tagged arithmetic, adeles) answers it -- rather than having a Gamma formula
  // built around it.
  const inexactNumber = (op: BoxedExpression): boolean =>
    (op as unknown as { isNumberLiteral?: boolean }).isNumberLiteral === true &&
    integerAt(op) === undefined &&
    bigRationalAt(op) === undefined;
  // The native handler takes everything the wrappers don't: integers and exact rationals, as
  // before, and every non-number, so the handlers beneath it still see those.
  const nativeTakes = (op: BoxedExpression): boolean => !inexactNumber(op);
  // Two exact numbers, for the Binomial gate below.
  const isExact = (op: BoxedExpression): boolean => integerAt(op) !== undefined || bigRationalAt(op) !== undefined;
  widenSignature(ce, "CatalanNumber", "(any) -> any", nativeTakes);
  widenSignature(ce, "Subfactorial", "(any) -> any", nativeTakes);
  widenSignature(ce, "Factorial2", "(any) -> any", nativeTakes);
  // Now zero-or-more arguments: Multinomial() is the empty product, 1, same convention as
  // Factorial(0) -- see the wrapOperator right below, which answers that specific call.
  widenSignature(ce, "Multinomial", "(any*) -> any", nativeTakes);

  // Multinomial() -- the empty product, by the same convention as Factorial(0) = 1 -- and
  // Multinomial(x) for any single x, symbolic or not: x!/x! = 1.
  wrapOperator(
    ce,
    ["Multinomial"],
    (ops) => ops.length <= 1,
    () => () => ce.One,
  );

  wrapOperator(
    ce,
    ["Binomial", ["Complex", 1, 1], 5],
    (ops) => isNonReal(ops[0]) || isNonReal(ops[1]),
    () => (ops) => {
      const [n, k] = ops;
      const kInt = integerAt(k);
      // An integer k stays EXACT, via the falling-factorial product -- Binomial(1+i, 5)
      // is the Gaussian rational -(1+i)/12, not a decimal approximation.
      if (kInt !== undefined && kInt >= 0) {
        return div(fallingFactorial(n, kInt), ce.number(smallFactorial(kInt))).evaluate();
      }
      return div(gamma(add(n, 1)), mul(gamma(add(k, 1)), gamma(add(sub(n, k), 1)))).N();
    },
    2,
  );

  wrapOperator(
    ce,
    ["CatalanNumber", 2.3],
    (ops) => inexactNumber(ops[0]),
    () => (ops) => {
      const n = ops[0];
      return div(gamma(add(mul(2, n), 1)), mul(gamma(add(n, 1)), gamma(add(n, 2)))).N();
    },
    1,
  );

  wrapOperator(
    ce,
    ["Pochhammer", ["Complex", 2, 5], ["Complex", 0, 8]],
    (ops) => isNonReal(ops[0]) || isNonReal(ops[1]),
    () => (ops) => {
      const [a, n] = ops;
      return div(gamma(add(a, n)), gamma(a)).N();
    },
    2,
  );

  // Pochhammer with a rational (or otherwise exact, non-integer) real order: the same
  // Gamma identity as the complex case above, but kept EXACT via `.evaluate()` rather
  // than forced to `.N()` -- Gamma is already exact at the integers and half-integers,
  // so (3/2)_(1/2) = Γ(2)/Γ(3/2) comes back as 2/√π rather than a decimal. A nonnegative
  // integer order is excluded -- that's the falling-factorial product above, kept exact
  // without going through Gamma at all.
  wrapOperator(
    ce,
    ["Pochhammer", ["Rational", 3, 2], ["Rational", 1, 2]],
    (ops) => {
      if (ops.length !== 2 || isNonReal(ops[0]) || isNonReal(ops[1])) return false;
      const nInt = integerAt(ops[1]);
      if (nInt !== undefined && nInt >= 0) return false;
      return isExact(ops[0]) && isExact(ops[1]);
    },
    () => (ops) => {
      const [a, n] = ops;
      return div(gamma(add(a, n)), gamma(a)).evaluate();
    },
  );

  wrapOperator(
    ce,
    ["Multinomial", 2.5, 1.5],
    // Fires once some part is a real or complex non-integer; but not if another part is
    // an exact non-integer rational, which stays for whatever already handles that case.
    (ops) => {
      const exactRational = (op: BoxedExpression) => integerAt(op) === undefined && bigRationalAt(op) !== undefined;
      return ops.some(inexactNumber) && !ops.some(exactRational);
    },
    () => (ops) => {
      const total = ce.function("Add", [...ops]);
      const denom = ce.function(
        "Multiply",
        ops.map((op) => gamma(add(op, 1))),
      );
      return div(gamma(add(total, 1)), denom).N();
    },
    { min: 1 },
  );

  // Factorial2's analytic continuation: 2^{(1+2x-cos πx)/4} π^{(cos πx - 1)/4} Γ(1 + x/2).
  wrapOperator(
    ce,
    ["Factorial2", 2.5],
    (ops) => inexactNumber(ops[0]) && !isNonReal(ops[0]),
    () => (ops) => {
      const x = ops[0];
      const pi = ce.symbol("Pi");
      const cosTerm = ce.function("Cos", [mul(pi, x)]);
      const twoPower = ce.function("Power", [2, div(sub(add(1, mul(2, x)), cosTerm), 4)]);
      const piPower = ce.function("Power", [pi, div(sub(cosTerm, 1), 4)]);
      return mul(twoPower, piPower, gamma(add(1, div(x, 2)))).N();
    },
    1,
  );

  // Subfactorial's Gamma form: D_n = Γ(n+1, -1) / e, the incomplete Gamma at -1.
  wrapOperator(
    ce,
    ["Subfactorial", 4.5],
    (ops) => inexactNumber(ops[0]),
    () => (ops) => {
      const n = ops[0];
      const incomplete = ce.function("Gamma", [add(n, 1), -1]);
      return div(incomplete, ce.symbol("ExponentialE")).N();
    },
    1,
  );

  // StirlingS1(n, k) and Stirling(n, k) are 0 whenever k > n ≥ 0 -- both currently left
  // unevaluated past the diagonal.
  for (const head of ["StirlingS1", "Stirling"] as const) {
    wrapOperator(
      ce,
      [head, 3, 5],
      (ops) => {
        const n = integerAt(ops[0]);
        const k = integerAt(ops[1]);
        return n !== undefined && k !== undefined && n >= 0 && k > n;
      },
      () => () => ce.Zero,
      2,
    );
  }

  // Widen Fibonacci and LucasL to a real index and an optional second (polynomial)
  // argument; gated so the native integer recurrence still only ever runs on the single
  // integer argument it already handled. Also accepts a `ProfiniteNumber` operand,
  // untouched here, so @enumeratio/adeles' own Fibonacci/LucasL extension (Lenstra's
  // profinite Fibonacci, chained in ahead of this one -- see engines.ts) still reaches it,
  // rather than this gate silently swallowing the call first.
  const acceptsIntegerOrProfinite = (op: BoxedExpression): boolean =>
    integerAt(op) !== undefined || op.operator === "ProfiniteNumber";
  widenSignature(ce, "Fibonacci", "(any, any?) -> any", acceptsIntegerOrProfinite);
  widenSignature(ce, "LucasL", "(any, any?) -> any", acceptsIntegerOrProfinite);
  widenSignature(ce, "BellNumber", "(any, any?) -> any", isInteger);

  // Fibonacci and Lucas at a real (non-integer) index, via Binet's formula: with
  // φ = (1+√5)/2, F_ν = (φ^ν - cos(πν) φ^{-ν}) / √5 and L_ν = φ^ν + cos(πν) φ^{-ν}.
  const goldenRatio = () => div(add(1, ce.function("Sqrt", [5])), 2);
  const cosPiTerm = (nu: BoxedExpression) =>
    mul(
      ce.function("Cos", [mul(ce.symbol("Pi"), nu)]),
      ce.function("Power", [goldenRatio(), ce.function("Negate", [nu])]),
    );

  // @enumeratio/adeles also extends Fibonacci/LucasL, for a `ProfiniteNumber` argument
  // (Lenstra's profinite Fibonacci) -- excluded here by head, defensively, on top of
  // `declareNumberTheory` running after `declareAdeles` in packages/reference/scripts/engines.ts.
  const isProfinite = (op: BoxedExpression): boolean => op.operator === "ProfiniteNumber";

  wrapOperator(
    ce,
    ["Fibonacci", 1.5],
    (ops) => inexactNumber(ops[0]) && !isProfinite(ops[0]),
    () => (ops) => {
      const nu = ops[0];
      return div(sub(ce.function("Power", [goldenRatio(), nu]), cosPiTerm(nu)), ce.function("Sqrt", [5])).N();
    },
    1,
  );

  wrapOperator(
    ce,
    ["LucasL", 2.5],
    (ops) => inexactNumber(ops[0]) && !isProfinite(ops[0]),
    () => (ops) => {
      const nu = ops[0];
      return add(ce.function("Power", [goldenRatio(), nu]), cosPiTerm(nu)).N();
    },
    1,
  );

  // Fibonacci(n, x), LucasL(n, x) and BellNumber(n, x): the polynomial families, exact for
  // a nonnegative integer order n and any exact x. Built by running each recurrence up to
  // n, expanding at every step so the Horner nesting never survives to the final term.
  const notMatrix = (op: BoxedExpression): boolean => op.operator !== "List";
  const expand = (expr: BoxedExpression): BoxedExpression => ce.function("Expand", [expr]).evaluate();

  wrapOperator(
    ce,
    ["Fibonacci", 7, "x"],
    (ops) => {
      if (isProfinite(ops[0])) return false;
      const n = integerAt(ops[0]);
      return n !== undefined && n >= 0 && notMatrix(ops[1]);
    },
    () => (ops) => {
      const n = integerAt(ops[0])!;
      const x = ops[1];
      let prev = ce.Zero; // F_0(x)
      let curr = ce.One; // F_1(x)
      for (let k = 2; k <= n; k++) {
        const next = expand(add(mul(x, curr), prev));
        prev = curr;
        curr = next;
      }
      return n === 0 ? prev : curr;
    },
    2,
  );

  // Fibonacci(nu, x) at a real (non-integer, or negative-integer) order nu: the
  // two-variable Binet formula. t^2 - x*t - 1 = 0 has roots r, -1/r with
  // r = (x + sqrt(x^2+4))/2; since (-1/r)^nu = cos(pi*nu) * r^-nu for real nu (the same
  // branch choice the single-argument Fibonacci(nu) rule above makes),
  // F_nu(x) = (r^nu - cos(pi*nu) * r^-nu) / sqrt(x^2+4). At x = 1 this is exactly the
  // single-argument formula above (r = phi, sqrt(x^2+4) = sqrt(5)).
  wrapOperator(
    ce,
    ["Fibonacci", 5.8, 3],
    (ops) => {
      if (ops.length !== 2 || isProfinite(ops[0]) || !notMatrix(ops[1])) return false;
      const n = integerAt(ops[0]);
      return n === undefined || n < 0;
    },
    () => (ops) => {
      const [nu, x] = ops;
      const discriminant = ce.function("Sqrt", [add(mul(x, x), 4)]);
      const root = div(add(x, discriminant), 2);
      const otherTerm = mul(
        ce.function("Cos", [mul(ce.symbol("Pi"), nu)]),
        ce.function("Power", [root, ce.function("Negate", [nu])]),
      );
      return div(sub(ce.function("Power", [root, nu]), otherTerm), discriminant).N();
    },
  );

  wrapOperator(
    ce,
    ["LucasL", 7, "x"],
    (ops) => {
      if (isProfinite(ops[0])) return false;
      const n = integerAt(ops[0]);
      return n !== undefined && n >= 0 && notMatrix(ops[1]);
    },
    () => (ops) => {
      const n = integerAt(ops[0])!;
      const x = ops[1];
      let prev = ce.number(2); // L_0(x)
      let curr = x; // L_1(x)
      for (let k = 2; k <= n; k++) {
        const next = expand(add(mul(x, curr), prev));
        prev = curr;
        curr = next;
      }
      return n === 0 ? prev : curr;
    },
    2,
  );

  wrapOperator(
    ce,
    ["BellNumber", 5, "x"],
    (ops) => {
      const n = integerAt(ops[0]);
      return n !== undefined && n >= 0 && notMatrix(ops[1]);
    },
    () => (ops) => {
      const n = integerAt(ops[0])!;
      const x = ops[1];
      const terms: BoxedExpression[] = [];
      for (let k = 0; k <= n; k++) {
        const stirling = ce.function("Stirling", [n, k]).evaluate();
        terms.push(k === 0 ? stirling : mul(stirling, ce.function("Power", [x, k])));
      }
      return ce.function("Add", terms).evaluate();
    },
    2,
  );

  // Performance overrides past this point — see declare-fast-recurrence.ts, declare-fast-
  // primes.ts and issue #205: fast doubling for Fibonacci/LucasL, a segmented sieve for
  // PrimePi/NthPrime/Prime(n). Attached last so they answer the plain-integer/plain-real
  // case directly rather than threading through every widened form declared above first.
  declareFastRecurrence(ce);
  declareFastPrimes(ce);
  declareFastFactorial(ce);
  declareFastGcd(ce);
}
