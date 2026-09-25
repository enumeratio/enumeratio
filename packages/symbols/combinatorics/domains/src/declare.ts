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
 * One carrier's constructor. Held, with no `evaluate` — unless the name is already
 * declared (a compute-engine native, or another library's head), in which case the two
 * become overloads of it. Attached IN PLACE, same reasoning as `wrapOperator`
 * (`@enumeratio/boxed`): `ce.declare` throws the SECOND time any name is declared, native
 * or not, so a plain re-declare only ever worked here by luck of engine composition order.
 *
 * `ContinuedFraction` is the case that forced overloading at all: compute-engine computes
 * the expansion, `(real, integer?) -> list<integer>`, and we want the same name for the
 * value that expansion produces. `PermutationCycles` is the same shape of problem from the
 * other direction — `@enumeratio/groupalgebra` declares it as Wolfram's real cycle-notation
 * conversion, and depending on which library's `declare*` runs first in a combined engine
 * (as `@enumeratio/census` builds one), this carrier constructor has to layer onto THAT
 * instead of onto a native definition.
 *
 * The existing definition is tried FIRST, the domain's own "hold, untouched" behaviour only
 * as what happens when it declines (returns `undefined`) on a value matching the carrier's
 * shape — never the other way around, so a library that actually computes something for
 * that shape is not shadowed by a same-named type tag nobody asked for.
 */
function declareConstructor(ce: ComputeEngine, domain: Domain): void {
  const clause = `(${domain.shape}) -> ${domain.type}`;
  const definition = ce.lookupDefinition(domain.name);
  const operator =
    definition !== undefined && "operator" in definition ? definition.operator : undefined;

  if (operator === undefined) {
    ce.declare(domain.name, { signature: clause });
    return;
  }

  const existingEvaluate = operator.evaluate;
  const existingSignature = operator.signature;
  (operator as { signature: unknown }).signature = ce.type(
    `(${String(existingSignature)}) & (${clause})`,
  );
  operator.evaluate = (ops: readonly BoxedExpression[], options) =>
    existingEvaluate?.(ops, options);
}

/** The value inside a constructed carrier — what a statistic reaches for. */
export const contentsOf = (value: BoxedExpression | undefined): BoxedExpression | undefined =>
  operandsOf(value)[0];
