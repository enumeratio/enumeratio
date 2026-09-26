// Declare a statistic from its DEFINITION — the expression is the implementation.
//
// There is no TypeScript kernel behind these heads, so there is no second implementation to
// drift from. Where a fast path does exist (the permutation statistics already in
// @enumeratio/collections), the two are held together by a differential test instead.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { bySignature, type Definition, SUBJECT } from "./types.ts";

type BoxInput = Parameters<ComputeEngine["box"]>[0];

/**
 * Evaluate `definition` at `subject` — substitute the wildcard and evaluate. Exported
 * because it is also how the tests and the reduction analysis reach a definition.
 */
export function applyDefinition(ce: ComputeEngine, definition: Definition, subject: BoxedExpression): BoxedExpression {
  // In a scope of its own: boxing declares the free `_x`, and a definition that fixes its
  // type (Depth's `Abs(At(_x, i) - i)` makes it a number) would otherwise pin that type on
  // the global `_x` for every later definition, whose `Length(_x)` then never reduces.
  ce.pushScope();
  try {
    return ce
      .box(definition.expr as BoxInput)
      .subs({ [SUBJECT]: subject })
      .evaluate();
  } finally {
    ce.popScope();
  }
}

/**
 * Declare every definition as a head on `ce`. Definitions for one head on several carriers
 * share the head — which is the point — so the first definition wins the declaration and the
 * rest are reachable through `applyDefinition`. Real overload dispatch needs the
 * domain-keyed signature that design/upstreaming.md asks for; until then this is honest
 * about only answering one carrier per head.
 */
export interface DeclareOptions {
  /**
   * Declare each statistic over its carrier's DOMAIN TYPE, and unwrap the constructed value
   * before evaluating. Pass `@enumeratio/domains`' type names, keyed by carrier.
   *
   * This is the intended mode: a combinatorial statistic is a function OF a carrier, so
   * `Cycles(Permutations([2,1,3]))` is the question and `Cycles([2,1,3])` is a type error —
   * which is the whole reason the domains exist. A definition marked `alsoOnList` additionally
   * accepts a bare list, because that reading stands on its own (see `Definition.alsoOnList`).
   *
   * Omit it and every head takes a bare list instead, which is what the definition tests use.
   */
  readonly domainTypes?: Readonly<Record<string, string>>;
  /**
   * Leave a head alone when something else already declared it.
   *
   * `@enumeratio/collections` ships its own fast permutation statistics under the same names
   * as several defined here, and compute-engine throws on a second declaration — the very
   * "two extensions cannot contribute to one head" problem design/upstreaming.md §3.2 raises
   * upstream, arriving in our own code. Until there is a real answer, a caller wiring both
   * packages has to say which one wins, and this is how it says so.
   */
  readonly skipDeclared?: boolean;
}

/**
 * The bare-list shape of a carrier, for the untyped declaration. A set partition is a list
 * of BLOCKS; declaring it as a list of integers made every set-partition statistic an
 * unreachable type error.
 */
const BARE_SHAPE: Readonly<Record<string, string>> = {
  SetPartitions: "list<list<integer>>",
};

/** The argument type a statistic accepts, given how the caller wired the carriers. */
function subjectType(definition: Definition, options: DeclareOptions): string {
  const bare = BARE_SHAPE[definition.on] ?? "list<integer>";
  const carrier = options.domainTypes?.[definition.on];
  if (carrier === undefined) return bare;
  // A union, so one head answers both readings and the handler tells them apart by the
  // operator. compute-engine accepts `(permutation | list<integer>) -> number` and dispatches
  // to the same evaluator for either arm.
  return definition.alsoOnList === true ? `${carrier} | ${bare}` : carrier;
}

export function declareStatistics(
  ce: ComputeEngine,
  definitions: readonly Definition[],
  options: DeclareOptions = {},
): Map<string, Definition> {
  const index = bySignature(definitions);
  const claimed = new Set<string>();

  for (const definition of definitions) {
    if (claimed.has(definition.head)) continue;
    if (options.skipDeclared === true && ce.lookupDefinition(definition.head)) continue;
    claimed.add(definition.head);

    ce.declare(definition.head, {
      signature: `(${subjectType(definition, options)}) -> number`,
      evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
        const subject = ops[0];
        if (subject === undefined) return undefined;
        // Unwrap only an actual carrier. `definition.on` IS the constructor head's spelling,
        // so this is what tells a `Permutations([3,1,2])` from the bare `[3,1,2]` that the
        // `alsoOnList` arm of the union lets through.
        const inner = subject.operator === definition.on ? (operandsOf(subject)[0] ?? subject) : subject;
        return applyDefinition(ce, definition, inner);
      },
    });
  }
  return index;
}
