import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { derivativeAt } from "./tagged-calculus.ts";
import type { Resolver } from "./tagged-arithmetic.ts";

// Around(x, dx) — Wolfram's number-with-uncertainty, propagated to first order: `f(Around(x,
// dx))` is `Around(f(x), |f'(x)| dx)`, and several independent uncertainties combine in
// quadrature, `sqrt(Σ dxᵢ²)`. This is the same "first-order error propagation" every physics
// lab does by hand; Wolfram's `Around` just automates it.
//
// Extends the heads the backlog examples actually push an `Around` through: `Add`
// (n-ary quadrature sum — this also covers `Subtract`, which canonicalizes to `Add` +
// `Negate`; see interval.ts), `Multiply` (an exact scalar factor scales linearly; several
// `Around` factors combine their RELATIVE uncertainties in quadrature, which is the same
// quadrature rule after factoring out the center), `Power` with a concrete exponent, `Power`
// with base `E` (`Exp`, which canonicalizes to `E^x` — the same reason `Negate` stands in for
// `Subtract`), and `Sqrt`/`Erf` via compute-engine's own symbolic derivative (`D`), so no
// derivative table has to be kept by hand for those. The Add/Multiply/Power resolvers are
// merged with Interval's and CenteredInterval's and registered once per head by
// `declare-tagged-arithmetic.ts` (see tagged-arithmetic.ts for why); `Sqrt`/`Erf` are
// Around's alone, registered the same way for a consistent, low-overhead hook.
//
// A head is propagated through AS ONE FUNCTION of its uncertain argument, before its own
// definition gets to expand it: `Multinomial(Around(2, 0.01), 2)` is `(a+2)!/(a!·2!)`, and
// pushing the `Around` through that formula term by term would count the same uncertainty in
// the numerator and the denominator as if they were independent (the dependency problem).
// Differentiating the whole head gives the true first-order spread, `Around(6, 0.035)`.

const isAround = (e: BoxedExpression): boolean => e.operator === "Around" && operandsOf(e).length === 2;

const centerOf = (e: BoxedExpression): BoxedExpression => operandsOf(e)[0];
const deltaOf = (e: BoxedExpression): BoxedExpression => operandsOf(e)[1];

/** A numeric (double) view of a boxed expression's value. */
const numOf = (e: BoxedExpression): number => e.N().re;

/** Build `Around(c, d)` from plain numbers. */
const around = (ce: ComputeEngine, c: number, d: number): BoxedExpression =>
  ce.function("Around", [ce.number(c), ce.number(d)]).evaluate();

/** `e` as an `Around`, degenerate `(e, 0)` (no uncertainty) if it is a plain number. */
const asAround = (ce: ComputeEngine, e: BoxedExpression): BoxedExpression =>
  isAround(e) ? e : ce.function("Around", [e, 0]).evaluate();

/** Σ dxᵢ² summed in quadrature for independent `Around` operands of `Add`; a plain scalar
 * operand contributes 0. */
function aroundAdd(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression {
  const parts = ops.map((o) => asAround(ce, o));
  const c = parts.reduce((acc, p) => acc + numOf(centerOf(p)), 0);
  const d = Math.sqrt(parts.reduce((acc, p) => acc + numOf(deltaOf(p)) ** 2, 0));
  return around(ce, c, d);
}

/** A product of `Around`s: relative uncertainties combine in quadrature — equivalent to the
 * chain rule `d(∏xᵢ) = Σⱼ (∏_{i≠j} xᵢ) dxⱼ`, taken in quadrature, divided back out by the
 * product's own value. A single `Around` times exact scalars is the same formula with every
 * scalar's relative uncertainty at 0, which reduces to plain linear scaling. */
function aroundMultiply(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression {
  const parts = ops.map((o) => asAround(ce, o));
  const c = parts.reduce((acc, p) => acc * numOf(centerOf(p)), 1);
  const relSquared = parts.reduce((acc, p) => {
    const pc = numOf(centerOf(p));
    const pd = numOf(deltaOf(p));
    return pd === 0 ? acc : acc + (pd / pc) ** 2;
  }, 0);
  return around(ce, c, Math.abs(c) * Math.sqrt(relSquared));
}

/** `Around(x, dx)^n` for a concrete exponent `n`: `Around(x^n, |n·x^(n-1)|·dx)`. */
function aroundPower(ce: ComputeEngine, a: BoxedExpression, n: BoxedExpression): BoxedExpression {
  const A = asAround(ce, a);
  const c = numOf(centerOf(A));
  const nn = n.re;
  return around(ce, c ** nn, Math.abs(nn * c ** (nn - 1)) * numOf(deltaOf(A)));
}

/** `E^Around(x, dx)` (Wolfram's `Exp`, which canonicalizes to a `Power` with base `E`):
 * `Around(e^x, e^x·dx)`. */
function aroundExpBase(ce: ComputeEngine, x: BoxedExpression): BoxedExpression {
  const X = asAround(ce, x);
  const value = Math.exp(numOf(centerOf(X)));
  return around(ce, value, value * numOf(deltaOf(X)));
}

/** `f(Around(x, dx))` for a unary `head`: `Around(f(x), |f'(x)|·dx)`. `f'` comes from
 * `derivativeAt` — compute-engine's own `D` where that resolves (BarnesG, Gamma, Erf, the
 * trig and hyperbolic families), a central difference where it doesn't (DirichletEta,
 * DirichletBeta, ErfInv — checked in `.scratch/probe2.ts`, not guessed). */
function aroundUnary(ce: ComputeEngine, head: string, a: BoxedExpression): BoxedExpression | undefined {
  const A = asAround(ce, a);
  const c = numOf(centerOf(A));
  const derivative = derivativeAt(ce, head, [ce.number(c)], 0, c);
  if (derivative === undefined) return undefined;
  const value = numOf(ce.function(head, [ce.number(c)]));
  if (!Number.isFinite(value)) return undefined;
  return around(ce, value, Math.abs(derivative) * numOf(deltaOf(A)));
}

/** Every head examples push a lone `Around` through as its ONLY argument (`f(Around(x,dx))`)
 * — resolved via `aroundUnary`, `derivativeAt`'s symbolic/numeric-fallback derivative either
 * way. `LogGamma` is our own continuation (declared separately from compute-engine's
 * `GammaLn`, same value where both are defined — see elementary-special-values.ts); both get
 * the rule since either name might appear. `Log2` and `Log10` canonicalize to `Log(x, b)`,
 * handled with the multi-argument heads below. */
const UNARY_HEADS = [
  "Sqrt",
  "Erf",
  "Erfc",
  "ErfInv",
  "Sin",
  "Cos",
  "Tan",
  "Cot",
  "Sec",
  "Csc",
  "Arcsin",
  "Arccos",
  "Arctan",
  "Sinh",
  "Cosh",
  "Tanh",
  "Ln",
  "Gamma",
  "GammaLn",
  "LogGamma",
  "Digamma",
  "BarnesG",
  "LogBarnesG",
  "DirichletEta",
  "DirichletBeta",
] as const;

/** `f(…, Around(x,dx), …)` at a fixed argument position `argIndex`, every OTHER argument
 * exact/fixed — the shape `HarmonicNumber(order, Around(a, da))`, `Zeta(s, Around(a, da))`,
 * `LerchPhi(Around(z, dz), s, a)` and `BetaRegularized(Around(x, dx), a, b)` all share.
 * `derivativeAt` differentiates `head` in that one position with the rest held fixed. */
function aroundOverArg(
  ce: ComputeEngine,
  head: string,
  ops: readonly BoxedExpression[],
  argIndex: number,
): BoxedExpression | undefined {
  const target = ops[argIndex];
  if (target === undefined || !isAround(target)) return undefined;
  const A = asAround(ce, target);
  const c = numOf(centerOf(A));
  const fixed = ops.map((o, i) => (i === argIndex ? ce.number(c) : o));
  const derivative = derivativeAt(ce, head, fixed, argIndex, c);
  if (derivative === undefined) return undefined;
  const value = ce.function(head, fixed).N().re;
  if (!Number.isFinite(value)) return undefined;
  return around(ce, value, Math.abs(derivative) * numOf(deltaOf(A)));
}

/** `{head: the argument position an Around can occupy}` for the multi-argument heads above —
 * every other argument is taken as given (exact, fixed) in `aroundOverArg`. */
const MULTI_ARG_HEADS: Readonly<Record<string, number>> = {
  Log: 0,
  HarmonicNumber: 1,
  Zeta: 1,
  HurwitzZeta: 1,
  LerchPhi: 0,
  BetaRegularized: 0,
};

/** `f(…, Around(x,dx), …)` for a head whose arguments are interchangeable, so the `Around` may
 * sit in any one slot -- `Multinomial(2, Around(2, 0.01))` as much as the other way round.
 * One uncertain argument; with several, their correlations through the head are not known here,
 * so this declines. */
function aroundInAnySlot(
  ce: ComputeEngine,
  head: string,
  ops: readonly BoxedExpression[],
): BoxedExpression | undefined {
  const slots = ops.flatMap((o, i) => (isAround(o) ? [i] : []));
  return slots.length === 1 ? aroundOverArg(ce, head, ops, slots[0]!) : undefined;
}

/** Heads whose `Around` may sit in any argument -- see `aroundInAnySlot`. */
const ANY_SLOT_HEADS = ["Multinomial"] as const;

/** The head itself, inert: every operation on it goes through the resolvers below. Declared
 *  so `Around` is a binding like any other head, not just a name the resolvers recognise. */
export function declareAround(ce: ComputeEngine): void {
  ce.declare("Around", { signature: "(value, value?) -> number" });
}

/** This module's resolvers, one per head it extends — see the file header. */
export function aroundResolvers(ce: ComputeEngine): Readonly<Record<string, Resolver>> {
  const resolvers: Record<string, Resolver> = {
    Add: (ops) => (ops.some(isAround) ? aroundAdd(ce, ops) : undefined),
    Multiply: (ops) => (ops.some(isAround) ? aroundMultiply(ce, ops) : undefined),
    Power: (ops, raw) => {
      if (ops.length !== 2) return undefined;
      const [a, n] = ops;
      const rawA = raw[0];
      if (a === undefined || n === undefined) return undefined;
      if (isAround(a)) return aroundPower(ce, a, n);
      // `raw` (pre-numericization) catches `E^Around(x,dx)` even under N(), where `a` itself
      // has already been decimalized (see tagged-arithmetic.ts's Resolver doc).
      if ((rawA ?? a).isSame(ce.E) && isAround(n)) return aroundExpBase(ce, n);
      return undefined;
    },
  };
  for (const head of UNARY_HEADS) {
    resolvers[head] = (ops) =>
      ops.length === 1 && ops[0] !== undefined && isAround(ops[0]) ? aroundUnary(ce, head, ops[0]) : undefined;
  }
  for (const [head, argIndex] of Object.entries(MULTI_ARG_HEADS)) {
    resolvers[head] = (ops) => aroundOverArg(ce, head, ops, argIndex);
  }
  for (const head of ANY_SLOT_HEADS) {
    resolvers[head] = (ops) => aroundInAnySlot(ce, head, ops);
  }
  return resolvers;
}
