import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";
import { declareAdic } from "./adic-declare.ts";
import {
  adicNumerals,
  balancedRadix,
  bijectiveRadix,
  combinatorialSystem,
  factoradic,
  mixedRadix,
  negativeRadix,
  type DigitBound,
  type NumeralSystem,
  ostrowski,
  primorialRadix,
  radix,
  residueSystem,
  type Shape,
  zeckendorf,
} from "./systems.ts";

// compute-engine already has `IntegerDigits(n, base)` and `FromDigits(digits, base)`,
// and they already do fixed radix. So this adds no head for the common case — it widens
// the BASE SLOT to accept a system, the way Wolfram's `IntegerDigits[n, MixedRadix[…]]`
// does. An integer base still goes to the native handler untouched.
//
// The systems are the point: `Factoradic`, `Zeckendorf`, `BalancedRadix(3)`,
// `NegativeRadix(2)`, `BijectiveRadix(26)`, `MixedRadix([…])`, `PrimorialRadix`,
// `CombinatorialSystem(k)`, `ResidueSystem([…])` and `AdicNumerals(b)` are all just values
// in that slot. `AdicNumeral` (singular) is the b-adic VALUE, with its arithmetic.

type NativeEvaluate = NonNullable<BoxedExpression["operatorDefinition"]>["evaluate"];
type EvaluateOptions = Parameters<NonNullable<NativeEvaluate>>[1];

/** Read a `List(...)` of integers. */
function integerList(expr: BoxedExpression | undefined): number[] | undefined {
  if (expr === undefined || expr.operator !== "List") return undefined;
  const values = operandsOf(expr).map(integerAt);
  return values.every((v): v is number => v !== undefined) ? values : undefined;
}

/** Heads that name a system taking one integer argument. */
const ONE_ARGUMENT: Record<string, (k: number) => NumeralSystem | undefined> = {
  Radix: radix,
  BalancedRadix: balancedRadix,
  NegativeRadix: negativeRadix,
  BijectiveRadix: bijectiveRadix,
  CombinatorialSystem: combinatorialSystem,
};

/** Heads that name a system taking an integer and an optional precision. */
const TWO_ARGUMENT: Record<string, (k: number, prec?: number) => NumeralSystem | undefined> = {
  AdicNumerals: adicNumerals,
};

/** Heads that name a system taking a list of integers. */
const LIST_ARGUMENT: Record<string, (xs: readonly number[]) => NumeralSystem | undefined> = {
  MixedRadix: mixedRadix,
  ResidueSystem: residueSystem,
  Ostrowski: ostrowski,
};

/** Heads that name a system on their own. */
const NULLARY: Record<string, () => NumeralSystem> = {
  Factoradic: factoradic,
  PrimorialRadix: primorialRadix,
  Zeckendorf: zeckendorf,
};

export const SYSTEM_HEADS: readonly string[] = [
  ...Object.keys(ONE_ARGUMENT),
  ...Object.keys(TWO_ARGUMENT),
  ...Object.keys(LIST_ARGUMENT),
  ...Object.keys(NULLARY),
];

/**
 * Read an expression in the base slot as a numeral system. A plain integer is NOT read
 * here: it is left to compute-engine's own fixed-radix handler, so nothing this package
 * does changes what `IntegerDigits(10, 2)` already means.
 */
export function systemOf(expr: BoxedExpression): NumeralSystem | undefined {
  const name = symbolNameOf(expr);
  if (name !== undefined) return NULLARY[name]?.();
  const ops = operandsOf(expr);
  const single = ONE_ARGUMENT[expr.operator];
  if (single !== undefined) {
    const k = integerAt(ops[0]);
    return k === undefined ? undefined : single(k);
  }
  const two = TWO_ARGUMENT[expr.operator];
  if (two !== undefined) {
    const k = integerAt(ops[0]);
    const prec = ops[1] === undefined ? undefined : integerAt(ops[1]);
    return k === undefined ? undefined : two(k, prec);
  }
  const listed = LIST_ARGUMENT[expr.operator];
  if (listed !== undefined) {
    const xs = integerList(ops[0]);
    return xs === undefined ? undefined : listed(xs);
  }
  // A nullary system may also be written with empty parentheses.
  return NULLARY[expr.operator]?.();
}

export function declareNumerals(ce: ComputeEngine): void {
  // The system heads are names, not computations — they stay inert.
  for (const head of Object.keys(NULLARY)) ce.declare(head, { signature: "() -> value" });
  for (const head of Object.keys(ONE_ARGUMENT)) {
    ce.declare(head, { signature: "(integer) -> value" });
  }
  for (const head of Object.keys(TWO_ARGUMENT)) {
    ce.declare(head, { signature: "(integer, integer?) -> value" });
  }
  for (const head of Object.keys(LIST_ARGUMENT)) {
    ce.declare(head, { signature: "(list<integer>) -> value" });
  }
  declareAdic(ce);

  /**
   * Replace one of the two built-ins, widening the base slot to `any` so a system
   * expression survives the type check, and deferring to the native handler for
   * everything that is not one of ours.
   */
  const extend = (
    head: string,
    probe: readonly [string, ...unknown[]],
    signature: string,
    answer: (ops: readonly BoxedExpression[], system: NumeralSystem) => BoxedExpression | undefined,
  ): void => {
    const definition = ce.box(probe as never).operatorDefinition;
    const native = definition?.evaluate;
    ce.declare(head, {
      signature,
      ...(definition?.type === undefined ? {} : { type: definition.type }),
      evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
        const base = ops[1];
        const system = base === undefined ? undefined : systemOf(base);
        return system === undefined ? native?.(ops, options) : answer(ops, system);
      },
    });
  };

  extend(
    "IntegerDigits",
    ["IntegerDigits", 10, 2],
    "(integer, any?, integer?) -> list<integer>",
    (ops, system) => {
      const n = integerAt(ops[0]);
      if (n === undefined) return undefined;
      const digits = system.toDigits(n);
      // No numeral for this integer in this system — say nothing rather than guess.
      if (digits === undefined) return undefined;
      // The third operand pads on the left, as it does natively. It is what makes the
      // factoradic digits of n line up with the Lehmer code of the n-th permutation of
      // a FIXED size: the code needs one digit per position, leading zeros included.
      const width = integerAt(ops[2]);
      const padded =
        width === undefined || width <= digits.length
          ? digits
          : [...Array.from({ length: width - digits.length }, () => 0), ...digits];
      return ce.function(
        "List",
        padded.map((d) => ce.number(d)),
      );
    },
  );

  extend(
    "FromDigits",
    ["FromDigits", ["List", 1, 0], 2],
    "(collection<any>, any?) -> integer",
    (ops, system) => {
      const digits = integerList(ops[0]);
      if (digits === undefined) return undefined;
      const value = system.fromDigits(digits);
      // An invalid digit string — two adjacent Zeckendorf ones, an out-of-range mixed
      // radix digit, inconsistent residues — denotes no integer at all.
      return value === undefined ? undefined : ce.number(value);
    },
  );

  /** The integers from `lo` to `hi` as a set, either end possibly unbounded. */
  const integers = (lo: bigint | number | undefined, hi: bigint | number | undefined) => {
    if (hi === undefined) {
      if (lo === undefined) return ce.symbol("Integers");
      if (lo === 0 || lo === 0n) return ce.symbol("NonNegativeIntegers");
    }
    const end = (x: bigint | number | undefined, infinity: string) =>
      x === undefined ? ce.symbol(infinity) : ce.number(x);
    return ce.function("Range", [end(lo, "NegativeInfinity"), end(hi, "PositiveInfinity")]);
  };
  const digitSet = ([lo, hi]: DigitBound) => integers(lo, hi);
  const isBound = (digits: Shape["digits"]): digits is DigitBound =>
    typeof digits?.[0] === "number";

  /** What a system's numerals look like, as a Dictionary — for discovery. */
  ce.declare("NumeralSystemShape", {
    signature: "(any) -> any",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const system = ops[0] === undefined ? undefined : systemOf(ops[0]);
      if (system === undefined) return undefined;
      const { bijective, range, digits, width, rule } = system.shape;
      const fields: [string, BoxedExpression][] = [
        ["Bijective", ce.symbol(bijective ? "True" : "False")],
        ["Integers", integers(...range)],
      ];
      if (digits !== undefined) {
        fields.push([
          "Digits",
          isBound(digits)
            ? digitSet(digits)
            : ce.function("List", (digits as readonly DigitBound[]).map(digitSet)),
        ]);
      }
      if (width !== undefined) fields.push(["Width", ce.number(width)]);
      if (rule !== undefined) fields.push(["Rule", ce.string(rule)]);
      return ce.function(
        "Dictionary",
        fields.map(([key, value]) => ce.function("KeyValuePair", [ce.string(key), value])),
      );
    },
  });
}
