// The engines the collectors and tests both need — and nothing else.
//
// This file exists because `collect-provenance.ts` writes a file at import time, and the
// provenance test used to import it just to reach `declaredEngine`. Every test run then
// rewrote the generated data and dirtied the tree. Side effects belong in the script that
// is meant to have them; shared setup belongs here.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAdeles } from "@enumeratio/adeles/src";
import { declareAestimatio } from "@enumeratio/aestimatio/src";
import { declareAnalytic } from "@enumeratio/analytic/src";
import { declareBraid } from "@enumeratio/braid/src";
import { declareDiagrams } from "@enumeratio/diagram/src";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra/src";
import { declareHecke } from "@enumeratio/hecke/src";
import { declareHopf } from "@enumeratio/hopf/src";
import { declareHypercomplex } from "@enumeratio/hypercomplex/src";
import { declareIncidence } from "@enumeratio/incidence/src";
import { declareKernel } from "@enumeratio/kernel/src";
import { declareModular } from "@enumeratio/modular/src";
import { declareNumberTheory } from "@enumeratio/number-theory/src";
import { declareNumerals } from "@enumeratio/numerals/src";
import { declareQuiver } from "@enumeratio/quiver/src";
import { declareResidues } from "@enumeratio/residues/src";

/** Every library we ship BESIDES `@enumeratio/aestimatio`, in the order the reference
 * tests declare them. Split out from `DECLARATIONS` so `configure` below (the `setup`
 * module `@enumeratio/aestimatio/node`'s isolated evaluator loads into a worker) can
 * declare exactly these — the worker's own engine already declares aestimatio itself
 * (redeclaring throws: "already declared in this scope"). */
const LIBRARY_DECLARATIONS = [
  declareAnalytic,
  declareHypercomplex,
  declareDiagrams,
  declareResidues,
  declareNumerals,
  declareHecke,
  declareIncidence,
  declareQuiver,
  declareHopf,
  declareGroupAlgebra,
  declareModular,
  declareNumberTheory,
  declareAdeles,
  declareBraid,
  // Last: it wraps whatever definition of each core head is current.
  declareKernel,
];

/** Every library we ship, in the order the reference tests declare them. */
export const DECLARATIONS = [declareAestimatio, ...LIBRARY_DECLARATIONS];

export const declaredEngine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  for (const declare of DECLARATIONS) declare(ce);
  return ce;
};

/**
 * `configure(ce)` for `@enumeratio/aestimatio/node`'s isolated evaluator (`evaluateIsolated`,
 * `openSession`, `runCases`'s `setup` option): declares every library the reference engine
 * declares, so a case evaluated in a worker means the same thing it would in-process. Not
 * `declaredEngine`'s `DECLARATIONS` verbatim — the worker's own engine already declares
 * `@enumeratio/aestimatio` before running `setup` (see `worker.ts`/`session-worker.ts`).
 */
export function configure(ce: ComputeEngine): void {
  for (const declare of LIBRARY_DECLARATIONS) declare(ce);
}
