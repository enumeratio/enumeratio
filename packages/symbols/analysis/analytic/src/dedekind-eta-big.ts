import { type Engine, type Expr, wrapOperator, BigDecimal } from "@enumeratio/engine";
import {
  type BigCx,
  atDigits,
  bigCx,
  bigExp,
  bigMul,
  bigResult,
  exceedsDoublePrecision,
  isFiniteNum,
  periodsExceedDouble,
  wantsNumber,
} from "@enumeratio/ce-patches";

// η(τ) = e^(πiτ/12)·Σ_k (−1)^k q^(k(3k−1)/2), q = e^(2πiτ) (Euler's pentagonal number theorem), in
// BigDecimal. compute-engine's native η runs on doubles: N(η(τ), 50) comes back with 16 digits,
// and at a huge Re τ the phase e^(πiτ/12) is rounded away (the period is 24, so the real part is
// reduced exactly first, which a double cannot do).

/** Digits carried past the ones asked for. */
const GUARD = 20;
/** Below this Im τ the q-series takes too many terms to be worth it; native answers. */
const MIN_IM = 0.05;
const MAX_TERMS = 4000;

/** η(re + i·im) to `digits` digits, or undefined where Im τ is too small for the series. */
export function dedekindEtaBig(re: BigDecimal, im: BigDecimal, digits: number): BigCx | undefined {
  if (!(im.toNumber() >= MIN_IM)) return undefined;
  const wholeDigits = Math.max(1, Math.ceil(Math.log10(Math.abs(re.toNumber()) + 1)));
  const working = digits + GUARD + wholeDigits;
  const terms = Math.ceil((working * Math.LN10) / (2 * Math.PI * im.toNumber())) + 2;
  if (terms > MAX_TERMS) return undefined;
  const value = atDigits(working, (): BigCx => {
    const reduced = re.sub(re.div(24).floor().mul(24));
    const pi = BigDecimal.PI;
    const q = bigExp({ re: im.mul(pi).mul(2).neg(), im: reduced.mul(pi).mul(2) });
    const powers: BigCx[] = [bigCx(1)];
    for (let n = 1; n <= terms; n++) powers.push(bigMul(powers[n - 1]!, q));
    let sum = bigCx(0);
    for (let k = -Math.ceil(Math.sqrt(terms)); k <= Math.ceil(Math.sqrt(terms)); k++) {
      const n = (k * (3 * k - 1)) / 2;
      if (n > terms) continue;
      const p = powers[n]!;
      sum =
        k % 2 === 0 ? { re: sum.re.add(p.re), im: sum.im.add(p.im) } : { re: sum.re.sub(p.re), im: sum.im.sub(p.im) };
    }
    const phase = bigExp({ re: im.mul(pi).div(12).neg(), im: reduced.mul(pi).div(12) });
    return bigMul(phase, sum);
  });
  return { re: value.re.toPrecision(digits), im: value.im.toPrecision(digits) };
}

export function declareDedekindEtaBig(ce: Engine): void {
  // compile builtin: digits past a double's, and a real part too large for a double to reduce
  wrapOperator(
    ce,
    ["DedekindEta", 1],
    (ops) => ops.length === 1 && isFiniteNum(ops[0]!) && ops[0]!.im > 0,
    (native) => (ops, options) => {
      const tau = ops[0]!;
      const huge = periodsExceedDouble(tau.re, 24);
      if (!wantsNumber(ops, options) || !(huge || exceedsDoublePrecision(ce, options.numericApproximation)))
        return native?.(ops, options);
      const value = dedekindEtaBig(realPart(ce, tau, "re"), realPart(ce, tau, "im"), ce.precision);
      if (value === undefined) return native?.(ops, options);
      return ce.function("Complex", [bigResult(ce, value.re), bigResult(ce, value.im)]);
    },
    { arity: 1, compile: "builtin" },
  );
}

/** One part of a complex operand as a BigDecimal: the exact one when the operand carries it. */
function realPart(ce: Engine, tau: Expr, part: "re" | "im"): BigDecimal {
  const exact = part === "re" ? tau.bignumRe : tau.bignumIm;
  return exact ?? ce.bignum(tau[part]);
}
