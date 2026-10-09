import type { CompileHandler, Expr } from "./facade.ts";

/**
 * A compile stance that guards a head: the built-in lowering is used unless `refuses` holds for the
 * call's operands, and then compiling throws (a `CompileHandler` that declines otherwise).
 */
export function refusing(refuses: (operands: readonly Expr[]) => boolean, why: string): CompileHandler {
  return (operands, _compile, context) => {
    if (refuses(operands as unknown as readonly Expr[])) throw new Error(`no ${context.language} lowering: ${why}`);
    return undefined;
  };
}

/**
 * A guard for a head whose extra cases are for non-integer operands: it compiles only where the
 * operands at `positions` (all of them when none are named) are known to be integers.
 */
export const onlyForIntegers = (why: string, ...positions: readonly number[]): CompileHandler =>
  refusing(
    (operands) =>
      (positions.length === 0 ? operands : positions.map((i) => operands[i])).some((op) => op?.isInteger !== true),
    why,
  );
