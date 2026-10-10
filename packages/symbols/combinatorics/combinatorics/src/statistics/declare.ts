// Declare a statistic from its DEFINITION — the expression is the implementation.
//
// There is no hand-written TypeScript behind these heads, so there is no second implementation
// to drift from; what runs fast is compiled from the definition itself (compiled.ts). Where a fast path does exist (the permutation statistics already in
// @enumeratio/combinatorics/collections), the two are held together by a differential test instead.

import { definitionHash, isCacheableDefinition, type MathJSON, pureResult } from "@enumeratio/engine/compiled";
import { compiledStatistic } from "./compiled.ts";
import { bareEngine } from "@enumeratio/engine/testing";
import { declareCompile, type Engine, type Expr, isNativeHead, operandsOf } from "@enumeratio/engine";
import { symbolInfo } from "@enumeratio/manifest";
import {
  allCarrierNames,
  carrierTypeForName,
  operationOf,
  registerCarrier,
  registerOperation,
} from "@enumeratio/structures";
import { findstat } from "../../findstat/src/findstat-data.ts";
import { bySignature, type Definition, signatureOf, SUBJECT } from "./types.ts";

type BoxInput = Parameters<Engine["box"]>[0];

/**
 * Evaluate `definition` at `subject` — substitute the wildcard and evaluate. Exported
 * because it is also how the tests and the reduction analysis reach a definition.
 */
const compiledCache = new WeakMap<Definition, ReturnType<typeof compiledStatistic> | null>();
const purity = new WeakMap<Definition, boolean>();

export function applyDefinition(ce: Engine, definition: Definition, subject: Expr): Expr {
  const compute = (): MathJSON | undefined => {
    // Compiled ahead of time where it could be; the interpreter is the definition itself.
    let compiled = compiledCache.get(definition);
    if (compiled === undefined) compiledCache.set(definition, (compiled = compiledStatistic(ce, definition) ?? null));
    return compiled?.(subject.json) ?? (interpretDefinition(ce, definition, subject).json as MathJSON);
  };
  // A pure definition's answer depends only on the definition and the subject, so it is shared
  // by every engine.
  let pure = purity.get(definition);
  if (pure === undefined)
    purity.set(definition, (pure = isCacheableDefinition(ce, definition.expr, { [SUBJECT]: "any" })));
  const answer = pure ? pureResult(definitionHash(definition.expr), subject.json, compute) : compute();
  return ce.box((answer ?? "Nothing") as never);
}

/** The definition evaluated by the interpreter alone: what the compiled code is held to. */
export function interpretDefinition(ce: Engine, definition: Definition, subject: Expr): Expr {
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
   * before evaluating.
   *
   * This is the intended mode: a combinatorial statistic is a function OF a carrier, so
   * `Cycles(Permutation([2,1,3]))` is the question and `Cycles([2,1,3])` is a type error —
   * which is the whole reason the domains exist. A definition marked `alsoOnList` additionally
   * accepts a bare list, because that reading stands on its own (see `Definition.alsoOnList`).
   * It is also what lets `CombinatorialStat` find a value's carrier from its type.
   *
   * Read back from `@enumeratio/structures`' carrier registry by default (`carrierTypeForName`,
   * as families do since #458) — the caller's own area already declared its carriers on `ce`
   * before calling this, so the type is there to read rather than pass in. Pass an explicit map
   * only to override that, keyed by carrier (`definition.on`); a carrier missing from BOTH the
   * registry and this map takes a bare list instead, which is what the definition tests use.
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

/** The argument type a statistic accepts, given how the caller wired the carriers — an
 *  explicit override first, then whatever the caller's own `declareCarriers` already
 *  registered on `ce` for this carrier, then the bare list as a last resort. */
function subjectType(ce: Engine, definition: Definition, options: DeclareOptions): string {
  const bare = BARE_SHAPE[definition.on] ?? "list<integer>";
  const carrier = options.domainTypes?.[definition.on] ?? carrierTypeForName(ce, definition.on);
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
 * Give a head a statistic's carrier as one more argument, so the bare head dispatches on its
 * argument's carrier the way `CombinatorialStat` does. Every arm the head had is kept; only a
 * value of the carrier reaches the definition. Used for a head another carrier already
 * declared (`Peaks` on permutations, then on Dyck paths) and for compute-engine's own: `Sign`
 * of a permutation is its ±1, the same map onto the signs that a number's `Sign` is (Dean,
 * 2026-09-28), so it generalises the head rather than overloading it.
 */
function extendHead(ce: Engine, definition: Definition, type: string | undefined): void {
  const found = ce.lookupDefinition(definition.head);
  const operator = found !== undefined && "operator" in found ? found.operator : undefined;
  if (operator === undefined || type === undefined) return;
  // A one-argument head takes the carrier as one more type of its argument: an overload set
  // would turn away what the native arm took (`Sign(NaN)` stops matching either arm).
  const native = String(operator.signature);
  const single = /^\(([^,&]+)\) -> ([^&]+)$/.exec(native);
  const results = single === null ? [] : [...new Set([...single[2]!.split(" | "), "number"])];
  (operator as { signature: unknown }).signature = ce.type(
    single === null ? `((${type}) -> number) & ${native}` : `(${type} | ${single[1]}) -> ${results.join(" | ")}`,
  );
  const nativeEvaluate = operator.evaluate;
  operator.evaluate = (ops, options) => {
    const subject = ops[0];
    if (subject?.operator === definition.on) return applyDefinition(ce, definition, operandsOf(subject)[0] ?? subject);
    return nativeEvaluate?.(ops, options);
  };
  // compile builtin: answers only for the carrier it is declared on
  declareCompile(ce, definition.head, "builtin");
}

let bare: Engine | undefined;
/** Whether compute-engine itself defines `head`, with a meaning of its own (`Sign`). */
const isEngineHead = (head: string): boolean => isNativeHead((bare ??= bareEngine()), head);

/**
 * File every definition in its carrier's `CombinatorialStat` table, and declare it as a
 * head of its own where the name is free. A taken name is fine in three cases, all explicit:
 * the table already holds another package's kernel for this very statistic
 * (@enumeratio/combinatorics/collections' permutation statistics); compute-engine owns the
 * name (`Sign`), when its head is generalised to take the carrier too; or another carrier's
 * OWN call to this function already declared it (`MajorIndex` on `Permutation` and on
 * `DyckPath`: one head, one owner, the first call wins — see each area's own `declare<Area>`,
 * which calls this separately per area since step 6b, so the shadow can span calls, not just
 * one `definitions` array). Anything else is a `StatisticCollisionError`, listing every one.
 *
 * Definitions for one head on several carriers share the head, the first declaring it; each
 * later carrier widens it (`extendHead`), so the bare head dispatches on its argument's
 * carrier. Every one of them is in its carrier's table.
 */
export function declareStatistics(
  ce: Engine,
  definitions: readonly Definition[],
  options: DeclareOptions = {},
): Map<string, Definition> {
  const index = bySignature(definitions);
  const collisions: string[] = [];

  for (const definition of definitions) {
    const type = options.domainTypes?.[definition.on] ?? carrierTypeForName(ce, definition.on);
    registerCarrier(ce, { name: definition.on, ...(type === undefined ? {} : { type }) });
    registerOperation(ce, "CombinatorialStat", definition.on, {
      name: definition.head,
      findstat: findstatIds(definition),
      epsil: { expression: definition.expr, subject: SUBJECT },
      definition: (subject) =>
        applyDefinition(
          ce,
          definition,
          subject.operator === definition.on ? (operandsOf(subject)[0] ?? subject) : subject,
        ),
    });

    if (isNativeHead(ce, definition.head)) {
      const kernel = operationOf(ce, "CombinatorialStat", definition.on, definition.head)?.kernel;
      if (kernel !== undefined) continue;
      // Another carrier already has an entry under this exact head — a call for THAT carrier
      // already ran (this area's own, earlier in `definitions`, or another area's declare
      // entirely) and won the name; this carrier widens that head rather than colliding.
      const shadowedByAnotherCarrier = allCarrierNames(ce).some(
        (carrier) =>
          carrier !== definition.on && operationOf(ce, "CombinatorialStat", carrier, definition.head) !== undefined,
      );
      if (shadowedByAnotherCarrier || isEngineHead(definition.head)) extendHead(ce, definition, type);
      else collisions.push(signatureOf(definition));
      continue;
    }

    ce.declare(definition.head, {
      signature: `(${subjectType(ce, definition, options)}) -> number`,
      evaluate: (ops: readonly Expr[]): Expr | undefined => {
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
