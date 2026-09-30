// A family as a plain-number kernel, for the self-cert tests that read an area's `entries`
// straight from its module: an Epsil family is run on an engine and adapted, a NumberKernel is
// returned as it is.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { type EpsilFamily, kernelOn } from "../src/families/epsil.ts";
import type { NumberKernel } from "../src/families/types.ts";

const ce = new ComputeEngine();

export function asNumbers(family: NumberKernel | EpsilFamily): NumberKernel {
  if (!("epsil" in family)) return family;
  const kernel = kernelOn(ce, family);
  return {
    ...kernel,
    count: (p) => Number(kernel.count(p)),
    unrank: (p, r) => kernel.unrank(p, BigInt(r)),
    rank: (element, p) => Number(kernel.rank(element, p)),
  };
}
