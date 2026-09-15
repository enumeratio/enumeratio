// Composition of maps, as an operation rather than a name.
//
// The catalog contains `ReverseComplement` and — really —
// `InverseAfterComplementAfterReverse`. Those names are not descriptions of anything new;
// they are what a catalog produces when it has no way to SAY composition. FindStat generated
// them for the same reason. Given `Compose`, the second is
// `Compose(Inverse, Complement, Reverse)` and needs no name at all.
//
// This is the same argument as anonymous restrictions (restriction.ts): a named head cannot
// serve a construction with infinitely many instances, and composition has more instances
// than restriction does. The names stay where the catalog has them, but they become thin
// aliases over the operation instead of definitions in their own right.
//
// compute-engine has no composition operator of its own — no `Compose`, no `Composition`,
// no `@*` — so this declares one. Wolfram spells it `Composition` and reads it right to
// left as we do, which is a transpiler mapping rather than a reason to rename.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

/** Apply `steps` to `subject` right to left — `compose(f, g)(x)` is `f(g(x))`.
 *
 *  Each step goes through its own declared head, so every intermediate value is a properly
 *  constructed carrier and each step is type-checked against the next. That is the whole
 *  reason maps carry types. */
export function applyComposition(
  ce: ComputeEngine,
  steps: readonly string[],
  subject: BoxedExpression,
): BoxedExpression {
  return [...steps]
    .reverse()
    .reduce<BoxedExpression>((value, step) => ce.function(step, [value]).evaluate(), subject);
}

/**
 * Declare `Compose`. `Compose(f, g, h)` is a function value applying h, then g,
 * then f — the right-to-left reading, as the composition is written in mathematics.
 */
export function declareCompose(ce: ComputeEngine): void {
  ce.declare("Compose", {
    // `(any+)`, not `(symbol+)`: a declared operator's symbol carries that operator's
    // FUNCTION type, so a signature asking for `symbol` rejects exactly the names worth
    // composing.
    signature: "(any+) -> function",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const steps = ops.map(symbolNameOf).filter((name): name is string => name !== undefined);
      if (steps.length !== ops.length) return undefined;
      // A function value that closes over the step names. `_composed` is a bound parameter,
      // not a wildcard: it never escapes this expression.
      return ce.function("Function", [
        ce.function("ComposeApply", [
          ce.function(
            "List",
            steps.map((step) => ce.symbol(step)),
          ),
          ce.symbol("_composed"),
        ]),
        ce.symbol("_composed"),
      ]);
    },
  });

  // The applier the function value above calls. Separate because a `Function` body has to be
  // an expression, and the composition itself is a fold that only makes sense once the
  // argument is known.
  ce.declare("ComposeApply", {
    signature: "(list<any>, any) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [list, subject] = ops;
      if (list === undefined || subject === undefined) return undefined;
      const names = operandsOf(list)
        .map(symbolNameOf)
        .filter((name): name is string => name !== undefined);
      if (names.length === 0) return subject;
      return applyComposition(ce, names, subject);
    },
  });
}
