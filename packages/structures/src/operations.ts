import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { stringAt, symbolNameOf } from "@enumeratio/engine";

// Named operations on a carrier: the combinatorial statistics and maps
// (design/speculative/statistics-and-maps.md). A carrier like `Permutation` has dozens of
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
}

/** A carrier: its constructor head (`Permutation`) and, when minted, its type (`permutation`). */
export interface Carrier {
  readonly name: string;
  readonly type?: string;
}

interface Entry {
  name: string;
  findstat: Set<string>;
  type?: string;
  definition?: Operation["definition"];
  kernel?: Operation["kernel"];
}

interface Table {
  /** By carrier name, then by operation name. */
  readonly operations: Map<string, Map<string, Entry>>;
  /** By carrier name, then by FindStat id. Several of our names can be one FindStat statistic
   *  (they agree by value), so an id keeps the first. */
  readonly findstat: Map<string, Map<string, Entry>>;
}

interface Registry {
  readonly carriers: Map<string, Carrier>;
  /** A collection head (`Permutations`, `Derangements`) to the carrier its elements inhabit. */
  readonly collections: Map<string, string>;
  readonly tables: Record<OperationHead, Table>;
}

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
  };
  held[REGISTRY] = registry;
  declareHeads(ce, registry);
  return registry;
}

/** Name a carrier, and the type its values carry when there is one. Idempotent. */
export function registerCarrier(ce: ComputeEngine, carrier: Carrier): void {
  const registry = registryOf(ce);
  const known = registry.carriers.get(carrier.name);
  if (known?.type === undefined) registry.carriers.set(carrier.name, { ...known, ...carrier });
}

/** Say which carrier a collection's elements inhabit, for the curried form. Idempotent. */
export function registerCollectionCarrier(ce: ComputeEngine, collection: string, carrier: string): void {
  registryOf(ce).collections.set(collection, carrier);
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

/** The carrier `subject` is a value of: its type matched as protocol dispatch matches it. */
function carrierOf(ce: ComputeEngine, registry: Registry, subject: BoxedExpression): Carrier | undefined {
  for (const carrier of registry.carriers.values())
    if (carrier.type !== undefined && subject.type.matches(ce.type(carrier.type))) return carrier;
  return undefined;
}

/** Statistics of a whole collection, by name, with the head that computes each. They are heads of
 *  their own too; this is only a second way in. */
const COLLECTION_STATISTICS: Readonly<Record<string, string>> = { Count: "Count" };

function declareHeads(ce: ComputeEngine, registry: Registry): void {
  for (const head of ["CombinatorialStat", "CombinatorialMap"] as const) {
    ce.declare(head, {
      signature: "(any, string) -> any",
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
        const name = stringAt(key);
        if (subject === undefined || key === undefined || name === undefined) return undefined;

        // `CombinatorialStat(π, "Inversions")`: the value's carrier, then the operation.
        const carrier = carrierOf(ce, registry, subject);
        if (carrier !== undefined) {
          const entry = operationOf(ce, head, carrier.name, name);
          return entry === undefined ? undefined : (entry.kernel ?? entry.definition)?.(subject);
        }

        // A statistic of the collection itself: `CombinatorialStat(Permutations(4), "Count")`.
        const whole = head === "CombinatorialStat" ? COLLECTION_STATISTICS[name] : undefined;
        if (whole !== undefined && subject.type.matches("collection"))
          return ce.function(whole, [subject]).evaluate(options);

        // `CombinatorialStat(Permutations(4), "Inversions")`: the operation over the whole
        // collection, lazily -- its distribution. Elements are bare contents, so each is
        // constructed as the carrier first.
        const collection = symbolNameOf(subject) ?? subject.operator;
        const element = collection === undefined ? undefined : registry.collections.get(collection);
        if (element === undefined || operationOf(ce, head, element, name) === undefined) return undefined;
        const x = ce.symbol("_element");
        const each = ce.function("Function", [ce.function(head, [ce.function(element, [x]), key]), x]);
        return ce.function("Map", [each, subject]).evaluate(options);
      },
    });
  }
}

/** Declare the operation heads on `ce`, once. */
export function ensureOperationHeads(ce: ComputeEngine): void {
  registryOf(ce);
}
