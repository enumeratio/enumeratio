import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/engine";

// Wolfram folds Floor/Ceil/Round of an exact numeric constant expression -- Pi, E, a
// sum/product/logarithm of them -- by evaluating it to enough precision and rounding;
// compute-engine's native handlers only fold at a plain float or exact rational and
// leave a symbolic constant like Pi as is. Floor/Ceil/Round are also idempotent, Max
// and Min drop an exactly-repeated argument (and compare a list of exact constants
// numerically), and IsOdd is False at a non-integer exact constant. Declared by
// `declareAnalytic`.
//
// Idempotence and the Max/Min pool comparison can hand back an exact symbolic operand
// (Pi, say) as is -- honoring `options.numericApproximation` there too, so N(Max(Pi, Pi))
// comes back as a decimal rather than the exact Pi evaluate() alone would give.

const KNOWN_CONSTANTS = new Set([
  "Pi",
  "ExponentialE",
  "EulerGamma",
  "GoldenRatio",
  "CatalanConstant",
  "MachineEpsilon",
]);

// Operators an exact-constant expression can be built from. Compute-engine has already
// evaluated every purely-numeric subexpression by the time a wrapped operator's `evaluate`
// runs, so a surviving Add/Multiply/etc. means some operand didn't reduce to a number --
// either a free variable or one of these irrational constants. The cheap check below
// (operator, and for a bare symbol its name) can't tell those apart; the handler settles
// it with a single N() and declines (returns undefined, same as the native handler would)
// when that isn't finite.
const CONSTANT_HEADS = new Set(["Negate", "Add", "Subtract", "Multiply", "Divide", "Power", "Sqrt", "Log"]);

/** O(1): reads only `operator`, and for a bare symbol its `symbol` name. */
function looksConstant(op: BoxedExpression): boolean {
  if (op.operator === "Symbol") return KNOWN_CONSTANTS.has(symbolNameOf(op) ?? "");
  return CONSTANT_HEADS.has(op.operator ?? "");
}

/** Digits carried past a value's integer part, so its fractional part is certain. */
const GUARD_DIGITS = 15;
/** The most digits a rounding evaluates at: the fewest a declared constant carries is
 *  Glaisher's 66 (const-glaisher.ts), and past them more precision only repeats them. A
 *  value too large for this many digits declines. */
const MAX_ROUNDING_DIGITS = 60;
/** How close the fractional part may come to a breakpoint (an integer, or ½ for Round)
 *  before the rounding declines: an exact zero in disguise lands right on one. */
const BREAKPOINT_MARGIN = new BigDecimal("1e-6");

type Rounding = "Floor" | "Ceil" | "Round";

/**
 * `name` of an exact real `x` as a bigint, from `x` at enough digits to hold its integer part
 * and `GUARD_DIGITS` more: `Round(Khinchin^100)` is the 43-digit 7975160530073655774671985794452796861418592,
 * not a double's 7.975160530073655e42. `undefined` when the value isn't real and finite,
 * needs more than `MAX_ROUNDING_DIGITS`, or its fractional part is within
 * `BREAKPOINT_MARGIN` of a breakpoint.
 */
function roundExactly(ce: ComputeEngine, name: Rounding, x: BoxedExpression): bigint | undefined {
  const rough = x.N();
  if (rough.im !== 0 || !Number.isFinite(rough.re)) return undefined;
  const digits = Math.max(1, Math.ceil(Math.log10(Math.abs(rough.re) + 1))) + GUARD_DIGITS;
  if (digits > MAX_ROUNDING_DIGITS) return undefined;
  const precision = ce.precision;
  let text: string;
  try {
    ce.precision = Math.max(precision, digits);
    const json = x.N().json;
    text = typeof json === "number" ? String(json) : ((json as { num?: string }).num ?? "");
  } finally {
    ce.precision = precision;
  }
  if (!/^-?[0-9.]+(e[-+]?[0-9]+)?$/.test(text)) return undefined;
  const value = new BigDecimal(text);
  const floor = value.floor();
  const fraction = value.sub(floor);
  const breakpoint = name === "Round" ? new BigDecimal("0.5") : new BigDecimal(0);
  const near = (b: BigDecimal): boolean => fraction.sub(b).abs().lte(BREAKPOINT_MARGIN);
  if (near(breakpoint) || (name !== "Round" && near(new BigDecimal(1)))) return undefined;
  const up = name === "Ceil" || (name === "Round" && fraction.gt(breakpoint));
  return floor.toBigInt() + (up ? 1n : 0n);
}

// Idempotence and folds of exact constants (Floor(Pi), Max(Pi, Pi)): the built-in lowering gives the same value.
const BUILTIN = { compile: "builtin" } as const;

function declareRoundingHead(ce: ComputeEngine, name: Rounding): void {
  // Idempotent: Floor(Floor(x)) = Floor(x), for whatever x -- the inner value is
  // already an integer (or stays symbolic, in which case nothing changes either way).
  wrapOperator(
    ce,
    [name, 1],
    (ops) => ops[0]?.operator === name,
    () => (ops, options) => (options.numericApproximation ? ops[0]!.N() : ops[0]),
    { ...BUILTIN, arity: 1 },
  );
  // An exact constant expression: compute-engine's own answer where it has one (Pi^40,
  // exactly), else the value at enough digits, rounded. A non-real or non-finite value is
  // another package's (complex Floor), not ours to end.
  wrapOperator(
    ce,
    [name, 1],
    (ops) => ops[0] !== undefined && looksConstant(ops[0]),
    (native) => (ops, options) => {
      const answer = native?.(ops, options);
      if (answer !== undefined && answer.operator !== name) return answer;
      const rounded = roundExactly(ce, name, ops[0]!);
      return rounded === undefined ? answer : ce.number(rounded);
    },
    { ...BUILTIN, arity: 1 },
  );
}

/** The pool Max/Min compare: a single List argument's elements, or the bare arguments. */
function pool(ops: readonly BoxedExpression[]): readonly BoxedExpression[] {
  return ops.length === 1 && ops[0]?.operator === "List" ? operandsOf(ops[0]) : ops;
}

function declareExtremum(ce: ComputeEngine, name: "Max" | "Min", better: (a: number, b: number) => boolean): void {
  // Idempotent: repeated identical arguments collapse to one, e.g. Max(x, x) = x.
  // `isSame` is a structural (non-evaluating) compare, cheap on the common case of
  // two distinct numbers or symbols.
  wrapOperator(
    ce,
    [name, 2],
    (ops) => ops.every((op) => op === ops[0] || op.isSame(ops[0])),
    () => (ops, options) => (options.numericApproximation ? ops[0]!.N() : ops[0]),
    { ...BUILTIN, arity: { min: 2 } },
  );
  // A pool of exact constants (Pi, E, ...): compare numerically, keep the exact form.
  wrapOperator(
    ce,
    [name, 1],
    (ops) => {
      const items = pool(ops);
      return items.length >= 2 && items.some(looksConstant);
    },
    (native) => (ops, options) => {
      const items = pool(ops);
      let best: { op: BoxedExpression; v: number } | undefined;
      for (const op of items) {
        const n = op.N();
        if (n.im !== 0 || !Number.isFinite(n.re)) return native?.(ops, options);
        if (best === undefined || better(n.re, best.v)) best = { op, v: n.re };
      }
      if (best === undefined) return native?.(ops, options);
      return options.numericApproximation ? best.op.N() : best.op;
    },
    { ...BUILTIN, arity: { min: 1 } },
  );
}

export function declareConstantRounding(ce: ComputeEngine): void {
  declareRoundingHead(ce, "Floor");
  declareRoundingHead(ce, "Ceil");
  declareRoundingHead(ce, "Round");
  declareExtremum(ce, "Max", (a, b) => a > b);
  declareExtremum(ce, "Min", (a, b) => a < b);

  // IsOdd(Pi) etc: a non-integer exact constant is never odd.
  wrapOperator(
    ce,
    ["IsOdd", 1],
    (ops) => ops[0] !== undefined && looksConstant(ops[0]),
    () => (ops) => {
      const n = ops[0]!.N();
      if (n.im !== 0 || !Number.isFinite(n.re) || Number.isInteger(n.re)) return undefined;
      return ce.False;
    },
    { ...BUILTIN, arity: 1 },
  );
}
