// Statistics one carrier's value gives to another whose contents read the same way: a word's
// ascents are a permutation's, a set composition's block sizes are a set partition's. The
// target's table entry runs the source's own kernel and definition on the contents, so the two
// cannot disagree, and the bare head (which already takes the contents) agrees too. A few
// statistics are instead one expression over the contents.

import { type Engine, operandsOf } from "@enumeratio/engine";
import type { MathJSON } from "./types.ts";
import { type Operation, operationOf, registerOperation } from "@enumeratio/structures";

type Subject = Parameters<NonNullable<Operation["definition"]>>[0];

/** `from` carrier, then the carriers whose contents it reads, with the statistics each takes. */
const SHARED: readonly { from: string; to: Readonly<Record<string, readonly string[]>> }[] = [
  {
    // These readings compare entries with each other, so they stand on any sequence.
    from: "Permutation",
    to: {
      Arrangement: ["Ascents", "Descents", "Inversions", "LeftToRightMaxima"],
      BinaryWord: ["Descents", "Runs"],
      ParkingFunction: ["Descents"],
      Surjection: ["Descents"],
      Word: ["Ascents", "Descents", "LongestRun"],
    },
  },
  {
    // These read a value against its position, which an endofunction's or signed permutation's list has too.
    from: "Permutation",
    to: { Endofunction: ["FixedPoints"], SignedPermutation: ["FixedPoints"] },
  },
  {
    // A set composition is a list of blocks, as a set partition is; the blocks' sizes read alike.
    from: "SetPartition",
    to: { SetComposition: ["LargestBlock", "LastBlockSize", "SmallestBlock"] },
  },
  {
    // A perfect matching is a set partition into pairs.
    from: "SetPartition",
    to: { PerfectMatching: ["Crossings", "Nestings"] },
  },
  {
    // A weak composition is a composition whose parts may be 0.
    from: "Composition",
    to: { WeakComposition: ["LargestPart"] },
  },
];

/** Statistics stated as one expression over a carrier's contents (`_x`): the sum of a Lehmer-style table or of a subset's members. */
const EXPRESSIONS: readonly { name: string; expression: MathJSON; carriers: readonly string[] }[] = [
  { name: "Sum", expression: ["Sum", "_x"], carriers: ["PermutationInversion", "SubexcedantSeq"] },
];

/** File the shared statistics in their carriers' `CombinatorialStat` tables, once every area has declared. */
export function declareSharedStatistics(ce: Engine): void {
  for (const { from, to } of SHARED)
    for (const [carrier, names] of Object.entries(to))
      for (const name of names) {
        const source = operationOf(ce, "CombinatorialStat", from, name);
        if (source === undefined) throw new Error(`shared statistics: ${from} has no ${name} to give ${carrier}`);
        // The target's value wraps the contents the source reads.
        const contents = (subject: Subject): Subject =>
          subject.operator === carrier ? (operandsOf(subject)[0] ?? subject) : subject;
        const { definition, kernel } = source;
        registerOperation(ce, "CombinatorialStat", carrier, {
          name,
          ...(source.type === undefined ? {} : { type: source.type }),
          ...(definition === undefined ? {} : { definition: (subject) => definition(contents(subject)) }),
          ...(kernel === undefined ? {} : { kernel: (subject) => kernel(contents(subject)) }),
          ...(source.epsil === undefined ? {} : { epsil: source.epsil }),
        });
      }
  for (const { name, expression, carriers } of EXPRESSIONS)
    for (const carrier of carriers)
      registerOperation(ce, "CombinatorialStat", carrier, {
        name,
        type: "integer",
        epsil: { expression, subject: "_x" },
        definition: (subject) => {
          const inner = subject.operator === carrier ? (operandsOf(subject)[0] ?? subject) : subject;
          return ce
            .box(expression as Parameters<Engine["box"]>[0])
            .subs({ _x: inner })
            .evaluate();
        },
      });
  // A subset packs its size ahead of its members; a bare member list has no size.
  registerOperation(ce, "CombinatorialStat", "Finset", {
    name: "Sum",
    type: "integer",
    definition: (subject) => {
      const packed = subject.operator === "Finset" ? (operandsOf(subject)[0] ?? subject) : subject;
      const members = packed.operator === "Tuple" ? operandsOf(packed)[1] : packed;
      return ce.function("Sum", [members ?? packed]).evaluate();
    },
  });
}
