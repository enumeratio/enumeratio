import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  bigIntegerAt,
  bigRationalAt,
  integerAt,
  operandsOf,
  wrapOperator,
} from "@enumeratio/boxed";
import * as adic from "./adic.ts";
import type { Adic } from "./adic.ts";

// The b-adic value head and its arithmetic.
//
//   AdicNumeral(b, x)        an exact b-adic: any rational x whose denominator b can invert
//   AdicNumeral(b, x, prec)  x + O(b^prec), normalised to its representative
//
// There is no number-type extension point in compute-engine (see hypercomplex/declare.ts
// for the long version), so the value is a function expression and `Add`, `Multiply`,
// `Negate`, `Divide`, `Power` are wrapped (`Subtract` canonicalises to `Add` + `Negate`) to answer when one shows up. A
// rational operand next to an adic one is read as the same rational in Z_b, so
// `AdicNumeral(10, 1/3) * 3` is `AdicNumeral(10, 1)`.

export const ADIC = "AdicNumeral";

const bigBase = (expr: BoxedExpression | undefined): bigint | undefined => {
  const b = bigIntegerAt(expr);
  return b === undefined || b < 2n ? undefined : b;
};

const precisionAt = (expr: BoxedExpression | undefined): number | undefined => {
  if (expr === undefined) return undefined;
  const p = integerAt(expr);
  return p === undefined || p < 1 ? undefined : p;
};

/** Read an `AdicNumeral(...)` expression, or a rational in the given base. */
export function adicOf(expr: BoxedExpression, base?: bigint): Adic | undefined {
  if (expr.operator === ADIC) {
    const [b, x, p] = operandsOf(expr);
    const bb = bigBase(b);
    if (bb === undefined || x === undefined) return undefined;
    if (base !== undefined && bb !== base) return undefined;
    const inner = adicOf(x, bb);
    if (inner === undefined) return undefined;
    const prec = precisionAt(p);
    return prec === undefined ? inner : adic.at(inner, prec);
  }
  if (base === undefined) return undefined;
  const r = bigRationalAt(expr);
  return r === undefined ? undefined : adic.exact(base, r[0], r[1]);
}

const isAdic = (expr: BoxedExpression): boolean => expr.operator === ADIC;

/** The base every adic operand shares, or `undefined` if they disagree or none is adic. */
function sharedBase(ops: readonly BoxedExpression[]): bigint | undefined {
  let base: bigint | undefined;
  for (const op of ops) {
    if (!isAdic(op)) continue;
    const b = bigBase(operandsOf(op)[0]);
    if (b === undefined || (base !== undefined && b !== base)) return undefined;
    base = b;
  }
  return base;
}

export function toExpression(ce: ComputeEngine, x: Adic): BoxedExpression {
  const value = ce.number(x.den === 1n ? x.num : [x.num, x.den]);
  const ops = [ce.number(x.base), value];
  if (x.prec !== undefined) ops.push(ce.number(x.prec));
  return ce.function(ADIC, ops);
}

export function declareAdic(ce: ComputeEngine): void {
  // Evaluating the constructor normalises: reduces the rational, caps to `prec`, and
  // declines a rational the base cannot expand (1/2 in Z_10).
  ce.declare(ADIC, {
    signature: "(integer, any, integer?) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const value = adicOf(ce.function(ADIC, ops));
      return value === undefined ? undefined : toExpression(ce, value);
    },
  });

  const lift = (ops: readonly BoxedExpression[]): Adic[] | undefined => {
    const base = sharedBase(ops);
    if (base === undefined) return undefined;
    const values = ops.map((op) => adicOf(op, base));
    return values.every((v): v is Adic => v !== undefined) ? values : undefined;
  };

  const anyAdic = (ops: readonly BoxedExpression[]): boolean => ops.some(isAdic);

  const fold =
    (step: (x: Adic, y: Adic) => Adic | undefined) =>
    (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const values = lift(ops);
      if (values === undefined || values.length === 0) return undefined;
      let acc: Adic | undefined = values[0];
      for (const next of values.slice(1)) {
        if (acc === undefined) return undefined;
        acc = step(acc, next);
      }
      return acc === undefined ? undefined : toExpression(ce, acc);
    };

  wrapOperator(ce, ["Add", "x", "y"], anyAdic, () => fold(adic.add));
  wrapOperator(ce, ["Multiply", "x", "y"], anyAdic, () => fold(adic.multiply));
  wrapOperator(ce, ["Divide", "x", "y"], anyAdic, () => fold(adic.divide), 2);
  wrapOperator(
    ce,
    ["Negate", "x"],
    anyAdic,
    () => (ops) => {
      const [x] = lift(ops) ?? [];
      const result = x === undefined ? undefined : adic.negate(x);
      return result === undefined ? undefined : toExpression(ce, result);
    },
    1,
  );
  wrapOperator(
    ce,
    ["Power", "x", "y"],
    (ops) => ops[0] !== undefined && isAdic(ops[0]),
    () => (ops) => {
      const [base, exponent] = ops;
      const x = base === undefined ? undefined : adicOf(base);
      const e = integerAt(exponent);
      if (x === undefined || e === undefined) return undefined;
      const result = adic.power(x, e);
      return result === undefined ? undefined : toExpression(ce, result);
    },
    2,
  );

  const unary = (
    head: string,
    signature: string,
    answer: (x: Adic, ops: readonly BoxedExpression[]) => BoxedExpression | undefined,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const x = ops[0] === undefined ? undefined : adicOf(ops[0]);
        return x === undefined ? undefined : answer(x, ops);
      },
    });
  };

  unary("AdicValuation", "(any) -> number", (x) => {
    const v = adic.valuationOf(x);
    return Number.isFinite(v) ? ce.number(v) : ce.symbol("PositiveInfinity");
  });

  // |x|_b = b^(−v): small when highly divisible by b.
  unary("AdicNorm", "(any) -> number", (x) => {
    const v = adic.valuationOf(x);
    if (!Number.isFinite(v)) return ce.number(0);
    const scale = adic.pow(x.base, Math.abs(v));
    return ce.number(v >= 0 ? [1n, scale] : scale);
  });

  unary("AdicUnitPart", "(any) -> value", (x) => {
    const u = adic.unitPart(x);
    return u === undefined ? undefined : toExpression(ce, u);
  });

  // Digits from the valuation upward, LEAST significant first: an adic has a right end
  // and no left end, so this is the only order that lists it.
  unary("AdicDigits", "(any, integer?) -> list<integer>", (x, ops) => {
    const count = precisionAt(ops[1]) ?? adic.DEFAULT_PRECISION;
    const { digits } = adic.expansion(x, count);
    return ce.function(
      "List",
      digits.map((d) => ce.number(d)),
    );
  });

  unary("AdicExpansion", "(any, integer?) -> string", (x, ops) =>
    ce.string(adic.render(x, precisionAt(ops[1]) ?? adic.DEFAULT_PRECISION)),
  );

  unary("AdicSqrt", "(any, integer?) -> value", (x, ops) => {
    const root = adic.sqrt(x, precisionAt(ops[1]) ?? adic.DEFAULT_PRECISION);
    return root === undefined ? undefined : toExpression(ce, root);
  });

  // HenselLift(f, seed, b, prec?): the b-adic root of the polynomial f (in its one free
  // variable) that reduces to `seed` mod b. f and f' are evaluated on exact integers
  // through the engine, so any expression it can differentiate will do. Composite b is
  // allowed when f'(seed) is a unit mod b — that is how the 10-adic idempotents arise.
  ce.declare("HenselLift", {
    signature: "(any, integer, integer, integer?) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, seedExpr, pExpr, precExpr] = ops;
      if (f === undefined) return undefined;
      const seed = bigIntegerAt(seedExpr);
      const p = bigBase(pExpr);
      const prec = precisionAt(precExpr) ?? adic.DEFAULT_PRECISION;
      const variable = [...f.unknowns][0];
      if (seed === undefined || p === undefined || variable === undefined) return undefined;
      const df = ce.box(["D", f.json as never, variable]).evaluate();
      const evaluateAt =
        (g: BoxedExpression) =>
        (n: bigint): bigint | undefined =>
          bigIntegerAt(g.subs({ [variable]: ce.number(n) }).evaluate());
      const root = adic.henselLift(p, evaluateAt(f), evaluateAt(df), seed, prec);
      return root === undefined ? undefined : toExpression(ce, root);
    },
  });
}
