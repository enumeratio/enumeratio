import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { stringAt, symbolNameOf } from "@enumeratio/engine";

// Named operations on a carrier: the combinatorial statistics and maps
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Statistics-and-Maps). A carrier like `Permutation` has dozens of
// statistics, too many and too generically named for a global head each, so they are reached
// through one head per kind -- `CombinatorialStat(π, "Inversions")` -- that finds the
// carrier from its argument's type, as a protocol member does, and the operation by name or by
// FindStat id. Several packages add to one carrier's table: a fast kernel from one, the
// defining expression from another. Two of the same thing is an error, never a silent skip.

/** The heads that read an operations table. */
export type OperationHead = "CombinatorialStat" | "CombinatorialMap";

export interface Operation {
  readonly name: string;
  /** FindStat ids (`St000018`, `Mp00001`), each another key for the same operation. */
  readonly findstat?: readonly string[];
  /** What it returns, in compute-engine's type grammar: `integer` for a statistic. */
  readonly type?: string;
  /** The definition: an expression, so it is the specification. Applied to the carrier value. */
  readonly definition?: (subject: BoxedExpression) => BoxedExpression | undefined;
  /** A fast path, preferred when present; the definition then checks it. */
  readonly kernel?: (subject: BoxedExpression) => BoxedExpression | undefined;
  /** The Epsil the definition evaluates, over `subject` (the placeholder for the carrier
   *  value's contents), so a definition that calls this operation can be compiled through it.
   *  `wrap` names the constructor a map's answer is wrapped in. Absent when the definition
   *  isn't one closed expression (a map with a guard, or a composition). */
  readonly epsil?: OperationEpsil;
}

export interface OperationEpsil {
  readonly expression: unknown;
  readonly subject: string;
  readonly wrap?: string;
}

/** A minimal carrier registration: its constructor head (`Permutation`) and, when minted, its type (`permutation`). */
export interface CarrierRegistration {
  readonly name: string;
  readonly type?: string;
  /** How many leading slots of a packed multi-arg operand are params, not the element(s) --
   *  see `Carrier.carrierParams` (`./carriers.ts`) for the full story. Undefined (not just 0)
   *  when the owning `Carrier` record never declared one -- `allCarrierParams` only bakes in
   *  carriers that did. */
  readonly carrierParams?: number;
}

interface Entry {
  name: string;
  findstat: Set<string>;
  type?: string;
  definition?: Operation["definition"];
  kernel?: Operation["kernel"];
  epsil?: OperationEpsil;
}

interface Table {
  /** By carrier name, then by operation name. */
  readonly operations: Map<string, Map<string, Entry>>;
  /** By carrier name, then by FindStat id. Several of our names can be one FindStat statistic
   *  (they agree by value), so an id keeps the first. */
  readonly findstat: Map<string, Map<string, Entry>>;
}

interface Registry {
  readonly carriers: Map<string, CarrierRegistration>;
  /** A collection head (`Permutations`, `Derangements`) to the carrier its elements inhabit. */
  readonly collections: Map<string, string>;
  readonly tables: Record<OperationHead, Table>;
  /** From a carrier to the carriers it is equivalent to, each with the bijection there. */
  readonly equivalences: Map<string, { readonly to: string; readonly forward: Transport }[]>;
}

/** A bijection between carriers, applied to a value of the first. */
type Transport = (subject: BoxedExpression) => BoxedExpression | undefined;

// On the engine, so a package's dist and another's source share one registry.
const REGISTRY = Symbol.for("@enumeratio/structures:operations");

export class OperationCollisionError extends Error {
  constructor(head: OperationHead, carrier: string, name: string, part: string) {
    super(`${head}: ${carrier} already has a ${part} for ${name}`);
    this.name = "OperationCollisionError";
  }
}

function registryOf(ce: ComputeEngine): Registry {
  const held = ce as unknown as Record<symbol, Registry | undefined>;
  const existing = held[REGISTRY];
  if (existing !== undefined) return existing;
  const table = (): Table => ({ operations: new Map(), findstat: new Map() });
  const registry: Registry = {
    carriers: new Map(),
    collections: new Map(),
    tables: { CombinatorialStat: table(), CombinatorialMap: table() },
    equivalences: new Map(),
  };
  held[REGISTRY] = registry;
  declareHeads(ce, registry);
  return registry;
}

/** Name a carrier, and the type its values carry when there is one. Idempotent. */
export function registerCarrier(ce: ComputeEngine, carrier: CarrierRegistration): void {
  const registry = registryOf(ce);
  const known = registry.carriers.get(carrier.name);
  if (known?.type === undefined) registry.carriers.set(carrier.name, { ...known, ...carrier });
}

/** Say which carrier a collection's elements inhabit, for the curried form. Idempotent. */
export function registerCollectionCarrier(ce: ComputeEngine, collection: string, carrier: string): void {
  registryOf(ce).collections.set(collection, carrier);
}

/**
 * Say that `from` and `to` are the same structure written two ways, with `forward` the
 * bijection from one to the other (`RestrictedGrowthString(partition)`, from set partitions to their
 * strings). A statistic or map `from` lacks is then reached through `to`: defined once, on
 * whichever carrier states it most naturally. Register each direction on its own.
 */
export function registerEquivalence(ce: ComputeEngine, from: string, to: string, forward: Transport): void {
  const equivalences = registryOf(ce).equivalences;
  const known = equivalences.get(from) ?? [];
  if (!known.some((e) => e.to === to)) equivalences.set(from, [...known, { to, forward }]);
}

/**
 * How `head`'s operation `key` is computed on `carrier`: its own, else transported from the
 * nearest equivalent carrier that has it, through the chain of bijections there (a binary
 * tree's parent array reaches the Dyck path statistics through the tree), or undefined.
 */
function implementationOf(ce: ComputeEngine, head: OperationHead, carrier: string, key: string): Transport | undefined {
  const equivalences = registryOf(ce).equivalences;
  // Breadth first, so the chain is the shortest; each entry carries the composed bijection.
  const seen = new Set([carrier]);
  let frontier: { carrier: string; path?: Transport }[] = [{ carrier }];
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const { carrier: here, path } of frontier) {
      const found = operationOf(ce, head, here, key);
      const apply = found?.kernel ?? found?.definition;
      if (apply !== undefined)
        return path === undefined
          ? apply
          : (subject) => {
              const image = path(subject);
              return image === undefined ? undefined : apply(image);
            };
      for (const { to, forward } of equivalences.get(here) ?? []) {
        if (seen.has(to)) continue;
        seen.add(to);
        next.push({
          carrier: to,
          path:
            path === undefined
              ? forward
              : (subject) => {
                  const image = path(subject);
                  return image === undefined ? undefined : forward(image);
                },
        });
      }
    }
    frontier = next;
  }
  return undefined;
}

/** The carrier a collection HEAD's elements inhabit (`SymmetricGroup` -> `Permutation`), as
 *  registered by `registerCollectionCarrier`. Undefined when `collection` isn't one, or has no
 *  registered carrier -- its elements are bare lists. */
export function collectionCarrierOf(ce: ComputeEngine, collection: string): string | undefined {
  return registryOf(ce).collections.get(collection);
}

/** The carrier CONSTRUCTOR name whose minted type is `type` (`permutation` -> `Permutation`),
 *  as registered by `registerCarrier`/`declareCarriers`. Undefined when no registered carrier
 *  has that type. */
export function carrierNameForType(ce: ComputeEngine, type: string): string | undefined {
  for (const carrier of registryOf(ce).carriers.values()) {
    if (carrier.type === type) return carrier.name;
  }
  return undefined;
}

/** The type a registered carrier CONSTRUCTOR name mints (`Permutation` -> `permutation`), the
 *  reverse of `carrierNameForType` — what a family typed by that carrier reads. Undefined when
 *  `name` isn't a registered carrier, or was registered with no type yet. */
export function carrierTypeForName(ce: ComputeEngine, name: string): string | undefined {
  return registryOf(ce).carriers.get(name)?.type;
}

/** Every carrier constructor name registered on `ce` (`registerCarrier`/`declareCarriers`),
 *  across every owning package — the list oracle's engine-free `emit`/`structural` modules
 *  bake into a generated data file, since they cannot hold a live engine themselves. */
export function allCarrierNames(ce: ComputeEngine): readonly string[] {
  return [...registryOf(ce).carriers.keys()];
}

/** Every carrier that declared a `carrierParams` count (`registerCarrier`/`declareCarriers`,
 *  from the owning `Carrier` record's own field), by name — the oracle's generated data bakes
 *  this in alongside `allCarrierNames`, so `emit`/`structural` can unwrap a packed multi-arg
 *  operand by declared count instead of guessing from its shape. A carrier absent here packs
 *  no leading params (the default, 0). */
export function allCarrierParams(ce: ComputeEngine): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const carrier of registryOf(ce).carriers.values()) {
    if (carrier.carrierParams !== undefined) map.set(carrier.name, carrier.carrierParams);
  }
  return map;
}

/**
 * Add `operation` to `carrier`'s table for `head`. A kernel and a definition from different
 * packages meet in one entry; the same part twice is an `OperationCollisionError`.
 */
export function registerOperation(ce: ComputeEngine, head: OperationHead, carrier: string, operation: Operation): void {
  const table = registryOf(ce).tables[head];
  const byName = table.operations.get(carrier) ?? new Map<string, Entry>();
  table.operations.set(carrier, byName);
  const entry = byName.get(operation.name) ?? { name: operation.name, findstat: new Set<string>() };
  byName.set(operation.name, entry);

  for (const part of ["definition", "kernel"] as const) {
    if (operation[part] === undefined) continue;
    if (entry[part] !== undefined) throw new OperationCollisionError(head, carrier, operation.name, part);
    entry[part] = operation[part];
  }
  if (operation.type !== undefined) entry.type = operation.type;
  if (operation.epsil !== undefined) entry.epsil ??= operation.epsil;

  const byId = table.findstat.get(carrier) ?? new Map<string, Entry>();
  table.findstat.set(carrier, byId);
  for (const id of operation.findstat ?? []) {
    if (!byId.has(id)) byId.set(id, entry);
    entry.findstat.add(id);
  }
}

/** The operation `key` names on `carrier`: by name, else by FindStat id. */
export function operationOf(
  ce: ComputeEngine,
  head: OperationHead,
  carrier: string,
  key: string,
): Readonly<Entry> | undefined {
  const table = registryOf(ce).tables[head];
  return table.operations.get(carrier)?.get(key) ?? table.findstat.get(carrier)?.get(key);
}

/** The Epsil of the statistic or map `name` on `carrier`, for compiling a definition that calls
 *  it (`inlineCalls` in @enumeratio/engine/compiled). */
export function operationEpsil(ce: ComputeEngine, carrier: string, name: string): OperationEpsil | undefined {
  return (
    operationOf(ce, "CombinatorialStat", carrier, name)?.epsil ??
    operationOf(ce, "CombinatorialMap", carrier, name)?.epsil
  );
}

/** The carrier `subject` is a value of: its type matched as protocol dispatch matches it. */
const parsedTypes = new WeakMap<CarrierRegistration, ReturnType<ComputeEngine["type"]>>();

function carrierOf(ce: ComputeEngine, registry: Registry, subject: BoxedExpression): CarrierRegistration | undefined {
  // A carrier's own constructor names it outright: `Permutation([…])` is a permutation.
  const named = subject.operator === undefined ? undefined : registry.carriers.get(subject.operator);
  if (named?.type !== undefined) return named;
  for (const carrier of registry.carriers.values()) {
    if (carrier.type === undefined) continue;
    let type = parsedTypes.get(carrier);
    if (type === undefined) parsedTypes.set(carrier, (type = ce.type(carrier.type)));
    if (subject.type.matches(type)) return carrier;
  }
  return undefined;
}

/** Statistics of a whole collection, by name, with the head that computes each. They are heads of
 *  their own too; this is only a second way in. */
const COLLECTION_STATISTICS: Readonly<Record<string, string>> = { Count: "Count" };

function declareHeads(ce: ComputeEngine, registry: Registry): void {
  for (const head of ["CombinatorialStat", "CombinatorialMap"] as const) {
    ce.declare(head, {
      // The key is a name or FindStat id; a map's may instead be the target collection
      // (`CombinatorialMap(τ, DyckPaths)`), which picks the conversion to its carrier.
      signature: "(any, any) -> any",
      // Over a collection, the operation mapped over it; on a value, the answer.
      type: (ops, { engine }) =>
        engine.type(
          ops[0] !== undefined && engine.type(ops[0].type).matches("collection") ? "indexed_collection" : "unknown",
        ),
      // Held, so a collection reaches the handler as a collection rather than materialised.
      lazy: true,
      evaluate: ([held, heldKey], options) => {
        const subject = held?.evaluate();
        const key = heldKey?.evaluate();
        const target = head === "CombinatorialMap" && key !== undefined ? symbolNameOf(key) : undefined;
        const name = (target === undefined ? undefined : registry.collections.get(target)) ?? stringAt(key);
        if (subject === undefined || key === undefined || name === undefined) return undefined;

        // `CombinatorialStat(π, "Inversions")`: the value's carrier, then the operation.
        const carrier = carrierOf(ce, registry, subject);
        if (carrier !== undefined) return implementationOf(ce, head, carrier.name, name)?.(subject);

        // A statistic of the collection itself: `CombinatorialStat(Permutations(4), "Count")`.
        const whole = head === "CombinatorialStat" ? COLLECTION_STATISTICS[name] : undefined;
        if (whole !== undefined && subject.type.matches("collection"))
          return ce.function(whole, [subject]).evaluate(options);

        // `CombinatorialStat(Permutations(4), "Inversions")`: the operation over the whole
        // collection, lazily -- its distribution. Elements are bare contents, so each is
        // constructed as the carrier first.
        const collection = symbolNameOf(subject) ?? subject.operator;
        const element = collection === undefined ? undefined : registry.collections.get(collection);
        if (element === undefined || implementationOf(ce, head, element, name) === undefined) return undefined;
        // A collection typed by its carrier already yields carrier values; a bare one gets each
        // element constructed.
        const type = registry.carriers.get(element)?.type;
        const typed =
          (type !== undefined && subject.type.matches(ce.type(`collection<${type}>`))) ||
          ce.function("At", [subject, ce.One]).evaluate().operator === element;
        const x = ce.symbol("_element");
        const each = ce.function("Function", [ce.function(head, [typed ? x : ce.function(element, [x]), key]), x]);
        return ce.function("Map", [each, subject]).evaluate(options);
      },
    });
  }
}

/** Declare the operation heads on `ce`, once. */
export function ensureOperationHeads(ce: ComputeEngine): void {
  registryOf(ce);
}
