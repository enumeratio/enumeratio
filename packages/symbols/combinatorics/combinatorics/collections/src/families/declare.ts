import { defineMessages, emit, type Engine, type Expr, type HeadPatch, wrapOperator } from "@enumeratio/engine";
import { carrierTypeForName, registerCollectionCarrier } from "@enumeratio/structures";
import {
  asBlockList,
  asIntList,
  blocksMJ,
  type Boxed,
  countNumber,
  denest,
  type FamilyKernel,
  intOf,
  listMJ,
  needsBigint,
  nestMJ,
} from "./types.ts";
import { type AnyFamily, kernelOn } from "./epsil.ts";

type CollectionHandlers = NonNullable<HeadPatch["collection"]>;

type BoxInput = Parameters<Engine["box"]>[0];

const asBoxed = (c: Expr): Boxed => c as unknown as Boxed;

/** Elements a kernel may generate to answer one call on the engine, and the most a collection of
 *  a walking family is iterated over. Past it, a family whose unrank or rank enumerates declines
 *  with `Head::toobig` (a walking one, past that many steps, with `Head::toolong`) rather than
 *  exhausting the heap. */
export const ENUMERATION_LIMIT = 2_000_000n;

// Collection type an operator call returns: an indexed_collection of the family's own
// element shape (see `kind` in ./types.ts), matching how paramCount-0 values are typed
// directly in declareFamilies -- every family is a LAZY collection (`collection` handlers,
// `isLazy: true`), never a materialized List, whatever its element shape.
const collectionTypeOf = (kind: FamilyKernel["kind"]): string => {
  switch (kind) {
    case "nested":
      return "indexed_collection<any>";
    case "blocks":
      return "indexed_collection<list<list<integer>>>";
    case "scalar":
      return "indexed_collection<integer>";
    default:
      return "indexed_collection<list<integer>>";
  }
};

const signatureOf = ({ kind, paramCount }: FamilyKernel, elementType?: string): string => {
  const params = Array.from({ length: paramCount }, () => "integer<0..>").join(", ");
  return `(${params}) -> ${elementType === undefined ? collectionTypeOf(kind) : `indexed_collection<${elementType}>`}`;
};

/** A family's carrier, when it names one: opting in is explicit, since a carrier's shape has to
 *  be the family's (`declared.carrier` is only Plausible's catalogue label). */
const carrierOf = (family: FamilyKernel): string | undefined => family.carrier;

// element codecs (element -> boxed MathJSON encoder, boxed -> element decoder).
const encoderFor = (kind: FamilyKernel["kind"]) =>
  kind === "ints" ? listMJ : kind === "blocks" ? blocksMJ : kind === "scalar" ? (n: unknown) => n : nestMJ;
const decoderFor = (kind: FamilyKernel["kind"]) =>
  kind === "ints" ? asIntList : kind === "blocks" ? asBlockList : kind === "scalar" ? intOf : denest;

/** A family's kernel as compute-engine collection handlers: Count, At and iteration by
 *  unranking, membership by `valid`. CE speaks plain numbers; a count past 2^53 answers
 *  `undefined` (unknown to CE) rather than a rounded one. */
function handlersOf(ce: Engine, family: FamilyKernel, carrier?: string): CollectionHandlers {
  const bareEncode = encoderFor(family.kind);
  const bareDecode = decoderFor(family.kind);
  // How many of the family's own params (from the front) ride along inside the carrier's
  // Tuple, alongside the element -- e.g. Tournament(n, edges). 0 for every carrier whose shape
  // is just the element's own shape (`Permutation([2, 1])`).
  const carrierParams = family.carrierParams ?? 0;
  const carrierElements = family.carrierElements;
  // A nested sub-element's own carrier holds it the same way the element's own kind already
  // encodes it (bareEncode/bareDecode) -- e.g. `StandardTableauPair`'s two slots are each a
  // `StandardTableau`, holding its rows, not a flattened word (a word alone doesn't determine
  // a shape: two different tableaux can share one).
  const encode = (p: number[], value: unknown): unknown => {
    if (carrier !== undefined && carrierElements !== undefined) {
      const parts = (value as readonly unknown[]).map((v, i) => [
        carrierElements[i],
        (bareEncode as (x: never) => unknown)(v as never),
      ]);
      return [carrier, ["Tuple", ...parts]];
    }
    const encoded = (bareEncode as (x: never) => unknown)(value as never);
    if (carrier === undefined) return encoded;
    if (carrierParams === 0) return [carrier, encoded];
    return [carrier, ["Tuple", ...p.slice(0, carrierParams), encoded]];
  };
  const decode = (b: Boxed): unknown => {
    if (carrier === undefined || (b as unknown as Expr).operator !== carrier) return bareDecode(b as never);
    const inner = b.ops?.[0];
    if (carrierElements !== undefined) {
      const tupleOps = inner?.ops ?? [];
      return tupleOps.map((sub) => bareDecode((sub.ops?.[0] ?? sub) as never));
    }
    if (carrierParams === 0) return bareDecode(inner as never);
    const tupleOps = inner?.ops;
    return bareDecode(tupleOps?.[tupleOps.length - 1] as never);
  };
  const params = (c: Expr): number[] => {
    const ops = asBoxed(c).ops ?? [];
    return Array.from({ length: family.paramCount }, (_, i) => intOf(ops[i]));
  };
  // Undefined where the kernel declines past 2^53 (`needsBigint`): unknown, not an error.
  // A NaN element is a table's end (`GiugaNumbers`): no such element, never a NaN one.
  const element = (p: number[], rank: bigint): Expr | undefined => {
    try {
      const value = family.unrank(p, rank);
      if (typeof value === "number" && Number.isNaN(value)) return undefined;
      return ce.box(encode(p, value) as BoxInput);
    } catch (error) {
      if (needsBigint(error)) return undefined;
      throw error;
    }
  };
  // The count, or undefined where a kernel still in plain numbers can't carry it exactly.
  const countAt = (p: number[]): bigint | number | undefined => {
    try {
      return family.count(p);
    } catch (error) {
      if (needsBigint(error)) return undefined;
      throw error;
    }
  };
  // Whether reaching an element (or, for `count`, the count) would take past the limit: by the
  // work bound, which for a family whose unrank and rank walk (`declared.walks`) counts their steps.
  // Iterating all of a walking family's elements is bounded by the fiber instead, its exact count.
  const cost = family.declared?.cost;
  const walks = family.declared?.walks === true;
  const tooBig = (p: number[], ops: readonly ("count" | "unrank")[], iterating = false): boolean => {
    const work = family.declared?.work;
    if (cost === undefined || work === undefined || !ops.some((op) => cost[op] === "enumerative")) return false;
    const fiber = iterating && walks;
    const total = fiber ? countAt(p) : work(p);
    if (typeof total !== "bigint" || total <= ENUMERATION_LIMIT) return false;
    emit(ce, family.head, walks && !fiber ? "toolong" : "toobig", [
      `${family.head}(${p.join(", ")})`,
      total.toLocaleString("en-US"),
      ENUMERATION_LIMIT.toLocaleString("en-US"),
    ]);
    return true;
  };
  return {
    count: (c) => {
      const p = params(c);
      if (tooBig(p, ["count"])) return undefined;
      const total = countAt(p);
      return total === undefined ? undefined : countNumber(total);
    },
    // ∞ is known-infinite; NaN (an open problem, e.g. TwinPrimes) is unknown either way.
    isFinite: (c) => {
      const total = countAt(params(c));
      // Past 2^53 in a plain-number kernel: still finite, just not a count a double can carry.
      if (total === undefined) return true;
      return typeof total === "bigint" ? true : Number.isNaN(total) ? undefined : false;
    },
    isLazy: () => true,
    isEnumerable: (c) => !tooBig(params(c), ["count", "unrank"], true),
    isEmpty: (c) => {
      const p = params(c);
      return tooBig(p, ["count"]) ? undefined : countAt(p) === 0n ? true : countAt(p) === undefined ? undefined : false;
    },
    iterator: (c) => {
      const p = params(c);
      if (tooBig(p, ["count", "unrank"], true)) return undefined;
      const total = countAt(p);
      if (total === undefined) return undefined;
      // A kernel declines every element of a fiber past 2^53 alike: that is unknown, not an empty fiber.
      if (typeof total === "bigint" && total > 0n && element(p, 0n) === undefined) return undefined;
      let i = 0n;
      // Only a finite count ends the iteration; ∞ and unknown (NaN) run on.
      return {
        next: () => {
          const value = typeof total !== "bigint" || i < total ? element(p, i++) : undefined;
          return value === undefined ? { value: undefined, done: true } : { value, done: false };
        },
      };
    },
    // `index` is an ordinality (1-based, negative from the end); the rank is index − 1.
    // One past 2^53 arrives as its decimal digits, which a number cannot carry.
    at: (c, index) => {
      const ordinal =
        typeof index === "number" && Number.isSafeInteger(index)
          ? BigInt(index)
          : typeof index === "string" && /^-?\d+$/.test(index)
            ? BigInt(index)
            : undefined;
      if (ordinal === undefined) return undefined;
      const p = params(c);
      if (tooBig(p, ["count", "unrank"])) return undefined;
      const total = countAt(p);
      if (total === undefined) return undefined;
      if (typeof total !== "bigint") {
        // No last element to count back from when the count is ∞ or unknown.
        return ordinal < 1n ? undefined : element(p, ordinal - 1n);
      }
      const i = ordinal < 0n ? total + ordinal + 1n : ordinal;
      return i < 1n || i > total ? undefined : element(p, i - 1n);
    },
    contains: (c, target) => {
      try {
        return family.valid(decode(asBoxed(target)), params(c));
      } catch (error) {
        if (needsBigint(error)) return undefined;
        throw error;
      }
    },
  };
}

/** Declare every family in `families` on `ce` (an Epsil family through its kernel on `ce`): an indexed-collection operator, or for paramCount 0
 *  an indexed-collection value (`PrimeNumbers`). A family's carrier, when it names one, has to already be declared on `ce` (its OWN
 *  area's declare runs its `declareCarriers` first) -- its minted type is read back through
 *  `@enumeratio/structures`' registry (`carrierTypeForName`), not passed in. Also registers
 *  which carrier each family's elements inhabit (`registerCollectionCarrier`), for
 *  `CombinatorialStat(family, name)` -- self-contained per call, so a single area's declare
 *  needs nothing extra for its own families to answer it. */
export function declareFamilies(ce: Engine, families: readonly AnyFamily[]): void {
  const byHead = new Map<string, FamilyKernel>();
  for (const family of families.map((f) => kernelOn(ce, f))) {
    byHead.set(family.head, family);
    const carrier = carrierOf(family);
    if (carrier !== undefined) registerCollectionCarrier(ce, family.head, carrier);
    const elementType = carrier === undefined ? undefined : carrierTypeForName(ce, carrier);
    const collection = handlersOf(ce, family, elementType === undefined ? undefined : carrier);
    if (family.declared?.work !== undefined) {
      defineMessages(ce, family.head, {
        toobig: "`1` would enumerate about `2` elements; the limit is `3`.",
        ...(family.declared.walks === true ? { toolong: "`1` would take about `2` steps; the limit is `3`." } : {}),
      });
    }
    if (family.paramCount === 0) {
      ce.declare(family.head, { type: "indexed_collection<integer>", collection });
    } else {
      ce.declare(family.head, { signature: signatureOf(family, elementType), collection });
    }
  }

  // The `count` handler can't carry an exact count past 2^53, but `Count` can: an exact
  // integer, never a rounded one. Counts that cost enumeration stay with the handler.
  // Guarded on SymmetricGroup being among THESE entries, so this only ever wraps once --
  // permutations' own declare is the only caller whose entries include it.
  if (!byHead.has("SymmetricGroup")) return;
  const exactCount = (op: Expr): bigint | undefined => {
    const family = byHead.get(op.operator);
    if (family === undefined || family.declared?.cost.count === "enumerative") return undefined;
    const p = Array.from({ length: family.paramCount }, (_, i) => intOf(asBoxed(op).ops?.[i]));
    if (p.some((x) => !Number.isSafeInteger(x) || x < 0)) return undefined;
    try {
      const total = family.count(p);
      return typeof total === "bigint" && total > BigInt(Number.MAX_SAFE_INTEGER) ? total : undefined;
    } catch (error) {
      if (needsBigint(error)) return undefined;
      throw error;
    }
  };
  wrapOperator(
    ce,
    ["Count", ["SymmetricGroup", 1]],
    (ops) => ops.length === 1 && exactCount(ops[0]) !== undefined,
    () => (ops) => ce.number(exactCount(ops[0])!),
  );
}
