// Declare the carrier domains: a NOMINAL type per carrier, and a held constructor that makes
// a value carry it (design/domains.md §1.2).
//
// The constructor has no `evaluate` handler on purpose. A head with a signature and no
// handler does not collapse, so `Permutations([2,1,3])` stays itself through evaluation and
// keeps the type `Permutations`. That is what lets a statistic declared over `Permutations`
// reject a bare list — and, more usefully, reject a SetPartitions value.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { DOMAINS } from "./domain-data.ts";
import type { Domain } from "./types.ts";

/** A carrier's shape may refer to another carrier's TYPE (a tableau pair is two tableaux), so
 *  the types have to be minted in dependency order: those first. Shared by both halves below
 *  so a caller that needs to split them still gets the same ordering either would use alone. */
const orderedFor = (domains: readonly Domain[]): readonly Domain[] => {
  const named = new Set(domains.map((d) => d.type));
  const refersToCarrier = (d: Domain): boolean =>
    [...named].some((other) => other !== d.type && d.shape.includes(other));
  return [...domains.filter((d) => !refersToCarrier(d)), ...domains.filter(refersToCarrier)];
};

/**
 * Mint every carrier domain's NOMINAL type on `ce`, without declaring its constructor.
 * Split out of `declareDomains` for a combined engine that has to mint the types before some
 * OTHER library's declare runs (a signature naming the type by name), but must declare that
 * other library's NAMES before the constructors below run, so a name the two share overloads
 * onto it rather than colliding — `declareDomainConstructors` does that second half.
 */
export function declareDomainTypes(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  for (const domain of orderedFor(domains)) ce.declareType(domain.type, domain.shape, { mint: true });
}

/** Declare every carrier domain's constructor on `ce`. Its type has to already exist — either
 *  from `declareDomains` or from a prior `declareDomainTypes` call. */
export function declareDomainConstructors(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  for (const domain of orderedFor(domains)) declareConstructor(ce, domain);
}

/** Declare every carrier domain and its constructor on `ce`. */
export function declareDomains(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  // Types first: a constructor's signature names its own domain, so the type has to exist.
  declareDomainTypes(ce, domains);
  declareDomainConstructors(ce, domains);
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
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;

  if (operator === undefined) {
    ce.declare(domain.name, { signature: clause });
    return;
  }

  const existingEvaluate = operator.evaluate;
  const existingSignature = operator.signature;
  // Our clause goes FIRST and the existing signature is spliced in unwrapped, for two
  // independent reasons:
  //  - overload resolution here tries arms in declaration order and keeps the first
  //    structurally-plausible one rather than backtracking to a better-typed later arm, so
  //    our precise `(shape) -> type` arm has to come before a looser existing one (e.g.
  //    `(integer) -> ...`) or a call with our shape gets typechecked against the wrong arm.
  //  - the existing signature may already be an overload set with a `where` clause on one of
  //    its arms (e.g. collections' own `Permutations`), and CE's type grammar allows `where`
  //    on an arm of a TOP-LEVEL overload set but not one buried inside a further wrapping
  //    group -- splicing it in unwrapped keeps every existing `where` legal.
  (operator as { signature: unknown }).signature = ce.type(`(${clause}) & ${String(existingSignature)}`);
  operator.evaluate = (ops: readonly BoxedExpression[], options) => existingEvaluate?.(ops, options);
}

/** The value inside a constructed carrier — what a statistic reaches for. */
export const contentsOf = (value: BoxedExpression | undefined): BoxedExpression | undefined => operandsOf(value)[0];
