// Extending a compute-engine built-in with a case of our own, without losing what it did.
//
// Three mechanisms exist, and which applies depends on how the built-in is implemented:
//
//   1. `declareProtocol` / `declareProtocolImplementation` is real typeclass dispatch, one
//      implementation per (type, protocol) — but only for NEW names. A protocol member named
//      `Reverse` does not extend compute-engine's `Reverse`; the built-in still wins.
//
//   2. A signature is already an INTERSECTION of overloads, so compute-engine HAS
//      overloading — it simply has no way to add a clause to a head you did not declare.
//      Appending one by re-declaring the head is that missing way.
//
//   3. The handlers have to come with it. An `evaluate`-backed head (`Sign`, `Inverse`,
//      `Sort`) carries its behaviour in `evaluate`; a COLLECTION-backed head (`Reverse`,
//      `Complement`) carries it in `collection` handlers and has no `evaluate` at all.
//      Copying whichever it has onto the new definition is what preserves it.
//
// The two kinds of head take different routes, and the reason is worth knowing. An
// evaluate-backed head needs no second symbol at all. A collection-backed head does, because
// its handlers cannot sit on a definition whose clause returns a nominal carrier — and the
// obvious way out (declaring the clause `-> collection`) silently breaks written composition,
// which is the whole reason maps are typed. See the comment at that branch.
//
// Verified to preserve laziness and every original overload, with nothing leaking:
//
//   Reverse(Permutation([1,2,3]))   Permutation([3,2,1])   ours
//   Reverse([1,2,3])                Reverse([1,2,3])       still the built-in, still lazy
//   At(Reverse([1,2,3]), 1)         3                      handlers intact
//   Reverse("abc")                  'cba'                  string overload intact

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

/** The marker that makes a name private. A TRAILING underscore, because it is legal in a
 *  compute-engine symbol, never appears at the end of a real head, and is one character to
 *  strip when emitting. A LEADING underscore would collide with the pattern-wildcard
 *  convention (`_x`), so it is not available. */
export const PRIVATE_SUFFIX = "_";

/** Where a collection-backed original is kept. It shows up in a held result, so the
 *  spelling is chosen to be patchable rather than pretty — see `publicName`. */
export const privateNameFor = (head: string): string => `${head}${PRIVATE_SUFFIX}`;

/** The public spelling of a name that may be private. Emitting an AST for a reader — a
 *  serialiser, a reference page, an oracle probe — should run names through this, which is
 *  the whole point of marking privacy with one strippable character. */
export const publicName = (name: string): string =>
  name.endsWith(PRIVATE_SUFFIX) ? name.slice(0, -PRIVATE_SUFFIX.length) : name;

/** The original signature with our clause appended as one more overload.
 *
 *  Two shapes to handle. A signature that is ALREADY an intersection
 *  (`((T) -> T where T: string) & …`) takes the extra clause directly — wrapping the whole
 *  thing in parentheses breaks the `where` clauses inside it. A single signature
 *  (`(set<any>+) -> set`) has to be parenthesised first, or `& …` reads as part of its
 *  return type rather than as a second overload. */
function overloaded(signature: string, on: string, returns: string): string {
  const base = signature.includes("&") ? signature : `(${signature})`;
  return `${base} & ((${on}) -> ${returns})`;
}

export interface Extension {
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

  const handlers = operator.collection;
  const signature = overloaded(String(operator.signature), extension.on, extension.returns);

  // An EVALUATE-backed head (Sign, Inverse, Sort) is the easy case: capture the handler,
  // declare our clause with its honest return type, and hand back anything that is not ours.
  // Nothing leaks and the signature tells the truth.
  if (handlers === undefined) {
    ce.declare(extension.head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[], options): BoxedExpression | undefined => {
        const subject = ops[0];
        if (subject !== undefined && String(subject.type) === extension.on) return extension.handle(subject, ce);
        return operator.evaluate?.(ops, options);
      },
    });
    return true;
  }

  // A COLLECTION-backed head (Reverse, Complement) has no evaluate to delegate to, and its
  // handlers cannot be carried onto a definition whose clause returns a nominal carrier —
  // the engine refuses that pairing, since a minted type is not a collection.
  //
  // Declaring the clause as `-> collection` to satisfy that check does work, and costs more
  // than it looks: the head's DECLARED return type is then `collection`, so a written
  // composition like `Complement(Reverse(p))` fails to type-check even though it evaluates
  // fine. Composition is the whole reason maps are typed, so the honest return type wins and
  // the original definition is kept, whole, under a private name instead.
  //
  // The cost is cosmetic and narrow: a built-in result that stays UNEVALUATED prints under
  // the private name — `Complement_(Set(1,2))`. The trailing underscore is deliberate: it is
  // one character to strip when emitting an AST for a reader, which `publicName` does.
  const primitive = privateNameFor(extension.head);
  if (!ce.lookupDefinition(primitive)) ce.declare(primitive, operator);

  ce.declare(extension.head, {
    signature,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const subject = ops[0];
      if (subject !== undefined && String(subject.type) === extension.on) return extension.handle(subject, ce);
      return ce.function(primitive, ops).evaluate();
    },
  });
  return true;
}
