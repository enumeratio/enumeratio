import { declareLibrary, type Patch } from "../patch.ts";
import { lerchPhiLibrary } from "../compute-engine/library/special-functions.ts";

export const lerchPhiPatch: Patch = {
  id: "lerch-phi",
  issue: "https://github.com/cortex-js/compute-engine/issues/340",
  lands: "LerchPhi(z, s, a), the Lerch transcendent",
  files: [
    "src/compute-engine/numerics/lerch-phi.ts",
    "src/compute-engine/numerics/lerch-phi-continuation.ts",
    "src/compute-engine/numerics/lerch-phi-big.ts",
    "src/compute-engine/library/special-functions.ts",
  ],
  library: lerchPhiLibrary,

  fixed: (ce) => {
    if (ce.lookupDefinition("LerchPhi") === undefined) return false;
    const r = ce.box(["LerchPhi", 0.5, 2, 1]).N();
    return Number.isFinite(r.re) && Math.abs(r.re - 0.5822405264650125) < 1e-9;
  },

  apply: (ce) => declareLibrary(ce, lerchPhiLibrary),
};

export {
  evaluateLerch,
  lerchPhi,
  lerchPhiReal,
  lerchContinued,
  lerchPhiBig,
  lerchPhiBall,
} from "../compute-engine/library/special-functions.ts";
