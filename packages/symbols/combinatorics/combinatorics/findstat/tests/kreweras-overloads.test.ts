import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps } from "../../src/index.ts";

// The Dyck path overload of InverseKrewerasComplement is the permutation overload on noncrossing
// permutations: a path is a noncrossing partition (the downs after each up step are the block whose
// largest element is that step's index), and a block is the cycle through its elements in order.

const ce = bareEngine();
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((carrier) => [carrier.type, carrier.name])));

const dyckWords = (n: number): number[][] =>
  n === 0
    ? [[]]
    : Array.from({ length: n }, (_, k) => k).flatMap((k) =>
        dyckWords(k).flatMap((inside) => dyckWords(n - 1 - k).map((after) => [1, ...inside, 0, ...after])),
      );

/** The blocks of the path: each down closes the latest open up step. */
function blocksOf(word: readonly number[]): number[][] {
  const open: number[] = [];
  const blocks = new Map<number, number[]>();
  let ups = 0;
  for (const step of word)
    if (step === 1) open.push(++ups);
    else
      blocks.set(
        ups,
        [...(blocks.get(ups) ?? []), open.pop()!].toSorted((a, b) => a - b),
      );
  return [...blocks.values()];
}

/** The path whose blocks are `blocks`. */
const pathOf = (blocks: readonly (readonly number[])[], n: number): number[] =>
  Array.from({ length: n }, (_, k) => k + 1).flatMap((i) => [
    1,
    ...(blocks.find((block) => Math.max(...block) === i)?.map(() => 0) ?? []),
  ]);

const evaluate = (head: string, carrier: string, contents: unknown): unknown =>
  (ce.box([head, [carrier, contents]] as never).evaluate().json as [string, unknown])[1];

// Through semilength 5 in the standard run; 6 under DEEP_TESTS.
const LARGEST = process.env.DEEP_TESTS === "1" ? 6 : 5;

test(
  "InverseKrewerasComplement on Dyck paths is the permutation overload on noncrossing permutations",
  { timeout: 120_000 },
  () => {
    for (let n = 1; n <= LARGEST; n++)
      for (const word of dyckWords(n)) {
        const next = Array.from({ length: n }, (_, k) => k + 1);
        for (const block of blocksOf(word)) block.forEach((x, k) => (next[x - 1] = block[(k + 1) % block.length]!));
        const image = evaluate("InverseKrewerasComplement", "Permutation", ["List", ...next]) as [string, ...number[]];
        const rho = image.slice(1) as number[];
        const seen = new Set<number>();
        const cycles: number[][] = [];
        for (let start = 1; start <= n; start++) {
          if (seen.has(start)) continue;
          const cycle: number[] = [];
          for (let x = start; !seen.has(x); x = rho[x - 1]!) {
            seen.add(x);
            cycle.push(x);
          }
          cycles.push(cycle);
        }
        const expected = ["List", ...pathOf(cycles, n)];
        expect(evaluate("InverseKrewerasComplement", "DyckPath", ["List", ...word]), JSON.stringify(word)).toEqual(
          expected,
        );
      }
  },
);
