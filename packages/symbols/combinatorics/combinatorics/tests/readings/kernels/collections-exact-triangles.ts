// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { isPermutationOf } from "../../../collections/src/families/exact-triangles.ts";

/** The self-inverse permutations of n. */
export function isInvolutionPermutation(x: unknown, [n]: number[]): boolean {
  return isPermutationOf(x, n) && x.every((image, i) => x[image - 1] === i + 1);
}
