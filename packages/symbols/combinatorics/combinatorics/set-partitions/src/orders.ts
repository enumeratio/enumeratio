import { type Engine, type Expr, integerAt, operandsOf } from "@enumeratio/engine";
import { conform } from "@enumeratio/structures";

// Set partitions of one ground set under refinement (https://github.com/enumeratio/enumeratio/wiki/Structures):
// π ≤ σ when every block of π lies inside a block of σ, so the finest partition (all singletons)
// is the bottom. A lattice, not a total order -- {{1,2},{3}} and {{1},{2,3}} are incomparable --
// so `Min` is the meet (the common refinement: the non-empty pairwise block intersections) and
// `Max` the join (the finest common coarsening: blocks glued whenever they share an element).
// Partitions of different ground sets are not in the same lattice and have no meet.

type Blocks = readonly (readonly number[])[];

const blocksOf = (p: Expr): Blocks | undefined => {
  const blocks = operandsOf(operandsOf(p)[0]).map((b) => operandsOf(b).map(integerAt));
  // Only a partition: integer elements, non-empty blocks, no element twice.
  const all = blocks.flat();
  return blocks.every((b) => b.length > 0 && b.every((x) => x !== undefined)) && new Set(all).size === all.length
    ? (blocks as Blocks)
    : undefined;
};

const labelsOf = (blocks: Blocks): Map<number, number> =>
  new Map(blocks.flatMap((b, i) => b.map((e) => [e, i] as const)));

/** Each element's block index in both; undefined unless both partition one ground set. */
function labels(x: Blocks, y: Blocks): [Map<number, number>, Map<number, number>] | undefined {
  const [s, t] = [labelsOf(x), labelsOf(y)];
  return s.size === t.size && [...s.keys()].every((e) => t.has(e)) ? [s, t] : undefined;
}

/** True when every block of `fine` lies inside one block of `coarse`. */
const refines = (fine: Blocks, coarse: Map<number, number>): boolean =>
  fine.every((b) => b.every((e) => coarse.get(e) === coarse.get(b[0]!)));

const canonical = (blocks: Blocks): number[][] =>
  blocks
    .map((b) => b.toSorted((p, q) => p - q))
    .filter((b) => b.length > 0)
    .toSorted((p, q) => p[0]! - q[0]!);

const meet = (x: Blocks, y: Blocks): number[][] | undefined => {
  const both = labels(x, y);
  if (both === undefined) return undefined;
  const cells = new Map<string, number[]>();
  for (const [e, i] of both[0]) {
    const key = `${i},${both[1].get(e)}`;
    cells.set(key, [...(cells.get(key) ?? []), e]);
  }
  return canonical([...cells.values()]);
};

const join = (x: Blocks, y: Blocks): number[][] | undefined => {
  if (labels(x, y) === undefined) return undefined;
  // Union-find over the elements, gluing each block of both partitions.
  const parent = new Map<number, number>();
  const root = (e: number): number => {
    const p = parent.get(e) ?? e;
    if (p === e) return e;
    const r = root(p);
    parent.set(e, r);
    return r;
  };
  for (const b of [...x, ...y]) for (const e of b) parent.set(root(e), root(b[0]!));
  const groups = new Map<number, number[]>();
  for (const e of x.flat()) groups.set(root(e), [...(groups.get(root(e)) ?? []), e]);
  return canonical([...groups.values()]);
};

export function declareSetPartitionOrders(ce: Engine): void {
  const setPartition = (blocks: Blocks | undefined) =>
    blocks === undefined
      ? undefined
      : ce.function("SetPartition", [
          ce.function(
            "List",
            blocks.map((b) =>
              ce.function(
                "List",
                b.map((e) => ce.number(e)),
              ),
            ),
          ),
        ]);

  conform(ce, "set_partition", {
    PartialOrder: {
      Compare: (a, b) => {
        const [x, y] = [blocksOf(a), blocksOf(b)];
        if (x === undefined || y === undefined) return undefined;
        const both = labels(x, y);
        if (both === undefined) return ce.NaN;
        const [below, above] = [refines(x, both[1]), refines(y, both[0])];
        return ce.number(below && above ? 0 : below ? -1 : above ? 1 : Number.NaN);
      },
    },
    Lattice: {
      GreatestLowerBound: (a, b) => {
        const [x, y] = [blocksOf(a), blocksOf(b)];
        return x === undefined || y === undefined ? undefined : setPartition(meet(x, y));
      },
      LeastUpperBound: (a, b) => {
        const [x, y] = [blocksOf(a), blocksOf(b)];
        return x === undefined || y === undefined ? undefined : setPartition(join(x, y));
      },
    },
  });
}
