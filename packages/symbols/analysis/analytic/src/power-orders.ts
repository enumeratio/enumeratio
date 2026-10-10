import { isRealInt } from "@enumeratio/ce-patches";
import { type Engine as ComputeEngine, type Expr as BoxedExpression, isNumber, operandsOf } from "@enumeratio/engine";

// The n-th derivative and Taylor coefficient of c·u^a, for u linear in x and n a symbol: the
// falling-factorial power rule, which D and SeriesCoefficient otherwise decline at a symbolic
// order. A real root (CubeRoot, an odd Root) differentiates as the real branch, `Root(u, m)·u^-k`,
// so the answer stays real at a negative u.

interface PowerForm {
  /** The factor free of x. */
  readonly c: BoxedExpression;
  /** The linear base `b·x + d`, with `b` its slope. */
  readonly u: BoxedExpression;
  readonly b: BoxedExpression;
  /** The exponent `a` (`1/m` for a root). */
  readonly a: BoxedExpression;
  /** The root's index when the power is the real branch of an odd root. */
  readonly realRoot?: number;
}

const free = (e: BoxedExpression, x: string): boolean => !e.has(x);

/** `f` as `c·u^a`, or undefined. */
function powerForm(ce: ComputeEngine, f: BoxedExpression, x: string): PowerForm | undefined {
  const parts = decompose(ce, f, x);
  if (parts === undefined) return undefined;
  const { u, a, c, realRoot } = parts;
  const b = ce.box(["D", u.json, x] as never).evaluate();
  if (!free(b, x) || b.is(0)) return undefined; // u is not linear in x
  return { c, u, b, a, realRoot };
}

function decompose(
  ce: ComputeEngine,
  f: BoxedExpression,
  x: string,
): { c: BoxedExpression; u: BoxedExpression; a: BoxedExpression; realRoot?: number } | undefined {
  const ops = operandsOf(f);
  const scaled = (c: BoxedExpression, rest: BoxedExpression) => {
    const inner = decompose(ce, rest, x);
    return inner === undefined ? undefined : { ...inner, c: ce.function("Multiply", [c, inner.c]) };
  };
  switch (f.operator) {
    case "Multiply": {
      const dependent = ops.filter((o) => !free(o, x));
      if (dependent.length !== 1) return undefined;
      const constant = ops.filter((o) => free(o, x));
      return scaled(constant.length === 0 ? ce.One : ce.function("Multiply", constant), dependent[0]!);
    }
    case "Negate":
      return scaled(ce.NegativeOne, ops[0]!);
    case "Divide": {
      if (free(ops[1]!, x)) return scaled(ce.function("Divide", [ce.One, ops[1]!]), ops[0]!);
      const denominator = free(ops[0]!, x) ? decompose(ce, ops[1]!, x) : undefined;
      if (denominator === undefined || denominator.realRoot !== undefined) return undefined;
      return {
        ...denominator,
        c: ce.function("Divide", [ops[0]!, denominator.c]),
        a: ce.function("Negate", [denominator.a]).evaluate(),
      };
    }
    case "Power": {
      const [base, a] = ops;
      return base !== undefined && a !== undefined && !free(base, x) && free(a, x)
        ? { c: ce.One, u: base, a }
        : undefined;
    }
    case "Sqrt":
      return { c: ce.One, u: ops[0]!, a: ce.box(["Rational", 1, 2] as never) };
    case "CubeRoot":
      return { c: ce.One, u: ops[0]!, a: ce.box(["Rational", 1, 3] as never), realRoot: 3 };
    case "Root": {
      const m = ops[1];
      if (m === undefined || !isRealInt(m) || m.re < 2) return undefined;
      return {
        c: ce.One,
        u: ops[0]!,
        a: ce.box(["Rational", 1, m.re] as never),
        realRoot: m.re % 2 === 1 ? m.re : undefined,
      };
    }
    default:
      return free(f, x) ? undefined : { c: ce.One, u: f, a: ce.One }; // u itself, if it is linear
  }
}

/** ∂ᵏ/∂xᵏ of `f` for a symbolic (or nonnegative integer) order `k` free of x, when `f` is `c·u^a`
 * with u linear in x. */
export function powerOrderDerivative(
  ce: ComputeEngine,
  f: BoxedExpression,
  xName: string,
  k: BoxedExpression,
): BoxedExpression | undefined {
  if (!free(k, xName) || (isNumber(k) && !(isRealInt(k) && k.re >= 0))) return undefined;
  const form = powerForm(ce, f, xName);
  if (form === undefined) return undefined;
  const { c, u, b, a, realRoot } = form;
  const factors = [c, ce.function("Power", [b, k]), ce.function("FallingFactorial", [a, k])];
  factors.push(
    realRoot === undefined
      ? ce.function("Power", [u, ce.function("Subtract", [a, k])])
      : ce.function("Multiply", [
          ce.function("Root", [u, ce.number(realRoot)]),
          ce.function("Power", [u, ce.function("Negate", [k])]),
        ]),
  );
  return ce.function("Multiply", factors).evaluate();
}

/** The coefficient of (x − x0)ⁿ in `f` about x0, for a symbolic `n`, when `f` is `c·u^a` with u
 * linear in x and nonzero at x0: `c·C(a, n)·bⁿ·u0^(a−n)`, a Piecewise that is 0 for negative n. */
export function powerSeriesCoefficient(
  ce: ComputeEngine,
  f: BoxedExpression,
  xName: string,
  x0: BoxedExpression,
  n: BoxedExpression,
): BoxedExpression | undefined {
  if (isNumber(n) || !free(n, xName) || !free(x0, xName)) return undefined;
  const form = powerForm(ce, f, xName);
  if (form === undefined) return undefined;
  const { c, u, b, a, realRoot } = form;
  const u0 = u.subs({ [xName]: x0.json as never }).evaluate();
  if (u0.is(0)) return undefined; // a branch point or pole at x0, not a Taylor series
  const factors = [c, ce.function("Power", [b, n]), ce.function("Binomial", [a, n])];
  factors.push(
    realRoot === undefined
      ? ce.function("Power", [u0, ce.function("Subtract", [a, n])])
      : ce.function("Multiply", [
          ce.function("Root", [u0, ce.number(realRoot)]),
          ce.function("Power", [u0, ce.function("Negate", [n])]),
        ]),
  );
  const term = ce.function("Multiply", factors).evaluate();
  return ce.box(["Piecewise", ["List", ["List", term.json, ["GreaterEqual", n.json, 0]]], 0] as never).evaluate();
}
