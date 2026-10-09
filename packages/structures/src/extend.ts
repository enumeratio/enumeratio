// Extending a compute-engine built-in with a case of our own, without losing what it did.
//
// `declareProtocol` / `declareProtocolImplementation` is real typeclass dispatch, one
// implementation per (type, protocol) — but only for NEW names. A protocol member named
// `Reverse` does not extend compute-engine's `Reverse`; the built-in still wins.
//
// `defineOverload` (`@enumeratio/engine`) is the way that works for an EXISTING head: a row in
// its table, attached to the operator object already on `ce` IN PLACE — `operator.evaluate`
// becomes a dispatcher over the rows and the head's own handler, `operator.signature` gains our
// clause — rather than `ce.declare`-ing a second definition. That is what preserves an
// `evaluate`-backed head (`Sign`, `Inverse`, `Sort`) AND a COLLECTION-backed one (`Reverse`,
// `Complement`, whose behaviour lives in `collection` handlers, with no `evaluate` of its own)
// the same way: `.collection` sits untouched on that same object, so a call that stays
// unevaluated (`Reverse([1,2,3])`, genuinely lazy) is still the ORIGINAL call, under its own
// name — nothing was ever re-declared for it to leak a private spelling out of.
//
// Verified to preserve laziness and every original overload, with nothing leaking:
//
//   Reverse(Permutation([1,2,3]))   Permutation([3,2,1])   ours
//   Reverse([1,2,3])                Reverse([1,2,3])       still the built-in, still lazy
//   At(Reverse([1,2,3]), 1)         3                      handlers intact
//   Reverse("abc")                  'cba'                  string overload intact

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { defineOverload, extendHead, overloadTable, type EvaluateOptions } from "@enumeratio/engine";

/** Heads whose `evaluate` has already had the materialization fallback below layered on
 *  -- so a second `extendBuiltin` call for another carrier on the same collection-backed head
 *  doesn't stack a second, redundant layer. */
const materializes = new WeakMap<ComputeEngine, Set<string>>();

/** The marker that once made a name private, for a mechanism this file no longer uses (see the
 *  top of the file) — kept for the two things still spelled against it: a stray `<Head>_` a
 *  reader may still meet from before this changed, and `publicName`, a generically useful "drop
 *  a trailing underscore" a caller may still want regardless. A TRAILING underscore, because it
 *  is legal in a compute-engine symbol, never appears at the end of a real head, and is one
 *  character to strip when emitting. A LEADING underscore would collide with the
 *  pattern-wildcard convention (`_x`), so it was never available either way. */
export const PRIVATE_SUFFIX = "_";

/** Where a collection-backed original was once kept, under the mechanism above. */
export const privateNameFor = (head: string): string => `${head}${PRIVATE_SUFFIX}`;

/** The public spelling of a name that may be private. Emitting an AST for a reader — a
 *  serialiser, a reference page, an oracle probe — should run names through this, which is
 *  the whole point of marking privacy with one strippable character. */
export const publicName = (name: string): string =>
  name.endsWith(PRIVATE_SUFFIX) ? name.slice(0, -PRIVATE_SUFFIX.length) : name;

export interface Extension {
  /** The package extending it, as the manifest names it. */
  readonly package: string;
  /** The built-in to extend. */
  readonly head: string;
  /** The carrier type this extension handles. */
  readonly on: string;
  /** What the extension returns, as a type expression. */
  readonly returns: string;
  /** Our case. Called only when the argument really is `on`. */
  readonly handle: (subject: BoxedExpression, ce: ComputeEngine) => BoxedExpression | undefined;
}

/**
 * Add `extension`'s case to an existing head, preserving everything the head already did.
 *
 * Returns false when the head is not declared at all — in which case the caller should just
 * declare it normally, and there is nothing to preserve.
 */
export function extendBuiltin(ce: ComputeEngine, extension: Extension): boolean {
  const operator = ce.lookupDefinition(extension.head)
    ? ce.box([extension.head, ce.number(1)] as never).operatorDefinition
    : undefined;
  if (!operator) return false;

  const signature = `(${extension.on}) -> ${extension.returns}`;
  // Idempotent: a second call for the same (package, carrier) pair is a no-op, not a second
  // row. `defineOverload` itself does not dedupe (a caller legitimately wants several rows
  // from the same package for different carriers) -- but two IDENTICAL rows, from a caller
  // (`declareMaps`, here) that runs more than once over the same engine, join into a
  // signature with the same type parameter bound twice, which `ce.type()` refuses to parse
  // ("declared more than once"), and `operator.signature` is left on whatever it was before
  // the throw -- silently dropping the extension's `collection` behaviour along with it.
  if (
    overloadTable(ce, extension.head)?.rows.some(
      (row) => row.package === extension.package && row.signature === signature,
    )
  )
    return true;

  // See the top of the file: one row, for either kind of head, no second definition.
  const added = defineOverload(ce, extension.head, {
    package: extension.package,
    signature,
    arity: 1,
    types: [extension.on],
    evaluate: (ops) => extension.handle(ops[0]!, ce),
  });
  if (added) restoreMaterialization(ce, extension.head);
  return added;
}

/**
 * `defineOverload` gives a collection-backed head (`Reverse`, `Complement`, …) a real
 * `operator.evaluate` where it had none -- and compute-engine's own materialization step
 * (`expr.evaluate({materialization})`, what `Map`/reference examples use for a lazy result)
 * only walks a call's `collection` handlers when its operator has NO `evaluate` at all; one
 * that merely declines (returns `undefined`, our dispatcher's fallback for an operand that
 * isn't ours) still counts as having one, and materialization stops cold -- `Map(Reverse,
 * xs)` stayed `[Reverse(a, b), …]`, unmaterialized, instead of `[[b, a], …]`. Layered back on
 * here: when the dispatcher declines AND materialization was asked for, walk
 * `options.expression`'s own `.each()` by hand, the same elements the untouched `collection`
 * handlers would give a direct caller.
 */
function restoreMaterialization(ce: ComputeEngine, head: string): void {
  const operator = ce.box([head, ce.number(1)] as never).operatorDefinition;
  const done = materializes.get(ce) ?? new Set<string>();
  materializes.set(ce, done);
  if (operator?.collection === undefined || done.has(head)) return;
  done.add(head);
  const dispatched = operator.evaluate as (
    ops: readonly BoxedExpression[],
    options: EvaluateOptions,
  ) => BoxedExpression | undefined;
  extendHead(ce, head, {
    // Only answers `evaluate({ materialization })`, which compiled code never asks for.
    compile: "builtin",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      const result = dispatched(ops, options);
      if (result !== undefined) return result;
      // `materialization` is `boolean | number | [number, number]`; anything but `false` or
      // absent asks for it.
      const materialization = options.materialization as boolean | number | readonly number[] | undefined;
      if (materialization === undefined || materialization === false) return undefined;
      const expr = (options as { expression?: BoxedExpression }).expression;
      if (expr === undefined || !expr.isCollection) return undefined;
      try {
        return expr.engine.function("List", [...expr.each()]);
      } catch {
        return undefined;
      }
    },
  });
}
