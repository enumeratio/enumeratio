import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { isFiniteNum, numberResult } from "./box.ts";
import { cexp, cx, sub } from "./complex.ts";
import { logGamma } from "./loggamma.ts";

// RisingFactorial(a, n) — Fungrim's name for CE's native `Pochhammer`, delegated to. Native
// returns NaN for complex a with non-integer n; there use Γ(a+n)/Γ(a).

export function evaluateRisingFactorial(
  ce: ComputeEngine,
  a: BoxedExpression,
  n: BoxedExpression,
  numeric: boolean,
): BoxedExpression | undefined {
  const native = ce.box(["Pochhammer", a.json, n.json] as never);
  const result = numeric ? native.N() : native.evaluate();
  if (!numeric || !Number.isNaN(result.re)) return result;
  if (!isFiniteNum(a) || !isFiniteNum(n)) return result;
  const av = cx(a.re, a.im);
  // 1/Γ(a) = 0 at a pole; Γ(a+n) is finite here since n is not a real integer.
  if (av.im === 0 && Number.isInteger(av.re) && av.re <= 0) return ce.number(0);
  const apn = cx(a.re + n.re, a.im + n.im);
  return numberResult(ce, cexp(sub(logGamma(apn), logGamma(av))));
}
