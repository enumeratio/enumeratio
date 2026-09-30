import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";

// cortex-js/compute-engine: `symbolic/simplify-rules.ts`'s log-combination rule rewrites
// `Add(±Ln(a), ±Ln(b), …)` into `Ln(a·b·…)` / `Ln(a/b)` unconditionally. That identity holds
// for the PRINCIPAL branch only when every combined argument is positive:
//
//   - `Ln(a) + Ln(b) = Ln(a*b)` fails when both `a` and `b` are negative -- it differs by
//     `2*pi*i` (`Ln(-1) + Ln(-1) = 2*pi*i`, but `Ln((-1)*(-1)) = Ln(1) = 0`).
//   - `Ln(b) - Ln(a) = Ln(b/a)` fails specifically when `a` is negative and `b` is positive
//     (verified numerically: `-Ln(2 - x) + Ln(2 + x)` at `x = 3` is `ln(5) - pi*i`, but
//     `Ln((x + 2) / (2 - x))` is `ln(5) + pi*i` -- see the patch's `fixed`/tests).
//
// Every case above is sound when every argument is positive, so gating on that (`.isPositive
// === true`, decline otherwise) never blocks a valid rewrite, only an unsound one -- and,
// short of tracking the sign of every real number precisely, is the simplest condition that
// is always safe regardless of which +/- combination the native rule folds.
//
// The native rule may combine only SOME of an `Add`'s operands (`Ln(a) + Ln(b) + 5` still
// folds the two logs, leaving `5` alone), so every `Ln`/`Log` term present is checked, not
// just whichever ones the native rule happened to touch.

/** Every `Ln`/`Log` argument among `expr`'s (possibly `Negate`d) `Add` operands, or
 * `undefined` if there are fewer than two (nothing to combine, so nothing to gate). */
function logArgumentsOf(expr: BoxedExpression): readonly BoxedExpression[] | undefined {
  if (expr.operator !== "Add") return undefined;
  const args: BoxedExpression[] = [];
  for (const op of operandsOf(expr)) {
    const inner = op.operator === "Negate" ? operandsOf(op)[0] : op;
    if (inner === undefined || (inner.operator !== "Ln" && inner.operator !== "Log")) continue;
    const arg = operandsOf(inner)[0];
    if (arg !== undefined) args.push(arg);
  }
  return args.length >= 2 ? args : undefined;
}

type SimplifyRule = (expr: BoxedExpression) => { value?: BoxedExpression } | undefined;

/** Patch compute-engine's log-combination simplify rule, in place, to decline (leave the
 * `Add` unsimplified) unless every combined `Ln`/`Log` argument is provably positive. Found by
 * PROBING the rule array with a synthetic `Ln(a) + Ln(b)` -- whichever rule folds that into one
 * `Ln` is the one to gate -- rather than a fixed index, so this survives the array being
 * reordered or resized by an unrelated upstream change. */
export function simplifyLogCombinationOnProvablePositivity(ce: ComputeEngine): void {
  const rules = [...ce.simplificationRules];
  // Scoped: boxing the bare `a`/`b` probe would otherwise declare them as free symbols on `ce`
  // itself, permanently -- this runs against the real engine, not a throwaway one.
  ce.pushScope();
  const probe = ce.box(["Add", ["Ln", "a"], ["Ln", "b"]] as never);
  const index = rules.findIndex((rule) => {
    if (typeof rule !== "function") return false;
    let result: { value?: BoxedExpression } | undefined;
    try {
      result = (rule as SimplifyRule)(probe);
    } catch {
      return false;
    }
    return result?.value !== undefined && (result.value.operator === "Ln" || result.value.operator === "Log");
  });
  ce.popScope();
  if (index < 0) return;

  const native = rules[index] as SimplifyRule;
  const gated: SimplifyRule = (expr) => {
    const result = native(expr);
    if (result === undefined) return result;
    const args = logArgumentsOf(expr);
    if (args === undefined) return result;
    return args.every((a) => a.isPositive === true) ? result : undefined;
  };
  rules[index] = gated as (typeof rules)[number];
  ce.simplificationRules = rules as never;
}
