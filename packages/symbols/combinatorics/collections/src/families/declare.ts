import type { BoxedExpression, CollectionHandlers, ComputeEngine } from "@cortex-js/compute-engine";
import { allEntries } from "./index.ts";
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
  nestMJ,
} from "./types.ts";

type BoxInput = Parameters<ComputeEngine["box"]>[0];

const asBoxed = (c: BoxedExpression): Boxed => c as unknown as Boxed;

// Collection type an operator call returns. paramCount-0 values are typed directly in declareFamilies.
const collectionTypeOf = (kind: FamilyKernel["kind"]): string => {
  switch (kind) {
    case "nested":
      return "collection";
    case "blocks":
      return "list<list<list<integer>>>";
    case "scalar":
      return "list<integer>";
    default:
      return "list<list<integer>>";
  }
};

const signatureOf = ({ kind, paramCount }: FamilyKernel): string => {
  const params = Array.from({ length: paramCount }, () => "integer").join(", ");
  return `(${params}) -> ${collectionTypeOf(kind)}`;
};

// element codecs (element -> boxed MathJSON encoder, boxed -> element decoder).
const encoderFor = (kind: FamilyKernel["kind"]) =>
  kind === "ints" ? listMJ : kind === "blocks" ? blocksMJ : kind === "scalar" ? (n: unknown) => n : nestMJ;
const decoderFor = (kind: FamilyKernel["kind"]) =>
  kind === "ints" ? asIntList : kind === "blocks" ? asBlockList : kind === "scalar" ? intOf : denest;

/** A family's kernel as compute-engine collection handlers: Count, At and iteration by
 *  unranking, membership by `valid`. CE speaks plain numbers; a count past 2^53 answers
 *  `undefined` (unknown to CE) rather than a rounded one. */
function handlersOf(ce: ComputeEngine, family: FamilyKernel): CollectionHandlers {
  const encode = encoderFor(family.kind);
  const decode = decoderFor(family.kind);
  const params = (c: BoxedExpression): number[] => {
    const ops = asBoxed(c).ops ?? [];
    return Array.from({ length: family.paramCount }, (_, i) => intOf(ops[i]));
  };
  const element = (p: number[], rank: bigint): BoxedExpression =>
    ce.box(encode(family.unrank(p, rank) as never) as BoxInput);
  return {
    count: (c) => countNumber(family.count(params(c))),
    // ∞ is known-infinite; NaN (an open problem, e.g. TwinPrimes) is unknown either way.
    isFinite: (c) => {
      const total = family.count(params(c));
      return typeof total === "bigint" ? true : Number.isNaN(total) ? undefined : false;
    },
    isLazy: () => true,
    isEnumerable: () => true,
    isEmpty: (c) => family.count(params(c)) === 0n,
    iterator: (c) => {
      const p = params(c);
      const total = family.count(p);
      let i = 0n;
      // Only a finite count ends the iteration; ∞ and unknown (NaN) run on.
      return {
        next: () =>
          typeof total !== "bigint" || i < total
            ? { value: element(p, i++), done: false }
            : { value: undefined, done: true },
      };
    },
    // `index` is an ordinality (1-based, negative from the end); the rank is index − 1.
    at: (c, index) => {
      if (typeof index !== "number" || !Number.isSafeInteger(index)) return undefined;
      const p = params(c);
      const total = family.count(p);
      if (typeof total !== "bigint") {
        // No last element to count back from when the count is ∞ or unknown.
        return index < 1 ? undefined : element(p, BigInt(index - 1));
      }
      const i = index < 0 ? total + BigInt(index) + 1n : BigInt(index);
      return i < 1n || i > total ? undefined : element(p, i - 1n);
    },
    contains: (c, target) => family.valid(decode(asBoxed(target)), params(c)),
  };
}

/** Declare every family on `ce`: an indexed-collection operator, or for paramCount 0 an
 *  indexed-collection value (`Primes`), which shadows CE's own `set` of that name on this engine. */
export function declareFamilies(ce: ComputeEngine): void {
  for (const family of allEntries) {
    const collection = handlersOf(ce, family);
    if (family.paramCount === 0) {
      ce.declare(family.head, { type: "indexed_collection<integer>", collection });
    } else {
      ce.declare(family.head, { signature: signatureOf(family), collection });
    }
  }
}
