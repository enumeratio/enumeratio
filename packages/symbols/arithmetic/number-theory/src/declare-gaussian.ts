import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  mayBeInteger,
  operandsOf,
  optionsOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { applyPatch, numberTheoryLargeIntegers } from "@enumeratio/for-compute-engine";
import { factorInteger, gcd as bigGcd, isPrime } from "@enumeratio/residues";
import { gaussianAt, gaussianExpression, isComplexGaussian } from "./boxed-gaussian.ts";
import {
  divideExact,
  divisorsGaussian,
  divisorSigmaGaussian,
  extendedGcd,
  factorGaussian,
  type Gaussian,
  gcd,
  integerExponentGaussian,
  inverseMod,
  isGaussianPrime,
  isReal,
  isSquareFreeGaussian,
  lcm,
  moebiusMuGaussian,
  mod,
  primeNuGaussian,
  primeOmegaGaussian,
  quotient,
} from "./gaussian.ts";
import { SUMMARIES } from "./summaries-data.ts";

// compute-engine's integer heads, carried into ℤ[i] the way Wolfram carries them: a Gaussian
// argument switches Mod, Quotient, GCD, LCM, ExtendedGCD and ModularInverse over on its own,
// and `GaussianIntegers -> True` asks IsPrime, FactorInteger and Divisors to read a rational
// integer in ℤ[i] (5 = (2 + i)(2 − i) is no longer prime). Each native head keeps its own
// handler for everything else: the signature is widened in place and the Gaussian case is
// attached in front.

type Ops = readonly BoxedExpression[];

/** Every operand a Gaussian integer, and at least one of them off the real line. */
const gaussianCall = (ops: Ops): Gaussian[] | undefined => {
  const values = ops.map(gaussianAt);
  if (values.some((z) => z === undefined) || !ops.some(isComplexGaussian)) return undefined;
  return values as Gaussian[];
};

/**
 * The `GaussianIntegers` option among the trailing rules: true, false, or undefined when absent.
 * Any other option leaves the call alone.
 */
function gaussianOption(head: string, ops: Ops): { positional: number; value?: boolean } | "other" {
  const split = optionsOf([head, ...ops.map((op) => op.json)] as never);
  const names = Object.keys(split.options);
  if (names.some((name) => name !== "GaussianIntegers")) return "other";
  const setting = split.options.GaussianIntegers;
  return {
    positional: split.ops.length,
    value: setting === undefined ? undefined : setting === "True",
  };
}

/** ⌊a/b⌋ for bigints, b ≠ 0. */
const floorDiv = (a: bigint, b: bigint): bigint => {
  const q = a / b;
  const r = a - q * b;
  return r !== 0n && r < 0n !== b < 0n ? q - 1n : q;
};

export function declareGaussian(ce: ComputeEngine): void {
  const list = (items: readonly BoxedExpression[]): BoxedExpression => ce.function("List", items);
  const g = (z: Gaussian | undefined): BoxedExpression | undefined =>
    z === undefined ? undefined : gaussianExpression(ce, z);

  widenSignature(ce, "Mod", "(number, number) -> number");
  wrapOperator(
    ce,
    ["Mod", 1, 1],
    (ops) => gaussianCall(ops) !== undefined,
    () => (ops) => {
      const [z, m] = gaussianCall(ops)!;
      return g(mod(z!, m!));
    },
    2,
  );

  // Wolfram's Quotient: ⌊m/n⌋ for integers — rational and real m, n included — with an
  // optional offset d shifting the remainder into [d, d+n); z/m rounded half-even for
  // Gaussian integers.
  ce.declare("Quotient", {
    description: SUMMARIES.Quotient,
    signature: "(number, number, number?) -> number",
    broadcastable: true,
    evaluate: (ops: Ops) => {
      if (ops.length < 2 || ops.length > 3) return undefined;
      const gaussian = ops.length === 2 ? gaussianCall(ops) : undefined;
      if (gaussian !== undefined) return g(quotient(gaussian[0]!, gaussian[1]!));
      const m = bigRationalAt(ops[0]);
      const n = bigRationalAt(ops[1]);
      const d = ops.length === 3 ? bigRationalAt(ops[2]) : ([0n, 1n] as const);
      if (m !== undefined && n !== undefined && d !== undefined) {
        const [mn, md] = m;
        const [nn, nd] = n;
        const [dn, dd] = d;
        if (nn === 0n) return undefined;
        // (m − d)/n, cross-multiplied to a single bigint ratio, then floored.
        const num = (mn * dd - dn * md) * nd;
        const den = md * dd * nn;
        return ce.number(floorDiv(num, den));
      }
      // A genuinely irrational operand: fall back to doubles.
      const [mr, nr, dr] = [ops[0]?.re, ops[1]?.re, ops.length === 3 ? ops[2]?.re : 0];
      if (
        mr !== undefined &&
        nr !== undefined &&
        dr !== undefined &&
        Number.isFinite(mr) &&
        Number.isFinite(nr) &&
        nr !== 0 &&
        Number.isFinite(dr)
      ) {
        return ce.number(Math.floor((mr - dr) / nr));
      }
      return undefined;
    },
  });

  for (const [head, fold] of [
    ["GCD", gcd],
    ["LCM", lcm],
  ] as const) {
    wrapOperator(
      ce,
      [head, 1, 1],
      (ops) => gaussianCall(ops) !== undefined,
      () => (ops) => g(gaussianCall(ops)!.reduce((acc, z) => fold(acc, z))),
    );
  }

  widenSignature(ce, "ExtendedGCD", "(number, number) -> tuple<number, number, number>", mayBeInteger);
  wrapOperator(
    ce,
    ["ExtendedGCD", 1, 1],
    // Exactly two: declare-widened.ts widens past that for plain integers, and a Gaussian
    // in a longer call falls through to it rather than have this handler silently drop
    // every operand past the second.
    (ops) => gaussianCall(ops) !== undefined,
    () => (ops) => {
      const [a, b] = gaussianCall(ops)!;
      return ce.function(
        "Tuple",
        extendedGcd(a!, b!).map((z) => gaussianExpression(ce, z)),
      );
    },
    2,
  );

  // The negative-modulus sign convention (ModularInverse(3, -7) = -2) moved to
  // @enumeratio/for-compute-engine's number-theory-large-integers patch, offered upstream
  // as cortex-js/compute-engine#339/#347 — applied here, in the same spot it used to run
  // in, so a real call falls through to it (via the native handler it wraps) once this
  // wrapper below declines. Only the genuinely Gaussian case (a or m off the real line)
  // is still ours: ℤ[i] is beyond Wolfram, not part of that issue.
  applyPatch(ce, numberTheoryLargeIntegers);
  widenSignature(ce, "ModularInverse", "(value, value) -> value", mayBeInteger);
  wrapOperator(
    ce,
    ["ModularInverse", 1, 1],
    (ops) => {
      const values = ops.map(gaussianAt);
      return values.every((z) => z !== undefined) && values.some((z) => !isReal(z!));
    },
    () => (ops) => {
      const [a, m] = ops.map(gaussianAt) as [Gaussian, Gaussian];
      return g(inverseMod(a, m));
    },
    2,
  );

  // The option heads. A complex argument is read in ℤ[i] as it stands; a rational integer
  // only when asked. `GaussianIntegers -> False` (or no option) is the rational-integer call:
  // `integer` where given (compute-engine's own factoriser gives up on p³ for a 21-digit p),
  // else — or when it declines — the native handler.
  const optionHead = (
    head: string,
    signature: string,
    native: ((op: BoxedExpression) => boolean) | undefined,
    answer: (z: Gaussian) => BoxedExpression | undefined,
    integer?: (n: bigint) => BoxedExpression | undefined,
  ): void => {
    widenSignature(ce, head, signature, native);
    const definition = ce.lookupDefinition(head);
    const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
    if (operator === undefined) return;
    // A rule canonicalises to a Tuple, which a broadcastable head would thread over.
    const flags = operator as { broadcastExemptions: readonly string[] };
    if (!flags.broadcastExemptions.includes("tuples")) {
      flags.broadcastExemptions = [...flags.broadcastExemptions, "tuples"];
    }
    const nativeEvaluate = operator.evaluate;
    const evaluate: typeof operator.evaluate = (ops, options) => {
      const option = gaussianOption(head, ops);
      if (option === "other" || option.positional !== 1) return undefined;
      // With the tuple exemption the engine no longer threads a list for us.
      if (ops[0]?.operator === "List") {
        return list(operandsOf(ops[0]).map((item) => evaluate!([item, ...ops.slice(1)], options)!));
      }
      const z = gaussianAt(ops[0]);
      if (z !== undefined && (z[1] !== 0n || option.value === true)) return answer(z);
      return (z !== undefined ? integer?.(z[0]) : undefined) ?? nativeEvaluate?.(ops.slice(0, 1), options);
    };
    operator.evaluate = evaluate;
  };

  optionHead(
    "IsPrime",
    "(number, any*) -> boolean",
    undefined,
    (z) => ce.symbol(isGaussianPrime(z) ? "True" : "False"),
    // Wolfram's PrimeQ counts a prime's associates: PrimeQ[-7] is True. compute-engine's
    // native IsPrime asks for a positive integer and answers False for any negative one —
    // an undefined corner we override rather than diverge on, matching Wolfram. Positive n
    // falls through (returns undefined) to the native handler, unchanged.
    (n) => (n < 0n ? ce.symbol(isPrime(-n) ? "True" : "False") : undefined),
  );
  // 0 and ±1 have no prime factorisation; the native handler spells them as Wolfram does.
  const factorsOf = (n: bigint): [bigint, number][] | undefined => (n > 1n || n < -1n ? factorInteger(n) : undefined);
  const pairs = (factors: readonly (readonly [BoxedExpression, number])[]): BoxedExpression =>
    list(factors.map(([p, e]) => ce.function("Tuple", [p, ce.number(e)])));

  optionHead(
    "FactorInteger",
    "(number, any*) -> list",
    mayBeInteger,
    (z) => {
      const factors = factorGaussian(z);
      return factors === undefined ? undefined : pairs(factors.map(([p, e]) => [gaussianExpression(ce, p), e]));
    },
    (n) => {
      const factors = factorsOf(n);
      if (factors === undefined) return undefined;
      const sign: [bigint, number][] = n < 0n ? [[-1n, 1]] : [];
      return pairs([...sign, ...factors].map(([p, e]) => [ce.number(p), e]));
    },
  );
  optionHead(
    "Divisors",
    "(number, any*) -> list",
    mayBeInteger,
    (z) => {
      const divisors = divisorsGaussian(z);
      return divisors === undefined ? undefined : list(divisors.map((d) => gaussianExpression(ce, d)));
    },
    (n) => {
      const factors = factorsOf(n);
      if (factors === undefined) return undefined;
      let divisors = [1n];
      for (const [p, e] of factors) {
        divisors = divisors.flatMap((d) => Array.from({ length: e + 1 }, (_, k) => d * p ** BigInt(k)));
      }
      divisors.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      return list(divisors.map((d) => ce.number(d)));
    },
  );

  // PrimeNu, PrimeOmega, MoebiusMu and IsSquareFree already answer plain integers (widened in
  // declare.ts's threadOverLists); only the `GaussianIntegers -> True` read of a rational
  // integer, and a Gaussian argument off the real line, are new here.
  const bool = (value: boolean): BoxedExpression => ce.symbol(value ? "True" : "False");

  optionHead("PrimeNu", "(number, any*) -> integer", undefined, (z) => {
    const count = primeNuGaussian(z);
    return count === undefined ? undefined : ce.number(count);
  });
  optionHead("PrimeOmega", "(number, any*) -> integer", undefined, (z) => {
    const count = primeOmegaGaussian(z);
    return count === undefined ? undefined : ce.number(count);
  });
  optionHead("MoebiusMu", "(number, any*) -> integer", undefined, (z) => {
    const mu = moebiusMuGaussian(z);
    return mu === undefined ? undefined : ce.number(mu);
  });
  optionHead("IsSquareFree", "(number, any*) -> boolean", undefined, (z) => {
    const squareFree = isSquareFreeGaussian(z);
    return squareFree === undefined ? undefined : bool(squareFree);
  });

  // DivisorSigma(k, n, GaussianIntegers -> True): two positional arguments ahead of the
  // option, so it needs its own wiring rather than `optionHead`'s single-positional one.
  // Widened first so a Complex n, or a trailing option tuple, reach `evaluate` at all.
  widenSignature(ce, "DivisorSigma", "(number, number, any*) -> number");
  const nativeDivisorSigma = ce.lookupDefinition("DivisorSigma");
  const divisorSigmaOperator =
    nativeDivisorSigma !== undefined && "operator" in nativeDivisorSigma ? nativeDivisorSigma.operator : undefined;
  if (divisorSigmaOperator !== undefined) {
    // declare.ts marks DivisorSigma broadcastable, for the list-in-n case; without this a
    // rule canonicalising to a Tuple (the GaussianIntegers option) gets threaded over too.
    const flags = divisorSigmaOperator as { broadcastExemptions: readonly string[] };
    if (!flags.broadcastExemptions.includes("tuples")) {
      flags.broadcastExemptions = [...flags.broadcastExemptions, "tuples"];
    }
    const nativeEvaluate = divisorSigmaOperator.evaluate;
    divisorSigmaOperator.evaluate = (ops, options) => {
      const option = gaussianOption("DivisorSigma", ops);
      if (option !== "other" && option.positional === 2) {
        const k = bigIntegerAt(ops[0]);
        const z = gaussianAt(ops[1]);
        if (k !== undefined && z !== undefined && (z[1] !== 0n || option.value === true)) {
          const sum = divisorSigmaGaussian(k, z);
          if (sum !== undefined) return gaussianExpression(ce, sum);
        }
      }
      return nativeEvaluate?.(ops, options);
    };
  }
}

/**
 * IntegerExponent(z, b) over ℤ[i]: both arguments read in ℤ[i] once either is off the real
 * line — no GaussianIntegers option, the way PowerMod's Gaussian case also switches on its
 * operands. Declared after `IntegerExponent` itself (declare.ts), unlike the rest of this
 * module, since the head is ours rather than compute-engine's native one.
 */
export function declareIntegerExponentGaussian(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["IntegerExponent", 1, 1],
    (ops) => gaussianCall(ops) !== undefined,
    () => (ops) => {
      const [z, b] = gaussianCall(ops)!;
      const k = integerExponentGaussian(z!, b!);
      return k === undefined ? undefined : ce.number(k);
    },
    2,
  );
}

// ─── GCD/LCM of Gaussian rationals ──────────────────────────────────────────────────────
//
// The same generalization Wolfram gives plain rationals -- gcd(p1/q1, p2/q2) =
// gcd(p1,p2)/lcm(q1,q2), lcm(p1/q1, p2/q2) = lcm(p1,p2)/gcd(q1,q2), for p/q already in
// lowest terms -- carried into ℤ[i]. Every Gaussian rational a+bi (a, b ∈ ℚ) has a unique
// (up to unit) numerator n ∈ ℤ[i] and denominator d ∈ ℤ⁺ with a+bi = n/d and d the LCM of
// a and b's own denominators: `numeratorDenominator` reads that pair straight off the
// boxed expression, and the fold below is the plain-rational identity above, over ℤ[i]'s
// own gcd/lcm (gaussian.ts) instead of ℤ's.
//
// Disjoint from the pure-Gaussian-integer wrapper earlier in this file: gated on at least
// one operand actually carrying a denominator > 1, so a call every operand of which is
// already a Gaussian integer still reaches that handler (attached first, captured as this
// wrapper's `native` fallback) unchanged.

interface GaussianRational {
  readonly n: Gaussian; // numerator, a Gaussian integer
  readonly d: bigint; // denominator, a positive rational integer -- lcm(denom(re), denom(im))
}

/** `a+bi` (a, b ∈ ℚ) as a numerator/denominator pair, or `undefined` if either part isn't
 *  an exact rational (a float, a free variable, an irrational constant, …). */
function numeratorDenominator(ce: ComputeEngine, expr: BoxedExpression | undefined): GaussianRational | undefined {
  if (expr === undefined) return undefined;
  let reRat = bigRationalAt(expr);
  let imRat: readonly [bigint, bigint] | undefined = [0n, 1n];
  if (reRat === undefined) {
    const json = expr.json;
    if (!Array.isArray(json) || json[0] !== "Complex") return undefined;
    reRat = bigRationalAt(ce.box(json[1] as never));
    imRat = bigRationalAt(ce.box(json[2] as never));
  }
  if (reRat === undefined || imRat === undefined) return undefined;
  const [reN, reD] = reRat;
  const [imN, imD] = imRat;
  const d = (reD * imD) / bigGcd(reD, imD); // lcm(reD, imD)
  return { n: [reN * (d / reD), imN * (d / imD)], d };
}

function declareGaussianRationalGcdLcm(ce: ComputeEngine): void {
  const parse = (expr: BoxedExpression): GaussianRational | undefined => numeratorDenominator(ce, expr);
  const applies = (ops: readonly BoxedExpression[]): boolean => {
    if (ops.length < 2) return false;
    const parsed = ops.map(parse);
    if (parsed.some((r) => r === undefined)) return false;
    return parsed.some((r) => r!.d !== 1n); // otherwise the plain Gaussian-integer path answers it
  };

  wrapOperator(ce, ["GCD", 1, 1], applies, () => (ops) => {
    const rs = ops.map(parse) as GaussianRational[];
    const n = rs.map((r) => r.n).reduce((a, b) => gcd(a, b));
    const d = rs.map((r) => r.d).reduce((a, b) => (a * b) / bigGcd(a, b)); // lcm of denominators
    const scaled = divideExact(n, [d, 0n]);
    return scaled !== undefined ? gaussianExpression(ce, scaled) : rationalGaussianExpr(ce, n, d);
  });

  wrapOperator(ce, ["LCM", 1, 1], applies, () => (ops) => {
    const rs = ops.map(parse) as GaussianRational[];
    const n = rs.map((r) => r.n).reduce((a, b) => lcm(a, b));
    const d = rs.map((r) => r.d).reduce((a, b) => bigGcd(a, b)); // gcd of denominators
    const scaled = divideExact(n, [d, 0n]);
    return scaled !== undefined ? gaussianExpression(ce, scaled) : rationalGaussianExpr(ce, n, d);
  });
}

/** `n/d` as a `Complex(Rational, Rational)`, for when `d` doesn't divide `n` evenly in ℤ[i]. */
function rationalGaussianExpr(ce: ComputeEngine, n: Gaussian, d: bigint): BoxedExpression {
  const part = (num: bigint): BoxedExpression =>
    d === 1n ? ce.number(num) : ce.function("Rational", [ce.number(num), ce.number(d)]).evaluate();
  const re = part(n[0]);
  const im = part(n[1]);
  return n[1] === 0n ? re : ce.function("Complex", [re, im]);
}

export { declareGaussianRationalGcdLcm };
