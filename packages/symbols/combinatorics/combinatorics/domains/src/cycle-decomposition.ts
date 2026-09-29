// A permutation in cycle notation with its fixed points kept (`CycleDecomposition`), so it knows
// its size and converts back. Wolfram's `Cycles` drops fixed points and so doesn't. The
// conversions are the collections kernels (`PermutationsAsCycles`); this is only the MathJSON
// boundary a map runs over.
import { CycleDecomposition, PermutationOfCycleDecomposition } from "../../collections/src/families/permutations.ts";

type MathJSON = unknown;

const decodeInts = (json: MathJSON): number[] | undefined =>
  Array.isArray(json) && json[0] === "List" && json.slice(1).every((x) => Number.isInteger(x))
    ? (json.slice(1) as number[])
    : undefined;

export const cycleDecompositionKernel = (json: MathJSON): MathJSON => {
  const perm = decodeInts(json);
  return perm === undefined ? undefined : ["List", ...CycleDecomposition(perm).map((cycle) => ["List", ...cycle])];
};

export const permutationOfCycleDecompositionKernel = (json: MathJSON): MathJSON => {
  if (!Array.isArray(json) || json[0] !== "List") return undefined;
  const cycles = json.slice(1).map(decodeInts);
  if (cycles.some((cycle) => cycle === undefined)) return undefined;
  const perm = PermutationOfCycleDecomposition(cycles as number[][]);
  return perm === undefined ? undefined : ["List", ...perm];
};
