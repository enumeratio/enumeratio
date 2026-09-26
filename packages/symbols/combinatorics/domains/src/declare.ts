// Declare the carrier domains: a NOMINAL type per carrier, and a held constructor that makes
// a value carry it (design/domains.md §1.2).
//
// The constructor has no `evaluate` handler on purpose. A head with a signature and no
// handler does not collapse, so `AsPermutation([2,1,3])` stays itself through evaluation and
// keeps the type `Permutation`. That is what lets a statistic declared over `Permutation`
// reject a bare list — and, more usefully, reject a SetPartition.

import { type BoxedExpression, type ComputeEngine, isSymbol } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { DOMAINS } from "./domain-data.ts";
import type { Domain } from "./types.ts";

/**
 * Declare every carrier domain and its constructor on `ce`. Does NOT declare the plural
 * type-space names — `declareDomainPlurals` does that, and has to run AFTER whatever else in
 * the engine declares a collection family (`declareCollections`'s `Permutations`,
 * `DyckPaths`, …): a plural name a family will claim has to still be free when THAT runs, so
 * minting a bare symbol for it here, before collections gets a turn, would make collections'
 * own `ce.declare` throw "already declared" instead of the other way around. See
 * `declareDomainPlurals`'s own doc for why a live `ce.lookupDefinition` check at THAT later
 * point is what makes the two compose regardless of order.
 */
export function declareDomains(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  // Types first: a constructor's signature names its own domain, so the type has to exist.
  // Shapes referring to another carrier (a tableau pair is two tableaux) are declared in
  // dependency order by sorting those last.
  const named = new Set(domains.map((d) => d.type));
  const refersToCarrier = (d: Domain): boolean =>
    [...named].some((other) => other !== d.type && d.shape.includes(other));
  const ordered = [...domains.filter((d) => !refersToCarrier(d)), ...domains.filter(refersToCarrier)];

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
 *
 * Our clause goes FIRST and unwrapped, for two independent reasons: overload resolution
 * tries arms in declaration order and keeps the first structurally-plausible one rather than
 * backtracking to a better-typed later arm, so our precise `(shape) -> type` arm has to come
 * before a looser existing one or a call with our shape gets typechecked against the wrong
 * arm; and the existing signature may already be an overload set with a `where` clause on one
 * of its arms, which CE's type grammar allows on an arm of a TOP-LEVEL overload set but not
 * one buried inside a further wrapping group — splicing it in unwrapped keeps every existing
 * `where` legal.
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
  (operator as { signature: unknown }).signature = ce.type(`(${clause}) & ${String(existingSignature)}`);
  operator.evaluate = (ops: readonly BoxedExpression[], options) => existingEvaluate?.(ops, options);
}

/** The value inside a constructed carrier — what a statistic reaches for. */
export const contentsOf = (value: BoxedExpression | undefined): BoxedExpression | undefined => operandsOf(value)[0];

/**
 * Mint every domain's plural TYPE-SPACE name as a set-valued symbol, the way compute-engine's
 * own `Integers` is a symbol whose type is `set<integer>` rather than a callable (design/
 * domains.md §2) — but only when the name isn't ALREADY something at the point this runs: a
 * same-named collection family that enumerates this carrier (`Permutations`, `DyckPaths`,
 * …), or a compute-engine native with its own real meaning (`RationalNumbers` is both at
 * once — a bare `ce.lookupDefinition` audit found no plural that collides with a
 * compute-engine meaning and has NO family of ours already answering for it). Call this
 * AFTER `declareCollections` in a combined engine, so that check sees what collections
 * already claimed rather than losing the race to it — minting a bare symbol first would make
 * collections' OWN later `ce.declare` of the same name throw. Either way this never
 * overwrites what a name already means; `declareDomainElement` is what makes
 * `Element(x, <plural>)` answer regardless of whether this minted a fresh symbol or the name
 * was already spoken for.
 */
export function declareDomainPlurals(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  for (const domain of domains) {
    if (domain.plural === undefined || ce.lookupDefinition(domain.plural) !== undefined) continue;
    ce.declare(domain.plural, `set<${domain.type}>`);
  }
}

/**
 * Layer `Element(x, <plural>)` membership onto `ce`'s existing `Element` for every domain
 * with a plural type-space name: True when `x` is a value of the MATCHING carrier (its own
 * constructor as `x`'s operator), False when `x` is a value of a DIFFERENT one of ours (the
 * same reason the carrier types exist at all — a wrong carrier is caught, not silently
 * miscounted), and `undefined` — deferring to whatever `Element` already meant — for
 * everything else: a bare, unresolved `x` stays unevaluated, and a name with its own real
 * meaning (`RationalNumbers`, which is ALSO one of our carriers) still gets its real answer
 * when `x` is not one of ours.
 *
 * Attached IN PLACE onto whatever `Element` already is — compute-engine's own built-in, or
 * another library's replacement of it (`@enumeratio/algebra`'s `AlgebraProvider.contains`) —
 * the same reasoning as `declareConstructor`: mutating the existing operator's `evaluate`
 * never calls `ce.declare` a second time, so it never throws regardless of which library's
 * `declare*` ran first in a combined engine.
 */
export function declareDomainElement(ce: ComputeEngine, domains: readonly Domain[] = DOMAINS): void {
  const carrierOf = new Map(
    domains.filter((d): d is Domain & { plural: string } => d.plural !== undefined).map((d) => [d.plural, d.name]),
  );
  const constructors = new Set(domains.map((d) => d.name));

  const membership = (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
    const element = ops[0];
    const target = ops[1];
    if (element === undefined || target === undefined) return undefined;
    const carrier = isSymbol(target) ? carrierOf.get(target.symbol) : undefined;
    if (carrier === undefined) return undefined;
    const op = element.operator;
    if (op === carrier) return ce.symbol("True");
    if (constructors.has(op)) return ce.symbol("False");
    return undefined;
  };

  const definition = ce.lookupDefinition("Element");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;

  if (operator === undefined) {
    // Scoped, same reason @enumeratio/algebra's own probe is: boxing binds the free symbols
    // it names, and `x` read here should not stay bound for the session.
    ce.pushScope();
    const nativeEvaluate = ce.box(["Element", "x", "Integers"]).operatorDefinition?.evaluate;
    ce.popScope();
    ce.declare("Element", {
      signature: "(any, any, boolean?) -> boolean",
      evaluate: (ops: readonly BoxedExpression[], options) => membership(ops) ?? nativeEvaluate?.(ops, options),
    });
    return;
  }

  const existingEvaluate = operator.evaluate;
  operator.evaluate = (ops: readonly BoxedExpression[], options) => membership(ops) ?? existingEvaluate?.(ops, options);
}
