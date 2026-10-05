import { type Engine, type Expr, integerAt, operandsOf } from "@enumeratio/engine";
import { conform } from "@enumeratio/structures";

// Carriers' orders (https://github.com/enumeratio/enumeratio/wiki/Structures): what makes `Min`, `Max` and `Clamp` work on them.
//
// Integer partitions of the same n under dominance: λ ⊵ μ when every partial sum of λ is at
// least μ's. A lattice but not a total order -- [3, 1, 1, 1] and [2, 2, 2] are incomparable --
// so `Min` is the meet: the partial sums' pointwise minimum, differenced back into parts
// (Brylawski). Partitions of different n are not in the same lattice and have no meet.

const partsOf = (p: Expr): number[] | undefined => {
  const parts = operandsOf(operandsOf(p)[0]).map(integerAt);
  return parts.every((x): x is number => x !== undefined) ? parts : undefined;
};

const partialSums = (parts: readonly number[], length: number): number[] => {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < length; i++) out.push((sum += parts[i] ?? 0));
  return out;
};

const fromPartialSums = (sums: readonly number[]): number[] =>
  sums.map((s, i) => s - (sums[i - 1] ?? 0)).filter((x) => x > 0);

const conjugate = (parts: readonly number[]): number[] =>
  Array.from({ length: parts[0] ?? 0 }, (_, j) => parts.filter((x) => x > j).length);

/** Both partitions' partial sums, padded to one length; undefined unless both partition one n. */
function sums(a: Expr, b: Expr): [number[], number[]] | undefined {
  const [x, y] = [partsOf(a), partsOf(b)];
  if (x === undefined || y === undefined) return undefined;
  const length = Math.max(x.length, y.length);
  const [s, t] = [partialSums(x, length), partialSums(y, length)];
  return s[length - 1] === t[length - 1] ? [s, t] : undefined;
}

const meet = (x: readonly number[], y: readonly number[]): number[] | undefined => {
  const length = Math.max(x.length, y.length);
  const [s, t] = [partialSums(x, length), partialSums(y, length)];
  return s[length - 1] === t[length - 1] ? fromPartialSums(s.map((v, i) => Math.min(v, t[i]!))) : undefined;
};

export function declareCarrierOrders(ce: Engine): void {
  const partition = (parts: readonly number[] | undefined) =>
    parts === undefined
      ? undefined
      : ce.function("IntegerPartition", [
          ce.function(
            "List",
            parts.map((p) => ce.number(p)),
          ),
        ]);

  conform(ce, "integer_partition", {
    PartialOrder: {
      Compare: (a, b) => {
        const both = sums(a, b);
        if (both === undefined) return ce.NaN;
        const [s, t] = both;
        const above = s.some((v, i) => v > t[i]!);
        const below = s.some((v, i) => v < t[i]!);
        return ce.number(above && below ? Number.NaN : above ? 1 : below ? -1 : 0);
      },
    },
    Lattice: {
      GreatestLowerBound: (a, b) => {
        const [x, y] = [partsOf(a), partsOf(b)];
        return x === undefined || y === undefined ? undefined : partition(meet(x, y));
      },
      // The join is the meet's mirror under conjugation, which reverses dominance.
      LeastUpperBound: (a, b) => {
        const [x, y] = [partsOf(a), partsOf(b)];
        if (x === undefined || y === undefined) return undefined;
        const m = meet(conjugate(x), conjugate(y));
        return m === undefined ? undefined : partition(conjugate(m));
      },
    },
  });
}
