// Plain bigint digit arithmetic backing IntegerLength, IntegerReverse, NumberExpand and
// RealDigits — kept apart from `declare.ts` so the exact math is testable without an engine.

/** The base-`base` digits of |n|, most significant first. `n = 0` gives `[0n]`. */
export function digitsOfBigInt(n: bigint, base: bigint): bigint[] {
  let rest = n < 0n ? -n : n;
  if (rest === 0n) return [0n];
  const digits: bigint[] = [];
  while (rest > 0n) {
    digits.unshift(rest % base);
    rest /= base;
  }
  return digits;
}

/** The integer `digits` (most significant first) spell in `base`. */
export function fromDigitsBigInt(digits: readonly bigint[], base: bigint): bigint {
  return digits.reduce((acc, d) => acc * base + d, 0n);
}

/** How many base-`base` digits |n| has; 0 has length 0 (unlike `digitsOfBigInt`). */
export function digitLength(n: bigint, base: bigint): number {
  const abs = n < 0n ? -n : n;
  if (abs === 0n) return 0;
  let rest = abs;
  let len = 0;
  while (rest > 0n) {
    rest /= base;
    len++;
  }
  return len;
}

/** Left-pad a digit list with zeros to at least `width` digits. */
function padDigits(digits: readonly bigint[], width: number | undefined): bigint[] {
  if (width === undefined || width <= digits.length) return [...digits];
  return [...Array.from({ length: width - digits.length }, () => 0n), ...digits];
}

/** `IntegerReverse`: the digits of |n|, padded to `width` if given, then reversed. */
export function integerReverse(n: bigint, base: bigint, width?: number): bigint {
  const digits = padDigits(digitsOfBigInt(n, base), width);
  return fromDigitsBigInt([...digits].reverse(), base);
}

/** `NumberExpand`: each digit of n times its place value, carrying n's sign throughout. */
export function numberExpand(n: bigint, base: bigint, width?: number): bigint[] {
  const sign = n < 0n ? -1n : 1n;
  const digits = padDigits(digitsOfBigInt(n, base), width);
  return digits.map((d, i) => sign * d * base ** BigInt(digits.length - 1 - i));
}

/** The largest integer `s ≥ 0` with `s*s ≤ n`, for `n ≥ 0`. */
export function bigIntSqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

export const isPerfectSquare = (n: bigint): boolean => n >= 0n && bigIntSqrt(n) ** 2n === n;

/** One entry of `RealDigits`' digit list: a plain digit, or a periodic block. */
export type RealDigit = bigint | readonly bigint[];

/**
 * `RealDigits` of an exact rational p/q ≥ 0 (sign is dropped, like every digit head
 * here): the exact repeating-block expansion via long division with remainder-cycle
 * detection, matching Wolfram's `{{digits...}, exponent}` convention — a trailing
 * periodic block is nested as its own list, and leading fractional zeros (when the
 * integer part is 0) are dropped from the list and folded into a more negative exponent
 * rather than spelled out as literal zero digits.
 */
export function realDigitsOfRational(
  pIn: bigint,
  qIn: bigint,
  base: bigint,
): { digits: RealDigit[]; exponent: number } {
  const p = pIn < 0n ? -pIn : pIn;
  const q = qIn < 0n ? -qIn : qIn;
  if (p === 0n) return { digits: [0n], exponent: 1 };

  const intPart = p / q;
  const intDigits = intPart === 0n ? [] : digitsOfBigInt(intPart, base);
  let exponent = intDigits.length;

  // Long division of the remainder, tracking each remainder's first position so a
  // repeat marks the start of the periodic block; hitting 0 means it terminates.
  let remainder = p % q;
  const fracDigits: bigint[] = [];
  const seen = new Map<string, number>();
  let periodStart = -1;
  while (remainder !== 0n) {
    const key = remainder.toString();
    const at = seen.get(key);
    if (at !== undefined) {
      periodStart = at;
      break;
    }
    seen.set(key, fracDigits.length);
    remainder *= base;
    fracDigits.push(remainder / q);
    remainder %= q;
  }

  const digits: RealDigit[] =
    periodStart < 0
      ? [...intDigits, ...fracDigits]
      : [...intDigits, ...fracDigits.slice(0, periodStart), fracDigits.slice(periodStart)];

  // No integer part: strip leading zero digits, folding each into the exponent — the
  // list should start at the first significant digit, per Wolfram's convention (see
  // the `1/8` example: `{{1}, -2}`, not `{{0, 0, 1}, 0}`).
  if (intDigits.length === 0) {
    while (digits.length > 0 && digits[0] === 0n) {
      digits.shift();
      exponent -= 1;
    }
  }

  return { digits, exponent };
}

const ROMAN_TABLE: readonly (readonly [number, string])[] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** The Roman numeral for `0 ≤ n ≤ 3999`; `0` is `N`, for nulla. */
export function romanNumeralOf(n: number): string | undefined {
  if (!Number.isInteger(n) || n < 0 || n > 3999) return undefined;
  if (n === 0) return "N";
  let rest = n;
  let out = "";
  for (const [value, symbol] of ROMAN_TABLE) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}
