import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  defineMessages,
  emit,
  formatArgument,
  integerAt,
  operandsOf,
  stringAt,
  symbolNameOf,
  threadOverLists,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";
import { gcd } from "@enumeratio/residues";
import { declareAdic } from "./adic-declare.ts";
import {
  bigIntToBaseString,
  digitLength,
  digitsOfBigInt,
  integerOfRomanNumeral,
  integerReverse,
  numberExpand,
  type RealDigit,
  realDigitsOfRational,
  romanNumeralOf,
} from "./digits.ts";
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

  // After the redeclarations above, which would drop the flag. Thread over a list of n, as Wolfram's do: IntegerDigits([6, 7], 2) is [[1, 1, 0], [1, 1, 1]].
  // A system in the base slot is a head, never a bare list, so it is not threaded over.
  threadOverLists(ce, ["IntegerDigits", "DigitCount", "DigitSum"]);

  // Wolfram's FromDigits["1923"] and FromDigits["ff", 16]: the digits as a string, 0-9 then
  // a-z. Natively the digits have to be a list.
  wrapOperator(
    ce,
    ["FromDigits", ["List", 1, 0], 2],
    (ops) => stringAt(ops[0]) !== undefined,
    () => (ops) => {
      const base = ops[1] === undefined ? 10 : integerAt(ops[1]);
      const text = stringAt(ops[0])!.toLowerCase();
      if (base === undefined || base < 2 || base > 36 || text === "") return undefined;
      const digits = text.split("").map((c) => Number.parseInt(c, 36));
      if (digits.some((d) => Number.isNaN(d) || d >= base)) return undefined;
      return ce.number(digits.reduce((n, d) => n * BigInt(base) + BigInt(d), 0n));
    },
    { min: 1, max: 2 },
  );

  // FromDigits(digits, x): a symbolic base gives the polynomial digits spell in x --
  // Horner's form, built and simplified via Add/Multiply/Power rather than hand-reduced.
  wrapOperator(
    ce,
    ["FromDigits", ["List", 1, 2, 3], "x"],
    (ops) =>
      integerList(ops[0]) !== undefined &&
      symbolNameOf(ops[1]) !== undefined &&
      // Not a numeral-system name (FactorialNumerals, ZeckendorfNumerals, ...) or one of
      // its old-spelling aliases -- those are handled by `extend`'s `systemOf` lookup.
      systemOf(ops[1]) === undefined,
    () => (ops) => {
      const digits = integerList(ops[0])!;
      const n = digits.length;
      const terms = digits.map((d, i) =>
        ce.function("Multiply", [
          ce.number(d),
          ce.function("Power", [ops[1], ce.number(n - 1 - i)]),
        ]),
      );
      return ce.function("Add", terms).evaluate();
    },
    2,
  );

  // FromDigits(digits, base): a negative base is just the same Horner reduction --
  // acc*base+d -- with base < 0; only the native type gate rejected it.
  wrapOperator(
    ce,
    ["FromDigits", ["List", 1, 1, 0], -2],
    (ops) => {
      const base = bigIntegerAt(ops[1]);
      return integerList(ops[0]) !== undefined && base !== undefined && base <= -2n;
    },
    () => (ops) => {
      const digits = integerList(ops[0])!;
      const base = bigIntegerAt(ops[1])!;
      const value = digits.reduce((acc, d) => acc * base + BigInt(d), 0n);
      return ce.number(value);
    },
    2,
  );

  // FromDigits({digits, exponent}): the single-argument pair shape RealDigits gives back —
  // {1,4,1,5}, 1 reads as 1.415, base 10 (RealDigits' own default base, since no base is
  // given here). value = (digits as a base-10 integer) · 10^(exponent − len(digits)); the
  // exponent counts digits BEFORE the point, so len(digits) − exponent of them trail after
  // it. Disjoint from the plain digits-list forms above by shape alone: `ops[0]` there is a
  // flat list of integers, `integerList` on it fails the moment it hits the nested digits
  // list this pair carries as its own first element.
  wrapOperator(
    ce,
    ["FromDigits", ["List", ["List", 1, 4, 1, 5], 1]],
    (ops) => {
      if (ops.length !== 1 || ops[0]?.operator !== "List") return false;
      const parts = operandsOf(ops[0]);
      return (
        parts.length === 2 &&
        integerList(parts[0]) !== undefined &&
        integerAt(parts[1]) !== undefined
      );
    },
    () => (ops) => {
      const [digitsExpr, exponentExpr] = operandsOf(ops[0]!);
      const digits = integerList(digitsExpr)!;
      const exponent = integerAt(exponentExpr)!;
      const base = 10n;
      const mantissa = digits.reduce((acc, d) => acc * base + BigInt(d), 0n);
      const shift = exponent - digits.length;
      return shift >= 0
        ? ce.number(mantissa * base ** BigInt(shift))
        : ce
            .function("Rational", [ce.number(mantissa), ce.number(base ** BigInt(-shift))])
            .evaluate();
    },
  );

  // Wolfram's "Roman" pseudo-base, the reverse of RomanNumeral: FromDigits("XVII", "Roman").
  wrapOperator(
    ce,
    ["FromDigits", "'XVII'", "'Roman'"],
    (ops) => stringAt(ops[1])?.toLowerCase() === "roman",
    () => (ops) => {
      const text = stringAt(ops[0]);
      const value = text === undefined ? undefined : integerOfRomanNumeral(text);
      return value === undefined ? undefined : ce.number(value);
    },
    2,
  );

  // Wolfram's IntegerString[n, b] and IntegerString[n, b, len]: bigint arithmetic throughout,
  // since the native handler goes through a double and drifts past about 15-16 significant
  // digits (IntegerString(50!, 16) is wrong after ~13 hex digits).
  widenSignature(
    ce,
    "IntegerString",
    "(integer, any?, integer?) -> string",
    (op) => bigIntegerAt(op) !== undefined,
  );
  wrapOperator(
    ce,
    ["IntegerString", 5, 2],
    (ops) =>
      bigIntegerAt(ops[0]) !== undefined &&
      (ops[1] === undefined || bigIntegerAt(ops[1]) !== undefined),
    () => (ops) => {
      const n = bigIntegerAt(ops[0])!;
      const base = ops[1] === undefined ? 10n : bigIntegerAt(ops[1])!;
      if (base < 2n || base > 36n) return undefined;
      return ce.string(bigIntToBaseString(n, base));
    },
    { min: 1, max: 2 },
  );
  wrapOperator(
    ce,
    ["IntegerString", 5, 2, 4],
    () => true,
    () => (ops) => {
      const width = integerAt(ops[2]);
      const n = bigIntegerAt(ops[0]);
      const base = ops[1] === undefined ? 10n : bigIntegerAt(ops[1]);
      if (
        width === undefined ||
        width < 0 ||
        n === undefined ||
        n < 0n ||
        base === undefined ||
        base < 2n ||
        base > 36n
      ) {
        return undefined;
      }
      const digits = bigIntToBaseString(n, base);
      const padded = digits.padStart(width, "0");
      return ce.string(padded.slice(padded.length - width));
    },
    3,
  );
  // Wolfram's "Roman" pseudo-base, the forward direction: IntegerString(1988, "Roman").
  wrapOperator(
    ce,
    ["IntegerString", 1988, "'Roman'"],
    (ops) => stringAt(ops[1])?.toLowerCase() === "roman",
    () => (ops) => {
      const n = integerAt(ops[0]);
      const roman = n === undefined ? undefined : romanNumeralOf(n);
      return roman === undefined ? undefined : ce.string(roman);
    },
    2,
  );

  // Wolfram's DigitSum[n, b, k]: the sum of the first k base-b digits (most significant
  // first); negative k sums the last |k| instead (least significant first). The sign of n
  // is discarded, as the two-argument form already does.
  widenSignature(ce, "DigitSum", "(integer, integer?, integer?) -> integer");
  wrapOperator(
    ce,
    ["DigitSum", 5, 2],
    () => true,
    () => (ops) => {
      const n = bigIntegerAt(ops[0]);
      const base = bigIntegerAt(ops[1]);
      const k = integerAt(ops[2]);
      if (n === undefined || base === undefined || base < 2n || k === undefined) return undefined;
      const digits: bigint[] = [];
      for (let x = n < 0n ? -n : n; x > 0n; x /= base) digits.unshift(x % base);
      if (digits.length === 0) digits.push(0n);
      const slice = k >= 0 ? digits.slice(0, k) : digits.slice(digits.length + k);
      return ce.number(slice.reduce((sum, d) => sum + d, 0n));
    },
    3,
  );

  // Wolfram's DigitCount[n, b, digit, len]: a 4th argument widens the digit list to `len`
  // places (leading zeros included) before tallying, so padding zeros count too.
  widenSignature(ce, "DigitCount", "(integer, integer?, any?, integer?) -> any");
  wrapOperator(
    ce,
    ["DigitCount", 5, 10, 0, 9],
    () => true,
    () => (ops) => {
      const n = bigIntegerAt(ops[0]);
      const base = ops[1] === undefined ? 10n : bigIntegerAt(ops[1]);
      const width = integerAt(ops[3]);
      if (n === undefined || base === undefined || base < 2n || width === undefined || width < 0) {
        return undefined;
      }
      const digits = digitsOfBigInt(n, base);
      // Shorter than width: pad with leading zeros. Longer: keep only the `width`
      // least-significant digits, as DigitSum's negative-k slice already does.
      const padded =
        width <= digits.length
          ? digits.slice(digits.length - width)
          : [...Array.from({ length: width - digits.length }, () => 0n), ...digits];
      const countOf = (d: bigint) => padded.filter((x) => x === d).length;
      const single = bigIntegerAt(ops[2]);
      if (single !== undefined) return ce.number(countOf(single));
      const list = integerList(ops[2]);
      if (list !== undefined) {
        return ce.function(
          "List",
          list.map((d) => ce.number(countOf(BigInt(d)))),
        );
      }
      return undefined;
    },
    4,
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

  // ── digit heads: IntegerLength, IntegerReverse, NumberExpand, RealDigits,
  // RomanNumeral ─────────────────────────────────────────────────────────────

  /** A base argument, defaulting to 10 when omitted. */
  const baseArg = (expr: BoxedExpression | undefined): bigint =>
    (expr === undefined ? undefined : bigIntegerAt(expr)) ?? 10n;

  ce.declare("IntegerLength", {
    signature: "(integer, integer?) -> integer",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      const base = baseArg(ops[1]);
      if (n === undefined || base < 2n) return undefined;
      return ce.number(digitLength(n, base));
    },
  });

  ce.declare("IntegerReverse", {
    signature: "(integer, integer?, integer?) -> integer",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      const base = baseArg(ops[1]);
      const width = ops[2] === undefined ? undefined : integerAt(ops[2]);
      if (n === undefined || base < 2n || (ops[2] !== undefined && width === undefined)) {
        return undefined;
      }
      return ce.number(integerReverse(n, base, width));
    },
  });

  ce.declare("NumberExpand", {
    signature: "(integer, integer?, integer?) -> list",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      const base = baseArg(ops[1]);
      const width = ops[2] === undefined ? undefined : integerAt(ops[2]);
      if (n === undefined || base < 2n || (ops[2] !== undefined && width === undefined)) {
        return undefined;
      }
      return ce.function(
        "List",
        numberExpand(n, base, width).map((term) => ce.number(term)),
      );
    },
  });

  ce.declare("RomanNumeral", {
    signature: "(integer) -> string",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = integerAt(ops[0]);
      const roman = n === undefined ? undefined : romanNumeralOf(n);
      return roman === undefined ? undefined : ce.string(roman);
    },
  });

  /** `RealDigits`' `{{digits...}, exponent}`, a periodic tail nested as its own list. */
  const realDigitsExpr = (digits: readonly RealDigit[], exponent: number): BoxedExpression =>
    ce.function("List", [
      ce.function(
        "List",
        digits.map((d) =>
          Array.isArray(d)
            ? ce.function(
                "List",
                d.map((x) => ce.number(x)),
              )
            : ce.number(d as bigint),
        ),
      ),
      ce.number(exponent),
    ]);

  // Extra significant digits computed beyond `len`, so what's handed back is TRUNCATED
  // rather than rounded at the boundary the caller asked for.
  const REAL_DIGITS_GUARD = 15;

  ce.declare("RealDigits", {
    signature: "(value, integer?, integer?) -> list",
    evaluate: (ops: readonly BoxedExpression[]) => {
      if (ops[0] === undefined) return undefined;
      const base = baseArg(ops[1]);
      const len = ops[2] === undefined ? undefined : integerAt(ops[2]);
      if (base < 2n) return undefined;

      // An exact rational (integers included) gets its exact repeating-block expansion,
      // regardless of base — this is the case that must never be merely approximate.
      const rational = bigRationalAt(ops[0]);
      if (rational !== undefined) {
        const { digits, exponent } = realDigitsOfRational(rational[0], rational[1], base);
        return realDigitsExpr(digits, exponent);
      }

      // Anything else (Pi, a Sqrt, a named constant, ...) needs a numeric approximation,
      // `len` digits of it — only in base 10, which is what the guarded bignum precision
      // below is computed in.
      if (base !== 10n || len === undefined || len < 1) return undefined;
      const savedPrecision = ce.precision;
      try {
        ce.precision = len + REAL_DIGITS_GUARD;
        const big = ops[0].N().bignumRe;
        if (big === undefined || big.isNaN() || !big.isFinite()) return undefined;
        const magnitude = big.significand < 0n ? -big.significand : big.significand;
        const digitsStr = magnitude.toString();
        if (digitsStr === "0") return undefined;
        const exponent = big.exponent + digitsStr.length;
        const digits = Array.from(digitsStr.slice(0, len), (c) => BigInt(c));
        return realDigitsExpr(digits, exponent);
      } finally {
        ce.precision = savedPrecision;
      }
    },
  });
}
