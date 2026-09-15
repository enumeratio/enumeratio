// Declare the carrier domains: a NOMINAL type per carrier, and a held constructor that makes
// a value carry it (design/domains.md §1.2).
//
// The constructor has no `evaluate` handler on purpose. A head with a signature and no
// handler does not collapse, so `AsPermutation([2,1,3])` stays itself through evaluation and
// keeps the type `Permutation`. That is what lets a statistic declared over `Permutation`
// reject a bare list — and, more usefully, reject a SetPartition.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { DOMAINS } from "./domain-data.ts";
import type { Domain } from "./types.ts";

/** Declare every carrier domain and its constructor on `ce`. */
export function declareDomains(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  // Types first: a constructor's signature names its own domain, so the type has to exist.
  // Shapes referring to another carrier (a tableau pair is two tableaux) are declared in
  // dependency order by sorting those last.
  const named = new Set(domains.map((d) => d.type));
  const refersToCarrier = (d: Domain): boolean =>
    [...named].some((other) => other !== d.type && d.shape.includes(other));
  const ordered = [
    ...domains.filter((d) => !refersToCarrier(d)),
    ...domains.filter(refersToCarrier),
  ];

  for (const domain of ordered) ce.declareType(domain.type, domain.shape, { mint: true });
  for (const domain of ordered) declareConstructor(ce, domain);
}

/**
 * One carrier's constructor. Held, with no `evaluate` — unless compute-engine already has
 * the name, in which case the two become overloads of it.
 *
 * `ContinuedFraction` is the case that forced this, and is currently the only one:
 * compute-engine computes the expansion, `(real, integer?) -> list<integer>`, and we want
 * the same name for the value that expansion produces. Declaring straight over it replaced
 * the definition and `ContinuedFraction(355, 113)` started erroring — a break nowhere near
 * this file, and invisible until the whole library set was booted in one engine.
 *
 * The two clauses are disjoint by argument type (the native rejects a list, ours takes only
 * a list), so the intersection signature is honest and the dispatch below is total.
 */
function declareConstructor(ce: ComputeEngine, domain: Domain): void {
  const clause = `(${domain.shape}) -> ${domain.type}`;
  const native = ce.lookupDefinition(domain.name)
    ? ce.box([domain.name, ce.number(1)] as never).operatorDefinition
    : undefined;

  if (native === undefined) {
    ce.declare(domain.name, { signature: clause });
    return;
  }

  ce.declare(domain.name, {
    signature: `(${String(native.signature)}) & (${clause})`,
    evaluate: (ops: readonly BoxedExpression[], options) => {
      const subject = ops[0];
      // Ours: hold it, exactly as a constructor with no handler would.
      if (ops.length === 1 && subject?.type.matches(domain.shape) === true) return undefined;
      return native.evaluate?.(ops, options);
    },
  });
}

/** The value inside a constructed carrier — what a statistic reaches for. */
export const contentsOf = (value: BoxedExpression | undefined): BoxedExpression | undefined =>
  operandsOf(value)[0];
