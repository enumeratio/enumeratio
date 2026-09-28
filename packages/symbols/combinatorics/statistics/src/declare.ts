// Declare a statistic from its DEFINITION — the expression is the implementation.
//
// There is no TypeScript kernel behind these heads, so there is no second implementation to
// drift from. Where a fast path does exist (the permutation statistics already in
// @enumeratio/collections), the two are held together by a differential test instead.

import { type BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { symbolInfo } from "@enumeratio/manifest";
import { operationOf, registerCarrier, registerOperation } from "@enumeratio/structures";
import { findstat } from "./findstat-data.ts";
import { bySignature, type Definition, signatureOf, SUBJECT } from "./types.ts";

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
 * The ways a caller can wire the statistics. Each definition always goes into its carrier's
 * `CombinatorialStat` table; it is also a head of its own unless that name is taken.
 */
export interface DeclareOptions {
  /**
   * Declare each statistic over its carrier's DOMAIN TYPE, and unwrap the constructed value
   * before evaluating. Pass `@enumeratio/domains`' type names, keyed by carrier.
   *
   * This is the intended mode: a combinatorial statistic is a function OF a carrier, so
   * `Cycles(Permutation([2,1,3]))` is the question and `Cycles([2,1,3])` is a type error —
   * which is the whole reason the domains exist. A definition marked `alsoOnList` additionally
   * accepts a bare list, because that reading stands on its own (see `Definition.alsoOnList`).
   * It is also what lets `CombinatorialStat` find a value's carrier from its type.
   *
   * Omit it and every head takes a bare list instead, which is what the definition tests use.
   */
  readonly domainTypes?: Readonly<Record<string, string>>;
}

/** A statistic's name taken by something that is not the same statistic. */
export class StatisticCollisionError extends Error {
  readonly signatures: readonly string[];
  constructor(signatures: readonly string[]) {
    super(`statistics: already declared by something else: ${signatures.join(", ")}`);
    this.name = "StatisticCollisionError";
    this.signatures = signatures;
  }
}

/**
 * The bare-list shape of a carrier, for the untyped declaration. A set partition is a list
 * of BLOCKS; declaring it as a list of integers made every set-partition statistic an
 * unreachable type error.
 */
const BARE_SHAPE: Readonly<Record<string, string>> = {
  SetPartition: "list<list<integer>>",
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

/** FindStat's ids for each of our statistics, by signature: matched by value, as findstat-data
 *  records, and as the head's record states. */
const BY_VALUE: ReadonlyMap<string, readonly string[]> = new Map(
  findstat.map((match) => [`${match.head}@${match.on}`, match.findstat]),
);
const findstatIds = (definition: Definition): string[] => [
  ...new Set([
    ...(BY_VALUE.get(signatureOf(definition)) ?? []),
    ...(symbolInfo(definition.head)?.findstat ?? [])
      .filter((ref) => ref.on === undefined || ref.on === definition.on)
      .map((ref) => ref.id),
  ]),
];

/**
 * Give compute-engine's own head a statistic's carrier as one more argument: `Sign` of a
 * permutation is its ±1, the same map onto the signs that a number's `Sign` is (Dean,
 * 2026-09-28), so it generalises the head rather than overloading it. Every arm the head had
 * is kept; only a value of the carrier reaches the definition.
 */
function extendEngineHead(ce: ComputeEngine, definition: Definition, type: string | undefined): void {
  const found = ce.lookupDefinition(definition.head);
  const operator = found !== undefined && "operator" in found ? found.operator : undefined;
  if (operator === undefined || type === undefined) return;
  (operator as { signature: unknown }).signature = ce.type(`((${type}) -> number) & ${String(operator.signature)}`);
  const native = operator.evaluate;
  operator.evaluate = (ops, options) => {
    const subject = ops[0];
    if (subject?.operator === definition.on) return applyDefinition(ce, definition, operandsOf(subject)[0] ?? subject);
    return native?.(ops, options);
  };
}

let bare: ComputeEngine | undefined;
/** Whether compute-engine itself defines `head`, with a meaning of its own (`Sign`). */
const isEngineHead = (head: string): boolean => (bare ??= new ComputeEngine()).lookupDefinition(head) !== undefined;

/**
 * File every definition in its carrier's `CombinatorialStat` table, and declare it as a
 * head of its own where the name is free. A taken name is fine in two cases, both explicit: the
 * table already holds another package's kernel for this very statistic (@enumeratio/collections'
 * permutation statistics), or compute-engine owns the name (`Sign`), when its head is
 * generalised to take the carrier too. Anything else is a
 * `StatisticCollisionError`, listing every one.
 *
 * Definitions for one head on several carriers share the head, the first declaring it; every
 * one of them is in its carrier's table.
 */
export function declareStatistics(
  ce: ComputeEngine,
  definitions: readonly Definition[],
  options: DeclareOptions = {},
): Map<string, Definition> {
  const index = bySignature(definitions);
  const claimed = new Set<string>();
  const collisions: string[] = [];

  for (const definition of definitions) {
    const type = options.domainTypes?.[definition.on];
    registerCarrier(ce, { name: definition.on, ...(type === undefined ? {} : { type }) });
    registerOperation(ce, "CombinatorialStat", definition.on, {
      name: definition.head,
      findstat: findstatIds(definition),
      definition: (subject) =>
        applyDefinition(
          ce,
          definition,
          subject.operator === definition.on ? (operandsOf(subject)[0] ?? subject) : subject,
        ),
    });

    if (claimed.has(definition.head)) continue;
    claimed.add(definition.head);
    if (ce.lookupDefinition(definition.head) !== undefined) {
      const kernel = operationOf(ce, "CombinatorialStat", definition.on, definition.head)?.kernel;
      if (kernel !== undefined) continue;
      if (isEngineHead(definition.head)) extendEngineHead(ce, definition, type);
      else collisions.push(signatureOf(definition));
      continue;
    }

    ce.declare(definition.head, {
      signature: `(${subjectType(definition, options)}) -> number`,
      evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
        const subject = ops[0];
        if (subject === undefined) return undefined;
        // Unwrap only an actual carrier. `definition.on` IS the constructor head's spelling,
        // so this is what tells a `Permutation([3,1,2])` from the bare `[3,1,2]` that the
        // `alsoOnList` arm of the union lets through.
        const inner = subject.operator === definition.on ? (operandsOf(subject)[0] ?? subject) : subject;
        return applyDefinition(ce, definition, inner);
      },
    });
  }
  if (collisions.length > 0) throw new StatisticCollisionError(collisions);
  return index;
}
