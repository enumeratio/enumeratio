import { canonicalCall } from "./ce-internals.ts";
import { type CompileStance, extendHead } from "./extend.ts";
import type { Engine, Expr } from "./facade.ts";
import { isOptionList, ruleOf } from "./options.ts";
import { nativeCanonical } from "./probe.ts";

/**
 * Make `head` take its trailing options as `Rule`s. compute-engine canonicalises Epsil's
 * `name -> value` (a `KeyValuePair`) to a `Tuple`, which a broadcastable head threads over
 * (`Numerator(x, Over -> R)` fans out across `Over` and `R`); a `Rule` is an opaque
 * expression, so the option reaches the head whole with no `tuples` exemption. Only the
 * trailing run of rules is rewritten, as `optionsOf` reads them: an earlier pair is data.
 */
export function takeOptionsAsRules(ce: Engine, head: string, compile?: CompileStance): void {
  const native = nativeCanonical(ce, head);
  const isOption = (op: Expr): boolean => ruleOf(op.json) !== undefined || isOptionList(op.json);
  extendHead(ce, head, {
    canonical: (ops: readonly Expr[], options) => {
      let end = ops.length;
      while (end > 0 && isOption(ops[end - 1]!)) end--;
      // A lazy head's operands arrive as written (a `KeyValuePair`), a strict head's already canonical (a `Tuple`).
      const rules = ops.map((op, i) =>
        i >= end && ruleOf(op.json) !== undefined
          ? ce.function("Rule", [...((op as { ops?: readonly Expr[] }).ops ?? [])])
          : op,
      );
      return native !== undefined
        ? native(rules, options)
        : (canonicalCall(
            ce,
            head,
            rules.map((op) => op.canonical),
          ) as Expr);
    },
    compile,
  });
}
