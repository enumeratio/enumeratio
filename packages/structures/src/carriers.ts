// Carrier declaration: a NOMINAL type per carrier, and a held constructor that makes a value
// carry it (https://github.com/enumeratio/enumeratio/wiki/Domains §1.2; https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 1). Generic across every owning package — combinatorics' areas, the arithmetic
// packages (number-theory, residues, numerals, hypercomplex) — each calls `declareCarriers`
// with its own carrier data instead of one shared module minting everything.
//
// The constructor has no `evaluate` handler on purpose. A head with a signature and no
// handler does not collapse, so `AsPermutation([2,1,3])` stays itself through evaluation and
// keeps the type `Permutation`. That is what lets a statistic declared over `Permutation`
// reject a bare list — and, more usefully, reject a SetPartition.

import { type BoxedExpression, type ComputeEngine, isSymbol } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { carrierNameForType, registerCarrier, registerCollectionCarrier } from "./operations.ts";

/** The structural shape a carrier's values have, as a compute-engine type expression. */
export type Shape = string;

export interface Carrier {
  /** The carrier's name, singular — and the CONSTRUCTOR head's spelling. */
  readonly name: string;
  /** The nominal type's name — lowercase singular, which a signature reads. */
  readonly type: string;
  /** The underlying structure, for the type body. */
  readonly shape: Shape;
  /** enumeratio's snake_case carrier id — which is also the type's spelling. */
  readonly id: string;
  /**
   * The carrier's TYPE-SPACE name, plural — every carrier has one (https://github.com/enumeratio/enumeratio/wiki/Domains §2's
   * corrected rule), whether or not a same-named collection family already exists.
   * `declareCarrierElement` is what makes `Element(x, DyckPaths)` answer for it: True when
   * `x` is a `DyckPath(...)` value, False for a value of another carrier, unevaluated for
   * anything it cannot place. Absent only for `ContinuedFraction`, whose SINGULAR name layers
   * onto compute-engine's own expansion — there is no plural type space for it.
   */
  readonly plural?: string;
  /** The carrier this one RESTRICTS, when it is a restriction. compute-engine cannot express
   *  the subtype relation between minted types (§1.1), so this is recorded as data and
   *  checked by predicate rather than believed by the engine. */
  readonly restricts?: string;
  /** The membership predicate, as a head taking a value of the parent carrier. */
  readonly predicate?: string;
  /** How many of a packed multi-arg operand's LEADING slots are params, not the element(s) --
   *  the same count a family with this carrier declares as its own `carrierParams`
   *  (`@enumeratio/combinatorics/collections`'s `families/declare.ts`, e.g. `Tournament(n,
   *  edges)`: `carrierParams: 1` for `n`). Default 0: no leading params, the operand's slots
   *  (one or more) are all element(s). The oracle's `emit`/`structural` (packages/oracle) read
   *  this to unwrap a packed `Tuple` operand to the system-comparable part, rather than
   *  guessing from whether every slot happens to be a carrier call. */
  readonly carrierParams?: number;
}

/**
 * Three names for three things, and no suffix on any of them — because compute-engine's own
 * convention already has room for all three:
 *
 *   affine_permutation   the TYPE        snake_case, exactly like `integer`, `indexed_collection`
 *   AffinePermutation    the CONSTRUCTOR what appears in expressions
 *   AffinePermutations   the COLLECTION  the indexed family
 *
 * The type name therefore needs no transformation at all: it is enumeratio's carrier id
 * verbatim, which was snake_case already.
 */
export const typeFor = (id: string): string => id;

/**
 * Declare every carrier and its constructor on `ce`, and — by default — its plural type-space
 * name and `Element` membership too (`declareCarrierPlurals` / `declareCarrierElement`): once
 * an option KEY is never a carrier's plural (`Over -> GaussianIntegers`, not `GaussianIntegers
 * -> True`; see the Wolfram-`GaussianIntegers`-option retirement), a bare option VALUE reading
 * as a typed `set<...>` symbol instead of an untyped tag is no longer a problem, so the plural
 * can be minted right alongside the type and constructor.
 *
 * Pass `{ plurals: false }` to keep minting the plural separately (`declareCarrierPlurals` /
 * `declareCarrierElement`, called by hand later) — needed only when a carrier's plural name
 * might still be claimed by a REAL collection family this same host declares afterward
 * (`Permutations`, `DyckPaths`, …): that family's own `ce.declare` throws "already declared" if
 * this already minted a bare `set<...>` symbol for the name first. `@enumeratio/combinatorics`'s
 * domains are the one caller that still needs this — see its own `declareDomains`.
 */
export function declareCarriers(
  ce: ComputeEngine,
  carriers: readonly Carrier[],
  options?: { readonly plurals?: boolean },
): void {
  // Types first: a constructor's signature names its own type, so the type has to exist.
  // Shapes referring to another carrier (a tableau pair is two tableaux) are declared in
  // dependency order by sorting those last.
  const named = new Set(carriers.map((c) => c.type));
  const refersToCarrier = (c: Carrier): boolean =>
    [...named].some((other) => other !== c.type && c.shape.includes(other));
  const ordered = [...carriers.filter((c) => !refersToCarrier(c)), ...carriers.filter(refersToCarrier)];

  for (const carrier of ordered) ce.declareType(carrier.type, carrier.shape, { mint: true });
  for (const carrier of ordered) declareConstructor(ce, carrier);
  for (const carrier of ordered)
    registerCarrier(ce, {
      name: carrier.name,
      type: carrier.type,
      ...(carrier.carrierParams === undefined ? {} : { carrierParams: carrier.carrierParams }),
    });

  if (options?.plurals !== false) {
    declareCarrierPlurals(ce, ordered);
    declareCarrierElement(ce, ordered);
  }
}

/**
 * One carrier's constructor. Held, with no `evaluate` — unless the name is already declared
 * (a compute-engine native, or another library's head), in which case the two become
 * overloads of it. Attached IN PLACE, same reasoning as `wrapOperator` (`@enumeratio/engine`):
 * `ce.declare` throws the SECOND time any name is declared, native or not, so a plain
 * re-declare only ever worked here by luck of engine composition order.
 *
 * The existing definition is tried FIRST, the carrier's own "hold, untouched" behaviour only
 * as what happens when it declines (returns `undefined`) on a value matching the carrier's
 * shape — never the other way around, so a library that actually computes something for that
 * shape is not shadowed by a same-named type tag nobody asked for.
 *
 * Our clause goes FIRST and unwrapped: overload resolution tries arms in declaration order and
 * keeps the first structurally-plausible one rather than backtracking to a better-typed later
 * arm, and the existing signature may already be an overload set with a `where` clause on one
 * of its arms, which splicing in unwrapped keeps legal.
 */
function declareConstructor(ce: ComputeEngine, carrier: Carrier): void {
  const clause = `(${carrier.shape}) -> ${carrier.type}`;
  const definition = ce.lookupDefinition(carrier.name);
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;

  if (operator === undefined) {
    ce.declare(carrier.name, { signature: clause });
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
 * Mint every carrier's plural TYPE-SPACE name as a set-valued symbol, the way compute-engine's
 * own `Integers` is a symbol whose type is `set<integer>` rather than a callable (https://github.com/enumeratio/enumeratio/wiki/Domains §2) — but only when the name isn't ALREADY something at the point this runs: a
 * same-named collection family that enumerates this carrier (`Permutations`, `DyckPaths`, …),
 * a compute-engine native with its own real meaning, or another owning PACKAGE's carrier that
 * minted the same plural first. That last case is settled by this same `ce.lookupDefinition`
 * check, not by which package's declare call runs first: whichever gets here first mints it,
 * and every later call — from combinatorics, from an arithmetic package, in any order — sees
 * it already taken and leaves it alone. Call this AFTER `declareCollections` in a combined
 * engine, so that check sees what collections already claimed rather than losing the race to
 * it. Either way this never overwrites what a name already means; `declareCarrierElement` is
 * what makes `Element(x, <plural>)` answer regardless of whether this minted a fresh symbol or
 * the name was already spoken for.
 */
export function declareCarrierPlurals(ce: ComputeEngine, carriers: readonly Carrier[]): void {
  for (const carrier of carriers) {
    if (carrier.plural === undefined) continue;
    // `CombinatorialStat(IntegerPartitions, name)` reaches the carrier through its plural.
    registerCollectionCarrier(ce, carrier.plural, carrier.name);
    if (ce.lookupDefinition(carrier.plural) !== undefined) continue;
    ce.declare(carrier.plural, `set<${carrier.type}>`);
  }
}

/**
 * Layer `Element(x, <plural>)` membership onto `ce`'s existing `Element` for every carrier with
 * a plural type-space name: True when `x` is a value of the MATCHING carrier (its own
 * constructor as `x`'s operator), False when `x` is a value of a DIFFERENT one of ours (a
 * wrong carrier is caught, not silently miscounted), and `undefined` — deferring to whatever
 * `Element` already meant — for everything else.
 *
 * Attached IN PLACE onto whatever `Element` already is, the same reasoning as
 * `declareConstructor`: mutating the existing operator's `evaluate` never calls `ce.declare` a
 * second time, so it never throws regardless of which package's declare call ran first.
 */
export function declareCarrierElement(ce: ComputeEngine, carriers: readonly Carrier[]): void {
  const carrierOf = new Map(
    carriers.filter((c): c is Carrier & { plural: string } => c.plural !== undefined).map((c) => [c.plural, c.name]),
  );
  const constructors = new Set(carriers.map((c) => c.name));

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

/**
 * A conversion as an overload of the target carrier's constructor: given a value of
 * `sourceConstructor` it converts (via `handle`), and anything else goes on to what the
 * constructor already did (hold). Generic over what `handle` does — a combinatorial map's own
 * conversion logic stays with its owning package; only the "splice this in as another overload
 * of the target constructor" mechanism is shared.
 *
 * `sourceConstructor` and `sourceType` are two different spellings of the same carrier — the
 * held CONSTRUCTOR (`Permutation`), checked against the runtime value's operator, and the
 * minted TYPE (`permutation`), which is what a signature clause names. A conversion that needs
 * more than the source value (`CycleDecomposition(cycles, n)`) names the types of those
 * `extra` arguments, and `handle` receives them after the subject.
 */
export function attachConversion(
  ce: ComputeEngine,
  target: string,
  sourceConstructor: string,
  sourceType: string,
  to: string,
  handle: (subject: BoxedExpression, ...extra: BoxedExpression[]) => BoxedExpression | undefined,
  extra: readonly string[] = [],
): void {
  const definition = ce.lookupDefinition(target);
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined) throw new Error(`${target}: no constructor to convert with`);
  const existingEvaluate = operator.evaluate;
  // A lone arm is wrapped before it joins an overload set; `(a) -> b & c` would read as
  // returning `b & c`.
  const existing = String(operator.signature);
  const arms = existing.includes(" & ") ? existing : `(${existing})`;
  (operator as { signature: unknown }).signature = ce.type(
    `${arms} & ((${[sourceType, ...extra].join(", ")}) -> ${to})`,
  );
  operator.evaluate = (ops: readonly BoxedExpression[], options) =>
    ops.length === 1 + extra.length && ops[0]?.operator === sourceConstructor
      ? handle(ops[0], ...ops.slice(1))
      : existingEvaluate?.(ops, options);
}

export { carrierNameForType };
