import { declareLibrary, type Patch } from "../patch.ts";
import { stieltjesLibrary } from "../compute-engine/library/special-functions.ts";

export const stieltjes: Patch = {
  id: "stieltjes",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "StieltjesGamma(n, a), the generalized Stieltjes constants",
  files: [
    "src/compute-engine/numerics/stieltjes.ts",
    "src/compute-engine/numerics/stieltjes-big.ts",
    "src/compute-engine/library/special-functions.ts",
  ],
  library: stieltjesLibrary,

  fixed: (ce) => ce.lookupDefinition("StieltjesGamma") !== undefined,

  apply: (ce) => declareLibrary(ce, stieltjesLibrary),
};

export {
  evaluateStieltjes,
  stieltjesGamma,
  stieltjesGammaReal,
  stieltjesGammaBall,
  stieltjesGammaBig,
  STIELTJES_MAX_ORDER,
} from "../compute-engine/library/special-functions.ts";
