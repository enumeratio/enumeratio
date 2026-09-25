import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf, symbolNameOf } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";
import { atEnginePrecision } from "./precise.ts";

// ∫ sinᵐ(u) cosⁿ(u) dx for a linear u = a·x + b with m or n odd -- compute-engine integrates
// sin² but not sin³. An odd power gives up one factor as du and the rest rewrites through
// sin² + cos² = 1 into a polynomial in the other function:
//   m = 2k + 1:  −Σⱼ C(k, j)(−1)ʲ cosⁿ⁺²ʲ⁺¹(u) / (n + 2j + 1)
//   n = 2k + 1:   Σⱼ C(k, j)(−1)ʲ sinᵐ⁺²ʲ⁺¹(u) / (m + 2j + 1)
// each divided by a. A definite integral is the difference at the limits.
//
// Attached to Integrate directly rather than through `wrapOperator`: Integrate is lazy, and
// its integrand must not be evaluated ahead of it.

type Evaluate = (ops: ReadonlyArray<BoxedExpression>, options: EvalOptions) => BoxedExpression | undefined;

/** Largest exponent expanded; the polynomial has about half this many terms. */
const EXPONENT_MAX = 40n;

interface TrigPower {
  readonly coefficient: BoxedExpression;
  readonly u: BoxedExpression;
  readonly m: number; // power of sin u
  readonly n: number; // power of cos u
}

const freeOf = (e: BoxedExpression, x: string): boolean => !e.symbols.includes(x);

/** One factor as (head, argument, power) for a positive integer power of Sin or Cos. */
function trigFactor(f: BoxedExpression): readonly [string, BoxedExpression, number] | undefined {
  let base = f;
  let power = 1n;
  if (f.operator === "Power") {
    const [b, e] = operandsOf(f);
    const k = bigIntegerAt(e);
    if (b === undefined || k === undefined || k < 1n || k > EXPONENT_MAX) return undefined;
    base = b;
    power = k;
  }
  if (base.operator !== "Sin" && base.operator !== "Cos") return undefined;
  const arg = operandsOf(base)[0];
  return arg === undefined ? undefined : [base.operator, arg, Number(power)];
}

/** The integrand as c·sinᵐ(u)·cosⁿ(u), c free of x, or undefined for anything else. */
function trigPower(ce: ComputeEngine, body: BoxedExpression, x: string): TrigPower | undefined {
  const factors = body.operator === "Multiply" ? operandsOf(body) : [body];
  const constants: BoxedExpression[] = [];
  let u: BoxedExpression | undefined;
  let [m, n] = [0, 0];
  for (const f of factors) {
    if (freeOf(f, x)) {
      constants.push(f);
      continue;
    }
    const t = trigFactor(f);
    if (t === undefined) return undefined;
    const [head, arg, power] = t;
    if (u === undefined) u = arg;
    else if (!u.isSame(arg)) return undefined;
    if (head === "Sin") m += power;
    else n += power;
  }
  if (u === undefined) return undefined;
  const coefficient = constants.length === 0 ? ce.One : ce.function("Multiply", constants);
  return { coefficient, u, m, n };
}

const binomial = (k: number, j: number): number => {
  let r = 1;
  for (let i = 0; i < j; i++) r = (r * (k - i)) / (i + 1);
  return r;
};

/** An antiderivative of sinᵐ(u) cosⁿ(u) in u, for m or n odd. */
function antiderivative(ce: ComputeEngine, u: BoxedExpression, m: number, n: number) {
  const sineOdd = m % 2 === 1;
  const [k, other] = sineOdd ? [(m - 1) / 2, n] : [(n - 1) / 2, m];
  const fn = ce.function(sineOdd ? "Cos" : "Sin", [u]);
  const terms: BoxedExpression[] = [];
  for (let j = 0; j <= k; j++) {
    const e = other + 2 * j + 1;
    const sign = (j % 2 === 0 ? 1 : -1) * (sineOdd ? -1 : 1);
    terms.push(
      ce.function("Multiply", [ce.number([sign * binomial(k, j), e]), ce.function("Power", [fn, ce.number(e)])]),
    );
  }
  return ce.function("Add", terms);
}

export function declareTrigPowerIntegrals(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Integrate");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const native = operator?.evaluate as Evaluate | undefined;
  if (operator === undefined || native === undefined) return;
  operator.evaluate = ((ops: ReadonlyArray<BoxedExpression>, options: EvalOptions) => {
    const [fn, limits] = ops;
    if (ops.length !== 2 || fn?.operator !== "Function" || limits?.operator !== "Limits") {
      return native(ops, options);
    }
    const [block, param] = operandsOf(fn);
    const [index, lo, hi] = operandsOf(limits);
    const x = param === undefined ? undefined : symbolNameOf(param);
    const body = block?.operator === "Block" ? operandsOf(block)[0] : block;
    if (x === undefined || body === undefined || index === undefined || symbolNameOf(index) !== x) {
      return native(ops, options);
    }
    const t = trigPower(ce, body, x);
    if (t === undefined || (t.m % 2 === 0 && t.n % 2 === 0) || t.m + t.n < 2) {
      return native(ops, options);
    }
    // u = a·x + b with a a nonzero constant.
    const a = ce.box(["D", t.u.json, x] as never).evaluate();
    if (!freeOf(a, x) || a.is(0)) return native(ops, options);
    const inner = antiderivative(ce, t.u, t.m, t.n);
    const F = ce.function("Divide", [ce.function("Multiply", [t.coefficient, inner]), a]);
    const definite = symbolNameOf(lo!) !== "Nothing" && symbolNameOf(hi!) !== "Nothing";
    const result = definite ? ce.function("Subtract", [F.subs({ [x]: hi! }), F.subs({ [x]: lo! })]) : F;
    if (!options.numericApproximation) return result.evaluate();
    const value = result.N();
    return atEnginePrecision(ce, value) ?? value;
  }) as typeof operator.evaluate;
}
