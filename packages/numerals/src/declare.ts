import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  defineMessages,
  emit,
  formatArgument,
  integerAt,
  operandsOf,
  symbolNameOf,
} from "@enumeratio/boxed";
import { gcd } from "@enumeratio/residues";
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
// The systems are the point: `FactorialNumerals`, `ZeckendorfNumerals`,
// `BalancedNumerals(3)`, `NegativeNumerals(2)`, `BijectiveNumerals(26)`,
// `MixedRadixNumerals([…])`, `PrimorialNumerals`, `CombinatorialNumerals(k)`,
// `ResidueNumerals([…])`, `AdicNumerals(b)` and `PositionalNumerals(b)` are all just
// values in that slot. `AdicNumeral` (singular) is the b-adic VALUE, with its arithmetic.
// `PositionalNumerals(b)` is ordinary base b, as a system value.
//
// The heads above replace an older one-word-per-radix-flavour naming (`Factoradic`,
// `Zeckendorf`, `BalancedRadix`, `Radix`, …) with a single `…Numerals` suffix.
// `NUMERAL_ALIASES` keeps the old spellings working: each is declared to evaluate to its
// canonical form, so existing expressions and Wolfram source keep reading (see
// `declareNumerals` below).

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
  PositionalNumerals: radix,
  BalancedNumerals: balancedRadix,
  NegativeNumerals: negativeRadix,
  BijectiveNumerals: bijectiveRadix,
  CombinatorialNumerals: combinatorialSystem,
};

/** Heads that name a system taking an integer and an optional precision. */
const TWO_ARGUMENT: Record<string, (k: number, prec?: number) => NumeralSystem | undefined> = {
  AdicNumerals: adicNumerals,
};

/** Heads that name a system taking a list of integers. */
const LIST_ARGUMENT: Record<string, (xs: readonly number[]) => NumeralSystem | undefined> = {
  MixedRadixNumerals: mixedRadix,
  ResidueNumerals: residueSystem,
  OstrowskiNumerals: ostrowski,
};

/** Heads that name a system on their own. */
const NULLARY: Record<string, () => NumeralSystem> = {
  FactorialNumerals: factoradic,
  PrimorialNumerals: primorialRadix,
  ZeckendorfNumerals: zeckendorf,
};

/**
 * The one-word-per-flavour spellings these heads used before every numeral system took
 * the `…Numerals` suffix, kept working as data rather than as a second set of heads:
 * `declareNumerals` declares each as a head that evaluates to its canonical form, and
 * `systemOf` resolves one on read too, so a caller that never evaluates still gets an
 * answer. `AdicNumerals` had no old spelling — it landed on the convention first.
 */
export const NUMERAL_ALIASES: Readonly<Record<string, string>> = {
  Radix: "PositionalNumerals",
  Factoradic: "FactorialNumerals",
  PrimorialRadix: "PrimorialNumerals",
  BalancedRadix: "BalancedNumerals",
  NegativeRadix: "NegativeNumerals",
  BijectiveRadix: "BijectiveNumerals",
  Zeckendorf: "ZeckendorfNumerals",
  Ostrowski: "OstrowskiNumerals",
  CombinatorialSystem: "CombinatorialNumerals",
  ResidueSystem: "ResidueNumerals",
  MixedRadix: "MixedRadixNumerals",
};

export const SYSTEM_HEADS: readonly string[] = [
  ...Object.keys(ONE_ARGUMENT),
  ...Object.keys(TWO_ARGUMENT),
  ...Object.keys(LIST_ARGUMENT),
  ...Object.keys(NULLARY),
];

/** An alias resolved to its canonical spelling, or `name` unchanged if it is not one. */
const canonicalOf = (name: string): string => NUMERAL_ALIASES[name] ?? name;

/**
 * Read an expression in the base slot as a numeral system. A plain integer is NOT read
 * here: it is left to compute-engine's own fixed-radix handler, so nothing this package
 * does changes what `IntegerDigits(10, 2)` already means. An old-spelling head is
 * resolved to its canonical name first — normally already done by evaluation (see
 * `declareNumerals`), but this makes `systemOf` correct even called on an unevaluated
 * expression.
 */
export function systemOf(expr: BoxedExpression): NumeralSystem | undefined {
  const name = symbolNameOf(expr);
  if (name !== undefined) return NULLARY[canonicalOf(name)]?.();
  const ops = operandsOf(expr);
  const operator = canonicalOf(expr.operator);
  const single = ONE_ARGUMENT[operator];
  if (single !== undefined) {
    const k = integerAt(ops[0]);
    return k === undefined ? undefined : single(k);
  }
  const two = TWO_ARGUMENT[operator];
  if (two !== undefined) {
    const k = integerAt(ops[0]);
    const prec = ops[1] === undefined ? undefined : integerAt(ops[1]);
    return k === undefined ? undefined : two(k, prec);
  }
  const listed = LIST_ARGUMENT[operator];
  if (listed !== undefined) {
    const xs = integerList(ops[0]);
    return xs === undefined ? undefined : listed(xs);
  }
  // A nullary system may also be written with empty parentheses.
  return NULLARY[operator]?.();
}

/** The integers a system spells, as prose: `≥ 0`, `from 0 to 23`. */
function rangeText([lo, hi]: Shape["range"]): string {
  if (lo === undefined) return hi === undefined ? "every integer" : `the integers ≤ ${hi}`;
  return hi === undefined ? `the integers ≥ ${lo}` : `the integers from ${lo} to ${hi}`;
}

const boundText = ([lo, hi]: DigitBound): string => (hi === undefined ? `≥ ${lo}` : `${lo}–${hi}`);

/** What a valid numeral looks like, as prose, for a digit string that is not one. */
function numeralText({ digits, width, rule }: Shape): string {
  const parts: string[] = [];
  if (width !== undefined) parts.push(`exactly ${width} digits`);
  if (digits !== undefined) {
    parts.push(
      typeof digits[0] === "number"
        ? `digits ${boundText(digits as DigitBound)}`
        : `digits ${(digits as readonly DigitBound[]).map(boundText).join(", ")} by place`,
    );
  }
  if (rule !== undefined) parts.push(rule);
  return parts.join("; ");
}

/** Two of the moduli that share a factor, and that factor. */
function sharedFactor(moduli: readonly number[]): [number, number, bigint] | undefined {
  for (const [i, m] of moduli.entries()) {
    for (const n of moduli.slice(i + 1)) {
      const g = gcd(BigInt(m), BigInt(n));
      if (g !== 1n) return [m, n, g];
    }
  }
  return undefined;
}

export function declareNumerals(ce: ComputeEngine): void {
  defineMessages(ce, "IntegerDigits", { nonum: "`1` has no numeral in `2`." });
  defineMessages(ce, "FromDigits", { nonum: "`1` is not a numeral in `2`." });
  defineMessages(ce, "ResidueNumerals", {
    ncop: "The moduli `1` are not pairwise coprime (gcd(`2`, `3`) = `4`), so this is not a bijection.",
  });

  // The system heads are names, not computations — they stay inert.
  for (const head of Object.keys(NULLARY)) ce.declare(head, { signature: "() -> value" });
  for (const head of Object.keys(ONE_ARGUMENT)) {
    ce.declare(head, { signature: "(integer) -> value" });
  }
  for (const head of Object.keys(TWO_ARGUMENT)) {
    ce.declare(head, { signature: "(integer, integer?) -> value" });
  }
  for (const head of Object.keys(LIST_ARGUMENT)) {
    ce.declare(head, {
      signature: "(list<integer>) -> value",
      // Inert still, but a residue system over moduli that share a factor is worth a word.
      ...(head === "ResidueNumerals"
        ? {
            evaluate: (ops: readonly BoxedExpression[]) => {
              const moduli = integerList(ops[0]);
              const shared = moduli === undefined ? undefined : sharedFactor(moduli);
              if (shared !== undefined) emit(ce, head, "ncop", [moduli, ...shared]);
              return undefined;
            },
          }
        : {}),
    });
  }

  // Old spellings stay working: each evaluates to its canonical `…Numerals` form, so a
  // system value always reads and prints under the new name (see the module comment).
  for (const [alias, canonical] of Object.entries(NUMERAL_ALIASES)) {
    if (canonical in NULLARY) {
      // A bare symbol's `evaluate` is never invoked (only a call's is), so a nullary
      // alias is normalised via `value` instead — declaring it a call as well is not
      // possible on the same definition, but nothing in this package writes one that way.
      ce.declare(alias, { value: ce.symbol(canonical) });
    } else if (canonical in ONE_ARGUMENT) {
      ce.declare(alias, {
        signature: "(integer) -> value",
        evaluate: (ops: readonly BoxedExpression[]) => ce.function(canonical, ops),
      });
    } else if (canonical in LIST_ARGUMENT) {
      ce.declare(alias, {
        signature: "(list<integer>) -> value",
        evaluate: (ops: readonly BoxedExpression[]) => ce.function(canonical, ops),
      });
    }
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
      // No numeral for this integer in this system — decline, and say which ones have one.
      if (digits === undefined) {
        const hint = `${formatArgument(ops[1])} spells ${rangeText(system.shape.range)}.`;
        emit(ce, "IntegerDigits", "nonum", [n, ops[1]], hint);
        return undefined;
      }
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
      if (value === undefined) {
        const hint = `In ${formatArgument(ops[1])}: ${numeralText(system.shape)}.`;
        emit(ce, "FromDigits", "nonum", [ops[0], ops[1]], hint);
        return undefined;
      }
      return ce.number(value);
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
