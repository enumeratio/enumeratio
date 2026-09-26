import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// TrigFactor(expr): the factoring counterpart of compute-engine's native TrigExpand /
// TrigReduce / TrigToExp (all three already ship in bare compute-engine — confirmed by
// boxing them directly with no declaration of ours needed; this file adds the one
// member of that family it doesn't have).
//
// Two independent strategies, tried in order:
//  1. The four sum-to-product identities and the two half-angle identities, matched
//     structurally (`Sin(a) +/- Sin(b)`, `Cos(a) +/- Cos(b)`, `1 +/- Cos(x)`) — each
//     confirmed against `wolframscript`'s own `TrigFactor` output up to reordering.
//  2. Failing that: if `expr` is built from `Add`/`Subtract`/`Negate`/`Multiply`/integer
//     `Power` over `Sin(x0)`, `Cos(x0)` (one common argument `x0`, itself any
//     expression) and x0-free numeric coefficients, it is a genuine polynomial in
//     `Sin(x0)`/`Cos(x0)` — substitute `u = Sin(x0)`, `v = Cos(x0)`, run compute-engine's
//     own `Factor` on the polynomial in `u`, `v`, and substitute back. This is provably
//     correct (whatever `Factor` returns for the polynomial IS one, so re-substituting
//     the trig values reconstructs the identity) but does not chase the extra trig
//     identities Wolfram's own `TrigFactor` sometimes prefers (e.g. it rewrites
//     `Sin(x)^2 - Cos(x)^2` as `-2 Sin(pi/4-x) Sin(pi/4+x)` rather than the plain
//     difference-of-squares `(Sin(x)-Cos(x))(Sin(x)+Cos(x))` this strategy gives) — both
//     are correct identities, just not the same factorization; declared as a `note` on
//     the head's Wolfram row rather than chased.
//
// Declined (evaluate returns undefined): two DIFFERENT trig arguments mixed in one
// polynomial (e.g. `Sin(a)*Cos(b)`, outside the four named pairs), any transcendental
// other than `Sin`/`Cos`, an argument-dependent (non-numeric) exponent, and anything
// `recognize`d as a shape but for which `Factor` itself declines.

const opAt = (expr: BoxedExpression, i: number): BoxedExpression => operandsOf(expr)[i];
const isOne = (x: BoxedExpression): boolean => x.re === 1 && x.im === 0;
/** See function-properties.ts's header comment on `isNumberLiteral` — same narrowed,
 * structural read (not on the public `BoxedExpression` type). */
const isIntegerLiteral = (expr: BoxedExpression): boolean =>
  (expr as { isNumberLiteral?: unknown }).isNumberLiteral === true && expr.im === 0 && Number.isInteger(expr.re);

/** `o`, or `Negate[o]`'s operand with a sign flip — reads a 2-term `Add`'s operand as
 * `(value, sign)` so every pattern below can match either arrangement of a `+`/`-`
 * uniformly. */
function signedTerm(o: BoxedExpression): { readonly value: BoxedExpression; readonly sign: 1 | -1 } {
  return o.operator === "Negate" ? { value: opAt(o, 0), sign: -1 } : { value: o, sign: 1 };
}

/** `half(a op b)`, exactly the way `TrigFactor`'s own half-angle arguments print
 * (`Divide[Add[a,b],2]`, not `Multiply[1/2, Add[a,b]]`). */
const half = (ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression, sign: 1 | -1): BoxedExpression =>
  ce.function("Divide", [ce.function("Add", [a, sign === 1 ? b : ce.function("Negate", [b])]), 2]);

/** The four sum-to-product pairs (`Sin(a) +/- Sin(b)`, `Cos(a) +/- Cos(b)`) and the two
 * half-angle pairs (`1 +/- Cos(x)`), matched on a 2-term `Add` in EITHER order (each
 * operand read via `signedTerm`, so which one is written first doesn't matter). */
function matchNamedPairs(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression | undefined {
  if (expr.operator !== "Add") return undefined;
  const ops = operandsOf(expr);
  if (ops.length !== 2) return undefined;
  const [t0, t1] = [signedTerm(ops[0]!), signedTerm(ops[1]!)];

  // 1 +/- Cos(x): one term is the literal +1, the other Cos(x) with either sign.
  const oneTerm = isOne(t0.value) && t0.sign === 1 ? t0 : isOne(t1.value) && t1.sign === 1 ? t1 : undefined;
  const cosTerm = t0.value.operator === "Cos" ? t0 : t1.value.operator === "Cos" ? t1 : undefined;
  if (oneTerm !== undefined && cosTerm !== undefined && oneTerm !== cosTerm) {
    const x = opAt(cosTerm.value, 0);
    const trig = cosTerm.sign === 1 ? "Cos" : "Sin"; // 1+Cos(x)=2Cos(x/2)^2; 1-Cos(x)=2Sin(x/2)^2
    return ce
      .function("Multiply", [2, ce.function("Power", [ce.function(trig, [half(ce, x, ce.Zero, 1)]), 2])])
      .evaluate();
  }

  if (t0.value.operator === "Sin" && t1.value.operator === "Sin") {
    const a = opAt(t0.value, 0);
    const b = opAt(t1.value, 0);
    if (t0.sign === 1 && t1.sign === 1) {
      // Sin(a) + Sin(b) = 2 Sin((a+b)/2) Cos((a-b)/2)
      return ce
        .function("Multiply", [2, ce.function("Sin", [half(ce, a, b, 1)]), ce.function("Cos", [half(ce, a, b, -1)])])
        .evaluate();
    }
    if (t0.sign === 1 && t1.sign === -1) {
      // Sin(a) - Sin(b) = 2 Cos((a+b)/2) Sin((a-b)/2)
      return ce
        .function("Multiply", [2, ce.function("Cos", [half(ce, a, b, 1)]), ce.function("Sin", [half(ce, a, b, -1)])])
        .evaluate();
    }
    if (t0.sign === -1 && t1.sign === 1) {
      // -Sin(a) + Sin(b) = 2 Cos((b+a)/2) Sin((b-a)/2)
      return ce
        .function("Multiply", [2, ce.function("Cos", [half(ce, b, a, 1)]), ce.function("Sin", [half(ce, b, a, -1)])])
        .evaluate();
    }
  }

  if (t0.value.operator === "Cos" && t1.value.operator === "Cos") {
    const a = opAt(t0.value, 0);
    const b = opAt(t1.value, 0);
    if (t0.sign === 1 && t1.sign === 1) {
      // Cos(a) + Cos(b) = 2 Cos((a+b)/2) Cos((a-b)/2)
      return ce
        .function("Multiply", [2, ce.function("Cos", [half(ce, a, b, 1)]), ce.function("Cos", [half(ce, a, b, -1)])])
        .evaluate();
    }
    if (t0.sign !== t1.sign) {
      // Cos(a) - Cos(b) = -2 Sin((a+b)/2) Sin((a-b)/2); the mirror (-a term first)
      // is the same identity with a/b swapped since it's symmetric up to sign.
      const [pos, neg] = t0.sign === 1 ? [a, b] : [b, a];
      return ce
        .function("Multiply", [
          -2,
          ce.function("Sin", [half(ce, pos, neg, 1)]),
          ce.function("Sin", [half(ce, pos, neg, -1)]),
        ])
        .evaluate();
    }
  }
  return undefined;
}

/** Does `expr` contain a subterm structurally equal (`isEqual`) to `target` anywhere? */
function containsExpr(expr: BoxedExpression, target: BoxedExpression): boolean {
  if (expr.isEqual(target)) return true;
  return operandsOf(expr).some((o) => containsExpr(o, target));
}

/** The argument of the first `Sin`/`Cos` node found in `expr` (depth-first), fixing
 * which trig argument `factorViaPolynomial` treats as `x0` — or `undefined` if `expr`
 * has no `Sin`/`Cos` at all. */
function findTrigArgument(expr: BoxedExpression): BoxedExpression | undefined {
  if (expr.operator === "Sin" || expr.operator === "Cos") return opAt(expr, 0);
  for (const o of operandsOf(expr)) {
    const found = findTrigArgument(o);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** `expr` rewritten with every `Sin(x0)` replaced by `u` and every `Cos(x0)` by `v`
 * (`x0` fixed up front by `findTrigArgument`) — or `undefined` if `expr` mixes in a
 * DIFFERENT trig argument, another transcendental of `x0`, or a non-integer/x0-dependent
 * `Power` exponent. Anything not containing `x0` at all (a plain number, an unrelated
 * symbol, `Sin`/`Cos` of some other argument, ...) passes through unchanged as an inert
 * coefficient — that's what makes e.g. `Sin(a)*Sin(x)^2` factor as `Sin(a)*u^2` rather
 * than decline outright. */
function substituteTrig(
  ce: ComputeEngine,
  expr: BoxedExpression,
  x0: BoxedExpression,
  u: BoxedExpression,
  v: BoxedExpression,
): BoxedExpression | undefined {
  if (!containsExpr(expr, x0)) return expr;
  const op = expr.operator;
  if (op === "Sin" && opAt(expr, 0).isEqual(x0)) return u;
  if (op === "Cos" && opAt(expr, 0).isEqual(x0)) return v;
  if (op === "Add" || op === "Multiply" || op === "Subtract") {
    const subOps = operandsOf(expr).map((o) => substituteTrig(ce, o, x0, u, v));
    if (subOps.some((o) => o === undefined)) return undefined;
    return ce.function(op, subOps as BoxedExpression[]);
  }
  if (op === "Negate") {
    const inner = substituteTrig(ce, opAt(expr, 0), x0, u, v);
    return inner === undefined ? undefined : ce.function("Negate", [inner]);
  }
  if (op === "Power") {
    const exponent = opAt(expr, 1);
    if (isIntegerLiteral(exponent) && !containsExpr(exponent, x0)) {
      const base = substituteTrig(ce, opAt(expr, 0), x0, u, v);
      return base === undefined ? undefined : ce.function("Power", [base, exponent]);
    }
    return undefined;
  }
  return undefined; // x0 appears under a head this file doesn't cross (another
  // transcendental, a second distinct trig argument, ...) — decline rather than guess.
}

/** Substitute a polynomial in `Sin(x0)`/`Cos(x0)` via compute-engine's own `Factor`,
 * then translate the factored polynomial back through `u -> Sin(x0)`, `v -> Cos(x0)`. */
function factorViaPolynomial(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression | undefined {
  const x0 = findTrigArgument(expr);
  if (x0 === undefined) return undefined;
  const u = ce.symbol("_TrigFactorU");
  const v = ce.symbol("_TrigFactorV");
  const poly = substituteTrig(ce, expr, x0, u, v);
  if (poly === undefined) return undefined;
  const factored = ce.function("Factor", [poly]).evaluate();
  const uName = symbolNameOf(u);
  const vName = symbolNameOf(v);
  if (uName === undefined || vName === undefined) return undefined;
  return factored.subs({ [uName]: ce.function("Sin", [x0]), [vName]: ce.function("Cos", [x0]) }).evaluate();
}

export function matchTrigFactor(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression | undefined {
  return matchNamedPairs(ce, expr) ?? factorViaPolynomial(ce, expr);
}

export function declareTrigFactor(ce: ComputeEngine): void {
  ce.declare("TrigFactor", {
    signature: "(value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [expr] = ops;
      if (expr === undefined || ops.length !== 1) return undefined;
      return matchTrigFactor(ce, expr);
    },
  });
}
