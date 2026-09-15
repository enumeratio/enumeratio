// The engines the collectors and tests both need — and nothing else.
//
// This file exists because `collect-provenance.ts` writes a file at import time, and the
// provenance test used to import it just to reach `declaredEngine`. Every test run then
// rewrote the generated data and dirtied the tree. Side effects belong in the script that
// is meant to have them; shared setup belongs here.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAnalytic } from "@enumeratio/analytic/src";
import { declareBraid } from "@enumeratio/braid/src";
import { declareDiagrams } from "@enumeratio/diagram/src";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra/src";
import { declareHecke } from "@enumeratio/hecke/src";
import { declareHopf } from "@enumeratio/hopf/src";
import { declareHypercomplex } from "@enumeratio/hypercomplex/src";
import { declareIncidence } from "@enumeratio/incidence/src";
import { declareModular } from "@enumeratio/modular/src";
import { declareNumerals } from "@enumeratio/numerals/src";
import { declareQuiver } from "@enumeratio/quiver/src";

/** Every library we ship, in the order the reference tests declare them. */
export const DECLARATIONS = [
  declareAnalytic,
  declareHypercomplex,
  declareDiagrams,
  declareNumerals,
  declareHecke,
  declareIncidence,
  declareQuiver,
  declareHopf,
  declareGroupAlgebra,
  declareModular,
  declareBraid,
];

export const declaredEngine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  for (const declare of DECLARATIONS) declare(ce);
  return ce;
};
