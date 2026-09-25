import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, operandsOf, wrapOperator } from "@enumeratio/boxed";
import { type EvalOptions, wantsNumber } from "./box.ts";
import { DOUBLE_DIGITS } from "./precise.ts";

// N(Sin(24^40)) used to come back as -0.0585563790319129867708 (Wolfram: 0.40008315271976604707).
// The cause: to numerically evaluate a non-lazy call, compute-engine evaluates its operand with
// `.N()` *before* handing it to Sin's own `evaluate` -- and `.N()` on an exact 56-digit integer
// rounds it down to `ce.precision` digits right away. Sin's own reduction mod 2*pi then runs on
// an already-mutilated value: a relative error of one part in 10^21 at a magnitude of 10^55 is an
// absolute error of ~10^34, utterly swamping the 2*pi period, so the "reduced" argument is
// essentially uncorrelated noise. This affects any circular function fed an exact integer,
// rational, or bignum decimal whose magnitude leaves double range (~2^53) -- native argument
// reduction has nothing left to reduce correctly by the time it runs.
//
// The fix: reach past the pre-rounded operand to the *canonical, pre-numericization* one, which
// `EvaluateHandlerOptions.expression.ops` still holds exactly (the same mechanism `Power` uses to
// read an exact rational exponent under `.N()` -- see its doc comment). Evaluate that (plain
// `.evaluate()`, not `.N()`) to fold it to an exact number, pull out an arbitrary-precision decimal
// from whichever representation compute-engine gave it (an exact rational, or a bignum literal's
// `numericValue.decimal`), and reduce mod 2*pi in `BigDecimal` at however many working digits the
// magnitude demands. `Sin`/`Cos` on the now-small `BigDecimal` are exact enough that
// Tan/Sec/Csc/Cot fall out as their ratios, and the whole computation never touches a `number`
// until the final rounding step.

/** Above this magnitude a double's ~15-17 significant digits can no longer pin down where the
 * argument falls in its 2*pi period, so it's worth reaching for the exact value instead. */
const HUGE_THRESHOLD = 2 ** 40;

/** Digits carried past the ones the answer needs, so the mod-2*pi cancellation (which eats
 * roughly `digits(|x|)` of them) still leaves plenty for a correctly-rounded result. */
const GUARD_DIGITS = 15;

/** True for a real, finite-magnitude number literal past `HUGE_THRESHOLD` -- exactly the shape
 * `evaluateHugeTrig` knows how to reduce. O(1), no allocation, no evaluation: reads the operand's
 * already-computed `re`/`im`, which is cheap whether or not the call fits. Every other shape (a
 * modest argument, a symbolic one, a complex one) falls straight through to native, so this has to
 * stay cheap -- Sin and Cos are hot heads. */
function isHugeReal(op: BoxedExpression): boolean {
  if (op.im !== 0) return false;
  const r = op.re;
  return !Number.isNaN(r) && Math.abs(r) > HUGE_THRESHOLD;
}

/** How many decimal digits `|value|`'s integer part has, from an exact bigint pair -- no float
 * conversion, so it stays right even when `num` has hundreds of digits. */
function integerDigitsOfRational(num: bigint, den: bigint): number {
  const n = num < 0n ? -num : num;
  const nd = n.toString().length;
  const dd = den.toString().length; // bigRationalAt guarantees den > 0
  return Math.max(nd - dd + 1, 1);
}

/** `expr`'s value as a `BigDecimal`'s significand/exponent, read directly off its `numericValue`
 * -- or undefined if it isn't stored that way (a plain machine number, or the exact-rational shape
 * `bigRationalAt` already covers). Read off the field itself rather than through `expr.bignumRe`,
 * which rounds to whatever `BigDecimal.precision` happens to be at the time; the whole point here
 * is to see every digit the literal actually has. */
function bignumDecimalOf(expr: BoxedExpression): BigDecimal | undefined {
  if (expr.im !== 0) return undefined;
  const value = (expr as { numericValue?: unknown }).numericValue;
  const decimal = (value as { decimal?: unknown } | undefined)?.decimal;
  return decimal instanceof BigDecimal ? decimal : undefined;
}

/** How many decimal digits `decimal`'s integer part has -- `value = significand * 10^exponent`,
 * so integer digits = digits(significand) + exponent (floored at 1). No `toNumber()` detour, which
 * would overflow to Infinity long before this matters. */
function integerDigitsOfDecimal(decimal: BigDecimal): number {
  const sig = decimal.significand < 0n ? -decimal.significand : decimal.significand;
  return Math.max(sig.toString().length + decimal.exponent, 1);
}

/** Which shape the exact value behind a number literal took: read off `expr` without any
 * precision-dependent arithmetic, so the digit count is known before `BigDecimal.precision` is set
 * for the reduction itself. */
type ExactValue =
  | { kind: "rational"; num: bigint; den: bigint; digits: number }
  | { kind: "decimal"; decimal: BigDecimal; digits: number };

/** The exact (or as-exact-as compute-engine stored it) value behind `expr`, plus how many digits
 * its integer part needs -- or undefined if `expr` isn't a real number literal at all (still
 * symbolic, e.g. a free variable slipped in as `expr`'s only operand and never folded by
 * `evaluate()`). Deliberately does no division or other `BigDecimal.precision`-dependent work: the
 * caller sizes the working precision from `digits` first, then calls `toBigDecimal` below. */
function bigValueOf(expr: BoxedExpression): ExactValue | undefined {
  const rational = bigRationalAt(expr);
  if (rational !== undefined) {
    const [num, den] = rational;
    return { kind: "rational", num, den, digits: integerDigitsOfRational(num, den) };
  }
  const decimal = bignumDecimalOf(expr);
  return decimal === undefined ? undefined : { kind: "decimal", decimal, digits: integerDigitsOfDecimal(decimal) };
}

/** `value` as a `BigDecimal`, at whatever `BigDecimal.precision` is currently set to -- the
 * rational branch's division is the only precision-dependent step in the whole pipeline, so it
 * runs here, after the caller has sized the working precision from `value.digits`. */
function toBigDecimal(value: ExactValue): BigDecimal {
  return value.kind === "rational" ? new BigDecimal(value.num).div(new BigDecimal(value.den)) : value.decimal;
}

/** `value` reduced to (-2*pi, 2*pi) at the working precision `BigDecimal.precision` is already
 * set to. Exact enough that `Sin`/`Cos` of the result are correct to the digits the caller asked
 * for, since `mod`'s internal division inherits that same working precision. */
function reduceMod2Pi(value: BigDecimal): BigDecimal {
  const twoPi = BigDecimal.PI.mul(2);
  return value.mod(twoPi);
}

type Circular = "Sin" | "Cos" | "Tan" | "Sec" | "Csc" | "Cot";

/** Sin/Cos/Tan/Sec/Csc/Cot of `expr`'s huge real argument, computed by reducing the exact value
 * mod 2*pi in `BigDecimal` and never touching a machine double until the final rounding -- or
 * undefined to decline (falls back to native) when `expr` didn't resolve to a real number after
 * all, or the ratio it needs (Tan, Sec, Csc, Cot) divides by an exact zero. */
function evaluateHugeTrig(ce: ComputeEngine, head: Circular, expr: BoxedExpression): BoxedExpression | undefined {
  const found = bigValueOf(expr.evaluate());
  if (found === undefined) return undefined;
  const targetDigits = Math.max(ce.precision, DOUBLE_DIGITS + 2);
  const workingDigits = found.digits + targetDigits + GUARD_DIGITS;
  const saved = BigDecimal.precision;
  try {
    BigDecimal.precision = workingDigits;
    const reduced = reduceMod2Pi(toBigDecimal(found));
    const sin = reduced.sin();
    const cos = reduced.cos();
    let result: BigDecimal;
    switch (head) {
      case "Sin":
        result = sin;
        break;
      case "Cos":
        result = cos;
        break;
      case "Tan":
        if (cos.isZero()) return ce.symbol("ComplexInfinity");
        result = sin.div(cos);
        break;
      case "Sec":
        if (cos.isZero()) return ce.symbol("ComplexInfinity");
        result = BigDecimal.ONE.div(cos);
        break;
      case "Csc":
        if (sin.isZero()) return ce.symbol("ComplexInfinity");
        result = BigDecimal.ONE.div(sin);
        break;
      case "Cot":
        if (sin.isZero()) return ce.symbol("ComplexInfinity");
        result = cos.div(sin);
        break;
    }
    const rounded = result.toPrecision(targetDigits);
    return ce.number(ce.precision > DOUBLE_DIGITS ? rounded.toPrecision(ce.precision) : rounded.toNumber());
  } finally {
    BigDecimal.precision = saved;
  }
}

/**
 * Wrap Sin, Cos, Tan, Sec, Csc and Cot so a huge real argument -- an exact integer or rational
 * (any magnitude), or a bignum decimal literal beyond `HUGE_THRESHOLD` -- gets reduced mod 2*pi in
 * arbitrary precision before the circular function runs, rather than losing the reduction to a
 * premature round to a machine double (or to `ce.precision`, under `N()`). A modest argument, a
 * symbolic one, or a complex one is untouched: `isHugeReal` sends it straight to native. Declared
 * by `declareAnalytic`.
 */
export function declareTrigReduction(ce: ComputeEngine): void {
  for (const head of ["Sin", "Cos", "Tan", "Sec", "Csc", "Cot"] as const) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => ops[0] !== undefined && isHugeReal(ops[0]),
      (native) => (ops, options) => {
        if (!wantsNumber(ops, options as EvalOptions)) return undefined; // plain evaluate(): stay symbolic
        // `options.expression.ops[0]` is compute-engine's own pre-numericization view of the
        // operand (see `EvaluateHandlerOptions.expression`'s doc comment) -- under `.N()`, `ops[0]`
        // itself has already been rounded to `ce.precision` digits by the time this runs, which is
        // exactly the precision this wrapper exists to recover. Only trusted when the operand count
        // still lines up (see that same doc comment on a dropped or flattened operand).
        const rawOps = operandsOf(options.expression);
        const rawOp = rawOps.length === ops.length ? rawOps[0] : undefined;
        const result = evaluateHugeTrig(ce, head, rawOp ?? ops[0]!);
        return result ?? native?.(ops, options);
      },
      1,
    );
  }
}
