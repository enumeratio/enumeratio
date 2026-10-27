import type { Expression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt, wrapOperator } from "@enumeratio/engine";
import {
  atEnginePrecision,
  isFiniteNum,
  isRealInt,
  logGammaReal,
  wantsBigDigits,
  wantsNumber,
} from "@enumeratio/ce-patches";

// I_x(a, b) past x = 1 at a positive integer b: (1 − t)^(b−1) is a polynomial, so the
// defining integral is a finite sum, B_x(a, b) = Σⱼ C(b−1, j)(−1)ʲ x^(a+j)/(a+j), real for
// any x > 0. Native BetaRegularized takes x in [0, 1] only.
//
// At integers a and b both ≥ 1 the whole function is a polynomial in x, the binomial tail
// I_x(a, b) = Σ_{j=a}^{n} C(n, j) xʲ (1−x)ⁿ⁻ʲ with n = a + b − 1, so every rational x outside
// [0, 1] has an exact value, negative x included (I_2(2, 3) = 8, I_{−1}(2, 3) = 17).

/** Largest b expanded term by term; the alternating sum loses digits as b grows. */
const B_MAX = 30;
/** Largest n = a + b − 1 summed exactly. */
const N_MAX = 200;

/** A finite double as the exact rational it is, `[numerator, denominator]`. */
function exactDouble(x: number): [bigint, bigint] {
  let [m, e] = [x, 0];
  while (!Number.isInteger(m)) [m, e] = [m * 2, e + 1]; // exact: only the exponent moves
  return [BigInt(m), 2n ** BigInt(e)];
}

/** A decimal literal (`-1.5e-3`) as the exact rational it spells. */
function exactDecimal(text: string): [bigint, bigint] | undefined {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(text);
  if (match === null) return undefined;
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  const shift = Number(exponent) - fraction.length;
  const digits = BigInt(`${sign}${whole}${fraction}`);
  return shift >= 0 ? [digits * 10n ** BigInt(shift), 1n] : [digits, 10n ** BigInt(-shift)];
}

/** `n / d` as a double, however large the two (a quotient of two doubles: within about an ulp). */
function ratioToDouble(n: bigint, d: bigint): number {
  const drop = BigInt(Math.max(0, Math.max(n.toString(2).length, d.toString(2).length) - 1000));
  return Number(n >> drop) / Number(d >> drop);
}

/** I_x(a, b) for a rational x = p/q and integers a, b ≥ 1, as `[numerator, denominator]`. */
function exactTail(p: bigint, q: bigint, a: number, b: number): [bigint, bigint] {
  const n = a + b - 1;
  let binomial = 1n; // C(n, j), walked up from j = 0
  let sum = 0n;
  for (let j = 0; j <= n; j++) {
    if (j >= a) sum += binomial * p ** BigInt(j) * (q - p) ** BigInt(n - j);
    binomial = (binomial * BigInt(n - j)) / BigInt(j + 1);
  }
  const d = q ** BigInt(n);
  let [g, h] = [sum < 0n ? -sum : sum, d];
  while (h !== 0n) [g, h] = [h, g % h];
  return g === 0n ? [0n, 1n] : [sum / g, d / g];
}

export function declareBetaContinuation(ce: ComputeEngine): void {
  /**
   * A rational (or finite double) x outside [0, 1] with integers a, b ≥ 1: the polynomial's value
   * at x, exact; a double x is taken as the dyadic rational it is.
   */
  const exactOutside = (ops: readonly Expression[]): [bigint, bigint, number, number] | undefined => {
    const [x, a, b] = ops;
    const [m, n] = [bigIntegerAt(a), bigIntegerAt(b)];
    if (x === undefined || m === undefined || n === undefined || ops.length !== 3) return undefined;
    const isFloat = (x as Partial<{ isExact: boolean }>).isExact === false; // not Pi, whose `.re` is a double too
    // A float is the exact rational it is: a bignum by its decimal digits, a double by its bits.
    const rational =
      bigRationalAt(x) ??
      (!isFloat || x.im !== 0
        ? undefined
        : x.bignumRe !== undefined
          ? exactDecimal(x.bignumRe.toString())
          : Number.isFinite(x.re)
            ? exactDouble(x.re)
            : undefined);
    if (rational === undefined) return undefined;
    const [p, q] = rational;
    if ((p >= 0n && p <= q) || m < 1n || n < 1n || m + n - 1n > BigInt(N_MAX)) return undefined;
    return [p, q, Number(m), Number(n)];
  };

  // No compile stance: for a real x > 1 this gives a number where the built-in lowering gives NaN.
  wrapOperator(
    ce,
    ["BetaRegularized", 0.5, 2, 3],
    (ops) => {
      const [x, a, b] = ops;
      if (exactOutside(ops) !== undefined) return true;
      return (
        x !== undefined &&
        a !== undefined &&
        b !== undefined &&
        isFiniteNum(x) &&
        isFiniteNum(a) &&
        x.im === 0 &&
        a.im === 0 &&
        x.re > 1 &&
        a.re > 0 &&
        isRealInt(b) &&
        b.re >= 1 &&
        b.re <= B_MAX
      );
    },
    (native) => (ops, options) => {
      const exact = exactOutside(ops);
      if (exact !== undefined) {
        const [n, d] = exactTail(...exact);
        // The value is exact either way. Past a double's digits it is rounded from the exact
        // rational to the engine's precision; otherwise a float anywhere asks for a double.
        if (wantsBigDigits(ce, options, ops)) {
          const value = ce.function("Rational", [ce.number(n), ce.number(d)]).N();
          return atEnginePrecision(ce, value) ?? value;
        }
        if (wantsNumber(ops, options)) return ce.number(ratioToDouble(n, d));
        return d === 1n ? ce.number(n) : ce.function("Rational", [ce.number(n), ce.number(d)]).evaluate();
      }
      if (!wantsNumber(ops, options)) return native?.(ops, options);
      const [x, a, b] = ops.map((op: Expression) => op.re) as [number, number, number];
      let sum = 0;
      let binomial = 1;
      for (let j = 0; j < b; j++) {
        sum += ((j % 2 === 0 ? 1 : -1) * binomial * x ** (a + j)) / (a + j);
        binomial = (binomial * (b - 1 - j)) / (j + 1);
      }
      const beta = Math.exp(logGammaReal(a) + logGammaReal(b) - logGammaReal(a + b));
      return ce.number(sum / beta);
    },
    3,
  );
}
